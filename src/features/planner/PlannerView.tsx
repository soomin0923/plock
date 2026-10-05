import React, { useState } from 'react';
import { BookHeart, CalendarDays, ChevronLeft, ChevronRight, FileDown, Plus, Tags, Wallet } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { PageHeader } from '../../app/Shell';
import { useIntent, useRouter } from '../../app/router';
import { Button, Card, IconButton, Segmented } from '../../components/ui';
import { MonthGrid, MonthNav } from '../../components/MonthGrid';
import { QuickAdd } from '../../components/QuickAdd';
import { useToast } from '../../components/Toast';
import { addDays, addMonths, formatKoreanDate, parseYmd, relativeDayLabel, today, weekDates, WEEKDAYS_KR } from '../../lib/date';
import { cx, won } from '../../lib/util';
import { categoryOf, eventsOnDate, isHabitDay, sortTasks, toggleHabitDate } from './helpers';
import { EventRow, HabitRow, parsePlanInput, TaskRow } from './rows';
import { PlanSheet, type PlanSheetState } from './forms';
import { TaskSection, toggleTask } from './TaskSection';
import { HabitSection } from './HabitSection';
import { CategoryManager } from './CategoryManager';
import { IcsSheet } from './IcsSheet';
import { SqlViewsSection } from '../sql/SqlViewsSection';

type Section = 'calendar' | 'tasks' | 'habits' | 'sql';

export function PlannerView() {
  const { data, prefs } = useData();
  const hasSqlViews = !!prefs.sql?.ddl.trim() && !!prefs.sql.queries.length;
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
      <QuickAdd className="mb-4" placeholder="예: 내일 오후 3시 팀 회의" examples={['금요일까지 보고서 제출', '다음 주 토요일 친구 생일', '매일 아침 스트레칭']} onSubmit={onQuick} />
      <Segmented<Section>
        value={section}
        onChange={setSection}
        className="mb-4 w-full sm:w-auto"
        options={[
          { value: 'calendar', label: '캘린더' },
          { value: 'tasks', label: '할 일' },
          { value: 'habits', label: '습관' },
          ...(hasSqlViews || section === 'sql' ? [{ value: 'sql' as Section, label: '내 쿼리' }] : []),
        ]}
      />
      {section === 'calendar' && <CalendarSection selected={selected} setSelected={setSelected} openSheet={setSheet} />}
      {section === 'tasks' && <TaskSection openSheet={setSheet} />}
      {section === 'habits' && <HabitSection openSheet={setSheet} />}
      {section === 'sql' && <SqlViewsSection openSheet={setSheet} />}

      <PlanSheet state={sheet} onClose={() => setSheet(null)} />
      <CategoryManager open={catOpen} onClose={() => setCatOpen(false)} />
      <IcsSheet open={icsOpen} onClose={() => setIcsOpen(false)} />
    </div>
  );
}

function CalendarSection({ selected, setSelected, openSheet }: { selected: string; setSelected: (d: string) => void; openSheet: (s: PlanSheetState) => void }) {
  const { data, prefs } = useData();
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const cats = data.categories;

  const taskCount = (d: string) => data.tasks.filter((t) => !t.done && t.dueDate === d).length;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] [&>*]:min-w-0">
      <Card className="p-3 sm:p-4">
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
                const evs = eventsOnDate(data.events, date);
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
          <WeekView selected={selected} setSelected={setSelected} mode={mode} setMode={setMode} openSheet={openSheet} />
        )}
      </Card>
      <div className="lg:sticky lg:top-6">
        <DayPanel date={selected} openSheet={openSheet} setSelected={setSelected} />
      </div>
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

function WeekView({ selected, setSelected, mode, setMode, openSheet }: { selected: string; setSelected: (d: string) => void; mode: 'month' | 'week'; setMode: (m: 'month' | 'week') => void; openSheet: (s: PlanSheetState) => void }) {
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
          const evs = eventsOnDate(data.events, d);
          const wd = parseYmd(d).getDay();
          return (
            <div
              key={d}
              onClick={() => setSelected(d)}
              className={cx('cursor-pointer rounded-xl border p-2 transition md:min-h-[220px]', d === selected ? 'border-primary bg-primary-soft' : 'border-line hover:bg-hover/60')}
            >
              <div className="mb-1.5 flex items-center justify-between md:block">
                <span className={cx('text-[13px] font-bold', wd === 0 ? 'text-expense' : wd === 6 ? 'text-sky-600' : 'text-ink-soft')}>
                  {WEEKDAYS_KR[wd]} <span className={cx('tabular', d === t && 'rounded-full bg-primary px-1.5 text-white')}>{parseYmd(d).getDate()}</span>
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

function DayPanel({ date, openSheet, setSelected }: { date: string; openSheet: (s: PlanSheetState) => void; setSelected: (d: string) => void }) {
  const { data, upsert } = useData();
  const { go } = useRouter();
  const d0 = today();
  const evs = eventsOnDate(data.events, date);
  const tasks = sortTasks(data.tasks.filter((t) => t.dueDate === date || (date === d0 && !t.done && t.dueDate && t.dueDate < d0)));
  const habits = date <= d0 ? data.habits.filter((h) => isHabitDay(h, date)).sort((a, b) => a.order - b.order) : [];
  const diary = data.diaries.find((x) => x.date === date);
  const spent = data.ledger.filter((l) => l.date === date && l.type === 'expense').reduce((s, l) => s + l.amount, 0);
  const rel = relativeDayLabel(date);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-primary">{rel || ' '}</p>
          <h3 className="text-lg font-bold tracking-tight">{formatKoreanDate(date)}</h3>
        </div>
        <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => openSheet({ mode: 'new', kind: 'event', date })}>
          일정
        </Button>
      </div>

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
