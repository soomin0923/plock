import {
  Bytes,
  clearIndexedDbPersistence,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  initializeFirestore,
  memoryLocalCache,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  setDoc,
  terminate,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { CollectionMap, CollectionName } from '../types';
import { firebaseApp, firestoreDatabaseId, useEmulator } from '../lib/firebase';
import { stripUndefined } from '../lib/util';
import { describeError, type Repo, type SnapshotInfo, type SyncState } from './repo';

// Signed-in storage: Cloud Firestore with its IndexedDB offline cache.
// Data is kept in this browser (works offline, instant reads) and synced to the account,
// so the same diary / planner / ledger shows up on every device the user signs in on.
//
// Layout: accounts/{uid}/{collection}/{recordId}
//         accounts/{uid}/assets/{assetId}  ← one compressed image per document (Bytes)

let db: Firestore | null = null;

function getDb(): Firestore {
  if (db) return db;
  let localCache;
  try {
    localCache = persistentLocalCache({ tabManager: persistentMultipleTabManager() });
  } catch {
    localCache = memoryLocalCache();
  }
  db = initializeFirestore(firebaseApp, { localCache, ignoreUndefinedProperties: true }, firestoreDatabaseId);
  if (useEmulator) connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return db;
}

/** Wipe the offline cache (used on sign-out so the next person on a shared PC sees nothing). */
export async function clearCloudCache(): Promise<void> {
  const instance = getDb();
  await terminate(instance);
  await clearIndexedDbPersistence(instance).catch(() => {});
  db = null;
}

const BATCH_LIMIT = 400;

export class CloudRepo implements Repo {
  readonly kind = 'cloud' as const;
  private db = getDb();
  private pending = new Map<CollectionName, boolean>();
  private fromCache = new Map<CollectionName, boolean>();
  private syncListeners = new Set<(s: SyncState, detail?: string) => void>();
  private errorListeners = new Set<(m: string) => void>();
  private lastError: string | null = null;
  private unsubs: (() => void)[] = [];

  constructor(private uid: string) {
    const onNet = () => this.emitSync();
    window.addEventListener('online', onNet);
    window.addEventListener('offline', onNet);
    this.unsubs.push(() => {
      window.removeEventListener('online', onNet);
      window.removeEventListener('offline', onNet);
    });
  }

  private col(name: string) {
    return collection(this.db, 'accounts', this.uid, name);
  }

  private computeSync(): SyncState {
    if (this.lastError) return 'error';
    if (Array.from(this.pending.values()).some(Boolean)) return navigator.onLine ? 'pending' : 'offline';
    if (!navigator.onLine) return 'offline';
    return 'synced';
  }

  private emitSync() {
    const s = this.computeSync();
    this.syncListeners.forEach((cb) => cb(s, this.lastError || undefined));
  }

  private reportError(err: unknown) {
    const msg = describeError(err);
    this.lastError = msg;
    this.errorListeners.forEach((cb) => cb(msg));
    this.emitSync();
  }

  subscribe<K extends CollectionName>(name: K, cb: (items: CollectionMap[K][], info: SnapshotInfo) => void) {
    const unsub = onSnapshot(
      this.col(name),
      { includeMetadataChanges: true },
      (snap) => {
        this.pending.set(name, snap.metadata.hasPendingWrites);
        this.fromCache.set(name, snap.metadata.fromCache);
        if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache && this.lastError) {
          this.lastError = null;
        }
        this.emitSync();
        cb(
          snap.docs.map((d) => d.data() as CollectionMap[K]),
          { authoritative: !snap.metadata.fromCache },
        );
      },
      (err) => this.reportError(err),
    );
    return unsub;
  }

  async put<K extends CollectionName>(name: K, items: CollectionMap[K][]): Promise<void> {
    if (!items.length) return;
    try {
      if (items.length === 1) {
        await setDoc(doc(this.col(name), items[0].id), stripUndefined(items[0]));
        return;
      }
      for (let i = 0; i < items.length; i += BATCH_LIMIT) {
        const batch = writeBatch(this.db);
        items.slice(i, i + BATCH_LIMIT).forEach((it) => batch.set(doc(this.col(name), it.id), stripUndefined(it)));
        await batch.commit();
      }
    } catch (e) {
      this.reportError(e);
      throw e;
    }
  }

  async remove(name: CollectionName, ids: string[]): Promise<void> {
    if (!ids.length) return;
    try {
      for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
        const batch = writeBatch(this.db);
        ids.slice(i, i + BATCH_LIMIT).forEach((id) => batch.delete(doc(this.col(name), id)));
        await batch.commit();
      }
    } catch (e) {
      this.reportError(e);
      throw e;
    }
  }

  async putAsset(id: string, blob: Blob): Promise<void> {
    const bytes = Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer()));
    const createdAt = new Date().toISOString();
    const type = blob.type || 'image/jpeg';
    try {
      // The image and a tiny index entry are written together; the index lets us list/measure
      // images without downloading them.
      const batch = writeBatch(this.db);
      batch.set(doc(this.col('assets'), id), { data: bytes, type, size: blob.size, createdAt });
      batch.set(doc(this.col('assetIndex'), id), { id, type, size: blob.size, createdAt });
      await batch.commit();
    } catch (e) {
      this.reportError(e);
      throw e;
    }
  }

  async getAsset(id: string): Promise<Blob | null> {
    const ref = doc(this.col('assets'), id);
    let snap;
    try {
      // Assets never change once written, so the offline cache is always good enough.
      snap = await getDocFromCache(ref);
    } catch {
      snap = await getDoc(ref);
    }
    if (!snap.exists()) return null;
    const d = snap.data() as { data: Bytes; type?: string };
    return new Blob([d.data.toUint8Array() as BlobPart], { type: d.type || 'image/jpeg' });
  }

  async removeAsset(ids: string[]): Promise<void> {
    if (!ids.length) return;
    try {
      for (let i = 0; i < ids.length; i += BATCH_LIMIT / 2) {
        const batch = writeBatch(this.db);
        ids.slice(i, i + BATCH_LIMIT / 2).forEach((id) => {
          batch.delete(doc(this.col('assets'), id));
          batch.delete(doc(this.col('assetIndex'), id));
        });
        await batch.commit();
      }
    } catch (e) {
      this.reportError(e);
    }
  }

  async listAssetIds(): Promise<string[]> {
    const snap = await getDocs(this.col('assetIndex'));
    return snap.docs.map((d) => d.id);
  }

  async assetBytes(): Promise<number> {
    const snap = await getDocs(this.col('assetIndex'));
    return snap.docs.reduce((sum, d) => sum + (Number(d.data().size) || 0), 0);
  }

  onSyncState(cb: (state: SyncState, detail?: string) => void) {
    this.syncListeners.add(cb);
    cb(this.computeSync(), this.lastError || undefined);
    return () => {
      this.syncListeners.delete(cb);
    };
  }

  onError(cb: (message: string) => void) {
    this.errorListeners.add(cb);
    return () => {
      this.errorListeners.delete(cb);
    };
  }

  dispose() {
    this.unsubs.forEach((u) => u());
    this.syncListeners.clear();
    this.errorListeners.clear();
  }
}
