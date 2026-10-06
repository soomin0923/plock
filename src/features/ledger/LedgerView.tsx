import React, { useMemo, useRef, useState } from 'react';
import { Download, Plus, Receipt, Settings2, Wallet } from 'lucide-react';
import type { LedgerEntry } from '../../types';
import { useData } from '../../data/DataProvider';
import { PageHeader } from '../../app/Shell';
import { useIntent, useRouter } from '../../app/router';
import { Button, Card, EmptyState, IconButton, Segmented, Spinner } from '../../components/ui';
import { MonthGrid, MonthNav } from '../../components/MonthGrid';
import { QuickAdd } from '../../components/QuickAdd';
import { AssetImage } from '../../components/AssetImage';
import { useToast } from '../../components/Toast';
import { getDeviceSettings } from '../../lib/deviceSettings';
import { addMonths, diffDays, endOfMonth, formatKoreanDate, monthKey, today } from '../../lib/date';
import { compactWon, cx, downloadBlob, won } from '../../lib/util';
import { aiParseLedger, aiReadReceipt, hasGeminiKey } from '../../lib/gemini';
import { localParseLedger, type LedgerDraft } from '../../lib/nlParser';
import { compressImage, RECEIPT_PRESET } from '../../lib/image';
import { PAY_METHODS } from '../../data/defaults';
import { entriesInMonth, ledgerCategoryOf, sortEntries, sumBy, toCsv } from './helpers';
import { blankLedger, LedgerEditor } from './LedgerEditor';
import { LedgerStats } from './LedgerStats';
import { LedgerSettings } from './LedgerSettings';
import { DraftReview } from './DraftReview';

type Tab = 'list' | 'calendar' | 'stats';

