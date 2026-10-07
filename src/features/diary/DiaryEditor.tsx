import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Check, Copy, ImagePlus, NotebookPen, Palette, Smile, Sparkles, Sticker, Trash2, Wallet, X } from 'lucide-react';
import type { DiaryEntry, PlacementFx, StickerPlacement } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Spinner, useBackToClose, useConfirm } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { DIARY_FONTS, MOODS, PAPERS, WEATHERS } from '../../data/defaults';
import { PHOTO_PRESET } from '../../lib/image';
import { collectAssetRefs } from '../../data/repo';
import { cx, newId, nowIso, won } from '../../lib/util';
import { DiaryPage } from './DiaryPage';
import { blankJournal, journalHasContent, MoodJournalForm } from './MoodJournal';
import { getDeviceSettings, setDeviceSettings, useDeviceSettings } from '../../lib/deviceSettings';
import { nextEffect, PLACEMENT_EFFECTS, StickerPicker } from './StickerPicker';
import { StickerMaker } from './StickerMaker';

type Panel = 'sticker' | 'style' | 'mood' | null;

export function blankDiary(date: string): DiaryEntry {
  const now = nowIso();
  const journal = getDeviceSettings().diaryJournalDefault ? blankJournal() : undefined;
  return { id: newId('diary'), date, title: '', content: '', paper: 'plain', font: 'sans', photos: [], stickers: [], journal, createdAt: now, updatedAt: now };
}

// Work in progress is mirrored to localStorage, so a closed tab or a crash never loses a diary.
const DRAFT_KEY = 'plock_diary_draft';

function readDraft(initial: DiaryEntry, isNew: boolean): DiaryEntry | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as { entry?: DiaryEntry; isNew?: boolean; at?: number } | null;
    if (!d?.entry || !d.at) return null;
    // Ignore drafts older than the saved diary (edited later, maybe on another device) or a week.
    if (Date.now() - d.at > 7 * 86400_000 || (!isNew && new Date(initial.updatedAt).getTime() > d.at)) return null;
    if (d.entry.id === initial.id || (isNew && d.isNew && d.entry.date === initial.date)) return { ...d.entry, id: initial.id };
  } catch {
    /* ignore */
  }
  return null;
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

const isBlank = (e: DiaryEntry) => !e.title.trim() && !e.content.trim() && !e.photos.length && !e.stickers.length && !journalHasContent(e.journal);

