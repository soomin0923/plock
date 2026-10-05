import React, { useState } from 'react';
import { ArrowRight, BookHeart, CalendarDays, Cloud, PenLine, Plus } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { useRouter } from '../../app/router';
import { useOpenAuth } from '../../app/authSheet';
import { Button, Card, SectionTitle } from '../../components/ui';
import { QuickAdd } from '../../components/QuickAdd';
import { useToast } from '../../components/Toast';
import { addDays, formatKoreanDate, monthKey, parseYmd, relativeDayLabel, today } from '../../lib/date';
import { won } from '../../lib/util';
import { eventsOnDate, isHabitDay, sortTasks, toggleHabitDate } from '../planner/helpers';
import { EventRow, HabitRow, parsePlanInput, TaskRow } from '../planner/rows';
import { PlanSheet, type PlanSheetState } from '../planner/forms';
import { toggleTask } from '../planner/TaskSection';
import { DiaryPage } from '../diary/DiaryPage';
import { sortDiaries } from '../diary/DiaryViewer';
import { entriesInMonth, sumBy } from '../ledger/helpers';
import { MOODS } from '../../data/defaults';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return '늦은 밤이에요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '좋은 오후예요';
  return '오늘 하루 수고했어요';
}

export function TodayView() {
  const { data, user, upsert, prefs } = useData();
  const { go } = useRouter();
  const openAuth = useOpenAuth();
  const toast = useToast();
  const [sheet, setSheet] = useState<PlanSheetState>(null);
  const d0 = today();

  const events = eventsOnDate(data.events, d0);
  const tasks = sortTasks(data.tasks.filter((t) => !t.done && t.dueDate && t.dueDate <= d0));
  const undated = sortTasks(data.tasks.filter((t) => !t.done && !t.dueDate)).slice(0, 5);
  const doneToday = data.tasks.filter((t) => t.done && t.dueDate === d0);
  const habits = data.habits.filter((h) => isHabitDay(h, d0)).sort((a, b) => a.order - b.order);
  const habitsDone = habits.filter((h) => h.doneDates.includes(d0)).length;
  const diary = sortDiaries(data.diaries).find((d) => d.date === d0);
  const todaySpent = sumBy(data.ledger.filter((l) => l.date === d0), 'expense');
  const monthSpent = sumBy(entriesInMonth(data.ledger, d0), 'expense');
  const upcoming = Array.from({ length: 6 }, (_, i) => addDays(d0, i + 1))
    .flatMap((d) => eventsOnDate(data.events, d).filter((e) => e.startDate === d).map((e) => ({ d, e })))
    .slice(0, 6);
  const name = user?.displayName || (user?.email ? user.email.split('@')[0] : '');

  const onQuick = async (text: string, useAi: boolean) => {
    const draft = await parsePlanInput(text, useAi, data.categories, (m) => toast(m, 'error'));
    setSheet({ mode: 'new', kind: draft.kind, date: draft.startDate, draft });
  };

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-semibold text-primary">{formatKoreanDate(d0, { year: true })}</p>
        <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight lg:text-[28px]">
          {greeting()}
          {name && <span className="text-ink-soft">, {name}님</span>}
        </h2>
      </div>

      {!user && (
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

      <QuickAdd className="mb-5" placeholder="일정·할 일·습관을 말하듯 적어 보세요" examples={['내일 오후 2시 치과', '금요일까지 과제 제출', '매일 물 2L 마시기']} onSubmit={onQuick} />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle
              action={
                <button onClick={() => go('planner')} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted hover:text-ink">
                  플래너 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              }
            >
              오늘 일정
            </SectionTitle>
            {events.length === 0 ? (
              <button onClick={() => setSheet({ mode: 'new', kind: 'event', date: d0 })} className="flex w-full items-center gap-2 rounded-xl px-2 py-3 text-sm text-muted hover:bg-hover">
                <CalendarDays className="h-4 w-4" /> 오늘은 일정이 없어요 · 추가하기
              </button>
            ) : (
              events.map((e) => <EventRow key={e.id} e={e} cats={data.categories} date={d0} onClick={() => setSheet({ mode: 'edit-event', item: e })} onToggle={() => upsert('events', { ...e, done: !e.done })} />)
            )}
          </Card>

          <Card className="p-4">
            <SectionTitle
              action={
                <button onClick={() => setSheet({ mode: 'new', kind: 'task', date: d0 })} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted hover:text-ink">
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
                {tasks.map((t) => (
                  <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => setSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
                ))}
                {doneToday.map((t) => (
                  <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => setSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
                ))}
                {undated.length > 0 && (tasks.length > 0 || doneToday.length > 0) && <p className="mt-2 px-2 text-[12px] font-bold text-muted">기한 없음</p>}
                {undated.map((t) => (
                  <TaskRow key={t.id} t={t} cats={data.categories} onClick={() => setSheet({ mode: 'edit-task', item: t })} onToggle={() => upsert('tasks', toggleTask(t))} />
                ))}
              </>
            )}
          </Card>

          {habits.length > 0 && (
            <Card className="p-4">
              <SectionTitle action={<span className="text-[13px] font-semibold text-muted tabular">{habitsDone}/{habits.length}</span>}>오늘의 습관</SectionTitle>
              <div className="grid gap-x-3 sm:grid-cols-2">
                {habits.map((h) => (
                  <HabitRow key={h.id} h={h} date={d0} compact onToggle={() => upsert('habits', toggleHabitDate(h, d0))} onClick={() => setSheet({ mode: 'edit-habit', item: h })} />
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between p-4 pb-3">
              <h3 className="text-[15px] font-bold tracking-tight">오늘의 일기</h3>
              {diary && (
                <button onClick={() => go('diary', { type: 'diary-open', id: diary.id })} className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-muted hover:text-ink">
                  열기 <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {diary ? (
              <button onClick={() => go('diary', { type: 'diary-open', id: diary.id })} className="block w-full px-4 pb-4 text-left">
                <div className="relative max-h-64 overflow-hidden rounded-xl border border-line">
                  <DiaryPage entry={diary} thumbnail className="pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white to-transparent" />
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

          {upcoming.length > 0 && (
            <Card className="p-4">
              <SectionTitle>다가오는 일정</SectionTitle>
              {upcoming.map(({ d, e }) => (
                <div key={e.id + d} className="flex items-center gap-3">
                  <span className="w-12 flex-none text-[13px] font-semibold text-muted">{relativeDayLabel(d) || `${parseYmd(d).getMonth() + 1}/${parseYmd(d).getDate()}`}</span>
                  <div className="min-w-0 flex-1">
                    <EventRow e={e} cats={data.categories} onClick={() => setSheet({ mode: 'edit-event', item: e })} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      <PlanSheet state={sheet} onClose={() => setSheet(null)} />
    </div>
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

