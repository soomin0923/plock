import React, { useState } from 'react';
import { BookHeart, CalendarDays, ChevronLeft, ChevronRight, FileDown, Pencil, Plus, Tags, Wallet } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import type { PlannerEvent } from '../../types';
import { PageHeader } from '../../app/Shell';
import { useIntent, useRouter } from '../../app/router';
import { Button, Card, IconButton, Segmented } from '../../components/ui';
import { MonthGrid, MonthNav } from '../../components/MonthGrid';
import { QuickAdd } from '../../components/QuickAdd';
import { useToast } from '../../components/Toast';
import { addDays, addMonths, formatKoreanDate, hmToMinutes, parseYmd, relativeDayLabel, today, weekDates, WEEKDAYS_KR } from '../../lib/date';
import { holidayName } from '../../lib/holidays';
import { cx, won } from '../../lib/util';
import { categoryOf, eventsOnDate, isHabitDay, sortCategories, sortTasks, toggleHabitDate } from './helpers';
import { EventRow, HabitRow, parsePlanInput, TaskRow } from './rows';
import { blankTask, PlanSheet, type PlanSheetState } from './forms';
import { TaskSection, toggleTask } from './TaskSection';
import { HabitSection } from './HabitSection';
import { CategoryManager } from './CategoryManager';
import { IcsSheet } from './IcsSheet';

type Section = 'calendar' | 'tasks' | 'habits';

export function PlannerView() {
  const { data } = useData();
  const toast = useToast();
  const [section, setSection] = useState<Section>('calendar');
  const [selected, setSelected] = useState(today());
  const [sheet, setSheet] = useState<PlanSheetState>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [icsOpen, setIcsOpen] = useState(false);

  useIntent((i) => {
    if (i.type === 'planner-date') {
      setSection('calendar');
      setSelected(i.date);
    }
    if (i.type === 'planner-section') setSection(i.section);
  });

  const onQuick = async (text: string, useAi: boolean) => {
    const draft = await parsePlanInput(text, useAi, data.categories, (m) => toast(m, 'error'));
    setSheet({ mode: 'new', kind: draft.kind, date: draft.startDate, draft });
  };

  return (
    <div>
      <PageHeader
        title="플래너"
        actions={
          <>
            <IconButton label="카테고리 관리" onClick={() => setCatOpen(true)}>
              <Tags className="h-5 w-5" />
            </IconButton>
            <IconButton label="캘린더 파일 가져오기/내보내기" onClick={() => setIcsOpen(true)}>
              <FileDown className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      <QuickAdd className="mb-4" placeholder="예: 내일 오후 3시 팀 회의" onSubmit={onQuick} />
      <Segmented<Section>
        value={section}
        onChange={setSection}
        className="mb-4 w-full sm:w-auto"
        options={[
          { value: 'calendar', label: '캘린더' },
          { value: 'tasks', label: '할 일' },
          { value: 'habits', label: '습관' },
        ]}
      />
      {section === 'calendar' && <CalendarSection selected={selected} setSelected={setSelected} openSheet={setSheet} onEditCategories={() => setCatOpen(true)} />}
      {section === 'tasks' && <TaskSection openSheet={setSheet} />}
      {section === 'habits' && <HabitSection openSheet={setSheet} />}

      <PlanSheet state={sheet} onClose={() => setSheet(null)} />
      <CategoryManager open={catOpen} onClose={() => setCatOpen(false)} />
      <IcsSheet open={icsOpen} onClose={() => setIcsOpen(false)} />
    </div>
  );
}

function CalendarSection({ selected, setSelected, openSheet, onEditCategories }: { selected: string; setSelected: (d: string) => void; openSheet: (s: PlanSheetState) => void; onEditCategories: () => void }) {
  const { data, prefs } = useData();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [catFilter, setCatFilter] = useState<string>('all');
  const cats = data.categories;
  const pass = (categoryId?: string) => catFilter === 'all' || categoryId === catFilter;
  const events = catFilter === 'all' ? data.events : data.events.filter((e) => pass(e.categoryId));

  const taskCount = (d: string) => data.tasks.filter((t) => !t.done && t.dueDate === d && pass(t.categoryId)).length;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
      <Card className="p-3 sm:p-4">
        <CategoryChips value={catFilter} onChange={setCatFilter} onEdit={onEditCategories} />
        {mode === 'month' ? (
          <>
            <MonthNav
              month={selected}
              onPrev={() => setSelected(addMonths(selected, -1))}
              onNext={() => setSelected(addMonths(selected, 1))}
              onToday={() => setSelected(today())}
              right={<ModeToggle mode={mode} setMode={setMode} />}
            />
            <MonthGrid
              month={selected}
              selected={selected}
              onSelect={setSelected}
              weekStartsOn={prefs.weekStartsOn}
              renderCell={({ date }) => {
                const evs = eventsOnDate(events, date);
                const tc = taskCount(date);
                return (
                  <span className="flex min-w-0 flex-col gap-[2px]">
                    {evs.slice(0, 3).map((e, i) => {
                      const c = categoryOf(cats, e.categoryId);
                      return (
                        <span
                          key={e.id}
                          className={cx('truncate rounded-[4px] px-1 text-[10px] font-medium leading-[15px] sm:text-[11px] sm:leading-4', i === 2 && 'hidden sm:block', e.done && 'line-through opacity-60')}
                          style={{ background: `${c.color}22`, color: c.color }}
                        >
                          {e.title}
                        </span>
                      );
                    })}
                    {evs.length > 2 && <span className="px-1 text-[10px] font-semibold text-muted sm:hidden">+{evs.length - 2}</span>}
                    {evs.length > 3 && <span className="hidden px-1 text-[11px] font-semibold text-muted sm:block">+{evs.length - 3}</span>}
                    {tc > 0 && <span className="px-1 text-[10px] font-semibold text-primary">✓{tc}</span>}
                  </span>
                );
              }}
            />
          </>
        ) : (
          <WeekView events={events} selected={selected} setSelected={setSelected} mode={mode} setMode={setMode} openSheet={openSheet} />
        )}
      </Card>
      <div className="lg:sticky lg:top-6">
        <DayPanel date={selected} openSheet={openSheet} setSelected={setSelected} catFilter={catFilter} />
      </div>
    </div>
  );
}

