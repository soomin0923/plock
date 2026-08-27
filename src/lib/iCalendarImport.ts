import { PlannerItem, ChecklistItem, CustomCategory } from '../types';

export interface ParsedICalEvent {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  isAllDay: boolean;
  description?: string;
  location?: string;
  category?: string;
  isChecklist?: boolean;
  selected?: boolean;
}

/**
 * Unescape text according to RFC 5545 specification
 */
function unescapeICalText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

/**
 * Parse an iCal date string (e.g. 20260826 or 20260826T093000Z or 20260826T093000)
 */
function parseICalDateTime(rawVal: string): { date: string; time?: string; isAllDay: boolean } {
  const clean = rawVal.replace(/[^0-9T]/g, '');
  if (clean.length === 8) {
    // Date only: YYYYMMDD
    const y = clean.substring(0, 4);
    const m = clean.substring(4, 6);
    const d = clean.substring(6, 8);
    return {
      date: `${y}-${m}-${d}`,
      isAllDay: true,
    };
  }

  if (clean.includes('T') || clean.length >= 13) {
    const parts = clean.split('T');
    const dPart = parts[0];
    const tPart = parts[1] || '';

    const y = dPart.substring(0, 4);
    const m = dPart.substring(4, 6);
    const d = dPart.substring(6, 8);
    const dateStr = `${y}-${m}-${d}`;

    const hh = tPart.substring(0, 2);
    const mm = tPart.substring(2, 4);
    const timeStr = hh && mm ? `${hh}:${mm}` : undefined;

    return {
      date: dateStr,
      time: timeStr,
      isAllDay: !timeStr,
    };
  }

  // Fallback to today
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { date: ymd, isAllDay: true };
}

/**
 * Adjust exclusive end date for all-day events in RFC 5545
 * In iCal, an all-day event on 2026-08-26 has DTSTART:20260826 and DTEND:20260827 (exclusive).
 * So we subtract 1 day if it's strictly > startDate.
 */
function adjustExclusiveEndDate(startDateStr: string, endDateStr: string): string {
  if (startDateStr === endDateStr) return endDateStr;
  try {
    const startD = new Date(startDateStr + 'T00:00:00');
    const endD = new Date(endDateStr + 'T00:00:00');
    const diffDays = Math.round((endD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 1) {
      endD.setDate(endD.getDate() - 1);
      const y = endD.getFullYear();
      const m = String(endD.getMonth() + 1).padStart(2, '0');
      const d = String(endD.getDate()).padStart(2, '0');
      const adjusted = `${y}-${m}-${d}`;
      return adjusted >= startDateStr ? adjusted : startDateStr;
    }
  } catch {}
  return endDateStr;
}

/**
 * Parse an .ics / iCalendar format text file into structured event items
 */
export function parseICalendarString(icsText: string): ParsedICalEvent[] {
  if (!icsText || !icsText.includes('BEGIN:VCALENDAR')) {
    throw new Error('올바른 iCalendar (.ics) 파일 형식이 아닙니다. 파일 내용을 확인해주세요.');
  }

  // Unfold folded lines (RFC 5545: lines starting with space or tab continue the previous line)
  const unfolded = icsText.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);

  const events: ParsedICalEvent[] = [];
  let inEvent = false;
  let currentEvent: Partial<ParsedICalEvent> = {};
  let rawDtStart = '';
  let rawDtEnd = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {
        id: `ical_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        selected: true,
      };
      rawDtStart = '';
      rawDtEnd = '';
      continue;
    }

    if (trimmed === 'END:VEVENT') {
      if (inEvent && currentEvent.title) {
        // Resolve start/end dates
        const startInfo = parseICalDateTime(rawDtStart);
        let endInfo = rawDtEnd ? parseICalDateTime(rawDtEnd) : startInfo;

        let finalStartDate = startInfo.date;
        let finalEndDate = endInfo.date;

        if (startInfo.isAllDay && endInfo.isAllDay && rawDtEnd) {
          finalEndDate = adjustExclusiveEndDate(finalStartDate, finalEndDate);
        }

        const isChecklist = currentEvent.title.startsWith('[할 일]') || currentEvent.title.startsWith('[체크리스트]');
        const cleanTitle = isChecklist
          ? currentEvent.title.replace(/^\[(할 일|체크리스트)\]\s*/, '')
          : currentEvent.title;

        events.push({
          id: currentEvent.id || `ical_${Date.now()}`,
          title: cleanTitle,
          startDate: finalStartDate,
          endDate: finalEndDate,
          startTime: startInfo.time,
          endTime: endInfo.time,
          isAllDay: startInfo.isAllDay,
          description: currentEvent.description,
          location: currentEvent.location,
          category: currentEvent.category || (isChecklist ? 'personal' : 'other'),
          isChecklist,
          selected: true,
        });
      }
      inEvent = false;
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const keyPart = trimmed.substring(0, colonIdx);
    const valuePart = trimmed.substring(colonIdx + 1);
    const mainKey = keyPart.split(';')[0].toUpperCase();

    switch (mainKey) {
      case 'SUMMARY':
        currentEvent.title = unescapeICalText(valuePart);
        break;
      case 'DESCRIPTION':
        currentEvent.description = unescapeICalText(valuePart);
        break;
      case 'LOCATION':
        currentEvent.location = unescapeICalText(valuePart);
        break;
      case 'CATEGORIES':
        currentEvent.category = unescapeICalText(valuePart);
        break;
      case 'DTSTART':
        rawDtStart = valuePart;
        break;
      case 'DTEND':
        rawDtEnd = valuePart;
        break;
      case 'UID':
        if (!currentEvent.id) currentEvent.id = valuePart;
        break;
      default:
        break;
    }
  }

  return events;
}

/**
 * Convert parsed iCal events to PlannerItems & ChecklistItems
 */
export function convertICalEventsToAppItems(
  events: ParsedICalEvent[],
  targetCategoryMap: Record<string, string> = {}
): {
  plannerItems: PlannerItem[];
  checklistItems: ChecklistItem[];
} {
  const plannerItems: PlannerItem[] = [];
  const checklistItems: ChecklistItem[] = [];

  for (const ev of events) {
    if (!ev.selected) continue;

    const categoryId = targetCategoryMap[ev.category || ''] || 'other';

    if (ev.isChecklist) {
      checklistItems.push({
        id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: ev.title,
        isCompleted: false,
        dueDate: ev.startDate,
        startDate: ev.startDate,
        endDate: ev.endDate !== ev.startDate ? ev.endDate : undefined,
        isDateRange: ev.endDate !== ev.startDate,
        dueTime: ev.startTime,
        category: categoryId,
        memo: ev.description,
        priority: 'medium',
        createdAt: new Date().toISOString(),
      });
    } else {
      plannerItems.push({
        id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: ev.title,
        date: ev.startDate,
        startDate: ev.startDate,
        endDate: ev.endDate,
        isDateRange: ev.endDate !== ev.startDate,
        startTime: ev.startTime,
        endTime: ev.endTime,
        category: categoryId,
        description: ev.description,
        location: ev.location,
        isCompleted: false,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return { plannerItems, checklistItems };
}
