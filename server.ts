import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// CORS & Static Files Setup
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const publicPath = path.join(process.cwd(), 'public');

// Explicit PWA routes with required headers
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicPath, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(publicPath, 'sw.js'));
});

app.use(express.static(publicPath));

// File-backed persistent data store for server-side user accounts & per-user cloud sync
const DB_FILE = path.join(process.cwd(), 'data_store.json');
const USERS_FILE = path.join(process.cwd(), 'users_store.json');
const USER_DATA_FILE = path.join(process.cwd(), 'data_store_users.json');

interface StoredUser {
  id: string;
  username: string;
  password: string; // Stored securely
  name: string;
  role?: 'admin' | 'user';
  avatarColor?: string;
  createdAt: string;
  googleEmail?: string;
  googleDisplayName?: string;
  googlePhotoUrl?: string;
  geminiApiKey?: string;
  useCustomGeminiKey?: boolean;
}

let appCloudDatabase: any = null;
let usersDatabase: StoredUser[] = [];
let userCloudDatabases: Record<string, any> = {};

// Load Legacy or Default Global DB
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    appCloudDatabase = JSON.parse(raw);
  }
} catch (err) {
  console.error('[Server] Error reading data_store.json:', err);
}

// Load Users Database
try {
  if (fs.existsSync(USERS_FILE)) {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    usersDatabase = JSON.parse(raw);
  }
} catch (err) {
  console.error('[Server] Error reading users_store.json:', err);
}

// Ensure Master Admin account exists
const adminIdx = usersDatabase.findIndex((u) => u.username.toLowerCase() === 'admin');
if (adminIdx === -1) {
  usersDatabase.unshift({
    id: 'usr_admin',
    username: 'admin',
    password: 'admin',
    name: '시스템 관리자',
    role: 'admin',
    avatarColor: '#1A1A1A',
    createdAt: '2026-08-01T00:00:00.000Z',
  });
  saveUsersToDisk();
} else {
  // Ensure admin role and password
  usersDatabase[adminIdx].role = 'admin';
  usersDatabase[adminIdx].password = usersDatabase[adminIdx].password || 'admin';
  saveUsersToDisk();
}

// Load Per-User Data Store
try {
  if (fs.existsSync(USER_DATA_FILE)) {
    const raw = fs.readFileSync(USER_DATA_FILE, 'utf-8');
    userCloudDatabases = JSON.parse(raw);
  }
} catch (err) {
  console.error('[Server] Error reading data_store_users.json:', err);
}

function saveUsersToDisk() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDatabase, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Server] Error writing to users_store.json:', err);
  }
}

