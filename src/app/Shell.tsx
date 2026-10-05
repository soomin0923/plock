import React from 'react';
import { BookHeart, CalendarDays, Cloud, CloudOff, Home, Loader2, Settings, TriangleAlert, Wallet, HardDrive } from 'lucide-react';
import { Logo } from '../components/Logo';
import { useData } from '../data/DataProvider';
import type { SyncState } from '../data/repo';
import { cx } from '../lib/util';
import { useRouter, type Tab } from './router';

const NAV: { id: Tab; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: 'today', label: '오늘', icon: Home },
  { id: 'planner', label: '플래너', icon: CalendarDays },
  { id: 'diary', label: '다이어리', icon: BookHeart },
  { id: 'ledger', label: '가계부', icon: Wallet },
  { id: 'settings', label: '설정', icon: Settings },
];

const SYNC_LABEL: Record<SyncState, string> = {
  local: '이 기기에만 저장',
  synced: '동기화됨',
  pending: '저장 중…',
  offline: '오프라인 · 기기에 보관 중',
  error: '동기화 오류',
};

export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const { sync, repoKind } = useData();
  const { go } = useRouter();
  if (!repoKind) return null;
  const s = sync.state;
  const Icon = s === 'local' ? HardDrive : s === 'pending' ? Loader2 : s === 'offline' ? CloudOff : s === 'error' ? TriangleAlert : Cloud;
  return (
    <button
      onClick={() => go('settings', { type: 'settings-section', section: s === 'local' ? 'account' : 'data' })}
      title={sync.detail || SYNC_LABEL[s]}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition hover:bg-hover',
        s === 'error' ? 'text-expense' : s === 'local' ? 'text-amber-700' : 'text-muted',
      )}
    >
      <Icon className={cx('h-3.5 w-3.5', s === 'pending' && 'animate-spin')} />
      {!compact && <span>{SYNC_LABEL[s]}</span>}
    </button>
  );
}

function Avatar({ size = 32 }: { size?: number }) {
  const { user } = useData();
  const letter = (user?.displayName || user?.email || '?').slice(0, 1).toUpperCase();
  if (user?.photoURL)
    return <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="flex-none rounded-full object-cover" style={{ width: size, height: size }} />;
  return (
    <span
      className={cx('flex flex-none items-center justify-center rounded-full text-sm font-bold', user ? 'bg-primary text-white' : 'bg-hover text-muted')}
      style={{ width: size, height: size }}
    >
      {user ? letter : '?'}
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const { tab, go } = useRouter();
  const { user } = useData();
  const current = NAV.find((n) => n.id === tab)!;

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 flex-none flex-col border-r border-line bg-card/60 px-3 py-5 lg:flex">
        <button className="mb-6 flex items-center gap-2.5 px-2" onClick={() => go('today')}>
          <Logo size={34} />
          <span className="text-xl font-extrabold tracking-tight">Plock</span>
        </button>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = n.id === tab;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition',
                  active ? 'bg-primary-soft text-primary' : 'text-ink-soft hover:bg-hover hover:text-ink',
                )}
              >
                <n.icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {n.label}
              </button>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-line pt-3">
          <SyncBadge />
          <button onClick={() => go('settings', { type: 'settings-section', section: 'account' })} className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-hover">
            <Avatar />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user ? user.displayName || '내 계정' : '게스트'}</span>
              <span className="block truncate text-xs text-muted">{user ? user.email : '로그인하면 동기화돼요'}</span>
            </span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="safe-top sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur-md lg:hidden">
          <div className="flex h-14 items-center gap-2 px-4">
            <Logo size={28} />
            <h1 className="flex-1 text-lg font-extrabold tracking-tight">{tab === 'today' ? 'Plock' : current.label}</h1>
            <SyncBadge compact />
            <button onClick={() => go('settings', { type: 'settings-section', section: 'account' })} aria-label="계정">
              <Avatar size={30} />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">{children}</main>

        {/* Mobile bottom tabs */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-lg">
            {NAV.map((n) => {
              const active = n.id === tab;
              return (
                <button
                  key={n.id}
                  onClick={() => go(n.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cx('flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] font-semibold', active ? 'text-primary' : 'text-muted')}
                >
                  <n.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                  {n.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 lg:mb-5">
      <div className="min-w-0">
        {/* On phones the top bar already shows the screen name */}
        <h2 className="hidden text-[28px] font-extrabold tracking-tight lg:block">{title}</h2>
        {subtitle && <p className="text-sm text-muted lg:mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