export function LedgerView() {
  const { data, prefs, storeImage } = useData();
  const toast = useToast();
  const { go } = useRouter();
  const [month, setMonth] = useState(today());
  const [tab, setTab] = useState<Tab>('list');
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ entry: LedgerEntry; isNew: boolean } | null>(null);
  const [drafts, setDrafts] = useState<{ items: LedgerDraft[]; receipt?: string; source: 'ai' | 'local' } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const receiptInput = useRef<HTMLInputElement>(null);

  const newEntry = (date = today(), patch: Partial<LedgerEntry> = {}) => setEditor({ entry: blankLedger(date, patch), isNew: true });

  useIntent((i) => {
    if (i.type === 'ledger-add') {
      setMonth(i.date);
      newEntry(i.date);
    }
    if (i.type === 'ledger-text') onQuick(i.text, !!getDeviceSettings().geminiKey.trim());
  });

  const monthEntries = useMemo(() => entriesInMonth(data.ledger, month), [data.ledger, month]);
  const expense = sumBy(monthEntries, 'expense');
  const income = sumBy(monthEntries, 'income');
  const budget = prefs.monthlyBudget;

  const onQuick = async (text: string, useAi: boolean) => {
    const d = monthKey(month) === monthKey(today()) ? today() : month;
    let items: LedgerDraft[] = [];
    let source: 'ai' | 'local' = 'local';
    if (useAi) {
      try {
        items = await aiParseLedger(text, d, data.ledgerCategories);
        source = 'ai';
      } catch (e) {
        toast(`AI 분석 실패: ${(e as Error).message} (기본 분석으로 대신했어요)`, 'error');
      }
    }
    if (!items.length) items = localParseLedger(text, d, data.ledgerCategories);
    if (!items.length) {
      toast('금액을 찾지 못했어요. 예: "점심 김밥 4500원"', 'info');
      return;
    }
    setDrafts({ items, source });
  };

  const onReceipt = async (file?: File) => {
    if (!file) return;
    setScanning(true);
    try {
      const blob = await compressImage(file, RECEIPT_PRESET);
      const ref = await storeImage(blob);
      if (!hasGeminiKey()) {
        toast('Gemini API 키를 설정하면 영수증 금액을 자동으로 읽어요.', 'info', { label: '설정', onClick: () => go('settings', { type: 'settings-section', section: 'ai' }) });
        newEntry(today(), { receipt: ref });
        return;
      }
      const items = await aiReadReceipt(blob, today(), data.ledgerCategories);
      if (!items.length) {
        toast('영수증에서 금액을 찾지 못했어요. 직접 입력해 주세요.', 'info');
        newEntry(today(), { receipt: ref });
      } else setDrafts({ items, receipt: ref, source: 'ai' });
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const exportCsv = () => {
    downloadBlob(new Blob([toCsv(monthEntries, data.ledgerCategories)], { type: 'text/csv;charset=utf-8' }), `plock_가계부_${monthKey(month)}.csv`);
  };

  // Budget pace
  const isCurrentMonth = monthKey(month) === monthKey(today());
  const daysLeft = isCurrentMonth ? diffDays(today(), endOfMonth(month)) + 1 : 0;
  const budgetRatio = budget ? expense / budget : 0;

  const listEntries = sortEntries(dayFilter ? monthEntries.filter((e) => e.date === dayFilter) : monthEntries);
  const grouped = useMemo(() => {
    const m = new Map<string, LedgerEntry[]>();
    listEntries.forEach((e) => m.set(e.date, [...(m.get(e.date) || []), e]));
    return Array.from(m.entries());
  }, [listEntries]);

  return (
    <div>
      <PageHeader
        title="가계부"
        actions={
          <>
            <IconButton label="이 달 CSV로 내보내기" onClick={exportCsv} disabled={!monthEntries.length}>
              <Download className="h-5 w-5" />
            </IconButton>
            <IconButton label="카테고리·예산 설정" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-5 w-5" />
            </IconButton>
            <Button variant="secondary" icon={scanning ? <Spinner /> : <Receipt className="h-4 w-4" />} disabled={scanning} onClick={() => receiptInput.current?.click()}>
              영수증
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => newEntry(isCurrentMonth ? today() : month)}>
              기록
            </Button>
          </>
        }
      />
      <input ref={receiptInput} type="file" accept="image/*" className="hidden" onChange={(e) => (onReceipt(e.target.files?.[0]), (e.target.value = ''))} />

      <QuickAdd className="mb-4" placeholder="예: 점심 김밥 4500원, 커피 2000원" onSubmit={onQuick} />

      <MonthNav month={month} onPrev={() => (setMonth(addMonths(month, -1)), setDayFilter(null))} onNext={() => (setMonth(addMonths(month, 1)), setDayFilter(null))} onToday={() => (setMonth(today()), setDayFilter(null))} />

      {/* Summary */}
      <Card className="mb-4 p-4 sm:p-5">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[13px] text-muted">지출</p>
            <p className="text-xl font-bold tracking-tight sm:text-2xl">{compactWon(expense)}<span className="text-sm font-semibold">원</span></p>
          </div>
          <div>
            <p className="text-[13px] text-muted">수입</p>
            <p className="text-xl font-bold tracking-tight text-income sm:text-2xl">{compactWon(income)}<span className="text-sm font-semibold">원</span></p>
          </div>
          <div>
            <p className="text-[13px] text-muted">합계</p>
            <p className={cx('text-xl font-bold tracking-tight sm:text-2xl', income - expense < 0 && 'text-expense')}>
              {income - expense > 0 ? '+' : ''}
              {compactWon(income - expense)}
              <span className="text-sm font-semibold">원</span>
            </p>
          </div>
        </div>
        {budget ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-semibold">예산 {won(budget)}</span>
              <span className={cx('font-semibold', budgetRatio > 1 ? 'text-expense' : budgetRatio > 0.8 ? 'text-amber-600' : 'text-muted')}>
                {budgetRatio > 1 ? `⚠ ${won(expense - budget)} 초과` : `${Math.round(budgetRatio * 100)}% 사용`}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-primary-soft">
              <div
                className={cx('h-full rounded-full transition-all', budgetRatio > 1 ? 'bg-expense' : budgetRatio > 0.8 ? 'bg-amber-500' : 'bg-primary')}
                style={{ width: `${Math.min(100, budgetRatio * 100)}%` }}
              />
            </div>
            {isCurrentMonth && budget > expense && <p className="mt-1.5 text-[13px] text-muted">남은 {daysLeft}일 동안 하루 {won((budget - expense) / daysLeft)}씩 쓸 수 있어요</p>}
          </div>
        ) : (
          <button onClick={() => setSettingsOpen(true)} className="mt-3 text-[13px] font-semibold text-primary">
            + 한 달 예산 정하기
          </button>
        )}
      </Card>

      <Segmented<Tab>
        value={tab}
        onChange={(t) => (setTab(t), setDayFilter(null))}
        className="mb-4 w-full sm:w-auto"
        options={[
          { value: 'list', label: '내역' },
          { value: 'calendar', label: '달력' },
          { value: 'stats', label: '통계' },
        ]}
      />

      {tab === 'calendar' && (
        <Card className="mb-4 p-3 sm:p-4">
          <MonthGrid
            month={month}
            selected={dayFilter || undefined}
            onSelect={(d) => setDayFilter(dayFilter === d ? null : d)}
            weekStartsOn={prefs.weekStartsOn}
            cellMinHeight="min-h-[60px] sm:min-h-[78px]"
            renderCell={({ date, inMonth }) => {
              if (!inMonth) return null;
              const dayEntries = monthEntries.filter((e) => e.date === date);
              const ex = sumBy(dayEntries, 'expense');
              const inc = sumBy(dayEntries, 'income');
              return (
                <span className="flex flex-col items-center text-[10px] font-semibold leading-tight tabular sm:items-start sm:px-1 sm:text-[11px]">
                  {inc > 0 && <span className="text-income">+{compactWon(inc)}</span>}
                  {ex > 0 && <span className="text-ink-soft">-{compactWon(ex)}</span>}
                </span>
              );
            }}
          />
        </Card>
      )}

      {tab === 'stats' ? (
        <LedgerStats month={month} />
      ) : (
        <>
          {dayFilter && (
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{formatKoreanDate(dayFilter)}</p>
              <Button size="sm" variant="soft" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => newEntry(dayFilter)}>
                이 날 기록
              </Button>
            </div>
          )}
          {grouped.length === 0 ? (
            <Card>
              <EmptyState icon={<Wallet className="h-10 w-10" />} title={dayFilter ? '이 날의 기록이 없어요' : '이 달의 기록이 없어요'} description="위 입력창에 '점심 9000원'처럼 적어 보세요." />
            </Card>
          ) : (
            <div className="space-y-3">
              {grouped.map(([date, list]) => {
                const ex = sumBy(list, 'expense');
                const inc = sumBy(list, 'income');
                return (
                  <Card key={date} className="p-2">
                    <div className="flex items-baseline justify-between px-2 pb-1 pt-1.5 text-[13px]">
                      <span className="font-bold text-ink-soft">{formatKoreanDate(date)}</span>
                      <span className="font-semibold text-muted tabular">
                        {inc > 0 && <span className="mr-2 text-income">+{won(inc)}</span>}
                        {ex > 0 && <span>-{won(ex)}</span>}
                      </span>
                    </div>
                    {list.map((e) => (
                      <EntryRow key={e.id} e={e} onClick={() => setEditor({ entry: e, isNew: false })} />
                    ))}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <LedgerEditor state={editor} onClose={() => setEditor(null)} />
      <LedgerSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DraftReview state={drafts} onClose={() => setDrafts(null)} />
    </div>
  );
}

export function EntryRow({ e, onClick }: { e: LedgerEntry; onClick: () => void }) {
  const { data } = useData();
  const c = ledgerCategoryOf(data.ledgerCategories, e.categoryId);
  const method = PAY_METHODS.find((m) => m.id === e.method)?.label;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-hover">
      <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-lg" style={{ background: `${c.color}22` }}>
        {c.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{e.memo || c.name}</span>
        <span className="text-[13px] text-muted">
          {c.name} · {method}
        </span>
      </span>
      {e.receipt && <AssetImage src={e.receipt} className="h-9 w-9 flex-none overflow-hidden rounded-lg border border-line" />}
      <span className={cx('flex-none text-[15px] font-bold tabular', e.type === 'income' ? 'text-income' : 'text-ink')}>
        {e.type === 'income' ? '+' : '-'}
        {won(e.amount)}
      </span>
    </button>
  );
}
