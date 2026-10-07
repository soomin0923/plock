import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Trash2, X } from 'lucide-react';
import type { DiaryEntry } from '../../types';
import { useData } from '../../data/DataProvider';
import { IconButton, useBackToClose, useConfirm } from '../../components/ui';
import { ImageViewer } from '../../components/AssetImage';
import { useToast } from '../../components/Toast';
import { collectAssetRefs } from '../../data/repo';
import { won } from '../../lib/util';
import { DiaryPage } from './DiaryPage';
import { journalHasContent, MoodJournalForm } from './MoodJournal';
import { DIARY_FONTS } from '../../data/defaults';

export function sortDiaries(list: DiaryEntry[]): DiaryEntry[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function DiaryViewer({ id, onClose, onEdit, onNavigate }: { id: string; onClose: () => void; onEdit: (e: DiaryEntry) => void; onNavigate: (id: string) => void }) {
  const { data, remove, releaseImages } = useData();
  const confirm = useConfirm();
  const toast = useToast();
  const [photo, setPhoto] = useState<string | null>(null);
  useBackToClose(true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const all = sortDiaries(data.diaries);
  const idx = all.findIndex((d) => d.id === id);
  const entry = all[idx];
  const newer = idx > 0 ? all[idx - 1] : null;
  const older = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' && older) onNavigate(older.id);
      if (e.key === 'ArrowRight' && newer) onNavigate(newer.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [older, newer, onNavigate]);

  if (!entry) return null;
  const spent = data.ledger.filter((l) => l.date === entry.date && l.type === 'expense').reduce((s, l) => s + l.amount, 0);

  const del = async () => {
    if (!(await confirm({ title: '이 일기를 삭제할까요?', message: '사진과 스티커 배치도 함께 삭제되며 되돌릴 수 없어요.', confirmLabel: '삭제', danger: true }))) return;
    remove('diaries', entry.id);
    releaseImages(Array.from(collectAssetRefs(entry)), { col: 'diaries', id: entry.id });
    toast('일기를 삭제했어요.');
    onClose();
  };

  return (
    <div className="animate-fade fixed inset-0 z-50 flex flex-col bg-paper" role="dialog" aria-modal="true" aria-label="일기 보기">
      <div className="safe-top flex-none border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-3">
          <IconButton label="닫기" onClick={onClose}>
            <X className="h-5 w-5" />
          </IconButton>
          <IconButton label="이전 일기" disabled={!older} onClick={() => older && onNavigate(older.id)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <IconButton label="다음 일기" disabled={!newer} onClick={() => newer && onNavigate(newer.id)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
          <div className="flex-1" />
          <IconButton label="삭제" onClick={del} className="hover:text-expense">
            <Trash2 className="h-5 w-5" />
          </IconButton>
          <button onClick={() => onEdit(entry)} className="ml-1 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary">
            <Pencil className="h-4 w-4" /> 편집
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[600px] px-3 pb-16 pt-4 sm:px-4 sm:pt-6">
          <DiaryPage entry={entry} onPhotoClick={setPhoto} className="rounded-[20px] shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.18)]" />
          {entry.journal && journalHasContent(entry.journal) && (
            <div className="mt-4">
              <MoodJournalForm value={entry.journal} fontFamily={DIARY_FONTS.find((f) => f.id === entry.font)?.family} />
            </div>
          )}
          {spent > 0 && <p className="mt-3 text-center text-[13px] text-muted">이 날 지출 {won(spent)}</p>}
        </div>
      </div>
      <ImageViewer src={photo} onClose={() => setPhoto(null)} />
    </div>
  );
}
