import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { LedgerEntry, LedgerType, PayMethod } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Field, Segmented, Sheet, TextInput, useConfirm } from '../../components/ui';
import { PhotoPicker } from '../../components/PhotoPicker';
import { useToast } from '../../components/Toast';
import { PAY_METHODS } from '../../data/defaults';
import { RECEIPT_PRESET } from '../../lib/image';
import { cx, newId, nowIso } from '../../lib/util';
import { formatAmountInput, parseAmountInput, sortLedgerCategories } from './helpers';

export function blankLedger(date: string, patch: Partial<LedgerEntry> = {}): LedgerEntry {
  const now = nowIso();
  return { id: newId('led'), date, type: 'expense', amount: 0, categoryId: 'lc_food', method: 'card', createdAt: now, updatedAt: now, ...patch };
}

export function LedgerCategoryGrid({ type, value, onChange }: { type: LedgerType; value: string; onChange: (id: string) => void }) {
  const { data } = useData();
  const cats = sortLedgerCategories(data.ledgerCategories, type);
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
      {cats.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          aria-pressed={value === c.id}
          className={cx('flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 text-[12px] font-semibold transition', value === c.id ? 'border-primary bg-primary-soft text-ink' : 'border-transparent bg-hover/70 text-ink-soft hover:bg-hover')}
        >
          <span className="text-xl leading-none">{c.emoji}</span>
          <span className="w-full truncate text-center">{c.name}</span>
        </button>
      ))}
    </div>
  );
}

export function LedgerEditor({ state, onClose }: { state: { entry: LedgerEntry; isNew: boolean } | null; onClose: () => void }) {
  return (
    <Sheet open={!!state} onClose={onClose} title={state?.isNew ? '내역 추가' : '내역 수정'}>
      {state && <LedgerForm key={state.entry.id} initial={state.entry} isNew={state.isNew} onDone={onClose} />}
    </Sheet>
  );
}

function LedgerForm({ initial, isNew, onDone }: { initial: LedgerEntry; isNew: boolean; onDone: () => void }) {
  const { data, upsert, remove, releaseImages } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [e, setE] = useState<LedgerEntry>(initial);
  const [amount, setAmount] = useState<number | ''>(initial.amount || '');
  const added = useRef<string[]>([]);
  const set = (patch: Partial<LedgerEntry>) => setE((p) => ({ ...p, ...patch }));

  const switchType = (type: LedgerType) => {
    if (type === e.type) return;
    const first = sortLedgerCategories(data.ledgerCategories, type)[0];
    set({ type, categoryId: first?.id || (type === 'income' ? 'lc_etc_in' : 'lc_etc_out') });
  };

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!amount || amount <= 0) return toast('금액을 입력해 주세요.', 'info');
    const next = { ...e, amount, memo: e.memo?.trim() || undefined };
    upsert('ledger', next);
    releaseImages([initial.receipt, ...added.current], { col: 'ledger', id: next.id, next });
    toast(isNew ? '기록했어요.' : '수정했어요.');
    onDone();
  };

  const cancel = () => {
    releaseImages(added.current, { col: 'ledger', id: initial.id, next: isNew ? undefined : initial });
    onDone();
  };

  const del = async () => {
    if (!(await confirm({ title: '이 내역을 삭제할까요?', confirmLabel: '삭제', danger: true }))) return;
    remove('ledger', e.id);
    releaseImages([initial.receipt, ...added.current], { col: 'ledger', id: e.id });
    onDone();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Segmented<LedgerType>
        value={e.type}
        onChange={switchType}
        className="w-full"
        options={[
          { value: 'expense', label: '지출' },
          { value: 'income', label: '수입' },
        ]}
      />
      <div>
        <div className="flex items-baseline gap-2 border-b-2 border-line-strong pb-1 focus-within:border-primary">
          <input
            autoFocus={isNew}
            inputMode="numeric"
            value={formatAmountInput(amount)}
            onChange={(x) => setAmount(parseAmountInput(x.target.value))}
            placeholder="0"
            className={cx('min-w-0 flex-1 bg-transparent text-[32px] font-bold tracking-tight placeholder:text-faint focus:outline-none', e.type === 'income' ? 'text-income' : 'text-ink')}
            aria-label="금액"
          />
          <span className="text-xl font-semibold text-muted">원</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[1000, 5000, 10000, 50000].map((v) => (
            <button key={v} type="button" onClick={() => setAmount((a) => (a || 0) + v)} className="rounded-full bg-hover px-3 py-1 text-[13px] font-semibold text-ink-soft hover:bg-line">
              +{v >= 10000 ? `${v / 10000}만` : `${v / 1000}천`}
            </button>
          ))}
          {amount !== '' && (
            <button type="button" onClick={() => setAmount('')} className="rounded-full px-3 py-1 text-[13px] font-semibold text-muted">
              지우기
            </button>
          )}
        </div>
      </div>
      <Field label="카테고리">
        <LedgerCategoryGrid type={e.type} value={e.categoryId} onChange={(categoryId) => set({ categoryId })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-3">
        <Field label="날짜">
          <TextInput type="date" required value={e.date} onChange={(x) => x.target.value && set({ date: x.target.value })} />
        </Field>
        <Field label={e.type === 'expense' ? '결제 수단' : '받은 방법'}>
          <Segmented<PayMethod> size="sm" value={e.method} onChange={(method) => set({ method })} className="flex w-full" options={PAY_METHODS.map((m) => ({ value: m.id, label: m.label }))} />
        </Field>
      </div>
      <Field label="메모">
        <TextInput value={e.memo || ''} onChange={(x) => set({ memo: x.target.value })} placeholder={e.type === 'expense' ? '예: 스타벅스 라떼' : '예: 10월 월급'} />
      </Field>
      <Field label="영수증">
        <PhotoPicker
          value={e.receipt ? [e.receipt] : []}
          onChange={(r) => set({ receipt: r[0] })}
          onAdded={(r) => added.current.push(...r)}
          max={1}
          preset={RECEIPT_PRESET}
          label="첨부"
        />
      </Field>
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-card px-5 pb-1 pt-3">
        {!isNew && (
          <Button variant="ghost" className="text-expense" onClick={del} icon={<Trash2 className="h-4 w-4" />}>
            삭제
          </Button>
        )}
        <div className="flex-1" />
        <Button onClick={cancel}>취소</Button>
        <Button type="submit" variant="primary">
          {isNew ? '기록' : '저장'}
        </Button>
      </div>
    </form>
  );
}