function saveUserDataToDisk() {
  try {
    fs.writeFileSync(USER_DATA_FILE, JSON.stringify(userCloudDatabases, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Server] Error writing to data_store_users.json:', err);
  }
}

// Initialize Gemini AI client safely (supports user-specific Google Gemini API key)
const userAiClients = new Map<string, GoogleGenAI>();

function getGenAIClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = (customApiKey && customApiKey.trim()) || process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  const cleanKey = apiKey.trim();
  if (!userAiClients.has(cleanKey)) {
    userAiClients.set(
      cleanKey,
      new GoogleGenAI({
        apiKey: cleanKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    );
  }
  return userAiClients.get(cleanKey) || null;
}

function extractGeminiApiKey(req: express.Request): string | undefined {
  const headerKey = req.headers['x-gemini-api-key'] as string;
  if (headerKey && headerKey.trim()) return headerKey.trim();

  if (req.body && req.body.geminiApiKey && typeof req.body.geminiApiKey === 'string' && req.body.geminiApiKey.trim()) {
    return req.body.geminiApiKey.trim();
  }

  const userId = (req.body && req.body.userId) || (req.query && req.query.userId) || (req.headers['x-user-id'] as string);
  if (userId) {
    const user = usersDatabase.find((u) => u.id === userId);
    if (user && user.useCustomGeminiKey !== false && user.geminiApiKey && user.geminiApiKey.trim()) {
      return user.geminiApiKey.trim();
    }
  }

  return undefined;
}

// ---------------- API ROUTES ----------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. User Registration
app.post('/api/auth/register', (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ success: false, message: '아이디, 비밀번호, 이름을 모두 입력해주세요.' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  if (cleanUsername === 'admin') {
    return res.status(400).json({ success: false, message: 'admin은 시스템 관리자 전용 아이디입니다.' });
  }

  if (cleanUsername.length < 3) {
    return res.status(400).json({ success: false, message: '아이디는 3자 이상이어야 합니다.' });
  }

  const existing = usersDatabase.find((u) => u.username.toLowerCase() === cleanUsername);
  if (existing) {
    return res.status(400).json({ success: false, message: '이미 존재하는 아이디입니다. 다른 아이디를 선택해주세요.' });
  }

  const avatarColors = ['#C1876B', '#849283', '#7A6B58', '#3E5240', '#B25D3B', '#5A6B7C', '#8E5A78'];
  const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

  const newUser: StoredUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    username: cleanUsername,
    password: String(password).trim(),
    name: String(name).trim(),
    role: 'user',
    avatarColor: randomColor,
    createdAt: new Date().toISOString(),
  };

  usersDatabase.push(newUser);
  saveUsersToDisk();

  // Initialize fresh, completely clean isolated user data (no dummy items)
  userCloudDatabases[newUser.id] = {
    plannerItems: [],
    routines: [],
    checklist: [],
    diaries: [],
    financials: [],
    userStickers: [],
    categories: payloadDefaultCategories(),
    lastSyncedAt: new Date().toISOString(),
  };
  saveUserDataToDisk();

  const safeUser = {
    id: newUser.id,
    username: newUser.username,
    name: newUser.name,
    role: newUser.role,
    avatarColor: newUser.avatarColor,
    createdAt: newUser.createdAt,
  };

  res.json({
    success: true,
    user: safeUser,
    message: `${newUser.name}님, 회원가입이 완료되었습니다!`,
  });
});

// 2. User Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const user = usersDatabase.find(
    (u) => u.username.toLowerCase() === cleanUsername && u.password === String(password).trim()
  );

  if (!user) {
    return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }

  const safeUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role || (user.username === 'admin' ? 'admin' : 'user'),
    avatarColor: user.avatarColor,
    createdAt: user.createdAt,
  };

  const userData = userCloudDatabases[user.id] || {
    plannerItems: [],
    routines: [],
    checklist: [],
    diaries: [],
    financials: [],
    userStickers: [],
    categories: payloadDefaultCategories(),
    lastSyncedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    user: safeUser,
    data: userData,
    message: user.username === 'admin' ? '시스템 관리자로 로그인되었습니다.' : `반갑습니다, ${user.name}님!`,
  });
});

// 2.5. Sync Vault: Reconcile client-stored accounts with server database (prevents reset upon container/app updates)
app.post('/api/auth/sync-vault', (req, res) => {
  const { users } = req.body;
  let addedCount = 0;
  if (Array.isArray(users)) {
    for (const incoming of users) {
      if (!incoming || !incoming.username) continue;
      const cleanUsername = String(incoming.username).trim().toLowerCase();
      if (cleanUsername === 'admin') continue; // Don't override admin
      
      const existingIdx = usersDatabase.findIndex(
        (u) => u.username.toLowerCase() === cleanUsername || (incoming.id && u.id === incoming.id)
      );
      if (existingIdx === -1) {
        // Re-inject account into server memory and disk
        const restoredUser: StoredUser = {
          id: incoming.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          username: cleanUsername,
          password: incoming.password || '',
          name: incoming.name || incoming.username,
          role: incoming.role || 'user',
          avatarColor: incoming.avatarColor || '#C1876B',
          createdAt: incoming.createdAt || new Date().toISOString(),
        };
        usersDatabase.push(restoredUser);
        if (!userCloudDatabases[restoredUser.id]) {
          userCloudDatabases[restoredUser.id] = {
            plannerItems: [],
            routines: [],
            checklist: [],
            diaries: [],
            financials: [],
            userStickers: [],
            categories: payloadDefaultCategories(),
            lastSyncedAt: new Date().toISOString(),
          };
        }
        addedCount++;
      } else {
        // Sync password & name if updated
        if (incoming.password) {
          usersDatabase[existingIdx].password = incoming.password;
        }
        if (incoming.name) {
          usersDatabase[existingIdx].name = incoming.name;
        }
      }
    }
    if (addedCount > 0) {
      saveUsersToDisk();
      saveUserDataToDisk();
    }
  }

  res.json({
    success: true,
    addedCount,
    totalUsers: usersDatabase.length,
  });
});

