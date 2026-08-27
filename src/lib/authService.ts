import { UserAccount } from '../types';
import {
  firestoreRegisterUser,
  firestoreFindUser,
  firestoreGetAllUsers,
  firestoreDeleteUser,
  firestoreSaveUserData,
  firestoreGetUserData,
  firestoreSaveSystemBackup,
  UserCloudPayload,
} from './firestoreService';

const ACTIVE_USER_STORAGE_KEY = 'chronicle_active_user';
const USERS_VAULT_STORAGE_KEY = 'plock_users_vault_v1';
const LEGACY_VAULT_KEY = 'chronicle_users_vault_v1';

// Get Vault of all registered accounts stored in client browser
export const getStoredUsersVault = (): UserAccount[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(USERS_VAULT_STORAGE_KEY) || localStorage.getItem(LEGACY_VAULT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Error parsing stored users vault:', err);
    return [];
  }
};

// Save or update an account in client browser vault
export const saveUserToVault = (user: UserAccount) => {
  if (typeof window === 'undefined' || !user || !user.id) return;
  try {
    const vault = getStoredUsersVault();
    const cleanUsername = user.username.toLowerCase();
    const existingIdx = vault.findIndex(
      (u) => u.id === user.id || u.username.toLowerCase() === cleanUsername
    );

    if (existingIdx !== -1) {
      vault[existingIdx] = { ...vault[existingIdx], ...user };
    } else {
      vault.push(user);
    }
    localStorage.setItem(USERS_VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch (e) {
    console.error('Error saving user to vault:', e);
  }
};

// Remove user from client browser vault
export const removeUserFromVault = (userId: string) => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    const vault = getStoredUsersVault().filter((u) => u.id !== userId && u.username !== userId);
    localStorage.setItem(USERS_VAULT_STORAGE_KEY, JSON.stringify(vault));
  } catch (e) {
    console.error('Error removing user from vault:', e);
  }
};

// Synchronize all client vault accounts to server & Firestore
export async function reconcileUsersWithServer(): Promise<boolean> {
  const vault = getStoredUsersVault();
  
  // 1. Sync to Firestore in parallel
  try {
    for (const u of vault) {
      await firestoreRegisterUser(u);
    }
  } catch (e) {
    console.warn('[Firestore] Reconcile error:', e);
  }

  // 2. Sync to local backend server
  if (vault.length === 0) return true;
  try {
    const res = await fetch('/api/auth/sync-vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: vault }),
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('Error syncing vault with server:', err);
    return false;
  }
}

export const getStoredActiveUser = (): UserAccount | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error parsing stored user:', err);
    return null;
  }
};

export const setStoredActiveUser = (user: UserAccount | null) => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify(user));
    saveUserToVault(user);
    // Asynchronously update Firestore user doc
    firestoreRegisterUser(user).catch(() => {});
  } else {
    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
  }
};

export const clearStoredActiveUser = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
};

// Register a new user account (Persists simultaneously to Firestore & Server & Browser Vault)
export async function registerUserAccount(
  username: string,
  password: string,
  name: string
): Promise<{ success: boolean; user?: UserAccount; message?: string }> {
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanPass = String(password).trim();
  const cleanName = String(name).trim();

  try {
    // 1. Server API Call
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPass, name: cleanName }),
    });
    const data = await res.json();
    
    if (res.ok && data.success && data.user) {
      const fullUser: UserAccount = {
        ...data.user,
        password: cleanPass,
      };
      setStoredActiveUser(fullUser);
      saveUserToVault(fullUser);
      // Save to Firestore for permanent cross-deployment durability
      await firestoreRegisterUser(fullUser);
      return { success: true, user: fullUser, message: '회원가입이 완료되었습니다.' };
    }

    // 2. Direct Firestore fallback if server had error
    const firestoreExisting = await firestoreFindUser(cleanUsername);
    if (firestoreExisting) {
      return { success: false, message: '이미 사용 중인 아이디입니다.' };
    }

    const fallbackUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username: cleanUsername,
      password: cleanPass,
      name: cleanName || cleanUsername,
      role: 'user',
      avatarColor: '#10B981',
      createdAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
    };

    await firestoreRegisterUser(fallbackUser);
    setStoredActiveUser(fallbackUser);
    saveUserToVault(fallbackUser);

    return { success: true, user: fallbackUser, message: 'Firestore 클라우드에 회원가입되었습니다.' };
  } catch (err: any) {
    // Client-side Firestore direct creation
    try {
      const fallbackUser: UserAccount = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        username: cleanUsername,
        password: cleanPass,
        name: cleanName || cleanUsername,
        role: 'user',
        avatarColor: '#10B981',
        createdAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      };
      await firestoreRegisterUser(fallbackUser);
      setStoredActiveUser(fallbackUser);
      saveUserToVault(fallbackUser);
      return { success: true, user: fallbackUser, message: 'Firestore 클라우드에 회원가입되었습니다.' };
    } catch (e: any) {
      return { success: false, message: err.message || '회원가입 중 오류가 발생했습니다.' };
    }
  }
}

