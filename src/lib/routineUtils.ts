import { RoutineItem } from '../types';

export const DAY_NAMES_KR = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * Checks if a routine is active on a specific YYYY-MM-DD date based on customDays or frequency.
 */
export function isRoutineActiveOnDate(routine: RoutineItem, dateStr: string): boolean {
  if (!dateStr) return true;
  const dateObj = new Date(dateStr);
  const dayIndex = dateObj.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat

  if (routine.customDays && routine.customDays.length > 0) {
    return routine.customDays.includes(dayIndex);
  }

  if (routine.frequency === 'weekdays') {
    return dayIndex >= 1 && dayIndex <= 5;
  }
  if (routine.frequency === 'weekends') {
    return dayIndex === 0 || dayIndex === 6;
  }
  return true; // daily or default
}

/**
 * Formats routine active days into a human-readable Korean string (e.g., "월, 수, 금", "매일", "평일")
 */
export function formatDaysLabel(customDays?: number[], frequency?: string): string {
  if (!customDays || customDays.length === 0) {
    if (frequency === 'weekdays') return '평일 (월~금)';
    if (frequency === 'weekends') return '주말 (토~일)';
    return '매일';
  }
  if (customDays.length === 7) return '매일';
  const sorted = [...customDays].sort((a, b) => a - b);
  if (sorted.length === 5 && sorted.every((d, i) => d === i + 1)) return '평일 (월~금)';
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return '주말 (토~일)';

  return sorted.map((d) => DAY_NAMES_KR[d]).join(', ');
}
