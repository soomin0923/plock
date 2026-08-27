import React, { useState } from 'react';
import {
  Sun,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Flame,
  CalendarCheck,
  ListTodo,
  CheckSquare,
  Maximize2,
  X,
  Plus
} from 'lucide-react';
import { PlannerItem, RoutineItem, ChecklistItem, CustomCategory } from '../types';
import { isRoutineActiveOnDate } from '../lib/routineUtils';

interface TodayMorningWidgetProps {
  selectedDate: string; // YYYY-MM-DD
  plannerItems: PlannerItem[];
  setPlannerItems: React.Dispatch<React.SetStateAction<PlannerItem[]>>;
  routines: RoutineItem[];
  setRoutines: React.Dispatch<React.SetStateAction<RoutineItem[]>>;
  checklist: ChecklistItem[];
  setChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  categories?: CustomCategory[];
  primaryColor?: string;
  onOpenBriefingModal: () => void;
  onNavigateToPlanner?: () => void;
  onNavigateToRoutines?: () => void;
}

export const TodayMorningWidget: React.FC<TodayMorningWidgetProps> = ({
  selectedDate,
  plannerItems,
  setPlannerItems,
  routines,
  setRoutines,
  checklist,
  setChecklist,
  categories = [],
  primaryColor = '#C1876B',
  onOpenBriefingModal,
  onNavigateToPlanner,
  onNavigateToRoutines,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isClosed, setIsClosed] = useState(false);

  if (isClosed) return null;

  // Format Date for Header
  const dateObj = new Date(selectedDate);
  const daysKr = ['일', '월', '화', '수', '목', '금', '토'];
  const dateLabel = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${daysKr[dateObj.getDay()]})`;

  // Today's Planner Items
  const todayPlanner = plannerItems
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  // Today's Routines
  const todayRoutines = routines.filter((r) => isRoutineActiveOnDate(r, selectedDate));
  const completedRoutines = todayRoutines.filter((r) => r.completedDates.includes(selectedDate));

  // Today's Checklist items due today
  const todayChecklist = checklist.filter((c) => c.dueDate === selectedDate);
  const completedChecklist = todayChecklist.filter((c) => c.isCompleted);

  // Total items calculation
  const totalTasksCount = todayPlanner.length + todayChecklist.length + todayRoutines.length;
  const completedTasksCount =
    todayPlanner.filter((p) => p.isCompleted).length +
    completedChecklist.length +
    completedRoutines.length;

  const progressPercent =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  // Toggle Planner Item completion
  const handleTogglePlanner = (itemId: string) => {
    setPlannerItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
      )
    );
  };

  // Toggle Routine completion
  const handleToggleRoutine = (routineId: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id === routineId) {
          const isDone = r.completedDates.includes(selectedDate);
          const newDates = isDone
            ? r.completedDates.filter((d) => d !== selectedDate)
            : [...r.completedDates, selectedDate];
          const newStreak = isDone ? Math.max(0, r.streak - 1) : r.streak + 1;
          return { ...r, completedDates: newDates, streak: newStreak };
        }
        return r;
      })
    );
  };

  // Toggle Checklist completion
  const handleToggleChecklist = (taskId: string) => {
    setChecklist((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t))
    );
  };

  return (
    <div className="w-full mb-6 transition-all duration-300">
      <div
        style={{ borderColor: `${primaryColor}40` }}
        className="bg-white/95 backdrop-blur-md rounded-2xl shadow-md border overflow-hidden"
      >
        {/* Top Accent Color Bar */}
        <div style={{ backgroundColor: primaryColor }} className="h-1.5 w-full" />

        {/* Banner Header Bar */}
        <div className="p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 bg-stone-50/80 border-b border-stone-100">
          <div className="flex items-center space-x-3">
            <div
              style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-2xs shrink-0"
            >
              <Sun className="w-5 h-5 animate-pulse" />
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <span
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                  className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-current/20"
                >
                  ☀️ 아침 상단바 브리핑 & 위젯
                </span>
                <span className="text-xs font-semibold text-stone-500">{dateLabel}</span>
              </div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-1.5 mt-0.5">
                <span>오늘의 할 일 + 루틴 현황</span>
                <span className="text-xs text-stone-500 font-normal">
                  ({completedTasksCount}/{totalTasksCount} 완료 - {progressPercent}%)
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Detailed Briefing Modal Trigger Button */}
            <button
              onClick={onOpenBriefingModal}
              style={{ backgroundColor: primaryColor }}
              className="px-3 py-1.5 rounded-xl text-white text-xs font-bold hover:opacity-95 shadow-sm flex items-center space-x-1 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>상세 브리핑</span>
            </button>

            {/* Toggle Expand / Collapse */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors"
              title={isExpanded ? '위젯 접기' : '위젯 펼치기'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* Close Widget */}
            <button
              onClick={() => setIsClosed(true)}
              className="p-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors"
              title="상단바 숨기기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-stone-100 h-1.5">
          <div
            style={{ backgroundColor: primaryColor, width: `${progressPercent}%` }}
            className="h-full transition-all duration-500 rounded-r-full"
          />
        </div>

        {/* Collapsible Detailed Contents */}
        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-5 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left Column: Today's Routine Section */}
              <div className="space-y-3 bg-stone-50/60 p-3.5 rounded-xl border border-stone-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-700">
                      오늘의 루틴 ({completedRoutines.length}/{todayRoutines.length})
                    </h4>
                  </div>
                  {onNavigateToRoutines && (
                    <button
                      onClick={onNavigateToRoutines}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                    >
                      전체보기
                    </button>
                  )}
                </div>

                {todayRoutines.length === 0 ? (
                  <p className="text-xs text-stone-400 py-3 text-center italic">
                    오늘 예정된 루틴이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {todayRoutines.map((routine) => {
                      const isDone = routine.completedDates.includes(selectedDate);
                      return (
                        <div
                          key={routine.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                            isDone
                              ? 'bg-emerald-50/60 border-emerald-200 text-stone-500 line-through'
                              : 'bg-white border-stone-200 text-stone-800 hover:border-stone-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <button
                              onClick={() => handleToggleRoutine(routine.id)}
                              className="text-stone-400 hover:text-emerald-600 transition-colors"
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                              ) : (
                                <Circle className="w-5 h-5 text-stone-300 hover:text-stone-400" />
                              )}
                            </button>

                            <div className="truncate">
                              <p className="text-xs font-bold truncate">{routine.title}</p>
                              <div className="flex items-center space-x-2 text-[10px] text-stone-400">
                                <span>{routine.frequency === 'daily' ? '매일' : '지정일'}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                                  🔥 {routine.streak}일 연속
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleToggleRoutine(routine.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              isDone
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {isDone ? '완료됨' : '완료하기'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Today's Planner & Checklist Section */}
              <div className="space-y-3 bg-stone-50/60 p-3.5 rounded-xl border border-stone-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ListTodo className="w-4 h-4 text-blue-500" />
                    <h4 className="font-bold text-xs uppercase tracking-wider text-stone-700">
                      오늘의 할 일 & 일정 ({todayPlanner.length + todayChecklist.length}개)
                    </h4>
                  </div>
                  {onNavigateToPlanner && (
                    <button
                      onClick={onNavigateToPlanner}
                      className="text-[11px] font-semibold text-stone-500 hover:text-stone-800"
                    >
                      플래너 이동
                    </button>
                  )}
                </div>

                {todayPlanner.length === 0 && todayChecklist.length === 0 ? (
                  <p className="text-xs text-stone-400 py-3 text-center italic">
                    오늘 등록된 일정 및 할 일이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {/* Today's Planner Items */}
                    {todayPlanner.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          item.isCompleted
                            ? 'bg-stone-100/80 border-stone-200 text-stone-400 line-through'
                            : 'bg-white border-stone-200 text-stone-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <button
                            onClick={() => handleTogglePlanner(item.id)}
                            className="text-stone-400 hover:text-stone-700 transition-colors"
                          >
                            {item.isCompleted ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-stone-300" />
                            )}
                          </button>

                          <div className="truncate">
                            <p className="text-xs font-bold truncate">{item.title}</p>
                            {item.startTime && (
                              <p className="text-[10px] text-stone-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {item.startTime} {item.endTime ? `~ ${item.endTime}` : ''}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>

                        <span
                          style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                        >
                          {item.category || '일정'}
                        </span>
                      </div>
                    ))}

                    {/* Today's Checklist items */}
                    {todayChecklist.map((task) => (
                      <div
                        key={task.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                          task.isCompleted
                            ? 'bg-stone-100/80 border-stone-200 text-stone-400 line-through'
                            : 'bg-white border-stone-200 text-stone-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <button
                            onClick={() => handleToggleChecklist(task.id)}
                            className="text-stone-400 hover:text-stone-700 transition-colors"
                          >
                            {task.isCompleted ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Circle className="w-4 h-4 text-stone-300" />
                            )}
                          </button>

                          <p className="text-xs font-bold truncate">{task.title}</p>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">
                          체크리스트
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