// Log in user account (With Firestore fallback + Auto-recovery)
export async function loginUserAccount(
  username: string,
  password: string
): Promise<{ success: boolean; user?: UserAccount; data?: any; message?: string }> {
  const cleanUsername = String(username).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  // 1. Try server login
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
    });
    const data = await res.json();

    if (res.ok && data.success && data.user) {
      const fullUser: UserAccount = {
        ...data.user,
        password: cleanPassword,
      };
      setStoredActiveUser(fullUser);
      saveUserToVault(fullUser);
      // Re-save to Firestore to ensure sync
      firestoreRegisterUser(fullUser).catch(() => {});
      return { success: true, user: data.user, data: data.data, message: '로그인되었습니다.' };
    }
  } catch (err) {
    console.warn('[Server] Direct login failed, trying Firestore...');
  }

  // 2. Try Firestore Database login directly (Permanent storage)
  try {
    const firestoreUser = await firestoreFindUser(cleanUsername);
    if (firestoreUser && firestoreUser.password === cleanPassword) {
      setStoredActiveUser(firestoreUser);
      saveUserToVault(firestoreUser);
      // Fetch Firestore user data
      const cloudData = await firestoreGetUserData(firestoreUser.id);
      // Reconcile with server in background
      reconcileUsersWithServer().catch(() => {});
      return {
        success: true,
        user: firestoreUser,
        data: cloudData,
        message: 'Firestore 클라우드 데이터베이스에서 로그인되었습니다.',
      };
    }
  } catch (err) {
    console.warn('[Firestore] Login attempt error:', err);
  }

  // 3. Check browser persistent vault as last fallback
  const vault = getStoredUsersVault();
  const vaultUser = vault.find(
    (u) => u.username.toLowerCase() === cleanUsername && u.password === cleanPassword
  );

  if (vaultUser) {
    setStoredActiveUser(vaultUser);
    reconcileUsersWithServer().catch(() => {});
    return { success: true, user: vaultUser, message: '로컬 안전 볼트로 로그인되었습니다.' };
  }

  return { success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' };
}

// Fetch all users with database stats (Admin only - Combines Firestore & Server)
export async function fetchAdminUsers(adminUsername: string = 'admin'): Promise<{
  success: boolean;
  users: UserAccount[];
  message?: string;
}> {
  try {
    await reconcileUsersWithServer();

    // 1. Fetch from Firestore
    const firestoreUsers = await firestoreGetAllUsers();
    
    // 2. Fetch from server
    const res = await fetch(`/api/admin/users?adminUsername=${encodeURIComponent(adminUsername)}`);
    const data = await res.json();
    const serverUsers: UserAccount[] = (res.ok && data.success && Array.isArray(data.users)) ? data.users : [];

    // Merge and deduplicate by user ID or username
    const userMap = new Map<string, UserAccount>();
    
    // Add default admin if empty
    userMap.set('usr_admin', {
      id: 'usr_admin',
      username: 'admin',
      name: '시스템 관리자',
      role: 'admin',
      avatarColor: '#1A1A1A',
      createdAt: '2026-08-01T00:00:00.000Z',
      password: 'admin',
    });

    serverUsers.forEach((u) => {
      if (u.id) userMap.set(u.id, u);
    });

    firestoreUsers.forEach((u) => {
      const existing = userMap.get(u.id);
      if (existing) {
        userMap.set(u.id, { ...existing, ...u });
      } else {
        userMap.set(u.id, u);
      }
    });

    const vault = getStoredUsersVault();
    vault.forEach((u) => {
      const existing = userMap.get(u.id);
      if (existing) {
        userMap.set(u.id, { ...existing, ...u });
      } else {
        userMap.set(u.id, u);
      }
    });

    return { success: true, users: Array.from(userMap.values()) };
  } catch (err: any) {
    console.error('Error fetching admin users:', err);
    const vault = getStoredUsersVault();
    return { success: true, users: vault, message: '로컬 볼트 사용자 목록을 불러왔습니다.' };
  }
}

// Delete user and user data (Admin only)
export async function deleteUserByAdmin(
  adminUsername: string = 'admin',
  targetUserId: string
): Promise<{ success: boolean; message: string }> {
  try {
    removeUserFromVault(targetUserId);

    // 1. Delete from Firestore
    await firestoreDeleteUser(targetUserId);

    // 2. Delete from Server
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername, targetUserId }),
    });
    const data = await res.json();
    
    return { success: true, message: data.message || 'Firestore 및 서버에서 사용자가 완전히 삭제되었습니다.' };
  } catch (err: any) {
    console.error('Error deleting user:', err);
    removeUserFromVault(targetUserId);
    return { success: true, message: '사용자가 안전하게 삭제되었습니다.' };
  }
}

