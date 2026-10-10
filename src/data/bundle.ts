import type { CollectionMap, CollectionName, Mood, StickerPlacement } from '../types';
import { COLLECTIONS } from '../types';
import { LEGACY_CATEGORIES } from './defaults';
import { compressImage, dataUrlToBlob, PHOTO_PRESET, RECEIPT_PRESET, STICKER_PRESET, type ImagePreset } from '../lib/image';
import { isValidYmd, today } from '../lib/date';
import { newId, nowIso } from '../lib/util';
import { assetIdOf, collectAssetRefs, isAssetRef, toAssetRef } from './repo';
import { normalizeList } from './normalize';

// Backup files (export / import) and migration from the previous version of the app.

export type RecordsByCollection = Partial<{ [K in CollectionName]: CollectionMap[K][] }>;

export interface ImportBundle {
  records: RecordsByCollection;
  assets: { id: string; blob: Blob }[];
}

export function countRecords(records: RecordsByCollection): number {
  return COLLECTIONS.filter((c) => c !== 'prefs').reduce((n, c) => n + (records[c]?.length || 0), 0);
}

// ---------------------------------------------------------------- export

export interface BackupFileV2 {
  app: 'plock';
  version: 2;
  exportedAt: string;
  collections: RecordsByCollection;
  assets: Record<string, string>; // asset id → data URL
}

export async function buildBackup(
  records: RecordsByCollection,
  loadBlob: (ref: string) => Promise<Blob | null>,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const refs = Array.from(collectAssetRefs(records));
  const assets: Record<string, string> = {};
  let done = 0;
  for (const ref of refs) {
    const blob = await loadBlob(ref).catch(() => null);
    if (blob) {
      assets[assetIdOf(ref)] = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
      });
    }
    onProgress?.(++done, refs.length);
  }
  const file: BackupFileV2 = { app: 'plock', version: 2, exportedAt: nowIso(), collections: records, assets };
  return new Blob([JSON.stringify(file)], { type: 'application/json' });
}

// ---------------------------------------------------------------- import

export async function parseBackup(json: unknown, onProgress?: (msg: string) => void): Promise<ImportBundle> {
  if (!json || typeof json !== 'object') throw new Error('백업 파일 형식이 올바르지 않습니다.');
  const obj = json as Record<string, unknown>;

  if (obj.app === 'plock' && obj.version === 2 && obj.collections && typeof obj.collections === 'object') {
    const records: RecordsByCollection = {};
    const cols = obj.collections as Record<string, unknown>;
    for (const c of COLLECTIONS) {
      if (Array.isArray(cols[c])) (records as Record<string, unknown>)[c] = normalizeList(c, cols[c] as unknown[]);
    }
    const assets: ImportBundle['assets'] = [];
    const rawAssets = (obj.assets || {}) as Record<string, unknown>;
    const ids = Object.keys(rawAssets);
    for (let i = 0; i < ids.length; i++) {
      const v = rawAssets[ids[i]];
      if (typeof v === 'string' && v.startsWith('data:')) {
        onProgress?.(`이미지 불러오는 중 ${i + 1}/${ids.length}`);
        assets.push({ id: ids[i], blob: await dataUrlToBlob(v) });
      }
    }
    return { records, assets };
  }

  if (Array.isArray(obj.plannerItems) || Array.isArray(obj.diaries) || Array.isArray(obj.financials)) {
    return convertLegacy(obj as LegacyData, onProgress);
  }

  throw new Error('Plock 백업 파일이 아닙니다.');
}

// ---------------------------------------------------------------- legacy (v1) data

type LegacyItem = Record<string, any>;
export interface LegacyData {
  plannerItems?: LegacyItem[];
  routines?: LegacyItem[];
  checklist?: LegacyItem[];
  diaries?: LegacyItem[];
  financials?: LegacyItem[];
  userStickers?: LegacyItem[];
  categories?: LegacyItem[];
}

export interface LegacySource {
  key: string;
  label: string;
  total: number;
  data: LegacyData;
}

const LEGACY_DONE_KEY = 'plock_legacy_imported_keys';

