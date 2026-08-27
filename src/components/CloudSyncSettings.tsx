import React, { useState } from 'react';
import {
  Cloud,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Sparkles,
  Download,
  Upload,
  ShieldCheck,
  Zap,
  Bot,
  LogIn,
  LogOut,
  ExternalLink,
  Smartphone,
  Monitor,
  Layers,
  Smile,
  User,
  Users,
  UserPlus,
  FileDown
} from 'lucide-react';
import { CloudSyncState, PlannerItem, RoutineItem, DiaryEntry, FinancialEntry, UserCustomSticker, CustomCategory, ChecklistItem, UserAccount } from '../types';
import { GOOGLE_CALENDAR_IMPORT_URL } from '../lib/iCalendarExport';
import { getGoogleGeminiApiHeaders, getStoredUserGeminiConfig } from '../lib/geminiAuthService';

interface CloudSyncSettingsProps {
  syncState: CloudSyncState;
  onManualSync: () => void;
  onFetchCloudData?: () => void;
  onFetchServerData?: () => void;
  onUploadCloudData?: () => void;
  onResetAllData?: () => void;
  plannerItems: PlannerItem[];
  routines: RoutineItem[];
  checklist?: ChecklistItem[];
  diaries: DiaryEntry[];
  financials: FinancialEntry[];
  userStickers?: UserCustomSticker[];
  categories?: CustomCategory[];
  onImportData: (data: any) => void;
  currentUser?: UserAccount | null;
  onOpenAuthModal?: () => void;
  onOpenAdminModal?: () => void;
  onLogoutUser?: () => void;
  onOpenICalExport?: () => void;
  onOpenThemeNotificationModal?: () => void;
  onOpenGeminiModal?: () => void;
  primaryColor?: string;
}

