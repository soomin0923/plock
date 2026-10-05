import React from 'react';
import { Flame, Plus, Sprout } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { Button, Card, EmptyState } from '../../components/ui';
import { addDays, diffDays, endOfMonth, startOfMonth, startOfWeek, today, weekDates, WEEKDAYS_KR, parseYmd } from '../../lib/date';
import { cx } from '../../lib/util';
import { habitDaysLabel, habitRate, habitStreak, isHabitDay, toggleHabitDate } from './helpers';
import type { PlanSheetState } from './forms';

export function HabitSection({ openSheet }: { openSheet: (s: PlanSheetState) => void }) {
  const { data, upsert, prefs } = useData();
  const d0 = today();
  const week = weekDates(d0, prefs.weekStartsOn);
  const habits = [...data.habits].sort((a, b) => a.order - b.order || a.createdAt.localeCompare(b.createdAt));
  const todays = habits.filter((h) => isHabitDay(h, d0));
  const doneToday = todays.filter((h) => h.doneDates.includes(d0)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm text-muted">오늘의 습관</p>
          <p className="text-xl font-bold tabular">
            {doneToday} / {todays.length}
            <span className="ml-2 text-sm font-medium text-muted">{todays.length ? Math.round((doneToday / todays.length) * 100) : 0}%</span>
          </p>
        </div>
        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openSheet({ mode: 'new', kind: 'habit', date: d0 })}>
          습관
        </Button>
      </div>

      {habits.length === 0 ? (
        <Card>
          <EmptyState icon={<Sprout className="h-10 w-10" />} title="아직 습관이 없어요" description="물 마시기, 운동, 독서처럼 매일 체크할 습관을 만들어 보세요." action={<Button variant="primary" onClick={() => openSheet({ mode: 'new', kind: 'habit', date: d0 })}>첫 습관 만들기</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {habits.map((h) => {
            const streak = habitStreak(h);
            const rate = habitRate(h, startOfMonth(d0), d0 < endOfMonth(d0) ? d0 : endOfMonth(d0));
            return (
              <Card key={h.id} className="p-4">
                <button onClick={() => openSheet({ mode: 'edit-habit', item: h })} className="mb-3 flex w-full items-center gap-3 text-left">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-hover text-2xl">{h.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{h.title}</span>
                    <span className="text-[13px] text-muted">
                      {habitDaysLabel(h.days)} · 이번 달 {rate.total ? Math.round((rate.done / rate.total) * 100) : 0}%
                    </span>
                  </span>
                  <span className={cx('inline-flex items-center gap-0.5 text-sm font-bold tabular', streak ? 'text-orange-500' : 'text-faint')}>
                    <Flame className="h-4 w-4" />
                    {streak}일
                  </span>
                </button>
                <div className="grid grid-cols-7 gap-1.5">
                  {week.map((d) => {
                    const scheduled = isHabitDay(h, d);
                    const done = h.doneDates.includes(d);
                    const future = d > d0;
                    return (
                      <button
                        key={d}
                        disabled={future}
                        onClick={() => upsert('habits', toggleHabitDate(h, d))}
                        aria-label={`${d} ${done ? '체크 해제' : '체크'}`}
                        aria-pressed={done}
                        className={cx(
                          'flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition',
                          done ? 'bg-primary text-white' : scheduled ? 'bg-hover text-ink-soft' : 'text-faint',
                          d === d0 && !done && 'ring-2 ring-primary/60',
                          future && 'opacity-40',
                        )}
                      >
                        <span>{WEEKDAYS_KR[parseYmd(d).getDay()]}</span>
                        <span className="text-[13px] tabular">{parseYmd(d).getDate()}</span>
                      </button>
                    );
                  })}
                </div>
                <MiniHeatmap doneDates={h.doneDates} end={d0} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Last ~10 weeks at a glance (one column per week). */
function MiniHeatmap({ doneDates, end }: { doneDates: string[]; end: string }) {
  const done = new Set(doneDates);
  const start = startOfWeek(addDays(end, -63));
  const days = Array.from({ length: diffDays(start, end) + 1 }, (_, i) => addDays(start, i));
  return (
    <div className="mt-3 grid auto-cols-[10px] grid-flow-col grid-rows-[repeat(7,10px)] gap-[3px]" aria-hidden>
      {days.map((d) => (
        <span key={d} className={cx('rounded-[2px]', done.has(d) ? 'bg-primary' : 'bg-hover')} />
      ))}
    </div>
  );
}
