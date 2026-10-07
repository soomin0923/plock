import React from 'react';
import type { MoodJournal, SleepFace } from '../../types';
import { hmToMinutes } from '../../lib/date';
import { cx } from '../../lib/util';

// 감정 일기 양식 — a paper-style form (sleep, positive/negative mood scales, small good things,
// gratitude ×5, praise ×5, regrets, tomorrow, 마음 컨디션 1–10). Editable in the diary editor,
// read-only (empty rows hidden) in the viewer.

export function blankJournal(): MoodJournal {
  return { gratitude: ['', '', '', '', ''], praise: ['', '', '', '', ''] };
}

const TEXT_KEYS = ['goodReason', 'badReason', 'song', 'place', 'food', 'healing', 'comfort', 'thanksTo', 'wish', 'regret', 'tomorrow'] as const;

export function journalHasContent(j?: MoodJournal): boolean {
  if (!j) return false;
  return (
    !!(j.sleepStart || j.sleepEnd || j.sleepFace || j.joy || j.calm || j.anxiety || j.gloom || j.condition) ||
    TEXT_KEYS.some((k) => j[k]?.trim()) ||
    j.gratitude.some((x) => x.trim()) ||
    j.praise.some((x) => x.trim())
  );
}

/** Plain text of the form, for search. */
export function journalText(j?: MoodJournal): string {
  if (!j) return '';
  return [...TEXT_KEYS.map((k) => j[k] || ''), ...j.gratitude, ...j.praise].join('\n');
}

