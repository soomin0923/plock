import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Flame,
  Bell,
  CheckSquare,
  ListTodo,
  Volume2,
  ChevronRight,
  Settings
} from 'lucide-react';
import { PlannerItem, RoutineItem, ChecklistItem, CustomCategory } from '../types';
import { isRoutineActiveOnDate, formatDaysLabel } from '../lib/routineUtils';
import { playNotificationSound, sendBrowserNotification } from '../lib/notificationService';

interface DailyBriefingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  plannerItems: PlannerItem[];
  routines: RoutineItem[];
  setRoutines: React.Dispatch<React.SetStateAction<RoutineItem[]>>;
  checklist: ChecklistItem[];
  setChecklist: React.Dispatch<React.SetStateAction<ChecklistItem[]>>;
  categories?: CustomCategory[];
  briefingTime: string; // HH:mm format, e.g., '08:00'
  setBriefingTime: (time: string) => void;
  briefingEnabled: boolean;
  setBriefingEnabled: (enabled: boolean) => void;
  showToast: (msg: string) => void;
}

export const DailyBriefingModal: React.FC<DailyBriefingModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  plannerItems,
  routines,
  setRoutines,
  checklist,
  setChecklist,
  categories = [],
  briefingTime,
  setBriefingTime,
  briefingEnabled,
  setBriefingEnabled,
  showToast,
}) => {
  const [showSettings, setShowSettings] = useState(false);

  if (!isOpen) return null;

  // Selected date formatted: YYYY-MM-DD
  const dateObj = new Date(selectedDate);
  const daysKr = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const formattedDateHeadline = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 ${daysKr[dateObj.getDay()]}`;

  // Filter Today's Planner Items
  const todayPlannerItems = plannerItems
    .filter((item) => item.date === selectedDate)
    .sort((a, b) => (a.startTime || '00:00').localeCompare(b.startTime || '00:00'));

  // Filter Today's Active Routines based on day selection
  const todayRoutines = routines.filter((r) => isRoutineActiveOnDate(r, selectedDate));
  const completedRoutinesCount = todayRoutines.filter((r) => r.completedDates.includes(selectedDate)).length;

  // Filter Today's Checklist Tasks due today
  const todayChecklist = checklist.filter((c) => c.dueDate === selectedDate);
  const completedChecklistCount = todayChecklist.filter((c) => c.isCompleted).length;

  // Toggle routine done
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

  // Toggle checklist done
  const handleToggleChecklist = (taskId: string) => {
    setChecklist((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t))
    );
  };

  // Trigger manual briefing alarm & notifications
  const handleTriggerBriefingNow = () => {
    playNotificationSound();
    sendBrowserNotification(
      `🌅 [Plock] ${formattedDateHeadline} 일정 브리핑`,
      `오늘 일정 ${todayPlannerItems.length}건, 실천 루틴 ${todayRoutines.length}건이 대기 중입니다.`
    );
    showToast('🌅 브리핑 알림과 오디오 차임벨을 성공적으로 재생했습니다!');
  };

  const getCategoryColor = (catId: string) => {
    const found = categories.find((c) => c.id === catId || c.name === catId);
    return found ? found.color : '#C1876B';
  };

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-[#FDFCF9] rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-[#1A1A1A]/10 space-y-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header Section */}
        <div className="flex items-start justify-between border-b border-[#1A1A1A]/10 pb-4">
          <div className="flex items-start space-x-3">
            <img
              src="/pwa-192x192.png"
              alt="Mascot Icon"
              className="w-12 h-12 rounded-2xl object-cover shadow-xs border border-amber-200 flex-none"
              referrerPolicy="no-referrer"
            />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  오늘의 일정 & 루틴 데일리 브리핑
                </span>
                <span className="text-xs font-mono text-stone-500">
                  BRIEFING @ {briefingTime}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1A1A1A]">
                {formattedDateHeadline}
              </h2>
              <p className="text-xs text-[#1A1A1A]/70 font-sans">
                오늘 하루 꼭 챙겨야 할 **일정 {todayPlannerItems.length}건**, **습관 루틴 {todayRoutines.length}건**, **마감 과제 {todayChecklist.length}건**을 종합 안내합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors"
              title="브리핑 시각 및 알림 설정"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Briefing Time & Notification Quick Config (Expandable or Top Banner) */}
        {showSettings && (
          <div className="p-4 bg-stone-100/80 rounded-2xl border border-stone-200/90 space-y-3 animate-fade-in text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-theme-primary" />
                자동 브리핑 시간 설정
              </span>
              <button
                onClick={() => setBriefingEnabled(!briefingEnabled)}
                className={`px-3 py-1 rounded-lg font-bold ${
                  briefingEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-stone-200 text-stone-600'
                }`}
              >
                {briefingEnabled ? '자동 알림 켜짐' : '자동 알림 꺼짐'}
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-stone-600">매일 브리핑 출력 시각:</label>
              <input
                type="time"
                value={briefingTime}
                onChange={(e) => setBriefingTime(e.target.value)}
                className="px-3 py-1.5 border border-stone-300 rounded-xl bg-white font-mono font-bold focus:ring-2 focus:ring-theme-primary"
              />
              <span className="text-[11px] text-stone-500">지정한 시간에 모바일 상단바 알림과 팝업이 함께 동작합니다.</span>
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-500/10 via-stone-100 to-amber-500/10 rounded-2xl border border-amber-200/60 text-xs">
          <div className="flex items-center space-x-2 text-amber-900 font-medium">
            <Bell className="w-4 h-4 text-amber-600 animate-bounce" />
            <span>상단 알림바 푸시 메시지 및 브리핑 오디오 테스트</span>
          </div>
          <button
            onClick={handleTriggerBriefingNow}
            className="px-3.5 py-1.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/80 text-white font-bold rounded-xl shadow-2xs flex items-center space-x-1 transition-transform active:scale-95"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>지금 브리핑 발송</span>
          </button>
        </div>

        {/* SECTION 1: TODAY'S PLANNER SCHEDULES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <h3 className="font-serif font-bold text-[#1A1A1A] text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-theme-primary" />
              오늘의 주요 일정 ({todayPlannerItems.length}건)
            </h3>
            <span className="text-xs text-stone-500 font-mono">
              {todayPlannerItems.filter((i) => i.isCompleted).length}/{todayPlannerItems.length} 완료됨
            </span>
          </div>

          {todayPlannerItems.length === 0 ? (
            <div className="p-6 bg-white/70 rounded-2xl border border-stone-200/80 text-center text-xs text-stone-400">
              오늘 등록된 일정이 없습니다. 여유로운 하루를 보내시거나 새로운 플래너 항목을 등록해보세요!
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {todayPlannerItems.map((item) => {
                const catColor = getCategoryColor(item.category);
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white rounded-xl border border-stone-200/80 shadow-2xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-1.5 h-10 rounded-full flex-none"
                        style={{ backgroundColor: catColor }}
                      />
                      <div>
                        <div className="flex items-center space-x-2">
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: `${catColor}15`,
                              color: catColor,
                              borderColor: `${catColor}40`,
                            }}
                          >
                            {item.category}
                          </span>
                          {item.startTime && (
                            <span className="text-xs font-mono font-bold text-stone-600 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              {item.startTime} {item.endTime ? `~ ${item.endTime}` : ''}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-stone-800 text-sm mt-0.5">{item.title}</h4>
                        {item.location && (
                          <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {item.location}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: TODAY'S ROUTINES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-stone-200 pb-2">
            <h3 className="font-serif font-bold text-[#1A1A1A] text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              오늘 실천할 습관 루틴 ({completedRoutinesCount}/{todayRoutines.length} 완료)
            </h3>
            <span className="text-xs text-stone-500">
              달성률 {todayRoutines.length > 0 ? Math.round((completedRoutinesCount / todayRoutines.length) * 100) : 0}%
            </span>
          </div>

          {todayRoutines.length === 0 ? (
            <div className="p-6 bg-white/70 rounded-2xl border border-stone-200/80 text-center text-xs text-stone-400">
              오늘 지정된 습관 루틴이 없습니다. 반복 루틴 메뉴에서 요일별 습관을 추가해보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {todayRoutines.map((routine) => {
                const isDone = routine.completedDates.includes(selectedDate);
                return (
                  <div
                    key={routine.id}
                    onClick={() => handleToggleRoutine(routine.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isDone ? 'bg-amber-50/60 border-amber-200/80' : 'bg-white border-stone-200/80 hover:border-stone-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-xl">{routine.icon || '🌟'}</span>
                      <div>
                        <div className="flex items-center space-x-1 text-[10px] text-stone-400 font-bold uppercase">
                          <span>{formatDaysLabel(routine.customDays, routine.frequency)}</span>
                        </div>
                        <h4 className={`font-bold text-xs ${isDone ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                          {routine.title}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Flame className="w-3 h-3 fill-amber-600 text-amber-600" />
                        {routine.streak}일
                      </span>
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          isDone ? 'bg-theme-primary border-theme-primary text-white' : 'border-stone-300 bg-white'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: TODAY'S CHECKLIST DEADLINES */}
        {todayChecklist.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <h3 className="font-serif font-bold text-[#1A1A1A] text-base flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-rose-600" />
                오늘 마감되는 체크리스트 ({completedChecklistCount}/{todayChecklist.length})
              </h3>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {todayChecklist.map((task) => (
                <div
                  key={task.id}
                  onClick={() => handleToggleChecklist(task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    task.isCompleted ? 'bg-stone-50 border-stone-200 opacity-60' : 'bg-white border-stone-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`w-4 h-4 rounded-xs border flex items-center justify-center ${
                        task.isCompleted ? 'bg-theme-primary border-theme-primary text-white' : 'border-stone-300'
                      }`}
                    >
                      {task.isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <h4 className={`font-bold text-xs ${task.isCompleted ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                        {task.title}
                      </h4>
                      {task.dueTime && <span className="text-[10px] text-stone-400 font-mono">마감 {task.dueTime}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-stone-200/80 flex items-center justify-between">
          <span className="text-[11px] text-stone-500 font-sans">
            Plock Daily Briefing System
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#1A1A1A]/80 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95"
          >
            오늘 하루 파이팅! (확인)
          </button>
        </div>

      </div>
    </div>
  );
};
