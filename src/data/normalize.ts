import type {
  Category,
  CollectionMap,
  CollectionName,
  DiaryEntry,
  Habit,
  LedgerCategory,
  LedgerEntry,
  PlannerEvent,
  Prefs,
  StickerAsset,
  StickerPlacement,
  Task,
} from '../types';
import { isValidHm, isValidYmd, today } from '../lib/date';
import { MOODS, PAPERS, DIARY_FONTS, WEATHERS } from './defaults';

// Every record read from storage or a backup file goes through these functions,
// so a malformed or older-format record can never crash a screen.

type Raw = Record<string, unknown>;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const optStr = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const bool = (v: unknown): boolean => v === true;
const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const date = (v: unknown, fallback = today()): string => (isValidYmd(v) ? v : fallback);
const optDate = (v: unknown): string | undefined => (isValidYmd(v) ? v : undefined);
const optTime = (v: unknown): string | undefined => (isValidHm(v) ? v : undefined);

function base(r: Raw) {
  const now = new Date().toISOString();
  return {
    id: str(r.id),
    createdAt: str(r.createdAt, now),
    updatedAt: str(r.updatedAt, str(r.createdAt, now)),
  };
}

const normalizers: { [K in CollectionName]: (r: Raw) => CollectionMap[K] } = {
  categories: (r): Category => ({ ...base(r), name: str(r.name, '이름 없음'), color: str(r.color, '#8A8378'), order: num(r.order) }),

  events: (r): PlannerEvent => {
    const startDate = date(r.startDate);
    const endDate = date(r.endDate, startDate);
    return {
      ...base(r),
      title: str(r.title, '제목 없음'),
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      startTime: optTime(r.startTime),
      endTime: optTime(r.endTime),
      categoryId: str(r.categoryId, 'cat_etc'),
      location: optStr(r.location),
      memo: optStr(r.memo),
      photos: strArr(r.photos),
      done: bool(r.done),
    };
  },

  tasks: (r): Task => ({
    ...base(r),
    title: str(r.title, '제목 없음'),
    dueDate: optDate(r.dueDate),
    dueTime: optTime(r.dueTime),
    priority: r.priority === 'high' || r.priority === 'low' ? r.priority : 'medium',
    categoryId: optStr(r.categoryId),
    memo: optStr(r.memo),
    subtasks: Array.isArray(r.subtasks)
      ? (r.subtasks as Raw[]).filter((s) => s && typeof s === 'object').map((s) => ({ id: str(s.id) || Math.random().toString(36).slice(2), title: str(s.title), done: bool(s.done) }))
      : [],
    done: bool(r.done),
    doneAt: optStr(r.doneAt),
  }),

  habits: (r): Habit => {
    const days = Array.isArray(r.days) ? (r.days as unknown[]).filter((d): d is number => typeof d === 'number' && d >= 0 && d <= 6) : [];
    return {
      ...base(r),
      title: str(r.title, '습관'),
      icon: str(r.icon, '🌱'),
      days: days.length ? Array.from(new Set(days)).sort() : [0, 1, 2, 3, 4, 5, 6],
      categoryId: optStr(r.categoryId),
      doneDates: Array.from(new Set(strArr(r.doneDates).filter(isValidYmd))).sort(),
      order: num(r.order),
    };
  },

  diaries: (r): DiaryEntry => ({
    ...base(r),
    date: date(r.date),
    title: str(r.title),
    content: str(r.content),
    mood: MOODS.some((m) => m.id === r.mood) ? (r.mood as DiaryEntry['mood']) : undefined,
    weather: WEATHERS.some((w) => w.id === r.weather) ? (r.weather as DiaryEntry['weather']) : undefined,
    paper: PAPERS.some((p) => p.id === r.paper) ? (r.paper as DiaryEntry['paper']) : 'plain',
    font: DIARY_FONTS.some((f) => f.id === r.font) ? (r.font as DiaryEntry['font']) : 'sans',
    photos: strArr(r.photos),
    stickers: Array.isArray(r.stickers)
      ? (r.stickers as Raw[])
          .filter((s) => s && typeof s === 'object' && typeof s.value === 'string')
          .map(
            (s, i): StickerPlacement => ({
              id: str(s.id) || `stk_${i}`,
              kind: s.kind === 'image' ? 'image' : 'emoji',
              value: str(s.value),
              x: num(s.x, 50),
              y: num(s.y, 30),
              size: num(s.size, 18),
              rotation: num(s.rotation),
              z: num(s.z, i + 1),
            }),
          )
      : [],
  }),

  stickers: (r): StickerAsset => ({ ...base(r), name: str(r.name, '스티커'), src: str(r.src) }),

  ledger: (r): LedgerEntry => ({
    ...base(r),
    date: date(r.date),
    type: r.type === 'income' ? 'income' : 'expense',
    amount: Math.abs(num(r.amount)),
    categoryId: str(r.categoryId, r.type === 'income' ? 'lc_etc_in' : 'lc_etc_out'),
    method: r.method === 'cash' || r.method === 'transfer' || r.method === 'etc' ? r.method : 'card',
    memo: optStr(r.memo),
    receipt: optStr(r.receipt),
  }),

  ledgerCategories: (r): LedgerCategory => ({
    ...base(r),
    name: str(r.name, '기타'),
    type: r.type === 'income' ? 'income' : 'expense',
    emoji: str(r.emoji, '💸'),
    color: str(r.color, '#8A8378'),
    order: num(r.order),
  }),

  prefs: (r): Prefs => ({
    ...base(r),
    id: 'main',
    monthlyBudget: typeof r.monthlyBudget === 'number' && r.monthlyBudget > 0 ? r.monthlyBudget : undefined,
    weekStartsOn: r.weekStartsOn === 1 ? 1 : 0,
  }),
};

export function normalizeRecord<K extends CollectionName>(col: K, raw: unknown): CollectionMap[K] | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  if (typeof r.id !== 'string' || !r.id) return null;
  try {
    return normalizers[col](r);
  } catch {
    return null;
  }
}

export function normalizeList<K extends CollectionName>(col: K, raw: unknown[]): CollectionMap[K][] {
  const out: CollectionMap[K][] = [];
  for (const r of raw) {
    const n = normalizeRecord(col, r);
    if (n) out.push(n);
  }
  return out;
}
