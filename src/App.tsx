import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PlannerView } from './components/PlannerView';
import { RoutineChecklist } from './components/RoutineChecklist';
import { DiaryView } from './components/DiaryView';
import { FinancialView } from './components/FinancialView';
import { StickerGallery } from './components/StickerGallery';
import { CloudSyncSettings } from './components/CloudSyncSettings';
import { ThemeNotificationModal } from './components/ThemeNotificationModal';
import { DailyBriefingModal } from './components/DailyBriefingModal';
import { TodayMorningWidget } from './components/TodayMorningWidget';
import { NotificationBanner } from './components/NotificationBanner';
import { NxpBoardModal } from './components/NxpBoardModal';
import { AiNaturalLanguageBar } from './components/AiNaturalLanguageBar';
import { AuthModal } from './components/AuthModal';
import { AdminUserModal } from './components/AdminUserModal';
import { ICalExportModal } from './components/ICalExportModal';
import { GoogleGeminiAccountModal } from './components/GoogleGeminiAccountModal';
import { nxpSerial, NxpConnectionState } from './lib/nxpSerialService';
import {
  getStoredActiveUser,
  setStoredActiveUser,
  clearStoredActiveUser,
  fetchUserCloudData,
  saveUserCloudData,
  resetUserCloudData,
} from './lib/authService';

import {
  DEFAULT_CATEGORIES,
  INITIAL_PLANNER_ITEMS,
  INITIAL_ROUTINES,
  INITIAL_CHECKLIST,
  INITIAL_DIARIES,
  INITIAL_FINANCIALS,
  INITIAL_PRESET_STICKERS,
  INITIAL_USER_STICKERS,
} from './data/initialData';

import {
  PlannerItem,
  RoutineItem,
  ChecklistItem,
  DiaryEntry,
  FinancialEntry,
  UserCustomSticker,
  CloudSyncState,
  CustomCategory,
  ThemeSettings,
  NotificationSettings,
  UpcomingNotificationAlert,
  UserAccount,
} from './types';

import { initAuth, googleSignIn, signOutUser, getAuthToken } from './lib/firebaseAuth';
import {
  performTwoWayGoogleCalendarSync,
  plannerItemToGoogleEvent,
  deduplicatePlannerItems,
  deduplicateDiaries,
  deduplicateFinancials,
} from './lib/calendarSyncService';
import { createGoogleCalendarEvent, updateGoogleCalendarEvent } from './lib/googleCalendar';
import { playNotificationSound, sendBrowserNotification, registerServiceWorker } from './lib/notificationService';
import { saveAppDataToGoogleDrive, fetchAppDataFromGoogleDrive } from './lib/googleDriveSync';

