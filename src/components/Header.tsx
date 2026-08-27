import React from 'react';
import { Calendar, CheckSquare, BookOpen, CreditCard, Smile, Cloud, Smartphone, Monitor, User, Palette, Bell, Sparkles, Download, LogIn, ShieldCheck } from 'lucide-react';
import { UserAccount } from '../types';
import { PlockClockIcon } from './PlockClockIcon';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAndroidView: boolean;
  setIsAndroidView: (val: boolean) => void;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  currentUser?: UserAccount | null;
  onOpenAuthModal?: () => void;
  onOpenAdminModal?: () => void;
  onOpenICalExport?: () => void;
  onOpenThemeNotificationModal?: () => void;
  onOpenDailyBriefing?: () => void;
  onOpenGeminiModal?: () => void;
  primaryColor?: string;
  notificationsEnabled?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isAndroidView,
  setIsAndroidView,
  isSyncing,
  lastSyncedAt,
  currentUser,
  onOpenAuthModal,
  onOpenAdminModal,
  onOpenICalExport,
  onOpenThemeNotificationModal,
  onOpenDailyBriefing,
  onOpenGeminiModal,
  primaryColor = '#C1876B',
  notificationsEnabled = true,
}) => {
  const navItems = [
    { id: 'planner', label: 'Planner' },
    { id: 'routine', label: 'Routines' },
    { id: 'diary', label: 'Diary' },
    { id: 'financial', label: 'Ledger' },
    { id: 'stickers', label: 'Gallery' },
    { id: 'sync', label: 'Account & DB' },
  ];

  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return '14:02';
    const date = new Date(isoString);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <header className="bg-[#FDFCF9] border-b border-[#1A1A1A]/10 sticky top-0 z-30 transition-all shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18">
          {/* Logo & Plock Branding */}
          <div
            className="flex items-center space-x-2.5 cursor-pointer group"
            onClick={() => setActiveTab('planner')}
            title="Plock 플래너 홈으로 이동"
          >
            <div className="relative transform group-hover:scale-105 transition-transform">
              <PlockClockIcon size={34} primaryColor={primaryColor} />
            </div>
            <div className="flex items-baseline space-x-1.5">
              <h1 className="text-xl sm:text-2xl font-serif font-extrabold tracking-tight text-[#1A1A1A]">
                Plock
              </h1>
              <span className="text-[10px] tracking-wider uppercase text-[#1A1A1A]/50 font-sans hidden sm:inline-block font-semibold">
                Planner & Calendar
              </span>
            </div>
          </div>

          {/* Desktop Editorial Navigation */}
          <nav className="hidden md:flex items-center space-x-5 lg:space-x-7 text-[11px] uppercase tracking-[0.18em] font-medium font-sans">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  style={isActive ? { borderColor: primaryColor, color: primaryColor } : {}}
                  className={`pb-1 transition-all ${
                    isActive
                      ? 'border-b-2 font-bold'
                      : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Status & Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5">
            {/* User Account Login / Profile Button */}
            {onOpenAuthModal && (
              <button
                onClick={onOpenAuthModal}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-stone-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 rounded-xl transition-all text-xs flex items-center space-x-1.5 shadow-2xs font-extrabold"
                title="계정 정보 및 로그인 / 회원가입"
              >
                <div
                  style={{ backgroundColor: currentUser?.avatarColor || primaryColor }}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-2xs"
                >
                  {currentUser ? (currentUser.username === 'admin' ? '👑' : currentUser.name ? currentUser.name.slice(0, 1) : currentUser.username.slice(0, 1).toUpperCase()) : <User className="w-3 h-3" />}
                </div>
                <span className="hidden md:inline text-[11px] font-bold text-stone-900">
                  {currentUser ? currentUser.name : '로그인/가입'}
                </span>
              </button>
            )}

            {/* Admin Management Button (Visible only to Admin) */}
            {(currentUser?.username === 'admin' || currentUser?.role === 'admin') && onOpenAdminModal && (
              <button
                onClick={onOpenAdminModal}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-amber-950 bg-amber-300 hover:bg-amber-400 border border-amber-500 rounded-xl transition-all text-xs flex items-center space-x-1.5 shadow-2xs font-extrabold animate-in fade-in"
                title="시스템 관리자: 전체 사용자 계정 조회 및 삭제 관리"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-900" />
                <span className="hidden sm:inline text-[11px]">사용자 관리</span>
              </button>
            )}

            {/* iCalendar (.ics) Import & Export Button */}
            {onOpenICalExport && (
              <button
                onClick={onOpenICalExport}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-stone-900 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-all text-xs flex items-center space-x-1.5 shadow-2xs font-bold"
                title="구글 캘린더 .ics 파일 불러오기 및 내보내기"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden lg:inline text-[11px]">구글 캘린더 연동</span>
              </button>
            )}

            {/* Daily Briefing Button */}
            {onOpenDailyBriefing && (
              <button
                onClick={onOpenDailyBriefing}
                className="p-1.5 sm:p-2 text-amber-900 bg-amber-100/80 hover:bg-amber-100 border border-amber-300 rounded-lg transition-all text-xs flex items-center space-x-1.5 shadow-2xs font-bold"
                title="오늘의 일정 & 루틴 데일리 브리핑 열기"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span className="hidden sm:inline text-[10px] uppercase tracking-wider font-extrabold text-amber-950">Daily Briefing</span>
              </button>
            )}

            {/* Google Gemini Account / API Key Setup Button */}
            {onOpenGeminiModal && (
              <button
                onClick={onOpenGeminiModal}
                className="p-1.5 sm:px-2.5 sm:py-1.5 text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all text-xs flex items-center space-x-1.5 shadow-2xs font-bold"
                title="개인 구글 계정 & Gemini API 연동 설정"
              >
                <span className="text-xs">🤖</span>
                <span className="hidden xl:inline text-[10px] uppercase tracking-wider font-extrabold text-blue-950">Gemini 연동</span>
              </button>
            )}

            {/* Theme & Notification Button */}
            {onOpenThemeNotificationModal && (
              <button
                onClick={onOpenThemeNotificationModal}
                className="p-1.5 sm:p-2 text-[#1A1A1A]/70 hover:text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-lg hover:border-[#1A1A1A]/30 transition-all text-xs flex items-center space-x-1 bg-white shadow-2xs"
                title="테마 색상 변경 & 푸시 알림 설정"
              >
                <div className="flex items-center space-x-1">
                  <span
                    style={{ backgroundColor: primaryColor }}
                    className="w-2.5 h-2.5 rounded-full border border-white shadow-2xs"
                  />
                  <Bell className={`w-3.5 h-3.5 ${notificationsEnabled ? 'text-theme-primary' : 'text-stone-400'}`} />
                </div>
              </button>
            )}

            {/* Cloud Sync Connected Badge */}
            <button
              onClick={() => setActiveTab('sync')}
              className="flex items-center space-x-1.5 text-[10px] text-[#849283] font-mono hover:text-[#1A1A1A] transition-colors px-1"
              title="계정별 데이터베이스 동기화 센터"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'animate-ping' : ''}`} style={{ backgroundColor: primaryColor }} />
              <span className="uppercase tracking-widest hidden sm:inline">
                {currentUser ? `SYNC ${formatSyncTime(lastSyncedAt)}` : `CLOUD ${formatSyncTime(lastSyncedAt)}`}
              </span>
            </button>

            {/* Android Device Toggle */}
            <button
              onClick={() => setIsAndroidView(!isAndroidView)}
              className="p-1.5 sm:p-2 text-[#1A1A1A]/60 hover:text-[#1A1A1A] border border-[#1A1A1A]/10 rounded-lg hover:border-[#1A1A1A]/30 transition-all text-xs flex items-center space-x-1"
              title={isAndroidView ? '웹 전체화면 보기' : '모바일 뷰 프레임'}
            >
              {isAndroidView ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[10px] uppercase tracking-wider">{isAndroidView ? 'Web' : 'Mobile'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Editorial Nav Bar */}
      <div className="md:hidden flex overflow-x-auto border-t border-[#1A1A1A]/10 bg-[#F5F2ED]/70 py-2 px-3 no-scrollbar gap-4 text-[11px] uppercase tracking-[0.14em] font-medium">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={isActive ? { color: primaryColor } : {}}
              className={`whitespace-nowrap transition-colors py-0.5 ${
                isActive ? 'font-bold underline underline-offset-4' : 'text-[#1A1A1A]/60'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </header>
  );
};



