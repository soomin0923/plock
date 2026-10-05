// Date helpers that work on local-time YYYY-MM-DD strings.
// Never use `new Date('YYYY-MM-DD')` directly: it parses as UTC and shifts the day in some timezones.

export const WEEKDAYS_KR = ['일', '월', '화', '수', '목', '금', '토'];

const pad = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): string {
  return ymd(new Date());
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function addMonths(s: string, n: number): string {
  const d = parseYmd(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return ymd(d);
}

export function weekday(s: string): number {
  return parseYmd(s).getDay();
}

export function monthKey(s: string): string {
  return s.slice(0, 7);
}

export function startOfMonth(s: string): string {
  return `${s.slice(0, 7)}-01`;
}

export function endOfMonth(s: string): string {
  const d = parseYmd(startOfMonth(s));
  return ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function startOfWeek(s: string, weekStartsOn: 0 | 1 = 0): string {
  const wd = weekday(s);
  const diff = (wd - weekStartsOn + 7) % 7;
  return addDays(s, -diff);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / 86400000);
}

/** 6x7 (or 5x7) grid of dates covering the month of `s`. */
export function monthGrid(s: string, weekStartsOn: 0 | 1 = 0): string[] {
  const first = startOfMonth(s);
  const last = endOfMonth(s);
  const start = startOfWeek(first, weekStartsOn);
  const weeks = Math.ceil((diffDays(start, last) + 1) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

export function weekDates(s: string, weekStartsOn: 0 | 1 = 0): string[] {
  const start = startOfWeek(s, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function orderedWeekdays(weekStartsOn: 0 | 1 = 0): number[] {
  return Array.from({ length: 7 }, (_, i) => (i + weekStartsOn) % 7);
}

export function formatKoreanDate(s: string, opts: { year?: boolean; weekday?: boolean } = {}): string {
  const d = parseYmd(s);
  const parts: string[] = [];
  if (opts.year) parts.push(`${d.getFullYear()}년`);
  parts.push(`${d.getMonth() + 1}월 ${d.getDate()}일`);
  let out = parts.join(' ');
  if (opts.weekday !== false) out += ` (${WEEKDAYS_KR[d.getDay()]})`;
  return out;
}

export function formatMonth(s: string): string {
  const d = parseYmd(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

export function relativeDayLabel(s: string, base: string = today()): string | null {
  const diff = diffDays(base, s);
  if (diff === 0) return '오늘';
  if (diff === 1) return '내일';
  if (diff === 2) return '모레';
  if (diff === -1) return '어제';
  return null;
}

export function nowHm(): string {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function addMinutesHm(hm: string, minutes: number): string {
  const total = Math.min(23 * 60 + 59, Math.max(0, hmToMinutes(hm) + minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

export function formatTime(hm?: string): string {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${ampm} ${h12}:${pad(m)}` : `${ampm} ${h12}시`;
}

export function isValidYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isValidHm(s: unknown): s is string {
  return typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);
}
