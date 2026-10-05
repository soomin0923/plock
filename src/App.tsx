import React, { useEffect, useState } from 'react';
import { ConfirmProvider, Button, Sheet, Spinner, useConfirm } from './components/ui';
import { ToastProvider, useToast } from './components/Toast';
import { DataProvider, useData } from './data/DataProvider';
import { RouterProvider, useRouter } from './app/router';
import { Shell } from './app/Shell';
import { Logo } from './components/Logo';
import { AuthSheet } from './features/auth/AuthSheet';
import { TodayView } from './features/today/TodayView';
import { PlannerView } from './features/planner/PlannerView';
import { DiaryView } from './features/diary/DiaryView';
import { LedgerView } from './features/ledger/LedgerView';
import { DumpView } from './features/dump/DumpView';
import { MusicProvider } from './features/music/MusicProvider';
import { MusicSheet } from './features/music/MusicWidgets';
import { SettingsView } from './features/settings/SettingsView';
import { useDeviceSettings } from './lib/deviceSettings';
import { hexToRgba } from './lib/util';
import { useReminders } from './lib/reminders';
import { AuthSheetContext } from './app/authSheet';


function ThemeSync() {
  const { themeColor } = useDeviceSettings();
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--app-primary', themeColor);
    root.setProperty('--app-primary-soft', hexToRgba(themeColor, 0.12));
    root.setProperty('--app-primary-light', hexToRgba(themeColor, 0.45));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f8f5f0');
  }, [themeColor]);
  return null;
}

function Splash({ message }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-muted">
      <Logo size={48} />
      {message ? <p className="max-w-xs text-center text-sm">{message}</p> : <Spinner className="text-primary" />}
    </div>
  );
}

function GuestMigrationPrompt() {
  const { guestMigration, migrateGuestData, discardGuestData, dismissGuestMigration } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <Sheet open={guestMigration !== null} onClose={() => !busy && dismissGuestMigration()} title="이 기기의 기록을 옮길까요?" size="sm">
      <p className="text-[15px] leading-relaxed text-ink-soft">
        로그인 전에 이 브라우저에 저장한 기록이 <b>{guestMigration}건</b> 있어요. 지금 계정으로 옮기면 다른 기기에서도 볼 수 있어요.
      </p>
      {busy && <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Spinner /> {busy}</p>}
      <div className="mt-5 grid gap-2">
        <Button
          variant="primary"
          size="lg"
          disabled={!!busy}
          onClick={async () => {
            setBusy('옮기는 중…');
            try {
              await migrateGuestData((m) => setBusy(m));
              toast('기록을 계정으로 옮겼어요.');
            } catch (e) {
              toast((e as Error).message || '옮기지 못했어요.', 'error');
            } finally {
              setBusy(null);
            }
          }}
        >
          계정으로 옮기기
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={!!busy} onClick={dismissGuestMigration}>
            나중에
          </Button>
          <Button
            disabled={!!busy}
            variant="ghost"
            className="text-expense"
            onClick={async () => {
              if (!(await confirm({ title: '게스트 기록을 삭제할까요?', message: '이 브라우저에만 있던 기록이 삭제되며 되돌릴 수 없어요.', confirmLabel: '삭제', danger: true }))) return;
              await discardGuestData();
              toast('게스트 기록을 삭제했어요.');
            }}
          >
            게스트 기록 삭제
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Screens() {
  const { tab } = useRouter();
  const { fatalError, authReady, loaded } = useData();
  useReminders();
  if (fatalError) return <Splash message={fatalError} />;
  if (!authReady || !loaded) return <Splash />;
  return (
    <MusicProvider>
      <Shell>
        {tab === 'today' && <TodayView />}
        {tab === 'planner' && <PlannerView />}
        {tab === 'dump' && <DumpView />}
        {tab === 'diary' && <DiaryView />}
        {tab === 'ledger' && <LedgerView />}
        {tab === 'settings' && <SettingsView />}
        <GuestMigrationPrompt />
        <MusicSheet />
      </Shell>
    </MusicProvider>
  );
}

export default function App() {
  const [authOpen, setAuthOpen] = useState(false);
  return (
    <ToastProvider>
      <ConfirmProvider>
        <RouterProvider>
          <DataProvider>
            <AuthSheetContext.Provider value={() => setAuthOpen(true)}>
              <ThemeSync />
              <Screens />
              <AuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
            </AuthSheetContext.Provider>
          </DataProvider>
        </RouterProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
