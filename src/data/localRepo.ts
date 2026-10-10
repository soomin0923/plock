import type { CollectionMap, CollectionName } from '../types';
import { describeError, type Repo, type SnapshotInfo, type SyncState } from './repo';

// Guest storage: everything lives in this browser's IndexedDB.
// IndexedDB (unlike localStorage) holds hundreds of MB and stores image Blobs natively.

const DB_NAME = 'plock-guest';
const DB_VERSION = 1;
const RECORDS = 'records';
const ASSETS = 'assets';

interface RecordRow {
  key: string;
  col: CollectionName;
  data: unknown;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
}

export function openGuestDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('이 브라우저는 로컬 저장소(IndexedDB)를 지원하지 않습니다.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(RECORDS)) {
        const store = db.createObjectStore(RECORDS, { keyPath: 'key' });
        store.createIndex('col', 'col');
      }
      if (!db.objectStoreNames.contains(ASSETS)) db.createObjectStore(ASSETS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('로컬 저장소를 열 수 없습니다.'));
    req.onblocked = () => reject(new Error('다른 탭에서 앱을 업데이트 중입니다. 다른 탭을 닫고 새로고침해 주세요.'));
  });
}

type Listener = (items: unknown[], info: SnapshotInfo) => void;

export class LocalRepo implements Repo {
  readonly kind = 'local' as const;
  private cache = new Map<CollectionName, Map<string, unknown>>();
  private loading = new Map<CollectionName, Promise<void>>();
  private listeners = new Map<CollectionName, Set<Listener>>();
  private errorListeners = new Set<(m: string) => void>();
  private channel: BroadcastChannel | null = null;
  private persistRequested = false;

