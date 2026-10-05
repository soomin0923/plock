import type { Category, PlannerEvent, Task } from '../types';
import { addDays, ymd } from './date';

// iCalendar (.ics, RFC 5545) import/export — works with Google Calendar, Apple Calendar, Outlook.

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unesc = (t: string) => t.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
const compactDate = (d: string) => d.replace(/-/g, '');
const compactDateTime = (d: string, hm: string) => `${compactDate(d)}T${hm.replace(':', '')}00`;

function stamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Fold lines longer than 75 octets, as the spec requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    if (curLen + len > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function exportIcs(events: PlannerEvent[], tasks: Task[], cats: Category[], name = 'Plock'): string {
  const catName = (id?: string) => cats.find((c) => c.id === id)?.name || '';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Plock//Planner//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Asia/Seoul'];
  const now = stamp();
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@plock`, `DTSTAMP:${now}`);
    if (e.startTime) {
      lines.push(`DTSTART;TZID=Asia/Seoul:${compactDateTime(e.startDate, e.startTime)}`);
      lines.push(`DTEND;TZID=Asia/Seoul:${compactDateTime(e.endDate, e.endTime || e.startTime)}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(e.startDate)}`, `DTEND;VALUE=DATE:${compactDate(addDays(e.endDate, 1))}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.memo) lines.push(`DESCRIPTION:${esc(e.memo)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (catName(e.categoryId)) lines.push(`CATEGORIES:${esc(catName(e.categoryId))}`);
    lines.push('END:VEVENT');
  }
  for (const t of tasks) {
    if (!t.dueDate) continue;
    lines.push('BEGIN:VTODO', `UID:${t.id}@plock`, `DTSTAMP:${now}`);
    lines.push(t.dueTime ? `DUE;TZID=Asia/Seoul:${compactDateTime(t.dueDate, t.dueTime)}` : `DUE;VALUE=DATE:${compactDate(t.dueDate)}`);
    lines.push(`SUMMARY:${esc(t.title)}`, `STATUS:${t.done ? 'COMPLETED' : 'NEEDS-ACTION'}`, `PRIORITY:${t.priority === 'high' ? 1 : t.priority === 'low' ? 9 : 5}`);
    if (t.memo) lines.push(`DESCRIPTION:${esc(t.memo)}`);
    lines.push('END:VTODO');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n');
}

export interface IcsItem {
  uid: string;
  kind: 'event' | 'task';
  title: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  memo?: string;
  category?: string;
  done?: boolean;
}

function parseDateValue(value: string, params: string): { date: string; time?: string } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  if (!m[4] || /VALUE=DATE(?!-)/.test(params)) return { date: `${m[1]}-${m[2]}-${m[3]}` };
  if (m[7]) {
    // UTC → local time (Google Calendar exports UTC timestamps).
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
    return { date: ymd(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
  }
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: `${m[4]}:${m[5]}` };
}

export function parseIcs(text: string): IcsItem[] {
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error('.ics 캘린더 파일이 아닙니다.');
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out: IcsItem[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  let kind: 'event' | 'task' = 'event';
  for (const line of lines) {
    if (/^BEGIN:(VEVENT|VTODO)/i.test(line)) {
      cur = {};
      kind = /VTODO/i.test(line) ? 'task' : 'event';
      continue;
    }
    if (/^END:(VEVENT|VTODO)/i.test(line) && cur) {
      const start = cur.DTSTART ? parseDateValue(cur.DTSTART.value, cur.DTSTART.params) : cur.DUE ? parseDateValue(cur.DUE.value, cur.DUE.params) : null;
      const title = cur.SUMMARY ? unesc(cur.SUMMARY.value) : '';
      if (start && title && !/^CANCELLED$/i.test(cur.STATUS?.value || '')) {
        let end = cur.DTEND ? parseDateValue(cur.DTEND.value, cur.DTEND.params) : null;
        let endDate = end?.date || start.date;
        // All-day DTEND is exclusive.
        if (!start.time && end && !end.time && endDate > start.date) endDate = addDays(endDate, -1);
        if (endDate < start.date) endDate = start.date;
        out.push({
          uid: cur.UID?.value || `${title}-${start.date}`,
          kind,
          title,
          startDate: start.date,
          endDate: kind === 'task' ? start.date : endDate,
          startTime: start.time,
          endTime: end?.time,
          location: cur.LOCATION ? unesc(cur.LOCATION.value) : undefined,
          memo: cur.DESCRIPTION ? unesc(cur.DESCRIPTION.value) : undefined,
          category: cur.CATEGORIES ? unesc(cur.CATEGORIES.value).split(',')[0] : undefined,
          done: /COMPLETED/i.test(cur.STATUS?.value || ''),
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const [name, ...params] = head.split(';');
    cur[name.toUpperCase()] = { value: line.slice(idx + 1), params: params.join(';').toUpperCase() };
  }
  return out;
}