export function legacyImportedKeys(): string[] {
  try {
    return JSON.parse(localStorage.getItem(LEGACY_DONE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function markLegacyImported(key: string) {
  const keys = new Set(legacyImportedKeys());
  keys.add(key);
  try {
    localStorage.setItem(LEGACY_DONE_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    /* ignore */
  }
}

/** Data the previous version left in this browser's localStorage (same site → still readable). */
export function findLegacySources(): LegacySource[] {
  const out: LegacySource[] = [];
  let names: Record<string, string> = {};
  try {
    const vault = JSON.parse(localStorage.getItem('plock_users_vault_v1') || localStorage.getItem('chronicle_users_vault_v1') || '[]');
    if (Array.isArray(vault)) vault.forEach((u: LegacyItem) => u?.id && (names[u.id] = u.name || u.username));
  } catch {
    names = {};
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const m = key.match(/^chronicle_user_(.+)_data$/);
    if (!m && key !== 'chronicle_app_v2_data') continue;
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null') as LegacyData | null;
      if (!data || typeof data !== 'object') continue;
      const total =
        (data.plannerItems?.length || 0) +
        (data.routines?.length || 0) +
        (data.checklist?.length || 0) +
        (data.diaries?.length || 0) +
        (data.financials?.length || 0) +
        (data.userStickers?.length || 0);
      if (!total) continue;
      const label = m
        ? m[1] === 'usr_guest'
          ? '이전 버전 · 게스트'
          : `이전 버전 · ${names[m[1]] || m[1]} 계정`
        : '이전 버전 · 마지막 작업 데이터';
      out.push({ key, label, total, data });
    } catch {
      /* skip unreadable entry */
    }
  }
  return out;
}

const LEGACY_LEDGER_CATEGORY: Record<string, string> = {
  식비: 'lc_food',
  교통: 'lc_transport',
  쇼핑: 'lc_shopping',
  '문화/여가': 'lc_culture',
  '주거/통신': 'lc_housing',
  '의료/건강': 'lc_health',
  급여: 'lc_salary',
  용돈: 'lc_allowance',
  부수입: 'lc_side',
  금융소득: 'lc_interest',
};

const LEGACY_MOOD: Record<string, Mood> = {
  joy: 'joy',
  calm: 'calm',
  excited: 'excited',
  inspired: 'excited',
  love: 'love',
  sad: 'sad',
  angry: 'angry',
  tired: 'tired',
};

export async function convertLegacy(data: LegacyData, onProgress?: (msg: string) => void): Promise<ImportBundle> {
  const assets: ImportBundle['assets'] = [];
  const imageCache = new Map<string, string>();
  let imageCount = 0;

  // Old versions stored full-size photos inline as data URLs. Re-compress them into assets.
  const toRef = async (src: unknown, preset: ImagePreset): Promise<string | null> => {
    if (typeof src !== 'string' || !src) return null;
    if (isAssetRef(src) || src.startsWith('http')) return src;
    if (!src.startsWith('data:image')) return null;
    const cached = imageCache.get(src);
    if (cached) return cached;
    try {
      onProgress?.(`사진 변환 중… (${++imageCount})`);
      const blob = await compressImage(await dataUrlToBlob(src), preset);
      const id = newId('img');
      assets.push({ id, blob });
      const ref = toAssetRef(id);
      imageCache.set(src, ref);
      return ref;
    } catch {
      return null;
    }
  };
  const refs = async (list: unknown, preset: ImagePreset) => {
    const out: string[] = [];
    if (Array.isArray(list)) for (const s of list) {
      const r = await toRef(s, preset);
      if (r) out.push(r);
    }
    return out;
  };

  const now = nowIso();
  const raw: Record<string, unknown[]> = {};

  raw.categories = (data.categories || []).map((c, order) => ({ ...c, order, createdAt: now, updatedAt: now }));
  // The old app kept its default categories in code, so items can point at ids that are not in
  // data.categories (e.g. 'work', 'routine'). Recreate those so nothing ends up uncategorized.
  {
    const known = new Set((raw.categories as { id: string }[]).map((c) => c.id));
    const used = new Set([...(data.plannerItems || []), ...(data.checklist || []), ...(data.routines || [])].map((x) => x.category).filter(Boolean) as string[]);
    for (const c of LEGACY_CATEGORIES) {
      if (used.has(c.id) && !known.has(c.id)) raw.categories.push({ ...c, order: 100 + raw.categories.length, createdAt: now, updatedAt: now });
    }
  }

  raw.events = [];
  for (const p of data.plannerItems || []) {
    const startDate = p.startDate || p.date;
    raw.events.push({
      id: p.id,
      title: p.title,
      startDate,
      endDate: p.endDate || startDate,
      startTime: p.startTime,
      endTime: p.startTime ? p.endTime : undefined,
      categoryId: p.category,
      location: p.location,
      memo: p.description,
      photos: await refs(p.images, PHOTO_PRESET),
      done: !!p.isCompleted,
      createdAt: p.createdAt || now,
      updatedAt: now,
    });
  }

  raw.tasks = (data.checklist || []).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.endDate || t.dueDate,
    dueTime: t.dueTime,
    priority: t.priority,
    categoryId: t.category,
    memo: t.memo,
    subtasks: (t.subtasks || []).map((s: LegacyItem) => ({ id: s.id, title: s.title, done: !!s.isCompleted })),
    done: !!t.isCompleted,
    createdAt: t.createdAt || now,
    updatedAt: now,
  }));

  raw.habits = (data.routines || []).map((r, order) => ({
    id: r.id,
    title: r.title,
    icon: r.icon || '🌱',
    days:
      Array.isArray(r.customDays) && r.customDays.length
        ? r.customDays
        : r.frequency === 'weekdays'
          ? [1, 2, 3, 4, 5]
          : r.frequency === 'weekends'
            ? [0, 6]
            : [0, 1, 2, 3, 4, 5, 6],
    categoryId: r.category,
    doneDates: r.completedDates || [],
    order,
    createdAt: now,
    updatedAt: now,
  }));

  raw.stickers = [];
  for (const s of data.userStickers || []) {
    const src = await toRef(s.imageUrl, STICKER_PRESET);
    if (src) raw.stickers.push({ id: s.id, name: s.name, src, createdAt: s.createdAt || now, updatedAt: now });
  }

  raw.diaries = [];
  for (const d of data.diaries || []) {
    const stickers: StickerPlacement[] = [];
    for (const [i, s] of (d.stickers || []).entries()) {
      const isImage = typeof s.imageUrl === 'string' && (s.imageUrl.startsWith('data:') || s.imageUrl.startsWith('http'));
      const value = isImage ? await toRef(s.imageUrl, STICKER_PRESET) : s.imageUrl;
      if (!value) continue;
      stickers.push({
        id: s.id || `stk_${i}`,
        kind: isImage ? 'image' : 'emoji',
        value,
        x: Math.min(92, Math.max(8, Number(s.x) || 50)),
        // The old sticker box was a short, wide canvas; squeeze into the lower part of the new page.
        y: 40 + (Number(s.y) || 50) * 0.4,
        size: (isImage ? 18 : 12) * (Number(s.scale) || 1),
        rotation: Number(s.rotation) || 0,
        z: Number(s.zIndex) || i + 1,
      });
    }
    raw.diaries.push({
      id: d.id,
      date: isValidYmd(d.date) ? d.date : today(),
      title: d.title || '',
      content: d.content || '',
      mood: LEGACY_MOOD[d.emotions?.[0]?.type],
      weather: d.weather,
      paper: 'plain',
      font: 'sans',
      photos: await refs(d.images, PHOTO_PRESET),
      stickers,
      createdAt: d.createdAt || now,
      updatedAt: d.updatedAt || now,
    });
  }

  raw.ledger = [];
  for (const f of data.financials || []) {
    const type = f.type === 'income' ? 'income' : 'expense';
    raw.ledger.push({
      id: f.id,
      date: f.date,
      type,
      amount: Number(f.amount) || 0,
      categoryId: LEGACY_LEDGER_CATEGORY[f.category] || (type === 'income' ? 'lc_etc_in' : 'lc_etc_out'),
      method: f.paymentMethod === 'cash' || f.paymentMethod === 'transfer' ? f.paymentMethod : 'card',
      memo: f.memo,
      receipt: (await toRef(f.receiptImage, RECEIPT_PRESET)) || undefined,
      createdAt: now,
      updatedAt: now,
    });
  }

  const records: RecordsByCollection = {};
  for (const c of COLLECTIONS) {
    if (raw[c]?.length) (records as Record<string, unknown>)[c] = normalizeList(c, raw[c]);
  }
  return { records, assets };
}
