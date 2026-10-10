import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Category } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, IconButton, Sheet, TextInput, useConfirm } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { CATEGORY_COLORS } from '../../data/defaults';
import { newId, nowIso, cx } from '../../lib/util';
import { sortCategories } from './helpers';

export function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, upsert, remove } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const cats = sortCategories(data.categories);
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [editing, setEditing] = useState<string | null>(null);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const now = nowIso();
    upsert('categories', { id: newId('cat'), name: name.trim(), color, order: (cats[cats.length - 1]?.order ?? 0) + 1, createdAt: now, updatedAt: now });
    setName('');
  };

  const move = (c: Category, dir: -1 | 1) => {
    const idx = cats.findIndex((x) => x.id === c.id);
    const other = cats[idx + dir];
    if (!other) return;
    // Renumber everything so equal/legacy order values can't get stuck.
    const reordered = [...cats];
    reordered.splice(idx, 1);
    reordered.splice(idx + dir, 0, c);
    upsert('categories', reordered.map((x, i) => ({ ...x, order: i })));
  };

  const del = async (c: Category) => {
    if (cats.length <= 1) return toast('카테고리는 최소 1개 필요해요.', 'info');
    const used = data.events.filter((e) => e.categoryId === c.id).length;
    const ok = await confirm({
      title: `'${c.name}' 카테고리를 삭제할까요?`,
      message: used ? `이 카테고리의 일정 ${used}개는 '미분류'로 표시됩니다.` : undefined,
      confirmLabel: '삭제',
      danger: true,
    });
    if (ok) remove('categories', c.id);
  };

  return (
    <Sheet open={open} onClose={onClose} title="일정 카테고리">
      <form onSubmit={add} className="mb-4 space-y-2.5 rounded-2xl bg-hover/60 p-3">
        <div className="flex gap-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="새 카테고리 이름" className="h-10" />
          <Button type="submit" variant="primary" disabled={!name.trim()} icon={<Plus className="h-4 w-4" />}>
            추가
          </Button>
        </div>
        <ColorRow value={color} onChange={setColor} />
      </form>
      <div className="space-y-1">
        {cats.map((c, i) => (
          <div key={c.id} className="rounded-xl px-1 py-1.5">
            <div className="flex items-center gap-2">
              <button className="h-5 w-5 flex-none rounded-full ring-2 ring-white" style={{ background: c.color }} onClick={() => setEditing(editing === c.id ? null : c.id)} aria-label="색상 바꾸기" />
              <input
                defaultValue={c.name}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && upsert('categories', { ...c, name: e.target.value.trim() })}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-[15px] font-medium hover:bg-hover focus:bg-hover focus:outline-none"
                aria-label="카테고리 이름"
              />
              <IconButton label="위로" onClick={() => move(c, -1)} disabled={i === 0}>
                <ArrowUp className="h-4 w-4" />
              </IconButton>
              <IconButton label="아래로" onClick={() => move(c, 1)} disabled={i === cats.length - 1}>
                <ArrowDown className="h-4 w-4" />
              </IconButton>
              <IconButton label="삭제" onClick={() => del(c)} className="hover:text-expense">
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
            {editing === c.id && (
              <div className="mt-2 pl-7">
                <ColorRow value={c.color} onChange={(color) => upsert('categories', { ...c, color })} />
              </div>
            )}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const custom = !CATEGORY_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={c}
          className={cx('h-7 w-7 rounded-full transition', value === c && 'ring-2 ring-ink ring-offset-2')}
          style={{ background: c }}
        />
      ))}
      <ColorPickerSwatch value={value} onChange={onChange} selected={custom} />
    </div>
  );
}

/** Rainbow swatch that opens the system color palette; shows the chosen color once picked. */
export function ColorPickerSwatch({ value, onChange, selected, label = '직접 고르기' }: { value: string; onChange: (c: string) => void; selected?: boolean; label?: string }) {
  // Local state: saving is async, so a controlled input would briefly snap back to the old color
  // and the browser's trailing `change` event would then save that old color again.
  const [local, setLocal] = useState(value);
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    setLocal(value);
  }
  return (
    <label
      title={label}
      className={cx('relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full transition', selected && 'ring-2 ring-ink ring-offset-2')}
      style={{ background: selected ? value : 'conic-gradient(#f87171, #fbbf24, #a3e635, #34d399, #38bdf8, #818cf8, #e879f9, #f87171)' }}
    >
      {!selected && <span className="h-3 w-3 rounded-full bg-white/90" />}
      <input
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(local) ? local.toLowerCase() : '#888888'}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          if (v.toLowerCase() !== value.toLowerCase()) onChange(v);
        }}
        aria-label={label} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </label>
  );
}
