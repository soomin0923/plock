import React, { useEffect, useRef, useState } from 'react';
import { Bell, Bot, Database, Download, ExternalLink, Eye, EyeOff, HardDrive, LogOut, Palette, Smartphone, Trash2, Upload, User, History } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { useIntent } from '../../app/router';
import { useOpenAuth } from '../../app/authSheet';
import { PageHeader } from '../../app/Shell';
import { Button, Card, Field, Segmented, Select, Spinner, TextInput, Toggle, useConfirm } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { setDeviceSettings, useDeviceSettings } from '../../lib/deviceSettings';
import { pickDefaultModel, testGeminiKey, type GeminiModel } from '../../lib/gemini';
import { requestNotificationPermission } from '../../lib/reminders';
import { THEME_COLORS } from '../../data/defaults';
import { convertLegacy, countRecords, findLegacySources, legacyImportedKeys, markLegacyImported, parseBackup, type LegacySource } from '../../data/bundle';
import { cx, downloadBlob, readFileAsText } from '../../lib/util';
import { today } from '../../lib/date';
import { authErrorMessage } from '../../lib/auth';
import { SqlSettingsSection } from '../sql/SqlSettingsSection';

function Section({ id, icon, title, children, description }: { id: string; icon: React.ReactNode; title: string; description?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card id={`settings-${id}`} className="scroll-mt-20 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary-soft text-primary">{icon}</span>
        <div>
          <h3 className="font-bold tracking-tight">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

export function SettingsView() {
  useIntent((i) => {
    if (i.type === 'settings-section') setTimeout(() => document.getElementById(`settings-${i.section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  });
  return (
    <div>
      <PageHeader title="설정" />
      <div className="grid items-start gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4">
          <AccountSection />
          <AiSection />
          <AppearanceSection />
        </div>
        <div className="space-y-4">
          <DataSection />
          <SqlSettingsSection />
          <ReminderSection />
          <InstallSection />
          <p className="px-1 text-center text-[12px] text-faint">Plock 2.0 · 플래너 · 다이어리 · 가계부</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ account

function AccountSection() {
  const { user, sync, signOut, deleteAccount } = useData();
  const openAuth = useOpenAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Section
      id="account"
      icon={<User className="h-5 w-5" />}
      title="계정"
      description={user ? '기록은 계정(클라우드)과 이 기기에 함께 저장돼요. 오프라인에서도 쓸 수 있고, 연결되면 자동으로 동기화돼요.' : '로그인하지 않으면 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 기록도 사라지니 로그인하거나 백업을 받아 두세요.'}
    >
      {user ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-hover/60 p-3">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-11 w-11 rounded-full" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">{(user.displayName || user.email || '?').slice(0, 1).toUpperCase()}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{user.displayName || '내 계정'}</p>
              <p className="truncate text-[13px] text-muted">{user.email}</p>
            </div>
            <span className={cx('rounded-full px-2.5 py-1 text-[12px] font-semibold', sync.state === 'error' ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income')}>
              {sync.state === 'synced' ? '동기화됨' : sync.state === 'pending' ? '저장 중' : sync.state === 'offline' ? '오프라인' : sync.state === 'error' ? '오류' : ''}
            </span>
          </div>
          {sync.state === 'error' && sync.detail && <p className="rounded-xl bg-expense/10 px-3 py-2 text-[13px] text-expense">{sync.detail}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<LogOut className="h-4 w-4" />}
              disabled={busy}
              onClick={async () => {
                if (sync.state === 'pending' || sync.state === 'offline') {
                  const ok = await confirm({ title: '아직 업로드되지 않은 기록이 있어요', message: '지금 로그아웃하면 이 기기에서 업로드 중인 변경사항이 사라질 수 있어요. 온라인 상태에서 잠시 기다린 뒤 로그아웃하는 걸 권장해요.', confirmLabel: '그래도 로그아웃', danger: true });
                  if (!ok) return;
                }
                setBusy(true);
                await signOut();
                setBusy(false);
              }}
            >
              로그아웃
            </Button>
            <Button
              variant="ghost"
              className="text-expense"
              disabled={busy}
              onClick={async () => {
                const ok = await confirm({ title: '계정을 삭제할까요?', message: '계정과 모든 일정·일기·가계부·사진이 영구 삭제되며 되돌릴 수 없어요. 먼저 백업을 받아 두세요.', confirmLabel: '영구 삭제', danger: true });
                if (!ok) return;
                setBusy(true);
                try {
                  await deleteAccount();
                } catch (e) {
                  toast(authErrorMessage(e), 'error');
                  setBusy(false);
                }
              }}
            >
              계정 삭제
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={openAuth}>
          로그인 / 회원가입
        </Button>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ AI

function AiSection() {
  const s = useDeviceSettings();
  const toast = useToast();
  const [key, setKey] = useState(s.geminiKey);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const test = async () => {
    setBusy(true);
    setStatus(null);
    try {
      setDeviceSettings({ geminiKey: key.trim() });
      const { model, models: available } = await testGeminiKey(key);
      setModels(available);
      setStatus({ ok: true, msg: `연결 성공! 사용 모델: ${model}` });
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      id="ai"
      icon={<Bot className="h-5 w-5" />}
      title="AI 도우미 (Gemini)"
      description={
        <>
          내 Gemini API 키를 넣으면 “내일 3시 회의”, “점심 9000원” 같은 문장 정리와 영수증 읽기를 AI가 해요. 키는 <b>이 기기에만</b> 저장되고, Plock 서버를 거치지 않고 Google로 바로 전송돼요. 키가 없어도 기본 분석기로 동작해요.
        </>
      }
    >
      <div className="space-y-3">
        <Field label="API 키">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <TextInput type={show ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" autoComplete="off" spellCheck={false} className="pr-10 font-mono text-sm" />
              <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted" aria-label={show ? '키 숨기기' : '키 보기'}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button variant="primary" onClick={test} disabled={!key.trim() || busy}>
              {busy ? <Spinner /> : '저장·테스트'}
            </Button>
          </div>
        </Field>
        {status && <p className={cx('rounded-xl px-3 py-2 text-[13px]', status.ok ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense')}>{status.msg}</p>}
        <Field label="모델" hint="자동으로 두면 키로 쓸 수 있는 최신 Flash 모델을 골라요.">
          <Select value={s.geminiModel} onChange={(e) => setDeviceSettings({ geminiModel: e.target.value })}>
            <option value="">자동{models.length ? ` (${pickDefaultModel(models)})` : ''}</option>
            {s.geminiModel && !models.some((m) => m.id === s.geminiModel) && <option value={s.geminiModel}>{s.geminiModel}</option>}
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.id})
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary">
            무료 API 키 발급받기 <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {s.geminiKey && (
            <button
              className="font-semibold text-muted hover:text-expense"
              onClick={() => {
                setDeviceSettings({ geminiKey: '', geminiModel: '' });
                setKey('');
                setModels([]);
                setStatus(null);
                toast('이 기기에서 API 키를 지웠어요.');
              }}
            >
              키 지우기
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ appearance

function AppearanceSection() {
  const { themeColor } = useDeviceSettings();
  const { prefs, savePrefs } = useData();
  return (
    <Section id="look" icon={<Palette className="h-5 w-5" />} title="화면">
      <Field label="테마 색">
        <div className="flex flex-wrap gap-3">
          {THEME_COLORS.map((t) => (
            <button key={t.color} onClick={() => setDeviceSettings({ themeColor: t.color })} className="flex flex-col items-center gap-1 text-[12px] font-medium text-ink-soft">
              <span className={cx('h-9 w-9 rounded-full transition', themeColor === t.color && 'ring-2 ring-ink ring-offset-2')} style={{ background: t.color }} />
              {t.name}
            </button>
          ))}
        </div>
      </Field>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium">한 주의 시작</span>
        <Segmented<'0' | '1'>
          size="sm"
          value={String(prefs.weekStartsOn) as '0' | '1'}
          onChange={(v) => savePrefs({ weekStartsOn: v === '1' ? 1 : 0 })}
          options={[
            { value: '0', label: '일요일' },
            { value: '1', label: '월요일' },
          ]}
        />
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ reminders

function ReminderSection() {
  const s = useDeviceSettings();
  const toast = useToast();
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [perm, setPerm] = useState<string>(supported ? Notification.permission : 'unsupported');
  return (
    <Section id="reminders" icon={<Bell className="h-5 w-5" />} title="알림" description="시간이 정해진 일정·할 일을 미리 알려 드려요. Plock이 열려 있을 때(설치한 앱 포함) 동작해요.">
      {!supported ? (
        <p className="text-sm text-muted">이 브라우저는 알림을 지원하지 않아요.</p>
      ) : (
        <div className="space-y-3">
          <Toggle
            checked={s.remindersEnabled && perm === 'granted'}
            onChange={async (on) => {
              if (on) {
                const p = await requestNotificationPermission();
                setPerm(p);
                if (p !== 'granted') return toast('브라우저 설정에서 알림을 허용해 주세요.', 'info');
              }
              setDeviceSettings({ remindersEnabled: on });
            }}
            label="일정 알림"
            description={perm === 'denied' ? '알림이 차단되어 있어요. 브라우저 사이트 설정에서 허용해 주세요.' : undefined}
          />
          {s.remindersEnabled && perm === 'granted' && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">미리 알림</span>
              <Select value={String(s.reminderLead)} onChange={(e) => setDeviceSettings({ reminderLead: Number(e.target.value) })} className="w-32">
                {[0, 5, 10, 15, 30, 60].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? '정각' : `${m}분 전`}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ install (PWA)

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
let deferredPrompt: BeforeInstallPromptEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

function InstallSection() {
  const [, force] = useState(0);
  const standalone = typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (standalone) return null;
  return (
    <Section id="install" icon={<Smartphone className="h-5 w-5" />} title="앱으로 설치" description="홈 화면에 추가하면 앱처럼 전체 화면으로 열리고, 오프라인에서도 열려요.">
      {deferredPrompt ? (
        <Button
          variant="primary"
          onClick={async () => {
            await deferredPrompt?.prompt();
            deferredPrompt = null;
            force((n) => n + 1);
          }}
        >
          설치하기
        </Button>
      ) : ios ? (
        <p className="text-sm text-ink-soft">Safari 하단의 공유 버튼 → <b>홈 화면에 추가</b>를 눌러 주세요.</p>
      ) : (
        <p className="text-sm text-ink-soft">Chrome·Edge 주소창 오른쪽의 설치 아이콘, 또는 메뉴 → <b>앱 설치 / 홈 화면에 추가</b>를 눌러 주세요.</p>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ data

function DataSection() {
  const { data, user, repoKind, exportBackup, importBundle, deleteAllData, cleanupImages, storageBytes } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [legacy, setLegacy] = useState<LegacySource[]>([]);
  const [legacyDone, setLegacyDone] = useState<string[]>(legacyImportedKeys());

  useEffect(() => {
    storageBytes().then(setBytes);
    setLegacy(findLegacySources());
  }, [storageBytes, data.diaries.length, data.stickers.length]);

  const counts = [
    ['일정', data.events.length],
    ['할 일', data.tasks.length],
    ['습관', data.habits.length],
    ['일기', data.diaries.length],
    ['가계부', data.ledger.length],
    ['스티커', data.stickers.length],
  ] as const;

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message || '실패했어요.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const doExport = () =>
    run('백업 파일 만드는 중…', async () => {
      const blob = await exportBackup((d, t) => setBusy(`사진 모으는 중 ${d}/${t}`));
      downloadBlob(blob, `plock_backup_${today()}.json`);
      toast('백업 파일을 내려받았어요.');
    });

  const doImport = (file?: File) =>
    file &&
    run('백업 읽는 중…', async () => {
      const bundle = await parseBackup(JSON.parse(await readFileAsText(file)), (m) => setBusy(m));
      const n = countRecords(bundle.records);
      const ok = await confirm({ title: `${n}개 기록을 가져올까요?`, message: '같은 기록이 이미 있으면 백업 내용으로 덮어쓰고, 나머지는 그대로 둬요.', confirmLabel: '가져오기' });
      if (!ok) return;
      await importBundle(bundle, (m) => setBusy(m));
      toast(`${n}개 기록을 가져왔어요.`);
    });

  const doLegacy = (src: LegacySource) =>
    run('이전 데이터 변환 중…', async () => {
      const bundle = await convertLegacy(src.data, (m) => setBusy(m));
      const n = await importBundle(bundle, (m) => setBusy(m));
      markLegacyImported(src.key);
      setLegacyDone(legacyImportedKeys());
      toast(`이전 버전 기록 ${n}개를 가져왔어요.`);
    });

  return (
    <Section
      id="data"
      icon={<Database className="h-5 w-5" />}
      title="데이터"
      description={repoKind === 'cloud' ? `${user?.email} 계정에 저장 중` : '이 브라우저(IndexedDB)에 저장 중'}
    >
      <div className="mb-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
        {counts.map(([label, n]) => (
          <div key={label} className="rounded-xl bg-hover/60 px-1 py-2">
            <p className="text-lg font-bold tabular">{n}</p>
            <p className="text-[11px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      {bytes !== null && (
        <p className="mb-4 flex items-center gap-1.5 text-[13px] text-muted">
          <HardDrive className="h-3.5 w-3.5" /> {repoKind === 'cloud' ? '사진·스티커 용량' : '사용 중인 저장 공간'} {(bytes / 1024 / 1024).toFixed(1)}MB
        </p>
      )}

      {busy && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-hover px-3 py-2 text-sm text-ink-soft">
          <Spinner /> {busy}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button disabled={!!busy} icon={<Download className="h-4 w-4" />} onClick={doExport}>
          백업 받기
        </Button>
        <Button disabled={!!busy} icon={<Upload className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
          백업 불러오기
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => (doImport(e.target.files?.[0]), (e.target.value = ''))} />
      <p className="mt-2 text-[12px] text-muted">백업 파일(.json)에는 사진까지 모두 들어 있어요. 이전 버전 Plock에서 받은 백업도 불러올 수 있어요.</p>

      {legacy.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <History className="h-4 w-4 text-amber-600" /> 이 브라우저에 이전 버전 기록이 남아 있어요
          </p>
          <div className="space-y-1.5">
            {legacy.map((src) => (
              <div key={src.key} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {src.label} · {src.total}개
                </span>
                {legacyDone.includes(src.key) ? (
                  <span className="text-[13px] text-muted">가져옴</span>
                ) : (
                  <Button size="sm" variant="primary" disabled={!!busy} onClick={() => doLegacy(src)}>
                    가져오기
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-3 text-[13px]">
        <button
          disabled={!!busy}
          className="font-semibold text-muted hover:text-ink"
          onClick={() =>
            run('정리 중…', async () => {
              const n = await cleanupImages();
              setBytes(await storageBytes());
              toast(n ? `쓰지 않는 이미지 ${n}개를 정리했어요.` : '정리할 이미지가 없어요.');
            })
          }
        >
          안 쓰는 이미지 정리
        </button>
        <button
          disabled={!!busy}
          className="inline-flex items-center gap-1 font-semibold text-expense"
          onClick={async () => {
            const ok = await confirm({ title: '모든 기록을 삭제할까요?', message: `${repoKind === 'cloud' ? '계정에 저장된' : '이 브라우저에 저장된'} 일정·할 일·습관·일기·가계부·스티커가 모두 삭제돼요. 되돌릴 수 없어요.`, confirmLabel: '모두 삭제', danger: true });
            if (ok) run('삭제 중…', async () => {
              await deleteAllData();
              toast('모든 기록을 삭제했어요.');
            });
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> 모든 기록 삭제
        </button>
      </div>
    </Section>
  );
}
