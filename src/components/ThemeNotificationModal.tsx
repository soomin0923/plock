import React, { useState } from 'react';
import {
  Palette,
  Bell,
  X,
  Check,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  ShieldCheck,
  Smartphone,
  AlertCircle
} from 'lucide-react';
import { ThemeSettings, NotificationSettings } from '../types';
import { requestBrowserNotificationPermission, playNotificationSound, sendBrowserNotification } from '../lib/notificationService';

interface ThemeNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  themeSettings: ThemeSettings;
  setThemeSettings: React.Dispatch<React.SetStateAction<ThemeSettings>>;
  notificationSettings: NotificationSettings;
  setNotificationSettings: React.Dispatch<React.SetStateAction<NotificationSettings>>;
  onTriggerTestNotification: () => void;
  showToast: (msg: string) => void;
}

export const THEME_PRESETS = [
  { id: 'amber', name: '에디토리얼 앰버', color: '#C1876B', desc: '따뜻하고 감성적인 로즈골드 앰버' },
  { id: 'sage', name: '세이지 그린', color: '#5F7561', desc: '차분하고 평온한 자연의 유기농 그린' },
  { id: 'navy', name: '클래식 네이비', color: '#2C3E50', desc: '지적이고 또렷한 정통 잉크 블루' },
  { id: 'rose', name: '선셋 코랄', color: '#E07A5F', desc: '포근하고 화사한 따스한 코랄' },
  { id: 'purple', name: '로열 라벤더', color: '#7B61FF', desc: '우아하고 창의적인 영감의 보라' },
  { id: 'charcoal', name: '미니멀 차콜', color: '#1A1A1A', desc: '시크하고 명확한 블랙 매트' },
];

