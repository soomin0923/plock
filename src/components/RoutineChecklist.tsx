import React, { useState } from 'react';
import {
  CheckSquare,
  Repeat,
  Plus,
  Flame,
  Clock,
  Calendar,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
  ChevronRight,
  ListTodo,
  Edit2
} from 'lucide-react';
import { RoutineItem, ChecklistItem, CustomCategory } from '../types';
import { isRoutineActiveOnDate, formatDaysLabel, DAY_NAMES_KR } from '../lib/routineUtils';

interface RoutineChecklistProps {
  routines: RoutineItem[];
  setRoutines: React.Dispatch<React.SetStateAction<RoutineItem[]>>;
  checklist: ChecklistItem[];
  setChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  selectedDate: string;
  categories?: CustomCategory[];
}

export const RoutineChecklist: React.FC<RoutineChecklistProps> = ({
  routines,
  setRoutines,
  checklist,
  setChecklist,
  selectedDate,
  categories = [],
}) => {
  const [activeTab, setActiveTab] = useState<'routine' | 'checklist'>('routine');
  const [routineFilter, setRoutineFilter] = useState<'today' | 'all'>('today');

  // Modal states for Routine Add/Edit
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [rTitle, setRTitle] = useState('');
  const [rCategory, setRCategory] = useState<string>(categories[0]?.id || 'health');
  const [rSelectedDays, setRSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // Default: All 7 days
  const [rTimeOfDay, setRTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'anytime'>('morning');
  const [rIcon, setRIcon] = useState('🌟');

  // Modal states for Checklist Task
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [tTitle, setTTitle] = useState('');
  const [tDueDate, setTDueDate] = useState(selectedDate);
  const [tDueTime, setTDueTime] = useState('18:00');
  const [tPriority, setTPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [tCategory, setTCategory] = useState<string>(categories[0]?.id || 'personal');
  const [tMemo, setTMemo] = useState('');
  const [tSubtaskInput, setTSubtaskInput] = useState('');
  const [tSubtasks, setTSubtasks] = useState<string[]>([]);

  // Toggle Day Selection
  const toggleDaySelection = (dayIdx: number) => {
    setRSelectedDays((prev) => {
      if (prev.includes(dayIdx)) {
        // Must keep at least 1 day selected
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIdx);
      } else {
        return [...prev, dayIdx].sort((a, b) => a - b);
      }
    });
  };

  // Preset Day Selectors
  const setPresetDays = (preset: 'all' | 'weekdays' | 'weekends') => {
    if (preset === 'all') setRSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    if (preset === 'weekdays') setRSelectedDays([1, 2, 3, 4, 5]);
    if (preset === 'weekends') setRSelectedDays([0, 6]);
  };

  const openNewRoutineModal = () => {
    setEditingRoutineId(null);
    setRTitle('');
    setRSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setRTimeOfDay('morning');
    setRIcon('🌟');
    setIsRoutineModalOpen(true);
  };

  const openEditRoutineModal = (routine: RoutineItem) => {
    setEditingRoutineId(routine.id);
    setRTitle(routine.title);
    if (routine.customDays && routine.customDays.length > 0) {
      setRSelectedDays(routine.customDays);
    } else if (routine.frequency === 'weekdays') {
      setRSelectedDays([1, 2, 3, 4, 5]);
    } else if (routine.frequency === 'weekends') {
      setRSelectedDays([0, 6]);
    } else {
      setRSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }
    setRTimeOfDay(routine.timeOfDay || 'morning');
    setRIcon(routine.icon || '🌟');
    setIsRoutineModalOpen(true);
  };

  // Routine Completion Check Handler
  const toggleRoutineComplete = (routineId: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id === routineId) {
          const isDoneToday = r.completedDates.includes(selectedDate);
          let newDates: string[];
          let newStreak = r.streak;

          if (isDoneToday) {
            newDates = r.completedDates.filter((d) => d !== selectedDate);
            newStreak = Math.max(0, r.streak - 1);
          } else {
            newDates = [...r.completedDates, selectedDate];
            newStreak = r.streak + 1;
          }

          return { ...r, completedDates: newDates, streak: newStreak };
        }
        return r;
      })
    );
  };

  const handleSaveRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rTitle.trim()) return;

    let computedFrequency: any = 'custom';
    if (rSelectedDays.length === 7) computedFrequency = 'daily';
    else if (rSelectedDays.length === 5 && rSelectedDays.every((d, i) => d === i + 1)) computedFrequency = 'weekdays';
    else if (rSelectedDays.length === 2 && rSelectedDays.includes(0) && rSelectedDays.includes(6)) computedFrequency = 'weekends';

    if (editingRoutineId) {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === editingRoutineId
            ? {
                ...r,
                title: rTitle,
                category: rCategory,
                frequency: computedFrequency,
                customDays: rSelectedDays,
                timeOfDay: rTimeOfDay,
                icon: rIcon,
              }
            : r
        )
      );
    } else {
      const newRoutine: RoutineItem = {
        id: `rtn_${Date.now()}`,
        title: rTitle,
        category: rCategory,
        frequency: computedFrequency,
        customDays: rSelectedDays,
        timeOfDay: rTimeOfDay,
        streak: 0,
        completedDates: [],
        icon: rIcon,
        color: '#06B6D4',
      };
      setRoutines((prev) => [newRoutine, ...prev]);
    }

    setRTitle('');
    setIsRoutineModalOpen(false);
  };

  const deleteRoutine = (id: string) => {
    if (confirm('이 루틴 항목을 삭제하시겠습니까?')) {
      setRoutines((prev) => prev.filter((r) => r.id !== id));
    }
  };

  // Checklist Task Handlers
  const toggleTaskComplete = (taskId: string) => {
    setChecklist((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t))
    );
  };

  const toggleSubtaskComplete = (taskId: string, subtaskId: string) => {
    setChecklist((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.subtasks) {
          const updatedSubtasks = t.subtasks.map((st) =>
            st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
          );
          return { ...t, subtasks: updatedSubtasks };
        }
        return t;
      })
    );
  };

  const handleAddSubtaskItem = () => {
    if (tSubtaskInput.trim()) {
      setTSubtasks((prev) => [...prev, tSubtaskInput.trim()]);
      setTSubtaskInput('');
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim()) return;

    const newTask: ChecklistItem = {
      id: `task_${Date.now()}`,
      title: tTitle,
      dueDate: tDueDate,
      dueTime: tDueTime,
      priority: tPriority,
      isCompleted: false,
      category: tCategory,
      memo: tMemo,
      subtasks: tSubtasks.map((title, idx) => ({
        id: `st_${Date.now()}_${idx}`,
        title,
        isCompleted: false,
      })),
      createdAt: new Date().toISOString(),
    };

    setChecklist((prev) => [newTask, ...prev]);
    setTTitle('');
    setTMemo('');
    setTSubtasks([]);
    setIsTaskModalOpen(false);
  };

  const deleteTask = (id: string) => {
    if (confirm('이 체크리스트 작업을 삭제하시겠습니까?')) {
      setChecklist((prev) => prev.filter((t) => t.id !== id));
    }
  };

  // Routines active today vs all
  const activeTodayRoutines = routines.filter((r) => isRoutineActiveOnDate(r, selectedDate));
  const displayedRoutines = routineFilter === 'today' ? activeTodayRoutines : routines;

  const completedRoutinesToday = activeTodayRoutines.filter((r) => r.completedDates.includes(selectedDate)).length;
  const routineProgressPercent =
    activeTodayRoutines.length > 0 ? Math.round((completedRoutinesToday / activeTodayRoutines.length) * 100) : 0;

  // Priority color styles
  const priorityStyles = {
    high: { bg: 'bg-rose-100 text-rose-800 border-rose-300', label: '높음 🔴' },
    medium: { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: '보통 🟡' },
    low: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: '낮음 🟢' },
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Tab Selector Header */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-2 bg-stone-100 p-1.5 rounded-xl border border-stone-200 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('routine')}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all w-1/2 sm:w-auto ${
              activeTab === 'routine'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Repeat className="w-4 h-4 text-theme-primary" />
            <span>반복 루틴 설정</span>
          </button>
          <button
            onClick={() => setActiveTab('checklist')}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all w-1/2 sm:w-auto ${
              activeTab === 'checklist'
                ? 'bg-white text-stone-900 shadow-xs border border-stone-200'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-theme-primary" />
            <span>마감 기한 체크리스트</span>
          </button>
        </div>

        {/* Action Button depending on tab */}
        {activeTab === 'routine' ? (
          <button
            onClick={openNewRoutineModal}
            className="flex items-center justify-center space-x-2 bg-theme-primary hover:opacity-90 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-xs transition-all w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>새 루틴 추가</span>
          </button>
        ) : (
          <button
            onClick={() => setIsTaskModalOpen(true)}
            className="flex items-center justify-center space-x-2 bg-theme-primary hover:opacity-90 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-xs transition-all w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>마감 과제 추가</span>
          </button>
        )}
      </div>

      {/* 1. ROUTINE TAB */}
      {activeTab === 'routine' && (
        <div className="space-y-6">
          {/* Routine Progress Card & Filter Switch */}
          <div className="bg-gradient-to-br from-theme-soft via-stone-50 to-theme-soft p-5 rounded-2xl border border-theme-soft shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs font-bold text-theme-primary uppercase tracking-wide">
                {selectedDate} 루틴 달성 현황
              </span>
              <h3 className="text-xl font-extrabold text-stone-800">
                오늘의 습관 형성 달성률 {routineProgressPercent}%
              </h3>
              <p className="text-xs text-stone-600">
                오늘 할 루틴 총 {activeTodayRoutines.length}개 중 {completedRoutinesToday}개 완료함
              </p>
            </div>

            <div className="flex items-center space-x-4 w-full md:w-auto justify-center">
              {/* Filter Switcher */}
              <div className="flex bg-white/80 p-1 rounded-xl border border-stone-200 text-xs font-bold">
                <button
                  onClick={() => setRoutineFilter('today')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    routineFilter === 'today' ? 'bg-stone-900 text-white shadow-2xs' : 'text-stone-500'
                  }`}
                >
                  오늘 루틴만 ({activeTodayRoutines.length})
                </button>
                <button
                  onClick={() => setRoutineFilter('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    routineFilter === 'all' ? 'bg-stone-900 text-white shadow-2xs' : 'text-stone-500'
                  }`}
                >
                  전체 루틴 목록 ({routines.length})
                </button>
              </div>

              {/* Progress Gauge Bar */}
              <div className="w-32 bg-stone-200/80 rounded-full h-3 p-0.5 border border-stone-300 hidden sm:block">
                <div
                  className="bg-theme-primary h-2 rounded-full transition-all duration-500"
                  style={{ width: `${routineProgressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Routine Grid */}
          {displayedRoutines.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 text-stone-400 space-y-3">
              <p className="text-sm font-medium">
                {routineFilter === 'today'
                  ? '오늘 지정된 반복 루틴이 없습니다. [새 루틴 추가]를 통해 요일을 자유롭게 선택해보세요!'
                  : '등록된 루틴이 없습니다. 오른쪽 상단 [새 루틴 추가] 버튼을 눌러보세요.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedRoutines.map((rtn) => {
                const isDoneToday = rtn.completedDates.includes(selectedDate);
                const isScheduledToday = isRoutineActiveOnDate(rtn, selectedDate);
                const dayLabel = formatDaysLabel(rtn.customDays, rtn.frequency);

                return (
                  <div
                    key={rtn.id}
                    className={`p-4 rounded-2xl border transition-all shadow-2xs bg-white ${
                      isDoneToday
                        ? 'border-theme-soft bg-theme-soft/30'
                        : !isScheduledToday
                        ? 'border-stone-200/60 opacity-80 bg-stone-50/50'
                        : 'border-stone-200/80 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="text-2xl">{rtn.icon || '🌟'}</span>
                        <div>
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 border border-stone-200">
                              🗓️ {dayLabel}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-stone-400">
                              {rtn.timeOfDay === 'morning'
                                ? '🌅 아침'
                                : rtn.timeOfDay === 'afternoon'
                                ? '☀️ 낮'
                                : rtn.timeOfDay === 'evening'
                                ? '🌙 저녁'
                                : '⏰ 언제나'}
                            </span>
                          </div>
                          <h4 className="font-bold text-stone-800 text-sm leading-tight mt-1">{rtn.title}</h4>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => openEditRoutineModal(rtn)}
                          className="text-stone-400 hover:text-stone-700 p-1 transition-colors"
                          title="루틴 요일 및 설정 수정"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteRoutine(rtn.id)}
                          className="text-stone-300 hover:text-rose-500 p-1 transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3">
                      {/* Streak Badge */}
                      <div className="flex items-center space-x-1.5 bg-theme-soft text-theme-primary border border-theme-soft px-2.5 py-1 rounded-full text-xs font-bold">
                        <Flame className="w-3.5 h-3.5 text-theme-primary fill-theme-primary" />
                        <span>{rtn.streak}일 연속 실천</span>
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => toggleRoutineComplete(rtn.id)}
                        className={`flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isDoneToday
                            ? 'bg-theme-primary text-white shadow-2xs'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-200'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isDoneToday ? '완료됨' : '실천하기'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. CHECKLIST & DEADLINE TASKS TAB */}
      {activeTab === 'checklist' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-xs border border-stone-200/80 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
                <ListTodo className="w-5 h-5 text-theme-primary" />
                마감 기한 체크리스트 과제
              </h3>
              <span className="text-xs text-stone-500">
                총 {checklist.length}개 작업 (완료: {checklist.filter((c) => c.isCompleted).length}개)
              </span>
            </div>

            {checklist.length === 0 ? (
              <div className="text-center py-10 text-stone-400">
                마감 기한이 지정된 과제가 없습니다. 위 버튼을 눌러 작업을 등록하세요.
              </div>
            ) : (
              <div className="space-y-3">
                {checklist.map((task) => {
                  const priorityInfo = priorityStyles[task.priority];
                  const subtaskCount = task.subtasks ? task.subtasks.length : 0;
                  const completedSubtasks = task.subtasks ? task.subtasks.filter((s) => s.isCompleted).length : 0;

                  return (
                    <div
                      key={task.id}
                      className={`p-4 rounded-xl border transition-all ${
                        task.isCompleted
                          ? 'bg-stone-50/70 border-stone-200 opacity-70'
                          : 'bg-white border-stone-200 shadow-2xs hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-3">
                          <button
                            onClick={() => toggleTaskComplete(task.id)}
                            className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center transition-colors ${
                              task.isCompleted
                                ? 'bg-theme-primary border-theme-primary text-white'
                                : 'border-stone-300 bg-white'
                            }`}
                          >
                            {task.isCompleted && <CheckCircle2 className="w-4 h-4" />}
                          </button>

                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityInfo.bg}`}
                              >
                                {priorityInfo.label}
                              </span>
                              {task.startDate && task.endDate && task.startDate !== task.endDate ? (
                                <span className="text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300/60 px-2 py-0.5 rounded-md flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-amber-700" />
                                  기간: {task.startDate} ~ {task.endDate}
                                </span>
                              ) : (
                                <span className="text-xs text-stone-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-stone-400" />
                                  마감: {task.dueDate} {task.dueTime || ''}
                                </span>
                              )}
                            </div>

                            <h4
                              className={`font-bold text-stone-800 text-base mt-1 ${
                                task.isCompleted ? 'line-through text-stone-400' : ''
                              }`}
                            >
                              {task.title}
                            </h4>

                            {task.memo && <p className="text-xs text-stone-600 mt-1">{task.memo}</p>}
                          </div>
                        </div>

                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-stone-300 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Subtasks List */}
                      {subtaskCount > 0 && (
                        <div className="mt-3 pt-3 border-t border-stone-100 space-y-1.5 pl-8">
                          <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                            <span>하위 체크리스트 ({completedSubtasks}/{subtaskCount})</span>
                          </div>
                          {task.subtasks!.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => toggleSubtaskComplete(task.id, st.id)}
                              className="flex items-center space-x-2 text-xs text-stone-700 cursor-pointer hover:text-stone-900"
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-xs border flex items-center justify-center ${
                                  st.isCompleted ? 'bg-theme-primary text-white border-theme-primary' : 'border-stone-300'
                                }`}
                              >
                                {st.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <span className={st.isCompleted ? 'line-through opacity-60' : ''}>
                                {st.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FOR ADDING / EDITING ROUTINE WITH CUSTOM MULTI-DAY SELECTION */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-800 text-lg">
                {editingRoutineId ? '루틴 수정하기' : '새 루틴 습관 등록'}
              </h3>
              <button
                onClick={() => setIsRoutineModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoutine} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">루틴 이름 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 독서 20분, 물 1L 마시기, 영양제 챙기기"
                  value={rTitle}
                  onChange={(e) => setRTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-theme-primary"
                />
              </div>

              {/* REPEAT DAYS MULTI-SELECTION SECTION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-stone-700">
                    실천 요일 선택 (복수 선택 가능) *
                  </label>
                  <div className="flex space-x-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setPresetDays('all')}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-bold"
                    >
                      매일
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDays('weekdays')}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-bold"
                    >
                      평일만
                    </button>
                    <button
                      type="button"
                      onClick={() => setPresetDays('weekends')}
                      className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md font-bold"
                    >
                      주말만
                    </button>
                  </div>
                </div>

                {/* Day Buttons Grid [일, 월, 화, 수, 목, 금, 토] */}
                <div className="grid grid-cols-7 gap-1.5 pt-1">
                  {DAY_NAMES_KR.map((dayName, idx) => {
                    const isSelected = rSelectedDays.includes(idx);
                    const isSunday = idx === 0;
                    const isSaturday = idx === 6;

                    return (
                      <button
                        key={dayName}
                        type="button"
                        onClick={() => toggleDaySelection(idx)}
                        className={`py-2 rounded-xl text-xs font-extrabold transition-all border ${
                          isSelected
                            ? 'bg-theme-primary text-white border-theme-primary shadow-2xs scale-105'
                            : 'bg-stone-50 border-stone-200 text-stone-500 hover:bg-stone-100'
                        }`}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-stone-500 text-center font-mono">
                  선택됨: <span className="font-bold text-theme-primary">{formatDaysLabel(rSelectedDays)}</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">하루 중 시간대</label>
                <select
                  value={rTimeOfDay}
                  onChange={(e) => setRTimeOfDay(e.target.value as any)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                >
                  <option value="morning">🌅 아침</option>
                  <option value="afternoon">☀️ 낮</option>
                  <option value="evening">🌙 저녁</option>
                  <option value="anytime">⏰ 언제나</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">대표 이모지 아이콘</label>
                <div className="flex items-center space-x-2">
                  {['🌟', '🥛', '📚', '🏃‍♂️', '💰', '✍️', '🧘‍♀️', '🍎'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setRIcon(emoji)}
                      className={`text-xl p-2 rounded-xl border ${
                        rIcon === emoji ? 'bg-theme-soft border-theme-primary scale-110' : 'bg-stone-50 border-stone-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsRoutineModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-theme-primary hover:opacity-90 text-white font-bold rounded-xl shadow-xs"
                >
                  {editingRoutineId ? '루틴 수정 저장' : '루틴 생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FOR ADDING TASK */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-800 text-lg">새 마감 과제 등록</h3>
              <button
                onClick={() => setIsTaskModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTask} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">작업 제목 *</label>
                <input
                  type="text"
                  required
                  placeholder="예: 보고서 제출, 생필품 장보기"
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-theme-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">마감 일자</label>
                  <input
                    type="date"
                    value={tDueDate}
                    onChange={(e) => setTDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">마감 시간</label>
                  <input
                    type="time"
                    value={tDueTime}
                    onChange={(e) => setTDueTime(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">우선순위</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTPriority('high')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      tPriority === 'high'
                        ? 'bg-rose-100 border-rose-400 text-rose-800'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    높음 🔴
                  </button>
                  <button
                    type="button"
                    onClick={() => setTPriority('medium')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      tPriority === 'medium'
                        ? 'bg-amber-100 border-amber-400 text-amber-800'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    보통 🟡
                  </button>
                  <button
                    type="button"
                    onClick={() => setTPriority('low')}
                    className={`py-2 text-xs font-bold rounded-xl border ${
                      tPriority === 'low'
                        ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                        : 'bg-stone-50 border-stone-200'
                    }`}
                  >
                    낮음 🟢
                  </button>
                </div>
              </div>

              {/* Subtasks creator */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">하위 체크리스트 항목 추가</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="하위 세부 항목 입력"
                    value={tSubtaskInput}
                    onChange={(e) => setTSubtaskInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-stone-300 rounded-xl text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtaskItem}
                    className="bg-stone-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold"
                  >
                    추가
                  </button>
                </div>
                {tSubtasks.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-2 text-xs text-stone-600">
                    {tSubtasks.map((st, i) => (
                      <li key={i} className="flex items-center justify-between bg-stone-50 p-1.5 rounded-lg border">
                        <span>• {st}</span>
                        <button
                          type="button"
                          onClick={() => setTSubtasks(tSubtasks.filter((_, idx) => idx !== i))}
                          className="text-rose-500 font-bold"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-xl font-medium"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-theme-primary hover:opacity-90 text-white font-bold rounded-xl shadow-xs"
                >
                  과제 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