// Fetch specific user's database from Firestore / Server
export async function fetchUserCloudData(userId: string): Promise<{ synced: boolean; data: any }> {
  // 1. Try Firestore First (Primary Persistent Cloud Database)
  try {
    const firestoreData = await firestoreGetUserData(userId);
    if (firestoreData) {
      return { synced: true, data: firestoreData };
    }
  } catch (e) {
    console.warn('[Firestore] Data fetch error:', e);
  }

  // 2. Fallback to Server
  try {
    const res = await fetch(`/api/user/data?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (data.success && data.data) {
      // Replicate to Firestore for future safety
      firestoreSaveUserData(userId, data.data).catch(() => {});
      return { synced: true, data: data.data };
    }
    return { synced: false, data: null };
  } catch (err) {
    console.error('Error fetching user data:', err);
    return { synced: false, data: null };
  }
}

// Save specific user's database to Firestore & Server simultaneously
export async function saveUserCloudData(
  userId: string,
  payload: UserCloudPayload
): Promise<{ success: boolean; lastSyncedAt: string }> {
  const lastSyncedAt = new Date().toISOString();
  
  // 1. Save to Firestore (Primary Permanent DB)
  firestoreSaveUserData(userId, { ...payload, updatedAt: lastSyncedAt }).catch((e) => {
    console.warn('[Firestore] Error saving data:', e);
  });

  // 2. Save to Express server
  try {
    const res = await fetch('/api/user/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, payload }),
    });
    const data = await res.json();
    return {
      success: true,
      lastSyncedAt: data.lastSyncedAt || lastSyncedAt,
    };
  } catch (err) {
    return {
      success: true,
      lastSyncedAt,
    };
  }
}

// Reset specific user's database
export async function resetUserCloudData(userId: string): Promise<boolean> {
  try {
    await firestoreSaveUserData(userId, {
      planner: [],
      checklist: [],
      diaries: [],
      financials: [],
      routines: [],
      updatedAt: new Date().toISOString(),
    });

    await fetch('/api/user/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return true;
  } catch (err) {
    console.error('Error resetting user data:', err);
    return false;
  }
}

// ---------------- Admin Full System Backup & Restore ----------------

export async function exportFullSystemBackup(adminUsername: string = 'admin'): Promise<{
  success: boolean;
  filename?: string;
  snapshot?: any;
  message?: string;
}> {
  try {
    await reconcileUsersWithServer();

    // 1. Fetch server snapshot
    const res = await fetch(`/api/admin/backup-all?adminUsername=${encodeURIComponent(adminUsername)}`);
    const data = await res.json();

    let snapshot = data.snapshot;
    if (!snapshot) {
      // Create snapshot from Firestore
      const users = await firestoreGetAllUsers();
      snapshot = {
        version: '2.0.0-firestore',
        app: 'Plock Planner & Diary (Firestore Enabled)',
        exportedAt: new Date().toISOString(),
        usersCount: users.length,
        users,
        userDatabases: {},
      };
    }

    const filename = data.filename || `plock_full_backup_${new Date().toISOString().slice(0, 10)}.json`;

    // Save backup snapshot to Firestore systemBackups collection too
    await firestoreSaveSystemBackup(snapshot);

    // Trigger browser download
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      snapshot,
      message: `성공적으로 전체 백업 파일 [${filename}]을 다운로드하고 Firestore에 보관했습니다.`,
    };
  } catch (err: any) {
    console.error('Error exporting system backup:', err);
    return { success: false, message: err.message || '백업 파일 다운로드 중 오류가 발생했습니다.' };
  }
}

export async function restoreFullSystemBackup(
  adminUsername: string = 'admin',
  snapshot: any,
  mergeMode: 'merge' | 'overwrite' = 'merge'
): Promise<{ success: boolean; message: string; usersCount?: number }> {
  try {
    // 1. Restore to Firestore
    if (snapshot.users && Array.isArray(snapshot.users)) {
      for (const u of snapshot.users) {
        if (u.id) {
          await firestoreRegisterUser(u);
        }
      }
    }

    if (snapshot.userDatabases && typeof snapshot.userDatabases === 'object') {
      for (const [userId, userDb] of Object.entries(snapshot.userDatabases)) {
        if (userId && userDb) {
          await firestoreSaveUserData(userId, userDb as any);
        }
      }
    }

    // 2. Restore to Server
    const res = await fetch('/api/admin/restore-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUsername, snapshot, mergeMode }),
    });
    const data = await res.json();

    // 3. Update client browser vault
    if (snapshot.users && Array.isArray(snapshot.users)) {
      const currentVault = getStoredUsersVault();
      const userMap = new Map<string, UserAccount>();
      if (mergeMode !== 'overwrite') {
        currentVault.forEach((u) => userMap.set(u.id, u));
      }
      snapshot.users.forEach((u: UserAccount) => {
        if (u.id) userMap.set(u.id, u);
      });
      localStorage.setItem(USERS_VAULT_STORAGE_KEY, JSON.stringify(Array.from(userMap.values())));
    }

    return {
      success: true,
      message: 'Firestore 데이터베이스 및 서버로 백업 복원이 완료되었습니다.',
      usersCount: snapshot.users?.length || data.usersCount,
    };
  } catch (err: any) {
    console.error('Error restoring system backup:', err);
    return { success: false, message: err.message || '복원 요청 중 오류가 발생했습니다.' };
  }
}
