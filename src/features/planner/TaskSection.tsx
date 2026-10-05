import React, { useMemo, useState } from 'react';
import { ChevronDown, ListTodo, Plus } from 'lucide-react';
import type { Task } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Card, EmptyState, Segmented } from '../../components/ui';
import { addDays, diffDays, today } from '../../lib/date';
import { nowIso } from '../../lib/util';
import { localParsePlan } from '../../lib/nlParser';
import { sortTasks } from './helpers';
import { TaskRow } from './rows';
import { blankTask, type PlanSheetState } from './forms';

type Filter = 'active' | 'today' | 'nodate' | 'done';

export function toggleTask(t: Task): Task {
  return { ...t, done: !t.done, doneAt: !t.done ? nowIso() : undefined };
}

export function TaskSection({ openSheet }: { openSheet: (s: PlanSheetState) => void }) {
  const { data, upsert } = useData();
  const [filter, setFilter] = useState<Filter>('active');
  const [quick, setQuick] = useState('');
  const [showDone, setShowDone] = useState(false);
  const d0 = today();

  const groups = useMemo(() => {
    const active = sortTasks(data.tasks.filter((t) => !t.done));
    const done = [...data.tasks.filter((t) => t.done)].sort((a, b) => (b.doneAt || b.updatedAt).localeCompare(a.doneAt || a.updatedAt));
    if (filter === 'done') return [{ title: '완료한 일', items: done }];
    if (filter === 'today') return [{ title: '오늘까지', items: active.filter((t) => t.dueDate && t.dueDate <= d0) }];
    if (filter === 'nodate') return [{ title: '기한 없음', items: active.filter((t) => !t.dueDate) }];
    const g = [
      { title: '지난 기한', items: active.filter((t) => t.dueDate && t.dueDate < d0) },
      { title: '오늘', items: active.filter((t) => t.dueDate === d0) },
      { title: '내일', items: active.filter((t) => t.dueDate === addDays(d0, 1)) },
      { title: '이번 주', items: active.filter((t) => t.dueDate && diffDays(d0, t.dueDate) >= 2 && diffDays(d0, t.dueDate) < 7) },
      { title: '나중에', items: active.filter((t) => t.dueDate && diffDays(d0, t.dueDate) >= 7) },
      { title: '기한 없음', items: active.filter((t) => !t.dueDate) },
    ];
    return g.filter((x) => x.items.length);
  }, [data.tasks, filter, d0]);

  const recentDone = filter === 'active' ? data.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || '')).slice(0, 20) : [];

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
        dueDate: hasDate ? draft.dueDate || draft.startDate : filter === 'today' ? d0 : undefined,
        dueTime: draft.dueTime || draft.startTime,
        priority: draft.priority,
      }),
    );
    setQuick('');
  };

  const total = data.tasks.filter((t) => !t.done).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Filter>
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: `진행 중 ${total}` },
            { value: 'today', label: '오늘' },
            { value: 'nodate', label: '기한 없음' },
            { value: 'done', label: '완료' },
          ]}
        />
        <div className="flex-1" />
        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openSheet({ mode: 'new', kind: 'task', date: d0 })}>
          할 일
        </Button>
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
          <EmptyState icon={<ListTodo className="h-10 w-10" />} title={filter === 'done' ? '완료한 일이 없어요' : '할 일이 없어요'} description="위 입력창에 바로 적어 보세요." />
        </Card>
      ) : (
        groups.map((g) => (
          <Card key={g.title} className="p-2">
            <p className={`px-2 pb-1 pt-1.5 text-[13px] font-bold ${g.title === '지난 기한' ? 'text-expense' : 'text-muted'}`}>
              {g.title} <span className="font-medium">{g.items.length}</span>
            </p>
            {g.items.map((t) => (
              <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => openSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
            ))}
          </Card>
        ))
      )}

      {recentDone.length > 0 && (
        <div>
          <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 px-2 text-sm font-semibold text-muted">
            <ChevronDown className={`h-4 w-4 transition ${showDone ? '' : '-rotate-90'}`} />
            최근 완료 {recentDone.length}
          </button>
          {showDone && (
            <Card className="mt-2 p-2">
              {recentDone.map((t) => (
                <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => openSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