// 3. Admin: List All Users with Stats (Only for admin)
app.get('/api/admin/users', (req, res) => {
  const adminUsername = String(req.query.adminUsername || req.headers['x-admin-user'] || '').trim().toLowerCase();
  if (adminUsername !== 'admin') {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }

  const usersWithStats = usersDatabase.map((u) => {
    const d = userCloudDatabases[u.id] || {};
    return {
      id: u.id,
      username: u.username,
      name: u.name,
      password: u.password,
      role: u.role || (u.username === 'admin' ? 'admin' : 'user'),
      avatarColor: u.avatarColor,
      createdAt: u.createdAt,
      plannerCount: Array.isArray(d.plannerItems) ? d.plannerItems.length : 0,
      checklistCount: Array.isArray(d.checklist) ? d.checklist.length : 0,
      diariesCount: Array.isArray(d.diaries) ? d.diaries.length : 0,
      financialsCount: Array.isArray(d.financials) ? d.financials.length : 0,
      routinesCount: Array.isArray(d.routines) ? d.routines.length : 0,
      lastSyncedAt: d.lastSyncedAt || null,
    };
  });

  res.json({ success: true, users: usersWithStats });
});

// 4. Admin: Delete User and All Stored User Data (Only for admin)
app.post('/api/admin/delete-user', (req, res) => {
  const { adminUsername, targetUserId } = req.body;
  if (String(adminUsername).trim().toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }

  if (!targetUserId) {
    return res.status(400).json({ success: false, message: '삭제할 대상 사용자 ID가 필요합니다.' });
  }

  const targetIdx = usersDatabase.findIndex((u) => u.id === targetUserId);
  if (targetIdx === -1) {
    return res.status(404).json({ success: false, message: '해당 사용자를 찾을 수 없습니다.' });
  }

  const targetUser = usersDatabase[targetIdx];
  if (targetUser.username.toLowerCase() === 'admin' || targetUser.id === 'usr_admin') {
    return res.status(400).json({ success: false, message: '시스템 관리자(admin) 계정은 삭제할 수 없습니다.' });
  }

  // Delete user from users store
  usersDatabase.splice(targetIdx, 1);
  saveUsersToDisk();

  // Delete all cloud data for that user
  if (userCloudDatabases[targetUserId]) {
    delete userCloudDatabases[targetUserId];
    saveUserDataToDisk();
  }

  res.json({
    success: true,
    message: `${targetUser.name}(@${targetUser.username}) 계정 및 저장 데이터가 성공적으로 삭제되었습니다.`,
    deletedUserId: targetUserId,
  });
});

// 4.5. Admin: Complete System Full Backup (Accounts + All User Planner/Diaries/Financial Data)
app.get('/api/admin/backup-all', (req, res) => {
  const adminUsername = String(req.query.adminUsername || req.headers['x-admin-user'] || '').trim().toLowerCase();
  if (adminUsername !== 'admin') {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }

  const backupSnapshot = {
    version: '1.0.0',
    app: 'Plock Planner & Diary',
    exportedAt: new Date().toISOString(),
    usersCount: usersDatabase.length,
    users: usersDatabase,
    userDatabases: userCloudDatabases,
    legacyGlobalDb: appCloudDatabase,
  };

  res.json({
    success: true,
    snapshot: backupSnapshot,
    filename: `plock_full_backup_${new Date().toISOString().slice(0, 10)}.json`,
  });
});

