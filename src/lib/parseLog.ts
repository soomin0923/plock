import type { LedgerEntry, ParseFields, ParseLog, ParseOutcome, ParseSurface, PlannerEvent, Task, Habit } from '../types';
import type { LedgerDraft, PlanDraft } from './nlParser';
import { newId, nowIso } from './util';
import { today, nowHm } from './date';

// Records every natural-language parse as data (never shown in the app):
//   input → predicted (parser output) → final (what the user actually saved).
// Rows are written through the active storage (IndexedDB for guests, Firestore when signed in)
// via a sink that DataProvider registers. Export with `plock.exportParseLogs()` in the console.

// Bump when parsing behaviour changes, so logs can be split by the parser that produced them.
// 2026.10.2: rule parser reads casual forms (낼, 담주, 화욜, 주말, ranges, spans).
// 2026.10.4: monthly habits (매월 N일 / 말일).
// 2026.10.3: named days (크리스마스, 추석 …), 주말까지 = Sunday; AI service choice + fallback.
export const APP_VERSION = '2026.10.4';

type Sink = (log: ParseLog) => void;
let sink: Sink | null = null;
const open = new Map<string, ParseLog>();

export function setParseLogSink(fn: Sink | null) {
  sink = fn;
}

export function planFields(d: PlanDraft): ParseFields {
  return {
    kind: d.kind,
    title: d.title,
    date: d.kind === 'task' ? d.dueDate : d.startDate,
    endDate: d.kind === 'event' ? d.endDate : undefined,
    startTime: d.kind === 'task' ? d.dueTime : d.startTime,
    endTime: d.kind === 'event' ? d.endTime : undefined,
    categoryId: d.categoryId,
    priority: d.kind === 'task' ? d.priority : undefined,
  };
}

export function recordFields(kind: 'event' | 'task' | 'habit', r: PlannerEvent | Task | Habit): ParseFields {
  if (kind === 'event') {
    const e = r as PlannerEvent;
    return { kind, title: e.title, date: e.startDate, endDate: e.endDate, startTime: e.startTime, endTime: e.endTime, categoryId: e.categoryId };
  }
  if (kind === 'task') {
    const t = r as Task;
    return { kind, title: t.title, date: t.dueDate, startTime: t.dueTime, categoryId: t.categoryId, priority: t.priority };
  }
  const h = r as Habit;
  return { kind, title: h.title, categoryId: h.categoryId };
}

export function ledgerFields(list: (LedgerDraft | LedgerEntry)[]): ParseFields {
  return { kind: 'ledger', entries: list.map((l) => ({ type: l.type, amount: l.amount, categoryId: l.categoryId, date: l.date, memo: l.memo || undefined })) };
}

function strip<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

/** Fields whose predicted value differs from the saved one. */
function diff(a: ParseFields, b: ParseFields): string[] {
  const keys = ['kind', 'title', 'date', 'endDate', 'startTime', 'endTime', 'categoryId', 'priority'] as const;
  const out: string[] = keys.filter((k) => (a[k] ?? null) !== (b[k] ?? null));
  if (a.entries || b.entries) {
    const ea = a.entries || [];
    const eb = b.entries || [];
    if (ea.length !== eb.length) out.push('entries.count');
    for (const k of ['type', 'amount', 'categoryId', 'date', 'memo'] as const) {
      if (ea.some((x, i) => (x[k] ?? null) !== (eb[i]?.[k] ?? null))) out.push(`entries.${k}`);
    }
  }
  return out;
}

export function startParseLog(p: {
  surface: ParseSurface;
  task: 'plan' | 'ledger';
  input: string;
  mode: ParseLog['mode'];
  model?: string;
  latencyMs: number;
  error?: string;
  predicted: ParseFields;
}): string {
  const now = new Date();
  const log: ParseLog = strip({
    id: newId('plog'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...p,
    refDate: today(),
    refTime: nowHm(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul',
    weekday: now.getDay(),
    outcome: 'pending' as ParseOutcome,
    appVersion: APP_VERSION,
  });
  open.set(log.id, log);
  try {
    sink?.(log);
  } catch {
    /* logging must never break input */
  }
  return log.id;
}

export function finishParseLog(id: string | undefined, outcome: Exclude<ParseOutcome, 'pending'>, final?: ParseFields, recordIds?: string[]) {
  if (!id) return;
  const log = open.get(id);
  if (!log) return;
  const next: ParseLog = strip({
    ...log,
    updatedAt: nowIso(),
    outcome,
    final: final ?? log.final,
    changed: final ? diff(log.predicted, final) : log.changed,
    recordIds: recordIds ?? log.recordIds,
  });
  // Keep it around briefly so an "undo" can still update it.
  open.set(id, next);
  try {
    sink?.(next);
  } catch {
    /* ignore */
  }
}
