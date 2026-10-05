import React, { useMemo, useState } from 'react';
import { ListTodo, Plus } from 'lucide-react';
import type { Task } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Card, EmptyState, Segmented } from '../../components/ui';
import { addDays, startOfWeek, today } from '../../lib/date';
import { cx, nowIso } from '../../lib/util';
import { localParsePlan } from '../../lib/nlParser';
import { sortCategories, sortTasks } from './helpers';
import { TaskRow } from './rows';
import { blankTask, type PlanSheetState } from './forms';

type Status = 'open' | 'done';
type DueGroup = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'nodate';
type DueFilter = 'all' | 'overdue' | 'today' | 'week' | 'nodate';

const DUE_FILTERS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'overdue', label: '지난 기한' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'nodate', label: '기한 없음' },
];

const GROUP_TITLE: Record<DueGroup, string> = {
  overdue: '지난 기한',
  today: '오늘',
  tomorrow: '내일',
  week: '이번 주',
  later: '나중에',
  nodate: '기한 없음',
};

export function toggleTask(t: Task): Task {
  return { ...t, done: !t.done, doneAt: !t.done ? nowIso() : undefined };
}

export function TaskSection({ openSheet }: { openSheet: (s: PlanSheetState) => void }) {
  const { data, upsert, prefs } = useData();
  const [status, setStatus] = useState<Status>('open');
  const [due, setDue] = useState<DueFilter>('all');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [quick, setQuick] = useState('');

  const d0 = today();
  const tomorrow = addDays(d0, 1);
  const weekEnd = addDays(startOfWeek(d0, prefs.weekStartsOn), 6);

  const groupOf = (t: Task): DueGroup =>
    !t.dueDate ? 'nodate' : t.dueDate < d0 ? 'overdue' : t.dueDate === d0 ? 'today' : t.dueDate === tomorrow ? 'tomorrow' : t.dueDate <= weekEnd ? 'week' : 'later';

  const groups = useMemo(() => {
    const matchesDue = (t: Task) => {
      if (status === 'done' || due === 'all') return true;
      const g = groupOf(t);
      if (due === 'week') return g === 'today' || g === 'tomorrow' || g === 'week';
      return g === due;
    };
    const list = data.tasks.filter((t) => t.done === (status === 'done') && (!categoryId || t.categoryId === categoryId) && matchesDue(t));
    if (status === 'done') {
      const items = list.sort((a, b) => (b.doneAt || b.updatedAt).localeCompare(a.doneAt || a.updatedAt));
      return items.length ? [{ key: 'done', title: '완료한 일', items }] : [];
    }
    const order: DueGroup[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'nodate'];
    return order
      .map((g) => ({ key: g, title: GROUP_TITLE[g], items: sortTasks(list.filter((t) => groupOf(t) === g)) }))
      .filter((g) => g.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.tasks, status, due, categoryId, d0, weekEnd]);

  const counts = useMemo(
    () =>
      sortCategories(data.categories).map((c) => {
        const open = data.tasks.filter((t) => !t.done && t.categoryId === c.id);
        return { ...c, open: open.length, overdue: open.filter((t) => t.dueDate && t.dueDate < d0).length };
      }),
    [data.categories, data.tasks, d0],
  );

  const openTotal = data.tasks.filter((t) => !t.done).length;
  const doneTotal = data.tasks.length - openTotal;

  const addQuick = (e: React.FormEvent) => {
    e.preventDefault();
    const text = quick.trim();
    if (!text) return;
    // Pick up a due date/time from the sentence ("금요일까지 보고서 제출") without opening a dialog.
    const draft = localParsePlan(text, d0, data.categories);
    const hasDate = draft.dueDate || draft.kind === 'event';
    upsert(
      'tasks',
      blankTask({
        title: draft.title || text,
        dueDate: hasDate ? draft.dueDate || draft.startDate : due === 'today' ? d0 : undefined,
        dueTime: draft.dueTime || draft.startTime,
        priority: draft.priority,
        categoryId: categoryId || undefined,
      }),
    );
    setQuick('');
  };

  const chip = (active: boolean) =>
    cx('flex flex-none items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition', active ? 'border-ink bg-ink text-white' : 'border-line-strong text-ink-soft hover:bg-hover');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Status>
          size="sm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'open', label: `진행 중 ${openTotal}` },
            { value: 'done', label: `완료 ${doneTotal}` },
          ]}
        />
        <div className="flex-1" />
        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openSheet({ mode: 'new', kind: 'task', date: d0 })}>
          할 일
        </Button>
      </div>

      {status === 'open' && (
        <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="기한으로 거르기">
          {DUE_FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={due === f.value} onClick={() => setDue(f.value)} className={chip(due === f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="카테고리로 거르기">
        <button type="button" aria-pressed={categoryId === null} onClick={() => setCategoryId(null)} className={chip(categoryId === null)}>
          모든 카테고리
        </button>
        {counts.map((c) => (
          <button key={c.id} type="button" aria-pressed={categoryId === c.id} onClick={() => setCategoryId(categoryId === c.id ? null : c.id)} className={chip(categoryId === c.id)}>
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name}
            <span className={cx('tabular', categoryId === c.id ? 'text-white/70' : 'text-muted')}>{c.open}</span>
            {c.overdue > 0 && <span className={cx('tabular', categoryId === c.id ? 'text-red-200' : 'text-expense')}>!{c.overdue}</span>}
          </button>
        ))}
      </div>

      <form onSubmit={addQuick} className="flex items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-card px-3 py-1.5">
        <Plus className="h-4 w-4 text-muted" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="빠르게 할 일 추가 (예: 금요일까지 과제 제출)"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] placeholder:text-faint focus:outline-none"
          enterKeyHint="done"
          aria-label="빠르게 할 일 추가"
        />
      </form>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={<ListTodo className="h-10 w-10" />} title={status === 'done' ? '완료한 일이 없어요' : '조건에 맞는 할 일이 없어요'} description={status === 'open' ? '위 입력창에 바로 적어 보세요.' : undefined} />
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.key} className="p-2">
            <p className={cx('px-2 pb-1 pt-1.5 text-[13px] font-bold', g.key === 'overdue' ? 'text-expense' : 'text-muted')}>
              {g.title} <span className="font-medium">{g.items.length}</span>
            </p>
            {g.items.map((t) => (
              <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => openSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
            ))}
          </Card>
        ))
      )}
    </div>
  );
}
