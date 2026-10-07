import React, { useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, BookHeart, CalendarDays, Cloud, GripVertical, LayoutGrid, Maximize2, Minimize2, Pause, PenLine, Play, Plus, SkipBack, SkipForward, Star, Sticker as StickerIcon, X } from 'lucide-react';
import type { TodayWidget } from '../../types';
import { useData } from '../../data/DataProvider';
import { useRouter } from '../../app/router';
import { useOpenAuth } from '../../app/authSheet';
import { Button, Card, SectionTitle } from '../../components/ui';
import { QuickAdd } from '../../components/QuickAdd';
import { MonthGrid } from '../../components/MonthGrid';
import { useToast } from '../../components/Toast';
import { addDays, formatKoreanDate, formatMonth, monthKey, parseYmd, relativeDayLabel, today } from '../../lib/date';
import { cx, won } from '../../lib/util';
import { categoryOf, eventsOnDate, isHabitDay, sortTasks, toggleHabitDate } from '../planner/helpers';
import { EventRow, HabitRow, parsePlanInput, TaskRow } from '../planner/rows';
import { PlanSheet, type PlanSheetState } from '../planner/forms';
import { toggleTask } from '../planner/TaskSection';
import { DiaryPage } from '../diary/DiaryPage';
import { sortDiaries } from '../diary/DiaryViewer';
import { entriesInMonth, sumBy } from '../ledger/helpers';
import { blankNote } from '../dump/DumpView';
import { useMusic } from '../music/MusicProvider';
import { Vinyl } from '../music/MusicWidgets';
import { MOODS } from '../../data/defaults';
import { StickerBoard } from './HomeStickers';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '늦은 밤이에요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '좋은 오후예요';
  return '오늘 하루 수고했어요';
}

type Ctx = { openSheet: (s: PlanSheetState) => void };

interface WidgetDef {
  title: string;
  description: string;
  render: (ctx: Ctx) => React.ReactNode;
}

// ------------------------------------------------------------------ widget registry

const WIDGETS: Record<string, WidgetDef> = {
  quickadd: { title: '빠른 입력', description: '말하듯 적으면 일정·할 일로 정리', render: (c) => <QuickAddWidget {...c} /> },
  events: { title: '오늘 일정', description: '오늘 잡힌 일정', render: (c) => <EventsWidget {...c} /> },
  tasks: { title: '할 일', description: '오늘까지 할 일 + 기한 없는 일', render: (c) => <TasksWidget {...c} /> },
  habits: { title: '오늘의 습관', description: '오늘 체크할 습관', render: (c) => <HabitsWidget {...c} /> },
  diary: { title: '오늘의 일기', description: '오늘 쓴 일기 / 바로 쓰기', render: () => <DiaryWidget /> },
  spending: { title: '오늘 쓴 돈', description: '오늘 지출과 이번 달 합계', render: () => <SpendingWidget /> },
  upcoming: { title: '다가오는 일정', description: '앞으로 6일', render: (c) => <UpcomingWidget {...c} /> },
  dump: { title: '쏟아내기', description: '한 줄 메모와 최근 메모', render: () => <DumpWidget /> },
  music: { title: 'LP 플레이어', description: '음악 재생·다음 곡', render: () => <MusicWidget /> },
  budget: { title: '이번 달 가계부', description: '수입·지출·예산', render: () => <BudgetWidget /> },
  calendar: { title: '미니 달력', description: '이번 달 일정이 있는 날', render: () => <CalendarWidget /> },
};

export const DEFAULT_WIDGETS: TodayWidget[] = [
  { id: 'quickadd', wide: true },
  { id: 'events' },
  { id: 'diary' },
  { id: 'tasks' },
  { id: 'spending' },
  { id: 'habits' },
  { id: 'upcoming' },
];

