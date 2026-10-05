import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { LedgerType } from '../../types';
import { useData } from '../../data/DataProvider';
import { AssetImage } from '../../components/AssetImage';
import { Button, Select, Sheet, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { formatKoreanDate } from '../../lib/date';
import { cx, won } from '../../lib/util';
import type { LedgerDraft } from '../../lib/nlParser';
import { formatAmountInput, parseAmountInput, sortLedgerCategories } from './helpers';
import { blankLedger } from './LedgerEditor';

/** Confirm what the AI / parser understood before anything is saved. */
export function DraftReview({ state, onClose }: { state: { items: LedgerDraft[]; receipt?: string; source: 'ai' | 'local' } | null; onClose: () => void }) {
  const { data, upsert, releaseImages } = useData();
  const toast = useToast();
  const [items, setItems] = useState<LedgerDraft[]>([]);
  useEffect(() => setItems(state?.items || []), [state]);

  const patch = (i: number, p: Partial<LedgerDraft>) => setItems((list) => list.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const cancel = () => {
    if (state?.receipt) releaseImages([state.receipt]);
    onClose();
  };
  const save = () => {
    const valid = items.filter((d) => d.amount > 0);
    upsert(
      'ledger',
      valid.map((d, i) => blankLedger(d.date, { type: d.type, amount: d.amount, categoryId: d.categoryId, method: d.method, memo: d.memo || undefined, receipt: i === 0 ? state?.receipt : undefined })),
    );
    toast(`${valid.length}건 기록했어요. (지출 ${won(valid.filter((d) => d.type === 'expense').reduce((s, d) => s + d.amount, 0))})`);
    onClose();
  };

  return (
    <Sheet open={!!state} onClose={cancel} title="이렇게 기록할까요?">
      <p className="mb-3 rounded-xl bg-primary-soft px-3 py-2 text-[13px] text-primary">
        {state?.source === 'ai' ? '✨ AI가 읽은 내용이에요.' : '🔎 자동으로 정리했어요.'} 틀린 곳은 바로 고칠 수 있어요.
      </p>
      {state?.receipt && <AssetImage src={state.receipt} className="mb-3 h-32 w-full overflow-hidden rounded-xl border border-line" imgClassName="object-contain bg-hover" />}
      <div className="space-y-3">
        {items.map((d, i) => {
          const cats = sortLedgerCategories(data.ledgerCategories, d.type);
          return (
            <div key={i} className="rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="inline-flex rounded-lg bg-hover p-0.5 text-[13px] font-semibold">
                  {(['expense', 'income'] as LedgerType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => patch(i, { type: t, categoryId: sortLedgerCategories(data.ledgerCategories, t)[0]?.id || d.categoryId })}
                      className={cx('rounded-md px-2.5 py-1', d.type === t ? 'bg-card shadow-sm' : 'text-muted')}
                    >
                      {t === 'expense' ? '지출' : '수입'}
                    </button>
                  ))}
                </div>
                <span className="text-[13px] text-muted">{formatKoreanDate(d.date)}</span>
                <div className="flex-1" />
                {items.length > 1 && (
                  <button onClick={() => setItems(items.filter((_, idx) => idx !== i))} aria-label="이 항목 빼기" className="text-faint hover:text-expense">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <TextInput value={d.memo} onChange={(e) => patch(i, { memo: e.target.value })} placeholder="메모" className="h-10" />
                <div className="flex items-center gap-1 rounded-xl border border-line-strong px-3">
                  <input
                    inputMode="numeric"
                    value={formatAmountInput(d.amount)}
                    onChange={(e) => patch(i, { amount: Number(parseAmountInput(e.target.value) || 0) })}
                    className="w-24 bg-transparent text-right text-[15px] font-bold focus:outline-none"
                    aria-label="금액"
                  />
                  <span className="text-sm text-muted">원</span>
                </div>
              </div>
              <Select value={d.categoryId} onChange={(e) => patch(i, { categoryId: e.target.value })} className="mt-2 h-10" aria-label="카테고리">
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </Select>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <Button className="flex-1" onClick={cancel}>
          취소
        </Button>
        <Button className="flex-1" variant="primary" onClick={save} disabled={!items.some((d) => d.amount > 0)}>
          {items.length > 1 ? `${items.length}건 기록` : '기록'}
        </Button>
      </div>
    </Sheet>
  );
}