/** 전체 + each category; filters what the calendar and the day panel show. */
function CategoryChips({ value, onChange, onEdit }: { value: string; onChange: (id: string) => void; onEdit: () => void }) {
  const { data } = useData();
  const cats = sortCategories(data.categories);
  return (
    <div className="drag-scroll no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="카테고리로 보기">
      {[{ id: 'all', name: '전체', color: '' }, ...cats].map((c) => {
        const active = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active && c.id !== 'all' ? 'all' : c.id)}
            className={cx('flex flex-none items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition', active ? 'border-transparent' : 'border-line-strong text-ink-soft hover:bg-hover')}
            style={active ? { background: c.color || 'var(--color-ink)', color: c.color ? '#fff' : 'var(--color-card)' } : undefined}
          >
            {c.color && !active && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
            {c.name}
          </button>
        );
      })}
      <button type="button" onClick={onEdit} aria-label="카테고리 편집 (이름·색)" title="카테고리 편집" className="flex flex-none items-center rounded-full px-2 text-muted hover:bg-hover hover:text-primary">
        <Pencil className="h-4 w-4" />
      </button>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: 'month' | 'week'; setMode: (m: 'month' | 'week') => void }) {
  return (
    <Segmented
      size="sm"
      value={mode}
      onChange={setMode}
      options={[
        { value: 'month', label: '월' },
        { value: 'week', label: '주' },
      ]}
    />
  );
}

