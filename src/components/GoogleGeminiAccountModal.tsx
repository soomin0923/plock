import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Key,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Clipboard,
  Trash2,
  Cpu,
  Mail,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { UserAccount } from '../types';
import {
  getStoredUserGeminiConfig,
  saveStoredUserGeminiConfig,
  testGeminiApiKeyOnServer,
  UserGeminiConfig,
} from '../lib/geminiAuthService';
import { googleSignIn, signOutUser } from '../lib/firebaseAuth';

interface GoogleGeminiAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  primaryColor?: string;
  showToast: (msg: string) => void;
  onConfigUpdated?: (config: UserGeminiConfig) => void;
}

export const GoogleGeminiAccountModal: React.FC<GoogleGeminiAccountModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  primaryColor = '#C1876B',
  showToast,
  onConfigUpdated,
}) => {
  const userId = currentUser?.id || 'usr_guest';
  const [config, setConfig] = useState<UserGeminiConfig>(() => getStoredUserGeminiConfig(userId));
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    model?: string;
    sampleResponse?: string;
  } | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState<boolean>(false);

  // Sync state whenever modal opens or user changes
  useEffect(() => {
    if (isOpen) {
      const currentConf = getStoredUserGeminiConfig(userId);
      setConfig(currentConf);
      setApiKeyInput(currentConf.geminiApiKey || '');
      setTestResult(null);
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSaveConfig = (newConfPartial: Partial<UserGeminiConfig>) => {
    const updated = saveStoredUserGeminiConfig(userId, newConfPartial);
    setConfig(updated);
    if (onConfigUpdated) onConfigUpdated(updated);
  };

  const handleTestAndSaveKey = async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) {
      showToast('⚠️ Google Gemini API 키를 입력해주세요.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testGeminiApiKeyOnServer(trimmed, userId);
      setTestResult(res);
      if (res.success) {
        handleSaveConfig({
          geminiApiKey: trimmed,
          useCustomGeminiKey: true,
          isVerified: true,
          lastTestedAt: new Date().toISOString(),
        });
        showToast('✨ 구글 계정의 Gemini API 키가 성공적으로 검증 및 저장되었습니다!');
      } else {
        showToast(`❌ ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'API 키 테스트 중 오류가 발생했습니다.',
      });
      showToast('API 키 테스트 중 네트워크 오류가 발생했습니다.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleClearKey = () => {
    if (window.confirm('저장된 Google Gemini API 키를 삭제하고 시스템 기본 모드로 되돌리시겠습니까?')) {
      setApiKeyInput('');
      handleSaveConfig({
        geminiApiKey: '',
        isVerified: false,
        useCustomGeminiKey: false,
        lastTestedAt: undefined,
      });
      setTestResult(null);
      showToast('Google Gemini API 키가 삭제되었습니다.');
    }
  };

  const handlePasteKey = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setApiKeyInput(text.trim());
        showToast('클립보드에서 API 키를 붙여넣었습니다.');
      }
    } catch (err) {
      showToast('클립보드 읽기 권한이 필요합니다. 직접 붙여넣어주세요.');
    }
  };

  const handleGoogleConnect = async () => {
    setIsLoggingInGoogle(true);
    try {
      const res = await googleSignIn();
      if (res?.user) {
        const u = res.user;
        const newGoogleConf: Partial<UserGeminiConfig> = {
          googleEmail: u.email || undefined,
          googleDisplayName: u.displayName || undefined,
          googlePhotoUrl: u.photoURL || undefined,
          googleUid: u.uid || undefined,
        };
        handleSaveConfig(newGoogleConf);
        showToast(`🎉 구글 계정(${u.email})이 성공적으로 연동되었습니다!`);
      }
    } catch (err: any) {
      showToast(err.message || '구글 로그인 중 오류가 발생했습니다.');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (window.confirm('연동된 구글 계정을 해제하시겠습니까?')) {
      await signOutUser();
      handleSaveConfig({
        googleEmail: undefined,
        googleDisplayName: undefined,
        googlePhotoUrl: undefined,
        googleUid: undefined,
      });
      showToast('구글 계정 연동이 해제되었습니다.');
    }
  };

  const hasValidCustomKey = Boolean(config.geminiApiKey && config.geminiApiKey.trim() && config.useCustomGeminiKey !== false);

  return (
    <div
      id="google-gemini-account-modal-backdrop"
      className="fixed inset-0 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
    >
      <div
        id="google-gemini-account-modal"
        className="bg-[#FDFCF9] rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-200 pb-4">
          <div className="flex items-center space-x-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-md flex-none"
              style={{ backgroundColor: primaryColor }}
            >
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  Google Gemini 3.7
                </span>
                <span className="text-[11px] font-mono text-stone-500">USER-ACCOUNT AI SYNC</span>
              </div>
              <h2 className="text-xl font-serif font-bold text-stone-900 mt-0.5">
                구글 계정 & Gemini API 연동
              </h2>
            </div>
          </div>
          <button
            id="close-gemini-modal-btn"
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Mode Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-start space-x-3 transition-colors ${
            hasValidCustomKey
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
              : 'bg-amber-50/70 border-amber-200 text-amber-950'
          }`}
        >
          {hasValidCustomKey ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 flex-none mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-600 flex-none mt-0.5" />
          )}
          <div className="text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-sm">
              {hasValidCustomKey ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>내 구글 계정 전용 Gemini API 연동 활성화</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>시스템 기본 공유 키 모드 (개인 API 키 미등록)</span>
                </>
              )}
            </div>
            <p className="leading-relaxed opacity-90">
              {hasValidCustomKey
                ? `자연어 일정 등록 및 데일리 AI 라이프 코칭 분석 시, 사용자 본인의 구글 Gemini API를 직접 사용합니다.`
                : '개인 구글 계정의 Gemini API 키를 등록하면 전용 할당량과 맞춤형 응답을 무료로 이용하실 수 있습니다.'}
            </p>
          </div>
        </div>

        {/* Section 1: Google OAuth Account Connection */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4 text-blue-600" />
              <h3 className="font-bold text-stone-800 text-sm">1. 구글 계정 (Google Account)</h3>
            </div>
            {config.googleEmail && (
              <span className="text-[11px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
                연결됨
              </span>
            )}
          </div>

          {config.googleEmail ? (
            <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="flex items-center space-x-3">
                {config.googlePhotoUrl ? (
                  <img
                    src={config.googlePhotoUrl}
                    alt="Google Profile"
                    className="w-10 h-10 rounded-full object-cover border border-stone-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                    {config.googleEmail.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-bold text-xs text-stone-800">
                    {config.googleDisplayName || '구글 사용자'}
                  </div>
                  <div className="text-[11px] text-stone-500 font-mono">{config.googleEmail}</div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  id="reconnect-google-btn"
                  onClick={handleGoogleConnect}
                  disabled={isLoggingInGoogle}
                  className="px-3 py-1.5 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold transition-colors"
                >
                  계정 변경
                </button>
                <button
                  id="disconnect-google-btn"
                  onClick={handleGoogleDisconnect}
                  className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                >
                  연결 해제
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-dashed border-stone-300">
              <div className="text-xs text-stone-600">
                구글 계정으로 로그인하여 캘린더 동기화 및 전용 계정을 연동하세요.
              </div>
              <button
                id="connect-google-btn"
                onClick={handleGoogleConnect}
                disabled={isLoggingInGoogle}
                className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-2xs transition-all active:scale-95 flex-none"
              >
                <img
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                  alt="Google"
                  className="w-4 h-4"
                />
                <span>{isLoggingInGoogle ? '연결 중...' : '구글 계정 연결'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Section 2: Google Gemini API Key Configuration */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-stone-800 text-sm">2. 개인 Google Gemini API 키 설정</h3>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 hover:underline"
            >
              <span>무료 API 키 발급받기</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200/80 space-y-1">
            <div className="font-bold text-stone-700 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>간단한 3단계 발급 방법:</span>
            </div>
            <ol className="list-decimal list-inside text-[11px] space-y-0.5 text-stone-600 pl-1">
              <li>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 font-bold hover:underline"
                >
                  Google AI Studio (aistudio.google.com)
                </a>
                에 로그인합니다.
              </li>
              <li>
                <strong>[Create API key]</strong> 버튼을 눌러 새 키를 생성하고 복사(Copy)합니다. (비용 무료)
              </li>
              <li>아래 입력창에 붙여넣고 <strong>[저장 및 연결 테스트]</strong>를 누르면 즉시 적용됩니다.</li>
            </ol>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
              <span>Google Gemini API Key (AIzaSy...)</span>
              {config.lastTestedAt && (
                <span className="text-[10px] text-stone-400 font-mono">
                  최근 검증: {new Date(config.lastTestedAt).toLocaleDateString()}
                </span>
              )}
            </label>

            <div className="relative flex items-center">
              <input
                id="gemini-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full pl-3 pr-24 py-2.5 border border-stone-300 rounded-xl bg-stone-50/50 text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all"
              />
              <div className="absolute right-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
                  title={showKey ? '키 숨기기' : '키 보기'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handlePasteKey}
                  className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
                  title="클립보드에서 붙여넣기"
                >
                  <Clipboard className="w-3.5 h-3.5" />
                </button>
                {apiKeyInput && (
                  <button
                    type="button"
                    onClick={handleClearKey}
                    className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="키 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Toggle Priority */}
          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-xl border border-stone-200">
            <div className="space-y-0.5">
              <div className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-stone-600" />
                <span>내 구글 계정 API 키 우선 사용</span>
              </div>
              <div className="text-[11px] text-stone-500">
                자연어 등록 및 AI 라이프 코칭 시 이 키를 우선 호출합니다.
              </div>
            </div>
            <button
              id="toggle-custom-gemini-key-btn"
              onClick={() => {
                const nextVal = !config.useCustomGeminiKey;
                handleSaveConfig({ useCustomGeminiKey: nextVal });
                showToast(nextVal ? '내 구글 Gemini 키 사용이 켜졌습니다.' : '시스템 기본 모드로 변경되었습니다.');
              }}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                config.useCustomGeminiKey !== false && apiKeyInput
                  ? 'bg-amber-600 justify-end'
                  : 'bg-stone-300 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md transition-transform" />
            </button>
          </div>

          {/* Test Connection Button & Result */}
          <div className="space-y-2">
            <button
              id="test-gemini-key-btn"
              onClick={handleTestAndSaveKey}
              disabled={isTesting || !apiKeyInput.trim()}
              className="w-full py-2.5 px-4 bg-[#1A1A1A] hover:bg-[#1A1A1A]/85 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md transition-all active:scale-[0.99]"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Google Gemini API 인증 및 테스트 진행 중...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>저장 및 연결 테스트 (gemini-3.7-flash)</span>
                </>
              )}
            </button>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1 animate-fade-in ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.sampleResponse && (
                  <p className="text-[11px] font-mono text-emerald-800 bg-white/70 p-2 rounded-lg border border-emerald-200 mt-1">
                    응답 예시: &ldquo;{testResult.sampleResponse}&rdquo;
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-stone-500 font-mono">
            {hasValidCustomKey ? '🟢 USER-CUSTOM API ACTIVE' : '⚪ SYSTEM DEFAULT API'}
          </span>
          <button
            id="close-gemini-modal-footer-btn"
            onClick={onClose}
            className="px-5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold rounded-xl transition-colors"
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
