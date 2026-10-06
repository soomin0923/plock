import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/util';

// ------------------------------------------------------------------ back-button handling
// On phones the hardware/gesture "back" should close the top-most sheet instead of leaving the app.

const overlayStack: { id: number; close: () => void }[] = [];
let ignorePops = 0;
let overlaySeq = 0;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const afterPops: (() => void)[] = [];

function flushAfterPops() {
  clearTimeout(settleTimer);
  afterPops.splice(0).forEach((fn) => fn());
}

/** history.back() is asynchronous: wait until our own back-navigations have landed before pushing. */
function whenHistorySettled(fn: () => void) {
  if (ignorePops === 0) fn();
  else afterPops.push(fn);
}

function goBackSilently() {
  ignorePops++;
  history.back();
  clearTimeout(settleTimer);
  // Safety net in case a popstate never arrives (e.g. no previous entry).
  settleTimer = setTimeout(() => {
    ignorePops = 0;
    flushAfterPops();
  }, 800);
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePops > 0) {
      ignorePops--;
      if (ignorePops === 0) flushAfterPops();
      return;
    }
    const top = overlayStack.pop();
    top?.close();
  });
}

/**
 * Close an overlay with the browser/phone back button.
 * `onClose` may return false (or a Promise resolving to false) to stay open, e.g. after
 * an "unsaved changes" prompt is cancelled.
 */
export function useBackToClose(open: boolean, onClose: () => void | boolean | Promise<boolean>) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const id = ++overlaySeq;
    let armed = false;
    let active = true;
    const onBack = () => {
      armed = false;
      const handle = (result: boolean | void) => {
        if (result === false && active) arm();
      };
      const r = closeRef.current();
      if (r instanceof Promise) r.then(handle);
      else handle(r);
    };
    const arm = () =>
      whenHistorySettled(() => {
        if (!active || armed) return;
        history.pushState({ ...(history.state || {}), plockOverlay: id }, '');
        overlayStack.push({ id, close: onBack });
        armed = true;
      });
    // Deferred so React StrictMode's mount→unmount→mount in development doesn't push twice.
    const timer = setTimeout(arm, 0);
    return () => {
      active = false;
      clearTimeout(timer);
      const idx = overlayStack.findIndex((o) => o.id === id);
      if (idx !== -1) overlayStack.splice(idx, 1);
      if (armed) goBackSilently();
    };
  }, [open]);
}

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);
}

// ------------------------------------------------------------------ Sheet (bottom sheet on phones, dialog on desktop)

interface SheetProps {
  open: boolean;
  /** May return false (or a Promise of false) to stay open, e.g. after an unsaved-changes prompt. */
  onClose: () => void | boolean | Promise<boolean>;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  headerRight?: React.ReactNode;
}

export function Sheet({ open, onClose, title, children, footer, size = 'md', headerRight }: SheetProps) {
  useBackToClose(open, onClose);
  useBodyScrollLock(open);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const width = size === 'sm' ? 'sm:max-w-sm' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => onClose()} />
      <div
        className={cx(
          'sheet-panel relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-card shadow-pop sm:max-h-[86dvh] sm:rounded-3xl',
          width,
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-line-strong sm:hidden" />
        {(title || headerRight) && (
          <div className="flex flex-none items-center gap-2 px-5 pb-2 pt-3 sm:pt-5">
            <h2 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight">{title}</h2>
            {headerRight}
            <button onClick={() => onClose()} className="-mr-2 rounded-full p-2 text-muted hover:bg-hover hover:text-ink" aria-label="닫기">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="safe-bottom flex-none border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Buttons

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  icon,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; icon?: React.ReactNode }) {
  const v: Record<ButtonVariant, string> = {
    primary: 'bg-primary text-on-primary hover:brightness-95 active:brightness-90 shadow-sm',
    secondary: 'bg-card text-ink border border-line-strong hover:bg-hover',
    ghost: 'text-ink-soft hover:bg-hover hover:text-ink',
    danger: 'bg-expense text-white hover:brightness-95',
    soft: 'bg-primary-soft text-primary hover:brightness-95',
  };
  const s = size === 'sm' ? 'h-8 px-3 text-[13px] gap-1.5 rounded-lg' : size === 'lg' ? 'h-12 px-5 text-base gap-2 rounded-xl' : 'h-10 px-4 text-sm gap-1.5 rounded-xl';
  return (
    <button
      type="button"
      className={cx('inline-flex flex-none items-center justify-center font-semibold transition disabled:opacity-40', v[variant], s, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl text-ink-soft transition hover:bg-hover hover:text-ink disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Form controls

export function Field({ label, hint, children, className }: { label?: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{label}</span>}
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl border border-line-strong bg-card px-3.5 text-[15px] text-ink placeholder:text-faint transition focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary-soft disabled:bg-hover';

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx(inputBase, 'h-11', className)} {...rest} />;
});

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx(inputBase, 'py-2.5 leading-relaxed', className)} {...rest} />;
});

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputBase, 'h-11 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238d857c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; description?: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative h-7 w-12 flex-none rounded-full transition', checked ? 'bg-primary' : 'bg-line-strong')}
      >
        <span className={cx('absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('inline-flex rounded-xl bg-hover p-1', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 whitespace-nowrap rounded-lg font-semibold transition',
            size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm',
            value === o.value ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-line bg-card shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cx('mb-2.5 flex items-center justify-between gap-2', className)}>
      <h3 className="text-[15px] font-bold tracking-tight">{children}</h3>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="font-semibold text-ink-soft">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Checkbox({ checked, onChange, color, label, size = 22 }: { checked: boolean; onChange: () => void; color?: string; label: string; size?: number }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="flex flex-none items-center justify-center rounded-full border-2 transition"
      style={{
        width: size,
        height: size,
        borderColor: checked ? color || 'var(--color-primary)' : 'var(--color-line-strong)',
        background: checked ? color || 'var(--color-primary)' : 'transparent',
      }}
    >
      {checked && (
        <svg viewBox="0 0 24 24" className="h-[60%] w-[60%] text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  );
}

// ------------------------------------------------------------------ Confirm dialog

interface ConfirmOptions {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

const ConfirmContext = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Sheet open={!!state} onClose={() => close(false)} size="sm" title={state?.title}>
        {state?.message && <div className="text-[15px] leading-relaxed text-ink-soft">{state.message}</div>}
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={() => close(false)}>
            취소
          </Button>
          <Button className="flex-1" variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
            {state?.confirmLabel || '확인'}
          </Button>
        </div>
      </Sheet>
    </ConfirmContext.Provider>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} />;
}
