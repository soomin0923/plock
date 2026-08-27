import React, { useState, useEffect } from 'react';
import { User, Lock, UserPlus, LogIn, LogOut, CheckCircle2, ShieldCheck, RefreshCw, X, Shield } from 'lucide-react';
import { UserAccount } from '../types';
import { loginUserAccount, registerUserAccount } from '../lib/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (user: UserAccount, data?: any) => void;
  onLogout: () => void;
  onOpenAdminModal?: () => void;
  primaryColor?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
  onOpenAdminModal,
  primaryColor = '#C1876B',
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await loginUserAccount(username.trim(), password.trim());
    setIsLoading(false);

    if (res.success && res.user) {
      setSuccessMsg(`${res.user.name}님으로 로그인되었습니다!`);
      setTimeout(() => {
        onLoginSuccess(res.user!, res.data);
        onClose();
      }, 400);
    } else {
      setErrorMsg(res.message || '로그인에 실패했습니다.');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !name.trim()) {
      setErrorMsg('아이디, 비밀번호, 이름을 모두 입력해주세요.');
      return;
    }

    if (username.trim().toLowerCase() === 'admin') {
      setErrorMsg('admin은 시스템 관리자 전용 아이디입니다.');
      return;
    }

    if (username.trim().length < 3) {
      setErrorMsg('아이디는 최소 3자 이상 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await registerUserAccount(username.trim(), password.trim(), name.trim());
    setIsLoading(false);

    if (res.success && res.user) {
      setSuccessMsg('회원가입이 완료되었습니다! 깨끗한 개인 데이터베이스가 생성되었습니다.');
      setTimeout(() => {
        onLoginSuccess(res.user!, null);
        onClose();
      }, 500);
    } else {
      setErrorMsg(res.message || '회원가입에 실패했습니다.');
    }
  };

  const isAdmin = currentUser?.username === 'admin' || currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FDFCF9] rounded-2xl max-w-md w-full border border-stone-300 shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50/80">
          <div className="flex items-center space-x-2.5">
            <div
              style={{ backgroundColor: primaryColor }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs font-bold text-sm"
            >
              <User className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-stone-900 text-lg">
                {currentUser ? '사용자 계정 관리' : '계정 로그인 / 회원가입'}
              </h3>
              <p className="text-[11px] text-stone-500">
                각 계정마다 일기, 플래너, 가계부 데이터베이스가 독립 보관됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Profile Banner (if logged in) */}
        {currentUser && (
          <div className="p-4 bg-amber-50/80 border-b border-amber-200/70 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                style={{ backgroundColor: currentUser.avatarColor || primaryColor }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-xs"
              >
                {isAdmin ? '👑' : currentUser.name ? currentUser.name.slice(0, 1) : currentUser.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-stone-900 text-sm">{currentUser.name}</span>
                  <span className="text-xs text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md font-mono">
                    @{currentUser.username}
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.2 rounded-md">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-600 mt-0.5">
                  현재 개인 데이터베이스 활성화 중
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {isAdmin && onOpenAdminModal && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAdminModal();
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors flex items-center space-x-1 shadow-2xs"
                  title="전체 사용자 계정 관리"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>회원 관리</span>
                </button>
              )}
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:text-red-700 bg-white hover:bg-red-50 border border-stone-300 rounded-lg transition-colors flex items-center space-x-1 shadow-2xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>로그아웃</span>
              </button>
            </div>
          </div>
        )}

        {/* Tabs (Only Login & Register, No other users exposed) */}
        <div className="flex border-b border-stone-200 text-xs font-bold bg-stone-100/60">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              tab === 'login'
                ? 'border-amber-700 text-amber-900 bg-white font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>로그인</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-3 text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
              tab === 'register'
                ? 'border-amber-700 text-amber-900 bg-white font-extrabold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>새 계정 가입 (새로운 빈 플래너)</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">아이디 (Username)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="아이디 입력"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">비밀번호 (Password)</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Admin login hint */}
              <div className="p-2.5 bg-stone-100/90 rounded-xl border border-stone-200 text-[11px] text-stone-600 flex items-center space-x-2">
                <Shield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  시스템 관리자 계정: 아이디 <strong>admin</strong> / 비밀번호 <strong>admin</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{ backgroundColor: primaryColor }}
                className="w-full py-2.5 text-white font-bold text-sm rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>로그인 중...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>로그인 & 내 데이터베이스 불러오기</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center text-xs text-stone-500">
                아직 계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={() => setTab('register')}
                  className="text-amber-800 font-bold hover:underline"
                >
                  회원가입 바로가기
                </button>
              </div>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">새 아이디 (Username)</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="영문/숫자 3자 이상"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">사용자 이름 / 닉네임</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 홍길동"
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">비밀번호 (Password)</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 설정"
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  />
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div className="p-3 bg-stone-100/80 rounded-xl border border-stone-200 text-[11px] text-stone-600 leading-relaxed">
                ✨ 가입 즉시 더미데이터 없이 <strong>완전히 깨끗한 개인 데이터베이스</strong>가 생성되며, 회원님만의 일정을 독립적으로 안전하게 저장할 수 있습니다.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                style={{ backgroundColor: primaryColor }}
                className="w-full py-2.5 text-white font-bold text-sm rounded-xl shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center space-x-1.5"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>새 계정 생성 중...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>회원가입 & 깨끗한 새 플래너 시작</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