export function TodayView() {
  const { user, prefs, savePrefs } = useData();
  const openAuth = useOpenAuth();
  const [sheet, setSheet] = useState<PlanSheetState>(null);
  const [editing, setEditing] = useState(false);
  const [stickering, setStickering] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const d0 = today();
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : '');

  const layout = (prefs.todayWidgets || DEFAULT_WIDGETS).filter((w) => WIDGETS[w.id]);
  const save = (next: TodayWidget[]) => savePrefs({ todayWidgets: next });
  const missing = Object.keys(WIDGETS).filter((id) => !layout.some((w) => w.id === id));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= layout.length) return;
    const next = [...layout];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };
  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = layout.findIndex((w) => w.id === dragId);
    const to = layout.findIndex((w) => w.id === targetId);
    const next = [...layout];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    save(next);
  };

  return (
    <StickerBoard active={stickering} onExit={() => setStickering(false)}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-primary">{formatKoreanDate(d0, { year: true })}</p>
          <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight lg:text-[28px]">
            {greeting()}
            {name && <span className="text-ink-soft">, {name}님</span>}
          </h2>
        </div>
        <div className="flex gap-1">
          {!editing && (
            <Button size="sm" variant="ghost" icon={<StickerIcon className="h-4 w-4" />} onClick={() => setStickering(true)}>
              스티커
            </Button>
          )}
          <Button size="sm" variant={editing ? 'primary' : 'ghost'} icon={editing ? undefined : <LayoutGrid className="h-4 w-4" />} onClick={() => setEditing((v) => !v)}>
            {editing ? '완료' : '위젯 편집'}
          </Button>
        </div>
      </div>

      {!user && !editing && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-amber-200 bg-amber-50/70 p-4">
          <Cloud className="h-6 w-6 flex-none text-amber-600" />
          <p className="min-w-0 flex-1 text-sm leading-relaxed text-ink-soft">
            지금은 <b>게스트 모드</b>예요. 기록이 이 브라우저에만 저장돼요. 로그인하면 휴대폰·PC에서 함께 쓸 수 있어요.
          </p>
          <Button size="sm" variant="primary" onClick={openAuth}>
            로그인 / 가입
          </Button>
        </Card>
      )}

      {editing && (
        <Card className="mb-4 p-4">
          <p className="text-[15px] font-bold">위젯 편집</p>
          <p className="mt-0.5 text-[13px] text-muted">PC에서는 끌어서, 휴대폰에서는 ↑↓로 순서를 바꿔요. ⤢ 는 넓게/좁게(PC), ✕ 는 빼기. 배치는 계정에 저장돼요.</p>
          {missing.length > 0 && (
            <>
              <p className="mb-1.5 mt-3 text-[13px] font-semibold text-ink-soft">추가할 수 있는 위젯</p>
              <div className="flex flex-wrap gap-2">
                {missing.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => save([...layout, { id }])}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 py-2 text-left text-[13px] hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-4 w-4 flex-none" />
                    <span>
                      <span className="block font-semibold">{WIDGETS[id].title}</span>
                      <span className="block text-[12px] text-muted">{WIDGETS[id].description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="ghost" onClick={() => save(DEFAULT_WIDGETS)}>
              기본 배치로
            </Button>
          </div>
        </Card>
      )}

      {layout.length === 0 && !editing && (
        <button onClick={() => setEditing(true)} className="w-full rounded-2xl border-2 border-dashed border-line-strong py-10 text-center text-muted hover:border-primary hover:text-primary">
          위젯이 없어요. 눌러서 추가해 보세요.
        </button>
      )}

      <div className="grid grid-flow-row-dense items-start gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        {layout.map((w, i) => (
          <div
            key={w.id}
            className={cx(w.wide && 'lg:col-span-2', editing && 'relative rounded-2xl outline-2 outline-offset-2 outline-dashed outline-primary-light', overId === w.id && dragId !== w.id && 'outline-primary')}
            draggable={editing}
            onDragStart={(e) => {
              setDragId(w.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e) => {
              if (!dragId) return;
              e.preventDefault();
              setOverId(w.id);
            }}
            onDragLeave={() => setOverId((o) => (o === w.id ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              dropOn(w.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            {editing && (
              <div className="flex items-center gap-1 rounded-t-2xl bg-primary-soft px-2 py-1.5">
                <GripVertical className="hidden h-4 w-4 cursor-grab text-primary lg:block" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-primary">{WIDGETS[w.id].title}</span>
                <EditButton label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </EditButton>
                <EditButton label="아래로" onClick={() => move(i, 1)} disabled={i === layout.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </EditButton>
                <EditButton label={w.wide ? '좁게' : '넓게'} className="hidden lg:flex" onClick={() => save(layout.map((x) => (x.id === w.id ? { ...x, wide: !x.wide || undefined } : x)))}>
                  {w.wide ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </EditButton>
                <EditButton label={`${WIDGETS[w.id].title} 빼기`} onClick={() => save(layout.filter((x) => x.id !== w.id))}>
                  <X className="h-4 w-4" />
                </EditButton>
              </div>
            )}
            <div className={cx(editing && 'pointer-events-none select-none opacity-70')} aria-hidden={editing || undefined}>
              {WIDGETS[w.id].render({ openSheet: setSheet })}
            </div>
          </div>
        ))}
      </div>

      <PlanSheet state={sheet} onClose={() => setSheet(null)} />
    </StickerBoard>
  );
}

function EditButton({ label, onClick, disabled, children, className }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cx('flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-card disabled:opacity-30', className)}>
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ widgets

function QuickAddWidget({ openSheet }: Ctx) {
  const { data } = useData();
  const toast = useToast();
  return (
    <QuickAdd
      placeholder="일정·할 일·습관을 말하듯 적어 보세요"
      onSubmit={async (text, useAi) => {
        const draft = await parsePlanInput(text, useAi, data.categories, (m) => toast(m, 'error'));
        openSheet({ mode: 'new', kind: draft.kind, date: draft.startDate, draft });
      }}
    />
  );
}

function MoreLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted hover:text-ink">
      {label} <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

function EventsWidget({ openSheet }: Ctx) {
  const { data, upsert } = useData();
  const { go } = useRouter();
  const d0 = today();
  const events = eventsOnDate(data.events, d0);
  return (
    <Card className="p-4">
      <SectionTitle action={<MoreLink label="플래너" onClick={() => go('planner')} />}>오늘 일정</SectionTitle>
      {events.length === 0 ? (
        <button onClick={() => openSheet({ mode: 'new', kind: 'event', date: d0 })} className="flex w-full items-center gap-2 rounded-xl px-2 py-3 text-sm text-muted hover:bg-hover">
          <CalendarDays className="h-4 w-4" /> 오늘은 일정이 없어요 · 추가하기
        </button>
      ) : (
        events.map((e) => <EventRow key={e.id} e={e} cats={data.categories} date={d0} onClick={() => openSheet({ mode: 'edit-event', item: e })} onToggle={() => upsert('events', { ...e, done: !e.done })} />)
      )}
    </Card>
  );
}

function TasksWidget({ openSheet }: Ctx) {
  const { data, upsert } = useData();
  const d0 = today();
  const tasks = sortTasks(data.tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= d0));
  const undated = sortTasks(data.tasks.filter((t) => !t.done && !t.dueDate)).slice(0, 5);
  const doneToday = data.tasks.filter((t) => t.done && t.dueDate === d0);
  const row = (t: (typeof tasks)[number]) => <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => openSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />;
  return (
    <Card className="p-4">
      <SectionTitle
        action={
          <button onClick={() => openSheet({ mode: 'new', kind: 'task', date: d0 })} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted hover:text-ink">
            <Plus className="h-3.5 w-3.5" /> 추가
          </button>
        }
      >
        할 일 {tasks.length > 0 && <span className="text-muted">{tasks.length}</span>}
      </SectionTitle>
      {tasks.length === 0 && doneToday.length === 0 && undated.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted">오늘까지 할 일을 모두 끝냈어요 🎉</p>
      ) : (
        <>
          {tasks.length === 0 && doneToday.length === 0 && <p className="px-2 pb-1 text-[13px] text-muted">오늘 마감인 일은 없어요. 여유 있을 때 해 볼까요?</p>}
          {tasks.map(row)}
          {doneToday.map(row)}
          {undated.length > 0 && (tasks.length > 0 || doneToday.length > 0) && <p className="mt-2 px-2 text-[12px] font-bold text-muted">기한 없음</p>}
          {undated.map(row)}
        </>
      )}
    </Card>
  );
}

function HabitsWidget({ openSheet }: Ctx) {
  const { data, upsert } = useData();
  const { go } = useRouter();
  const d0 = today();
  const habits = data.habits.filter((h) => isHabitDay(h, d0)).sort((a, b) => a.order - b.order);
  const done = habits.filter((h) => h.doneDates.includes(d0)).length;
  return (
    <Card className="p-4">
      <SectionTitle action={habits.length > 0 && <span className="text-[13px] font-semibold text-muted tabular">{done}/{habits.length}</span>}>오늘의 습관</SectionTitle>
      {habits.length === 0 ? (
        <button onClick={() => go('planner', { type: 'planner-section', section: 'habits' })} className="w-full rounded-xl px-2 py-3 text-left text-sm text-muted hover:bg-hover">
          오늘 할 습관이 없어요 · 습관 만들기
        </button>
      ) : (
        <div className="grid gap-x-3 sm:grid-cols-2">
          {habits.map((h) => (
            <HabitRow key={h.id} h={h} date={d0} compact onToggle={() => upsert('habits', toggleHabitDate(h, d0))} onClick={() => openSheet({ mode: 'edit-habit', item: h })} />
          ))}
        </div>
      )}
    </Card>
  );
}

function DiaryWidget() {
  const { data } = useData();
  const { go } = useRouter();
  const d0 = today();
  const diary = sortDiaries(data.diaries).find((d) => d.date === d0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-3">
        <h3 className="text-[15px] font-bold tracking-tight">오늘의 일기</h3>
        {diary && <MoreLink label="열기" onClick={() => go('diary', { type: 'diary-open', id: diary.id })} />}
      </div>
      {diary ? (
        <button onClick={() => go('diary', { type: 'diary-open', id: diary.id })} className="block w-full px-4 pb-4 text-left">
          <div className="relative max-h-64 overflow-hidden rounded-xl border border-line">
            <DiaryPage entry={diary} thumbnail className="pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />
          </div>
        </button>
      ) : (
        <div className="px-4 pb-4">
          <button
            onClick={() => go('diary', { type: 'diary-write', date: d0 })}
            className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-4 py-7 text-muted transition hover:border-primary hover:text-primary"
          >
            <PenLine className="h-6 w-6" />
            <span className="font-semibold">오늘 하루를 사진·스티커와 함께 남겨 보세요</span>
          </button>
          <RecentMoods />
        </div>
      )}
    </Card>
  );
}

function SpendingWidget() {
  const { data, prefs } = useData();
  const { go } = useRouter();
  const d0 = today();
  const todaySpent = sumBy(data.ledger.filter((l) => l.date === d0), 'expense');
  const monthSpent = sumBy(entriesInMonth(data.ledger, d0), 'expense');
  return (
    <Card className="p-4">
      <SectionTitle
        action={
          <Button size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => go('ledger', { type: 'ledger-add', date: d0 })}>
            지출 기록
          </Button>
        }
      >
        오늘 쓴 돈
      </SectionTitle>
      <button onClick={() => go('ledger')} className="flex w-full items-end justify-between text-left">
        <span className="text-[28px] font-bold tracking-tight">{won(todaySpent)}</span>
        <span className="pb-1.5 text-[13px] text-muted">
          이번 달 {won(monthSpent)}
          {prefs.monthlyBudget ? ` / 예산 ${Math.round((monthSpent / prefs.monthlyBudget) * 100)}%` : ''}
        </span>
      </button>
    </Card>
  );
}

function UpcomingWidget({ openSheet }: Ctx) {
  const { data } = useData();
  const d0 = today();
  const upcoming = Array.from({ length: 6 }, (_, i) => addDays(d0, i + 1))
    .flatMap((d) => eventsOnDate(data.events, d).filter((e) => e.startDate === d).map((e) => ({ d, e })))
    .slice(0, 6);
  return (
    <Card className="p-4">
      <SectionTitle>다가오는 일정</SectionTitle>
      {upcoming.length === 0 && <p className="px-2 py-3 text-sm text-muted">앞으로 6일 동안 일정이 없어요.</p>}
      {upcoming.map(({ d, e }) => (
        <div key={e.id + d} className="flex items-center gap-3">
          <span className="w-12 flex-none text-[13px] font-semibold text-muted">{relativeDayLabel(d) || `${parseYmd(d).getMonth() + 1}/${parseYmd(d).getDate()}`}</span>
          <div className="min-w-0 flex-1">
            <EventRow e={e} cats={data.categories} onClick={() => openSheet({ mode: 'edit-event', item: e })} />
          </div>
        </div>
      ))}
    </Card>
  );
}

function DumpWidget() {
  const { data, upsert } = useData();
  const { go } = useRouter();
  const [text, setText] = useState('');
  const recent = data.notes
    .filter((n) => !n.done)
    .sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);
  return (
    <Card className="p-4">
      <SectionTitle action={<MoreLink label="쏟아내기" onClick={() => go('dump')} />}>쏟아내기</SectionTitle>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          upsert('notes', blankNote({ text: text.trim() }));
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="생각나는 대로 적고 엔터"
          aria-label="쏟아내기 빠른 입력"
          enterKeyHint="done"
          className="w-full rounded-xl border border-dashed border-line-strong bg-transparent px-3 py-2 text-[14px] placeholder:text-faint focus:border-primary focus:outline-none"
        />
      </form>
      <ul className="mt-2 space-y-0.5">
        {recent.map((n) => (
          <li key={n.id} className="flex items-center gap-2 px-1 py-1 text-[14px]">
            {n.starred ? <Star className="h-3.5 w-3.5 flex-none fill-amber-400 text-amber-400" /> : <span className="h-1.5 w-1.5 flex-none rounded-full bg-faint" />}
            <span className="truncate">{n.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MusicWidget() {
  const m = useMusic();
  return (
    <Card className="flex items-center gap-4 p-4">
      <button type="button" onClick={m.openSheet} aria-label="LP 플레이어 열기" className="rounded-full">
        <Vinyl size={76} spinning={m.playing} thumb={m.thumb} />
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold text-faint">LP 플레이어</p>
        <button type="button" onClick={m.openSheet} className="block w-full truncate text-left text-[15px] font-bold">
          {m.tracks.length ? m.title || '눌러서 켜기' : '판 올리기'}
        </button>
        <div className="mt-1 flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={m.prev} disabled={!m.tracks.length} aria-label="이전 곡" icon={<SkipBack className="h-4 w-4" />} />
          <Button size="sm" variant="soft" onClick={m.toggle} icon={m.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}>
            {m.playing ? '일시정지' : '재생'}
          </Button>
          <Button size="sm" variant="ghost" onClick={m.next} disabled={!m.tracks.length} aria-label="다음 곡" icon={<SkipForward className="h-4 w-4" />} />
        </div>
      </div>
    </Card>
  );
}

function BudgetWidget() {
  const { data, prefs } = useData();
  const { go } = useRouter();
  const d0 = today();
  const month = entriesInMonth(data.ledger, d0);
  const spent = sumBy(month, 'expense');
  const income = sumBy(month, 'income');
  const budget = prefs.monthlyBudget;
  const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
  return (
    <Card className="p-4">
      <SectionTitle action={<MoreLink label="가계부" onClick={() => go('ledger')} />}>{formatMonth(d0)} 가계부</SectionTitle>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[12px] text-muted">수입</p>
          <p className="font-bold text-income tabular">{won(income)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted">지출</p>
          <p className="font-bold text-expense tabular">{won(spent)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted">남은 돈</p>
          <p className="font-bold tabular">{won(income - spent)}</p>
        </div>
      </div>
      {budget ? (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-hover">
            <div className={cx('h-full rounded-full', spent > budget ? 'bg-expense' : 'bg-primary')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-[12px] text-muted tabular">
            예산 {won(budget)} 중 {Math.round((spent / budget) * 100)}%
          </p>
        </div>
      ) : (
        <p className="mt-3 text-[12px] text-muted">가계부 설정에서 월 예산을 정하면 진행률이 보여요.</p>
      )}
    </Card>
  );
}

function CalendarWidget() {
  const { data, prefs } = useData();
  const { go } = useRouter();
  const d0 = today();
  return (
    <Card className="p-3">
      <p className="mb-1 px-1 text-[15px] font-bold">{formatMonth(d0)}</p>
      <MonthGrid
        month={d0}
        selected={d0}
        weekStartsOn={prefs.weekStartsOn}
        cellMinHeight="min-h-[40px]"
        showHolidayNames={false}
        onSelect={(date) => go('planner', { type: 'planner-date', date })}
        renderCell={({ date }) => {
          const evs = eventsOnDate(data.events, date).slice(0, 3);
          return (
            <span className="flex justify-center gap-0.5">
              {evs.map((e) => (
                <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: categoryOf(data.categories, e.categoryId).color }} />
              ))}
            </span>
          );
        }}
      />
    </Card>
  );
}

function RecentMoods() {
  const { data } = useData();
  const recent = sortDiaries(data.diaries).filter((d) => monthKey(d.date) === monthKey(today())).slice(0, 10);
  if (!recent.length) return null;
  return (
    <div className="mt-3 flex items-center gap-2 text-[13px] text-muted">
      <BookHeart className="h-4 w-4" />
      이번 달 기분
      <span className="flex gap-0.5 text-lg">
        {recent.map((d) => (
          <span key={d.id} title={d.date}>
            {MOODS.find((m) => m.id === d.mood)?.emoji || '📝'}
          </span>
        ))}
      </span>
    </div>
  );
}