// 4.6. Admin: Restore System Full Backup (Reconstruct Accounts & User Data)
app.post('/api/admin/restore-all', (req, res) => {
  const { adminUsername, snapshot, mergeMode = 'merge' } = req.body;
  if (String(adminUsername).trim().toLowerCase() !== 'admin') {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }

  if (!snapshot || !snapshot.users || !Array.isArray(snapshot.users)) {
    return res.status(400).json({ success: false, message: '올바른 백업 스냅샷 JSON 파일이 아닙니다.' });
  }

  try {
    let restoredUsersCount = 0;
    const incomingUsers: StoredUser[] = snapshot.users;
    const incomingDataMap = snapshot.userDatabases || {};

    if (mergeMode === 'overwrite') {
      // Overwrite mode (keep admin intact)
      const currentAdmin = usersDatabase.find((u) => u.username === 'admin');
      usersDatabase = incomingUsers;
      if (currentAdmin && !usersDatabase.some((u) => u.username === 'admin')) {
        usersDatabase.unshift(currentAdmin);
      }
      userCloudDatabases = incomingDataMap;
      restoredUsersCount = usersDatabase.length;
    } else {
      // Merge mode
      for (const incUser of incomingUsers) {
        if (!incUser.id || !incUser.username) continue;
        const existingIdx = usersDatabase.findIndex(
          (u) => u.id === incUser.id || u.username.toLowerCase() === incUser.username.toLowerCase()
        );
        if (existingIdx !== -1) {
          // Update credentials & meta
          usersDatabase[existingIdx] = { ...usersDatabase[existingIdx], ...incUser };
        } else {
          usersDatabase.push(incUser);
        }
        restoredUsersCount++;

        // Restore user data if present
        if (incomingDataMap[incUser.id]) {
          userCloudDatabases[incUser.id] = incomingDataMap[incUser.id];
        }
      }
    }

    saveUsersToDisk();
    saveUserDataToDisk();

    res.json({
      success: true,
      message: `성공적으로 ${restoredUsersCount}명의 계정 및 데이터가 복원/동기화되었습니다.`,
      usersCount: usersDatabase.length,
    });
  } catch (err: any) {
    console.error('[Server] Restore failed:', err);
    res.status(500).json({ success: false, message: `복원 처리 중 오류: ${err.message}` });
  }
});

// 5. Normal Users List (Blank for normal user privacy)
app.get('/api/auth/users', (req, res) => {
  res.json({ success: true, users: [] });
});

// 4. Per-User Data Fetch
app.get('/api/user/data', (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const data = userCloudDatabases[userId] || null;
  res.json({
    success: true,
    data: data,
    lastSyncedAt: data?.lastSyncedAt || new Date().toISOString(),
  });
});

// 5. Per-User Data Save
app.post('/api/user/data', (req, res) => {
  const { userId, payload } = req.body;
  if (!userId || !payload) {
    return res.status(400).json({ success: false, message: 'userId and payload are required' });
  }

  const existing = userCloudDatabases[userId] || {};
  const isResetAll = payload.isResetAll === true;

  const mergedPlanner = isResetAll
    ? []
    : Array.isArray(payload.plannerItems)
    ? payload.plannerItems
    : existing.plannerItems || [];

  const mergedRoutines = isResetAll
    ? []
    : Array.isArray(payload.routines)
    ? payload.routines
    : existing.routines || [];

  const mergedChecklist = isResetAll
    ? []
    : Array.isArray(payload.checklist)
    ? payload.checklist
    : existing.checklist || [];

  const mergedDiaries = isResetAll
    ? []
    : Array.isArray(payload.diaries)
    ? payload.diaries
    : existing.diaries || [];

  const mergedFinancials = isResetAll
    ? []
    : Array.isArray(payload.financials)
    ? payload.financials
    : existing.financials || [];

  const mergedUserStickers = isResetAll
    ? []
    : Array.isArray(payload.userStickers)
    ? payload.userStickers
    : existing.userStickers || [];

  const mergedCategories = isResetAll
    ? []
    : Array.isArray(payload.categories) && payload.categories.length > 0
    ? payload.categories
    : existing.categories || payloadDefaultCategories();

  const finalUserData = {
    plannerItems: mergedPlanner,
    routines: mergedRoutines,
    checklist: mergedChecklist,
    diaries: mergedDiaries,
    financials: mergedFinancials,
    userStickers: mergedUserStickers,
    categories: mergedCategories,
    lastSyncedAt: new Date().toISOString(),
  };

  userCloudDatabases[userId] = finalUserData;
  saveUserDataToDisk();

  res.json({
    success: true,
    data: finalUserData,
    lastSyncedAt: finalUserData.lastSyncedAt,
  });
});

