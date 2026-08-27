import React, { useState, useEffect } from 'react';
import {
  GripVertical,
  Calendar,
  CheckSquare,
  Clock,
  Flame,
  CreditCard,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Check,
  ArrowUp,
  ArrowDown,
  Tag,
  ListTodo
} from 'lucide-react';
import { PlannerItem, RoutineItem, ChecklistItem, FinancialItem, CustomCategory } from '../types';
import { isRoutineActiveOnDate } from '../lib/routineUtils';

export type WidgetId = 'schedule' | 'checklist' | 'routines' | 'briefing' | 'financial';

interface WidgetConfig {
  id: WidgetId;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isCollapsed?: boolean;
}

interface DraggableWidgetSidebarProps {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  plannerItems: PlannerItem[];
  setPlannerItems: React.Dispatch<React.SetStateAction<PlannerItem[]>>;
  routines: RoutineItem[];
  setRoutines: React.Dispatch<React.SetStateAction<RoutineItem[]>>;
  checklist: ChecklistItem[];
  setChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  financials?: FinancialItem[];
  setFinancials?: React.Dispatch<React.SetStateAction<FinancialItem[]>>;
  categories?: CustomCategory[];
  primaryColor?: string;
  onOpenBriefingModal?: () => void;
  onOpenAddPlannerModal?: (initialDate?: string) => void;
  onNavigateToTab?: (tab: string) => void;
}

const DEFAULT_WIDGET_ORDER: WidgetId[] = ['schedule', 'checklist', 'routines', 'briefing', 'financial'];
const STORAGE_KEY = 'plock_widget_order_v2';

