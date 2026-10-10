import React, { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowUpToLine, Check, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { PlacementFx, StickerPlacement } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Sheet } from '../../components/ui';
import { StickerLayer } from '../diary/DiaryPage';
import { nextEffect, PLACEMENT_EFFECTS, StickerPicker } from '../diary/StickerPicker';
import { StickerMaker } from '../diary/StickerMaker';
import { cx, newId } from '../../lib/util';

// Stickers on the 오늘 page. They float over the widgets; positions are in board-width units
// (like the diary page). PC and phone layouts differ, so each keeps its own set.

function useWide() {
  const q = '(min-width: 1024px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export function StickerBoard({ active, onExit, children }: { active: boolean; onExit: () => void; children: React.ReactNode }) {
  const { prefs, savePrefs } = useData();
  const wide = useWide();
  const key = wide ? 'wide' : 'narrow';
  const list = prefs.homeStickers?.[key] || [];
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [makerOpen, setMakerOpen] = useState(false);
  const sel = list.find((s) => s.id === selected);

  useEffect(() => {
    if (!active) setSelected(null);
  }, [active]);

  const saveList = (next: StickerPlacement[]) => savePrefs({ homeStickers: { wide: prefs.homeStickers?.wide || [], narrow: prefs.homeStickers?.narrow || [], [key]: next } });

  const add = (kind: 'emoji' | 'image', value: string, effect?: PlacementFx) => {
    const board = ref.current;
    let y = 30;
    if (board) {
      const r = board.getBoundingClientRect();
      const unit = r.width / 100;
      const mid = (Math.max(r.top, 0) + Math.min(r.bottom, window.innerHeight - 140)) / 2;
      y = Math.max(5, (mid - r.top) / unit);
    }
    const s: StickerPlacement = {
      id: newId('stk'),
      kind,
      value,
      x: 30 + Math.random() * 40,
      y: y + (Math.random() * 6 - 3),
      size: kind === 'emoji' ? (wide ? 6 : 14) : wide ? 12 : 28,
      rotation: Math.round(Math.random() * 16 - 8),
      z: list.reduce((m, x) => Math.max(m, x.z), 0) + 1,
      effect,
    };
    saveList([...list, s]);
    setSelected(s.id);
    setPickerOpen(false);
  };

  const update = (fn: (s: StickerPlacement, all: StickerPlacement[]) => StickerPlacement | StickerPlacement[]) => {
    if (!sel) return;
    const r = fn(sel, list);
    saveList(Array.isArray(r) ? r : list.map((s) => (s.id === sel.id ? r : s)));
  };

  return (
    <div
      ref={ref}
      className="relative [container-type:inline-size]"
      onPointerDown={active ? (e) => !(e.target as Element).closest('[data-sticker], [data-sticker-ui]') && setSelected(null) : undefined}
    >
      <div className={cx(active && 'pointer-events-none select-none')}>{children}</div>
      <StickerLayer stickers={list} editable={active} selected={selected} onSelect={setSelected} onChange={saveList} pageRef={ref} />

      {active && (
        <div data-sticker-ui className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[46] px-3 lg:bottom-6 lg:left-60">
          <div className="mx-auto flex max-w-xl items-center gap-1 rounded-2xl border border-line bg-card p-1.5 shadow-pop">
            {sel ? (
              <>
                <Tool icon={<Sparkles className="h-5 w-5" />} label={`효과 · ${PLACEMENT_EFFECTS.find((e) => e.id === sel.effect)?.label}`} onClick={() => update((s) => ({ ...s, effect: nextEffect(s.effect) }))} />
                <Tool icon={<ArrowUpToLine className="h-5 w-5" />} label="맨 앞으로" onClick={() => update((s, all) => ({ ...s, z: all.reduce((m, x) => Math.max(m, x.z), 0) + 1 }))} />
                <Tool icon={<ArrowDownToLine className="h-5 w-5" />} label="맨 뒤로" onClick={() => update((s, all) => ({ ...s, z: all.reduce((m, x) => Math.min(m, x.z), 1) - 1 }))} />
                <Tool icon={<Trash2 className="h-5 w-5" />} label="삭제" danger onClick={() => (update((s, all) => all.filter((x) => x.id !== s.id)), setSelected(null))} />
              </>
            ) : (
              <>
                <Tool icon={<Plus className="h-5 w-5" />} label="스티커 추가" onClick={() => setPickerOpen(true)} />
                <p className="min-w-0 flex-1 px-2 text-[12px] leading-snug text-muted">
                  끌어서 옮기고, 모서리 버튼으로 크기·회전. {wide ? 'PC' : '휴대폰'} 화면용으로 따로 저장돼요.
                </p>
              </>
            )}
            <Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} onClick={onExit} className="ml-auto">
              완료
            </Button>
          </div>
        </div>
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="오늘 화면에 스티커 붙이기">
        <StickerPicker onPick={add} onMake={() => setMakerOpen(true)} />
      </Sheet>
      <StickerMaker open={makerOpen} onClose={() => setMakerOpen(false)} onCreated={(src) => add('image', src)} />
    </div>
  );
}

function Tool({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-semibold transition', danger ? 'text-expense hover:bg-expense/10' : 'text-ink-soft hover:bg-hover')}
    >
      {icon}
      {label}
    </button>
  );
}