export const CloudSyncSettings: React.FC<CloudSyncSettingsProps> = ({
  syncState,
  onManualSync,
  onFetchServerData,
  onUploadCloudData,
  onResetAllData,
  plannerItems,
  routines,
  checklist = [],
  diaries,
  financials,
  userStickers = [],
  categories = [],
  onImportData,
  currentUser,
  onOpenAuthModal,
  onOpenAdminModal,
  onLogoutUser,
  onOpenICalExport,
  onOpenThemeNotificationModal,
  onOpenGeminiModal,
  primaryColor = '#C1876B',
}) => {
  const [aiAnalysisText, setAiAnalysisText] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUserKeyActive, setIsUserKeyActive] = useState<boolean>(false);

  const userId = currentUser?.id || 'usr_guest';
  const geminiConfig = getStoredUserGeminiConfig(userId);
  const hasUserGeminiKey = Boolean(
    geminiConfig.geminiApiKey && geminiConfig.geminiApiKey.trim() && geminiConfig.useCustomGeminiKey !== false
  );

  // Request AI Insights
  const handleRequestAiCoaching = async () => {
    setIsAiLoading(true);
    try {
      const headers = getGoogleGeminiApiHeaders(userId);
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          diaryEntries: diaries,
          routines: routines,
          financials: financials,
          userId,
        }),
      });
      const data = await res.json();
      setAiAnalysisText(data.analysis || '오늘도 차근차근 계획을 달성하고 계시네요!');
      setIsUserKeyActive(Boolean(data.isUserApiKey));
    } catch (err) {
      setAiAnalysisText('클라우드 라이프 코치 연결 중: 계획과 다이어리를 꾸준히 작성하시는 모습이 매우 훌륭합니다!');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Export JSON Backup
  const handleExportJSON = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const userPrefix = currentUser ? `${currentUser.username}_` : '';
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const fileName = `plock_${userPrefix}backup_${timestampStr}.json`;

    const backupObj = {
      appName: 'Plock Planner & Diary',
      user: currentUser,
      exportedAt: now.toISOString(),
      lastSyncedAt: now.toISOString(),
      backupTimestamp: now.getTime(),
      plannerItems,
      routines,
      checklist,
      diaries,
      financials,
      userStickers,
      categories,
    };
    const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import JSON Backup
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target?.result as string);
          const backupTime = parsed.exportedAt || parsed.lastSyncedAt;
          const formattedTime = backupTime ? new Date(backupTime).toLocaleString('ko-KR') : '작성 일시 정보 없음';

          if (confirm(`[백업 일시: ${formattedTime}]\n선택하신 최신 백업 데이터로 현재 계정의 플래너/다이어리/가계부를 복원하시겠습니까?`)) {
            onImportData(parsed);
            alert(`데이터가 성공적으로 복원되었습니다! (백업 일시: ${formattedTime})`);
          }
        } catch (err) {
          alert('유효하지 않은 백업 파일 형식입니다.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Editorial Header */}
      <div className="border-b border-[#1A1A1A]/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] font-bold text-amber-800 mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Multi-User Account & Database Sync</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-semibold tracking-tight text-[#1A1A1A]">
            계정 관리 &amp; Firebase Firestore 클라우드 DB
          </h2>
          <p className="text-xs text-[#1A1A1A]/60 mt-1 font-sans">
            Firebase Firestore 영구 클라우드 데이터베이스와 연동되어 코드 업데이트나 재배포에도 모든 일정이 안전하게 보존됩니다.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 text-xs text-amber-900 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>접속 계정: {currentUser.name} (@{currentUser.username})</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-300 text-xs text-stone-600 font-bold">
              <span className="w-2 h-2 rounded-full bg-stone-400" />
              <span>로그인 필요</span>
            </div>
          )}
        </div>
      </div>

      {/* Account Info Banner & Quick Switch Card */}
      <div className="bg-[#FDFCF9] rounded-2xl p-6 border border-stone-300/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div
            style={{ backgroundColor: currentUser?.avatarColor || primaryColor }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-serif font-bold text-xl shadow-xs"
          >
            {currentUser ? (currentUser.name ? currentUser.name.slice(0, 1) : currentUser.username.slice(0, 1).toUpperCase()) : <User className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-serif font-bold text-stone-900 text-lg">
                {currentUser ? `${currentUser.name} 님의 전용 데이터베이스` : '게스트 모드 (로그인이 필요합니다)'}
              </h3>
              {currentUser && (
                <span className="text-[11px] font-mono bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                  @{currentUser.username}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {currentUser
                ? `회원가입 일시: ${new Date(currentUser.createdAt || Date.now()).toLocaleDateString('ko-KR')} | 데이터 격리 보관 활성화`
                : '회원가입하거나 기존 계정으로 로그인하여 나만의 독립 데이터베이스를 사용하세요.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center space-x-2 w-full md:w-auto">
          {(currentUser?.username === 'admin' || currentUser?.role === 'admin') && onOpenAdminModal && (
            <button
              onClick={onOpenAdminModal}
              className="px-4 py-2.5 text-amber-950 bg-amber-300 hover:bg-amber-400 border border-amber-500 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center space-x-1.5"
            >
              <ShieldCheck className="w-4 h-4 text-amber-900" />
              <span>👑 전체 사용자 계정 관리</span>
            </button>
          )}

          {onOpenAuthModal && (
            <button
              onClick={onOpenAuthModal}
              style={{ backgroundColor: primaryColor }}
              className="flex-1 md:flex-initial px-4 py-2.5 text-white font-bold text-xs rounded-xl shadow-xs hover:opacity-90 transition-all flex items-center justify-center space-x-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{currentUser ? '계정 정보 / 전환' : '로그인 / 회원가입'}</span>
            </button>
          )}

          {currentUser && onLogoutUser && (
            <button
              onClick={onLogoutUser}
              className="px-3 py-2.5 text-xs font-bold text-stone-700 hover:text-red-700 bg-stone-100 hover:bg-red-50 border border-stone-300 rounded-xl transition-colors flex items-center space-x-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>로그아웃</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 1. Dedicated Isolated Database Card */}
        <div className="bg-[#F5F2ED]/40 rounded-2xl p-6 sm:p-8 border border-[#1A1A1A]/10 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-4">
              <div className="flex items-center space-x-3">
                <ShieldCheck className="w-5 h-5 text-theme-primary" />
                <h3 className="font-serif font-semibold text-[#1A1A1A] text-lg">사용자별 독립 데이터베이스</h3>
              </div>
              <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                계정별 분리 저장 중
              </span>
            </div>

            <p className="text-xs text-[#1A1A1A]/70 leading-relaxed font-sans">
              작성하시는 모든 플래너, 루틴, 체크리스트, 다이어리, 가계부 데이터가 <b>현재 로그인된 사용자 계정의 독립 데이터베이스</b>에 자동으로 영구 보존됩니다. 다른 사용자의 데이터와 섞이지 않습니다.
            </p>

            <div className="p-4 bg-[#FDFCF9] rounded-xl border border-[#1A1A1A]/10 space-y-2 text-xs">
              <div className="flex justify-between text-[#1A1A1A]/80">
                <span>현재 계정 식별자 (ID)</span>
                <span className="font-mono font-bold text-amber-900">{currentUser?.id || 'usr_guest'}</span>
              </div>
              <div className="flex justify-between text-[#1A1A1A]/80">
                <span>보존된 데이터 항목</span>
                <span className="font-semibold text-[#1A1A1A]">
                  플래너 {plannerItems.length}개 / 체크리스트 {checklist.length}개 / 일기 {diaries.length}개 / 가계부 {financials.length}개
                </span>
              </div>
              <div className="flex justify-between text-[#1A1A1A]/80">
                <span>최근 동기화 일시</span>
                <span className="font-mono text-[#1A1A1A]/70">
                  {syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt).toLocaleString('ko-KR') : '실시간 저장 중'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={onUploadCloudData}
                className="py-3 px-4 bg-[#1A1A1A] hover:bg-[#1A1A1A]/80 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-widest shadow-2xs"
              >
                <Cloud className="w-4 h-4 text-amber-300" />
                <span>내 계정 DB에 즉시 저장</span>
              </button>

              <button
                onClick={onFetchServerData}
                className="py-3 px-4 bg-theme-primary hover:opacity-90 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-widest shadow-2xs"
              >
                <RefreshCw className={`w-4 h-4 ${syncState.isSyncing ? 'animate-spin' : ''}`} />
                <span>서버에서 내 데이터 다시 불러오기</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={handleExportJSON}
                className="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border border-[#1A1A1A]/20 hover:bg-[#FDFCF9] font-bold text-xs text-[#1A1A1A] transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#1A1A1A]/60" />
                <span>JSON 전체 백업</span>
              </button>

              <label className="cursor-pointer flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border border-[#1A1A1A]/20 hover:bg-[#FDFCF9] font-bold text-xs text-[#1A1A1A] transition-colors">
                <Upload className="w-3.5 h-3.5 text-[#1A1A1A]/60" />
                <span>백업 파일 복원</span>
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>

            {onOpenThemeNotificationModal && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onOpenThemeNotificationModal}
                  className="w-full py-2.5 bg-[#F5F2ED] hover:bg-[#EFEBE4] text-[#1A1A1A] font-bold rounded-xl border border-[#1A1A1A]/15 text-xs transition-colors flex items-center justify-center space-x-2 shadow-2xs"
                >
                  <Smile className="w-4 h-4 text-theme-primary" />
                  <span>🎨 테마 커스텀 색상 & 🔔 푸시 알림 설정</span>
                </button>
              </div>
            )}

            {onResetAllData && (
              <div className="pt-1">
                <button
                  onClick={onResetAllData}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 text-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <span>🗑️ 현재 사용자 데이터만 초기화 (0개에서 새로 시작)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2. iCalendar (.ics) Import & Export Card */}
        <div className="bg-[#F5F2ED]/40 rounded-2xl p-6 sm:p-8 border border-[#1A1A1A]/10 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1A1A]/10 pb-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-theme-primary" />
                <h3 className="font-serif font-semibold text-[#1A1A1A] text-lg">구글 캘린더 .ics 불러오기 &amp; 내보내기</h3>
              </div>
              <span className="text-[10px] uppercase tracking-widest px-3 py-1 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5">
                <FileDown className="w-3.5 h-3.5 text-amber-700" />
                양방향 연동 지원
              </span>
            </div>

            <p className="text-xs text-[#1A1A1A]/70 leading-relaxed font-sans">
              구글 캘린더나 애플 캘린더에서 다운로드받은 <b>.ics 파일</b>을 그대로 업로드하여 플래너에 추가하거나, 현재 등록된 일정들을 .ics 파일로 다운로드하여 구글 캘린더로 보낼 수 있습니다.
            </p>

            <div className="p-4 bg-[#FDFCF9] rounded-xl border border-[#1A1A1A]/10 space-y-2 text-xs">
              <div className="flex items-center justify-between text-[#1A1A1A]/80">
                <span className="font-medium">현재 등록된 일정</span>
                <span className="font-bold text-amber-900 font-mono">
                  플래너 {plannerItems.length}건 + 할 일 {checklist.length}건
                </span>
              </div>
              <div className="flex items-center justify-between text-[#1A1A1A]/80">
                <span>파일 불러오기 (Import)</span>
                <span className="font-semibold text-emerald-700">구글 .ics 파일 업로드 &amp; 일괄 등록</span>
              </div>
              <div className="flex items-center justify-between text-[#1A1A1A]/80">
                <span>파일 내보내기 (Export)</span>
                <span className="font-semibold text-stone-700">기간별/월별/전체 .ics 다운로드</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {onOpenICalExport && (
              <button
                onClick={onOpenICalExport}
                style={{ backgroundColor: primaryColor }}
                className="w-full py-3.5 text-white font-bold rounded-xl transition-all flex items-center justify-center space-x-2 text-xs uppercase tracking-widest shadow-md hover:opacity-95 cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-white" />
                <span>📥 구글 캘린더 .ics 파일 불러오기 &amp; 내보내기 열기</span>
              </button>
            )}

            <a
              href={GOOGLE_CALENDAR_IMPORT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <span>구글 캘린더 웹페이지 바로가기</span>
              <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
            </a>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 text-[11px] text-stone-600 space-y-1">
              <div className="font-bold text-amber-950 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>구글 캘린더 연동 3초 요약</span>
              </div>
              <p>
                1. <strong>[iCal 내보내기]</strong>를 눌러 .ics 다운로드 → 2. 위 링크 클릭 → 3. 다운로드한 파일 선택 후 <strong>'가져오기'</strong> 완료!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Gemini AI Life Coach Box in Editorial Theme */}
      <div className="bg-[#1A1A1A] text-[#FDFCF9] rounded-2xl p-6 sm:p-8 space-y-6 shadow-md border border-[#1A1A1A]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#FDFCF9]/15 pb-6">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-theme-primary text-white flex items-center justify-center font-serif text-xl font-bold">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-serif text-xl font-semibold">
                  Gemini AI Life Coach
                </h3>
                <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md font-sans border font-bold ${
                  hasUserGeminiKey
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                    : 'bg-stone-800 text-stone-300 border-stone-700'
                }`}>
                  {hasUserGeminiKey ? '🟢 내 구글 계정 전용 Key' : '시스템 공유 Key'}
                </span>
                {onOpenGeminiModal && (
                  <button
                    type="button"
                    onClick={onOpenGeminiModal}
                    className="text-[10px] text-amber-300 hover:text-amber-200 underline font-sans ml-1"
                  >
                    API 키 변경/설정 &gt;
                  </button>
                )}
              </div>
              <p className="text-xs text-[#FDFCF9]/60 font-sans mt-0.5">
                기록된 일기와 플래너 및 가계부 패턴을 기반으로 한 편의 에세이 같은 데일리 코칭 메시지를 선사합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenGeminiModal && (
              <button
                type="button"
                onClick={onOpenGeminiModal}
                className="px-3.5 py-3 rounded-xl border border-stone-700 hover:bg-stone-800 text-stone-300 text-xs font-bold transition-colors"
                title="Google Gemini 계정 및 API 키 설정"
              >
                ⚙️ 구글 Gemini 연동
              </button>
            )}
            <button
              onClick={handleRequestAiCoaching}
              disabled={isAiLoading}
              className="flex items-center justify-center space-x-2 bg-[#FDFCF9] text-[#1A1A1A] hover:bg-[#FDFCF9]/90 font-bold px-5 py-3 rounded-xl text-xs transition-all uppercase tracking-wider font-sans disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 text-theme-primary ${isAiLoading ? 'animate-spin' : ''}`} />
              <span>{isAiLoading ? '분석 진행 중...' : '맞춤 라이프 리포트 생성'}</span>
            </button>
          </div>
        </div>

        {/* AI Result Box */}
        {aiAnalysisText && (
          <div className="p-6 rounded-xl bg-[#FDFCF9]/10 border border-[#FDFCF9]/15 text-sm text-[#FDFCF9]/90 font-serif leading-relaxed animate-fade-in space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-sans font-bold text-[#C1876B] text-xs flex items-center gap-1.5 uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5" /> AI 라이프 코치의 당부
              </p>
              <span className="text-[10px] text-stone-400 font-mono">
                {isUserKeyActive ? '✨ 사용자 본인 구글 Gemini 3.7 분석' : '시스템 Gemini 분석'}
              </span>
            </div>
            <p className="whitespace-pre-wrap">{aiAnalysisText}</p>
          </div>
        )}
      </div>

      {/* Cross-Platform Execution & Export Packaging Center */}
      <div className="bg-[#F5F2ED]/60 rounded-2xl p-6 sm:p-8 border border-[#1A1A1A]/10 space-y-6">
        <div className="border-b border-[#1A1A1A]/10 pb-4">
          <div className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] font-bold text-[#849283] mb-1">
            <Layers className="w-3.5 h-3.5" />
            <span>Cross-Platform Deployment</span>
          </div>
          <h3 className="font-serif font-semibold text-[#1A1A1A] text-xl">
            PC (.exe) 및 갤럭시 스마트폰 (.apk / PWA) 연동 가이드
          </h3>
          <p className="text-xs text-[#1A1A1A]/60 mt-1 font-sans">
            Plock 애플리케이션은 표준 PWA(Progressive Web App) 기술을 완벽히 지원하여, Windows PC 데스크톱 앱 및 갤럭시 스마트폰 앱으로 즉시 설치할 수 있습니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Windows PC (.exe) Packaging */}
          <div className="bg-[#FDFCF9] rounded-xl p-5 border border-[#1A1A1A]/10 space-y-3">
            <div className="flex items-center space-x-2 text-[#1A1A1A]">
              <Monitor className="w-5 h-5 text-[#C1876B]" />
              <h4 className="font-serif font-semibold text-base">1. Windows PC 데스크톱 앱 설치</h4>
            </div>
            <ul className="text-xs text-[#1A1A1A]/80 space-y-2 list-disc list-inside font-sans leading-relaxed">
              <li>
                <strong>PWA 데스크톱 앱 설치</strong>: Chrome 또는 Edge 브라우저 주소창 우측의 <span className="font-mono bg-[#1A1A1A]/5 px-1.5 py-0.5 rounded text-[11px]">'앱 설치 (모니터 아이콘)'</span> 버튼을 누르면 윈도우 바탕화면과 시작 메뉴에 Plock 데스크톱 앱이 설치됩니다.
              </li>
              <li>
                <strong>iCalendar 파일 연동</strong>: 윈도우 기본 캘린더나 Outlook에서도 다운로드한 <code className="font-mono text-amber-900">.ics</code> 파일을 더블클릭하면 즉시 일정이 등록됩니다.
              </li>
            </ul>
          </div>

          {/* Samsung Galaxy App (.apk / PWA) Packaging */}
          <div className="bg-[#FDFCF9] rounded-xl p-5 border border-[#1A1A1A]/10 space-y-3">
            <div className="flex items-center space-x-2 text-[#1A1A1A]">
              <Smartphone className="w-5 h-5 text-[#849283]" />
              <h4 className="font-serif font-semibold text-base">2. 삼성 갤럭시 / 모바일 연동 방법</h4>
            </div>
            <ul className="text-xs text-[#1A1A1A]/80 space-y-2 list-disc list-inside font-sans leading-relaxed">
              <li>
                <strong>홈 화면에 앱으로 추가</strong>: 갤럭시 디바이스의 삼성 인터넷 또는 크롬 브라우저에서 메뉴(<span className="font-mono bg-[#1A1A1A]/5 px-1.5 py-0.5 rounded text-[11px]">⋮</span>) → <span className="font-mono bg-[#1A1A1A]/5 px-1.5 py-0.5 rounded text-[11px]">'현재 페이지 추가'</span> → <span className="font-mono bg-[#1A1A1A]/5 px-1.5 py-0.5 rounded text-[11px]">'홈 화면'</span>을 누르면 일반 모바일 앱처럼 사용할 수 있습니다.
              </li>
              <li>
                <strong>삼성 캘린더 연동</strong>: .ics 파일을 스마트폰에서 다운로드 후 터치하면 삼성 캘린더에 바로 저장됩니다.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};


