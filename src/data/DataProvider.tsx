import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionMap, CollectionName, Prefs } from '../types';
import { COLLECTIONS } from '../types';
import { useToast } from '../components/Toast';
import { assertRecentLogin, deleteCurrentUser, signOutUser, watchAuth, type AuthUser } from '../lib/auth';
import { compressImage, type ImagePreset } from '../lib/image';
import { newId, nowIso } from '../lib/util';
import { LocalRepo } from './localRepo';
import { assetIdOf, collectAssetRefs, isAssetRef, toAssetRef, type Repo, type SyncState } from './repo';
import { DEFAULT_CATEGORIES, DEFAULT_LEDGER_CATEGORIES, DEFAULT_PREFS } from './defaults';
import { normalizeList } from './normalize';
import { buildBackup, countRecords, type ImportBundle, type RecordsByCollection } from './bundle';

export type DataState = { [K in CollectionName]: CollectionMap[K][] };

const emptyData = (): DataState =>
  Object.fromEntries(COLLECTIONS.map((c) => [c, []])) as unknown as DataState;

type AnyRecord = CollectionMap[CollectionName];

export interface DataApi {
  authReady: boolean;
  user: AuthUser | null;
  repoKind: 'local' | 'cloud' | null;
  fatalError: string | null;
  sync: { state: SyncState; detail?: string };
  loaded: boolean;
  data: DataState;
  prefs: Prefs;
  upsert<K extends CollectionName>(col: K, items: CollectionMap[K] | CollectionMap[K][]): void;
  remove(col: CollectionName, ids: string | string[]): void;
  /** Compress and store an image; returns an `asset:` ref to put in a record. */
  saveImage(file: Blob, preset: ImagePreset): Promise<string>;
  /** Store an image that is already processed (e.g. a generated sticker). */
  storeImage(blob: Blob): Promise<string>;
  loadImageBlob(ref: string): Promise<Blob | null>;
  loadImageUrl(ref: string): Promise<string | null>;
  /** Delete images that are no longer referenced, taking a pending change into account. */
  releaseImages(refs: (string | undefined)[], change?: { col: CollectionName; id: string; next?: AnyRecord }): void;
  savePrefs(patch: Partial<Prefs>): void;
  guestMigration: number | null;
  migrateGuestData(onProgress?: (msg: string) => void): Promise<void>;
  discardGuestData(): Promise<void>;
  dismissGuestMigration(): void;
  importBundle(bundle: ImportBundle, onProgress?: (msg: string) => void): Promise<number>;
  exportBackup(onProgress?: (done: number, total: number) => void): Promise<Blob>;
  deleteAllData(): Promise<void>;
  cleanupImages(): Promise<number>;
  storageBytes(): Promise<number | null>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const DataContext = createContext<DataApi | null>(null);

export function useData(): DataApi {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [repo, setRepo] = useState<Repo | null>(null);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [sync, setSync] = useState<{ state: SyncState; detail?: string }>({ state: 'local' });
  const [data, setData] = useState<DataState>(emptyData);
  const [readyCols, setReadyCols] = useState<Set<CollectionName>>(new Set());
  const [forceLoaded, setForceLoaded] = useState(false);
  const [guestMigration, setGuestMigration] = useState<number | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;
  const repoRef = useRef<Repo | null>(null);
  repoRef.current = repo;
  const imageUrls = useRef(new Map<string, Promise<string | null>>());

  // 1) Auth state
  useEffect(
    () =>
      watchAuth((u) => {
        setUser(u);
        setAuthReady(true);
      }),
    [],
  );

  // 2) Pick storage: Firestore (signed in) or IndexedDB (guest)
  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    let created: Repo | null = null;
    setRepo(null);
    setData(emptyData());
    setReadyCols(new Set());
    setForceLoaded(false);
    imageUrls.current.forEach((p) => p.then((u) => u?.startsWith('blob:') && URL.revokeObjectURL(u)));
    imageUrls.current.clear();

    (async () => {
      if (user) {
        const { CloudRepo } = await import('./cloudRepo');
        created = new CloudRepo(user.uid);
      } else {
        created = await LocalRepo.open();
      }
      if (cancelled) {
        created.dispose();
        return;
      }
      setRepo(created);
    })().catch((e) => {
      if (!cancelled) setFatalError((e as Error)?.message || '저장소를 열 수 없습니다.');
    });

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [authReady, user?.uid]);

