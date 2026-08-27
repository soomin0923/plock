import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  User,
  Trash2,
  RefreshCw,
  X,
  Search,
  AlertTriangle,
  Calendar,
  CheckSquare,
  BookOpen,
  CreditCard,
  ShieldAlert,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  Download,
  Upload,
  Database,
  Server,
  FileJson,
  CheckCircle2,
  HelpCircle,
  HardDriveDownload,
  HardDriveUpload,
  Sparkles,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  fetchAdminUsers,
  deleteUserByAdmin,
  exportFullSystemBackup,
  restoreFullSystemBackup,
} from '../lib/authService';

interface AdminUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onUserDeleted?: (deletedUserId: string) => void;
  primaryColor?: string;
  onShowToast?: (msg: string) => void;
}

export const AdminUserModal: React.FC<AdminUserModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserDeleted,
  primaryColor = '#1A1A1A',
  onShowToast,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<UserAccount | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [visiblePasswordIds, setVisiblePasswordIds] = useState<Record<string, boolean>>({});
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);

  // Backup & Restore State
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [showServerGuide, setShowServerGuide] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
      setStatusMsg(null);
      setConfirmUser(null);
      setVisiblePasswordIds({});
      setShowAllPasswords(false);
    }
  }, [isOpen]);

  const loadUsers = async () => {
    setIsLoading(true);
    const res = await fetchAdminUsers('admin');
    setIsLoading(false);
    if (res.success) {
      setUsers(res.users);
    } else {
      setStatusMsg({ type: 'error', text: res.message || '사용자 목록을 불러오지 못했습니다.' });
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswordIds((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleCopyPassword = (userId: string, pass: string) => {
    if (!pass) return;
    navigator.clipboard.writeText(pass);
    setCopiedPasswordId(userId);
    setTimeout(() => {
      setCopiedPasswordId(null);
    }, 2000);
  };

  // Full Backup Export
  const handleExportBackup = async () => {
    setIsExportingBackup(true);
    const res = await exportFullSystemBackup('admin');
    setIsExportingBackup(false);

    if (res.success) {
      setStatusMsg({
        type: 'success',
        text: `전체 계정 및 플래너 데이터 백업 파일 [${res.filename}]이 다운로드되었습니다.`,
      });
      if (onShowToast) {
        onShowToast(`📦 전체 시스템 백업 완료: ${res.filename}`);
      }
    } else {
      setStatusMsg({ type: 'error', text: res.message || '백업 생성에 실패했습니다.' });
    }
  };

  // Full Backup Restore from JSON File
  const handleRestoreFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      setStatusMsg({ type: 'error', text: 'JSON 형식의 백업 파일(.json)만 복원할 수 있습니다.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const rawJson = evt.target?.result as string;
        const snapshot = JSON.parse(rawJson);

        if (!snapshot || (!snapshot.users && !snapshot.userDatabases)) {
          setStatusMsg({ type: 'error', text: '유효한 Plock 백업 파일 형식이 아닙니다.' });
          return;
        }

        setIsRestoringBackup(true);
        const res = await restoreFullSystemBackup('admin', snapshot, 'merge');
        setIsRestoringBackup(false);

        if (res.success) {
          setStatusMsg({
            type: 'success',
            text: `백업 복원 완료: ${res.message} (총 ${res.usersCount}명)`,
          });
          if (onShowToast) {
            onShowToast(`✨ 백업 파일 복원 완료 (${res.usersCount}개 계정 및 데이터 복구됨)`);
          }
          await loadUsers();
        } else {
          setStatusMsg({ type: 'error', text: res.message });
        }
      } catch (err: any) {
        setIsRestoringBackup(false);
        setStatusMsg({ type: 'error', text: `파일 파싱 실패: ${err.message}` });
      }
    };
    reader.readAsText(file);
    // Reset file input
    e.target.value = '';
  };

  const handleDeleteUser = async (user: UserAccount) => {
    if (user.username === 'admin' || user.role === 'admin') {
      setStatusMsg({ type: 'error', text: '관리자(admin) 계정은 삭제할 수 없습니다.' });
      return;
    }

    setDeletingId(user.id);
    const res = await deleteUserByAdmin('admin', user.id);
    setDeletingId(null);
    setConfirmUser(null);

    if (res.success) {
      setStatusMsg({ type: 'success', text: res.message });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      if (onUserDeleted) {
        onUserDeleted(user.id);
      }
    } else {
      setStatusMsg({ type: 'error', text: res.message });
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFCF9] rounded-2xl max-w-3xl w-full border border-stone-300 shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-900 text-stone-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-xs font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif font-bold text-lg text-white">
                  사용자 계정 및 시스템 백업 관리 (Admin)
                </h3>
                <span className="text-[10px] font-mono uppercase tracking-wider bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Full Control
                </span>
              </div>
              <p className="text-xs text-stone-300 mt-0.5">
                모든 사용자 계정 &amp; 플래너 데이터를 파일로 전체 백업/복원하고, 계정 정보와 비밀번호를 관리합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Action Banner: Full Backup & Restore */}
        <div className="bg-amber-950/10 border-b border-amber-200/80 p-3.5 px-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-stone-800">
            <Database className="w-4 h-4 text-amber-800 shrink-0" />
            <span className="font-bold">업데이트 대비 전체 스냅샷:</span>
            <span className="text-[11px] text-stone-600">
              코드 수정 전 백업을 다운로드해 두면 언제든 1초 만에 계정과 일정을 복구할 수 있습니다.
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Backup Download Button */}
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isExportingBackup}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-amber-300 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer active:scale-95 border border-amber-400/30"
              title="모든 계정 및 플래너/일기/가계부 데이터를 JSON 파일로 다운로드"
            >
              {isExportingBackup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <HardDriveDownload className="w-3.5 h-3.5" />
              )}
              <span>전체 백업 다운로드 (.json)</span>
            </button>

            {/* Restore Button */}
            <input
              ref={restoreFileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleRestoreFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => restoreFileInputRef.current?.click()}
              disabled={isRestoringBackup}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 disabled:opacity-50 text-stone-800 border border-stone-300 font-bold text-xs rounded-xl transition-all shadow-2xs flex items-center space-x-1.5 cursor-pointer active:scale-95"
              title="이전에 다운로드한 .json 백업 파일을 업로드하여 계정과 데이터 복원"
            >
              {isRestoringBackup ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <HardDriveUpload className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>백업 복원 (.json)</span>
            </button>

            {/* Server Architecture Guide Toggle */}
            <button
              type="button"
              onClick={() => setShowServerGuide((prev) => !prev)}
              className="px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 font-semibold rounded-xl transition-colors flex items-center space-x-1"
              title="독립 데이터베이스 서버 구축 가이드 확인"
            >
              <Server className="w-3.5 h-3.5" />
              <span>독립 서버 가이드</span>
            </button>
          </div>
        </div>

        {/* Server & DB Guide Box */}
        {showServerGuide && (
          <div className="bg-blue-950/5 border-b border-blue-200 p-4 px-5 text-xs text-blue-950 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="font-bold flex items-center gap-1.5 text-blue-900 text-sm">
                <Server className="w-4 h-4 text-blue-600" />
                <span>데이터 영구 보존 &amp; 독립 데이터베이스 서버 구축 방안</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowServerGuide(false)}
                className="text-stone-400 hover:text-stone-700 text-xs font-bold"
              >
                닫기 ✕
              </button>
            </div>
            <p className="text-[11px] text-blue-900/90 leading-relaxed">
              <strong>💡 데이터가 사라졌던 이유:</strong> 클라우드 컨테이너 환경(Cloud Run 등)은 코드가 새로 빌드되거나 배포될 때 새로운 컨테이너 인스턴스가 생성되어 서버 내 로컬 파일(<code>users_store.json</code>)이 초기화될 수 있습니다. 현재는 브라우저 Vault와 서버 간 자동 양방향 동기화 및 관리자 JSON 백업으로 안전하게 보존됩니다.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[11px]">
              <div className="p-2.5 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1">
                <div className="font-bold text-amber-900">1. Firebase Firestore (추천)</div>
                <p className="text-stone-600 text-[10px] leading-tight">
                  Google 공식 NoSQL DB로 실시간 동기화와 영구 보존이 가능하며 무료 사용량이 넉넉합니다.
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1">
                <div className="font-bold text-emerald-900">2. Supabase / PostgreSQL</div>
                <p className="text-stone-600 text-[10px] leading-tight">
                  관계형 SQL 기반의 완전 영구형 클라우드 데이터베이스로 계정과 권한을 완벽히 분리 관리합니다.
                </p>
              </div>
              <div className="p-2.5 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-1">
                <div className="font-bold text-purple-900">3. 독립 VPS/AWS 백엔드</div>
                <p className="text-stone-600 text-[10px] leading-tight">
                  전용 Linux 서버(EC2, Lightsail)에 Node.js 서버를 띄우고 영구 EBS/S3를 붙여 단독 운영합니다.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-4 border-b border-stone-200 bg-stone-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="아이디 또는 이름 검색..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={() => setShowAllPasswords((prev) => !prev)}
              className={`px-2.5 py-1.5 text-xs font-medium border rounded-lg transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer ${
                showAllPasswords
                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                  : 'bg-white text-stone-700 hover:bg-stone-100 border-stone-300'
              }`}
              title="모든 사용자의 비밀번호 표시 토글"
            >
              {showAllPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showAllPasswords ? '비밀번호 전체 숨김' : '비밀번호 전체 표시'}</span>
            </button>

            <span className="text-xs text-stone-600 font-medium hidden sm:inline">
              총 <b className="text-stone-900">{users.length}</b>명
            </span>

            <button
              onClick={loadUsers}
              disabled={isLoading}
              className="px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-100 border border-stone-300 rounded-lg transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>새로고침</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`px-5 py-2.5 text-xs font-medium flex items-center justify-between ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            <span>{statusMsg.text}</span>
            <button onClick={() => setStatusMsg(null)} className="text-stone-400 hover:text-stone-700 cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12 text-stone-500 text-sm">
              {searchQuery ? '검색된 사용자가 없습니다.' : '등록된 사용자가 없습니다.'}
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isAdmin = u.username === 'admin' || u.role === 'admin';
              const isCurrent = currentUser?.id === u.id;
              const isRevealed = showAllPasswords || visiblePasswordIds[u.id];

              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAdmin
                      ? 'bg-amber-50/50 border-amber-300/80 shadow-xs'
                      : 'bg-white border-stone-200 hover:border-stone-300 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div
                        style={{ backgroundColor: u.avatarColor || '#6B7280' }}
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-2xs"
                      >
                        {isAdmin ? '👑' : u.name ? u.name.slice(0, 1) : u.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-stone-900 text-sm">{u.name}</span>
                          <span className="text-xs font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                            @{u.username}
                          </span>
                          {isAdmin && (
                            <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded-md shadow-2xs">
                              시스템 관리자
                            </span>
                          )}
                          {isCurrent && (
                            <span className="text-[10px] bg-stone-800 text-white font-bold px-1.5 py-0.2 rounded-md">
                              현재 접속중
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>가입: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</span>
                          {u.lastSyncedAt && (
                            <span>최근 동기화: {new Date(u.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Data Stats & Delete Action */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                      {/* Stats Pills */}
                      <div className="flex items-center space-x-2 text-[11px] text-stone-600 bg-stone-50 px-2.5 py-1.5 rounded-lg border border-stone-200/80">
                        <span title="플래너 일정" className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-amber-700" />
                          <span>{u.plannerCount || 0}</span>
                        </span>
                        <span className="text-stone-300">•</span>
                        <span title="체크리스트" className="flex items-center space-x-1">
                          <CheckSquare className="w-3 h-3 text-teal-700" />
                          <span>{u.checklistCount || 0}</span>
                        </span>
                        <span className="text-stone-300">•</span>
                        <span title="일기" className="flex items-center space-x-1">
                          <BookOpen className="w-3 h-3 text-stone-700" />
                          <span>{u.diariesCount || 0}</span>
                        </span>
                        <span className="text-stone-300">•</span>
                        <span title="가계부" className="flex items-center space-x-1">
                          <CreditCard className="w-3 h-3 text-emerald-700" />
                          <span>{u.financialsCount || 0}</span>
                        </span>
                      </div>

                      {/* Delete Button */}
                      {!isAdmin ? (
                        <button
                          onClick={() => setConfirmUser(u)}
                          disabled={deletingId === u.id}
                          className="px-2.5 py-1.5 text-xs font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 rounded-lg transition-all flex items-center space-x-1 shadow-2xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>삭제</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-stone-400 italic px-2">보호됨</span>
                      )}
                    </div>
                  </div>

                  {/* Password Inspection Row */}
                  <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <div className="flex items-center space-x-2 bg-stone-50 hover:bg-stone-100/80 px-2.5 py-1.5 rounded-lg border border-stone-200/80 transition-colors">
                      <Key className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span className="text-[11px] font-semibold text-stone-500">비밀번호:</span>
                      <span
                        className={`font-mono text-xs font-bold transition-all select-all ${
                          isRevealed
                            ? 'text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200'
                            : 'text-stone-400 tracking-widest'
                        }`}
                      >
                        {isRevealed ? (u.password || '(비밀번호 없음)') : '••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility(u.id)}
                        title={isRevealed ? '비밀번호 숨기기' : '비밀번호 확인'}
                        className="p-1 text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200/60 transition-colors cursor-pointer"
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-stone-700" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {u.password && (
                        <button
                          type="button"
                          onClick={() => handleCopyPassword(u.id, u.password!)}
                          title="비밀번호 클립보드에 복사"
                          className="p-1 text-stone-500 hover:text-amber-700 rounded hover:bg-stone-200/60 transition-colors cursor-pointer flex items-center space-x-1"
                        >
                          {copiedPasswordId === u.id ? (
                            <span className="flex items-center space-x-0.5 text-[10px] text-emerald-600 font-bold">
                              <Check className="w-3.5 h-3.5" />
                              <span>복사됨!</span>
                            </span>
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    <div className="text-[10px] font-mono text-stone-400">
                      ID: {u.id}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Sub-Modal */}
        {confirmUser && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-2xs">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-stone-300 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center space-x-3 text-red-600">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">계정 및 데이터 영구 삭제</h4>
                  <p className="text-[11px] text-stone-500">삭제 후 데이터는 복구할 수 없습니다.</p>
                </div>
              </div>

              <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-700 space-y-1.5 border border-stone-200">
                <div>
                  사용자: <b>{confirmUser.name}</b> (@{confirmUser.username})
                </div>
                <div className="text-stone-500 text-[11px]">
                  삭제 대상: 플래너 ({confirmUser.plannerCount || 0}건), 체크리스트 ({confirmUser.checklistCount || 0}건), 일기 ({confirmUser.diariesCount || 0}건), 가계부 ({confirmUser.financialsCount || 0}건) 및 개인 설정 전체
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmUser(null)}
                  className="flex-1 py-2 text-xs font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteUser(confirmUser)}
                  disabled={deletingId === confirmUser.id}
                  className="flex-1 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {deletingId === confirmUser.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>영구 삭제</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50/80 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>관리자 보안 모드 작동 중 (비밀번호 조회 및 스냅샷 복원 권한)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-stone-800 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
