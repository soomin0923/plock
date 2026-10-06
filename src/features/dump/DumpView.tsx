import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CalendarDays, CheckSquare, ChevronDown, ExternalLink, ImageIcon, Link2, NotebookPen, Plus, Star, Tag, Trash2, Wallet, X } from 'lucide-react';
import type { LedgerEntry, Note } from '../../types';
import { useData } from '../../data/DataProvider';
import { PageHeader } from '../../app/Shell';
import { useRouter } from '../../app/router';
import { Button, Card, Checkbox, Field, Sheet, TextArea, TextInput, useConfirm } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useToast } from '../../components/Toast';
import { useDeviceSettings } from '../../lib/deviceSettings';
import { localParseLedger, localParsePlan, type PlanDraft } from '../../lib/nlParser';
import { diffDays, formatKoreanDate, today } from '../../lib/date';
import { cx, newId, nowIso, won } from '../../lib/util';
import { categoryOf, sortCategories } from '../planner/helpers';
import { blankEvent, blankTask, CategoryPicker } from '../planner/forms';
import { parsePlanInput } from '../planner/rows';
import { ledgerCategoryOf } from '../ledger/helpers';

// 쏟아내기: type one line and press Enter. Everything is saved as you go —
// the half-typed line survives a reload, and the detail sheet has no save button.

const DRAFT_KEY = 'plock_dump_draft';

interface Draft {
  text: string;
  link: string;
  categoryId?: string;
  dueDate: string;
}
const emptyDraft: Draft = { text: '', link: '', dueDate: '' };

