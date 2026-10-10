import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function toAuthUser(u: User): AuthUser {
  return { uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL };
}

export function watchAuth(cb: (u: AuthUser | null) => void) {
  return onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/missing-password': '비밀번호를 입력해 주세요.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해 주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/wrong-password': '이메일 또는 비밀번호가 올바르지 않습니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/too-many-requests': '시도 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해 주세요.',
    'auth/popup-closed-by-user': '로그인 창이 닫혔습니다.',
    'auth/cancelled-popup-request': '로그인 창이 닫혔습니다.',
    'auth/unauthorized-domain':
      '이 도메인은 Firebase 로그인 허용 도메인에 등록되어 있지 않습니다. Firebase 콘솔 > Authentication > 설정 > 승인된 도메인에 추가해 주세요.',
    'auth/operation-not-allowed':
      '이 로그인 방식이 Firebase 콘솔에서 꺼져 있습니다. Authentication > 로그인 방법에서 사용 설정해 주세요.',
    'auth/requires-recent-login': '보안을 위해 로그아웃 후 다시 로그인한 뒤 5분 안에 시도해 주세요.',
  };
  return map[code] || (err as Error)?.message || '로그인 중 오류가 발생했습니다.';
}

export async function signInEmail(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signUpEmail(email: string, password: string, name: string) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    const code = (err as { code?: string })?.code || '';
    // Installed PWAs and some in-app browsers block popups; fall back to a full-page redirect.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutUser() {
  await signOut(auth);
}

/** Firebase only allows account deletion shortly after signing in. Check before deleting any data. */
export function assertRecentLogin(maxAgeMs = 5 * 60 * 1000) {
  const last = auth.currentUser?.metadata.lastSignInTime;
  if (!last || Date.now() - new Date(last).getTime() > maxAgeMs) {
    throw Object.assign(new Error('requires recent login'), { code: 'auth/requires-recent-login' });
  }
}

export async function deleteCurrentUser() {
  if (auth.currentUser) await deleteUser(auth.currentUser);
}
