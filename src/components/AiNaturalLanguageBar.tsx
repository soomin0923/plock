import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  CheckSquare,
  Repeat,
  ArrowRight,
  Clock,
  Tag,
  AlertCircle,
  Check,
  X,
  ChevronRight,
  Zap,
  Info,
  Loader2,
  CalendarRange,
} from 'lucide-react';
import { CustomCategory, PlannerItem, ChecklistItem, RoutineItem, UserAccount } from '../types';
import { parseNaturalLanguageTask, ParsedTaskResult, formatDateYMD, calculateDurationDays } from '../lib/aiDateParser';
import { getStoredUserGeminiConfig } from '../lib/geminiAuthService';

interface AiNaturalLanguageBarProps {
  selectedDate: string; // YYYY-MM-DD
  categories: CustomCategory[];
  onAddPlannerItem: (item: PlannerItem) => void;
  onAddChecklistItem: (item: ChecklistItem) => void;
  onAddRoutineItem: (item: RoutineItem) => void;
  showToast: (msg: string) => void;
  primaryColor?: string;
  className?: string;
  currentUser?: UserAccount | null;
  onOpenGeminiModal?: () => void;
}

const QUICK_EXAMPLES = [
  '금요일부터 일요일까지 제주도 여행',
  '이번 주 목요일부터 다음 주 월요일까지 휴가',
  '8월 28일부터 8월 30일까지 집중 프로젝트',
  '내일부터 모레까지 발표 자료 준비',
  '이번 주 일요일까지 집청소하기',
  '내일 오후 3시 팀 프로젝트 회의',
];

