import React, { useMemo, useState } from 'react';
import type { LedgerEntry } from '../../types';
import { useData } from '../../data/DataProvider';
import { Card, SectionTitle, Segmented } from '../../components/ui';
import { addMonths, endOfMonth, monthKey, parseYmd, startOfMonth } from '../../lib/date';
import { compactWon, cx, won } from '../../lib/util';
import { entriesInMonth, ledgerCategoryOf, sumBy } from './helpers';

// Single-series charts in the theme color: category ranking (bars), daily spending
// (columns) and a 6-month trend. Every value shown on hover is also listed in the
// ranking / 내역 tab, so tooltips never gate information.

export function LedgerStats({ month }: { month: string }) {
  const { data } = useData();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const monthEntries = useMemo(() => entriesInMonth(data.ledger, month), [data.ledger, month]);
  const ofType = monthEntries.filter((e) => e.type === type);
  const total = sumBy(monthEntries, type);

  const byCategory = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    ofType.forEach((e) => {
      const cur = map.get(e.categoryId) || { amount: 0, count: 0 };
      map.set(e.categoryId, { amount: cur.amount + e.amount, count: cur.count + 1 });
    });
    return Array.from(map.entries())
      .map(([id, v]) => ({ cat: ledgerCategoryOf(data.ledgerCategories, id), ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [ofType, data.ledgerCategories]);

  const max = byCategory[0]?.amount || 1;

  return (
    <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Card className="p-4 sm:p-5">
        <SectionTitle
          action={
            <Segmented<'expense' | 'income'>
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: 'expense', label: '지출' },
                { value: 'income', label: '수입' },
              ]}
            />
          }
        >
          카테고리별 {type === 'expense' ? '지출' : '수입'}
        </SectionTitle>
        <p className="mb-4 text-2xl font-bold tracking-tight">{won(total)}</p>
        {byCategory.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">이 달의 {type === 'expense' ? '지출' : '수입'} 기록이 없어요.</p>
        ) : (
          <ul className="space-y-3">
            {byCategory.map(({ cat, amount, count }) => (
              <li key={cat.id}>
                <div className="mb-1 flex items-baseline gap-2 text-sm">
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span className="font-semibold">{cat.name}</span>
                  <span className="text-[12px] text-muted">{count}건</span>
                  <span className="flex-1" />
                  <span className="font-semibold tabular">{won(amount)}</span>
                  <span className="w-10 text-right text-[12px] text-muted tabular">{Math.round((amount / (total || 1)) * 100)}%</span>
                </div>
                <div className="h-2.5 w-full">
                  {/* 4px rounded data-end, square at the baseline */}
                  <div className="h-full rounded-r-[4px] bg-primary" style={{ width: `${Math.max(1.5, (amount / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="space-y-4">
        <Card className="p-4 sm:p-5">
          <SectionTitle>일별 지출</SectionTitle>
          <DailyChart month={month} entries={monthEntries} />
        </Card>
        <Card className="p-4 sm:p-5">
          <SectionTitle>최근 6개월 지출</SectionTitle>
          <TrendChart month={month} all={data.ledger} />
        </Card>
      </div>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 0) return 10000;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

interface Bar {
  key: string;
  label: string;
  value: number;
  tip: string;
  accent?: boolean;
}

function ColumnChart({ bars, height = 160, xLabels }: { bars: Bar[]; height?: number; xLabels: (b: Bar, i: number) => string | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(...bars.map((b) => b.value)));
  const ticks = [0, top / 2, top];
  const peak = bars.reduce((m, b, i) => (b.value > (bars[m]?.value ?? -1) ? i : m), 0);
  return (
    <div className="relative">
      <div className="flex">
        <div className="relative mr-2 w-9 flex-none text-right text-[11px] text-muted tabular" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: height - (t / top) * height }}>
              {compactWon(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: height - (t / top) * height }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {bars.map((b, i) => {
              const h = (b.value / top) * height;
              return (
                <button
                  key={b.key}
                  type="button"
                  className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  onClick={() => setHover(i)}
                  aria-label={b.tip}
                >
                  <span
                    className={cx('block w-full max-w-6 rounded-t-[4px] transition', b.accent ? 'bg-primary' : 'bg-primary/45', hover === i && 'brightness-110', b.value === 0 && 'opacity-0')}
                    style={{ height: Math.max(b.value ? 2 : 0, h) }}
                  />
                  {i === peak && b.value > 0 && hover === null && (
                    <span className="pointer-events-none absolute -translate-y-full whitespace-nowrap pb-0.5 text-[11px] font-semibold text-ink-soft" style={{ bottom: h }}>
                      {compactWon(b.value)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {hover !== null && bars[hover] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center text-white shadow-lg"
              style={{ left: `${((hover + 0.5) / bars.length) * 100}%`, top: Math.max(0, height - (bars[hover].value / top) * height - 6) }}
            >
              <span className="block text-[13px] font-bold tabular">{won(bars[hover].value)}</span>
              <span className="block text-[11px] text-white/70">{bars[hover].label}</span>
            </div>
          )}
        </div>
      </div>
      <div className="ml-11 mt-1.5 flex text-[11px] text-muted">
        {bars.map((b, i) => (
          <span key={b.key} className="flex-1 text-center tabular">
            {xLabels(b, i)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DailyChart({ month, entries }: { month: string; entries: LedgerEntry[] }) {
  const last = parseYmd(endOfMonth(month)).getDate();
  const mk = monthKey(month);
  const bars: Bar[] = Array.from({ length: last }, (_, i) => {
    const d = `${mk}-${String(i + 1).padStart(2, '0')}`;
    const value = entries.filter((e) => e.date === d && e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { key: d, label: `${parseYmd(d).getMonth() + 1}월 ${i + 1}일`, value, tip: `${i + 1}일 지출 ${won(value)}`, accent: true };
  });
  const spentDays = bars.filter((b) => b.value > 0).length;
  const total = bars.reduce((s, b) => s + b.value, 0);
  return (
    <>
      <ColumnChart bars={bars} xLabels={(_, i) => (i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : null)} />
      <p className="mt-3 text-[13px] text-muted">
        지출한 날 {spentDays}일 · 하루 평균 {won(spentDays ? total / spentDays : 0)}
      </p>
    </>
  );
}

function TrendChart({ month, all }: { month: string; all: LedgerEntry[] }) {
  const bars: Bar[] = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(startOfMonth(month), i - 5);
    const value = sumBy(entriesInMonth(all, m), 'expense');
    const d = parseYmd(m);
    return { key: m, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월`, value, tip: `${d.getMonth() + 1}월 지출 ${won(value)}`, accent: i === 5 };
  });
  return <ColumnChart height={120} bars={bars} xLabels={(b) => `${parseYmd(b.key).getMonth() + 1}월`} />;
}