function WeekView({ events, selected, setSelected, mode, setMode, openSheet }: { events: PlannerEvent[]; selected: string; setSelected: (d: string) => void; mode: 'month' | 'week'; setMode: (m: 'month' | 'week') => void; openSheet: (s: PlanSheetState) => void }) {
  const { data, prefs } = useData();
  const days = weekDates(selected, prefs.weekStartsOn);
  const t = today();
  return (
    <>
      <div className="mb-3 flex items-center gap-1">
        <IconButton label="이전 주" onClick={() => setSelected(addDays(selected, -7))}>
          <ChevronLeft className="h-5 w-5" />
        </IconButton>
        <h3 className="text-center text-lg font-bold tracking-tight tabular">
          {parseYmd(days[0]).getMonth() + 1}.{parseYmd(days[0]).getDate()} – {parseYmd(days[6]).getMonth() + 1}.{parseYmd(days[6]).getDate()}
        </h3>
        <IconButton label="다음 주" onClick={() => setSelected(addDays(selected, 7))}>
          <ChevronRight className="h-5 w-5" />
        </IconButton>
        <div className="flex-1" />
        <ModeToggle mode={mode} setMode={setMode} />
      </div>
      <div className="grid gap-2 md:grid-cols-7 md:gap-1.5">
        {days.map((d) => {
          const evs = eventsOnDate(events, d);
          const wd = parseYmd(d).getDay();
          const holiday = holidayName(d);
          return (
            <div
              key={d}
              onClick={() => setSelected(d)}
              className={cx('cursor-pointer rounded-xl border p-2 transition md:min-h-[220px]', d === selected ? 'border-primary bg-primary-soft' : 'border-line hover:bg-hover/60')}
            >
              <div className="mb-1.5 flex items-center justify-between md:block">
                <span className={cx('text-[13px] font-bold', wd === 0 || holiday ? 'text-expense' : wd === 6 ? 'text-sky-600' : 'text-ink-soft')}>
                  {WEEKDAYS_KR[wd]} <span className={cx('tabular', d === t && 'rounded-full bg-primary px-1.5 text-on-primary')}>{parseYmd(d).getDate()}</span>
                  {holiday && <span className="ml-1 text-[11px] font-medium">{holiday}</span>}
                </span>
                <button
                  className="rounded-md p-0.5 text-faint hover:bg-card hover:text-primary md:hidden"
                  aria-label="이 날 일정 추가"
                  onClick={(e) => {
                    e.stopPropagation();
                    openSheet({ mode: 'new', kind: 'event', date: d });
                  }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                {evs.length === 0 && <p className="text-[12px] text-faint md:hidden">일정 없음</p>}
                {evs.map((e) => {
                  const c = categoryOf(data.categories, e.categoryId);
                  return (
                    <button
                      key={e.id}
                      onClick={(x) => {
                        x.stopPropagation();
                        openSheet({ mode: 'edit-event', item: e });
                      }}
                      className={cx('block w-full rounded-md px-1.5 py-1 text-left text-[12px] leading-tight', e.done && 'opacity-50')}
                      style={{ background: `${c.color}1f`, color: c.color }}
                    >
                      {e.startTime && <span className="mr-1 font-semibold tabular">{e.startTime}</span>}
                      <span className="font-medium text-ink">{e.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function DayPanel({ date, openSheet, setSelected, catFilter }: { date: string; openSheet: (s: PlanSheetState) => void; setSelected: (d: string) => void; catFilter: string }) {
  const { data, upsert } = useData();
  const { go } = useRouter();
  const toast = useToast();
  const d0 = today();
  const pass = (categoryId?: string) => catFilter === 'all' || categoryId === catFilter;
  const evs = eventsOnDate(data.events, date).filter((e) => pass(e.categoryId));
  const tasks = sortTasks(data.tasks.filter((t) => pass(t.categoryId) && (t.dueDate === date || (date === d0 && !t.done && t.dueDate && t.dueDate < d0))));
  const habits = date <= d0 && catFilter === 'all' ? data.habits.filter((h) => isHabitDay(h, date)).sort((a, b) => a.order - b.order) : [];
  const diary = data.diaries.find((x) => x.date === date);
  const spent = data.ledger.filter((l) => l.date === date && l.type === 'expense').reduce((s, l) => s + l.amount, 0);
  const rel = relativeDayLabel(date);
  const holiday = holidayName(date);
  const timed = evs.filter((e) => e.startTime && e.startDate === date);
  const [draft, setDraft] = useState('');

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    upsert('tasks', blankTask({ title, dueDate: date, categoryId: catFilter === 'all' ? undefined : catFilter }));
    setDraft('');
    toast(`${formatKoreanDate(date)} 할 일에 추가했어요.`);
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-primary">
            {rel || ' '}
            {holiday && <span className="ml-1.5 text-expense">{holiday}</span>}
          </p>
          <h3 className="text-lg font-bold tracking-tight">{formatKoreanDate(date)}</h3>
        </div>
        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openSheet({ mode: 'new', kind: 'event', date })}>
          일정
        </Button>
      </div>

      <form onSubmit={addTask} className="mb-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="+ 이 날 할 일 — 쓰고 엔터"
          aria-label="이 날 할 일 추가"
          enterKeyHint="done"
          className="w-full rounded-xl border border-dashed border-line-strong bg-transparent px-3 py-2 text-[14px] placeholder:text-faint focus:border-primary focus:outline-none"
        />
      </form>

      {timed.length > 0 && <Timetable events={timed} onOpen={(e) => openSheet({ mode: 'edit-event', item: e })} />}

      {evs.length === 0 && tasks.length === 0 && habits.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center text-sm text-muted">
          <CalendarDays className="mb-2 h-8 w-8 text-faint" />
          계획이 없는 날이에요
        </div>
      ) : (
        <div className="space-y-3">
          {evs.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[12px] font-bold text-muted">일정</p>
              {evs.map((e) => (
                <EventRow key={e.id} e={e} cats={data.categories} date={date} onClick={() => openSheet({ mode: 'edit-event', item: e })} onToggle={() => upsert('events', { ...e, done: !e.done })} />
              ))}
            </div>
          )}
          {tasks.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[12px] font-bold text-muted">할 일</p>
              {tasks.map((t) => (
                <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => openSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
              ))}
            </div>
          )}
          {habits.length > 0 && (
            <div>
              <p className="mb-1 px-2 text-[12px] font-bold text-muted">습관</p>
              {habits.map((h) => (
                <HabitRow key={h.id} h={h} date={date} compact onToggle={() => upsert('habits', toggleHabitDate(h, date))} onClick={() => openSheet({ mode: 'edit-habit', item: h })} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line pt-3">
        <button
          onClick={() => go('diary', diary ? { type: 'diary-open', id: diary.id } : { type: 'diary-write', date })}
          className="flex items-center gap-2 rounded-xl bg-hover/70 px-3 py-2.5 text-left text-[13px] hover:bg-hover"
        >
          <BookHeart className="h-4 w-4 flex-none text-primary" />
          <span className="min-w-0 truncate font-semibold">{diary ? diary.title || '일기 보기' : '일기 쓰기'}</span>
        </button>
        <button onClick={() => go('ledger', { type: 'ledger-add', date })} className="flex items-center gap-2 rounded-xl bg-hover/70 px-3 py-2.5 text-left text-[13px] hover:bg-hover">
          <Wallet className="h-4 w-4 flex-none text-primary" />
          <span className="min-w-0 truncate font-semibold">{spent ? `지출 ${won(spent)}` : '지출 기록'}</span>
        </button>
      </div>
      {date !== d0 && (
        <button onClick={() => setSelected(d0)} className="mt-2 w-full text-center text-[13px] font-semibold text-muted hover:text-ink">
          오늘로 이동
        </button>
      )}
    </Card>
  );
}

/** Time blocks of the day on a vertical hour scale (only the hours that matter). */
function Timetable({ events, onOpen }: { events: PlannerEvent[]; onOpen: (e: PlannerEvent) => void }) {
  const { data } = useData();
  const blocks = events
    .map((e) => {
      const start = hmToMinutes(e.startTime!);
      const rawEnd = e.endTime && e.endDate === e.startDate ? hmToMinutes(e.endTime) : start + 60;
      return { e, start, end: Math.max(rawEnd, start + 30) };
    })
    .sort((a, b) => a.start - b.start);
  const from = Math.floor(Math.min(...blocks.map((b) => b.start)) / 60);
  const to = Math.min(24, Math.ceil(Math.max(...blocks.map((b) => b.end)) / 60));
  const hours = Array.from({ length: Math.max(1, to - from) }, (_, i) => from + i);
  const PX = 36; // per hour
  // Overlapping blocks are laid out side by side.
  const lanes: number[] = [];
  const placed = blocks.map((b) => {
    let lane = lanes.findIndex((endAt) => endAt <= b.start);
    if (lane < 0) lane = lanes.push(0) - 1;
    lanes[lane] = b.end;
    return { ...b, lane };
  });
  const laneCount = Math.max(1, lanes.length);
  return (
    <div className="mb-3">
      <p className="mb-1 px-2 text-[12px] font-bold text-muted">시간표</p>
      <div className="relative ml-9 border-l border-line" style={{ height: hours.length * PX }}>
        {hours.map((h, i) => (
          <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * PX }}>
            <span className="absolute -left-9 -top-2 w-7 text-right text-[11px] text-faint tabular">{h}시</span>
          </div>
        ))}
        {placed.map(({ e, start, end, lane }) => {
          const c = categoryOf(data.categories, e.categoryId);
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onOpen(e)}
              className={cx('absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[12px] leading-tight', e.done && 'opacity-50')}
              style={{
                top: ((start - from * 60) / 60) * PX + 1,
                height: ((end - start) / 60) * PX - 2,
                left: `calc(${(lane / laneCount) * 100}% + 4px)`,
                width: `calc(${100 / laneCount}% - 6px)`,
                background: `${c.color}26`,
                borderLeft: `3px solid ${c.color}`,
              }}
            >
              <span className="font-semibold tabular" style={{ color: c.color }}>
                {e.startTime}
              </span>{' '}
              <span className="font-medium text-ink">{e.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
