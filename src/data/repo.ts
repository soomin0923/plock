import type { CollectionMap, CollectionName } from '../types';

export type SyncState = 'local' | 'synced' | 'pending' | 'offline' | 'error';

export interface SnapshotInfo {
  /** True when the data has been confirmed by the source of truth (always true for local storage). */
  authoritative: boolean;
}

export interface Repo {
  readonly kind: 'local' | 'cloud';
  subscribe<K extends CollectionName>(
    col: K,
    cb: (items: CollectionMap[K][], info: SnapshotInfo) => void,
  ): () => void;
  put<K extends CollectionName>(col: K, items: CollectionMap[K][]): Promise<void>;
  remove(col: CollectionName, ids: string[]): Promise<void>;
  putAsset(id: string, blob: Blob): Promise<void>;
  getAsset(id: string): Promise<Blob | null>;
  removeAsset(ids: string[]): Promise<void>;
  listAssetIds(): Promise<string[]>;
  onSyncState(cb: (state: SyncState, detail?: string) => void): () => void;
  onError(cb: (message: string) => void): () => void;
  dispose(): void;
}

export const ASSET_PREFIX = 'asset:';

export function isAssetRef(v: unknown): v is `asset:${string}` {
  return typeof v === 'string' && v.startsWith(ASSET_PREFIX);
}

export function assetIdOf(ref: string): string {
  return ref.slice(ASSET_PREFIX.length);
}

export function toAssetRef(id: string): string {
  return `${ASSET_PREFIX}${id}`;
}

/** Collect every asset ref used anywhere inside a value (deep scan). */
export function collectAssetRefs(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (isAssetRef(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectAssetRefs(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectAssetRefs(v, out));
  return out;
}

export function describeError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code.includes('permission-denied')) return '권한이 없어 저장하지 못했습니다. 다시 로그인해 주세요.';
  if (code.includes('resource-exhausted')) return '저장 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.';
  if (code.includes('invalid-argument')) return '저장할 수 없는 데이터 형식입니다.';
  if ((err as Error)?.name === 'QuotaExceededError') return '브라우저 저장 공간이 부족합니다.';
  return (err as Error)?.message || '알 수 없는 오류가 발생했습니다.';
}