  // 3) Subscribe to every collection
  useEffect(() => {
    if (!repo) return;
    const seeded = new Set<CollectionName>();
    const unsubs = COLLECTIONS.map((col) =>
      repo.subscribe(col, (items, info) => {
        const list = normalizeList(col, items as unknown[]);
        setData((prev) => ({ ...prev, [col]: list }));
        if (info.authoritative || list.length) {
          setReadyCols((prev) => (prev.has(col) ? prev : new Set(prev).add(col)));
        }
        // Seed defaults only when the source of truth confirms the collection is empty.
        if (info.authoritative && !list.length && !seeded.has(col)) {
          seeded.add(col);
          if (col === 'categories') repo.put('categories', DEFAULT_CATEGORIES).catch(() => {});
          if (col === 'ledgerCategories') repo.put('ledgerCategories', DEFAULT_LEDGER_CATEGORIES).catch(() => {});
        }
      }),
    );
    const offSync = repo.onSyncState((state, detail) => setSync({ state, detail }));
    const offErr = repo.onError((msg) => toast(msg, 'error'));
    // Offline on a new device: don't spin forever waiting for the server.
    const timer = setTimeout(() => setForceLoaded(true), 3500);
    return () => {
      unsubs.forEach((u) => u());
      offSync();
      offErr();
      clearTimeout(timer);
    };
  }, [repo, toast]);