export function sleepDuration(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  let m = hmToMinutes(end) - hmToMinutes(start);
  if (m <= 0) m += 24 * 60;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}시간 ${r}분` : `${h}시간`;
}

const FACES: { id: SleepFace; emoji: string; label: string }[] = [
  { id: 'good', emoji: '😊', label: '푹 잤어요' },
  { id: 'ok', emoji: '😐', label: '그럭저럭' },
  { id: 'bad', emoji: '😣', label: '잘 못 잤어요' },
];

type Props = { value: MoodJournal; onChange?: (next: MoodJournal) => void; fontFamily?: string };

export function MoodJournalForm({ value: j, onChange, fontFamily }: Props) {
  const ro = !onChange;
  const set = (patch: Partial<MoodJournal>) => onChange?.({ ...j, ...patch });
  const show = (...vals: unknown[]) => !ro || vals.some((v) => (Array.isArray(v) ? v.some((x) => String(x).trim()) : v !== undefined && v !== '' && v !== null));
  const sleep = sleepDuration(j.sleepStart, j.sleepEnd);

  const text = (key: (typeof TEXT_KEYS)[number], label: string, rows = 2) => (
    <Cell label={label}>
      {ro ? (
        <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{j[key] || <span className="text-faint">—</span>}</p>
      ) : (
        <textarea
          value={j[key] || ''}
          onChange={(e) => set({ [key]: e.target.value || undefined })}
          rows={rows}
          aria-label={label}
          className="journal-input w-full resize-none bg-transparent text-[15px] leading-relaxed placeholder:text-faint focus:outline-none"
          style={{ fontFamily }}
        />
      )}
    </Cell>
  );

  const list = (key: 'gratitude' | 'praise', label: string) => (
    <div className="min-w-0">
      <p className="border-b border-line-strong px-3 py-2 text-[13px] font-bold text-ink-soft">{label}</p>
      {j[key].map((v, i) =>
        ro && !v.trim() ? null : (
          <div key={i} className="flex items-center gap-2 border-b border-line px-3 py-1.5">
            <span className="w-4 flex-none text-[13px] font-semibold text-muted tabular">{i + 1}.</span>
            {ro ? (
              <span className="min-w-0 flex-1 break-words text-[15px]">{v}</span>
            ) : (
              <input
                value={v}
                onChange={(e) => set({ [key]: j[key].map((x, k) => (k === i ? e.target.value : x)) })}
                aria-label={`${label} ${i + 1}`}
                className="min-w-0 flex-1 bg-transparent py-0.5 text-[15px] focus:outline-none"
                style={{ fontFamily }}
              />
            )}
          </div>
        ),
      )}
    </div>
  );

  return (
    <section className="overflow-hidden rounded-[20px] border border-line-strong bg-card shadow-card" aria-label="감정 일기">
      <div className="border-b border-line-strong bg-primary-soft/60 px-4 py-2.5">
        <h3 className="text-[15px] font-extrabold tracking-tight text-primary">감정 일기</h3>
      </div>

      {/* 수면 */}
      {show(j.sleepStart, j.sleepEnd, j.sleepFace) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-strong px-3 py-2.5">
          <span className="text-[13px] font-bold text-ink-soft">수면 시간</span>
          {ro ? (
            <span className="text-[15px] tabular">
              {j.sleepStart && j.sleepEnd ? `${j.sleepStart} ~ ${j.sleepEnd}` : ''}
              {sleep && <b className="ml-1.5">{sleep}</b>}
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <input type="time" value={j.sleepStart || ''} onChange={(e) => set({ sleepStart: e.target.value || undefined })} aria-label="잠든 시간" className="rounded-lg border border-line bg-transparent px-1.5 py-1 text-[14px]" />
              <span className="text-muted">~</span>
              <input type="time" value={j.sleepEnd || ''} onChange={(e) => set({ sleepEnd: e.target.value || undefined })} aria-label="일어난 시간" className="rounded-lg border border-line bg-transparent px-1.5 py-1 text-[14px]" />
              {sleep && <span className="ml-1 text-[13px] font-semibold text-primary">{sleep}</span>}
            </span>
          )}
          <span className="ml-auto flex gap-1">
            {FACES.map((f) =>
              ro && j.sleepFace !== f.id ? null : (
                <button
                  key={f.id}
                  type="button"
                  disabled={ro}
                  aria-pressed={j.sleepFace === f.id}
                  aria-label={f.label}
                  title={f.label}
                  onClick={() => set({ sleepFace: j.sleepFace === f.id ? undefined : f.id })}
                  className={cx('flex h-9 w-9 items-center justify-center rounded-full text-xl transition', j.sleepFace === f.id ? 'bg-primary-soft ring-2 ring-primary' : 'opacity-40 grayscale hover:opacity-80')}
                >
                  {f.emoji}
                </button>
              ),
            )}
          </span>
        </div>
      )}

      {/* 긍정 / 부정 */}
      {show(j.joy, j.calm, j.goodReason, j.anxiety, j.gloom, j.badReason) && (
        <Pair>
          <div className="min-w-0">
            <p className="border-b border-line px-3 py-2 text-center text-[13px] font-bold text-ink-soft">오늘의 긍정 기분</p>
            <Scale label="기쁨" value={j.joy} onChange={ro ? undefined : (joy) => set({ joy })} />
            <Scale label="편안" value={j.calm} onChange={ro ? undefined : (calm) => set({ calm })} />
            {show(j.goodReason) && text('goodReason', '이유', 3)}
          </div>
          <div className="min-w-0">
            <p className="border-b border-line px-3 py-2 text-center text-[13px] font-bold text-ink-soft">오늘의 부정 기분</p>
            <Scale label="불안" value={j.anxiety} onChange={ro ? undefined : (anxiety) => set({ anxiety })} />
            <Scale label="우울" value={j.gloom} onChange={ro ? undefined : (gloom) => set({ gloom })} />
            {show(j.badReason) && text('badReason', '이유', 3)}
          </div>
        </Pair>
      )}

      {show(j.song, j.place) && (
        <Pair>
          {show(j.song) && text('song', '오늘 좋았던 노래')}
          {show(j.place) && text('place', '오늘 좋았던 장소')}
        </Pair>
      )}
      {show(j.food, j.healing) && (
        <Pair>
          {show(j.food) && text('food', '오늘 먹고 기운났던 음식')}
          {show(j.healing) && text('healing', '오늘의 힐링')}
        </Pair>
      )}
      {show(j.comfort, j.thanksTo) && (
        <Pair>
          {show(j.comfort) && text('comfort', '오늘 위로가 되었던 한 마디')}
          {show(j.thanksTo) && text('thanksTo', '오늘 고마운 사람')}
        </Pair>
      )}
      {show(j.wish) && <div className="border-b border-line-strong">{text('wish', '오늘 가장 하고 싶었던 일', 3)}</div>}

      {show(j.gratitude, j.praise) && (
        <Pair>
          {show(j.gratitude) && list('gratitude', '오늘 하루, 감사한 일')}
          {show(j.praise) && list('praise', '오늘 하루, 나에게 해 줄 칭찬')}
        </Pair>
      )}

      {show(j.regret, j.tomorrow) && (
        <Pair>
          {show(j.regret) && text('regret', '오늘 아쉬웠던 일', 3)}
          {show(j.tomorrow) && text('tomorrow', '내일 기대되는 일', 3)}
        </Pair>
      )}

      {show(j.condition) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
          <span className="text-[13px] font-bold text-ink-soft">오늘 마음 컨디션</span>
          <div className="ml-auto flex flex-wrap gap-1" role="radiogroup" aria-label="오늘 마음 컨디션">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
              ro && j.condition !== n ? null : (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={j.condition === n}
                  disabled={ro}
                  onClick={() => set({ condition: j.condition === n ? undefined : n })}
                  className={cx(
                    'flex h-8 w-8 items-center justify-center rounded-full border text-[13px] font-semibold tabular transition',
                    j.condition === n ? 'border-primary bg-primary text-on-primary' : 'border-line-strong text-ink-soft hover:border-primary',
                  )}
                >
                  {n}
                </button>
              ),
            )}
            {ro && <span className="self-center text-[13px] text-muted">/ 10</span>}
          </div>
        </div>
      )}
    </section>
  );
}

/** Two cells side by side on wide screens, stacked on phones. */
function Pair({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return <div className={cx('grid border-b border-line-strong', items.length > 1 && 'sm:grid-cols-2 sm:divide-x sm:divide-line-strong', '[&>*]:min-w-0 max-sm:divide-y max-sm:divide-line')}>{items}</div>;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2">
      <p className="mb-1 text-[13px] font-bold text-ink-soft">{label}</p>
      {children}
    </div>
  );
}

/** 1–5 on a dotted line, like the paper form. Tap the same dot again to clear. */
function Scale({ label, value, onChange }: { label: string; value?: number; onChange?: (v: number | undefined) => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2">
      <span className="w-9 flex-none text-[14px] font-semibold">{label}</span>
      <div className="relative flex flex-1 items-center justify-between" role="radiogroup" aria-label={label}>
        <span className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-dotted border-line-strong" />
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== undefined && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${label} ${n}`}
              disabled={!onChange}
              onClick={() => onChange?.(value === n ? undefined : n)}
              className="relative flex h-8 w-8 items-center justify-center disabled:cursor-default"
            >
              <span
                className={cx(
                  'rounded-full border-2 transition',
                  n === 1 || n === 5 ? 'h-4 w-4' : 'h-3 w-3',
                  value === n ? 'scale-125 border-primary bg-primary' : on ? 'border-primary bg-primary-light' : 'border-line-strong bg-card',
                )}
              />
            </button>
          );
        })}
      </div>
      <span className="w-6 flex-none text-right text-[13px] font-semibold text-muted tabular">{value ?? ''}</span>
    </div>
  );
}
