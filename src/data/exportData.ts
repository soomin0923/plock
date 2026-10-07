import type { Category, LedgerCategory, LedgerEntry, Note, ParseFields, ParseLog, PlannerEvent, Task } from '../types';

// Research exports (no UI): a MySQL dump of the planning/ledger tables + the parse log.
// Diaries, photos and stickers are never included.
//
//   plock.exportSql()          → plock-YYYYMMDD.sql   (CREATE TABLE + INSERT, MySQL 8 / MariaDB)
//   plock.exportParseLogs()    → plock-parse-logs-YYYYMMDD.csv + .jsonl
//
// Timestamps are written in UTC ("YYYY-MM-DD HH:MM:SS.mmm"). No foreign keys on purpose,
// so integrity problems (orphan references, duplicates) can be found with SQL.

export interface ExportTables {
  categories: Category[];
  events: PlannerEvent[];
  tasks: Task[];
  ledgerCategories: LedgerCategory[];
  ledger: LedgerEntry[];
  notes: Note[];
  parseLogs: ParseLog[];
}

type Cell = string | number | boolean | null | undefined;

function sqlValue(v: Cell): string {
  if (v === null || v === undefined || v === '') return 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '')}'`;
}

function ts(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().replace('T', ' ').replace('Z', '');
}

function table(name: string, ddl: string, columns: string[], rows: Cell[][]): string {
  let out = `DROP TABLE IF EXISTS ${name};\nCREATE TABLE ${name} (\n${ddl}\n) DEFAULT CHARSET=utf8mb4;\n`;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    out += `INSERT INTO ${name} (${columns.join(', ')}) VALUES\n${chunk.map((r) => `(${r.map(sqlValue).join(', ')})`).join(',\n')};\n`;
  }
  return out + '\n';
}

const fieldCols = (prefix: string, f?: ParseFields): Cell[] => [
  f?.kind,
  f?.title,
  f?.date,
  f?.endDate,
  f?.startTime,
  f?.endTime,
  f?.categoryId,
  f?.priority,
  f?.entries ? JSON.stringify(f.entries) : undefined,
];

const PARSE_COLUMNS = [
  'id', 'created_at', 'surface', 'task', 'input', 'ref_date', 'ref_time', 'timezone', 'weekday', 'mode', 'model', 'latency_ms', 'error', 'outcome', 'changed',
  ...['pred', 'final'].flatMap((p) => [`${p}_kind`, `${p}_title`, `${p}_date`, `${p}_end_date`, `${p}_start_time`, `${p}_end_time`, `${p}_category_id`, `${p}_priority`, `${p}_entries`]),
  'record_ids', 'app_version',
];

function parseRow(l: ParseLog): Cell[] {
  return [
    l.id, ts(l.createdAt), l.surface, l.task, l.input, l.refDate, l.refTime, l.timezone, l.weekday, l.mode, l.model, l.latencyMs, l.error, l.outcome,
    l.changed?.join(','),
    ...fieldCols('pred', l.predicted),
    ...fieldCols('final', l.final),
    l.recordIds?.join(','),
    l.appVersion,
  ];
}