// 6. Per-User Data Reset
app.post('/api/user/reset', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const resetData = {
    plannerItems: [],
    routines: [],
    checklist: [],
    diaries: [],
    financials: [],
    userStickers: [],
    categories: payloadDefaultCategories(),
    lastSyncedAt: new Date().toISOString(),
  };

  userCloudDatabases[userId] = resetData;
  saveUserDataToDisk();

  res.json({
    success: true,
    message: 'User data cleared successfully',
    data: resetData,
  });
});

// Fallback legacy sync
app.get('/api/sync/data', (req, res) => {
  const defaultUser = usersDatabase[0]?.id || 'usr_minsoo';
  const data = userCloudDatabases[defaultUser] || appCloudDatabase;
  res.json({
    synced: !!data,
    data: data,
    lastSyncedAt: data?.lastSyncedAt || new Date().toISOString(),
  });
});

app.post('/api/sync/data', (req, res) => {
  const payload = req.body;
  const defaultUser = usersDatabase[0]?.id || 'usr_minsoo';
  userCloudDatabases[defaultUser] = {
    ...payload,
    lastSyncedAt: new Date().toISOString(),
  };
  saveUserDataToDisk();
  res.json({
    success: true,
    data: userCloudDatabases[defaultUser],
  });
});

function payloadDefaultCategories() {
  return [
    { id: 'work', name: '업무/직장', color: '#1A1A1A' },
    { id: 'personal', name: '개인일정', color: '#C1876B' },
    { id: 'health', name: '운동/건강', color: '#849283' },
    { id: 'study', name: '자기계발', color: '#7A6B58' },
    { id: 'finance', name: '가계/금융', color: '#B25D3B' },
    { id: 'travel', name: '여행/외출', color: '#3E5240' },
    { id: 'routine', name: '루틴/반복', color: '#2A2A2A' },
    { id: 'other', name: '기타', color: '#6B7280' },
  ];
}

// iCalendar (.ics) Status & Export helper
app.get('/api/calendar/ical-status', (req, res) => {
  res.json({
    supported: true,
    format: 'iCalendar (RFC 5545)',
    fileExtension: '.ics',
    targetApplications: ['Google Calendar', 'Apple Calendar', 'Microsoft Outlook', 'Samsung Calendar'],
    directGoogleImportUrl: 'https://calendar.google.com/calendar/r/settings/export',
  });
});

// 2.6. User Gemini API Configuration Endpoint
app.post('/api/user/gemini-config', (req, res) => {
  const { userId, geminiApiKey, useCustomGeminiKey, googleEmail, googleDisplayName, googlePhotoUrl } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'userId is required' });
  }

  const userIdx = usersDatabase.findIndex((u) => u.id === userId);
  if (userIdx !== -1) {
    if (geminiApiKey !== undefined) usersDatabase[userIdx].geminiApiKey = String(geminiApiKey).trim();
    if (useCustomGeminiKey !== undefined) usersDatabase[userIdx].useCustomGeminiKey = Boolean(useCustomGeminiKey);
    if (googleEmail !== undefined) usersDatabase[userIdx].googleEmail = String(googleEmail).trim();
    if (googleDisplayName !== undefined) usersDatabase[userIdx].googleDisplayName = String(googleDisplayName).trim();
    if (googlePhotoUrl !== undefined) usersDatabase[userIdx].googlePhotoUrl = String(googlePhotoUrl).trim();
    saveUsersToDisk();
  }

  res.json({
    success: true,
    message: '사용자 Google Gemini 설정이 성공적으로 저장되었습니다.',
    config: {
      userId,
      hasKey: !!(geminiApiKey && String(geminiApiKey).trim()),
      useCustomGeminiKey: useCustomGeminiKey !== false,
      googleEmail,
      googleDisplayName,
    },
  });
});