export const DraggableWidgetSidebar: React.FC<DraggableWidgetSidebarProps> = ({
  selectedDate,
  setSelectedDate,
  plannerItems,
  setPlannerItems,
  routines,
  setRoutines,
  checklist,
  setChecklist,
  financials = [],
  setFinancials,
  categories = [],
  primaryColor = '#C1876B',
  onOpenBriefingModal,
  onOpenAddPlannerModal,
  onNavigateToTab,
}) => {
  // Load saved order from localStorage
  const [widgetOrder, setWidgetOrder] = useState<WidgetId[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ensure all default widgets exist
          const merged = [...parsed.filter((id: WidgetId) => DEFAULT_WIDGET_ORDER.includes(id))];
          DEFAULT_WIDGET_ORDER.forEach((id) => {
            if (!merged.includes(id)) merged.push(id);
          });
          return merged;
        }
      }
    } catch (e) {
      console.error('Error loading widget order:', e);
    }
    return DEFAULT_WIDGET_ORDER;
  });

  const [collapsedMap, setCollapsedMap] = useState<Record<WidgetId, boolean>>({
    schedule: false,
    checklist: false,
    routines: false,
    briefing: false,
    financial: false,
  });

  const [draggedWidgetId, setDraggedWidgetId] = useState<WidgetId | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<WidgetId | null>(null);

  // Quick inputs
  const [quickChecklistTitle, setQuickChecklistTitle] = useState('');

  // Persist order
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgetOrder));
  }, [widgetOrder]);

  // Drag & Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: WidgetId) => {
    setDraggedWidgetId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: WidgetId) => {
    e.preventDefault();
    if (draggedWidgetId && draggedWidgetId !== id) {
      setDragOverWidgetId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverWidgetId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: WidgetId) => {
    e.preventDefault();
    setDragOverWidgetId(null);
    if (!draggedWidgetId || draggedWidgetId === targetId) return;

    setWidgetOrder((prev) => {
      const newOrder = [...prev];
      const fromIndex = newOrder.indexOf(draggedWidgetId);
      const toIndex = newOrder.indexOf(targetId);
      if (fromIndex !== -1 && toIndex !== -1) {
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggedWidgetId);
      }
      return newOrder;
    });
    setDraggedWidgetId(null);
  };

  const handleDragEnd = () => {
    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // Button Reorder for Mobile / Touch
  const moveWidget = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= widgetOrder.length) return;

    setWidgetOrder((prev) => {
      const newOrder = [...prev];
      const temp = newOrder[index];
      newOrder[index] = newOrder[targetIndex];
      newOrder[targetIndex] = temp;
      return newOrder;
    });
  };

  const toggleCollapse = (id: WidgetId) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetOrder = () => {
    setWidgetOrder(DEFAULT_WIDGET_ORDER);
    setCollapsedMap({
      schedule: false,
      checklist: false,
      routines: false,
      briefing: false,
      financial: false,
    });
  };

  // Date Calculations
  const dateObj = new Date(selectedDate);
  const daysKr = ['일', '월', '화', '수', '목', '금', '토'];
  const formattedDate = `${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${daysKr[dateObj.getDay()]})`;

  // Filter Items
  const dayPlannerItems = plannerItems
    .filter((item) => {
      const s = item.startDate || item.date;
      const e = item.endDate || item.date;
      if (s && e) return selectedDate >= s && selectedDate <= e;
      return item.date === selectedDate;
    })
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  const dayRoutines = routines.filter((r) => isRoutineActiveOnDate(r, selectedDate));
  const dayChecklist = checklist.filter((c) => !c.dueDate || c.dueDate === selectedDate);
  const dayFinancials = financials.filter((f) => f.date === selectedDate);

  const totalTasks = dayPlannerItems.length + dayRoutines.length + dayChecklist.length;
  const completedTasks =
    dayPlannerItems.filter((p) => p.isCompleted).length +
    dayRoutines.filter((r) => r.completedDates.includes(selectedDate)).length +
    dayChecklist.filter((c) => c.isCompleted).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Toggle item handlers
  const handleTogglePlanner = (id: string) => {
    setPlannerItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isCompleted: !item.isCompleted } : item))
    );
  };

  const handleToggleChecklist = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isCompleted: !item.isCompleted } : item))
    );
  };

  const handleToggleRoutine = (id: string) => {
    setRoutines((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const isDone = r.completedDates.includes(selectedDate);
          const newDates = isDone
            ? r.completedDates.filter((d) => d !== selectedDate)
            : [...r.completedDates, selectedDate];
          return { ...r, completedDates: newDates };
        }
        return r;
      })
    );
  };

  const handleAddQuickChecklist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickChecklistTitle.trim()) return;
    const newItem: ChecklistItem = {
      id: `chk_${Date.now()}`,
      title: quickChecklistTitle.trim(),
      isCompleted: false,
      dueDate: selectedDate,
      category: 'daily',
      priority: 'medium',
      createdAt: new Date().toISOString(),
    };
    setChecklist((prev) => [newItem, ...prev]);
    setQuickChecklistTitle('');
  };

  // Render Individual Widgets
  const renderWidgetContent = (id: WidgetId) => {
    switch (id) {
      case 'schedule':
        return (
          <div className="space-y-2">
            {dayPlannerItems.length === 0 ? (
              <div className="text-center py-4 text-xs text-stone-400 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                <p>선택된 날짜의 일정이 없습니다.</p>
                {onOpenAddPlannerModal && (
                  <button
                    onClick={() => onOpenAddPlannerModal(selectedDate)}
                    className="mt-1.5 text-[11px] font-bold text-theme-primary hover:underline inline-flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>새 일정 추가</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar pr-0.5">
                {dayPlannerItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleTogglePlanner(item.id)}
                    className={`p-2 rounded-xl text-xs border transition-all flex items-center justify-between cursor-pointer ${
                      item.isCompleted
                        ? 'bg-stone-50 border-stone-200 opacity-60 line-through text-stone-400'
                        : 'bg-white border-stone-200/90 hover:border-stone-300 text-stone-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <button
                        type="button"
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          item.isCompleted ? 'bg-theme-primary border-theme-primary text-white' : 'border-stone-300 bg-white'
                        }`}
                      >
                        {item.isCompleted && <Check className="w-3 h-3" />}
                      </button>
                      <span className="font-semibold truncate">{item.title}</span>
                    </div>
                    {item.startTime && (
                      <span className="text-[10px] font-mono text-stone-500 shrink-0 ml-2 bg-stone-100 px-1.5 py-0.5 rounded">
                        {item.startTime}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'checklist':
        return (
          <div className="space-y-2.5">
            {/* Quick Add Input */}
            <form onSubmit={handleAddQuickChecklist} className="flex items-center space-x-1.5">
              <input
                type="text"
                value={quickChecklistTitle}
                onChange={(e) => setQuickChecklistTitle(e.target.value)}
                placeholder="빠른 할 일 추가 (Enter)..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-theme-primary focus:bg-white"
              />
              <button
                type="submit"
                disabled={!quickChecklistTitle.trim()}
                className="p-1.5 bg-theme-primary text-white rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </form>

            {dayChecklist.length === 0 ? (
              <p className="text-center py-3 text-xs text-stone-400">등록된 할 일이 없습니다.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pr-0.5">
                {dayChecklist.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleToggleChecklist(item.id)}
                    className={`p-2 rounded-xl text-xs border transition-all flex items-center justify-between cursor-pointer ${
                      item.isCompleted
                        ? 'bg-stone-50 border-stone-200 opacity-60 line-through text-stone-400'
                        : 'bg-white border-stone-200/90 hover:border-stone-300 text-stone-800 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          item.isCompleted ? 'bg-teal-600 border-teal-600 text-white' : 'border-stone-300 bg-white'
                        }`}
                      >
                        {item.isCompleted && <Check className="w-3 h-3" />}
                      </div>
                      <span className="truncate">{item.title}</span>
                    </div>
                    {item.priority === 'high' && (
                      <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded border border-rose-200">
                        중요
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'routines':
        return (
          <div className="space-y-2">
            {dayRoutines.length === 0 ? (
              <div className="text-center py-3 text-xs text-stone-400">
                <p>오늘 활성화된 루틴이 없습니다.</p>
                {onNavigateToTab && (
                  <button
                    onClick={() => onNavigateToTab('routine')}
                    className="mt-1 text-[11px] font-bold text-theme-primary hover:underline"
                  >
                    루틴 설정 바로가기
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar pr-0.5">
                {dayRoutines.map((routine) => {
                  const isDone = routine.completedDates.includes(selectedDate);
                  return (
                    <div
                      key={routine.id}
                      onClick={() => handleToggleRoutine(routine.id)}
                      className={`p-2 rounded-xl text-xs border transition-all flex items-center justify-between cursor-pointer ${
                        isDone
                          ? 'bg-amber-50/70 border-amber-300/80 text-amber-950 font-medium'
                          : 'bg-white border-stone-200 hover:border-stone-300 text-stone-800 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <div
                          className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                            isDone ? 'bg-amber-600 border-amber-600 text-white' : 'border-stone-300 bg-white'
                          }`}
                        >
                          {isDone && <Check className="w-2.5 h-2.5" />}
                        </div>
                        <span className="truncate">{routine.title}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-[10px] text-amber-700 shrink-0 font-mono">
                        <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>{routine.completedDates.length}일</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'briefing':
        return (
          <div className="space-y-3 bg-gradient-to-br from-amber-50/60 to-stone-50 p-3 rounded-xl border border-amber-200/60">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-stone-800">오늘의 종합 달성률</span>
                <p className="text-[10px] text-stone-500">
                  {completedTasks} / {totalTasks}개 완료
                </p>
              </div>
              <span className="text-base font-bold font-mono text-theme-primary">{progressPercent}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-stone-200 h-2 rounded-full overflow-hidden">
              <div
                style={{ width: `${progressPercent}%`, backgroundColor: primaryColor }}
                className="h-full rounded-full transition-all duration-500"
              />
            </div>

            {onOpenBriefingModal && (
              <button
                onClick={onOpenBriefingModal}
                className="w-full py-1.5 px-2.5 text-xs font-bold bg-white hover:bg-stone-50 text-stone-800 border border-stone-200 rounded-lg shadow-2xs transition-colors flex items-center justify-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>AI 데일리 브리핑 열기</span>
              </button>
            )}
          </div>
        );

      case 'financial':
        const totalExpense = dayFinancials
          .filter((f) => f.type === 'expense')
          .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
        const totalIncome = dayFinancials
          .filter((f) => f.type === 'income')
          .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-rose-50/70 border border-rose-200/80 rounded-xl">
                <span className="text-[10px] text-rose-700 font-medium">오늘 지출</span>
                <p className="font-bold text-rose-900 font-mono text-xs mt-0.5">
                  -{totalExpense.toLocaleString()}원
                </p>
              </div>
              <div className="p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
                <span className="text-[10px] text-emerald-700 font-medium">오늘 수입</span>
                <p className="font-bold text-emerald-900 font-mono text-xs mt-0.5">
                  +{totalIncome.toLocaleString()}원
                </p>
              </div>
            </div>
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('financial')}
                className="w-full text-center text-[11px] text-stone-500 hover:text-stone-800 hover:underline pt-1"
              >
                가계부 상세 내역 보기 →
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const widgetMetadata: Record<WidgetId, { title: string; subtitle: string; icon: React.ReactNode }> = {
    schedule: {
      title: '오늘의 세부 일정',
      subtitle: `${dayPlannerItems.length}건`,
      icon: <Clock className="w-3.5 h-3.5 text-theme-primary" />,
    },
    checklist: {
      title: '할 일 & 체크리스트',
      subtitle: `${dayChecklist.filter((c) => !c.isCompleted).length}건 남음`,
      icon: <CheckSquare className="w-3.5 h-3.5 text-teal-600" />,
    },
    routines: {
      title: '데일리 루틴 & 습관',
      subtitle: `${dayRoutines.filter((r) => r.completedDates.includes(selectedDate)).length}/${dayRoutines.length} 완료`,
      icon: <Flame className="w-3.5 h-3.5 text-amber-500" />,
    },
    briefing: {
      title: '목표 & 브리핑',
      subtitle: `${progressPercent}% 달성`,
      icon: <Sparkles className="w-3.5 h-3.5 text-amber-600" />,
    },
    financial: {
      title: '간편 가계부 요약',
      subtitle: `${dayFinancials.length}건`,
      icon: <CreditCard className="w-3.5 h-3.5 text-emerald-600" />,
    },
  };

  return (
    <aside className="w-full space-y-3 font-sans">
      {/* Sidebar Header with Reorder Hint & Reset */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-1.5">
          <Calendar className="w-4 h-4 text-theme-primary" />
          <h3 className="font-serif font-bold text-sm text-stone-900">
            위젯 대시보드 <span className="text-xs font-normal text-stone-500 font-sans">({formattedDate})</span>
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={resetOrder}
            title="위젯 기본 순서로 초기화"
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md text-[10px] flex items-center space-x-0.5"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">초기화</span>
          </button>
        </div>
      </div>

      <p className="text-[11px] text-stone-500 px-1 leading-snug">
        💡 위젯 핸들(<GripVertical className="w-3 h-3 inline text-stone-400" />)을 <b>꾹 누르고 드래그</b>하여 순서를 원하는 대로 배치할 수 있습니다.
      </p>

      {/* Draggable Widgets Stack */}
      <div className="space-y-3">
        {widgetOrder.map((id, index) => {
          const meta = widgetMetadata[id];
          const isCollapsed = !!collapsedMap[id];
          const isDragging = draggedWidgetId === id;
          const isOver = dragOverWidgetId === id;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
              className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
                isDragging
                  ? 'opacity-40 scale-98 border-theme-primary ring-2 ring-theme-primary/30'
                  : isOver
                  ? 'border-theme-primary bg-amber-50/30 scale-101 shadow-md ring-2 ring-theme-primary'
                  : 'border-stone-200/90 hover:border-stone-300'
              }`}
            >
              {/* Widget Header Bar */}
              <div className="p-3 bg-stone-50/70 border-b border-stone-100 flex items-center justify-between select-none">
                <div className="flex items-center space-x-2 min-w-0">
                  {/* Drag Grip Handle */}
                  <div
                    className="cursor-grab active:cursor-grabbing p-1 text-stone-400 hover:text-stone-700 rounded transition-colors touch-none"
                    title="드래그하여 위치 변경"
                  >
                    <GripVertical className="w-4 h-4" />
                  </div>

                  <div className="flex items-center space-x-1.5 min-w-0">
                    <div className="p-1 bg-white rounded-lg border border-stone-200 shadow-2xs">
                      {meta.icon}
                    </div>
                    <div className="truncate">
                      <h4 className="font-bold text-xs text-stone-800 truncate">{meta.title}</h4>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <span className="text-[10px] font-mono text-stone-500 bg-white px-1.5 py-0.5 rounded border border-stone-200/60 hidden sm:inline-block">
                    {meta.subtitle}
                  </span>

                  {/* Reorder Touch Buttons */}
                  <div className="flex items-center">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveWidget(index, 'up')}
                      className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20 hover:bg-stone-200/50 rounded"
                      title="위로 이동"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index === widgetOrder.length - 1}
                      onClick={() => moveWidget(index, 'down')}
                      className="p-1 text-stone-400 hover:text-stone-700 disabled:opacity-20 hover:bg-stone-200/50 rounded"
                      title="아래로 이동"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Collapse Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleCollapse(id)}
                    className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded transition-colors"
                  >
                    {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Widget Body */}
              {!isCollapsed && <div className="p-3 bg-white">{renderWidgetContent(id)}</div>}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
