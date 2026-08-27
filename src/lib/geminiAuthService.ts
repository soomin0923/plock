import { CustomCategory, PlannerItem, ChecklistItem, RoutineItem, UserAccount } from '../types';

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

const GEMINI_CONFIG_PREFIX = 'plock_gemini_config_';
const GLOBAL_GEMINI_KEY = 'plock_user_gemini_api_key';

/**
 * Get stored Gemini configuration for a specific user ID (or fallback to active user)
 */
export function getStoredUserGeminiConfig(userId?: string | null): UserGeminiConfig {
  if (typeof window === 'undefined') {
    return { useCustomGeminiKey: true };
  }

  const effectiveUserId = userId || 'usr_guest';
  try {
    const raw = localStorage.getItem(`${GEMINI_CONFIG_PREFIX}${effectiveUserId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        useCustomGeminiKey: true,
        ...parsed,
      };
    }
  } catch (err) {
    console.error('Error reading user Gemini config:', err);
  }

  // Fallback to legacy global key if available
  const legacyKey = localStorage.getItem(GLOBAL_GEMINI_KEY);
  if (legacyKey) {
    return {
      geminiApiKey: legacyKey,
      useCustomGeminiKey: true,
      isVerified: true,
    };
  }

  return {
    useCustomGeminiKey: true,
  };
}

/**
 * Save user Gemini configuration in localStorage and sync with server
 */
export function saveStoredUserGeminiConfig(
  userId: string | null | undefined,
  config: Partial<UserGeminiConfig>
): UserGeminiConfig {
  if (typeof window === 'undefined') {
    return config as UserGeminiConfig;
  }

  const effectiveUserId = userId || 'usr_guest';
  const existing = getStoredUserGeminiConfig(effectiveUserId);
  const updated: UserGeminiConfig = {
    ...existing,
    ...config,
  };

  try {
    localStorage.setItem(`${GEMINI_CONFIG_PREFIX}${effectiveUserId}`, JSON.stringify(updated));
    if (updated.geminiApiKey) {
      localStorage.setItem(GLOBAL_GEMINI_KEY, updated.geminiApiKey);
    }
  } catch (err) {
    console.error('Error saving user Gemini config:', err);
  }

  // Dispatch custom event so all open UI components update reactively
  try {
    window.dispatchEvent(
      new CustomEvent('plock-gemini-config-changed', {
        detail: { userId: effectiveUserId, config: updated },
      })
    );
  } catch (e) {}

  // Sync to server asynchronously
  if (effectiveUserId && effectiveUserId !== 'usr_guest') {
    fetch('/api/user/gemini-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: effectiveUserId,
        geminiApiKey: updated.geminiApiKey || '',
        useCustomGeminiKey: updated.useCustomGeminiKey !== false,
        googleEmail: updated.googleEmail || '',
        googleDisplayName: updated.googleDisplayName || '',
        googlePhotoUrl: updated.googlePhotoUrl || '',
      }),
    }).catch((e) => console.warn('Failed to sync Gemini config to server:', e));
  }

  return updated;
}

/**
 * Get effective Gemini API key to attach to requests
 */
export function getEffectiveGeminiApiKey(userId?: string | null): string | null {
  const config = getStoredUserGeminiConfig(userId);
  if (config.useCustomGeminiKey !== false && config.geminiApiKey && config.geminiApiKey.trim()) {
    return config.geminiApiKey.trim();
  }
  return null;
}

/**
 * Returns HTTP headers including the user's custom Gemini API key if configured
 */
export function getGoogleGeminiApiHeaders(userId?: string | null): Record<string, string> {
  const key = getEffectiveGeminiApiKey(userId);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (key) {
    headers['x-gemini-api-key'] = key;
  }
  return headers;
}

/**
 * Test user's Gemini API key by making a verification call to the backend
 */
export async function testGeminiApiKeyOnServer(
  apiKey: string,
  userId?: string | null
): Promise<{ success: boolean; message: string; model?: string }> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { success: false, message: 'Google Gemini API 키를 입력해주세요.' };
  }

  try {
    const res = await fetch('/api/ai/test-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': cleanKey,
      },
      body: JSON.stringify({
        apiKey: cleanKey,
        userId: userId || 'usr_guest',
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      // Save verified status
      if (userId) {
        saveStoredUserGeminiConfig(userId, {
          geminiApiKey: cleanKey,
          isVerified: true,
          lastTestedAt: new Date().toISOString(),
        });
      }
      return {
        success: true,
        message: data.message || 'Google Gemini API 키가 성공적으로 인증되었습니다!',
        model: data.model || 'gemini-3.7-flash',
      };
    } else {
      return {
        success: false,
        message: data.message || 'API 키 인증에 실패했습니다. 키를 다시 확인해주세요.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '네트워크 오류로 API 키 인증에 실패했습니다.',
    };
  }
}
