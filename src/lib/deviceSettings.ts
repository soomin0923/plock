import { useSyncExternalStore } from 'react';

// Settings that belong to this browser/device only (never uploaded):
// theme color, the user's own Gemini API key, reminder preferences, which tabs to show.

export type AiProvider = 'gemini' | 'claude' | 'openai' | 'groq' | 'openrouter';

export interface DeviceSettings {
  /** Accent color (buttons, highlights). */
  themeColor: string;
  /** Page background, card/panel background, and text color. */
  bgColor: string;
  cardColor: string;
  textColor: string;
  geminiKey: string;
  /** Empty = pick automatically (newest Flash model available to the key). */
  geminiModel: string;
  /** Which AI service parses sentences. Keys for the others are kept as backups (used when it is busy). */
  aiProvider: AiProvider;
  /** API keys / chosen models for the non-Gemini services (Gemini keeps geminiKey/geminiModel). */
  aiKeys: Partial<Record<AiProvider, string>>;
  aiModels: Partial<Record<AiProvider, string>>;
  remindersEnabled: boolean;
  reminderLead: number; // minutes before start
  /** Play a short chime with each reminder (while Plock is open). */
  reminderSound: boolean;
  /** Tabs hidden from the navigation on this device. */
  hiddenTabs: string[];
  /** Start new diaries with the 감정 일기 form. */
  diaryJournalDefault: boolean;
}

const KEY = 'plock_device_settings_v2';

const defaults: DeviceSettings = {
  themeColor: '#C1876B',
  bgColor: '#F8F5F0',
  cardColor: '#FFFFFF',
  textColor: '#2A2622',
  geminiKey: '',
  geminiModel: '',
  aiProvider: 'gemini',
  aiKeys: {},
  aiModels: {},
  remindersEnabled: false,
  reminderLead: 10,
  reminderSound: true,
  hiddenTabs: [],
  diaryJournalDefault: false,
};

function load(): DeviceSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
    // Carry over the theme color and Gemini key from the previous version, if present.
    const legacyTheme = JSON.parse(localStorage.getItem('chronicle_theme_settings') || 'null');
    const legacyKey = localStorage.getItem('plock_user_gemini_api_key') || '';
    return { ...defaults, themeColor: legacyTheme?.primaryColor || defaults.themeColor, geminiKey: legacyKey };
  } catch {
    return defaults;
  }
}

let state: DeviceSettings = typeof window === 'undefined' ? defaults : load();
const listeners = new Set<() => void>();

export const DEFAULT_COLORS = { themeColor: defaults.themeColor, bgColor: defaults.bgColor, cardColor: defaults.cardColor, textColor: defaults.textColor };

export function getDeviceSettings(): DeviceSettings {
  return state;
}

/** API key / chosen model for a service (Gemini's live in their original fields). */
export function aiKeyFor(p: AiProvider, st: DeviceSettings = state): string {
  return (p === 'gemini' ? st.geminiKey : st.aiKeys[p] || '').trim();
}
export function aiModelFor(p: AiProvider, st: DeviceSettings = state): string {
  return (p === 'gemini' ? st.geminiModel : st.aiModels[p] || '').trim();
}
const AI_PROVIDER_IDS: AiProvider[] = ['gemini', 'claude', 'openai', 'groq', 'openrouter'];
/** Any AI service has a key on this device (otherwise the built-in rule parser does the work). */
export function hasAnyAiKey(st: DeviceSettings = state): boolean {
  return AI_PROVIDER_IDS.some((p) => !!aiKeyFor(p, st));
}
export function setAiKey(p: AiProvider, key: string) {
  if (p === 'gemini') setDeviceSettings({ geminiKey: key.trim() });
  else setDeviceSettings({ aiKeys: { ...state.aiKeys, [p]: key.trim() } });
}
export function setAiModel(p: AiProvider, model: string) {
  if (p === 'gemini') setDeviceSettings({ geminiModel: model });
  else setDeviceSettings({ aiModels: { ...state.aiModels, [p]: model } });
}

export function setDeviceSettings(patch: Partial<DeviceSettings>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or disabled — keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function useDeviceSettings(): DeviceSettings {
  return useSyncExternalStore(subscribe, getDeviceSettings, getDeviceSettings);
}