export const ThemeNotificationModal: React.FC<ThemeNotificationModalProps> = ({
  isOpen,
  onClose,
  themeSettings,
  setThemeSettings,
  notificationSettings,
  setNotificationSettings,
  onTriggerTestNotification,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'theme' | 'notification'>('theme');
  const [customHex, setCustomHex] = useState(themeSettings.primaryColor);

  if (!isOpen) return null;

  const handleSelectPreset = (presetId: string, color: string) => {
    setThemeSettings({
      presetName: presetId,
      primaryColor: color,
    });
    setCustomHex(color);
    showToast(`🎨 테마 색상이 선택되었습니다!`);
  };

  const handleCustomHexChange = (hex: string) => {
    setCustomHex(hex);
    setThemeSettings({
      presetName: 'custom',
      primaryColor: hex,
    });
  };

  const handleRequestPermission = async () => {
    const granted = await requestBrowserNotificationPermission();
    setNotificationSettings((prev) => ({
      ...prev,
      permissionGranted: granted,
      enabled: granted ? true : prev.enabled,
    }));
    if (granted) {
      showToast('🔔 브라우저 알림 권한이 허용되었습니다!');
    } else {
      showToast('⚠️ 브라우저 알림 권한이 거부되었거나 차단되었습니다.');
    }
  };

  const currentPermissionStatus = 'Notification' in window ? Notification.permission : 'not_supported';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header & Tabs */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setActiveTab('theme')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'theme'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>테마 커스텀</span>
            </button>
            <button
              onClick={() => setActiveTab('notification')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all ${
                activeTab === 'notification'
                  ? 'bg-stone-900 text-white shadow-2xs'
                  : 'text-stone-500 hover:bg-stone-100'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>푸시 알림</span>
            </button>
          </div>

          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* TAB 1: THEME CUSTOMIZATION */}
        {activeTab === 'theme' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-1.5 mb-1">
                <Palette className="w-4 h-4 text-amber-600" />
                <span>대표 포인트 테마 색상 선택</span>
              </h3>
              <p className="text-xs text-stone-500">
                어플리케이션 전반의 버튼, 강조 뱃지, 포인트 액센트에 적용됩니다.
              </p>
            </div>

            {/* Color Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {THEME_PRESETS.map((preset) => {
                const isSelected = themeSettings.primaryColor.toLowerCase() === preset.color.toLowerCase();
                return (
                  <button
                    key={preset.id}
                    onClick={() => handleSelectPreset(preset.id, preset.color)}
                    className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between h-24 ${
                      isSelected
                        ? 'border-stone-900 ring-2 ring-stone-900/10 shadow-sm bg-stone-50/50'
                        : 'border-stone-200/80 hover:border-stone-300 hover:bg-stone-50/30'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        style={{ backgroundColor: preset.color }}
                        className="w-5 h-5 rounded-full border border-white shadow-2xs"
                      />
                      {isSelected && <Check className="w-4 h-4 text-stone-900 font-bold" />}
                    </div>
                    <div>
                      <p className="font-bold text-xs text-stone-800">{preset.name}</p>
                      <p className="text-[10px] text-stone-400 truncate mt-0.5">{preset.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Hex Color Picker */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2">
              <label className="block text-xs font-bold text-stone-700">🎨 사용자 지정 헥사(Hex) 색상 직접 입력</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  className="w-10 h-10 p-0.5 rounded-xl border border-stone-300 cursor-pointer bg-white flex-none"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => handleCustomHexChange(e.target.value)}
                  placeholder="#C1876B"
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>
            </div>

            {/* Live Theme Preview Box */}
            <div className="p-4 rounded-xl border border-stone-200/80 space-y-3 bg-stone-50/50">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">미리보기 (Preview)</span>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  style={{ backgroundColor: themeSettings.primaryColor }}
                  className="px-4 py-2 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95"
                >
                  주요 액션 버튼
                </button>
                <span
                  style={{
                    backgroundColor: `${themeSettings.primaryColor}20`,
                    color: themeSettings.primaryColor,
                    borderColor: `${themeSettings.primaryColor}40`,
                  }}
                  className="px-3 py-1 text-xs font-bold rounded-full border"
                >
                  포인트 뱃지
                </span>
                <span
                  style={{ color: themeSettings.primaryColor }}
                  className="text-xs font-bold underline underline-offset-4"
                >
                  하이라이트 텍스트
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PUSH NOTIFICATION SETTINGS */}
        {activeTab === 'notification' && (
          <div className="space-y-5">
            <div>
              <h3 className="font-bold text-stone-800 text-sm flex items-center gap-1.5 mb-1">
                <Bell className="w-4 h-4 text-theme-primary" />
                <span>임박한 일정 웹 & 모바일 작업창 푸시 알림</span>
              </h3>
              <p className="text-xs text-stone-500">
                다가오는 일정과 할 일 시작 시각에 맞춰 휴대폰 상단 작업 창(시스템 알림바) 및 웹 팝업으로 실시간 푸시를 발송합니다.
              </p>
            </div>

            {/* Permission Check Status Banner */}
            <div className="p-3.5 rounded-xl border border-stone-200/80 bg-stone-50 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <ShieldCheck
                  className={`w-5 h-5 ${
                    currentPermissionStatus === 'granted' ? 'text-emerald-600' : 'text-theme-primary'
                  }`}
                />
                <div>
                  <p className="text-xs font-bold text-stone-800">
                    {currentPermissionStatus === 'granted'
                      ? '휴대폰 & 브라우저 알림 권한 허용됨'
                      : currentPermissionStatus === 'denied'
                      ? '알림 권한 차단됨 (휴대폰 브라우저 설정에서 변경 가능)'
                      : '모바일 작업창 알림 권한 허용 필요'}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    휴대폰 상단 작업 표시줄 알림 센터에 시스템 알림으로 표시됩니다.
                  </p>
                </div>
              </div>

              {currentPermissionStatus !== 'granted' && (
                <button
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-theme-primary hover:opacity-90 text-white font-bold text-xs rounded-lg shadow-2xs whitespace-nowrap"
                >
                  권한 요청
                </button>
              )}
            </div>

            {/* Main Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border border-stone-200/80">
              <div>
                <p className="font-bold text-xs text-stone-800">모바일 & 웹 푸시 알림 활성화</p>
                <p className="text-[10px] text-stone-500">
                  앱 실행 및 모바일 상단 알림창에 임박 일정 전송
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    enabled: !prev.enabled,
                  }))
                }
                style={{
                  backgroundColor: notificationSettings.enabled ? themeSettings.primaryColor : '#D1D5DB',
                }}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out relative flex items-center`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ${
                    notificationSettings.enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notification Time Threshold Dropdown */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-stone-500" />
                <span>알림 발생 시점 (Lead Time)</span>
              </label>
              <select
                value={notificationSettings.leadMinutes}
                onChange={(e) =>
                  setNotificationSettings((prev) => ({
                    ...prev,
                    leadMinutes: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-theme-primary bg-white"
              >
                <option value={0}>시작 시각 정각 (0분 전)</option>
                <option value={5}>시작 5분 전</option>
                <option value={10}>시작 10분 전</option>
                <option value={15}>시작 15분 전 (추천)</option>
                <option value={30}>시작 30분 전</option>
                <option value={60}>시작 1시간 전</option>
              </select>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-stone-200/80">
              <div className="flex items-center space-x-2">
                {notificationSettings.soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-theme-primary" />
                ) : (
                  <VolumeX className="w-4 h-4 text-stone-400" />
                )}
                <div>
                  <p className="font-bold text-xs text-stone-800">알림 효과음 재생</p>
                  <p className="text-[10px] text-stone-500">알림 도착 시 청량한 오디오 멜로디 차임벨 재생</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextSound = !notificationSettings.soundEnabled;
                  setNotificationSettings((prev) => ({ ...prev, soundEnabled: nextSound }));
                  if (nextSound) playNotificationSound();
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${
                  notificationSettings.soundEnabled
                    ? 'bg-theme-soft text-theme-primary border-theme-soft'
                    : 'bg-stone-200 text-stone-600 border-stone-300'
                }`}
              >
                {notificationSettings.soundEnabled ? '켜짐' : '꺼짐'}
              </button>
            </div>

            {/* Test Notification Action */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
              <button
                type="button"
                onClick={onTriggerTestNotification}
                className="px-4 py-2 bg-theme-primary hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center space-x-1.5 transition-all active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🔔 휴대폰 상단 작업창 푸시 테스트</span>
              </button>

              <p className="text-[10px] text-stone-400">모바일 작업창 & 브라우저 푸시지원</p>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="pt-3 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs shadow-2xs"
          >
            확인 및 저장
          </button>
        </div>
      </div>
    </div>
  );
};
