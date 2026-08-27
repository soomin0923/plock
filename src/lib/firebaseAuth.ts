import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/calendar.events');
provider.addScope('https://www.googleapis.com/auth/drive.file');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Load stored token from session/memory cache safely with expiry check (50 min limit)
export const getCachedAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('chronicle_gcal_token');
  const timestampStr = localStorage.getItem('chronicle_gcal_token_time');

  if (token && timestampStr) {
    const savedTime = parseInt(timestampStr, 10);
    // Google OAuth access tokens expire in 1 hour (3600s). Check if older than 50 minutes.
    if (Date.now() - savedTime > 50 * 60 * 1000) {
      console.warn('Google OAuth token expired. Clearing token.');
      localStorage.removeItem('chronicle_gcal_token');
      localStorage.removeItem('chronicle_gcal_token_time');
      cachedAccessToken = null;
      return null;
    }
    return token;
  }
  return token || null;
};

export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('chronicle_gcal_token', token);
      localStorage.setItem('chronicle_gcal_token_time', Date.now().toString());
    } else {
      localStorage.removeItem('chronicle_gcal_token');
      localStorage.removeItem('chronicle_gcal_token_time');
    }
  }
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    const token = getCachedAccessToken();
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user, token || '');
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Google Sign In is already in progress.');
    return null;
  }
  try {
    isSigningIn = true;
    provider.setCustomParameters({ prompt: 'select_account consent' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    const accessToken = credential?.accessToken || null;

    if (accessToken) {
      setCachedAccessToken(accessToken);
    }
    return { user: result.user, accessToken: accessToken || '' };
  } catch (error: any) {
    console.error('Google Sign In Error:', error);
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('로그인 팝업 창이 닫혔습니다.');
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.warn('Cancelled popup request');
      return null;
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Firebase 보안 도메인 제한 오류입니다. Chrome 주소창의 [앱 설치]로 PWA 데스크톱 앱을 설치하여 실행하시면 구글 연동이 100% 정상 작동합니다.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAuthToken = (): string | null => getCachedAccessToken();

export const logoutGoogle = async () => {
  await signOut(auth);
  setCachedAccessToken(null);
};

export const signOutUser = logoutGoogle;

