import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, action?: ToastItem['action']) => void;
}

const ToastContext = createContext<ToastApi>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext).show;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'success', action?: ToastItem['action']) => {
    const id = ++seq.current;
    setItems((prev) => {
      // Collapse identical consecutive messages (e.g. repeated sync errors).
      if (prev.some((t) => t.message === message)) return prev;
      return [...prev.slice(-2), { id, message, kind, action }];
    });
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 6000 : action ? 5000 : 2800);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 84px)' }}
        aria-live="polite"
      >
        {items.map((t) => {
          const Icon = t.kind === 'error' ? AlertTriangle : t.kind === 'info' ? Info : CheckCircle2;
          return (
            <div
              key={t.id}
              className="toast-in pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl bg-ink px-4 py-3 text-sm text-card shadow-lg"
              role={t.kind === 'error' ? 'alert' : 'status'}
            >
              <Icon className={`h-4 w-4 flex-none ${t.kind === 'error' ? 'text-red-300' : t.kind === 'info' ? 'text-sky-200' : 'text-emerald-300'}`} />
              <span className="leading-snug">{t.message}</span>
              {t.action && (
                <button
                  className="ml-1 flex-none rounded-lg px-2 py-1 text-xs font-semibold text-primary-light underline-offset-2 hover:underline"
                  onClick={() => {
                    t.action!.onClick();
                    setItems((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
