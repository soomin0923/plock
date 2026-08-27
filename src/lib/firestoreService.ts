import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
} from './firebase';
import { UserAccount } from '../types';

export interface UserCloudPayload {
  planner?: any[];
  checklist?: any[];
  diaries?: any[];
  financials?: any[];
  routines?: any[];
  categories?: any[];
  themeSettings?: any;
  updatedAt?: string;
  [key: string]: any;
}

// 1. User Account Operations in Firestore
export async function firestoreRegisterUser(user: UserAccount): Promise<boolean> {
  try {
    if (!user || !user.id) return false;
    const userDocRef = doc(db, 'users', user.id);
    await setDoc(userDocRef, {
      ...user,
      lastSyncedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Error saving user:', err);
    return false;
  }
}

export async function firestoreFindUser(username: string): Promise<UserAccount | null> {
  try {
    const cleanUsername = username.trim().toLowerCase();
    const querySnapshot = await getDocs(collection(db, 'users'));
    for (const d of querySnapshot.docs) {
      const u = d.data() as UserAccount;
      if (u.username && u.username.toLowerCase() === cleanUsername) {
        return { ...u, id: d.id };
      }
    }
    return null;
  } catch (err) {
    console.warn('[Firestore] Error finding user:', err);
    return null;
  }
}

export async function firestoreGetAllUsers(): Promise<UserAccount[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const list: UserAccount[] = [];
    querySnapshot.forEach((d) => {
      list.push({ ...(d.data() as UserAccount), id: d.id });
    });
    return list;
  } catch (err) {
    console.warn('[Firestore] Error getting all users:', err);
    return [];
  }
}

export async function firestoreDeleteUser(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;
    // 1. Delete user account document
    await deleteDoc(doc(db, 'users', userId));
    // 2. Delete user data document
    await deleteDoc(doc(db, 'userData', userId));
    return true;
  } catch (err) {
    console.warn('[Firestore] Error deleting user:', err);
    return false;
  }
}

// 2. User Data Sync in Firestore
export async function firestoreSaveUserData(userId: string, data: UserCloudPayload): Promise<boolean> {
  try {
    if (!userId) return false;
    const docRef = doc(db, 'userData', userId);
    await setDoc(docRef, {
      ...data,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    console.warn('[Firestore] Error saving user data:', err);
    return false;
  }
}

export async function firestoreGetUserData(userId: string): Promise<UserCloudPayload | null> {
  try {
    if (!userId) return null;
    const docRef = doc(db, 'userData', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserCloudPayload;
    }
    return null;
  } catch (err) {
    console.warn('[Firestore] Error getting user data:', err);
    return null;
  }
}

// 3. Realtime Listener for User Data
export function subscribeToUserData(
  userId: string,
  onData: (data: UserCloudPayload) => void,
  onError?: (error: any) => void
) {
  if (!userId) return () => {};
  const docRef = doc(db, 'userData', userId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData(snapshot.data() as UserCloudPayload);
      }
    },
    (err) => {
      console.warn('[Firestore] Listener error:', err);
      if (onError) onError(err);
    }
  );
}

// 4. Full System Backup & Restore to Firestore
export async function firestoreSaveSystemBackup(snapshot: any): Promise<boolean> {
  try {
    const backupId = `backup_${Date.now()}`;
    const backupDocRef = doc(db, 'systemBackups', backupId);
    await setDoc(backupDocRef, {
      ...snapshot,
      savedToFirestoreAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn('[Firestore] Error saving system backup:', err);
    return false;
  }
}
