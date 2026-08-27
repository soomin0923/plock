import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Image as ImageIcon,
  Check,
  X,
  Upload,
  CalendarDays,
  Sparkles,
  ExternalLink,
  Trash2,
  Tag,
  Palette,
  Settings,
  RotateCcw,
  PanelRightClose,
  PanelRight,
  LayoutDashboard,
  Filter
} from 'lucide-react';
import { PlannerItem, RoutineItem, ChecklistItem, FinancialItem, CustomCategory } from '../types';
import { DraggableWidgetSidebar } from './DraggableWidgetSidebar';

interface PlannerViewProps {
  plannerItems: PlannerItem[];
  setPlannerItems: React.Dispatch<React.SetStateAction<PlannerItem[]>>;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  categories: CustomCategory[];
  setCategories: React.Dispatch<React.SetStateAction<CustomCategory[]>>;
  onSyncGoogleCalendar?: (item: PlannerItem) => void;
  routines?: RoutineItem[];
  setRoutines?: React.Dispatch<React.SetStateAction<RoutineItem[]>>;
  checklist?: ChecklistItem[];
  setChecklist?: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  financials?: FinancialItem[];
  setFinancials?: React.Dispatch<React.SetStateAction<FinancialItem[]>>;
  onOpenBriefingModal?: () => void;
  onNavigateToTab?: (tab: string) => void;
  primaryColor?: string;
  onOpenICalExport?: () => void;
}

const PRESET_COLORS = [
  '#1A1A1A',
  '#C1876B',
  '#849283',
  '#7A6B58',
  '#B25D3B',
  '#3E5240',
  '#3B82F6',
  '#10B981',
  '#EC4899',
  '#8B5CF6',
  '#F59E0B',
  '#6366F1',
];

