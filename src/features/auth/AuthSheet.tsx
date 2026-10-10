import React, { useState } from 'react';
import { Button, Field, Sheet, Spinner, TextInput } from '../../components/ui';
import { authErrorMessage, resetPassword, signInEmail, signInGoogle, signUpEmail } from '../../lib/auth';
import { useToast } from '../../components/Toast';

type Mode = 'login' | 'signup' | 'reset';

export function AuthSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (success) toast(success);
      if (mode !== 'reset') onClose();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') run(() => signInEmail(email, password), '로그인했어요.');
    else if (mode === 'signup') {
      if (password.length < 6) return setError('비밀번호는 6자 이상이어야 합니다.');
      run(() => signUpEmail(email, password, name), '가입을 환영해요!');
    } else
      run(async () => {
        await resetPassword(email);
        toast('비밀번호 재설정 메일을 보냈어요. 메일함을 확인해 주세요.');
        setMode('login');
      });
  };

  const title = mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '비밀번호 재설정';

  return (
    <Sheet open={open} onClose={onClose} title={title} size="sm">
      <p className="mb-4 text-sm leading-relaxed text-muted">
        {mode === 'reset'
          ? '가입한 이메일로 재설정 링크를 보내드려요.'
          : '로그인하면 기록이 계정에 안전하게 저장되고, 휴대폰과 PC에서 함께 볼 수 있어요.'}
      </p>

      {mode !== 'reset' && (
        <>
          <Button
            className="w-full"
            size="lg"
            disabled={busy}
            onClick={() => run(signInGoogle, '로그인했어요.')}
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.6 10.6 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
            }
          >
            Google로 계속하기
          </Button>
          <div className="my-4 flex items-center gap-3 text-xs text-faint">
            <div className="h-px flex-1 bg-line" />
            또는 이메일
            <div className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form onSubmit={submit} className="space-y-3">
        {mode === 'signup' && (
          <Field label="이름 (선택)">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="name" />
          </Field>
        )}
        <Field label="이메일">
          <TextInput type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" />
        </Field>
        {mode !== 'reset' && (
          <Field label="비밀번호" hint={mode === 'signup' ? '6자 이상' : undefined}>
            <TextInput
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </Field>
        )}
        {error && <p className="rounded-xl bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? <Spinner /> : mode === 'login' ? '로그인' : mode === 'signup' ? '가입하기' : '재설정 메일 보내기'}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        {mode !== 'login' && (
          <button className="font-semibold text-primary" onClick={() => (setMode('login'), setError(null))}>
            로그인으로
          </button>
        )}
        {mode !== 'signup' && (
          <button className="font-semibold text-primary" onClick={() => (setMode('signup'), setError(null))}>
            이메일로 가입
          </button>
        )}
        {mode === 'login' && (
          <button className="text-muted" onClick={() => (setMode('reset'), setError(null))}>
            비밀번호를 잊었어요
          </button>
        )}
      </div>
    </Sheet>
  );
}