  // 4) Offer to move guest data into the account after signing in
  useEffect(() => {
    if (!user) {
      setGuestMigration(null);
      return;
    }
    let cancelled = false;
    LocalRepo.open()
      .then(async (local) => {
        const n = await local.countRecords();
        local.dispose();
        if (!cancelled && n > 0) setGuestMigration(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const loaded = forceLoaded || COLLECTIONS.every((c) => readyCols.has(c));

  const upsert = useCallback(<K extends CollectionName>(col: K, items: CollectionMap[K] | CollectionMap[K][]) => {
    const r = repoRef.current;
    if (!r) return;
    const list = (Array.isArray(items) ? items : [items]).map((it) => ({
      ...it,
      createdAt: it.createdAt || nowIso(),
      updatedAt: nowIso(),
    }));
    r.put(col, list as CollectionMap[K][]).catch(() => {});
  }, []);

  const remove = useCallback((col: CollectionName, ids: string | string[]) => {
    repoRef.current?.remove(col, Array.isArray(ids) ? ids : [ids]).catch(() => {});
  }, []);

  const storeImage = useCallback(async (blob: Blob) => {
    const r = repoRef.current;
    if (!r) throw new Error('저장소가 준비되지 않았습니다.');
    const id = newId('img');
    const ref = toAssetRef(id);
    // Show the image immediately, even before the upload finishes.
    imageUrls.current.set(ref, Promise.resolve(URL.createObjectURL(blob)));
    r.putAsset(id, blob).catch(() => {});
    return ref;
  }, []);

  const saveImage = useCallback(async (file: Blob, preset: ImagePreset) => storeImage(await compressImage(file, preset)), [storeImage]);

  const loadImageBlob = useCallback(async (ref: string) => {
    const r = repoRef.current;
    if (!r || !isAssetRef(ref)) return null;
    return r.getAsset(assetIdOf(ref));
  }, []);

  const loadImageUrl = useCallback(
    (ref: string) => {
      if (!isAssetRef(ref)) return Promise.resolve(ref || null);
      let p = imageUrls.current.get(ref);
      if (!p) {
        p = loadImageBlob(ref)
          .then((b) => (b ? URL.createObjectURL(b) : null))
          .catch(() => null);
        imageUrls.current.set(ref, p);
        // Don't cache misses forever: the image may still be syncing from another device.
        p.then((u) => {
          if (!u) setTimeout(() => imageUrls.current.delete(ref), 5000);
        });
      }
      return p;
    },
    [loadImageBlob],
  );

  const referencedRefs = useCallback((change?: { col: CollectionName; id: string; next?: AnyRecord }) => {
    const out = new Set<string>();
    const d = dataRef.current;
    for (const col of COLLECTIONS) {
      for (const rec of d[col] as AnyRecord[]) {
        if (change && change.col === col && change.id === rec.id) continue;
        collectAssetRefs(rec, out);
      }
    }
    if (change?.next) collectAssetRefs(change.next, out);
    return out;
  }, []);

  const releaseImages = useCallback<DataApi['releaseImages']>(
    (refs, change) => {
      const r = repoRef.current;
      if (!r) return;
      const used = referencedRefs(change);
      const unused = Array.from(new Set(refs.filter((x): x is string => isAssetRef(x)))).filter((x) => !used.has(x));
      if (unused.length) r.removeAsset(unused.map(assetIdOf)).catch(() => {});
    },
    [referencedRefs],
  );

  const prefs = data.prefs.find((p) => p.id === 'main') || DEFAULT_PREFS;
  const savePrefs = useCallback(
    (patch: Partial<Prefs>) => {
      const current = dataRef.current.prefs.find((p) => p.id === 'main') || DEFAULT_PREFS;
      upsert('prefs', { ...current, ...patch, id: 'main' });
    },
    [upsert],
  );

  const importBundle = useCallback(async (bundle: ImportBundle, onProgress?: (msg: string) => void) => {
    const r = repoRef.current;
    if (!r) throw new Error('저장소가 준비되지 않았습니다.');
    for (let i = 0; i < bundle.assets.length; i++) {
      onProgress?.(`이미지 저장 중 ${i + 1}/${bundle.assets.length}`);
      const { id, blob } = bundle.assets[i];
      // Don't wait for the server: writes are queued locally and upload in the background.
      r.putAsset(id, blob).catch(() => {});
    }
    onProgress?.('기록 저장 중…');
    for (const col of COLLECTIONS) {
      const list = bundle.records[col];
      if (list?.length) r.put(col, list as never).catch(() => {});
    }
    return countRecords(bundle.records);
  }, []);

  const migrateGuestData = useCallback(
    async (onProgress?: (msg: string) => void) => {
      const local = await LocalRepo.open();
      try {
        const { records, assetIds } = await local.readAll();
        const assets: ImportBundle['assets'] = [];
        for (const id of assetIds) {
          const blob = await local.getAsset(id);
          if (blob) assets.push({ id, blob });
        }
        const normalized: RecordsByCollection = {};
        for (const col of COLLECTIONS) {
          if (records[col]?.length) (normalized as Record<string, unknown>)[col] = normalizeList(col, records[col]!);
        }
        await importBundle({ records: normalized, assets }, onProgress);
        await local.clearAll();
        setGuestMigration(null);
      } finally {
        local.dispose();
      }
    },
    [importBundle],
  );

  const discardGuestData = useCallback(async () => {
    const local = await LocalRepo.open();
    await local.clearAll();
    local.dispose();
    setGuestMigration(null);
  }, []);

  const exportBackup = useCallback(
    (onProgress?: (done: number, total: number) => void) => {
      const d = dataRef.current;
      const records: RecordsByCollection = {};
      for (const col of COLLECTIONS) (records as Record<string, unknown>)[col] = d[col];
      return buildBackup(records, loadImageBlob, onProgress);
    },
    [loadImageBlob],
  );

  const deleteAllData = useCallback(async () => {
    const r = repoRef.current;
    if (!r) return;
    const d = dataRef.current;
    for (const col of COLLECTIONS) {
      const ids = (d[col] as AnyRecord[]).map((x) => x.id);
      if (ids.length) r.remove(col, ids).catch(() => {});
    }
    const assetIds = await r.listAssetIds().catch(() => [] as string[]);
    if (assetIds.length) await r.removeAsset(assetIds).catch(() => {});
    // Keep the app usable: restore the default categories.
    r.put('categories', DEFAULT_CATEGORIES).catch(() => {});
    r.put('ledgerCategories', DEFAULT_LEDGER_CATEGORIES).catch(() => {});
  }, []);

  const cleanupImages = useCallback(async () => {
    const r = repoRef.current;
    if (!r) return 0;
    const used = new Set(Array.from(referencedRefs()).map(assetIdOf));
    const unused = (await r.listAssetIds()).filter((id) => !used.has(id));
    if (unused.length) await r.removeAsset(unused);
    return unused.length;
  }, [referencedRefs]);

  const storageBytes = useCallback(async () => {
    const r = repoRef.current as (Repo & { assetBytes?: () => Promise<number> }) | null;
    if (r?.assetBytes) return r.assetBytes().catch(() => null);
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate().catch(() => null);
      return est?.usage ?? null;
    }
    return null;
  }, []);

  const signOut = useCallback(async () => {
    const kind = repoRef.current?.kind;
    await signOutUser();
    if (kind === 'cloud') {
      // Remove this account's offline copy so the next person using this browser can't see it.
      const { clearCloudCache } = await import('./cloudRepo');
      await clearCloudCache().catch(() => {});
      window.location.reload();
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    assertRecentLogin();
    await deleteAllData();
    await deleteCurrentUser();
    const { clearCloudCache } = await import('./cloudRepo');
    await clearCloudCache().catch(() => {});
    window.location.reload();
  }, [deleteAllData]);

  const api = useMemo<DataApi>(
    () => ({
      authReady,
      user,
      repoKind: repo?.kind ?? null,
      fatalError,
      sync,
      loaded: !!repo && loaded,
      data,
      prefs,
      upsert,
      remove,
      saveImage,
      storeImage,
      loadImageBlob,
      loadImageUrl,
      releaseImages,
      savePrefs,
      guestMigration,
      migrateGuestData,
      discardGuestData,
      dismissGuestMigration: () => setGuestMigration(null),
      importBundle,
      exportBackup,
      deleteAllData,
      cleanupImages,
      storageBytes,
      signOut,
      deleteAccount,
    }),
    [
      authReady, user, repo, fatalError, sync, loaded, data, prefs, upsert, remove, saveImage, storeImage, loadImageBlob,
      loadImageUrl, releaseImages, savePrefs, guestMigration, migrateGuestData, discardGuestData, importBundle,
      exportBackup, deleteAllData, cleanupImages, storageBytes, signOut, deleteAccount,
    ],
  );

  return <DataContext.Provider value={api}>{children}</DataContext.Provider>;
}
