import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatMonth, monthGrid, monthKey, orderedWeekdays, today, WEEKDAYS_KR, parseYmd } from '../lib/date';
import { cx } from '../lib/util';
import { IconButton } from './ui';

export function MonthNav({ month, onPrev, onNext, onToday, right }: { month: string; onPrev: () => void; onNext: () => void; onToday?: () => void; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1">
      <IconButton label="이전 달" onClick={onPrev}>
        <ChevronLeft className="h-5 w-5" />
      </IconButton>
      <h3 className="min-w-[7.5em] text-center text-lg font-bold tracking-tight tabular">{formatMonth(month)}</h3>
      <IconButton label="다음 달" onClick={onNext}>
        <ChevronRight className="h-5 w-5" />
      </IconButton>
      {onToday && monthKey(month) !== monthKey(today()) && (
        <button onClick={onToday} className="ml-1 rounded-lg border border-line-strong px-2.5 py-1 text-[13px] font-semibold text-ink-soft hover:bg-hover">
          오늘
        </button>
      )}
      <div className="flex-1" />
      {right}
    </div>
  );
}

export interface CellInfo {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  selected: boolean;
}

export function MonthGrid({
  month,
  selected,
  onSelect,
  weekStartsOn = 0,
  renderCell,
  cellMinHeight = 'min-h-[64px] sm:min-h-[92px]',
  holidays,
}: {
  month: string;
  selected?: string;
  onSelect: (date: string) => void;
  weekStartsOn?: 0 | 1;
  renderCell?: (info: CellInfo) => React.ReactNode;
  cellMinHeight?: string;
  holidays?: Set<string>;
}) {
  const cells = monthGrid(month, weekStartsOn);
  const mk = monthKey(month);
  const t = today();
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-line pb-1.5 text-center text-xs font-semibold text-muted">
        {orderedWeekdays(weekStartsOn).map((d) => (
          <span key={d} className={cx(d === 0 && 'text-expense/80', d === 6 && 'text-sky-600/80')}>
            {WEEKDAYS_KR[d]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const info: CellInfo = { date, inMonth: monthKey(date) === mk, isToday: date === t, selected: date === selected };
          const wd = parseYmd(date).getDay();
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              aria-label={date}
              aria-pressed={info.selected}
              className={cx(
                'group relative flex flex-col items-stretch border-b border-line/70 px-0.5 pb-1 pt-1 text-left transition sm:px-1',
                cellMinHeight,
                info.selected ? 'bg-primary-soft' : 'hover:bg-hover/70',
                !info.inMonth && 'opacity-40',
              )}
            >
              <span
                className={cx(
                  'mx-auto mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold tabular sm:mx-0 sm:ml-0.5',
                  info.isToday ? 'bg-primary text-white' : wd === 0 || holidays?.has(date) ? 'text-expense' : wd === 6 ? 'text-sky-600' : 'text-ink',
                )}
              >
                {parseYmd(date).getDate()}
              </span>
              {renderCell?.(info)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
