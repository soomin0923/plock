import type { Database, ParamsObject, SqlJsStatic, SqlValue } from 'sql.js';
import type { Category, PlannerEvent, SqlSetup, SqlSource, SqlTableBinding, Task } from '../types';
import { addDays, endOfMonth, startOfMonth, startOfWeek } from '../lib/date';

// Engine for the user-designed SQL layer (설정 > 일정 DB).
// - Runs entirely in the browser with sql.js (SQLite compiled to WebAssembly): no database server,
//   so nothing to pay for. The WebAssembly file is downloaded once on first use and cached.
// - The CREATE TABLE statements and the queries are written by the user. The app only
//   (1) executes the user's DDL in a fresh in-memory database,
//   (2) inserts the user's plan data into the tables according to the user's column mapping,
//   (3) runs the user's saved SELECT queries.
// The source of truth stays in IndexedDB / Firestore; the SQLite tables are rebuilt from it.

let loading: Promise<SqlJsStatic> | null = null;

export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!loading) {
    loading = (async () => {
      const [{ default: initSqlJs }, { default: wasmUrl }] = await Promise.all([import('sql.js'), import('sql.js/dist/sql-wasm.wasm?url')]);
      return initSqlJs({ locateFile: () => wasmUrl });
    })();
    loading.catch(() => {
      loading = null; // allow retry, e.g. if the first attempt happened offline
    });
  }
  return loading;
}

// ------------------------------------------------------------------ source fields

export interface SourceField {
  key: string;
  label: string;
  example: string;
}

/** Fields of one plan item (a task or an event) that can be stored in a column. */
export const ITEM_FIELDS: SourceField[] = [
  { key: 'id', label: '고유 ID', example: 'task_3f2a…' },
  { key: 'kind', label: '종류', example: "'할 일' / '일정'" },
  { key: 'title', label: '제목', example: "'보고서 제출'" },
  { key: 'due_date', label: '기한 (할 일 마감일 / 일정 시작일)', example: "'2026-10-09'" },
  { key: 'end_date', label: '종료일 (일정 끝나는 날)', example: "'2026-10-11'" },
  { key: 'time', label: '시간', example: "'15:00'" },
  { key: 'category_name', label: '카테고리 이름', example: "'업무'" },
  { key: 'category_id', label: '카테고리 ID', example: "'cat_work'" },
  { key: 'done', label: '완료 여부', example: '0 / 1' },
  { key: 'priority', label: '중요도', example: '1 높음 · 2 보통 · 3 낮음' },
  { key: 'memo', label: '메모', example: "'준비물: …'" },
  { key: 'created_at', label: '만든 시각', example: "'2026-10-05T09:00:00Z'" },
];

/** Fields of one category. */
export const CATEGORY_FIELDS: SourceField[] = [
  { key: 'id', label: '카테고리 ID', example: "'cat_work'" },
  { key: 'name', label: '이름', example: "'업무'" },
  { key: 'color', label: '색', example: "'#3F4A5A'" },
  { key: 'sort_order', label: '표시 순서', example: '0, 1, 2…' },
];

export function fieldsFor(source: SqlSource): SourceField[] {
  return source === 'items' ? ITEM_FIELDS : source === 'categories' ? CATEGORY_FIELDS : [];
}

export interface PlanSource {
  categories: Category[];
  events: PlannerEvent[];
  tasks: Task[];
}

const PRIORITY = { high: 1, medium: 2, low: 3 } as const;

function itemRows(src: PlanSource, include: SqlSetup['include']): Record<string, SqlValue>[] {
  const cats = new Map(src.categories.map((c) => [c.id, c]));
  const catId = (id?: string) => (id && cats.has(id) ? id : null);
  const catName = (id?: string) => (id ? cats.get(id)?.name ?? null : null);
  const rows: Record<string, SqlValue>[] = [];
  if (include !== 'events') {
    for (const t of src.tasks) {
      rows.push({
        id: t.id,
        kind: '할 일',
        title: t.title,
        due_date: t.dueDate ?? null,
        end_date: t.dueDate ?? null,
        time: t.dueDate ? (t.dueTime ?? null) : null,
        category_name: catName(t.categoryId),
        category_id: catId(t.categoryId),
        done: t.done ? 1 : 0,
        priority: PRIORITY[t.priority],
        memo: t.memo ?? null,
        created_at: t.createdAt,
      });
    }
  }
  if (include !== 'tasks') {
    for (const e of src.events) {
      rows.push({
        id: e.id,
        kind: '일정',
        title: e.title,
        due_date: e.startDate,
        end_date: e.endDate,
        time: e.startTime ?? null,
        category_name: catName(e.categoryId),
        category_id: catId(e.categoryId),
        done: e.done ? 1 : 0,
        priority: null,
        memo: e.memo ?? null,
        created_at: e.createdAt,
      });
    }
  }
  return rows;
}

function categoryRows(src: PlanSource): Record<string, SqlValue>[] {
  return src.categories.map((c) => ({ id: c.id, name: c.name, color: c.color, sort_order: c.order }));
}

// ------------------------------------------------------------------ schema inspection

