// Plock data model.
// Every stored record has a string `id` plus created/updated timestamps (ISO strings).
// Images are referenced as `asset:<id>` and stored separately (see data/repo.ts) so that
// records stay small regardless of how many photos a diary page holds.

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category extends BaseRecord {
  name: string;
  color: string;
  order: number;
}

export interface PlannerEvent extends BaseRecord {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive; same as startDate for single-day)
  startTime?: string; // HH:mm — absent means all-day
  endTime?: string; // HH:mm
  categoryId: string;
  location?: string;
  memo?: string;
  photos?: string[]; // asset refs
  done?: boolean;
}

export type Priority = 'high' | 'medium' | 'low';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task extends BaseRecord {
  title: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  priority: Priority;
  categoryId?: string;
  memo?: string;
  subtasks?: Subtask[];
  done: boolean;
  doneAt?: string;
}

export interface Habit extends BaseRecord {
  title: string;
  icon: string; // emoji
  days: number[]; // 0 = Sun ... 6 = Sat
  /** Monthly habit: days of the month (1–31; -1 = the last day). When set, `days` is ignored. */
  monthDays?: number[];
  categoryId?: string;
  doneDates: string[]; // YYYY-MM-DD
  order: number;
}

export type Mood = 'joy' | 'calm' | 'excited' | 'love' | 'tired' | 'sad' | 'angry' | 'anxious';
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy';
export type PaperStyle = 'plain' | 'lined' | 'grid' | 'dot' | 'cream' | 'pink' | 'mint' | 'sky';
export type DiaryFont = 'sans' | 'pen' | 'gaegu' | 'serif';

// Sticker placed freely on a diary page.
// Coordinates are expressed in "page width" units (0–100 = full page width), for both x and y,
// so a page looks identical on a phone and a desktop: the page scales, the layout doesn't move.
export interface StickerPlacement {
  id: string;
  kind: 'emoji' | 'image';
  value: string; // emoji character or image ref (asset:<id> / data: / https:)
  x: number; // center, page-width units
  y: number; // center, page-width units
  size: number; // width in page-width units
  rotation: number; // degrees
  z: number;
  /** Look applied when placed (CSS), works for emoji and images alike. */
  effect?: PlacementFx;
}

export type PlacementFx = 'mono' | 'sepia' | 'pop' | 'outline' | '3d' | 'neon';

export interface DiaryEntry extends BaseRecord {
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  mood?: Mood;
  weather?: Weather;
  paper: PaperStyle;
  font: DiaryFont;
  photos: string[]; // asset refs, rendered in flow below the text
  stickers: StickerPlacement[];
  /** Optional structured 감정 일기 form filled in alongside the free page. */
  journal?: MoodJournal;
}

export type SleepFace = 'good' | 'ok' | 'bad';

/** 감정 일기 양식: scales are 1–5 (기분) and 1–10 (마음 컨디션); all fields optional. */
export interface MoodJournal {
  sleepStart?: string; // HH:mm (잠든 시간)
  sleepEnd?: string; // HH:mm (일어난 시간)
  sleepFace?: SleepFace;
  joy?: number;
  calm?: number;
  anxiety?: number;
  gloom?: number;
  goodReason?: string;
  badReason?: string;
  song?: string;
  place?: string;
  food?: string;
  healing?: string;
  comfort?: string;
  thanksTo?: string;
  wish?: string;
  gratitude: string[]; // up to 5
  praise: string[]; // up to 5
  regret?: string;
  tomorrow?: string;
  condition?: number; // 1–10
}

export interface StickerAsset extends BaseRecord {
  name: string;
  src: string; // asset ref
}

export type LedgerType = 'expense' | 'income';
export type PayMethod = 'card' | 'cash' | 'transfer' | 'etc';

export interface LedgerEntry extends BaseRecord {
  date: string; // YYYY-MM-DD
  type: LedgerType;
  amount: number; // KRW, positive
  categoryId: string;
  method: PayMethod;
  memo?: string;
  receipt?: string; // asset ref
}

export interface LedgerCategory extends BaseRecord {
  name: string;
  type: LedgerType;
  emoji: string;
  color: string;
  order: number;
}

// 쏟아내기: quick capture. One line first; memo, photos, link, category and deadline are optional.
export interface Note extends BaseRecord {
  text: string;
  memo?: string;
  photos: string[]; // asset refs
  link?: string;
  categoryId?: string;
  dueDate?: string; // YYYY-MM-DD
  starred: boolean;
  done: boolean;
}

/** A YouTube / YouTube Music link on the LP player. */
export interface MusicTrack {
  id: string;
  title: string;
  videoId?: string;
  listId?: string;
}

// Single settings record per account (id = 'main'), synced like other data.
export interface Prefs extends BaseRecord {
  monthlyBudget?: number;
  weekStartsOn: 0 | 1;
  music?: MusicTrack[];
  /** Stickers on the 오늘 page; PC and phone layouts differ, so each has its own set. */
  homeStickers?: { wide: StickerPlacement[]; narrow: StickerPlacement[] };
  /** 오늘 page widgets, in display order. Absent = default layout. */
  todayWidgets?: TodayWidget[];
}

export interface TodayWidget {
  id: string;
  /** Spans both columns on wide screens. */
  wide?: boolean;
}

// ---- Parser evaluation log (write-only; never shown in the app, exported from the console)
// One row per natural-language input: what was typed, what the parser predicted, and what the
// user finally saved. `final` is the ground truth label; `changed` lists the fields the user fixed.

export type ParseSurface = 'today' | 'planner' | 'dump_chip' | 'dump_convert' | 'ledger';
export type ParseOutcome = 'pending' | 'saved' | 'cancelled' | 'undone';

export interface ParseFields {
  kind?: string;
  title?: string;
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  categoryId?: string;
  priority?: string;
  /** Ledger only: one entry per amount found. */
  entries?: { type: string; amount: number; categoryId: string; date: string; memo?: string }[];
}

export interface ParseLog extends BaseRecord {
  surface: ParseSurface;
  task: 'plan' | 'ledger';
  input: string;
  refDate: string; // the day the input was typed (relative dates resolve against it)
  refTime: string; // HH:mm
  timezone: string;
  weekday: number; // 0 = Sun
  mode: 'ai' | 'local' | 'local_fallback';
  model?: string;
  latencyMs: number;
  error?: string;
  predicted: ParseFields;
  outcome: ParseOutcome;
  final?: ParseFields;
  changed?: string[];
  recordIds?: string[];
  appVersion: string;
}

export interface CollectionMap {
  categories: Category;
  events: PlannerEvent;
  tasks: Task;
  habits: Habit;
  diaries: DiaryEntry;
  stickers: StickerAsset;
  ledger: LedgerEntry;
  ledgerCategories: LedgerCategory;
  notes: Note;
  prefs: Prefs;
  parseLogs: ParseLog;
}

export type CollectionName = keyof CollectionMap;

/** Collections loaded into the app. `parseLogs` is deliberately not here: it is write-only. */
export const COLLECTIONS: CollectionName[] = [
  'categories',
  'events',
  'tasks',
  'habits',
  'diaries',
  'stickers',
  'ledger',
  'ledgerCategories',
  'notes',
  'prefs',
];
