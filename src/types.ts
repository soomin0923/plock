export type ViewMode = 'month' | 'week' | 'day';

export type CategoryType = string;

export interface CustomCategory {
  id: string;
  name: string;
  color: string;
}

export interface PlannerItem {
  id: string;
  title: string;
  description?: string;
  date: string; // YYYY-MM-DD (start or main date)
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  isDateRange?: boolean;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  category: CategoryType;
  color?: string;
  isCompleted: boolean;
  images?: string[]; // attached image URLs/dataURIs
  location?: string;
  isGoogleCalendarSynced?: boolean;
  googleCalendarEventId?: string;
  createdAt: string;
}

export type RoutineFrequency = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'custom';

export interface RoutineItem {
  id: string;
  title: string;
  category: CategoryType;
  frequency: RoutineFrequency;
  customDays?: number[]; // 0: Sun, 1: Mon, ...
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  streak: number;
  completedDates: string[]; // ['2026-08-01', '2026-08-02']
  icon?: string;
  color?: string;
  reminderTime?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD (target or deadline date)
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  isDateRange?: boolean;
  dueTime?: string; // HH:mm
  priority: 'high' | 'medium' | 'low';
  isCompleted: boolean;
  category: CategoryType;
  subtasks?: { id: string; title: string; isCompleted: boolean }[];
  memo?: string;
  createdAt: string;
}

export type EmotionType = 'joy' | 'calm' | 'excited' | 'sad' | 'angry' | 'tired' | 'inspired' | 'love';

export interface EmotionTag {
  type: EmotionType;
  label: string;
  emoji: string;
  color: string;
  intensity: number; // 1-5
}

export interface StickerPlacement {
  id: string;
  imageUrl: string;
  x: number; // percentage or px
  y: number;
  scale: number; // 0.5 ~ 2.0
  rotation: number; // deg
  zIndex: number;
  isCustom?: boolean; // uploaded from gallery
}

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  weather?: 'sunny' | 'cloudy' | 'rainy' | 'snowy' | 'windy';
  emotions: EmotionTag[];
  images: string[];
  stickers: StickerPlacement[];
  createdAt: string;
  updatedAt: string;
  syncToGoogleCalendar?: boolean; // Choice to sync to Google Calendar (defaults to true)
  isGoogleCalendarSynced?: boolean;
  googleCalendarEventId?: string;
}

export type FinancialType = 'expense' | 'income';

export interface FinancialEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: FinancialType;
  amount: number;
  category: string; // e.g., '식비', '교통', '쇼핑', '급여', '문화', '주거/통신', '기타'
  paymentMethod: 'card' | 'cash' | 'transfer';
  memo?: string;
  receiptImage?: string;
}

export type FinancialItem = FinancialEntry;

export interface UserAccount {
  id: string;
  username: string;
  name: string;
  password?: string;
  role?: 'admin' | 'user';
  avatarColor?: string;
  createdAt: string;
  plannerCount?: number;
  checklistCount?: number;
  diariesCount?: number;
  financialsCount?: number;
  routinesCount?: number;
  lastSyncedAt?: string | null;
  googleEmail?: string;
  googleDisplayName?: string;
  googlePhotoUrl?: string;
  googleUid?: string;
  geminiApiKey?: string;
  useCustomGeminiKey?: boolean;
}

export interface UserGeminiConfig {
  googleEmail?: string;
  googleDisplayName?: string;
  googlePhotoUrl?: string;
  googleUid?: string;
  geminiApiKey?: string;
  useCustomGeminiKey?: boolean;
  isVerified?: boolean;
  lastTestedAt?: string;
}

export interface CloudSyncState {
  lastSyncedAt: string | null;
  isSyncing: boolean;
  autoSync: boolean;
  activeUser?: UserAccount | null;
  syncError?: string | null;
  googleCalendarConnected?: boolean;
  googleAccountEmail?: string | null;
}

export interface UserCustomSticker {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: string;
}

export interface ThemeSettings {
  primaryColor: string;
  presetName: string;
}

export interface NotificationSettings {
  enabled: boolean;
  leadMinutes: number; // minutes before start time to notify
  soundEnabled: boolean;
  permissionGranted: boolean;
}

export interface UpcomingNotificationAlert {
  id: string;
  title: string;
  time: string;
  categoryName?: string;
  itemType: 'planner' | 'checklist';
  dueMinutesLeft: number;
}

