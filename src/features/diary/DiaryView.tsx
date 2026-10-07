import React, { useMemo, useState } from 'react';
import { BookHeart, CalendarDays, LayoutGrid, PenLine, Search, X } from 'lucide-react';
import type { DiaryEntry } from '../../types';
import { useData } from '../../data/DataProvider';
import { PageHeader } from '../../app/Shell';
import { useIntent } from '../../app/router';
import { Button, Card, EmptyState, Segmented } from '../../components/ui';
import { MonthGrid, MonthNav } from '../../components/MonthGrid';
import { MOODS } from '../../data/defaults';
import { addDays, addMonths, formatKoreanDate, monthKey, today } from '../../lib/date';
import { cx } from '../../lib/util';
import { DiaryPage } from './DiaryPage';
import { journalText } from './MoodJournal';
import { DiaryViewer, sortDiaries } from './DiaryViewer';
import { blankDiary, DiaryEditor } from './DiaryEditor';

type Overlay = { kind: 'view'; id: string } | { kind: 'edit'; entry: DiaryEntry; isNew: boolean } | null;

export function DiaryView() {
  const { data, prefs } = useData();
  const [month, setMonth] = useState(today());
  const [mode, setMode] = useState<'grid' | 'calendar'>('grid');
  const [query, setQuery] = useState('');
  const [overlay, setOverlay] = useState<Overlay>(null);

  const write = (date: string) => setOverlay({ kind: 'edit', entry: blankDiary(date), isNew: true });

  useIntent((i) => {
    if (i.type === 'diary-write') {
      const existing = sortDiaries(data.diaries).find((d) => d.date === i.date);
      setMonth(i.date);
      if (existing) setOverlay({ kind: 'view', id: existing.id });
      else write(i.date);
    }
    if (i.type === 'diary-open') setOverlay({ kind: 'view', id: i.id });
  });

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    const all = sortDiaries(data.diaries);
    if (q) return all.filter((d) => `${d.title}\n${d.content}\n${journalText(d.journal)}`.toLowerCase().includes(q));
    return all.filter((d) => monthKey(d.date) === monthKey(month));
  }, [data.diaries, q, month]);

  const byDate = useMemo(() => {
    const m = new Map<string, DiaryEntry[]>();
    sortDiaries(data.diaries).forEach((d) => m.set(d.date, [...(m.get(d.date) || []), d]));
    return m;
  }, [data.diaries]);

  const streakDays = useMemo(() => {
    let n = 0;
    for (let d = today(); byDate.has(d); d = addDays(d, -1)) n++;
    return n;
  }, [byDate]);

  return (
    <div>
      <PageHeader
        title="다이어리"
        subtitle={`지금까지 ${data.diaries.length}편${streakDays > 1 ? ` · ${streakDays}일 연속 기록 중 🔥` : ''}`}
        actions={
          <Button variant="primary" icon={<PenLine className="h-4 w-4" />} onClick={() => write(today())}>
            일기 쓰기
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-card px-3">
          <Search className="h-4 w-4 flex-none text-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="일기 검색" className="h-10 min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none" aria-label="일기 검색" />
          {query && (
            <button onClick={() => setQuery('')} aria-label="검색어 지우기" className="text-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Segmented<'grid' | 'calendar'>
          value={mode}
          onChange={setMode}
          options={[
            { value: 'grid', label: <LayoutGrid className="mx-auto h-4 w-4" aria-label="모아보기" /> },
            { value: 'calendar', label: <CalendarDays className="mx-auto h-4 w-4" aria-label="달력" /> },
          ]}
        />
      </div>

      {!q && <MonthNav month={month} onPrev={() => setMonth(addMonths(month, -1))} onNext={() => setMonth(addMonths(month, 1))} onToday={() => setMonth(today())} />}
      {q && <p className="mb-3 text-sm text-muted">'{query}' 검색 결과 {list.length}편</p>}

      {mode === 'calendar' && !q && (
        <Card className="mb-4 p-3 sm:p-4">
          <MonthGrid
            month={month}
            onSelect={(d) => {
              const found = byDate.get(d);
              if (found?.length) setOverlay({ kind: 'view', id: found[0].id });
              else if (d <= today()) write(d);
            }}
            weekStartsOn={prefs.weekStartsOn}
            cellMinHeight="min-h-[58px] sm:min-h-[76px]"
            renderCell={({ date }) => {
              const e = byDate.get(date)?.[0];
              if (!e) return null;
              const mood = MOODS.find((m) => m.id === e.mood);
              return <span className="mx-auto text-xl leading-none sm:text-2xl">{mood?.emoji || '📝'}</span>;
            }}
          />
        </Card>
      )}

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookHeart className="h-10 w-10" />}
            title={q ? '검색 결과가 없어요' : '이 달의 일기가 없어요'}
            description={q ? undefined : '사진과 스티커로 오늘을 꾸며 보세요.'}
            action={!q && <Button variant="primary" onClick={() => write(monthKey(month) === monthKey(today()) ? today() : month)}>일기 쓰기</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((d) => (
            <DiaryCard key={d.id} entry={d} onClick={() => setOverlay({ kind: 'view', id: d.id })} />
          ))}
        </div>
      )}

      {overlay?.kind === 'view' && (
        <DiaryViewer
          id={overlay.id}
          onClose={() => setOverlay(null)}
          onEdit={(entry) => setOverlay({ kind: 'edit', entry, isNew: false })}
          onNavigate={(id) => setOverlay({ kind: 'view', id })}
        />
      )}
      {overlay?.kind === 'edit' && (
        <DiaryEditor
          key={overlay.entry.id}
          initial={overlay.entry}
          isNew={overlay.isNew}
          onClose={() => setOverlay(null)}
          onSaved={(e) => setMonth(e.date)}
        />
      )}
    </div>
  );
}

function DiaryCard({ entry, onClick }: { entry: DiaryEntry; onClick: () => void }) {
  const mood = MOODS.find((m) => m.id === entry.mood);
  return (
    <button onClick={onClick} className="group text-left">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line shadow-card transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        {/* A real, scaled-down render of the page: what you decorated is what you see. */}
        <DiaryPage entry={entry} thumbnail className="pointer-events-none min-h-full" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white/90 to-transparent" />
      </div>
      <div className="mt-2 px-0.5">
        <p className="flex items-center gap-1 text-[12px] text-muted">
          {mood && <span>{mood.emoji}</span>}
          {formatKoreanDate(entry.date)}
        </p>
        <p className={cx('truncate text-[14px] font-semibold', !entry.title && 'text-muted')}>{entry.title || '제목 없음'}</p>
      </div>
    </button>
  );
}
