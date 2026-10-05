import { useSyncExternalStore } from 'react';

// Settings that belong to this browser/device only (never uploaded):
// theme color, the user's own Gemini API key, reminder preferences.

export interface DeviceSettings {
  themeColor: string;
  geminiKey: string;
  /** Empty = pick automatically (newest Flash model available to the key). */
  geminiModel: string;
  remindersEnabled: boolean;
  reminderLead: number; // minutes before start
}

const KEY = 'plock_device_settings_v2';

const defaults: DeviceSettings = {
  themeColor: '#C1876B',
  geminiKey: '',
  geminiModel: '',
  remindersEnabled: false,
  reminderLead: 10,
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

export function getDeviceSettings(): DeviceSettings {
  return state;
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