export function buildSqlDump(t: ExportTables, exportedAt = new Date()): string {
  const fields = (p: string) =>
    `  ${p}_kind VARCHAR(16) NULL,\n  ${p}_title VARCHAR(500) NULL,\n  ${p}_date DATE NULL,\n  ${p}_end_date DATE NULL,\n  ${p}_start_time TIME NULL,\n  ${p}_end_time TIME NULL,\n  ${p}_category_id VARCHAR(64) NULL,\n  ${p}_priority VARCHAR(8) NULL,\n  ${p}_entries JSON NULL`;
  return [
    `-- Plock export ${exportedAt.toISOString()} (timestamps in UTC)\n-- Tables: categories, events, tasks, ledger_categories, ledger, notes, parse_logs\nSET NAMES utf8mb4;\n\n`,
    table(
      'categories',
      '  id VARCHAR(64) PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  color CHAR(7),\n  sort_order INT',
      ['id', 'name', 'color', 'sort_order'],
      t.categories.map((c) => [c.id, c.name, c.color, c.order]),
    ),
    table(
      'events',
      '  id VARCHAR(64) PRIMARY KEY,\n  title VARCHAR(500) NOT NULL,\n  start_date DATE NOT NULL,\n  end_date DATE NOT NULL,\n  start_time TIME NULL,\n  end_time TIME NULL,\n  category_id VARCHAR(64),\n  location VARCHAR(500),\n  memo TEXT,\n  done TINYINT(1) NOT NULL DEFAULT 0,\n  created_at DATETIME(3),\n  updated_at DATETIME(3),\n  INDEX idx_events_start (start_date),\n  INDEX idx_events_category (category_id)',
      ['id', 'title', 'start_date', 'end_date', 'start_time', 'end_time', 'category_id', 'location', 'memo', 'done', 'created_at', 'updated_at'],
      t.events.map((e) => [e.id, e.title, e.startDate, e.endDate, e.startTime, e.endTime, e.categoryId, e.location, e.memo, !!e.done, ts(e.createdAt), ts(e.updatedAt)]),
    ),
    table(
      'tasks',
      '  id VARCHAR(64) PRIMARY KEY,\n  title VARCHAR(500) NOT NULL,\n  due_date DATE NULL,\n  due_time TIME NULL,\n  priority VARCHAR(8),\n  category_id VARCHAR(64) NULL,\n  memo TEXT,\n  done TINYINT(1) NOT NULL DEFAULT 0,\n  done_at DATETIME(3) NULL,\n  created_at DATETIME(3),\n  updated_at DATETIME(3),\n  INDEX idx_tasks_due (due_date)',
      ['id', 'title', 'due_date', 'due_time', 'priority', 'category_id', 'memo', 'done', 'done_at', 'created_at', 'updated_at'],
      t.tasks.map((x) => [x.id, x.title, x.dueDate, x.dueTime, x.priority, x.categoryId, x.memo, x.done, ts(x.doneAt), ts(x.createdAt), ts(x.updatedAt)]),
    ),
    table(
      'ledger_categories',
      '  id VARCHAR(64) PRIMARY KEY,\n  name VARCHAR(100) NOT NULL,\n  type VARCHAR(8) NOT NULL,\n  emoji VARCHAR(16),\n  color CHAR(7),\n  sort_order INT',
      ['id', 'name', 'type', 'emoji', 'color', 'sort_order'],
      t.ledgerCategories.map((c) => [c.id, c.name, c.type, c.emoji, c.color, c.order]),
    ),
    table(
      'ledger',
      '  id VARCHAR(64) PRIMARY KEY,\n  entry_date DATE NOT NULL,\n  type VARCHAR(8) NOT NULL,\n  amount INT NOT NULL,\n  category_id VARCHAR(64),\n  method VARCHAR(16),\n  memo VARCHAR(500),\n  created_at DATETIME(3),\n  INDEX idx_ledger_date (entry_date)',
      ['id', 'entry_date', 'type', 'amount', 'category_id', 'method', 'memo', 'created_at'],
      t.ledger.map((l) => [l.id, l.date, l.type, l.amount, l.categoryId, l.method, l.memo, ts(l.createdAt)]),
    ),
    table(
      'notes',
      '  id VARCHAR(64) PRIMARY KEY,\n  text VARCHAR(1000) NOT NULL,\n  memo TEXT,\n  link VARCHAR(1000),\n  category_id VARCHAR(64),\n  due_date DATE NULL,\n  starred TINYINT(1) NOT NULL DEFAULT 0,\n  done TINYINT(1) NOT NULL DEFAULT 0,\n  photo_count INT NOT NULL DEFAULT 0,\n  created_at DATETIME(3)',
      ['id', 'text', 'memo', 'link', 'category_id', 'due_date', 'starred', 'done', 'photo_count', 'created_at'],
      t.notes.map((n) => [n.id, n.text, n.memo, n.link, n.categoryId, n.dueDate, n.starred, n.done, n.photos.length, ts(n.createdAt)]),
    ),
    table(
      'parse_logs',
      `  id VARCHAR(64) PRIMARY KEY,\n  created_at DATETIME(3),\n  surface VARCHAR(16),\n  task VARCHAR(8),\n  input TEXT NOT NULL,\n  ref_date DATE,\n  ref_time TIME,\n  timezone VARCHAR(64),\n  weekday TINYINT,\n  mode VARCHAR(16),\n  model VARCHAR(64),\n  latency_ms INT,\n  error TEXT,\n  outcome VARCHAR(10),\n  changed VARCHAR(255),\n${fields('pred')},\n${fields('final')},\n  record_ids VARCHAR(500),\n  app_version VARCHAR(16),\n  INDEX idx_parse_outcome (outcome)`,
      PARSE_COLUMNS,
      t.parseLogs.map(parseRow),
    ),
  ].join('');
}

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV (UTF-8 with BOM so Excel opens Korean correctly). */
export function buildParseLogCsv(logs: ParseLog[]): string {
  const lines = [PARSE_COLUMNS.join(','), ...logs.map((l) => parseRow(l).map(csvCell).join(','))];
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function buildParseLogJsonl(logs: ParseLog[]): string {
  return logs.map((l) => JSON.stringify(l)).join('\n') + (logs.length ? '\n' : '');
}