export const PlannerView: React.FC<PlannerViewProps> = ({
  plannerItems,
  setPlannerItems,
  selectedDate,
  setSelectedDate,
  categories,
  setCategories,
  onSyncGoogleCalendar,
  routines = [],
  setRoutines = () => {},
  checklist = [],
  setChecklist = () => {},
  financials = [],
  setFinancials = () => {},
  onOpenBriefingModal,
  onNavigateToTab,
  primaryColor = '#C1876B',
  onOpenICalExport,
}) => {
  const [viewType, setViewType] = useState<'month' | 'week' | 'day'>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null);
  
  // Notion Calendar Side Panel State
  const [isSideWidgetOpen, setIsSideWidgetOpen] = useState(true);
  const [mobileActiveTab, setMobileActiveTab] = useState<'calendar' | 'widgets'>('calendar');

  // Category Manager Modal States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('#3B82F6');

  // Form states for new/edited item
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(selectedDate);
  const [isRange, setIsRange] = useState(false);
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [category, setCategory] = useState<string>(categories[0]?.id || 'work');
  const [location, setLocation] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [syncToGCal, setSyncToGCal] = useState(true);

  // Selected date object helpers
  const selectedDateObj = new Date(selectedDate);
  const currentYear = selectedDateObj.getFullYear();
  const currentMonth = selectedDateObj.getMonth();

  // Get category style object dynamically
  const getCategoryStyle = (catIdOrName: string) => {
    const found = categories.find((c) => c.id === catIdOrName || c.name === catIdOrName);
    const color = found ? found.color : '#6B7280';
    const name = found ? found.name : (catIdOrName || '기타');
    return {
      name,
      color,
      bgStyle: { backgroundColor: `${color}18`, color: color, borderColor: `${color}35` },
      badgeStyle: { backgroundColor: `${color}20`, color: color, borderColor: `${color}40` },
      dotColor: color,
    };
  };

  // Month Calendar Navigation
  const prevMonth = () => {
    const d = new Date(currentYear, currentMonth - 1, 1);
    const newDateStr = formatDateStr(d);
    setSelectedDate(newDateStr);
  };

  const nextMonth = () => {
    const d = new Date(currentYear, currentMonth + 1, 1);
    const newDateStr = formatDateStr(d);
    setSelectedDate(newDateStr);
  };

  const prevDay = () => {
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatDateStr(d));
  };

  const nextDay = () => {
    const d = new Date(selectedDateObj);
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatDateStr(d));
  };

  function formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Days in month calculation
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    calendarDays.push({ dayNumber: d, dateStr });
  }

  // Get items for specific date (including period schedules)
  const getItemsForDate = (dateStr: string) => {
    return plannerItems.filter((item) => {
      const s = item.startDate || item.date;
      const e = item.endDate || item.date;
      if (s && e) {
        return dateStr >= s && dateStr <= e;
      }
      return item.date === dateStr;
    });
  };

  // Get items for current week
  const getItemsForCurrentWeek = () => {
    const curr = new Date(selectedDateObj);
    const first = curr.getDate() - curr.getDay(); // Sunday
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(curr.setDate(first + i));
      weekDates.push(formatDateStr(day));
    }
    return weekDates;
  };

  const weekDates = getItemsForCurrentWeek();

  // Handlers for Add/Edit
  const handleOpenAddModal = (initialDate?: string) => {
    const d = initialDate || selectedDate;
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setDate(d);
    setIsRange(false);
    setStartDate(d);
    setEndDate(d);
    setStartTime('10:00');
    setEndTime('11:00');
    setCategory(categories[0]?.id || 'work');
    setLocation('');
    setImages([]);
    setSyncToGCal(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: PlannerItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setDescription(item.description || '');
    setDate(item.date);
    const s = item.startDate || item.date;
    const e = item.endDate || item.date;
    setStartDate(s);
    setEndDate(e);
    setIsRange(item.isDateRange || s !== e);
    setStartTime(item.startTime || '10:00');
    setEndTime(item.endTime || '11:00');
    setCategory(item.category);
    setLocation(item.location || '');
    setImages(item.images || []);
    setSyncToGCal(item.isGoogleCalendarSynced || false);
    setIsModalOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      filesArray.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
          if (uploadEvent.target?.result) {
            setImages((prev) => [...prev, uploadEvent.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const catStyle = getCategoryStyle(category);
    const finalStartDate = isRange ? startDate : date;
    const finalEndDate = isRange ? endDate : date;
    const isDateRange = isRange && finalStartDate !== finalEndDate;

    if (editingItem) {
      const updated: PlannerItem = {
        ...editingItem,
        title,
        description,
        date: finalStartDate,
        startDate: finalStartDate,
        endDate: finalEndDate,
        isDateRange,
        startTime,
        endTime,
        category,
        color: catStyle.color,
        location,
        images,
        isGoogleCalendarSynced: syncToGCal,
      };
      setPlannerItems((prev) => prev.map((item) => (item.id === editingItem.id ? updated : item)));
      if (syncToGCal && onSyncGoogleCalendar) {
        onSyncGoogleCalendar(updated);
      }
    } else {
      const newItem: PlannerItem = {
        id: `plan_${Date.now()}`,
        title,
        description,
        date: finalStartDate,
        startDate: finalStartDate,
        endDate: finalEndDate,
        isDateRange,
        startTime,
        endTime,
        category,
        color: catStyle.color,
        isCompleted: false,
        location,
        images,
        isGoogleCalendarSynced: syncToGCal,
        createdAt: new Date().toISOString(),
      };
      setPlannerItems((prev) => [newItem, ...prev]);
      if (syncToGCal && onSyncGoogleCalendar) {
        onSyncGoogleCalendar(newItem);
      }
    }

    setIsModalOpen(false);
  };

  // Category Manager CRUD Handlers
  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const newCat: CustomCategory = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      color: newCatColor,
    };
    setCategories((prev) => [...prev, newCat]);
    setNewCatName('');
    setNewCatColor('#3B82F6');
  };

  const handleUpdateCategory = (id: string) => {
    if (!editCatName.trim()) return;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: editCatName.trim(), color: editCatColor } : c))
    );
    setEditingCatId(null);
  };

  const handleDeleteCategory = (id: string) => {
    if (categories.length <= 1) {
      alert('최소 1개 이상의 카테고리가 등록되어 있어야 합니다.');
      return;
    }
    if (window.confirm('이 카테고리를 삭제하시겠습니까?')) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const toggleItemComplete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlannerItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isCompleted: !item.isCompleted } : item))
    );
  };

  const deleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('이 계획 항목을 삭제하시겠습니까?')) {
      setPlannerItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const itemsForSelectedDate = getItemsForDate(selectedDate);

  return (
    <div className="p-2 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Header Bar & Notion-style Mode Controls */}
      <div className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-xs border border-stone-200/90 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-theme-soft border border-theme-soft text-theme-primary flex items-center justify-center font-bold shadow-2xs">
              <CalendarDays className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-bold text-stone-900 font-serif">
                  {currentYear}년 {currentMonth + 1}월
                </h2>
                <button
                  onClick={() => setSelectedDate(formatDateStr(new Date()))}
                  className="px-2 py-0.5 text-[11px] font-bold text-theme-primary bg-theme-soft border border-theme-soft rounded-md transition-colors shadow-2xs hover:opacity-90"
                  title="오늘 날짜로 이동"
                >
                  오늘
                </button>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 hidden sm:block">
                Notion Calendar 스타일 중앙 캘린더 & 드래그 위젯 패널
              </p>
            </div>
          </div>

          {/* Mobile Widget/Calendar Tab Switcher */}
          <div className="flex lg:hidden items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              onClick={() => setMobileActiveTab('calendar')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                mobileActiveTab === 'calendar'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              📅 캘린더
            </button>
            <button
              onClick={() => setMobileActiveTab('widgets')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                mobileActiveTab === 'widgets'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              📑 위젯
            </button>
          </div>
        </div>

        {/* View Mode & Controls on Desktop */}
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
          {/* View Mode Switcher (Month, Week, Day) */}
          <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-xl border border-stone-200">
            <button
              onClick={() => setViewType('month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewType === 'month'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200 font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              월별
            </button>
            <button
              onClick={() => setViewType('week')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewType === 'week'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200 font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              주간
            </button>
            <button
              onClick={() => setViewType('day')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewType === 'day'
                  ? 'bg-white text-stone-900 shadow-xs border border-stone-200 font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              일별
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-1.5">
            {onOpenICalExport && (
              <button
                onClick={onOpenICalExport}
                className="flex items-center justify-center space-x-1 bg-white hover:bg-stone-100 text-stone-800 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl shadow-2xs text-xs border border-stone-300 transition-all active:scale-98 cursor-pointer"
                title="구글 캘린더 .ics 파일 불러오기 및 내보내기"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">.ics 연동</span>
              </button>
            )}

            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center justify-center space-x-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl shadow-2xs text-xs border border-stone-200 transition-all active:scale-98 cursor-pointer"
              title="일정 카테고리 태그 및 색상 관리"
            >
              <Tag className="w-3.5 h-3.5 text-theme-primary" />
              <span className="hidden sm:inline">카테고리</span>
            </button>

            {/* Toggle Side Widgets Panel (Desktop) */}
            <button
              onClick={() => setIsSideWidgetOpen(!isSideWidgetOpen)}
              className={`hidden lg:flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-2xs ${
                isSideWidgetOpen
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
              }`}
              title={isSideWidgetOpen ? '위젯 패널 접기' : '위젯 패널 펼치기'}
            >
              {isSideWidgetOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
              <span>위젯 패널</span>
            </button>

            <button
              onClick={() => handleOpenAddModal()}
              className="flex items-center justify-center space-x-1.5 bg-theme-primary text-white font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-xs transition-all active:scale-98 hover:opacity-90 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>새 계획</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Notion Calendar Split Screen: Center Calendar + Right Draggable Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* CENTER STAGE: Calendar View (Month / Week / Day) */}
        <div
          className={`${
            isSideWidgetOpen ? 'lg:col-span-8' : 'lg:col-span-12'
          } ${mobileActiveTab === 'widgets' ? 'hidden lg:block' : 'block'} space-y-4 transition-all`}
        >
          {/* MONTH VIEW */}
          {viewType === 'month' && (
            <div className="bg-white rounded-2xl shadow-xs border border-stone-200/90 overflow-hidden">
              {/* Month Header Nav */}
              <div className="flex items-center justify-between p-3 sm:p-4 border-b border-stone-200 bg-stone-50/60">
                <button
                  onClick={prevMonth}
                  className="p-1.5 sm:p-2 hover:bg-stone-200/70 rounded-xl transition-colors text-stone-700 active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <span className="font-serif font-bold text-stone-900 text-base sm:text-lg">
                    {currentYear}년 {currentMonth + 1}월
                  </span>
                  <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                    {plannerItems.filter((i) => (i.startDate || i.date).startsWith(`${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}`)).length}건의 일정
                  </span>
                </div>
                <button
                  onClick={nextMonth}
                  className="p-1.5 sm:p-2 hover:bg-stone-200/70 rounded-xl transition-colors text-stone-700 active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 border-b border-stone-200 text-center text-[11px] sm:text-xs font-bold text-stone-500 py-2 bg-stone-100/60">
                <span className="text-rose-500">일</span>
                <span>월</span>
                <span>화</span>
                <span>수</span>
                <span>목</span>
                <span>금</span>
                <span className="text-blue-500">토</span>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-stone-200/70 min-h-[420px] sm:min-h-[520px]">
                {calendarDays.map((dayItem, idx) => {
                  if (!dayItem) {
                    return <div key={`empty_${idx}`} className="bg-stone-50/40 p-1 sm:p-2 min-h-[60px] sm:min-h-[85px]" />;
                  }

                  const { dayNumber, dateStr } = dayItem;
                  const isSelected = dateStr === selectedDate;
                  const items = getItemsForDate(dateStr);
                  const isToday = dateStr === formatDateStr(new Date());

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                      }}
                      className={`p-1 sm:p-1.5 min-h-[62px] sm:min-h-[88px] flex flex-col justify-start cursor-pointer transition-colors relative group hover:bg-theme-soft/30 ${
                        isSelected ? 'bg-theme-soft/70 ring-2 ring-theme-primary ring-inset' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={`text-[11px] sm:text-xs font-bold w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-colors ${
                            isToday
                              ? 'bg-theme-primary text-white shadow-xs'
                              : isSelected
                              ? 'text-theme-primary font-extrabold'
                              : 'text-stone-800'
                          }`}
                        >
                          {dayNumber}
                        </span>
                        {items.some((i) => i.images && i.images.length > 0) && (
                          <ImageIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-stone-400" />
                        )}
                      </div>

                      {/* Plan Badges & Indicators */}
                      <div className="space-y-0.5 sm:space-y-1 overflow-y-auto max-h-[50px] sm:max-h-[75px] no-scrollbar">
                        {items.slice(0, 3).map((item) => {
                          const catInfo = getCategoryStyle(item.category);
                          return (
                            <div
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditModal(item);
                              }}
                              style={catInfo.badgeStyle}
                              className={`text-[9px] sm:text-[11px] px-1 sm:px-1.5 py-0.5 rounded-md truncate flex items-center justify-between border group/badge ${
                                item.isCompleted ? 'line-through opacity-60' : ''
                              }`}
                            >
                              <span className="truncate">{item.title}</span>
                              <div className="flex items-center gap-0.5 flex-none ml-0.5">
                                {item.isGoogleCalendarSynced && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-none" title="구글 캘린더 연동됨" />
                                )}
                                <button
                                  onClick={(e) => deleteItem(item.id, e)}
                                  className="hidden group-hover/badge:inline-block text-rose-600 hover:text-rose-800"
                                  title="삭제"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {items.length > 3 && (
                          <div className="text-[8px] sm:text-[9px] font-bold text-stone-500 text-center leading-none">
                            +{items.length - 3}개 더보기
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {viewType === 'week' && (
            <div className="bg-white rounded-2xl shadow-xs border border-stone-200/90 p-3 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="font-bold text-stone-800 text-base sm:text-lg flex items-center gap-2 font-serif">
                  <CalendarIcon className="w-5 h-5 text-theme-primary" />
                  주간 계획 타임라인
                </h3>
                <span className="text-xs text-stone-500 font-mono">
                  {weekDates[0]} ~ {weekDates[6]}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-2.5">
                {weekDates.map((dateStr) => {
                  const dayItems = getItemsForDate(dateStr);
                  const isSelected = dateStr === selectedDate;
                  const dateObj = new Date(dateStr);
                  const dayName = ['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()];

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`border rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'border-theme-primary bg-theme-soft shadow-xs ring-1 ring-theme-primary'
                          : 'border-stone-200 bg-stone-50/40 hover:border-stone-300'
                      }`}
                    >
                      <div className="border-b border-stone-200/80 pb-1.5 mb-1.5 flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-stone-500">{dayName}요일</span>
                          <p className="font-bold text-xs sm:text-sm text-stone-800">{dateStr.slice(5)}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAddModal(dateStr);
                          }}
                          className="p-1 hover:bg-stone-200/60 rounded-md text-stone-600"
                          title="이 날짜에 계획 추가"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1 min-h-[80px] max-h-[160px] overflow-y-auto no-scrollbar">
                        {dayItems.length === 0 ? (
                          <p className="text-[10px] text-stone-400 italic text-center py-3">계획 없음</p>
                        ) : (
                          dayItems.map((item) => {
                            const catInfo = getCategoryStyle(item.category);
                            return (
                              <div
                                key={item.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditModal(item);
                                }}
                                style={catInfo.bgStyle}
                                className="p-1.5 rounded-lg text-[11px] border relative group"
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <p className={`font-semibold ${item.isCompleted ? 'line-through opacity-60' : ''}`}>
                                    {item.title}
                                  </p>
                                  <button
                                    onClick={(e) => deleteItem(item.id, e)}
                                    className="opacity-70 group-hover:opacity-100 text-rose-600 hover:text-rose-800 p-0.5 rounded"
                                    title="계획 삭제"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                                {item.startTime && (
                                  <p className="text-[9px] opacity-80 flex items-center gap-1 mt-0.5 font-mono">
                                    <Clock className="w-2.5 h-2.5" />
                                    {item.startTime}
                                  </p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DAY VIEW & SELECTED DATE DETAILS */}
          <div className="bg-white rounded-2xl shadow-xs border border-stone-200/90 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button
                  onClick={prevDay}
                  className="p-1.5 hover:bg-stone-100 rounded-lg border border-stone-200 text-stone-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-theme-primary">선택된 날짜 세부정보</span>
                  <h3 className="text-base sm:text-lg font-bold text-stone-900 font-serif">{selectedDate} 계획 및 기록</h3>
                </div>
                <button
                  onClick={nextDay}
                  className="p-1.5 hover:bg-stone-100 rounded-lg border border-stone-200 text-stone-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => handleOpenAddModal(selectedDate)}
                className="flex items-center space-x-1.5 bg-theme-primary hover:opacity-90 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{selectedDate} 일정 추가</span>
              </button>
            </div>

            {/* List of items on selected date */}
            {itemsForSelectedDate.length === 0 ? (
              <div className="text-center py-8 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200">
                <Sparkles className="w-7 h-7 text-stone-300 mx-auto mb-1.5" />
                <p className="text-stone-600 font-semibold text-xs sm:text-sm">등록된 계획이 아직 없습니다.</p>
                <p className="text-stone-400 text-xs mt-0.5">상단 버튼이나 AI 바를 통해 오늘 하루의 일정을 추가해보세요!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {itemsForSelectedDate.map((item) => {
                  const catInfo = getCategoryStyle(item.category);
                  return (
                    <div
                      key={item.id}
                      style={catInfo.bgStyle}
                      className="p-3.5 rounded-2xl border transition-all shadow-2xs hover:shadow-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={(e) => toggleItemComplete(item.id, e)}
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              item.isCompleted ? 'bg-theme-primary border-theme-primary text-white' : 'border-stone-300 bg-white'
                            }`}
                          >
                            {item.isCompleted && <Check className="w-3 h-3" />}
                          </button>
                          <span
                            style={catInfo.badgeStyle}
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold border"
                          >
                            {catInfo.name}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="text-[#1A1A1A]/60 hover:text-[#1A1A1A] text-xs px-2 py-0.5 rounded hover:bg-[#1A1A1A]/5 font-medium"
                          >
                            수정
                          </button>
                          <button
                            onClick={(e) => deleteItem(item.id, e)}
                            className="text-rose-600 hover:text-rose-800 text-xs px-1.5 py-0.5 rounded hover:bg-rose-50 font-medium flex items-center gap-0.5"
                            title="삭제"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <h4
                        onClick={() => handleOpenEditModal(item)}
                        className={`font-bold text-stone-900 text-sm sm:text-base mt-2 cursor-pointer hover:underline ${
                          item.isCompleted ? 'line-through opacity-60' : ''
                        }`}
                      >
                        {item.title}
                      </h4>

                      {item.description && <p className="text-xs text-stone-600 mt-1 line-clamp-2">{item.description}</p>}

                      <div className="flex flex-wrap items-center gap-2 mt-2.5 text-[11px] text-stone-500 font-mono">
                        {item.startDate && item.endDate && item.startDate !== item.endDate && (
                          <div className="flex items-center gap-1 text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            <CalendarIcon className="w-3 h-3" />
                            <span>{item.startDate} ~ {item.endDate}</span>
                          </div>
                        )}
                        {(item.startTime || item.endTime) && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-stone-400" />
                            <span>
                              {item.startTime} {item.endTime ? `~ ${item.endTime}` : ''}
                            </span>
                          </div>
                        )}
                        {item.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            <span>{item.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Image Attachments */}
                      {item.images && item.images.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-stone-200/60">
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            {item.images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt="첨부"
                                className="w-12 h-12 object-cover rounded-lg border border-stone-200 shadow-2xs flex-none cursor-pointer hover:scale-105 transition-transform"
                                onClick={() => window.open(img, '_blank')}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR: Draggable Reorderable Widget Panel (Notion Calendar Style) */}
        {isSideWidgetOpen && (
          <div
            className={`lg:col-span-4 ${
              mobileActiveTab === 'calendar' ? 'hidden lg:block' : 'block'
            } space-y-4`}
          >
            <DraggableWidgetSidebar
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              plannerItems={plannerItems}
              setPlannerItems={setPlannerItems}
              routines={routines}
              setRoutines={setRoutines}
              checklist={checklist}
              setChecklist={setChecklist}
              financials={financials}
              setFinancials={setFinancials}
              categories={categories}
              primaryColor={primaryColor}
              onOpenBriefingModal={onOpenBriefingModal}
              onOpenAddPlannerModal={handleOpenAddModal}
              onNavigateToTab={onNavigateToTab}
            />
          </div>
        )}
      </div>

      {/* CATEGORY MANAGEMENT MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2 text-stone-800">
                <Tag className="w-5 h-5 text-theme-primary" />
                <h3 className="font-bold text-stone-900 text-lg font-serif">카테고리 관리 & 색상 설정</h3>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Add New Category Form */}
            <form onSubmit={handleAddCategory} className="space-y-3 bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              <label className="text-xs font-bold text-stone-700 block">새 카테고리 추가</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="카테고리 이름 (예: 독서, 스터디)"
                  className="flex-1 px-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-theme-primary bg-white"
                />
                <button
                  type="submit"
                  disabled={!newCatName.trim()}
                  className="px-3 py-2 bg-theme-primary text-white rounded-lg text-xs font-bold hover:opacity-90 disabled:opacity-40"
                >
                  추가
                </button>
              </div>

              {/* Color Selector */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewCatColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${
                      newCatColor === c ? 'scale-125 border-stone-900 shadow-2xs' : 'border-white'
                    }`}
                  />
                ))}
              </div>
            </form>

            {/* Existing Categories List */}
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              <label className="text-xs font-bold text-stone-500 block uppercase">등록된 카테고리 목록</label>
              {categories.map((cat) => {
                const isEditing = editingCatId === cat.id;
                return (
                  <div
                    key={cat.id}
                    className="p-2.5 rounded-xl border border-stone-200 bg-white flex items-center justify-between"
                  >
                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border rounded"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateCategory(cat.id)}
                          className="px-2 py-1 bg-teal-600 text-white rounded text-xs font-bold"
                        >
                          저장
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <span
                          style={{ backgroundColor: cat.color }}
                          className="w-3.5 h-3.5 rounded-full border border-stone-300"
                        />
                        <span className="text-xs font-bold text-stone-800">{cat.name}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditCatName(cat.name);
                          setEditCatColor(cat.color);
                        }}
                        className="text-stone-500 hover:text-stone-800 text-xs px-2 py-1 rounded hover:bg-stone-100"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-rose-600 hover:text-rose-800 text-xs px-2 py-1 rounded hover:bg-rose-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PLANNER ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-bold text-stone-900 text-lg font-serif">
                {editingItem ? '계획 항목 수정' : '새 계획 추가'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-stone-700 block mb-1">제목</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="일정 제목을 입력하세요"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:ring-1 focus:ring-theme-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">카테고리</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Range Toggle */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-stone-700">날짜 설정</label>
                  <label className="flex items-center space-x-1 text-[11px] text-stone-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRange}
                      onChange={(e) => setIsRange(e.target.checked)}
                      className="rounded text-theme-primary focus:ring-0"
                    />
                    <span>기간 일정으로 설정 (~부터 ~까지)</span>
                  </label>
                </div>

                {isRange ? (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white"
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white"
                    />
                  </div>
                ) : (
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white"
                  />
                )}
              </div>

              {/* Time Slots */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-stone-700 block mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-stone-700 block mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-200 rounded-xl bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">장소 (선택)</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: 서울 강남역 3번 출구"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 block mb-1">세부 메모 (선택)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="일정 세부 내용 및 준비물 메모"
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none resize-none"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="font-bold text-stone-700 block mb-1">사진 및 첨부 이미지</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-stone-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-stone-100 file:text-stone-700 hover:file:bg-stone-200"
                />
                {images.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
                    {images.map((img, i) => (
                      <div key={i} className="relative group/img flex-none">
                        <img src={img} className="w-14 h-14 object-cover rounded-lg border" />
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1 -right-1 bg-rose-600 text-white rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Google Calendar Sync Checkbox */}
              <div className="pt-2">
                <label className="flex items-center space-x-2 text-xs text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToGCal}
                    onChange={(e) => setSyncToGCal(e.target.checked)}
                    className="rounded text-theme-primary focus:ring-0"
                  />
                  <span>구글 캘린더 (iCalendar 동기화)에 자동 반영</span>
                </label>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-theme-primary text-white font-bold hover:opacity-90 shadow-xs"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
