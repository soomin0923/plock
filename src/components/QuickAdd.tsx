import React, { useState } from 'react';
import { ArrowUp, Sparkles, Wand2 } from 'lucide-react';
import { Spinner } from './ui';
import { hasAnyAiKey, useDeviceSettings } from '../lib/deviceSettings';
import { cx } from '../lib/util';

/** Natural-language input. Uses the user's Gemini key when set, otherwise the built-in parser. */
export function QuickAdd({
  placeholder,
  onSubmit,
  className,
}: {
  placeholder: string;
  onSubmit: (text: string, useAi: boolean) => Promise<void>;
  className?: string;
}) {
  const useAi = hasAnyAiKey(useDeviceSettings());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);

  const submit = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      await onSubmit(v, useAi);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cx('flex items-center gap-2 rounded-2xl border bg-card py-1.5 pl-3.5 pr-1.5 shadow-card transition', focused ? 'border-primary ring-3 ring-primary-soft' : 'border-line')}
      >
        {useAi ? <Sparkles className="h-[18px] w-[18px] flex-none text-primary" /> : <Wand2 className="h-[18px] w-[18px] flex-none text-muted" />}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[15px] placeholder:text-faint focus:outline-none"
          enterKeyHint="send"
          aria-label={placeholder}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="추가"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary text-on-primary transition disabled:bg-line-strong"
        >
          {busy ? <Spinner /> : <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />}
        </button>
      </form>
    </div>
  );
}