const hexToRgba = (hex: string, alpha: number) => {
  let c = hex ? hex.replace('#', '') : 'C1876B';
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(193, 135, 107, ${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};
import { User } from 'firebase/auth';

const getTodayStr = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('planner');
  const [isAndroidView, setIsAndroidView] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  // User Account Management State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => getStoredActiveUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isICalExportOpen, setIsICalExportOpen] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);

  // Auth & Google User
  const [authUser, setAuthUser] = useState<User | null>(null);

  // Core Data States (Initialized as empty arrays / default categories)
  const [categories, setCategories] = useState<CustomCategory[]>(DEFAULT_CATEGORIES);
  const [plannerItems, setPlannerItems] = useState<PlannerItem[]>([]);
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [financials, setFinancials] = useState<FinancialEntry[]>([]);
  const [userStickers, setUserStickers] = useState<UserCustomSticker[]>([]);

  // Theme & Notification States
  const [isThemeNotificationModalOpen, setIsThemeNotificationModalOpen] = useState(false);

  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => {
    try {
      const saved = localStorage.getItem('chronicle_theme_settings');
      return saved ? JSON.parse(saved) : { primaryColor: '#C1876B', presetName: 'amber' };
    } catch (e) {
      return { primaryColor: '#C1876B', presetName: 'amber' };
    }
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('chronicle_notification_settings');
      return saved
        ? JSON.parse(saved)
        : {
            enabled: true,
            leadMinutes: 15,
            soundEnabled: true,
            permissionGranted: typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted',
          };
    } catch (e) {
      return { enabled: true, leadMinutes: 15, soundEnabled: true, permissionGranted: false };
    }
  });

  const [upcomingAlerts, setUpcomingAlerts] = useState<UpcomingNotificationAlert[]>([]);
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(new Set());

  // Daily Briefing States
  const [isDailyBriefingOpen, setIsDailyBriefingOpen] = useState(false);
  const [isNxpModalOpen, setIsNxpModalOpen] = useState(false);
  const [nxpConnectionState, setNxpConnectionState] = useState<NxpConnectionState>(nxpSerial.getState());

  // Listen to NXP Serial State
  useEffect(() => {
    return nxpSerial.subscribeState(setNxpConnectionState);
  }, []);
  const [briefingTime, setBriefingTime] = useState<string>(() => {
    try {
      return localStorage.getItem('chronicle_briefing_time') || '08:00';
    } catch (e) {
      return '08:00';
    }
  });
  const [briefingEnabled, setBriefingEnabled] = useState<boolean>(() => {
    try {
      const val = localStorage.getItem('chronicle_briefing_enabled');
      return val !== null ? JSON.parse(val) : true;
    } catch (e) {
      return true;
    }
  });
  const [lastBriefedDate, setLastBriefedDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem('chronicle_last_briefed_date') || null;
    } catch (e) {
      return null;
    }
  });

  // Initial load lock to prevent overwriting cloud/local data on startup
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Register Service Worker on startup for mobile OS notification support
  useEffect(() => {
    registerServiceWorker();
  }, []);

  // Persist briefing settings
  useEffect(() => {
    try {
      localStorage.setItem('chronicle_briefing_time', briefingTime);
      localStorage.setItem('chronicle_briefing_enabled', JSON.stringify(briefingEnabled));
    } catch (e) {}
  }, [briefingTime, briefingEnabled]);

  // Automatic Time-based Daily Briefing Checker Effect (checks every 20 seconds)
  useEffect(() => {
    if (!briefingEnabled) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMins}`;
      const todayStr = getTodayStr();

      if (currentTimeStr === briefingTime && lastBriefedDate !== todayStr) {
        setLastBriefedDate(todayStr);
        try {
          localStorage.setItem('chronicle_last_briefed_date', todayStr);
        } catch (e) {}

        // Open briefing modal and trigger alerts
        setIsDailyBriefingOpen(true);
        playNotificationSound();
        sendBrowserNotification(
          `🌅 [Plock] 오늘의 일정 & 루틴 데일리 브리핑`,
          `오늘의 일정과 실천 습관 루틴을 확인하고 보람찬 하루를 준비하세요!`
        );
        showToast('🌅 설정한 시각에 맞춰 오늘의 데일리 브리핑이 도착했습니다!');
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [briefingTime, briefingEnabled, lastBriefedDate]);

  // Save Theme Settings & Apply CSS variable
  useEffect(() => {
    try {
      localStorage.setItem('chronicle_theme_settings', JSON.stringify(themeSettings));
    } catch (e) {}
    const color = themeSettings.primaryColor || '#C1876B';
    document.documentElement.style.setProperty('--primary-color', color);
    document.documentElement.style.setProperty('--primary-color-bg', hexToRgba(color, 0.12));
    document.documentElement.style.setProperty('--primary-color-border', hexToRgba(color, 0.35));
    document.documentElement.style.setProperty('--theme-primary', color);
  }, [themeSettings]);

  // Save Notification Settings
  useEffect(() => {
    try {
      localStorage.setItem('chronicle_notification_settings', JSON.stringify(notificationSettings));
    } catch (e) {}
  }, [notificationSettings]);

  // Real-Time Interval Scanner for Upcoming Events
  useEffect(() => {
    if (!notificationSettings.enabled || !isDataLoaded) return;

    const checkUpcomingEvents = () => {
      const now = new Date();
      const todayStr = getTodayStr();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const newAlerts: UpcomingNotificationAlert[] = [];

      // Check Planner Items
      plannerItems.forEach((item) => {
        if (item.isCompleted || item.date !== todayStr || !item.startTime) return;
        if (notifiedIds.has(item.id)) return;

        const [h, m] = item.startTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;

        const eventMinutes = h * 60 + m;
        const diffMinutes = eventMinutes - currentMinutes;

        if (diffMinutes >= 0 && diffMinutes <= notificationSettings.leadMinutes) {
          const categoryObj = categories.find((c) => c.id === item.category);

          const alertObj: UpcomingNotificationAlert = {
            id: item.id,
            title: item.title,
            time: item.startTime,
            categoryName: categoryObj?.name || '일정',
            itemType: 'planner',
            dueMinutesLeft: diffMinutes,
          };

          newAlerts.push(alertObj);
          setNotifiedIds((prev) => new Set(prev).add(item.id));

          // Trigger Web Push Notification
          sendBrowserNotification(
            `⏰ 일정 알림: ${item.title}`,
            `${item.startTime} 시작 (${diffMinutes === 0 ? '지금' : `${diffMinutes}분 후`})`
          );

          // Audio chime
          if (notificationSettings.soundEnabled) {
            playNotificationSound();
          }

          // Trigger NXP DEVKIT-MPC5748G Hardware LED Alert
          nxpSerial.sendScheduleAlert(categoryObj?.name || item.category, item.title);
        }
      });

      // Check Checklist Items
      checklist.forEach((item) => {
        if (item.isCompleted || item.dueDate !== todayStr || !item.dueTime) return;
        if (notifiedIds.has(item.id)) return;

        const [h, m] = item.dueTime.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;

        const eventMinutes = h * 60 + m;
        const diffMinutes = eventMinutes - currentMinutes;

        if (diffMinutes >= 0 && diffMinutes <= notificationSettings.leadMinutes) {
          const alertObj: UpcomingNotificationAlert = {
            id: item.id,
            title: `[할 일] ${item.title}`,
            time: item.dueTime,
            itemType: 'checklist',
            dueMinutesLeft: diffMinutes,
          };

          newAlerts.push(alertObj);
          setNotifiedIds((prev) => new Set(prev).add(item.id));

          sendBrowserNotification(
            `⏰ 할 일 알림: ${item.title}`,
            `${item.dueTime} 예정 (${diffMinutes === 0 ? '지금' : `${diffMinutes}분 후`})`
          );

          if (notificationSettings.soundEnabled) {
            playNotificationSound();
          }

          // Trigger NXP Hardware Alert
          nxpSerial.sendScheduleAlert('checklist', item.title);
        }
      });

      if (newAlerts.length > 0) {
        setUpcomingAlerts((prev) => [...newAlerts, ...prev]);
      }
    };

    // Run initial check and set interval every 15s
    checkUpcomingEvents();
    const interval = setInterval(checkUpcomingEvents, 15000);
    return () => clearInterval(interval);
  }, [plannerItems, checklist, notificationSettings, isDataLoaded, notifiedIds, categories]);

  const handleTriggerTestNotification = () => {
    const testAlert: UpcomingNotificationAlert = {
      id: `test_${Date.now()}`,
      title: '📌 테스트 푸시 알림: 디자인 팀 주간 회의',
      time: '14:00',
      categoryName: '업무',
      itemType: 'planner',
      dueMinutesLeft: notificationSettings.leadMinutes,
    };

    setUpcomingAlerts((prev) => [testAlert, ...prev]);

    sendBrowserNotification(
      '🔔 Plock 푸시 알림 테스트',
      `일정 시작 ${notificationSettings.leadMinutes}분 전 알림이 수신되었습니다!`
    );

    if (notificationSettings.soundEnabled) {
      playNotificationSound();
    }

    // Trigger NXP Hardware Alert (Rainbow test pattern)
    nxpSerial.sendScheduleAlert('업무', '테스트 푸시 알림');

    showToast('🔔 테스트 푸시 알림 및 NXP 보드 신호가 발송되었습니다!');
  };

  // Hardware Triggered Handlers (when SW1, SW2, SW3, SW4 are pressed on MPC5748G)
  const handleTaskCompleteByHardware = () => {
    const todayStr = getTodayStr();

    // Check routines first
    const pendingRoutine = routines.find((r) => !r.completedDates.includes(todayStr));
    if (pendingRoutine) {
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === pendingRoutine.id
            ? { ...r, completedDates: [...r.completedDates, todayStr], streak: r.streak + 1 }
            : r
        )
      );
      nxpSerial.sendSuccessCelebration();
      showToast(`🎯 NXP 보드(SW1) 신호 수신: '${pendingRoutine.title}' 루틴 완료! (DS4+DS5 2회 점멸 피드백)`);
      return;
    }

    // Check checklist next
    const pendingChecklist = checklist.find((c) => !c.isCompleted && c.dueDate === todayStr);
    if (pendingChecklist) {
      setChecklist((prev) =>
        prev.map((c) => (c.id === pendingChecklist.id ? { ...c, isCompleted: true } : c))
      );
      nxpSerial.sendSuccessCelebration();
      showToast(`🎯 NXP 보드(SW1) 신호 수신: '${pendingChecklist.title}' 할 일 완료! (DS4+DS5 2회 점멸 피드백)`);
      return;
    }

    // Check planner item
    const pendingPlanner = plannerItems.find((p) => !p.isCompleted && p.date === todayStr);
    if (pendingPlanner) {
      setPlannerItems((prev) =>
        prev.map((p) => (p.id === pendingPlanner.id ? { ...p, isCompleted: true } : p))
      );
      nxpSerial.sendSuccessCelebration();
      showToast(`🎯 NXP 보드(SW1) 신호 수신: '${pendingPlanner.title}' 일정 완료! (DS4+DS5 2회 점멸 피드백)`);
      return;
    }

    nxpSerial.sendSuccessCelebration();
    showToast('🔘 NXP 보드(SW1) 신호 수신: 오늘의 모든 일정이 이미 완료되었습니다! (All Clear)');
  };

  const handleNextTrackByHardware = () => {
    const tabOrder: string[] = ['planner', 'routine', 'diary', 'financial'];
    setActiveTab((prev) => {
      const curIdx = tabOrder.indexOf(prev);
      const nextTab = tabOrder[(curIdx + 1) % tabOrder.length];
      const tabNames: Record<string, string> = {
        planner: '📅 데일리/위클리 타임테이블 플래너',
        routine: '🔄 21일 습관 & 데일리 루틴 체크리스트',
        diary: '📖 다이어리 & 일기 기록장',
        financial: '💰 가계부 & 재정 자산 관리',
        stickers: '🎨 스티커 갤러리',
        sync: '☁️ 클라우드 동기화',
      };
      showToast(`⏭️ NXP 보드(SW2) 신호 수신: [${tabNames[nextTab] || nextTab}] 화면으로 전환되었습니다.`);
      return nextTab;
    });
  };

  const handleSnoozeByHardware = () => {
    if (upcomingAlerts.length > 0) {
      const first = upcomingAlerts[0];
      setUpcomingAlerts((prev) => prev.slice(1));
      nxpSerial.sendRaw('LED:OFF\n');
      showToast(`🔕 NXP 보드(SW3) 신호 수신: '${first.title}' 알림을 10분 스누즈하고 온보드 LED를 껐습니다.`);
    } else {
      nxpSerial.sendRaw('LED:OFF\n');
      showToast('🔕 NXP 보드(SW3) 신호 수신: 현재 알림 및 온보드 LED 점멸을 껐습니다.');
    }
  };

  const handleCycleModeByHardware = (modeName?: string) => {
    const modes = [
      { id: 'CODING_DS4', label: '🔴 코딩테스트 트랙 (DS4 4회 고속 점멸)', pattern: 'CODING_DS4' as const },
      { id: 'HINT_DS5', label: '🎓 HINT 직무 교육 트랙 (DS5 3회 점멸)', pattern: 'HINT_DS5' as const },
      { id: 'SM_PINGPONG', label: '🚀 SM 취업 로드맵 트랙 (DS4 ↔ DS5 교차 핑퐁 점멸)', pattern: 'SM_PINGPONG' as const },
      { id: 'TOEIC_SYNC', label: '🎯 TOEIC 800 트랙 (DS4 + DS5 동시 점멸)', pattern: 'TOEIC_SYNC' as const },
    ];

    const currentIdx = modes.findIndex((m) => m.pattern === nxpSerial.getConfig().activeTrackPattern);
    const nextMode = modes[(currentIdx + 1) % modes.length];

    nxpSerial.setBoardPattern(nextMode.pattern);
    showToast(`🔄 NXP 보드(SW4) 신호 수신: [${nextMode.label}] 모드로 LED 점멸 패턴이 전환되었습니다!`);
  };

  const handleDismissAlert = (id: string) => {
    setUpcomingAlerts((prev) => prev.filter((a) => a.id !== id));
  };


  // Cloud Sync State
  const [syncState, setSyncState] = useState<CloudSyncState>({
    lastSyncedAt: new Date().toISOString(),
    isSyncing: false,
    autoSync: true,
    googleCalendarConnected: true,
    googleAccountEmail: 'minsoominsoo@inha.edu',
  });

  const filterDummyItems = <T extends { id?: string }>(list?: T[]): T[] => {
    if (!list || !Array.isArray(list)) return [];
    return list.filter((item) => item && typeof item === 'object');
  };

  // Helper function to merge lists by unique ID without wiping existing items
  const mergeArraysById = <T extends { id?: string }>(primary?: T[], secondary?: T[]): T[] => {
    if (!primary && !secondary) return [];
    const validPrimary = filterDummyItems(primary);
    const validSecondary = filterDummyItems(secondary);
    if (validPrimary.length === 0) return validSecondary;
    if (validSecondary.length === 0) return validPrimary;

    const map = new Map<string, T>();
    validSecondary.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    validPrimary.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  // Load User Data (Local-first + Server isolated database)
  const loadUserData = async (targetUser?: UserAccount | null) => {
    const userToLoad = targetUser !== undefined ? targetUser : currentUser;
    const userId = userToLoad?.id || 'usr_guest';
    const userStorageKey = `chronicle_user_${userId}_data`;

    let localData: any = null;
    try {
      const saved = localStorage.getItem(userStorageKey);
      if (saved) {
        localData = JSON.parse(saved);
      }
    } catch (err) {
      console.error('Error reading localStorage:', err);
    }

    let cloudData: any = null;
    try {
      const json = await fetchUserCloudData(userId);
      if (json.synced && json.data) {
        cloudData = json.data;
      }
    } catch (err) {
      console.error('Error fetching server sync data:', err);
    }

    // Safe resolution logic ensuring clean slate for new users
    const resolveList = <T extends { id?: string }>(cloudList?: T[], localList?: T[]): T[] => {
      const validCloud = Array.isArray(cloudList) ? filterDummyItems(cloudList) : null;
      const validLocal = Array.isArray(localList) ? filterDummyItems(localList) : null;
      if (validCloud === null && validLocal === null) return [];
      return mergeArraysById(validCloud || [], validLocal || []);
    };

    const finalPlanner = deduplicatePlannerItems(resolveList(cloudData?.plannerItems, localData?.plannerItems));
    const finalRoutines = resolveList(cloudData?.routines, localData?.routines);
    const finalChecklist = resolveList(cloudData?.checklist, localData?.checklist);
    const finalDiaries = deduplicateDiaries(resolveList(cloudData?.diaries, localData?.diaries));
    const finalFinancials = deduplicateFinancials(resolveList(cloudData?.financials, localData?.financials));
    const finalUserStickers = resolveList(cloudData?.userStickers, localData?.userStickers);
    const finalCategories = cloudData?.categories && cloudData.categories.length > 0
      ? cloudData.categories
      : (localData?.categories && localData.categories.length > 0 ? localData.categories : DEFAULT_CATEGORIES);

    setPlannerItems(finalPlanner);
    setRoutines(finalRoutines);
    setChecklist(finalChecklist);
    setDiaries(finalDiaries);
    setFinancials(finalFinancials);
    setUserStickers(finalUserStickers);
    setCategories(finalCategories);

    const fullPayload = {
      plannerItems: finalPlanner,
      routines: finalRoutines,
      checklist: finalChecklist,
      diaries: finalDiaries,
      financials: finalFinancials,
      userStickers: finalUserStickers,
      categories: finalCategories,
    };

    try {
      localStorage.setItem(userStorageKey, JSON.stringify(fullPayload));
    } catch (e) {}

    // Push to per-user server DB
    saveUserCloudData(userId, fullPayload).catch((e) => console.error('Server sync push error:', e));

    setIsDataLoaded(true);
  };

  // Load Initial Data on Mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Handle User Login and Switch
  const handleUserLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setStoredActiveUser(user);
    loadUserData(user);
    showToast(`👋 ${user.name} 님으로 로그인되었습니다. 전용 데이터베이스가 로드되었습니다.`);
  };

  // Handle User Logout
  const handleUserLogout = () => {
    clearStoredActiveUser();
    setCurrentUser(null);
    loadUserData(null);
    showToast('로그아웃되었습니다. (게스트 모드로 전환)');
  };

  // Auto-Sync Effect: Persist state to localStorage instantly, and debounced auto-sync to Website Server Database
  useEffect(() => {
    if (!isDataLoaded) return;
    const userId = currentUser?.id || 'usr_guest';
    const userStorageKey = `chronicle_user_${userId}_data`;

    const fullPayload = {
      plannerItems,
      routines,
      checklist,
      diaries,
      financials,
      userStickers,
      categories,
    };

    try {
      localStorage.setItem(userStorageKey, JSON.stringify(fullPayload));
    } catch (e) {}

    const timer = setTimeout(() => {
      saveUserCloudData(userId, fullPayload).catch((e) => console.error('Website database auto-save error:', e));
    }, 1200);

    return () => clearTimeout(timer);
  }, [plannerItems, routines, checklist, diaries, financials, userStickers, categories, isDataLoaded, currentUser]);

  // Firebase Auth listener on startup
  useEffect(() => {
    const unsubscribe = initAuth(async (user: User, token: string) => {
      setAuthUser(user);
      if (user?.email) {
        setSyncState((prev) => ({
          ...prev,
          googleAccountEmail: user.email,
          googleCalendarConnected: true,
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchCloudDataWithToken = async (overrideToken?: string, silent = false) => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    try {
      let token = overrideToken || getAuthToken();

      // If user has OAuth token, load directly from their Google Drive!
      if (token) {
        try {
          const driveRes = await fetchAppDataFromGoogleDrive(token);
          if (driveRes.data) {
            const cloud = driveRes.data;

            // Cloud-first restoration: restore stored cloud arrays directly
            const activePlanner = deduplicatePlannerItems(Array.isArray(cloud.plannerItems) ? cloud.plannerItems : plannerItems);
            const activeRoutines = Array.isArray(cloud.routines) ? cloud.routines : routines;
            const activeChecklist = Array.isArray(cloud.checklist) ? cloud.checklist : checklist;
            const activeDiaries = deduplicateDiaries(Array.isArray(cloud.diaries) ? cloud.diaries : diaries);
            const activeFinancials = deduplicateFinancials(Array.isArray(cloud.financials) ? cloud.financials : financials);
            const activeUserStickers = Array.isArray(cloud.userStickers) ? cloud.userStickers : userStickers;
            const activeCategories = Array.isArray(cloud.categories) && cloud.categories.length > 0
              ? cloud.categories
              : categories;

            setPlannerItems(activePlanner);
            setRoutines(activeRoutines);
            setChecklist(activeChecklist);
            setDiaries(activeDiaries);
            setFinancials(activeFinancials);
            setUserStickers(activeUserStickers);
            setCategories(activeCategories);

            const fullData = {
              plannerItems: activePlanner,
              routines: activeRoutines,
              checklist: activeChecklist,
              diaries: activeDiaries,
              financials: activeFinancials,
              userStickers: activeUserStickers,
              categories: activeCategories,
            };

            try {
              localStorage.setItem('chronicle_app_v2_data', JSON.stringify(fullData));
            } catch (e) {}

            if (!silent) {
              showToast('📁 구글 드라이브에서 일기, 가계부, 스티커, 루틴, 플래너 데이터를 성공적으로 불러왔습니다!');
            }
            return fullData;
          }
        } catch (driveErr) {
          console.error('Google Drive fetch error, falling back to server cloud:', driveErr);
        }
      }

      // Fallback or Server Sync
      const res = await fetch('/api/sync/data');
      const json = await res.json();
      if (json.synced && json.data) {
        const cloud = json.data;

        const activePlanner = deduplicatePlannerItems(Array.isArray(cloud.plannerItems) ? cloud.plannerItems : plannerItems);
        const activeRoutines = Array.isArray(cloud.routines) ? cloud.routines : routines;
        const activeChecklist = Array.isArray(cloud.checklist) ? cloud.checklist : checklist;
        const activeDiaries = deduplicateDiaries(Array.isArray(cloud.diaries) ? cloud.diaries : diaries);
        const activeFinancials = deduplicateFinancials(Array.isArray(cloud.financials) ? cloud.financials : financials);
        const activeUserStickers = Array.isArray(cloud.userStickers) ? cloud.userStickers : userStickers;
        const activeCategories = Array.isArray(cloud.categories) && cloud.categories.length > 0
          ? cloud.categories
          : categories;

        setPlannerItems(activePlanner);
        setRoutines(activeRoutines);
        setChecklist(activeChecklist);
        setDiaries(activeDiaries);
        setFinancials(activeFinancials);
        setUserStickers(activeUserStickers);
        setCategories(activeCategories);

        const fullData = {
          plannerItems: activePlanner,
          routines: activeRoutines,
          checklist: activeChecklist,
          diaries: activeDiaries,
          financials: activeFinancials,
          userStickers: activeUserStickers,
          categories: activeCategories,
        };

        try {
          localStorage.setItem('chronicle_app_v2_data', JSON.stringify(fullData));
        } catch (e) {}

        if (!silent) {
          showToast('☁️ 클라우드 서버에서 통합 데이터(루틴, 일기, 가계부, 갤러리 등)를 가져왔습니다!');
        }
        return fullData;
      } else {
        if (!silent) {
          showToast('클라우드에 저장된 백업이 없어 현재 데이터를 클라우드에 새로 업로드합니다.');
        }
        const currentData = { plannerItems, routines, checklist, diaries, financials, userStickers, categories };
        await syncDataToCloud(currentData);
        return currentData;
      }
    } catch (err) {
      if (!silent) showToast('클라우드 데이터를 불러오는 중 오류가 발생했습니다.');
      return null;
    } finally {
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  const fetchCloudData = () => fetchCloudDataWithToken(undefined, false);

  const handleGoogleLogin = async () => {
    try {
      showToast('구글 계정 로그인 창을 열고 있습니다...');
      const res = await googleSignIn();
      if (!res) return;
      const user = res.user;
      if (user?.email) {
        setAuthUser(user);
        setSyncState((prev) => ({
          ...prev,
          googleAccountEmail: user.email,
          googleCalendarConnected: true,
        }));
        showToast(`구글 계정(${user.email}) 연결 성공! 캘린더 동기화를 진행합니다...`);
        if (res.accessToken) {
          handleFullTwoWaySync(res.accessToken, undefined, undefined, true);
        }
      }
    } catch (err: any) {
      showToast(err.message || '구글 로그인 중 오류가 발생했습니다.');
    }
  };

  const handleGoogleLogout = async () => {
    await signOutUser();
    setAuthUser(null);
    setSyncState((prev) => ({
      ...prev,
      googleCalendarConnected: false,
    }));
    showToast('구글 계정 연결이 해제되었습니다.');
  };

  // Full Two-Way Google Calendar Sync Trigger
  const handleFullTwoWaySync = async (
    overrideToken?: string,
    overridePlannerItems?: PlannerItem[],
    overrideDiaries?: DiaryEntry[],
    isUserAction: boolean = false
  ) => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    let token = overrideToken || getAuthToken();

    if (!token && isUserAction) {
      showToast('구글 계정 연결 로그인 창을 엽니다...');
      try {
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
      } catch (err: any) {
        showToast(err?.message || '구글 로그인 연결이 취소되었습니다.');
        setSyncState((prev) => ({ ...prev, isSyncing: false }));
        return;
      }
    }

    if (!token) {
      showToast('⚠️ 구글 계정연동 토큰이 만료되었거나 연동되지 않았습니다. 상단 [구글 계정 연결] 버튼을 눌러주세요.');
      setSyncState((prev) => ({ ...prev, isSyncing: false, googleCalendarConnected: false }));
      return;
    }

    showToast('구글 캘린더와 실시간 양방향 동기화 진행 중...');
    try {
      const activePlanner = overridePlannerItems || plannerItems;
      const activeDiaries = overrideDiaries || diaries;

      const result = await performTwoWayGoogleCalendarSync({
        accessToken: token,
        plannerItems: activePlanner,
        diaries: activeDiaries,
        financials: financials,
      });

      if (result.success) {
        let updatedPlanners = activePlanner;
        let updatedDiariesList = activeDiaries;

        if (result.updatedPlannerItems) {
          updatedPlanners = result.updatedPlannerItems;
          setPlannerItems(updatedPlanners);
        }
        if (result.updatedDiaries) {
          updatedDiariesList = result.updatedDiaries;
          setDiaries(updatedDiariesList);
        }

        const fullPayload = {
          plannerItems: updatedPlanners,
          routines,
          checklist,
          diaries: updatedDiariesList,
          financials,
          userStickers,
          categories,
        };

        try {
          localStorage.setItem('chronicle_app_v2_data', JSON.stringify(fullPayload));
        } catch (e) {}

        await syncDataToCloud(fullPayload);

        setSyncState((prev) => ({ ...prev, googleCalendarConnected: true }));
        const detailsMsg = `(다이어리: ${result.diarySyncedCount || 0}개, 일정: ${result.plannerSyncedCount || 0}개, 가계부: ${result.financialSyncedCount || 0}개 내보냄 / 외부일정: ${result.pulledCount}개 가져옴)`;
        showToast(`구글 캘린더 동기화 완료! ${detailsMsg}`);
      } else {
        if (
          result.errorMessage?.includes('401') ||
          result.errorMessage?.includes('missing or invalid')
        ) {
          setSyncState((prev) => ({ ...prev, googleCalendarConnected: false }));
          showToast('⚠️ 구글 연동 토큰이 만료되었습니다. 상단 [구글 계정 연결] 버튼을 눌러주세요.');
        } else if (result.errorMessage?.includes('권한') || result.errorMessage?.includes('403')) {
          setSyncState((prev) => ({ ...prev, googleCalendarConnected: false }));
          showToast('⚠️ 구글 캘린더 접근 권한(Scope) 미동의. [구글 계정 연결] 팝업 시 캘린더 권한 항목에 체크해 주세요!');
        } else {
          showToast(`동기화 알림: ${result.errorMessage || '구글 캘린더 연결 상태를 확인해 주세요.'}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      showToast(`동기화 중 오류 발생: ${err.message || '다시 시도해주세요.'}`);
    } finally {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: new Date().toISOString(),
      }));
    }
  };

  // Sync to Express Server Database (User-Isolated)
  const fetchServerData = async () => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    try {
      await loadUserData(currentUser);
      showToast('서버 데이터베이스에서 현재 계정의 최신 데이터를 성공적으로 불러왔습니다!');
    } catch (err) {
      showToast('서버 데이터 불러오기 중 오류가 발생했습니다.');
    } finally {
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  const syncDataToCloud = async (overrideData?: any) => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    const userId = currentUser?.id || 'usr_guest';
    try {
      const payload = overrideData || {
        plannerItems,
        routines,
        checklist,
        diaries,
        financials,
        userStickers,
        categories,
      };

      const json = await saveUserCloudData(userId, payload);

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: json.lastSyncedAt || new Date().toISOString(),
      }));
    } catch (err) {
      setSyncState((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  const handleResetAllData = async () => {
    const userName = currentUser?.name || '현재 사용자';
    if (!window.confirm(`[${userName}] 계정의 모든 데이터(플래너, 루틴, 다이어리, 가계부 등)를 완전히 초기화하시겠습니까? 다른 계정의 데이터는 유지됩니다.`)) {
      return;
    }

    setPlannerItems([]);
    setRoutines([]);
    setChecklist([]);
    setDiaries([]);
    setFinancials([]);
    setUserStickers([]);
    setCategories(DEFAULT_CATEGORIES);

    const userId = currentUser?.id || 'usr_guest';
    const userStorageKey = `chronicle_user_${userId}_data`;

    try {
      localStorage.removeItem(userStorageKey);
    } catch (e) {}

    try {
      await resetUserCloudData(userId);
    } catch (e) {}

    showToast('✨ 현재 계정의 모든 데이터가 완전히 초기화되었습니다. 새로운 계획을 시작해보세요!');
  };

  // Google Calendar Single Item Sync
  const handleSyncGoogleCalendar = async (item: PlannerItem) => {
    let token = getAuthToken();
    if (!token) {
      showToast('⚠️ 구글 계정연동이 필요합니다. 로그인 창을 엽니다.');
      try {
        const loginRes = await googleSignIn();
        token = loginRes?.accessToken || null;
      } catch (e) {
        return;
      }
    }

    if (!token) return;

    try {
      showToast(`'${item.title}' 구글 캘린더 연동 중...`);
      const payload = plannerItemToGoogleEvent(item);
      let eventId = item.googleCalendarEventId;

      if (eventId) {
        await updateGoogleCalendarEvent(token, eventId, payload);
      } else {
        const created = await createGoogleCalendarEvent(token, payload);
        eventId = created.id;
      }

      const updatedItem = { ...item, isGoogleCalendarSynced: true, googleCalendarEventId: eventId };
      setPlannerItems((prev) => prev.map((p) => (p.id === item.id ? updatedItem : p)));
      showToast(`'${item.title}' 일정이 구글 캘린더에 동기화되었습니다.`);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('401') || err.message?.includes('403')) {
        showToast('⚠️ 구글 연동 권한이 만료되었습니다. 다시 로그인 해주세요.');
        await handleGoogleLogin();
      } else {
        showToast(`구글 캘린더 연동 실패: ${err.message || '다시 시도해주세요.'}`);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleImportData = (data: any) => {
    if (Array.isArray(data.plannerItems)) setPlannerItems(data.plannerItems);
    if (Array.isArray(data.routines)) setRoutines(data.routines);
    if (Array.isArray(data.checklist)) setChecklist(data.checklist);
    if (Array.isArray(data.diaries)) setDiaries(data.diaries);
    if (Array.isArray(data.financials)) setFinancials(data.financials);
    if (Array.isArray(data.userStickers)) setUserStickers(data.userStickers);
    if (Array.isArray(data.categories)) setCategories(data.categories);
    syncDataToCloud(data);
  };

  // Auto save to localStorage & sync to cloud server on state changes
  useEffect(() => {
    if (!isDataLoaded) return;

    const dataPayload = {
      plannerItems,
      routines,
      checklist,
      diaries,
      financials,
      userStickers,
      categories,
    };

    // 1. Immediately persist to client localStorage
    try {
      localStorage.setItem('chronicle_app_v2_data', JSON.stringify(dataPayload));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }

    // 2. Debounce cloud server sync
    const timer = setTimeout(() => {
      syncDataToCloud(dataPayload);
    }, 1500);

    return () => clearTimeout(timer);
  }, [plannerItems, routines, checklist, diaries, financials, userStickers, categories, isDataLoaded]);

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-[#1A1A1A] font-sans antialiased selection:bg-[#C1876B]/20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A1A1A] text-[#FDFCF9] text-xs font-mono py-3 px-5 rounded-xl shadow-2xl flex items-center space-x-3 border border-[#FDFCF9]/20 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-[#849283] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container Wrapper */}
      <div className={isAndroidView ? 'py-8 flex justify-center bg-[#1A1A1A] min-h-screen' : 'min-h-screen'}>
        {/* Android Device Mockup Frame Mode */}
        <div
          className={
            isAndroidView
              ? 'w-[410px] h-[860px] bg-[#FDFCF9] rounded-[45px] shadow-2xl border-[10px] border-[#2A2A2A] overflow-hidden flex flex-col relative ring-1 ring-[#1A1A1A]'
              : 'w-full min-h-screen flex flex-col'
          }
        >
          {/* Android Speaker Notch */}
          {isAndroidView && (
            <div className="w-full bg-[#1A1A1A] py-1 flex justify-center flex-none">
              <div className="w-20 h-3 bg-[#2A2A2A] rounded-full flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-[#0A0A0A] rounded-full border border-[#1A1A1A]" />
              </div>
            </div>
          )}

          {/* Navigation Header */}
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isAndroidView={isAndroidView}
            setIsAndroidView={setIsAndroidView}
            isSyncing={syncState.isSyncing}
            lastSyncedAt={syncState.lastSyncedAt}
            currentUser={currentUser}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            onOpenICalExport={() => setIsICalExportOpen(true)}
            onOpenThemeNotificationModal={() => setIsThemeNotificationModalOpen(true)}
            onOpenDailyBriefing={() => setIsDailyBriefingOpen(true)}
            onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
            onOpenNxpModal={() => setIsNxpModalOpen(true)}
            isNxpConnected={nxpConnectionState === 'connected'}
            primaryColor={themeSettings.primaryColor}
            notificationsEnabled={notificationSettings.enabled}
          />

          {/* User Authentication Modal (No user list leak) */}
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            currentUser={currentUser}
            onLoginSuccess={handleUserLoginSuccess}
            onLogout={handleUserLogout}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            primaryColor={themeSettings.primaryColor}
          />

          {/* Google Gemini User Account & API Key Modal */}
          <GoogleGeminiAccountModal
            isOpen={isGeminiModalOpen}
            onClose={() => setIsGeminiModalOpen(false)}
            currentUser={currentUser}
            primaryColor={themeSettings.primaryColor}
            showToast={showToast}
            onConfigUpdated={(conf) => {
              // Optionally trigger cloud sync if user is active
              syncDataToCloud();
            }}
          />

          {/* System Administrator User Management Modal */}
          <AdminUserModal
            isOpen={isAdminModalOpen}
            onClose={() => setIsAdminModalOpen(false)}
            currentUser={currentUser}
            onUserDeleted={(deletedUserId) => {
              if (currentUser?.id === deletedUserId) {
                handleUserLogout();
              }
              showToast('사용자 계정 및 데이터가 성공적으로 삭제되었습니다.');
            }}
            primaryColor={themeSettings.primaryColor}
            onShowToast={showToast}
          />

          {/* iCalendar (.ics) RFC-5545 Google Calendar Import & Export Modal */}
          <ICalExportModal
            isOpen={isICalExportOpen}
            onClose={() => setIsICalExportOpen(false)}
            plannerItems={plannerItems}
            checklistItems={checklist}
            categories={categories}
            primaryColor={themeSettings.primaryColor}
            onShowToast={showToast}
            onImportItems={(importedPlans, importedChecks) => {
              if (importedPlans.length > 0) {
                setPlannerItems((prev) => [...importedPlans, ...prev]);
              }
              if (importedChecks.length > 0) {
                setChecklist((prev) => [...importedChecks, ...prev]);
              }
              // Sync to persistent cloud store
              syncDataToCloud();
            }}
          />

          {/* Upcoming Event Push Notification Banner Overlay */}
          <NotificationBanner
            alerts={upcomingAlerts}
            onDismiss={handleDismissAlert}
            onNavigateToPlanner={() => setActiveTab('planner')}
            primaryColor={themeSettings.primaryColor}
          />

          {/* NXP Semiconductors DEVKIT-MPC5748G Hardware Integration Modal */}
          <NxpBoardModal
            isOpen={isNxpModalOpen}
            onClose={() => setIsNxpModalOpen(false)}
            primaryColor={themeSettings.primaryColor}
            onTaskCompleteByHardware={handleTaskCompleteByHardware}
            onNextTrackByHardware={handleNextTrackByHardware}
            onSnoozeByHardware={handleSnoozeByHardware}
            onCycleModeByHardware={handleCycleModeByHardware}
          />

          {/* Daily Schedule & Routine Briefing Modal Popup */}
          <DailyBriefingModal
            isOpen={isDailyBriefingOpen}
            onClose={() => setIsDailyBriefingOpen(false)}
            selectedDate={selectedDate}
            plannerItems={plannerItems}
            routines={routines}
            setRoutines={setRoutines}
            checklist={checklist}
            setChecklist={setChecklist}
            categories={categories}
            briefingTime={briefingTime}
            setBriefingTime={setBriefingTime}
            briefingEnabled={briefingEnabled}
            setBriefingEnabled={setBriefingEnabled}
            showToast={showToast}
          />

          {/* Theme & Notification Settings Modal */}
          <ThemeNotificationModal
            isOpen={isThemeNotificationModalOpen}
            onClose={() => setIsThemeNotificationModalOpen(false)}
            themeSettings={themeSettings}
            setThemeSettings={setThemeSettings}
            notificationSettings={notificationSettings}
            setNotificationSettings={setNotificationSettings}
            onTriggerTestNotification={handleTriggerTestNotification}
            showToast={showToast}
          />

          {/* Body Content */}
          <main className="flex-1 overflow-y-auto pb-12 max-w-7xl mx-auto px-4 sm:px-8 pt-4 space-y-4">
            {/* LLM Natural Language Task & Schedule Parser */}
            <AiNaturalLanguageBar
              selectedDate={selectedDate}
              categories={categories}
              onAddPlannerItem={(newItem) => {
                setPlannerItems((prev) => [...prev, newItem]);
              }}
              onAddChecklistItem={(newItem) => {
                setChecklist((prev) => [...prev, newItem]);
              }}
              onAddRoutineItem={(newItem) => {
                setRoutines((prev) => [...prev, newItem]);
              }}
              showToast={showToast}
              primaryColor={themeSettings.primaryColor}
              currentUser={currentUser}
              onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
            />

            {/* Morning Top Banner Widget */}
            <TodayMorningWidget
              selectedDate={selectedDate}
              plannerItems={plannerItems}
              setPlannerItems={setPlannerItems}
              routines={routines}
              setRoutines={setRoutines}
              checklist={checklist}
              setChecklist={setChecklist}
              categories={categories}
              primaryColor={themeSettings.primaryColor}
              onOpenBriefingModal={() => setIsDailyBriefingOpen(true)}
              onNavigateToPlanner={() => setActiveTab('planner')}
              onNavigateToRoutines={() => setActiveTab('routine')}
            />
            {activeTab === 'planner' && (
              <PlannerView
                plannerItems={plannerItems}
                setPlannerItems={setPlannerItems}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
                categories={categories}
                setCategories={setCategories}
                onSyncGoogleCalendar={handleSyncGoogleCalendar}
                routines={routines}
                setRoutines={setRoutines}
                checklist={checklist}
                setChecklist={setChecklist}
                financials={financials}
                setFinancials={setFinancials}
                onOpenBriefingModal={() => setIsDailyBriefingOpen(true)}
                onNavigateToTab={(tab) => setActiveTab(tab)}
                primaryColor={themeSettings.primaryColor}
                onOpenICalExport={() => setIsICalExportOpen(true)}
              />
            )}

            {activeTab === 'routine' && (
              <RoutineChecklist
                routines={routines}
                setRoutines={setRoutines}
                checklist={checklist}
                setChecklist={setChecklist}
                selectedDate={selectedDate}
                categories={categories}
              />
            )}

            {activeTab === 'diary' && (
              <DiaryView
                diaries={diaries}
                setDiaries={setDiaries}
                selectedDate={selectedDate}
                userStickers={userStickers}
                setUserStickers={setUserStickers}
                presetStickers={INITIAL_PRESET_STICKERS}
                financials={financials}
                setFinancials={setFinancials}
                onSyncGoogleCalendar={(updatedDiaries) =>
                  handleFullTwoWaySync(undefined, undefined, updatedDiaries)
                }
              />
            )}

            {activeTab === 'financial' && (
              <FinancialView
                financials={financials}
                setFinancials={setFinancials}
                selectedDate={selectedDate}
                diaries={diaries}
                setDiaries={setDiaries}
                userStickers={userStickers}
                setUserStickers={setUserStickers}
                onNavigateToDiary={(date) => {
                  if (date) setSelectedDate(date);
                  setActiveTab('diary');
                }}
              />
            )}

            {activeTab === 'stickers' && (
              <StickerGallery
                userStickers={userStickers}
                setUserStickers={setUserStickers}
                presetStickers={INITIAL_PRESET_STICKERS}
                diaries={diaries}
                financials={financials}
                onNavigateToDiary={(date) => {
                  if (date) setSelectedDate(date);
                  setActiveTab('diary');
                }}
              />
            )}

            {activeTab === 'sync' && (
              <CloudSyncSettings
                syncState={syncState}
                onManualSync={handleFullTwoWaySync}
                onFetchServerData={fetchServerData}
                onUploadCloudData={() => {
                  syncDataToCloud();
                  showToast('현재 계정의 모든 데이터(플래너, 일기, 가계부 등)를 서버 데이터베이스에 저장했습니다!');
                }}
                onResetAllData={handleResetAllData}
                plannerItems={plannerItems}
                routines={routines}
                checklist={checklist}
                diaries={diaries}
                financials={financials}
                userStickers={userStickers}
                categories={categories}
                onImportData={handleImportData}
                currentUser={currentUser}
                onOpenAuthModal={() => setIsAuthModalOpen(true)}
                onOpenAdminModal={() => setIsAdminModalOpen(true)}
                onLogoutUser={handleUserLogout}
                onOpenICalExport={() => setIsICalExportOpen(true)}
                onOpenThemeNotificationModal={() => setIsThemeNotificationModalOpen(true)}
                onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
                primaryColor={themeSettings.primaryColor}
              />
            )}
          </main>

          {/* Android Home Bar Notch */}
          {isAndroidView && (
            <div className="w-full bg-[#F5F2ED] py-2 flex justify-center flex-none border-t border-[#1A1A1A]/10">
              <div className="w-32 h-1 bg-[#1A1A1A]/30 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

