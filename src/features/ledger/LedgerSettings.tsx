import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LedgerCategory, LedgerType } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Field, IconButton, Segmented, Sheet, TextInput, useConfirm } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { newId, nowIso } from '../../lib/util';
import { formatAmountInput, parseAmountInput, sortLedgerCategories } from './helpers';
import { ColorRow } from '../planner/CategoryManager';
import { CATEGORY_COLORS } from '../../data/defaults';

export function LedgerSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, upsert, remove, prefs, savePrefs } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [type, setType] = useState<LedgerType>('expense');
  const [budget, setBudget] = useState<number | ''>(prefs.monthlyBudget || '');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💸');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const cats = sortLedgerCategories(data.ledgerCategories, type);

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const now = nowIso();
    upsert('ledgerCategories', { id: newId('lc'), name: name.trim(), type, emoji: emoji || '💸', color, order: (cats[cats.length - 1]?.order ?? 0) + 1, createdAt: now, updatedAt: now });
    setName('');
  };

  const del = async (c: LedgerCategory) => {
    if (cats.length <= 1) return toast('카테고리는 최소 1개 필요해요.', 'info');
    const used = data.ledger.filter((l) => l.categoryId === c.id).length;
    if (!(await confirm({ title: `'${c.name}'을(를) 삭제할까요?`, message: used ? `이 카테고리의 기록 ${used}건은 '미분류'로 표시됩니다.` : undefined, confirmLabel: '삭제', danger: true }))) return;
    remove('ledgerCategories', c.id);
  };

  return (
    <Sheet open={open} onClose={onClose} title="가계부 설정">
      <Field label="한 달 예산" hint="비워 두면 예산 표시를 하지 않아요.">
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-1 rounded-xl border border-line-strong bg-card px-3.5 focus-within:border-primary">
            <input inputMode="numeric" value={formatAmountInput(budget)} onChange={(e) => setBudget(parseAmountInput(e.target.value))} placeholder="예: 500,000" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" aria-label="한 달 예산" />
            <span className="text-sm text-muted">원</span>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              savePrefs({ monthlyBudget: budget || undefined });
              toast(budget ? '예산을 저장했어요.' : '예산을 껐어요.');
            }}
          >
            저장
          </Button>
        </div>
      </Field>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold">카테고리</h3>
          <Segmented<LedgerType>
            size="sm"
            value={type}
            onChange={setType}
            options={[
              { value: 'expense', label: '지출' },
              { value: 'income', label: '수입' },
            ]}
          />
        </div>
        <form onSubmit={add} className="mb-3 space-y-2.5 rounded-2xl bg-hover/60 p-3">
          <div className="flex gap-2">
            <TextInput value={emoji} onChange={(e) => setEmoji(Array.from(e.target.value).slice(-1)[0] || '')} className="h-10 w-12 px-0 text-center text-lg" aria-label="이모지" />
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="새 카테고리" className="h-10" />
            <Button type="submit" variant="primary" disabled={!name.trim()} icon={<Plus className="h-4 w-4" />}>
              추가
            </Button>
          </div>
          <ColorRow value={color} onChange={setColor} />
        </form>
        <div className="space-y-1">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl px-1 py-1">
              <input
                defaultValue={c.emoji}
                onBlur={(e) => {
                  const v = Array.from(e.target.value).slice(-1)[0];
                  if (v && v !== c.emoji) upsert('ledgerCategories', { ...c, emoji: v });
                }}
                className="h-9 w-10 rounded-lg bg-hover text-center text-lg focus:outline-none"
                aria-label="이모지"
              />
              <input
                defaultValue={c.name}
                onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== c.name && upsert('ledgerCategories', { ...c, name: e.target.value.trim() })}
                className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 text-[15px] hover:bg-hover focus:bg-hover focus:outline-none"
                aria-label="카테고리 이름"
              />
              <IconButton label="삭제" onClick={() => del(c)} className="hover:text-expense">
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
