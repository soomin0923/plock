import type {
  Category,
  CollectionMap,
  CollectionName,
  DiaryEntry,
  Habit,
  LedgerCategory,
  LedgerEntry,
  MoodJournal,
  ParseLog,
  MusicTrack,
  Note,
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
    const monthDays = Array.isArray(r.monthDays)
      ? Array.from(new Set((r.monthDays as unknown[]).filter((d): d is number => Number.isInteger(d) && ((d as number) === -1 || ((d as number) >= 1 && (d as number) <= 31))))).sort((a, b) => a - b)
      : [];
    return {
      ...base(r),
      title: str(r.title, '습관'),
      icon: str(r.icon, '🌱'),
      days: days.length ? Array.from(new Set(days)).sort() : [0, 1, 2, 3, 4, 5, 6],
      ...(monthDays.length ? { monthDays } : {}),
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
    stickers: normalizeStickers(r.stickers),
    journal: normalizeJournal(r.journal),
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

  notes: (r): Note => ({
    ...base(r),
    text: str(r.text),
    memo: optStr(r.memo),
    photos: strArr(r.photos),
    link: optStr(r.link),
    categoryId: optStr(r.categoryId),
    dueDate: optDate(r.dueDate),
    starred: bool(r.starred),
    done: bool(r.done),
  }),

  parseLogs: (r): ParseLog => ({ ...(r as unknown as ParseLog), ...base(r) }),

  prefs: (r): Prefs => ({
    ...base(r),
    id: 'main',
    monthlyBudget: typeof r.monthlyBudget === 'number' && r.monthlyBudget > 0 ? r.monthlyBudget : undefined,
    weekStartsOn: r.weekStartsOn === 1 ? 1 : 0,
    music: normalizeMusic(r.music),
    homeStickers:
      r.homeStickers && typeof r.homeStickers === 'object'
        ? { wide: normalizeStickers((r.homeStickers as Raw).wide), narrow: normalizeStickers((r.homeStickers as Raw).narrow) }
        : undefined,
    todayWidgets: Array.isArray(r.todayWidgets)
      ? (r.todayWidgets as Raw[]).filter((w) => w && typeof w.id === 'string').map((w) => ({ id: w.id as string, wide: w.wide === true || undefined }))
      : undefined,
  }),
};

function normalizeStickers(v: unknown): StickerPlacement[] {
  if (!Array.isArray(v)) return [];
  return (v as Raw[])
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
        effect: normalizeFx(s.effect),
      }),
    );
}

const PLACEMENT_FX = ['mono', 'sepia', 'pop', 'outline', '3d', 'neon'];
export function normalizeFx(v: unknown): StickerPlacement['effect'] {
  return typeof v === 'string' && PLACEMENT_FX.includes(v) ? (v as StickerPlacement['effect']) : undefined;
}

function normalizeJournal(v: unknown): MoodJournal | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Raw;
  const scale = (x: unknown, max: number) => (typeof x === 'number' && Number.isInteger(x) && x >= 1 && x <= max ? x : undefined);
  const list = (x: unknown) => Array.from({ length: 5 }, (_, i) => (Array.isArray(x) && typeof x[i] === 'string' ? (x[i] as string) : ''));
  return {
    sleepStart: optTime(r.sleepStart),
    sleepEnd: optTime(r.sleepEnd),
    sleepFace: r.sleepFace === 'good' || r.sleepFace === 'ok' || r.sleepFace === 'bad' ? r.sleepFace : undefined,
    joy: scale(r.joy, 5),
    calm: scale(r.calm, 5),
    anxiety: scale(r.anxiety, 5),
    gloom: scale(r.gloom, 5),
    goodReason: optStr(r.goodReason),
    badReason: optStr(r.badReason),
    song: optStr(r.song),
    place: optStr(r.place),
    food: optStr(r.food),
    healing: optStr(r.healing),
    comfort: optStr(r.comfort),
    thanksTo: optStr(r.thanksTo),
    wish: optStr(r.wish),
    gratitude: list(r.gratitude),
    praise: list(r.praise),
    regret: optStr(r.regret),
    tomorrow: optStr(r.tomorrow),
    condition: scale(r.condition, 10),
  };
}

function normalizeMusic(v: unknown): MusicTrack[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const list = (v as Raw[])
    .filter((t) => t && typeof t === 'object' && (typeof t.videoId === 'string' || typeof t.listId === 'string'))
    .map((t) => ({ id: str(t.id) || Math.random().toString(36).slice(2), title: str(t.title), videoId: optStr(t.videoId), listId: optStr(t.listId) }));
  return list.length ? list : undefined;
}

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