function loadDraft(): Draft {
  try {
    return { ...emptyDraft, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') };
  } catch {
    return emptyDraft;
  }
}

export function blankNote(patch: Partial<Note> = {}): Note {
  const now = nowIso();
  return { id: newId('note'), text: '', photos: [], starred: false, done: false, createdAt: now, updatedAt: now, ...patch };
}

export function normalizeLink(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
}

function dueText(d: string): { text: string; urgent: boolean } {
  const n = diffDays(d, today());
  if (n < 0) return { text: `${-n}일 지남`, urgent: true };
  if (n === 0) return { text: '오늘까지', urgent: true };
  if (n === 1) return { text: '내일까지', urgent: false };
  return { text: `D-${n}`, urgent: false };
}

/** What the line looks like it is: a dated plan and/or an amount. Used for one-tap actions. */
function useSuggestions(text: string) {
  const { data } = useData();
  return useMemo(() => {
    const t = text.trim();
    if (t.length < 2) return { plan: null as PlanDraft | null, ledger: [] as ReturnType<typeof localParseLedger> };
    const ledger = localParseLedger(t, today(), data.ledgerCategories);
    const p = localParsePlan(t, today(), data.categories);
    const dated = !!(p.startTime || p.dueDate || p.startDate !== today() || /오늘/.test(t));
    const plan = p.kind !== 'habit' && dated && !ledger.length ? p : null;
    return { plan, ledger };
  }, [text, data.categories, data.ledgerCategories]);
}

export function DumpView() {
  const { data, upsert, remove } = useData();
  const toast = useToast();
  const { go } = useRouter();
  const [draft, setDraftState] = useState<Draft>(loadDraft);
  const [open, setOpen] = useState<null | 'link' | 'category' | 'due'>(null);
  const [filter, setFilter] = useState<string>('all');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { plan, ledger } = useSuggestions(draft.text);

  const setDraft = (patch: Partial<Draft>) =>
    setDraftState((d) => {
      const next = { ...d, ...patch };
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  const resetDraft = () => {
    setDraftState(emptyDraft);
    setOpen(null);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
  };

  const addNote = () => {
    const text = draft.text.trim();
    if (!text) return;
    upsert('notes', blankNote({ text, link: normalizeLink(draft.link), categoryId: draft.categoryId, dueDate: draft.dueDate || undefined }));
    resetDraft();
  };

  const addPlan = (p: PlanDraft) => {
    const categoryId = draft.categoryId || p.categoryId;
    if (p.kind === 'event') {
      const ev = blankEvent(p.startDate, data.categories, { title: p.title, endDate: p.endDate, startTime: p.startTime, endTime: p.endTime, categoryId });
      upsert('events', ev);
      toast(`${formatKoreanDate(p.startDate)} 일정에 넣었어요.`, 'success', { label: '되돌리기', onClick: () => remove('events', ev.id) });
    } else {
      const task = blankTask({ title: p.title, dueDate: p.dueDate, dueTime: p.dueTime, priority: p.priority, categoryId: draft.categoryId || (p.categoryId !== 'cat_etc' ? p.categoryId : undefined) });
      upsert('tasks', task);
      toast('할 일에 넣었어요.', 'success', { label: '되돌리기', onClick: () => remove('tasks', task.id) });
    }
    resetDraft();
  };

  const addLedger = () => {
    const now = nowIso();
    const entries: LedgerEntry[] = ledger.map((l) => ({ id: newId('led'), date: l.date, type: l.type, amount: l.amount, categoryId: l.categoryId, method: l.method, memo: l.memo || undefined, createdAt: now, updatedAt: now }));
    upsert('ledger', entries);
    toast(`가계부에 ${entries.length}건 기록했어요.`, 'success', { label: '되돌리기', onClick: () => remove('ledger', entries.map((e) => e.id)) });
    resetDraft();
  };

  const cats = sortCategories(data.categories);
  const notes = data.notes.filter((n) => (filter === 'all' ? true : filter === 'star' ? n.starred : n.categoryId === filter));
  const active = notes.filter((n) => !n.done).sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt.localeCompare(a.createdAt));
  const done = notes.filter((n) => n.done).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const draftCat = draft.categoryId ? categoryOf(data.categories, draft.categoryId) : null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="쏟아내기" subtitle="머릿속 비우기 · 한 줄 적고 엔터, 나머지는 나중에" />

      <Card className="p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addNote();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            value={draft.text}
            onChange={(e) => setDraft({ text: e.target.value })}
            placeholder="생각나는 대로 적고 엔터 · 자동 저장돼요"
            aria-label="쏟아내기 입력"
            enterKeyHint="done"
            className="min-w-0 flex-1 rounded-2xl border border-line bg-paper/60 px-4 py-3 text-[15px] placeholder:text-faint focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary-soft"
          />
          <button type="submit" disabled={!draft.text.trim()} aria-label="메모 추가" className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary text-on-primary shadow-card transition disabled:bg-line-strong">
            <Plus className="h-6 w-6" />
          </button>
        </form>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <AttachButton icon={<Link2 className="h-4 w-4" />} label={draft.link ? '링크 ✓' : '링크'} active={open === 'link' || !!draft.link} onClick={() => setOpen(open === 'link' ? null : 'link')} />
          <AttachButton
            icon={<Tag className="h-4 w-4" />}
            label={draftCat ? draftCat.name : '카테고리'}
            color={draftCat?.color}
            active={open === 'category' || !!draftCat}
            onClick={() => setOpen(open === 'category' ? null : 'category')}
          />
          <AttachButton icon={<CalendarDays className="h-4 w-4" />} label={draft.dueDate ? `${formatKoreanDate(draft.dueDate)}까지` : '마감일'} active={open === 'due' || !!draft.dueDate} onClick={() => setOpen(open === 'due' ? null : 'due')} />
        </div>
        {open === 'link' && (
          <div className="mt-2 flex gap-2">
            <TextInput autoFocus value={draft.link} onChange={(e) => setDraft({ link: e.target.value })} placeholder="https://…" inputMode="url" aria-label="링크" />
            {draft.link && <Button variant="ghost" onClick={() => setDraft({ link: '' })} icon={<X className="h-4 w-4" />} aria-label="링크 지우기" />}
          </div>
        )}
        {open === 'category' && (
          <div className="mt-2">
            <CategoryPicker value={draft.categoryId} onChange={(categoryId) => setDraft({ categoryId })} allowNone />
          </div>
        )}
        {open === 'due' && (
          <div className="mt-2 flex gap-2">
            <TextInput type="date" value={draft.dueDate} onChange={(e) => setDraft({ dueDate: e.target.value })} aria-label="마감일" className="max-w-[12rem]" />
            {draft.dueDate && <Button variant="ghost" onClick={() => setDraft({ dueDate: '' })}>지우기</Button>}
          </div>
        )}

        {(plan || ledger.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-dashed border-line pt-3">
            <span className="mr-1 text-[12px] font-semibold text-muted">바로 넣기</span>
            {plan && (
              <SuggestChip onClick={() => addPlan(plan)} icon={plan.kind === 'event' ? <CalendarCheck className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}>
                {plan.kind === 'event' ? '일정' : '할 일'} · {plan.kind === 'event' ? formatKoreanDate(plan.startDate) : plan.dueDate ? `${formatKoreanDate(plan.dueDate)}까지` : '기한 없음'}
                {(plan.startTime || plan.dueTime) && ` ${plan.startTime || plan.dueTime}`} · {plan.title}
              </SuggestChip>
            )}
            {ledger.length > 0 && (
              <SuggestChip onClick={addLedger} icon={<Wallet className="h-4 w-4" />}>
                {ledger[0].type === 'income' ? '수입' : '지출'} {won(ledger.reduce((s, l) => s + l.amount, 0))}
                {ledger.length === 1 && ` · ${ledgerCategoryOf(data.ledgerCategories, ledger[0].categoryId).name}`}
                {ledger.length > 1 && ` (${ledger.length}건)`}
              </SuggestChip>
            )}
            <span className="text-[12px] text-faint">엔터는 메모로 저장</span>
          </div>
        )}
      </Card>

      <div className="drag-scroll no-scrollbar -mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="메모 거르기">
        {[
          { id: 'all', name: '전체', color: '' },
          { id: 'star', name: '⭐ 보관함', color: '' },
          ...cats,
        ].map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => setFilter(filter === c.id && c.id !== 'all' ? 'all' : c.id)}
            className={cx('flex flex-none items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition', filter === c.id ? 'border-transparent bg-ink text-card' : 'border-line-strong text-ink-soft hover:bg-hover')}
            style={filter === c.id && c.color ? { background: c.color, color: '#fff' } : undefined}
          >
            {c.color && filter !== c.id && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {active.length === 0 && (
          <div className="py-12 text-center text-[14px] leading-7 text-muted">
            머리가 복잡할 때 여기에 다 쏟아내면 돼요.
            <br />
            ⭐ 누르면 보관함으로, 누르면 긴 메모 + 사진까지.
          </div>
        )}
        {active.map((n) => (
          <NoteRow key={n.id} n={n} onOpen={() => setEditing(n)} />
        ))}
      </div>

      {done.length > 0 && (
        <div className="mt-5">
          <button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 px-1 text-[13px] font-semibold text-muted hover:text-ink">
            <ChevronDown className={cx('h-4 w-4 transition', !showDone && '-rotate-90')} />
            정리한 메모 {done.length}
          </button>
          {showDone && (
            <div className="mt-2 space-y-2">
              {done.map((n) => (
                <NoteRow key={n.id} n={n} onOpen={() => setEditing(n)} />
              ))}
            </div>
          )}
        </div>
      )}

      <NoteSheet note={editing} onClose={() => setEditing(null)} onGoLedger={(text) => go('ledger', { type: 'ledger-text', text })} />
    </div>
  );
}

function AttachButton({ icon, label, active, onClick, color }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={cx('inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[13px] font-semibold transition hover:bg-hover', active ? 'text-ink' : 'text-muted')}
      style={color ? { color } : undefined}
    >
      {icon}
      {label}
    </button>
  );
}

function SuggestChip({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1.5 text-[13px] font-semibold text-primary transition hover:brightness-95">
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

function NoteRow({ n, onOpen }: { n: Note; onOpen: () => void }) {
  const { data, upsert } = useData();
  const c = n.categoryId ? categoryOf(data.categories, n.categoryId) : null;
  const due = n.dueDate && !n.done ? dueText(n.dueDate) : null;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(k) => k.key === 'Enter' && onOpen()}
      className={cx('flex cursor-pointer items-start gap-3 rounded-2xl border bg-card px-3 py-3 shadow-card transition hover:border-line-strong', n.starred ? 'border-amber-200' : 'border-line')}
    >
      <Checkbox checked={n.done} onChange={() => upsert('notes', { ...n, done: !n.done })} label={`${n.text} 정리 완료`} color={c?.color} />
      <div className="min-w-0 flex-1">
        <p className={cx('line-clamp-2 whitespace-pre-wrap break-words text-[15px] font-medium', n.done && 'text-muted line-through')}>{n.text || '(내용 없음)'}</p>
        {(c || due || n.link || n.memo || n.photos.length > 0) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted">
            {c && (
              <span className="inline-flex items-center gap-1 font-semibold" style={{ color: c.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
            )}
            {due && <span className={cx('font-semibold tabular', due.urgent && 'text-expense')}>{due.text}</span>}
            {n.link && (
              <a href={n.link} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()} className="inline-flex max-w-[14rem] items-center gap-0.5 truncate text-sky-700 hover:underline">
                <Link2 className="h-3.5 w-3.5 flex-none" />
                <span className="truncate">{n.link.replace(/^https?:\/\/(www\.)?/, '')}</span>
              </a>
            )}
            {n.memo && <NotebookPen className="h-3.5 w-3.5" aria-label="메모 있음" />}
            {n.photos.length > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <ImageIcon className="h-3.5 w-3.5" />
                {n.photos.length}
              </span>
            )}
          </p>
        )}
      </div>
      <button
        type="button"
        aria-label={n.starred ? '보관함에서 빼기' : '보관함에 넣기'}
        aria-pressed={n.starred}
        onClick={(e) => {
          e.stopPropagation();
          upsert('notes', { ...n, starred: !n.starred });
        }}
        className="-m-1 flex-none rounded-lg p-1 hover:bg-hover"
      >
        <Star className={cx('h-5 w-5', n.starred ? 'fill-amber-400 text-amber-400' : 'text-faint')} />
      </button>
    </div>
  );
}

