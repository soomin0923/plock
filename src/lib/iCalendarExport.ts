import { PlannerItem, ChecklistItem, CustomCategory } from '../types';

/**
 * Escape text according to RFC 5545 iCalendar specification
 */
function escapeICalText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

/**
 * Format Date to UTC timestamp YYYYMMDDTHHMMSSZ
 */
function formatICalTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const min = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${y}${m}${day}T${h}${min}${s}Z`;
}

/**
 * Format YYYY-MM-DD to YYYYMMDD
 */
function formatICalDateOnly(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

/**
 * Format YYYY-MM-DD + HH:mm to YYYYMMDDTHHMMSS
 */
function formatICalDateTime(dateStr: string, timeStr: string = '09:00'): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const [h, m] = timeStr.split(':').map((s) => s.padStart(2, '0'));
  return `${cleanDate}T${h || '09'}${m || '00'}00`;
}

/**
 * Add 1 day to YYYY-MM-DD string (for exclusive all-day event end dates in iCal standard)
 */
function getNextDayStr(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return dateStr;
  }
}

/**
 * Add 1 hour to HH:mm string
 */
function addOneHour(timeStr: string = '10:00'): string {
  const [h, m] = timeStr.split(':').map(Number);
  const nextHour = (h + 1) % 24;
  return `${String(nextHour).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

export interface ICalExportOptions {
  calendarName?: string;
  categories?: CustomCategory[];
  includeChecklists?: boolean;
  filterDateRange?: {
    startDate?: string;
    endDate?: string;
  };
}

/**
 * Generate RFC 5545 compliant iCalendar string (.ics)
 */
export function generateICalendarString(
  plannerItems: PlannerItem[],
  checklistItems: ChecklistItem[] = [],
  options: ICalExportOptions = {}
): string {
  const calName = options.calendarName || 'Plock Planner';
  const categoriesMap = new Map<string, string>();
  if (options.categories) {
    options.categories.forEach((c) => categoriesMap.set(c.id, c.name));
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plock//Planner & Diary//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(calName)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
  ];

  const nowStamp = formatICalTimestamp();

  // Filter items if date range specified
  let itemsToExport = plannerItems;
  if (options.filterDateRange?.startDate && options.filterDateRange?.endDate) {
    const s = options.filterDateRange.startDate;
    const e = options.filterDateRange.endDate;
    itemsToExport = plannerItems.filter((item) => {
      const itemS = item.startDate || item.date;
      const itemE = item.endDate || item.date;
      return itemS <= e && itemE >= s;
    });
  }

  // 1. Process Planner Items
  itemsToExport.forEach((item) => {
    const uid = `${item.id || Date.now()}@chronicle.app`;
    const startDateStr = item.startDate || item.date;
    const endDateStr = item.endDate || item.date;
    const isMultiDay = startDateStr !== endDateStr;
    const catName = categoriesMap.get(item.category) || item.category || '일정';

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowStamp}`);
    lines.push(`CREATED:${nowStamp}`);

    if (item.startTime) {
      // Timed event
      const dtStart = formatICalDateTime(startDateStr, item.startTime);
      const dtEnd = formatICalDateTime(
        endDateStr,
        item.endTime || addOneHour(item.startTime)
      );
      lines.push(`DTSTART;TZID=Asia/Seoul:${dtStart}`);
      lines.push(`DTEND;TZID=Asia/Seoul:${dtEnd}`);
    } else {
      // All-day event (standard RFC 5545: DTEND is exclusive day)
      const dtStart = formatICalDateOnly(startDateStr);
      const nextDay = getNextDayStr(endDateStr);
      const dtEnd = formatICalDateOnly(nextDay);
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    }

    lines.push(`SUMMARY:${escapeICalText(item.title)}`);

    let desc = item.description || '';
    if (isMultiDay) {
      desc = `[기간: ${startDateStr} ~ ${endDateStr}]\n${desc}`;
    }
    if (desc) {
      lines.push(`DESCRIPTION:${escapeICalText(desc)}`);
    }

    if (item.location) {
      lines.push(`LOCATION:${escapeICalText(item.location)}`);
    }

    lines.push(`CATEGORIES:${escapeICalText(catName)}`);
    lines.push(`STATUS:${item.isCompleted ? 'COMPLETED' : 'CONFIRMED'}`);
    lines.push('END:VEVENT');
  });

  // 2. Process Checklist Items (if requested)
  if (options.includeChecklists && checklistItems.length > 0) {
    checklistItems.forEach((task) => {
      const uid = `task_${task.id || Date.now()}@chronicle.app`;
      const dueDate = task.endDate || task.dueDate;
      const catName = categoriesMap.get(task.category) || task.category || '할 일';

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${nowStamp}`);

      if (task.dueTime) {
        const dtStart = formatICalDateTime(dueDate, task.dueTime);
        const dtEnd = formatICalDateTime(dueDate, addOneHour(task.dueTime));
        lines.push(`DTSTART;TZID=Asia/Seoul:${dtStart}`);
        lines.push(`DTEND;TZID=Asia/Seoul:${dtEnd}`);
      } else {
        const dtStart = formatICalDateOnly(dueDate);
        const dtEnd = formatICalDateOnly(getNextDayStr(dueDate));
        lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
        lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
      }

      lines.push(`SUMMARY:[할 일] ${escapeICalText(task.title)}`);
      if (task.memo) {
        lines.push(`DESCRIPTION:${escapeICalText(task.memo)}`);
      }
      lines.push(`CATEGORIES:${escapeICalText(catName)}`);
      lines.push(`STATUS:${task.isCompleted ? 'COMPLETED' : 'NEEDS-ACTION'}`);
      lines.push(`PRIORITY:${task.priority === 'high' ? '1' : task.priority === 'low' ? '9' : '5'}`);
      lines.push('END:VEVENT');
    });
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Trigger browser download of the generated .ics file
 */
export function downloadICalendarFile(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Google Calendar Import URL for direct navigation
 */
export const GOOGLE_CALENDAR_IMPORT_URL = 'https://calendar.google.com/calendar/r/settings/export';