// 2.7. Test Gemini API Key
app.post('/api/ai/test-key', async (req, res) => {
  const apiKey = extractGeminiApiKey(req);
  if (!apiKey) {
    return res.status(400).json({
      success: false,
      message: '인증할 Google Gemini API 키가 제공되지 않았습니다. API 키를 입력해주세요.',
    });
  }

  try {
    const ai = getGenAIClient(apiKey);
    if (!ai) {
      return res.status(400).json({
        success: false,
        message: 'Google GenAI 클라이언트 초기화에 실패했습니다. 키 형식을 확인해주세요.',
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: '안녕하세요! Google Gemini API 연결 확인을 위한 1줄 인사말을 짧게 답해주세요.',
    });

    const responseText = response.text || '';
    res.json({
      success: true,
      model: 'gemini-3.7-flash',
      message: 'Google Gemini API 연결에 성공했습니다! (정상 작동 확인)',
      sampleResponse: responseText.trim(),
    });
  } catch (err: any) {
    console.error('[Server] Gemini API Key Test failed:', err);
    res.status(400).json({
      success: false,
      message: `Gemini API 인증 오류: ${err.message || '유효하지 않은 API 키이거나 할당량이 초과되었습니다.'}`,
    });
  }
});

// AI Insights with Gemini API (User Google Gemini account prioritized)
app.post('/api/ai/analyze', async (req, res) => {
  try {
    const customKey = extractGeminiApiKey(req);
    const ai = getGenAIClient(customKey);
    if (!ai) {
      return res.json({
        analysis: "감정 다이어리와 플래너 데이터가 차곡차곡 쌓이고 있습니다! 규칙적인 루틴 달성과 감사 일기 쓰기는 긍정적인 에너지를 돋워줍니다.",
        isUserApiKey: false,
      });
    }

    const { diaryEntries, routines, financials } = req.body;

    const prompt = `
당신은 똑똑하고 따뜻한 퍼스널 라이프 코치입니다.
사용자의 최근 다이어리, 루틴, 가계부 기록을 요약하여 한국어로 친절하게 피드백 및 조언을 3~4문장으로 작성해주세요.

최근 일기 정보: ${JSON.stringify(diaryEntries || []).slice(0, 1000)}
현재 진행 중인 루틴: ${JSON.stringify(routines || []).slice(0, 500)}
최근 지출 내역 요약: ${JSON.stringify(financials || []).slice(0, 500)}

격려의 메시지와 짧은 꿀팁 1개를 포함해주세요.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const text = response.text || "오늘 하루도 멋지게 계획하고 기록하셨습니다!";
    res.json({ analysis: text, isUserApiKey: !!customKey });
  } catch (error: any) {
    console.error("AI Generation error:", error);
    res.json({
      analysis: "오늘 하루도 꾸준히 루틴을 이어나가고 계시네요! 기록을 통해 하루를 돌아보는 습관은 더 나은 내일을 만드는 유용한 자산입니다.",
      error: error.message,
    });
  }
});

// AI Natural Language Input Parser & Intent Classifier Endpoint (User Google Gemini account prioritized)
app.post('/api/ai/parse-intent', async (req, res) => {
  const { text, referenceDate, dayOfWeek, currentTime, categories } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'Input text is required' });
  }

  const todayStr = referenceDate || new Date().toISOString().split('T')[0];
  const currentDayKr = dayOfWeek || '화요일';
  const categoryListStr = Array.isArray(categories) && categories.length > 0
    ? categories.map((c: any) => `${c.id} (${c.name})`).join(', ')
    : 'work (업무/직장), personal (개인일정), health (운동/건강), study (자기계발), finance (가계/금융), travel (여행/외출), routine (루틴/반복), other (기타)';

  try {
    const customKey = extractGeminiApiKey(req);
    const ai = getGenAIClient(customKey);
    if (!ai) {
      // Fallback response if no API key is set
      return res.json({
        success: false,
        useLocalFallback: true,
        message: 'No API key configured, falling back to local regex/date calculation'
      });
    }

    const systemPrompt = `당신은 일정 및 할 일(Task) 자연어 파싱 전문 AI 플래너 엔진입니다.
사용자가 자연어로 입력한 문장(예: '이번 주 일요일까지 집청소하기', '내일 오후 3시 팀 회의', '금요일부터 일요일까지 제주도 여행 준비')을 분석하여 캘린더 일정(Planner) 및 체크리스트(Checklist), 루틴(Routine) 정보를 정확히 추출하고 JSON으로 응답합니다.

[현재 기준 시점 정보]
- 오늘 날짜(referenceDate): ${todayStr} (${currentDayKr})
- 현재 시각: ${currentTime || '12:00'}
- 사용 가능한 카테고리 목록: ${categoryListStr}

[날짜 추론 및 기간 계산 규칙]
1. '오늘': ${todayStr}
2. '내일', '모레', '글피', '이번 주 무슨요일', '다음 주 무슨요일'을 오늘 기준 날짜로 정확히 계산하세요.
   - 예: 오늘이 화요일(2026-08-25)일 때,
     - '이번 주 수요일' = 2026-08-26
     - '이번 주 일요일' = 2026-08-30
     - '다음 주 월요일' = 2026-08-31
3. '~부터 ~까지' 범위 입력 시:
   - 시작일(startDate)과 종료일(endDate)을 각각 산출합니다.
4. '무슨 요일까지 ~하기', '~까지 할 것' 처럼 마감 기한이 있는 할 일인 경우:
   - targetDate는 마감 기한 일자입니다.
   - actionType은 캘린더 일정과 체크리스트 할 일 모두에 유용하므로 "both" (또는 문맥에 따라 "checklist" / "planner")로 분류합니다.
5. '매일', '평일마다', '아침마다', '루틴' 등이 포함된 경우:
   - actionType: "routine"
   - routineFrequency: 'daily' | 'weekdays' | 'weekends' | 'weekly'
6. 시간(startTime, endTime) 추출:
   - '오후 3시' -> "15:00"
   - '오전 9시 30분' -> "09:30"
   - 명시되지 않은 경우 null로 설정합니다.
7. 제목(title):
   - 날짜 및 조사/어미('까지', '부터', '하기', '할 것', '하자')를 정제하여 핵심 할 일 명칭(예: '집청소', '팀 회의', '제주도 여행 준비')을 추출합니다.

[반환 JSON 스키마 (반드시 순수 JSON만 반환)]:
{
  "title": "추출된 핵심 할 일/일정 제목",
  "actionType": "both" | "planner" | "checklist" | "routine",
  "targetDate": "YYYY-MM-DD",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "startTime": "HH:mm" | null,
  "endTime": "HH:mm" | null,
  "categoryId": "카테고리 id (work/personal/health/study/finance/travel/routine/other 중 최적)",
  "categoryName": "카테고리 이름",
  "priority": "high" | "medium" | "low",
  "plannerTitle": "캘린더 일정용 제목",
  "checklistTitle": "체크리스트 할 일용 제목",
  "description": "상세 메모/설명",
  "routineFrequency": "daily" | "weekdays" | "weekends" | "weekly" | null,
  "reasoning": "오늘(M/D 요일) 기준으로 날짜와 태스크를 어떻게 분류했는지 사용자가 알기 쉽게 설명하는 한국어 1~2문장"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: `사용자 입력: "${text}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.1,
      },
    });

    const outputText = response.text?.trim() || '{}';
    const parsedData = JSON.parse(outputText);

    res.json({
      success: true,
      data: parsedData,
      rawInput: text,
      isUserApiKey: !!customKey,
      parsedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("AI Parse Intent error:", err);
    res.json({
      success: false,
      useLocalFallback: true,
      error: err.message || 'LLM parsing error',
      rawInput: text
    });
  }
});

// ---------------- VITE MIDDLEWARE & SERVING ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
