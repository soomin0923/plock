import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Tab = 'today' | 'planner' | 'diary' | 'ledger' | 'settings';
export const TABS: Tab[] = ['today', 'planner', 'diary', 'ledger', 'settings'];

/** One-shot instruction for the destination screen (e.g. "open the diary editor for this date"). */
export type Intent =
  | { type: 'diary-write'; date: string }
  | { type: 'diary-open'; id: string }
  | { type: 'ledger-add'; date: string }
  | { type: 'planner-date'; date: string }
  | { type: 'planner-section'; section: 'calendar' | 'tasks' | 'habits' }
  | { type: 'settings-section'; section: 'account' | 'ai' | 'data' };

interface RouterApi {
  tab: Tab;
  go: (tab: Tab, intent?: Intent) => void;
  intent: Intent | null;
  consumeIntent: () => Intent | null;
}

const RouterContext = createContext<RouterApi | null>(null);

function tabFromHash(): Tab {
  const h = window.location.hash.replace(/^#\/?/, '').split('/')[0];
  return (TABS as string[]).includes(h) ? (h as Tab) : 'today';
}

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const [intent, setIntent] = useState<Intent | null>(null);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((next: Tab, nextIntent?: Intent) => {
    setIntent(nextIntent || null);
    if (`#/${next}` !== window.location.hash) window.location.hash = `/${next}`;
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const consumeIntent = useCallback(() => {
    const i = intent;
    if (i) setIntent(null);
    return i;
  }, [intent]);

  return <RouterContext.Provider value={{ tab, go, intent, consumeIntent }}>{children}</RouterContext.Provider>;
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter outside RouterProvider');
  return ctx;
}

/** Run `handler` once for an intent addressed to the current screen. */
export function useIntent(handler: (i: Intent) => void) {
  const { intent, consumeIntent } = useRouter();
  useEffect(() => {
    if (!intent) return;
    const i = consumeIntent();
    if (i) handler(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);
}