/** Detail editor. Every change is saved shortly after typing stops (and on close). */
function NoteSheet({ note, onClose, onGoLedger }: { note: Note | null; onClose: () => void; onGoLedger: (text: string) => void }) {
  const { data, upsert, remove, releaseImages } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const { geminiKey } = useDeviceSettings();
  const [n, setN] = useState<Note | null>(note);
  const [linkText, setLinkText] = useState('');
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);
  const latest = useRef<Note | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [prevNote, setPrevNote] = useState<Note | null>(null);
  if (note !== prevNote) {
    setPrevNote(note);
    setN(note);
    setLinkText(note?.link || '');
    setSaved(true);
  }

  const flush = () => {
    clearTimeout(timer.current);
    if (latest.current) {
      upsert('notes', latest.current);
      latest.current = null;
      setSaved(true);
    }
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (patch: Partial<Note>) => {
    if (!n) return;
    const next = { ...n, ...patch };
    setN(next);
    latest.current = next;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const close = () => {
    flush();
    onClose();
  };

  const convertPlan = async (kind: 'task' | 'event') => {
    if (!n) return;
    setBusy(true);
    try {
      const p = await parsePlanInput(n.text, !!geminiKey.trim(), data.categories, (m) => toast(m, 'error'));
      const memo = [n.memo, n.link].filter(Boolean).join('\n') || undefined;
      if (kind === 'event') {
        const date = p.kind === 'event' ? p.startDate : p.dueDate || n.dueDate || today();
        const ev = blankEvent(date, data.categories, {
          title: p.title || n.text,
          endDate: p.kind === 'event' ? p.endDate : date,
          startTime: p.startTime || p.dueTime,
          endTime: p.endTime,
          categoryId: n.categoryId || p.categoryId,
          memo,
          photos: n.photos,
        });
        upsert('events', ev);
        toast(`${formatKoreanDate(date)} 일정으로 옮겼어요.`);
      } else {
        upsert('tasks', blankTask({ title: p.title || n.text, dueDate: p.dueDate || (p.kind === 'event' ? p.startDate : undefined) || n.dueDate, dueTime: p.dueTime || p.startTime, priority: p.priority, categoryId: n.categoryId, memo }));
        toast('할 일로 옮겼어요.');
      }
      clearTimeout(timer.current);
      latest.current = null;
      upsert('notes', { ...n, done: true });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!note}
      onClose={close}
      title="메모"
      headerRight={
        n && (
          <span className="flex items-center gap-2">
            <span className="text-[12px] text-faint">{saved ? '자동 저장됨' : '저장 중…'}</span>
            <button type="button" aria-label={n.starred ? '보관함에서 빼기' : '보관함에 넣기'} aria-pressed={n.starred} onClick={() => update({ starred: !n.starred })} className="rounded-lg p-1.5 hover:bg-hover">
              <Star className={cx('h-5 w-5', n.starred ? 'fill-amber-400 text-amber-400' : 'text-faint')} />
            </button>
          </span>
        )
      }
    >
      {n && (
        <div className="space-y-4">
          <TextInput value={n.text} onChange={(e) => update({ text: e.target.value })} aria-label="한 줄" className="text-[16px] font-semibold" />
          <TextArea value={n.memo || ''} onChange={(e) => update({ memo: e.target.value || undefined })} placeholder="자세한 메모…" rows={6} aria-label="자세한 메모" />
          <PhotoPicker
            value={n.photos}
            max={6}
            onChange={(photos) => {
              const removed = n.photos.filter((p) => !photos.includes(p));
              update({ photos });
              if (removed.length) releaseImages(removed, { col: 'notes', id: n.id, next: { ...n, photos } });
            }}
          />
          <Field label="링크">
            <div className="flex gap-2">
              <TextInput
                value={linkText}
                inputMode="url"
                placeholder="https://…"
                onChange={(e) => {
                  setLinkText(e.target.value);
                  update({ link: normalizeLink(e.target.value) });
                }}
              />
              {n.link && (
                <a href={n.link} target="_blank" rel="noreferrer noopener" className="flex flex-none items-center rounded-xl border border-line-strong px-3 text-ink-soft hover:bg-hover" aria-label="링크 열기">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </Field>
          <Field label="카테고리">
            <CategoryPicker value={n.categoryId} onChange={(categoryId) => update({ categoryId })} allowNone />
          </Field>
          <Field label="마감일">
            <div className="flex gap-2">
              <TextInput type="date" value={n.dueDate || ''} onChange={(e) => update({ dueDate: e.target.value || undefined })} className="max-w-[12rem]" />
              {n.dueDate && (
                <Button variant="ghost" onClick={() => update({ dueDate: undefined })}>
                  지우기
                </Button>
              )}
            </div>
          </Field>

          <div className="border-t border-line pt-4">
            <p className="mb-2 text-[13px] font-semibold text-muted">정리하기 {geminiKey.trim() ? '· AI가 날짜·시간을 읽어요' : '· 문장 속 날짜·시간을 읽어요'}</p>
            <div className="grid grid-cols-3 gap-2">
              <Button disabled={busy || !n.text.trim()} onClick={() => convertPlan('task')} icon={<CheckSquare className="h-4 w-4" />}>
                할 일로
              </Button>
              <Button disabled={busy || !n.text.trim()} onClick={() => convertPlan('event')} icon={<CalendarCheck className="h-4 w-4" />}>
                일정으로
              </Button>
              <Button
                disabled={busy || !n.text.trim()}
                icon={<Wallet className="h-4 w-4" />}
                onClick={() => {
                  clearTimeout(timer.current);
                  latest.current = null;
                  upsert('notes', { ...n, done: true });
                  onClose();
                  onGoLedger([n.text, n.memo].filter(Boolean).join(' '));
                }}
              >
                가계부로
              </Button>
            </div>
          </div>

          <div className="flex justify-between border-t border-line pt-3">
            <Button
              variant="ghost"
              className="text-expense"
              icon={<Trash2 className="h-4 w-4" />}
              onClick={async () => {
                if (!(await confirm({ title: '메모를 삭제할까요?', confirmLabel: '삭제', danger: true }))) return;
                clearTimeout(timer.current);
                latest.current = null;
                remove('notes', n.id);
                releaseImages(n.photos, { col: 'notes', id: n.id });
                onClose();
              }}
            >
              삭제
            </Button>
            <Button variant="primary" onClick={close}>
              닫기
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
