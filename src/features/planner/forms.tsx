import React, { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Category, Habit, PlannerEvent, Priority, Subtask, Task } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Checkbox, Field, Segmented, Sheet, TextArea, TextInput, Toggle, useConfirm } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { finishParseLog, recordFields } from '../../lib/parseLog';
import { useToast } from '../../components/Toast';
import { addDays, addMinutesHm, orderedWeekdays, today, weekday, WEEKDAYS_KR } from '../../lib/date';
import { newId, nowIso, cx } from '../../lib/util';
import { PRIORITY_META, sortCategories } from './helpers';
import type { PlanDraft } from '../../lib/nlParser';

export function CategoryPicker({ value, onChange, allowNone }: { value?: string; onChange: (id?: string) => void; allowNone?: boolean }) {
  const { data } = useData();
  const cats = sortCategories(data.categories);
  return (
    <div className="drag-scroll no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {allowNone && (
        <button type="button" onClick={() => onChange(undefined)} className={cx('flex-none rounded-full border px-3 py-1.5 text-[13px] font-semibold', !value ? 'border-ink bg-ink text-card' : 'border-line-strong text-muted')}>
          없음
        </button>
      )}
      {cats.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className="flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition"
            style={on ? { background: c.color, borderColor: c.color, color: '#fff' } : { borderColor: 'var(--color-line-strong)', color: 'var(--color-ink-soft)' }}
          >
            {!on && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function FormActions({ onCancel, onDelete, saveLabel = '저장', disabled }: { onCancel: () => void; onDelete?: () => void; saveLabel?: string; disabled?: boolean }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-line bg-card px-5 pb-1 pt-3">
      {onDelete && (
        <Button variant="ghost" className="text-expense" onClick={onDelete} icon={<Trash2 className="h-4 w-4" />}>
          삭제
        </Button>
      )}
      <div className="flex-1" />
      <Button onClick={onCancel}>취소</Button>
      <Button type="submit" variant="primary" disabled={disabled}>
        {saveLabel}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ Event

export function EventForm({ initial, isNew, onDone }: { initial: PlannerEvent; isNew: boolean; onDone: (saved?: PlannerEvent) => void }) {
  const { upsert, remove, releaseImages } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [e, setE] = useState<PlannerEvent>(initial);
  const [allDay, setAllDay] = useState(!initial.startTime);
  const added = useRef<string[]>([]);
  const set = (patch: Partial<PlannerEvent>) => setE((prev) => ({ ...prev, ...patch }));

  const cancel = () => {
    releaseImages(added.current, { col: 'events', id: initial.id, next: isNew ? undefined : initial });
    onDone();
  };

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!e.title.trim()) return;
    let startTime = allDay ? undefined : e.startTime || '09:00';
    let endTime = allDay ? undefined : e.endTime;
    if (startTime && endTime && e.startDate === e.endDate && endTime <= startTime) endTime = addMinutesHm(startTime, 60);
    const next: PlannerEvent = { ...e, title: e.title.trim(), startTime, endTime, endDate: e.endDate < e.startDate ? e.startDate : e.endDate };
    upsert('events', next);
    releaseImages([...(initial.photos || []), ...added.current], { col: 'events', id: next.id, next });
    toast(isNew ? '일정을 추가했어요.' : '일정을 수정했어요.');
    onDone(next);
  };

  const del = async () => {
    if (!(await confirm({ title: '일정을 삭제할까요?', message: e.title, confirmLabel: '삭제', danger: true }))) return;
    remove('events', e.id);
    releaseImages([...(initial.photos || []), ...added.current], { col: 'events', id: e.id });
    toast('삭제했어요.');
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <TextInput autoFocus={isNew} required placeholder="일정 제목" value={e.title} onChange={(x) => set({ title: x.target.value })} className="text-base font-semibold" />
      <Field label="카테고리">
        <CategoryPicker value={e.categoryId} onChange={(id) => set({ categoryId: id || e.categoryId })} />
      </Field>
      <Toggle checked={allDay} onChange={setAllDay} label="하루 종일" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="시작일">
          <TextInput type="date" required value={e.startDate} onChange={(x) => x.target.value && set({ startDate: x.target.value, endDate: e.endDate < x.target.value ? x.target.value : e.endDate })} />
        </Field>
        <Field label="종료일">
          <TextInput type="date" required value={e.endDate} min={e.startDate} onChange={(x) => x.target.value && set({ endDate: x.target.value })} />
        </Field>
        {!allDay && (
          <>
            <Field label="시작 시간">
              <TextInput type="time" value={e.startTime || '09:00'} onChange={(x) => set({ startTime: x.target.value, endTime: e.endTime && e.endTime > x.target.value ? e.endTime : addMinutesHm(x.target.value, 60) })} />
            </Field>
            <Field label="종료 시간">
              <TextInput type="time" value={e.endTime || addMinutesHm(e.startTime || '09:00', 60)} onChange={(x) => set({ endTime: x.target.value })} />
            </Field>
          </>
        )}
      </div>
      <Field label="장소">
        <TextInput placeholder="선택" value={e.location || ''} onChange={(x) => set({ location: x.target.value })} />
      </Field>
      <Field label="메모">
        <TextArea rows={3} placeholder="선택" value={e.memo || ''} onChange={(x) => set({ memo: x.target.value })} />
      </Field>
      <Field label="사진">
        <PhotoPicker value={e.photos || []} onChange={(photos) => set({ photos })} onAdded={(r) => added.current.push(...r)} max={6} />
      </Field>
      {!isNew && <Toggle checked={!!e.done} onChange={(done) => set({ done })} label="완료한 일정" />}
      <FormActions onCancel={cancel} onDelete={isNew ? undefined : del} saveLabel={isNew ? '추가' : '저장'} />
    </form>
  );
}

// ------------------------------------------------------------------ Task

export function TaskForm({ initial, isNew, onDone }: { initial: Task; isNew: boolean; onDone: (saved?: Task) => void }) {
  const { upsert, remove } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [t, setT] = useState<Task>(initial);
  const [sub, setSub] = useState('');
  const set = (patch: Partial<Task>) => setT((prev) => ({ ...prev, ...patch }));
  const d0 = today();
  const weekend = weekday(d0) === 0 ? d0 : addDays(d0, 6 - weekday(d0));
  const quick = [
    { label: '오늘', v: d0 },
    { label: '내일', v: addDays(d0, 1) },
    { label: '이번 주말', v: weekend },
    { label: '다음 주', v: addDays(d0, 7) },
  ];

  const addSub = () => {
    if (!sub.trim()) return;
    set({ subtasks: [...(t.subtasks || []), { id: newId('st'), title: sub.trim(), done: false }] });
    setSub('');
  };

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!t.title.trim()) return;
    const next: Task = { ...t, title: t.title.trim(), dueTime: t.dueDate ? t.dueTime : undefined, doneAt: t.done ? t.doneAt || nowIso() : undefined };
    upsert('tasks', next);
    toast(isNew ? '할 일을 추가했어요.' : '할 일을 수정했어요.');
    onDone(next);
  };

  const del = async () => {
    if (!(await confirm({ title: '할 일을 삭제할까요?', message: t.title, confirmLabel: '삭제', danger: true }))) return;
    remove('tasks', t.id);
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <TextInput autoFocus={isNew} required placeholder="할 일" value={t.title} onChange={(x) => set({ title: x.target.value })} className="text-base font-semibold" />
      <Field label="마감일">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={() => set({ dueDate: q.v })} className={cx('rounded-full border px-3 py-1 text-[13px] font-semibold', t.dueDate === q.v ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong text-ink-soft')}>
              {q.label}
            </button>
          ))}
          <button type="button" onClick={() => set({ dueDate: undefined, dueTime: undefined })} className={cx('rounded-full border px-3 py-1 text-[13px] font-semibold', !t.dueDate ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong text-ink-soft')}>
            기한 없음
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput type="date" value={t.dueDate || ''} onChange={(x) => set({ dueDate: x.target.value || undefined })} aria-label="마감일" />
          <TextInput type="time" value={t.dueTime || ''} disabled={!t.dueDate} onChange={(x) => set({ dueTime: x.target.value || undefined })} aria-label="마감 시간" />
        </div>
      </Field>
      <Field label="중요도">
        <Segmented<Priority>
          value={t.priority}
          onChange={(priority) => set({ priority })}
          options={(['high', 'medium', 'low'] as Priority[]).map((p) => ({ value: p, label: PRIORITY_META[p].label }))}
          className="w-full"
        />
      </Field>
      <Field label="카테고리">
        <CategoryPicker value={t.categoryId} onChange={(categoryId) => set({ categoryId })} allowNone />
      </Field>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">세부 항목</span>
        <div className="space-y-1.5">
          {(t.subtasks || []).map((s: Subtask) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-xl bg-hover/60 px-3 py-2">
              <Checkbox size={20} checked={s.done} label={s.title} onChange={() => set({ subtasks: t.subtasks!.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} />
              <span className={cx('flex-1 text-sm', s.done && 'text-muted line-through')}>{s.title}</span>
              <button type="button" aria-label="세부 항목 삭제" onClick={() => set({ subtasks: t.subtasks!.filter((x) => x.id !== s.id) })} className="text-faint hover:text-expense">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <TextInput
              value={sub}
              placeholder="세부 항목 추가"
              onChange={(x) => setSub(x.target.value)}
              onKeyDown={(x) => {
                if (x.key === 'Enter' && !x.nativeEvent.isComposing) {
                  x.preventDefault();
                  addSub();
                }
              }}
              className="h-10"
            />
            <Button onClick={addSub} icon={<Plus className="h-4 w-4" />} aria-label="세부 항목 추가" />
          </div>
        </div>
      </div>
      <Field label="메모">
        <TextArea rows={3} value={t.memo || ''} onChange={(x) => set({ memo: x.target.value })} placeholder="선택" />
      </Field>
      {!isNew && <Toggle checked={t.done} onChange={(done) => set({ done })} label="완료" />}
      <FormActions onCancel={() => onDone()} onDelete={isNew ? undefined : del} saveLabel={isNew ? '추가' : '저장'} />
    </form>
  );
}

// ------------------------------------------------------------------ Habit

const HABIT_ICONS = ['🌱', '💧', '🏃', '📖', '🧘', '💪', '🥗', '😴', '✍️', '🎸', '💊', '🧹', '🇺🇸', '💻', '🚶', '☀️', '🙏', '📵'];

export function HabitForm({ initial, isNew, onDone }: { initial: Habit; isNew: boolean; onDone: (saved?: Habit) => void }) {
  const { upsert, remove, prefs } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [h, setH] = useState<Habit>(initial);
  const set = (patch: Partial<Habit>) => setH((prev) => ({ ...prev, ...patch }));
  const toggleDay = (d: number) => {
    const days = h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d].sort();
    if (days.length) set({ days });
  };

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!h.title.trim()) return;
    const next: Habit = { ...h, title: h.title.trim() };
    upsert('habits', next);
    toast(isNew ? '습관을 추가했어요.' : '습관을 수정했어요.');
    onDone(next);
  };
  const del = async () => {
    if (!(await confirm({ title: '습관을 삭제할까요?', message: '체크 기록도 함께 삭제됩니다.', confirmLabel: '삭제', danger: true }))) return;
    remove('habits', h.id);
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex gap-2">
        <TextInput value={h.icon} onChange={(x) => set({ icon: Array.from(x.target.value).slice(-1)[0] || '🌱' })} className="w-14 text-center text-xl" aria-label="아이콘" />
        <TextInput autoFocus={isNew} required placeholder="예: 물 2L 마시기" value={h.title} onChange={(x) => set({ title: x.target.value })} className="flex-1 text-base font-semibold" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {HABIT_ICONS.map((ic) => (
          <button key={ic} type="button" onClick={() => set({ icon: ic })} className={cx('flex h-9 w-9 items-center justify-center rounded-xl text-lg', h.icon === ic ? 'bg-primary-soft ring-2 ring-primary' : 'bg-hover')}>
            {ic}
          </button>
        ))}
      </div>
      <Field label="반복 요일">
        <div className="mb-2 flex gap-1.5">
          {[
            ['매일', [0, 1, 2, 3, 4, 5, 6]],
            ['평일', [1, 2, 3, 4, 5]],
            ['주말', [0, 6]],
          ].map(([label, days]) => (
            <button key={label as string} type="button" onClick={() => set({ days: days as number[] })} className={cx('rounded-full border px-3 py-1 text-[13px] font-semibold', h.days.join() === (days as number[]).join() ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong text-ink-soft')}>
              {label as string}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {orderedWeekdays(prefs.weekStartsOn).map((d) => (
            <button key={d} type="button" onClick={() => toggleDay(d)} className={cx('h-10 rounded-xl text-sm font-bold', h.days.includes(d) ? 'bg-primary text-on-primary' : 'bg-hover text-muted')}>
              {WEEKDAYS_KR[d]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="카테고리">
        <CategoryPicker value={h.categoryId} onChange={(categoryId) => set({ categoryId })} allowNone />
      </Field>
      <FormActions onCancel={() => onDone()} onDelete={isNew ? undefined : del} saveLabel={isNew ? '추가' : '저장'} />
    </form>
  );
}

// ------------------------------------------------------------------ Factories + combined sheet

export function blankEvent(date: string, cats: Category[], patch: Partial<PlannerEvent> = {}): PlannerEvent {
  const now = nowIso();
  return { id: newId('ev'), title: '', startDate: date, endDate: date, categoryId: sortCategories(cats)[0]?.id || 'cat_etc', photos: [], done: false, createdAt: now, updatedAt: now, ...patch };
}

export function blankTask(patch: Partial<Task> = {}): Task {
  const now = nowIso();
  return { id: newId('task'), title: '', priority: 'medium', done: false, subtasks: [], createdAt: now, updatedAt: now, ...patch };
}

export function blankHabit(order: number, patch: Partial<Habit> = {}): Habit {
  const now = nowIso();
  return { id: newId('habit'), title: '', icon: '🌱', days: [0, 1, 2, 3, 4, 5, 6], doneDates: [], order, createdAt: now, updatedAt: now, ...patch };
}

export type PlanKind = 'event' | 'task' | 'habit';

export type PlanSheetState =
  | { mode: 'new'; kind: PlanKind; date: string; draft?: PlanDraft }
  | { mode: 'edit-event'; item: PlannerEvent }
  | { mode: 'edit-task'; item: Task }
  | { mode: 'edit-habit'; item: Habit }
  | null;

export function PlanSheet({ state, onClose }: { state: PlanSheetState; onClose: () => void }) {
  const { data } = useData();
  const [kind, setKind] = useState<PlanKind>('event');
  const key = useMemo(() => Math.random().toString(36), [state]); // remount forms per open
  const [prevState, setPrevState] = useState<PlanSheetState>(null);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.mode === 'new') setKind(state.kind);
  }

  // Close the sheet and record what happened to a parsed draft (saved as-is / edited / cancelled).
  const logId = state?.mode === 'new' ? state.draft?.logId : undefined;
  const done = (saved?: PlannerEvent | Task | Habit) => {
    if (logId) finishParseLog(logId, saved ? 'saved' : 'cancelled', saved ? recordFields(kind, saved) : undefined, saved ? [saved.id] : undefined);
    onClose();
  };

  let body: React.ReactNode = null;
  let title = '';
  if (state?.mode === 'new') {
    const d = state.draft;
    title = '새로 추가';
    if (kind === 'event')
      body = (
        <EventForm
          key={key + kind}
          isNew
          onDone={done}
          initial={blankEvent(state.date, data.categories, d ? { title: d.title, startDate: d.startDate, endDate: d.endDate, startTime: d.startTime, endTime: d.endTime, categoryId: d.categoryId, memo: d.memo } : {})}
        />
      );
    else if (kind === 'task')
      body = (
        <TaskForm
          key={key + kind}
          isNew
          onDone={done}
          initial={blankTask(d ? { title: d.title, dueDate: d.dueDate ?? d.startDate, dueTime: d.dueTime ?? d.startTime, priority: d.priority, categoryId: d.categoryId, memo: d.memo } : { dueDate: state.date })}
        />
      );
    else body = <HabitForm key={key + kind} isNew onDone={done} initial={blankHabit(data.habits.length, d ? { title: d.title, days: d.days, categoryId: d.categoryId } : {})} />;
  } else if (state?.mode === 'edit-event') {
    title = '일정';
    body = <EventForm key={key} isNew={false} initial={state.item} onDone={onClose} />;
  } else if (state?.mode === 'edit-task') {
    title = '할 일';
    body = <TaskForm key={key} isNew={false} initial={state.item} onDone={onClose} />;
  } else if (state?.mode === 'edit-habit') {
    title = '습관';
    body = <HabitForm key={key} isNew={false} initial={state.item} onDone={onClose} />;
  }

  return (
    <Sheet open={!!state} onClose={() => done()} title={title}>
      {state?.mode === 'new' && (
        <>
          {state.draft && (
            <p className="mb-3 rounded-xl bg-primary-soft px-3 py-2 text-[13px] text-primary">
              {state.draft.source === 'ai' ? '✨ AI가' : '🔎 자동으로'} 아래처럼 정리했어요. 확인 후 추가하세요.
            </p>
          )}
          <Segmented<PlanKind>
            value={kind}
            onChange={setKind}
            className="mb-4 w-full"
            options={[
              { value: 'event', label: '일정' },
              { value: 'task', label: '할 일' },
              { value: 'habit', label: '습관' },
            ]}
          />
        </>
      )}
      {body}
    </Sheet>
  );
}
