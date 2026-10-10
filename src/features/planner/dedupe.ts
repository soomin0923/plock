import type { PlannerEvent, Task } from '../../types';

// One definition of "the same item", used by .ics import, the duplicate clean-up in Settings,
// and the MCP server: same title (spacing ignored), same start date, same start time.
// It matches the SQL check that found the duplicates (GROUP BY title, start_date, start_time).

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');

export const eventKey = (e: Pick<PlannerEvent, 'title' | 'startDate' | 'startTime'>) => `${norm(e.title)}|${e.startDate}|${e.startTime || ''}`;
export const taskKey = (t: Pick<Task, 'title' | 'dueDate' | 'dueTime'>) => `${norm(t.title)}|${t.dueDate || ''}|${t.dueTime || ''}`;

/** How much a copy carries: the copy to keep is the most filled-in one, then the oldest. */
function richness(x: object): number {
  return Object.values(x).filter((v) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)).length;
}

export interface DuplicateGroup<T> {
  keep: T;
  drop: T[];
}

export function findDuplicates<T extends { id: string; createdAt: string }>(items: T[], key: (x: NoInfer<T>) => string): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const g = groups.get(k);
    if (g) g.push(it);
    else groups.set(k, [it]);
  }
  const out: DuplicateGroup<T>[] = [];
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const sorted = [...g].sort((a, b) => richness(b) - richness(a) || a.createdAt.localeCompare(b.createdAt));
    out.push({ keep: sorted[0], drop: sorted.slice(1) });
  }
  return out;
}