export function DiaryEditor({ initial, isNew, onClose, onSaved }: { initial: DiaryEntry; isNew: boolean; onClose: () => void; onSaved?: (e: DiaryEntry) => void }) {
  const { data, upsert, saveImage, releaseImages } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [restored] = useState(() => readDraft(initial, isNew));
  const [entry, setEntry] = useState<DiaryEntry>(restored || initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [makerOpen, setMakerOpen] = useState(false);
  const [uploading, setUploading] = useState(0);
  const pageRef = useRef<HTMLDivElement>(null);
  const journalRef = useRef<HTMLDivElement>(null);
  const { diaryJournalDefault } = useDeviceSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const added = useRef<string[]>([]);

  const dirty = useMemo(() => JSON.stringify(entry) !== JSON.stringify(initial), [entry, initial]);
  const set = (patch: Partial<DiaryEntry>) => setEntry((e) => ({ ...e, ...patch }));

  useEffect(() => {
    if (restored) toast('작성 중이던 일기를 불러왔어요.', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a local copy of unsaved work (debounced).
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ entry, isNew, at: Date.now() }));
      } catch {
        /* storage full — the beforeunload warning below still protects the user */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [entry, dirty, isNew]);

  // Warn before the tab is closed with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Closing saves automatically; there is nothing to lose by pressing X or the back button.
  const requestClose = async (): Promise<boolean> => {
    if (dirty && !isBlank(entry)) {
      if (uploading > 0 && !(await confirm({ title: '사진을 올리는 중이에요', message: '지금 닫으면 올리는 중인 사진은 빠지고 나머지는 저장돼요.', confirmLabel: '저장하고 닫기' }))) return false;
      save(true);
      return true;
    }
    clearDraft();
    releaseImages(added.current, { col: 'diaries', id: initial.id, next: isNew ? undefined : initial });
    onClose();
    return true;
  };
  useBackToClose(true, requestClose);

  const save = (auto = false) => {
    if (isBlank(entry)) return toast('내용을 조금이라도 적어 주세요.', 'info');
    const next = { ...entry, title: entry.title.trim(), journal: journalHasContent(entry.journal) ? entry.journal : undefined };
    upsert('diaries', next);
    clearDraft();
    releaseImages([...collectAssetRefs(initial), ...added.current], { col: 'diaries', id: next.id, next });
    toast(auto ? '일기를 자동 저장했어요.' : isNew ? '일기를 저장했어요.' : '일기를 수정했어요.');
    onSaved?.(next);
    onClose();
  };

  // Place new stickers in the middle of what the user is currently looking at.
  const visibleCenterY = () => {
    const page = pageRef.current;
    if (!page) return 40;
    const rect = page.getBoundingClientRect();
    const unit = rect.width / 100;
    const viewportMid = (Math.max(rect.top, 56) + Math.min(rect.bottom, window.innerHeight - 140)) / 2;
    return Math.max(10, (viewportMid - rect.top) / unit);
  };

  const addSticker = (kind: 'emoji' | 'image', value: string, effect?: PlacementFx) => {
    const z = entry.stickers.reduce((m, s) => Math.max(m, s.z), 0) + 1;
    const s: StickerPlacement = {
      id: newId('stk'),
      kind,
      value,
      x: 35 + Math.random() * 30,
      y: visibleCenterY() + (Math.random() * 10 - 5),
      size: kind === 'emoji' ? 14 : 30,
      rotation: Math.round(Math.random() * 16 - 8),
      z,
      effect,
    };
    set({ stickers: [...entry.stickers, s] });
    setSelected(s.id);
    setPanel(null);
  };

  const updateSelected = (fn: (s: StickerPlacement, all: StickerPlacement[]) => StickerPlacement[] | StickerPlacement) => {
    if (!selected) return;
    const target = entry.stickers.find((s) => s.id === selected);
    if (!target) return;
    const r = fn(target, entry.stickers);
    set({ stickers: Array.isArray(r) ? r : entry.stickers.map((s) => (s.id === selected ? r : s)) });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = 6 - entry.photos.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (list.length < files.length) toast('사진은 한 페이지에 6장까지 넣을 수 있어요. (더 넣고 싶으면 스티커로 붙여 보세요)', 'info');
    setUploading(list.length);
    const refs: string[] = [];
    for (const f of list) {
      try {
        refs.push(await saveImage(f, PHOTO_PRESET));
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      setUploading((n) => n - 1);
    }
    added.current.push(...refs);
    setEntry((e) => ({ ...e, photos: [...e.photos, ...refs] }));
  };

  const dayLedger = data.ledger.filter((l) => l.date === entry.date);
  const dayExpense = dayLedger.filter((l) => l.type === 'expense').reduce((s, l) => s + l.amount, 0);
  const dayIncome = dayLedger.filter((l) => l.type === 'income').reduce((s, l) => s + l.amount, 0);
  const insertLedgerSummary = () => {
    const catName = (id: string) => data.ledgerCategories.find((c) => c.id === id)?.name || '기타';
    const lines = dayLedger.map((l) => `· ${l.memo || catName(l.categoryId)} ${l.type === 'expense' ? '-' : '+'}${won(l.amount)}`);
    const text = `\n\n[오늘의 가계부] 지출 ${won(dayExpense)}${dayIncome ? ` · 수입 ${won(dayIncome)}` : ''}\n${lines.join('\n')}`;
    set({ content: (entry.content.trimEnd() + text).trimStart() });
    toast('가계부 요약을 본문 끝에 넣었어요.');
  };

  const sel = entry.stickers.find((s) => s.id === selected);

  const openJournal = () => {
    if (!entry.journal) set({ journal: blankJournal() });
    setPanel(null);
    setTimeout(() => journalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  const removeJournal = async () => {
    if (journalHasContent(entry.journal) && !(await confirm({ title: '감정 일기 양식을 뺄까요?', message: '양식에 적은 내용이 지워져요.', confirmLabel: '빼기', danger: true }))) return;
    set({ journal: undefined });
  };

  return (
    <div className="animate-fade fixed inset-0 z-50 flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label="일기 쓰기">
      {/* Top bar */}
      <div className="safe-top flex-none border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-3">
          <button onClick={requestClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft hover:bg-hover" aria-label="닫기">
            <X className="h-5 w-5" />
          </button>
          <input
            type="date"
            value={entry.date}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className="h-10 rounded-xl border border-line bg-card px-2.5 text-[15px] font-semibold"
            aria-label="날짜"
          />
          <div className="flex-1" />
          {uploading > 0 && <Spinner className="text-muted" />}
          <Button variant="primary" onClick={() => save()} disabled={uploading > 0} icon={<Check className="h-4 w-4" />}>
            저장
          </Button>
        </div>
      </div>

      {/* Page */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[600px] px-3 pb-44 pt-4 sm:px-4 sm:pt-6">
          <DiaryPage
            entry={entry}
            editable
            onChange={set}
            selectedSticker={selected}
            onSelectSticker={(id) => {
              setSelected(id);
              if (id) setPanel(null);
            }}
            onPhotoToSticker={(ref) => {
              set({ photos: entry.photos.filter((p) => p !== ref) });
              addSticker('image', ref);
            }}
            pageRef={pageRef}
            className="rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.18)]"
          />
          {entry.journal && (
            <div ref={journalRef} className="mt-4 scroll-mt-4">
              <MoodJournalForm value={entry.journal} onChange={(journal) => set({ journal })} fontFamily={DIARY_FONTS.find((f) => f.id === entry.font)?.family} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
                <label className="flex items-center gap-2 text-[13px] text-muted">
                  <input type="checkbox" checked={diaryJournalDefault} onChange={(e) => setDeviceSettings({ diaryJournalDefault: e.target.checked })} className="h-4 w-4 accent-[var(--color-primary)]" />
                  새 일기를 쓸 때 항상 이 양식으로 시작
                </label>
                <button type="button" onClick={removeJournal} className="text-[13px] font-semibold text-muted hover:text-expense">
                  양식 빼기
                </button>
              </div>
            </div>
          )}
          {dayLedger.length > 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <Wallet className="h-5 w-5 flex-none text-primary" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">이 날의 가계부</p>
                <p className="text-muted">
                  지출 {won(dayExpense)}
                  {dayIncome ? ` · 수입 ${won(dayIncome)}` : ''} · {dayLedger.length}건
                </p>
              </div>
              <Button size="sm" variant="soft" onClick={insertLedgerSummary}>
                본문에 넣기
              </Button>
            </div>
          )}
          <p className="mt-3 text-center text-[12px] text-faint">스티커는 끌어서 옮기고, 모서리 버튼으로 크기·회전을 바꿔요.</p>
        </div>
      </div>

      {/* Bottom panels + toolbar */}
      <div className="safe-bottom flex-none border-t border-line bg-card shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.12)]">
        {panel && !sel && (
          <div className="mx-auto max-h-[42dvh] max-w-3xl overflow-y-auto px-4 pb-2 pt-4">
            {panel === 'sticker' && <StickerPicker onPick={addSticker} onMake={() => setMakerOpen(true)} />}
            {panel === 'mood' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-muted">오늘의 기분</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {MOODS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => set({ mood: entry.mood === m.id ? undefined : m.id })}
                        className={cx('flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[12px] font-semibold transition', entry.mood === m.id ? 'ring-2' : 'bg-hover/70')}
                        style={entry.mood === m.id ? { background: `${m.color}22`, color: m.color, ['--tw-ring-color' as string]: m.color } : undefined}
                      >
                        <span className="text-2xl">{m.emoji}</span>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-muted">날씨</p>
                  <div className="grid grid-cols-5 gap-2">
                    {WEATHERS.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => set({ weather: entry.weather === w.id ? undefined : w.id })}
                        className={cx('flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[12px] font-semibold', entry.weather === w.id ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'bg-hover/70')}
                      >
                        <span className="text-2xl">{w.emoji}</span>
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {panel === 'style' && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-muted">종이</p>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {PAPERS.map((p) => (
                      <button key={p.id} onClick={() => set({ paper: p.id })} className="flex flex-col items-center gap-1 text-[12px] font-semibold">
                        <span className={cx('diary-page block h-14 w-full rounded-xl border', `paper-${p.id}`, entry.paper === p.id ? 'border-primary ring-2 ring-primary' : 'border-line')}>
                          {p.id === 'lined' && <span className="diary-body block h-full !min-h-0" style={{ ['--lh' as string]: '18cqw' }} />}
                        </span>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-muted">글씨체</p>
                  <div className="grid grid-cols-4 gap-2">
                    {DIARY_FONTS.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => set({ font: f.id })}
                        className={cx('rounded-2xl py-3 text-lg', entry.font === f.id ? 'bg-primary-soft text-primary ring-2 ring-primary' : 'bg-hover/70')}
                        style={{ fontFamily: f.family }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mx-auto flex max-w-3xl items-center gap-1 px-2 py-2">
          {sel ? (
            <>
              <ToolButton icon={<ArrowUpToLine className="h-5 w-5" />} label="맨 앞으로" onClick={() => updateSelected((s, all) => ({ ...s, z: all.reduce((m, x) => Math.max(m, x.z), 0) + 1 }))} />
              <ToolButton icon={<ArrowDownToLine className="h-5 w-5" />} label="맨 뒤로" onClick={() => updateSelected((s, all) => ({ ...s, z: all.reduce((m, x) => Math.min(m, x.z), 1) - 1 }))} />
              <ToolButton
                icon={<Copy className="h-5 w-5" />}
                label="복제"
                onClick={() =>
                  updateSelected((s, all) => {
                    const copy = { ...s, id: newId('stk'), x: Math.min(95, s.x + 6), y: s.y + 6, z: all.reduce((m, x) => Math.max(m, x.z), 0) + 1 };
                    setTimeout(() => setSelected(copy.id));
                    return [...all, copy];
                  })
                }
              />
              <ToolButton icon={<Sparkles className="h-5 w-5" />} label={`효과 · ${PLACEMENT_EFFECTS.find((e) => e.id === sel.effect)?.label}`} onClick={() => updateSelected((s) => ({ ...s, effect: nextEffect(s.effect) }))} />
              <ToolButton icon={<Trash2 className="h-5 w-5" />} label="삭제" danger onClick={() => (updateSelected((s, all) => all.filter((x) => x.id !== s.id)), setSelected(null))} />
              <div className="flex-1" />
              <Button size="sm" variant="primary" onClick={() => setSelected(null)}>
                완료
              </Button>
            </>
          ) : (
            <>
              <ToolButton icon={<ImagePlus className="h-5 w-5" />} label="사진" onClick={() => photoInput.current?.click()} />
              <ToolButton icon={<Sticker className="h-5 w-5" />} label="스티커" active={panel === 'sticker'} onClick={() => setPanel(panel === 'sticker' ? null : 'sticker')} />
              <ToolButton icon={<Palette className="h-5 w-5" />} label="꾸미기" active={panel === 'style'} onClick={() => setPanel(panel === 'style' ? null : 'style')} />
              <ToolButton icon={<Smile className="h-5 w-5" />} label="기분·날씨" active={panel === 'mood'} onClick={() => setPanel(panel === 'mood' ? null : 'mood')} />
              <ToolButton icon={<NotebookPen className="h-5 w-5" />} label="감정 일기" active={!!entry.journal} onClick={openJournal} />
            </>
          )}
        </div>
      </div>

      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addPhotos(e.target.files);
          e.target.value = '';
        }}
      />
      <StickerMaker
        open={makerOpen}
        onClose={() => setMakerOpen(false)}
        onCreated={(src) => {
          added.current.push(src);
          addSticker('image', src);
        }}
      />
    </div>
  );
}

function ToolButton({ icon, label, onClick, active, danger }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-semibold transition sm:flex-none',
        active ? 'bg-primary-soft text-primary' : danger ? 'text-expense hover:bg-expense/10' : 'text-ink-soft hover:bg-hover',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