export interface ColumnInfo {
  name: string;
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  hasDefault: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

function rowsOf<T>(db: Database, sql: string, params?: ParamsObject): T[] {
  const stmt = db.prepare(sql);
  try {
    if (params) stmt.bind(params);
    const out: T[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as T);
    return out;
  } finally {
    stmt.free();
  }
}

export function inspectTables(db: Database): TableInfo[] {
  const tables = rowsOf<{ name: string }>(db, "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid");
  return tables.map(({ name }) => ({
    name,
    columns: rowsOf<{ name: string; type: string; notnull: number; pk: number; dflt_value: SqlValue }>(db, `PRAGMA table_info(${quoteIdent(name)})`).map((c) => ({
      name: c.name,
      type: c.type || '(없음)',
      notNull: c.notnull === 1,
      primaryKey: c.pk > 0,
      hasDefault: c.dflt_value !== null,
    })),
  }));
}

export function listIndexes(db: Database): { name: string; table: string; sql: string }[] {
  return rowsOf(db, "SELECT name, tbl_name AS \"table\", sql FROM sqlite_schema WHERE type = 'index' AND sql IS NOT NULL ORDER BY tbl_name, name");
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

// ------------------------------------------------------------------ column mapping helpers

const ITEM_GUESS: [RegExp, string][] = [
  [/^(id|item_?id|schedule_?id|task_?id|plan_?id|아이디|번호)$/i, 'id'],
  [/^(kind|type|종류|구분)$/i, 'kind'],
  [/^(title|name|subject|제목|이름|내용)$/i, 'title'],
  [/^(due|due_?date|deadline|date|start_?date|기한|마감|마감일|날짜|시작일)$/i, 'due_date'],
  [/^(end|end_?date|종료|종료일)$/i, 'end_date'],
  [/^(time|due_?time|start_?time|시간)$/i, 'time'],
  [/^(category_?id|cat_?id)$/i, 'category_id'],
  [/^(category|category_?name|cat|카테고리|분류)$/i, 'category_name'],
  [/^(done|is_?done|completed|is_?completed|status|완료)$/i, 'done'],
  [/^(priority|중요도|우선순위)$/i, 'priority'],
  [/^(memo|note|description|메모|설명)$/i, 'memo'],
  [/^(created_?at|created|생성일)$/i, 'created_at'],
];
const CATEGORY_GUESS: [RegExp, string][] = [
  [/^(id|category_?id|cat_?id)$/i, 'id'],
  [/^(name|category_?name|title|이름)$/i, 'name'],
  [/^(color|colour|색)$/i, 'color'],
  [/^(sort_?order|order|position|순서)$/i, 'sort_order'],
];

function guessSource(t: TableInfo): SqlSource {
  if (/categor|카테고리|분류/i.test(t.name)) return 'categories';
  return 'items';
}

export function guessColumns(t: TableInfo, source: SqlSource): SqlTableBinding['columns'] {
  const rules = source === 'items' ? ITEM_GUESS : source === 'categories' ? CATEGORY_GUESS : [];
  const used = new Set<string>();
  return t.columns.map((c) => {
    const hit = rules.find(([re, field]) => re.test(c.name) && !used.has(field));
    if (hit) used.add(hit[1]);
    return { column: c.name, field: hit ? hit[1] : '' };
  });
}

/** Keep the user's mapping for tables/columns that still exist; guess for new ones. */
export function reconcileBindings(tables: TableInfo[], existing: SqlTableBinding[]): SqlTableBinding[] {
  return tables.map((t) => {
    const prev = existing.find((b) => b.table === t.name);
    const source = prev?.source ?? guessSource(t);
    const guessed = guessColumns(t, source);
    return {
      table: t.name,
      source,
      columns: guessed.map((g) => {
        const kept = prev?.columns.find((c) => c.column === g.column);
        return kept && (kept.field === '' || fieldsFor(source).some((f) => f.key === kept.field)) ? kept : g;
      }),
    };
  });
}

// ------------------------------------------------------------------ build

export interface LoadReport {
  table: string;
  source: SqlSource;
  inserted: number;
  failed: number;
  errors: string[];
}

export interface UserDb {
  db: Database;
  tables: TableInfo[];
  reports: LoadReport[];
}

export class SqlSetupError extends Error {}

/** Execute the user's DDL in a fresh database and load the plan data into the mapped tables. */
export function buildUserDb(SQL: SqlJsStatic, setup: SqlSetup, src: PlanSource): UserDb {
  const db = new SQL.Database();
  try {
    if (!setup.ddl.trim()) throw new SqlSetupError('CREATE TABLE 문을 먼저 작성해 주세요.');
    try {
      db.exec(setup.ddl);
    } catch (e) {
      throw new SqlSetupError(`테이블을 만들지 못했어요: ${(e as Error).message}`);
    }
    const tables = inspectTables(db);
    if (!tables.length) throw new SqlSetupError('만들어진 테이블이 없어요. CREATE TABLE 문을 확인해 주세요.');

    const bindings = reconcileBindings(tables, setup.bindings);
    // Parent tables (categories) first, so foreign keys from item tables can be satisfied.
    const ordered = [...bindings].sort((a, b) => (a.source === 'categories' ? 0 : 1) - (b.source === 'categories' ? 0 : 1));
    const reports: LoadReport[] = [];
    db.exec('BEGIN');
    for (const b of ordered) {
      if (b.source === 'none') continue;
      const mapped = b.columns.filter((c) => c.field);
      const report: LoadReport = { table: b.table, source: b.source, inserted: 0, failed: 0, errors: [] };
      reports.push(report);
      if (!mapped.length) continue;
      const rows = b.source === 'items' ? itemRows(src, setup.include) : categoryRows(src);
      const stmt = db.prepare(
        `INSERT INTO ${quoteIdent(b.table)} (${mapped.map((c) => quoteIdent(c.column)).join(', ')}) VALUES (${mapped.map(() => '?').join(', ')})`,
      );
      for (const row of rows) {
        try {
          stmt.run(mapped.map((c) => row[c.field] ?? null));
          report.inserted++;
        } catch (e) {
          // Constraint violations are part of what the user is designing (NOT NULL, CHECK, UNIQUE…):
          // skip the row and report why, instead of hiding the problem.
          report.failed++;
          const msg = (e as Error).message;
          if (report.errors.length < 3 && !report.errors.includes(msg)) report.errors.push(msg);
        }
      }
      stmt.free();
    }
    db.exec('COMMIT');
    return { db, tables, reports };
  } catch (e) {
    db.close();
    throw e;
  }
}

// ------------------------------------------------------------------ queries

/** Date parameters filled in automatically when a query mentions them. */
export function builtinParams(today: string, weekStartsOn: 0 | 1): Record<string, string> {
  const weekStart = startOfWeek(today, weekStartsOn);
  return {
    ':today': today,
    ':yesterday': addDays(today, -1),
    ':tomorrow': addDays(today, 1),
    ':week_start': weekStart,
    ':week_end': addDays(weekStart, 6),
    ':month_start': startOfMonth(today),
    ':month_end': endOfMonth(today),
  };
}

/** Named parameters (`:name`) used in a query, in order of first appearance. */
export function queryParamNames(sql: string): string[] {
  const withoutStrings = sql.replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const seen: string[] = [];
  for (const m of withoutStrings.matchAll(/(?<![:\w]):([A-Za-z_][A-Za-z0-9_]*)/g)) {
    const name = `:${m[1]}`;
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

export interface QueryResult {
  columns: string[];
  rows: SqlValue[][];
  truncated: boolean;
  ms: number;
}

const READ_ONLY_START = /^\s*(?:--[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*(select|with|explain|values)\b/i;

/**
 * Run one saved query. Only reading statements are accepted, and the statement runs inside a
 * savepoint that is always rolled back, so a query can never change the tables.
 */
export function runUserQuery(db: Database, sql: string, params: ParamsObject, maxRows = 500): QueryResult {
  if (!READ_ONLY_START.test(sql)) throw new Error('조회 쿼리(SELECT 또는 WITH로 시작)만 저장·실행할 수 있어요.');
  const started = performance.now();
  db.exec('SAVEPOINT user_query');
  try {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const columns = stmt.getColumnNames();
      const rows: SqlValue[][] = [];
      let truncated = false;
      while (stmt.step()) {
        if (rows.length >= maxRows) {
          truncated = true;
          break;
        }
        rows.push(stmt.get());
      }
      return { columns, rows, truncated, ms: Math.round((performance.now() - started) * 10) / 10 };
    } finally {
      stmt.free();
    }
  } finally {
    db.exec('ROLLBACK TO user_query; RELEASE user_query;');
  }
}

/** Schema + queries as Markdown, ready to paste into a README. */
export function setupToMarkdown(setup: SqlSetup, indexes: { name: string; sql: string }[] = []): string {
  const parts = ['## 일정 DB 설계 (SQLite)', '', '### 테이블', '', '```sql', setup.ddl.trim(), '```', ''];
  const mapped = setup.bindings.filter((b) => b.source !== 'none');
  if (mapped.length) {
    parts.push('### 데이터 연결', '');
    for (const b of mapped) {
      parts.push(`- \`${b.table}\` ← ${b.source === 'items' ? `일정·할 일 (${setup.include === 'both' ? '둘 다' : setup.include === 'tasks' ? '할 일' : '일정'})` : '카테고리'}`);
      for (const c of b.columns.filter((x) => x.field)) {
        const f = fieldsFor(b.source).find((x) => x.key === c.field);
        parts.push(`  - \`${c.column}\` ← ${f?.label ?? c.field}`);
      }
    }
    parts.push('');
  }
  if (indexes.length) parts.push(`인덱스: ${indexes.map((i) => `\`${i.name}\``).join(', ')}`, '');
  if (setup.queries.length) {
    parts.push('### 조회 쿼리', '');
    for (const q of setup.queries) parts.push(`#### ${q.name}`, '', '```sql', q.sql.trim(), '```', '');
  }
  return parts.join('\n');
}