  constructor(private db: IDBDatabase) {
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel('plock-guest');
      this.channel.onmessage = (ev) => {
        const col = ev.data?.col as CollectionName | undefined;
        if (col && this.cache.has(col)) {
          this.cache.delete(col);
          this.loading.delete(col);
          this.ensureLoaded(col).then(() => this.emit(col));
        }
      };
    }
  }

  static async open(): Promise<LocalRepo> {
    return new LocalRepo(await openGuestDb());
  }

  private ensureLoaded(col: CollectionName): Promise<void> {
    if (this.cache.has(col)) return Promise.resolve();
    let p = this.loading.get(col);
    if (!p) {
      p = (async () => {
        const tx = this.db.transaction(RECORDS, 'readonly');
        const rows = await reqToPromise(tx.objectStore(RECORDS).index('col').getAll(col) as IDBRequest<RecordRow[]>);
        const map = new Map<string, unknown>();
        rows.forEach((r) => map.set((r.data as { id: string }).id, r.data));
        this.cache.set(col, map);
      })();
      this.loading.set(col, p);
    }
    return p;
  }

  private emit(col: CollectionName) {
    const map = this.cache.get(col);
    if (!map) return;
    const items = Array.from(map.values());
    this.listeners.get(col)?.forEach((cb) => cb(items, { authoritative: true }));
  }

  private reportError(err: unknown) {
    const msg = describeError(err);
    this.errorListeners.forEach((cb) => cb(msg));
  }

  private requestPersistence() {
    if (this.persistRequested) return;
    this.persistRequested = true;
    // Ask the browser not to evict guest data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
  }

  subscribe<K extends CollectionName>(col: K, cb: (items: CollectionMap[K][], info: SnapshotInfo) => void) {
    const set = this.listeners.get(col) || new Set();
    set.add(cb as Listener);
    this.listeners.set(col, set);
    this.ensureLoaded(col)
      .then(() => {
        if (set.has(cb as Listener)) {
          cb(Array.from(this.cache.get(col)!.values()) as CollectionMap[K][], { authoritative: true });
        }
      })
      .catch((e) => this.reportError(e));
    return () => {
      set.delete(cb as Listener);
    };
  }

  async put<K extends CollectionName>(col: K, items: CollectionMap[K][]): Promise<void> {
    if (!items.length) return;
    await this.ensureLoaded(col);
    const map = this.cache.get(col)!;
    items.forEach((it) => map.set(it.id, it));
    this.emit(col);
    this.requestPersistence();
    try {
      const tx = this.db.transaction(RECORDS, 'readwrite');
      const store = tx.objectStore(RECORDS);
      items.forEach((it) => store.put({ key: `${col}:${it.id}`, col, data: it } satisfies RecordRow));
      await txDone(tx);
      this.channel?.postMessage({ col });
    } catch (e) {
      this.reportError(e);
      throw e;
    }
  }

  async remove(col: CollectionName, ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.ensureLoaded(col);
    const map = this.cache.get(col)!;
    ids.forEach((id) => map.delete(id));
    this.emit(col);
    try {
      const tx = this.db.transaction(RECORDS, 'readwrite');
      const store = tx.objectStore(RECORDS);
      ids.forEach((id) => store.delete(`${col}:${id}`));
      await txDone(tx);
      this.channel?.postMessage({ col });
    } catch (e) {
      this.reportError(e);
      throw e;
    }
  }

  async putAsset(id: string, blob: Blob): Promise<void> {
    this.requestPersistence();
    const tx = this.db.transaction(ASSETS, 'readwrite');
    tx.objectStore(ASSETS).put({ id, blob, type: blob.type });
    await txDone(tx);
  }

  async getAsset(id: string): Promise<Blob | null> {
    const tx = this.db.transaction(ASSETS, 'readonly');
    const row = await reqToPromise(tx.objectStore(ASSETS).get(id) as IDBRequest<{ blob: Blob } | undefined>);
    return row?.blob || null;
  }

  async removeAsset(ids: string[]): Promise<void> {
    if (!ids.length) return;
    const tx = this.db.transaction(ASSETS, 'readwrite');
    const store = tx.objectStore(ASSETS);
    ids.forEach((id) => store.delete(id));
    await txDone(tx);
  }

  async listAssetIds(): Promise<string[]> {
    const tx = this.db.transaction(ASSETS, 'readonly');
    return (await reqToPromise(tx.objectStore(ASSETS).getAllKeys())) as string[];
  }

  async assetBytes(): Promise<number> {
    const tx = this.db.transaction(ASSETS, 'readonly');
    const rows = (await reqToPromise(tx.objectStore(ASSETS).getAll())) as { blob: Blob }[];
    return rows.reduce((sum, r) => sum + (r.blob?.size || 0), 0);
  }

  /** Total number of stored records (used to offer guest → account migration). */
  async countRecords(): Promise<number> {
    const tx = this.db.transaction(RECORDS, 'readonly');
    const rows = (await reqToPromise(tx.objectStore(RECORDS).getAll())) as RecordRow[];
    // Default categories / prefs alone don't count as "user data".
    return rows.filter((r) => r.col !== 'categories' && r.col !== 'ledgerCategories' && r.col !== 'prefs').length;
  }

  async readAll(): Promise<{ records: Partial<Record<CollectionName, unknown[]>>; assetIds: string[] }> {
    const tx = this.db.transaction(RECORDS, 'readonly');
    const rows = (await reqToPromise(tx.objectStore(RECORDS).getAll())) as RecordRow[];
    const records: Partial<Record<CollectionName, unknown[]>> = {};
    rows.forEach((r) => {
      (records[r.col] ||= []).push(r.data);
    });
    return { records, assetIds: await this.listAssetIds() };
  }

  async clearAll(): Promise<void> {
    const tx = this.db.transaction([RECORDS, ASSETS], 'readwrite');
    tx.objectStore(RECORDS).clear();
    tx.objectStore(ASSETS).clear();
    await txDone(tx);
    const cols = Array.from(this.cache.keys());
    this.cache.clear();
    this.loading.clear();
    for (const col of cols) {
      await this.ensureLoaded(col);
      this.emit(col);
      this.channel?.postMessage({ col });
    }
  }

  onSyncState(cb: (state: SyncState) => void) {
    cb('local');
    return () => {};
  }

  onError(cb: (message: string) => void) {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  dispose() {
    this.channel?.close();
    this.listeners.clear();
    this.errorListeners.clear();
    this.db.close();
  }
}
