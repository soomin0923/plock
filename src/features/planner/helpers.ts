import type { Category, Habit, PlannerEvent, Task } from '../../types';
import { addDays, diffDays, formatKoreanDate, relativeDayLabel, today, weekday, WEEKDAYS_KR } from '../../lib/date';

export const FALLBACK_CATEGORY: Category = { id: 'cat_none', name: '미분류', color: '#9a9289', order: 999, createdAt: '', updatedAt: '' };

export function sortCategories(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function categoryOf(cats: Category[], id?: string): Category {
  return cats.find((c) => c.id === id) || FALLBACK_CATEGORY;
}

export function eventOnDate(e: PlannerEvent, d: string): boolean {
  return e.startDate <= d && d <= e.endDate;
}

export function sortEvents(list: PlannerEvent[]): PlannerEvent[] {
  return [...list].sort((a, b) => {
    const aAll = !a.startTime;
    const bAll = !b.startTime;
    if (aAll !== bAll) return aAll ? -1 : 1;
    return (a.startTime || '').localeCompare(b.startTime || '') || a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title);
  });
}

export function eventsOnDate(events: PlannerEvent[], d: string): PlannerEvent[] {
  return sortEvents(events.filter((e) => eventOnDate(e, d)));
}

export function eventTimeLabel(e: PlannerEvent, d?: string): string {
  const multi = e.startDate !== e.endDate;
  if (multi && d) {
    const idx = diffDays(e.startDate, d) + 1;
    const total = diffDays(e.startDate, e.endDate) + 1;
    return `${idx}/${total}일차`;
  }
  if (!e.startTime) return '종일';
  return e.endTime ? `${e.startTime}–${e.endTime}` : e.startTime;
}

export function isHabitDay(h: Habit, d: string): boolean {
  return h.days.includes(weekday(d));
}

export function habitDaysLabel(days: number[]): string {
  const s = [...days].sort();
  if (s.length === 7) return '매일';
  if (s.join() === '1,2,3,4,5') return '평일';
  if (s.join() === '0,6') return '주말';
  return s.map((d) => WEEKDAYS_KR[d]).join('·');
}

/** Consecutive scheduled days completed, counting back from today (today may still be pending). */
export function habitStreak(h: Habit, base = today()): number {
  const done = new Set(h.doneDates);
  let d = base;
  if (isHabitDay(h, d) && !done.has(d)) d = addDays(d, -1);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    if (isHabitDay(h, d)) {
      if (!done.has(d)) break;
      streak++;
    }
    d = addDays(d, -1);
  }
  return streak;
}

export function habitRate(h: Habit, from: string, to: string): { done: number; total: number } {
  const done = new Set(h.doneDates);
  let total = 0;
  let count = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (!isHabitDay(h, d)) continue;
    total++;
    if (done.has(d)) count++;
  }
  return { done: count, total };
}

export function toggleHabitDate(h: Habit, d: string): Habit {
  const set = new Set(h.doneDates);
  if (set.has(d)) set.delete(d);
  else set.add(d);
  return { ...h, doneDates: Array.from(set).sort() };
}

export function dueLabel(t: Task, base = today()): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' | 'none' } {
  if (!t.dueDate) return { text: '', tone: 'none' };
  const diff = diffDays(base, t.dueDate);
  const time = t.dueTime ? ` ${t.dueTime}` : '';
  if (diff < 0) return { text: `${-diff}일 지남`, tone: 'overdue' };
  const rel = relativeDayLabel(t.dueDate, base);
  if (diff === 0) return { text: `오늘${time}`, tone: 'today' };
  if (rel) return { text: `${rel}${time}`, tone: 'soon' };
  if (diff < 7) return { text: `${WEEKDAYS_KR[weekday(t.dueDate)]}요일${time}`, tone: 'soon' };
  return { text: formatKoreanDate(t.dueDate, { weekday: false }) + time, tone: 'later' };
}

export function sortTasks(list: Task[]): Task[] {
  const pr = { high: 0, medium: 1, low: 2 };
  return [...list].sort(
    (a, b) =>
      (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
      (a.dueTime || '99').localeCompare(b.dueTime || '99') ||
      pr[a.priority] - pr[b.priority] ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export const PRIORITY_META = {
  high: { label: '높음', color: '#d0485a' },
  medium: { label: '보통', color: '#d9922e' },
  low: { label: '낮음', color: '#8d857c' },
} as const;
