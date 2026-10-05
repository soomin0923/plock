import React from 'react';
import { Flame, ImageIcon, ListChecks, MapPin } from 'lucide-react';
import type { Category, Habit, PlannerEvent, Task } from '../../types';
import { Checkbox } from '../../components/ui';
import { cx } from '../../lib/util';
import { aiParsePlan } from '../../lib/gemini';
import { localParsePlan, type PlanDraft } from '../../lib/nlParser';
import { today } from '../../lib/date';
import { categoryOf, dueLabel, eventTimeLabel, habitDaysLabel, habitStreak, PRIORITY_META } from './helpers';

export function EventRow({ e, cats, date, onClick, onToggle }: { e: PlannerEvent; cats: Category[]; date?: string; onClick: () => void; onToggle?: () => void }) {
  const c = categoryOf(cats, e.categoryId);
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(k) => k.key === 'Enter' && onClick()} className="flex w-full cursor-pointer items-stretch gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-hover">
      <span className="w-1 flex-none rounded-full" style={{ background: c.color }} />
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[15px] font-semibold', e.done && 'text-muted line-through')}>{e.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
          <span className="tabular">{eventTimeLabel(e, date)}</span>
          <span style={{ color: c.color }}>{c.name}</span>
          {e.location && (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />
              {e.location}
            </span>
          )}
          {!!e.photos?.length && <ImageIcon className="h-3.5 w-3.5" />}
        </p>
      </div>
      {onToggle && (
        <div className="flex items-center">
          <Checkbox checked={!!e.done} onChange={onToggle} color={c.color} label="완료" />
        </div>
      )}
    </div>
  );
}

export function TaskRow({ t, cats, onClick, onToggle }: { t: Task; cats: Category[]; onClick: () => void; onToggle: () => void }) {
  const due = dueLabel(t);
  const c = t.categoryId ? categoryOf(cats, t.categoryId) : null;
  const subDone = t.subtasks?.filter((s) => s.done).length || 0;
  const subTotal = t.subtasks?.length || 0;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(k) => k.key === 'Enter' && onClick()} className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-hover">
      <Checkbox checked={t.done} onChange={onToggle} label={`${t.title} 완료`} color={c?.color} />
      <div className="min-w-0 flex-1">
        <p className={cx('truncate text-[15px] font-medium', t.done && 'text-muted line-through')}>
          {t.priority === 'high' && !t.done && <span className="mr-1 font-bold" style={{ color: PRIORITY_META.high.color }}>!</span>}
          {t.title}
        </p>
        {(due.text || c || subTotal > 0) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
            {due.text && <span className={cx('tabular', !t.done && due.tone === 'overdue' && 'font-semibold text-expense', !t.done && due.tone === 'today' && 'font-semibold text-primary')}>{due.text}</span>}
            {c && <span style={{ color: c.color }}>{c.name}</span>}
            {subTotal > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <ListChecks className="h-3.5 w-3.5" />
                {subDone}/{subTotal}
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function HabitRow({ h, date, onToggle, onClick, compact }: { h: Habit; date: string; onToggle: () => void; onClick: () => void; compact?: boolean }) {
  const done = h.doneDates.includes(date);
  const streak = habitStreak(h);
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2">
      <button
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`${h.title} ${done ? '체크 해제' : '체크'}`}
        className={cx('flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-xl transition active:scale-95', done ? 'bg-primary shadow-sm' : 'bg-hover grayscale-[0.4]')}
      >
        {h.icon}
      </button>
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <p className={cx('truncate text-[15px] font-semibold', done && 'text-muted')}>{h.title}</p>
        {!compact && <p className="text-[13px] text-muted">{habitDaysLabel(h.days)}</p>}
      </button>
      {streak > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[13px] font-bold text-orange-500 tabular" title={`${streak}일 연속`}>
          <Flame className="h-4 w-4" />
          {streak}
        </span>
      )}
    </div>
  );
}

/** Parse a natural-language planner input with Gemini (if a key is set) or the local parser. */
export async function parsePlanInput(text: string, useAi: boolean, cats: Category[], onAiError: (msg: string) => void): Promise<PlanDraft> {
  const d = today();
  if (useAi) {
    try {
      return await aiParsePlan(text, d, cats);
    } catch (e) {
      onAiError(`AI 분석 실패: ${(e as Error).message} (기본 분석으로 대신했어요)`);
    }
  }
  return localParsePlan(text, d, cats);
}
