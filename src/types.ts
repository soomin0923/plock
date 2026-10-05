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
}

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

// ---- User-designed SQL layer (설정 > 일정 DB).
// The user writes the CREATE TABLE statements and the queries; the app only fills the tables
// with the user's plan data according to the column mapping, and runs the saved queries.

/** Which app data fills a table: plan items (tasks/events), categories, or nothing. */
export type SqlSource = 'items' | 'categories' | 'none';

export interface SqlTableBinding {
  table: string;
  source: SqlSource;
  /** column → source field key ('' = leave NULL / column default) */
  columns: { column: string; field: string }[];
}

export interface SqlSavedQuery {
  id: string;
  name: string;
  sql: string;
}

export interface SqlSetup {
  ddl: string;
  include: 'tasks' | 'events' | 'both';
  bindings: SqlTableBinding[];
  queries: SqlSavedQuery[];
}

// Single settings record per account (id = 'main'), synced like other data.
export interface Prefs extends BaseRecord {
  monthlyBudget?: number;
  weekStartsOn: 0 | 1;
  sql?: SqlSetup;
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
  prefs: Prefs;
}

export type CollectionName = keyof CollectionMap;

export const COLLECTIONS: CollectionName[] = [
  'categories',
  'events',
  'tasks',
  'habits',
  'diaries',
  'stickers',
  'ledger',
  'ledgerCategories',
  'prefs',
];
