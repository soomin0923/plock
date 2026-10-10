import type { LedgerCategory, LedgerEntry, LedgerType } from '../../types';
import { monthKey } from '../../lib/date';

export const FALLBACK_LEDGER_CATEGORY: LedgerCategory = { id: 'lc_none', name: '미분류', type: 'expense', emoji: '❔', color: '#9a9289', order: 999, createdAt: '', updatedAt: '' };

export function sortLedgerCategories(list: LedgerCategory[], type?: LedgerType): LedgerCategory[] {
  return list.filter((c) => !type || c.type === type).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function ledgerCategoryOf(list: LedgerCategory[], id: string): LedgerCategory {
  return list.find((c) => c.id === id) || FALLBACK_LEDGER_CATEGORY;
}

export function entriesInMonth(list: LedgerEntry[], month: string): LedgerEntry[] {
  const mk = monthKey(month);
  return list.filter((e) => monthKey(e.date) === mk);
}

export function sumBy(list: LedgerEntry[], type: LedgerType): number {
  return list.reduce((s, e) => (e.type === type ? s + e.amount : s), 0);
}

export function sortEntries(list: LedgerEntry[]): LedgerEntry[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** "12,300" ↔ 12300 for the amount field. */
export function formatAmountInput(n: number | ''): string {
  return n === '' ? '' : n.toLocaleString('ko-KR');
}
export function parseAmountInput(s: string): number | '' {
  const digits = s.replace(/[^\d]/g, '').slice(0, 12);
  return digits ? Number(digits) : '';
}

export function toCsv(entries: LedgerEntry[], cats: LedgerCategory[]): string {
  const method: Record<string, string> = { card: '카드', cash: '현금', transfer: '이체', etc: '기타' };
  const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [['날짜', '구분', '카테고리', '금액', '결제수단', '메모']];
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([e.date, e.type === 'expense' ? '지출' : '수입', ledgerCategoryOf(cats, e.categoryId).name, String(e.type === 'expense' ? -e.amount : e.amount), method[e.method] || '', e.memo || '']);
  }
  // BOM so Excel opens Korean text correctly.
  return '﻿' + rows.map((r) => r.map(q).join(',')).join('\r\n');
}