export const AiNaturalLanguageBar: React.FC<AiNaturalLanguageBarProps> = ({
  selectedDate,
  categories,
  onAddPlannerItem,
  onAddChecklistItem,
  onAddRoutineItem,
  showToast,
  primaryColor = '#C1876B',
  className = '',
  currentUser,
  onOpenGeminiModal,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ParsedTaskResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const userId = currentUser?.id || 'usr_guest';
  const geminiConfig = getStoredUserGeminiConfig(userId);
  const hasUserGeminiKey = Boolean(
    geminiConfig.geminiApiKey && geminiConfig.geminiApiKey.trim() && geminiConfig.useCustomGeminiKey !== false
  );

  // Editable fields within review modal
  const [editTitle, setEditTitle] = useState('');
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editActionType, setEditActionType] = useState<'both' | 'planner' | 'checklist' | 'routine'>('both');

  const todayStr = selectedDate || formatDateYMD(new Date());

  const handleParseAndReview = async (textToParse?: string) => {
    const targetText = (textToParse || inputPrompt).trim();
    if (!targetText) {
      showToast('⚠️ 일정이나 할 일을 자연어로 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await parseNaturalLanguageTask(targetText, todayStr, categories, userId);
      setPreviewResult(result);

      // Populate edit states
      setEditTitle(result.title);
      const sDate = result.startDate || result.targetDate || todayStr;
      const eDate = result.endDate || result.targetDate || sDate;
      setEditStartDate(sDate);
      setEditEndDate(eDate);
      setIsRangeMode(result.isDateRange || sDate !== eDate);

      setEditStartTime(result.startTime || '10:00');
      setEditEndTime(result.endTime || '11:00');
      setEditCategory(result.categoryId || categories[0]?.id || 'other');
      setEditPriority(result.priority || 'medium');
      setEditActionType(result.actionType || 'both');

      setIsModalOpen(true);
    } catch (err: any) {
      showToast('입력 문장 분석 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyResult = (overrideActionType?: 'both' | 'planner' | 'checklist' | 'routine') => {
    if (!previewResult && !editTitle) return;

    const action = overrideActionType || editActionType;
    const finalTitle = editTitle.trim() || previewResult?.title || '새 일정/할 일';
    const finalStartDate = editStartDate || todayStr;
    const finalEndDate = isRangeMode ? (editEndDate || finalStartDate) : finalStartDate;
    const isRange = isRangeMode && finalStartDate !== finalEndDate;
    const duration = calculateDurationDays(finalStartDate, finalEndDate);

    const finalCategory = editCategory || previewResult?.categoryId || 'other';
    const finalPriority = editPriority || previewResult?.priority || 'medium';
    const finalStartTime = editStartTime || previewResult?.startTime;
    const finalEndTime = editEndTime || previewResult?.endTime;

    const addedItemsDesc: string[] = [];

    // 1. Add to Planner
    if (action === 'both' || action === 'planner') {
      const newPlannerItem: PlannerItem = {
        id: `planner_ai_${Date.now()}`,
        title: finalTitle,
        date: finalStartDate,
        startDate: finalStartDate,
        endDate: finalEndDate,
        isDateRange: isRange,
        startTime: finalStartTime || undefined,
        endTime: finalEndTime || undefined,
        category: finalCategory,
        description: previewResult?.description || (isRange
          ? `[${finalStartDate} ~ ${finalEndDate} (${duration}일간)] ${inputPrompt || finalTitle}`
          : `AI 자동 등록 일정 (${inputPrompt || finalTitle})`),
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      onAddPlannerItem(newPlannerItem);
      addedItemsDesc.push('📅 캘린더 일정');
    }

    // 2. Add to Checklist
    if (action === 'both' || action === 'checklist') {
      const newChecklistItem: ChecklistItem = {
        id: `checklist_ai_${Date.now()}`,
        title: finalTitle,
        dueDate: finalEndDate, // target deadline
        startDate: finalStartDate,
        endDate: finalEndDate,
        isDateRange: isRange,
        dueTime: finalStartTime || undefined,
        priority: finalPriority,
        category: finalCategory,
        memo: previewResult?.description || (isRange
          ? `[기간: ${finalStartDate} ~ ${finalEndDate} (${duration}일간)] ${inputPrompt || finalTitle}`
          : `AI 자동 등록 할 일 (${inputPrompt || finalTitle})`),
        isCompleted: false,
        createdAt: new Date().toISOString(),
      };
      onAddChecklistItem(newChecklistItem);
      addedItemsDesc.push('✅ 체크리스트 할 일');
    }

    // 3. Add to Routine (if selected)
    if (action === 'routine') {
      const newRoutine: RoutineItem = {
        id: `routine_ai_${Date.now()}`,
        title: finalTitle,
        category: finalCategory,
        frequency: previewResult?.routineFrequency || 'daily',
        timeOfDay: 'anytime',
        streak: 0,
        completedDates: [],
        reminderTime: finalStartTime || undefined,
      };
      onAddRoutineItem(newRoutine);
      addedItemsDesc.push('🔄 매일 실천 루틴');
    }

    const dateNotice = isRange
      ? `[${finalStartDate} ~ ${finalEndDate} (${duration}일간)]`
      : `[${finalStartDate}]`;

    showToast(
      `✨ AI 자동 등록 완료: ${dateNotice} '${finalTitle}' (${addedItemsDesc.join(' + ')})`
    );

    // Reset
    setInputPrompt('');
    setIsModalOpen(false);
    setPreviewResult(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleParseAndReview();
    }
  };

  const formatDisplayDateWithDay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      return `${dateStr} (${days[d.getDay()]})`;
    } catch {
      return dateStr;
    }
  };

  const currentDurationDays = calculateDurationDays(editStartDate, editEndDate);

  return (
    <div className={`w-full ${className}`}>
      {/* Top AI Natural Language Card */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 text-stone-100 rounded-2xl p-4 sm:p-5 shadow-lg border border-stone-700/80 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div
          className="absolute -right-10 -top-10 w-44 h-44 rounded-full opacity-20 blur-2xl pointer-events-none"
          style={{ backgroundColor: primaryColor }}
        />

        <div className="relative z-10 space-y-3">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shadow-xs border border-white/20"
                style={{ backgroundColor: `${primaryColor}30`, color: primaryColor }}
              >
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                    LLM 스마트 자연어 자동 분류기 & 기간(~부터 ~까지)
                  </span>
                  {onOpenGeminiModal && (
                    <button
                      type="button"
                      onClick={onOpenGeminiModal}
                      className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer ${
                        hasUserGeminiKey
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/35'
                          : 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30'
                      }`}
                      title="Google Gemini 계정 및 API 키 설정 열기"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${hasUserGeminiKey ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
                      <span>{hasUserGeminiKey ? '내 구글 Gemini 3.7 연동됨' : '구글 Gemini 연동 설정'}</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-400">
                  날짜 범위("~부터 ~까지"), 시작/종료일, 상대 날짜("이번 주 일요일까지"), 할 일을 입력하면 캘린더와 체크리스트에 자동 연동됩니다.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end sm:self-auto">
              <span className="hidden md:inline-flex items-center text-[11px] text-stone-400 font-mono bg-stone-800/80 px-2.5 py-1 rounded-lg border border-stone-700">
                오늘 기준: <strong className="text-amber-300 ml-1">{todayStr}</strong>
              </span>
            </div>
          </div>

          {/* Main Input Form */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: 금요일부터 일요일까지 제주도 여행 / 이번 주 목요일부터 다음 주 월요일까지 휴가 / 내일 15시 회의"
                className="w-full bg-stone-800/90 border border-stone-700/80 hover:border-stone-600 focus:border-amber-400/80 rounded-xl px-4 py-3 text-sm text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition-all font-sans"
              />
              {inputPrompt && (
                <button
                  onClick={() => setInputPrompt('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleParseAndReview()}
              disabled={isLoading || !inputPrompt.trim()}
              style={{ backgroundColor: primaryColor }}
              className="px-5 py-3 rounded-xl font-bold text-sm text-stone-900 hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center space-x-2 shadow-md shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-stone-900" />
                  <span>AI 분석 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-stone-900" />
                  <span>일정 & 할 일 자동 생성</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Example Chips */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[11px] font-medium text-stone-400 mr-1 flex items-center">
              <Zap className="w-3 h-3 text-amber-400 mr-1 inline" /> 빠른 예시 클릭:
            </span>
            {QUICK_EXAMPLES.map((example, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputPrompt(example);
                  handleParseAndReview(example);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-stone-800/80 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700/60 transition-all text-left truncate max-w-[260px] sm:max-w-none cursor-pointer"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Parsed Review & Confirmation Modal */}
      {isModalOpen && previewResult && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#FDFCF9] rounded-3xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-stone-900 text-stone-100 flex items-center justify-between border-b border-stone-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">AI 자동 분류 분석 결과 확인</h3>
                  <p className="text-[11px] text-stone-400 font-mono truncate max-w-xs">
                    "{previewResult.description || inputPrompt}"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-100 p-1.5 rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-[#1A1A1A]">
              {/* AI Reasoning Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start space-x-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold text-amber-900 block">💡 AI 날짜/기간 추정 및 분석 근거</span>
                  <p className="text-amber-800 leading-relaxed font-sans">{previewResult.reasoning}</p>
                </div>
              </div>

              {/* Classification Cards */}
              <div className="space-y-3">
                {/* 1. Title / What */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    🎯 할 일 / 일정 제목 (What)
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>

                {/* 2. Date Mode Selector (Single Date vs Period Range) */}
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <CalendarRange className="w-4 h-4 text-amber-700" />
                      <span className="text-xs font-bold text-stone-800">일정 기간 설정 (~부터 ~까지)</span>
                    </div>

                    <div className="flex items-center bg-stone-200/80 p-0.5 rounded-lg text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRangeMode(false);
                          setEditEndDate(editStartDate);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          !isRangeMode
                            ? 'bg-white text-stone-900 shadow-xs font-bold'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        단일 날짜
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRangeMode(true);
                        }}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          isRangeMode
                            ? 'bg-white text-amber-800 shadow-xs font-bold'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        기간 (~부터 ~까지)
                      </button>
                    </div>
                  </div>

                  {isRangeMode ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                        <div>
                          <label className="text-[11px] font-semibold text-stone-600 block mb-0.5">
                            🚩 시작 날짜 (Start Date)
                          </label>
                          <input
                            type="date"
                            value={editStartDate}
                            onChange={(e) => {
                              setEditStartDate(e.target.value);
                              if (e.target.value > editEndDate) {
                                setEditEndDate(e.target.value);
                              }
                            }}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                          />
                          <span className="text-[10px] text-stone-500 mt-0.5 block">
                            {formatDisplayDateWithDay(editStartDate)}
                          </span>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-stone-600 block mb-0.5">
                            🏁 끝나는 날짜 (End Date)
                          </label>
                          <input
                            type="date"
                            value={editEndDate}
                            min={editStartDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                          />
                          <span className="text-[10px] text-stone-500 mt-0.5 block">
                            {formatDisplayDateWithDay(editEndDate)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-amber-100/60 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-semibold">
                        <span className="flex items-center gap-1">
                          <span>📅 총 기간:</span>
                          <strong className="text-amber-800 font-bold">{currentDurationDays}일간</strong>
                        </span>
                        <span className="text-[11px] text-amber-700">
                          {editStartDate} ~ {editEndDate}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-semibold text-stone-600 block mb-0.5">
                        📅 일정 날짜
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => {
                          setEditStartDate(e.target.value);
                          setEditEndDate(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      />
                      <span className="text-[11px] text-stone-500 mt-0.5 block">
                        {formatDisplayDateWithDay(editStartDate)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Time Resolution */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    ⏰ 시작 및 종료 시간
                  </label>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="time"
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-800"
                    />
                    <span className="text-xs text-stone-400">~</span>
                    <input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-stone-300 rounded-xl text-xs font-mono text-stone-800"
                    />
                  </div>
                </div>

                {/* 4. Category & Priority */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      🏷️ 자동 분류 카테고리
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-sans text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">
                      ⚡ 우선순위 (Priority)
                    </label>
                    <div className="flex items-center space-x-2 pt-1">
                      {(['low', 'medium', 'high'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditPriority(p)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                            editPriority === p
                              ? p === 'high'
                                ? 'bg-rose-100 border-rose-400 text-rose-800 font-bold'
                                : p === 'medium'
                                ? 'bg-amber-100 border-amber-400 text-amber-800 font-bold'
                                : 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold'
                              : 'bg-stone-100 border-stone-200 text-stone-600 hover:bg-stone-200/60'
                          }`}
                        >
                          {p === 'high' ? '높음' : p === 'medium' ? '보통' : '낮음'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5. Action Target Selector */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1.5">
                    🚀 등록 대상 영역 선택
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditActionType('both')}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                        editActionType === 'both'
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 text-amber-950 font-bold'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <Zap className="w-4 h-4 text-amber-600 shrink-0" />
                      <div className="text-xs">
                        <div>캘린더 + 할 일 동시 등록</div>
                        <div className="text-[10px] text-stone-500 font-normal">추천: 캘린더 일정 & 체크리스트</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditActionType('planner')}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                        editActionType === 'planner'
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 text-blue-950 font-bold'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      <div className="text-xs">
                        <div>캘린더 일정만</div>
                        <div className="text-[10px] text-stone-500 font-normal">기간/월별 플래너에 추가</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditActionType('checklist')}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                        editActionType === 'checklist'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 font-bold'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div className="text-xs">
                        <div>체크리스트 할 일만</div>
                        <div className="text-[10px] text-stone-500 font-normal">To-do 목록에 마감 기한 추가</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditActionType('routine')}
                      className={`p-2.5 rounded-xl border text-left flex items-center space-x-2.5 transition-all cursor-pointer ${
                        editActionType === 'routine'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 text-purple-950 font-bold'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <Repeat className="w-4 h-4 text-purple-600 shrink-0" />
                      <div className="text-xs">
                        <div>반복 실천 루틴</div>
                        <div className="text-[10px] text-stone-500 font-normal">매일/주말 연속 실천 트래커</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-stone-100 border-t border-stone-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-colors cursor-pointer"
              >
                취소
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleApplyResult('both')}
                  style={{ backgroundColor: primaryColor }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-stone-900 hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4 text-stone-900" />
                  <span>
                    {editActionType === 'both'
                      ? '캘린더 & 할 일에 즉시 등록'
                      : editActionType === 'planner'
                      ? '캘린더 일정으로 등록'
                      : editActionType === 'checklist'
                      ? '체크리스트 할 일로 등록'
                      : '루틴으로 등록'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
