import React, { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { Button, Checkbox, Sheet } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { exportIcs, parseIcs, type IcsItem } from '../../lib/ical';
import { downloadBlob, readFileAsText } from '../../lib/util';
import { formatKoreanDate, today } from '../../lib/date';
import { blankEvent, blankTask } from './forms';
import { sortCategories } from './helpers';
import { eventKey, taskKey } from './dedupe';

export function IcsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, upsert } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<(IcsItem & { pick: boolean; dup: boolean })[] | null>(null);

  const doExport = () => {
    const text = exportIcs(data.events, data.tasks, data.categories);
    downloadBlob(new Blob([text], { type: 'text/calendar;charset=utf-8' }), `plock_${today()}.ics`);
    toast('캘린더 파일을 내려받았어요. 구글 캘린더 > 설정 > 가져오기에서 올리면 돼요.');
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try {
      const parsed = parseIcs(await readFileAsText(f));
      // Already in Plock, or repeated inside the same file: unticked, so importing twice adds nothing.
      const seen = new Set([...data.events.map(eventKey), ...data.tasks.map(taskKey)]);
      setItems(
        parsed.map((p) => {
          const key = p.kind === 'task' ? taskKey({ title: p.title, dueDate: p.startDate, dueTime: p.startTime }) : eventKey(p);
          const dup = seen.has(key);
          seen.add(key);
          return { ...p, dup, pick: !dup };
        }),
      );
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const doImport = () => {
    if (!items) return;
    const picked = items.filter((i) => i.pick);
    const cats = sortCategories(data.categories);
    const catFor = (name?: string) => cats.find((c) => c.name === name)?.id || cats[0]?.id || 'cat_etc';
    upsert(
      'events',
      picked.filter((p) => p.kind === 'event').map((p) =>
        blankEvent(p.startDate, cats, { title: p.title, endDate: p.endDate, startTime: p.startTime, endTime: p.endTime, location: p.location, memo: p.memo, categoryId: catFor(p.category) }),
      ),
    );
    upsert(
      'tasks',
      picked.filter((p) => p.kind === 'task').map((p) => blankTask({ title: p.title, dueDate: p.startDate, dueTime: p.startTime, memo: p.memo, done: !!p.done })),
    );
    toast(`${picked.length}개를 가져왔어요.`);
    setItems(null);
    onClose();
  };

  return (
    <Sheet open={open} onClose={() => (setItems(null), onClose())} title="캘린더 파일 (.ics)">
      {!items ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted">구글 캘린더·애플 캘린더·아웃룩과 일정을 주고받을 수 있어요.</p>
          <button onClick={doExport} className="flex w-full items-center gap-3 rounded-2xl border border-line p-4 text-left hover:bg-hover">
            <Download className="h-6 w-6 text-primary" />
            <span>
              <span className="block font-semibold">내보내기</span>
              <span className="text-[13px] text-muted">일정 {data.events.length}개 · 기한 있는 할 일 {data.tasks.filter((t) => t.dueDate).length}개를 .ics 파일로 저장</span>
            </span>
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-2xl border border-line p-4 text-left hover:bg-hover">
            <Upload className="h-6 w-6 text-primary" />
            <span>
              <span className="block font-semibold">가져오기</span>
              <span className="text-[13px] text-muted">구글 캘린더 설정 &gt; 내보내기로 받은 .ics 파일 선택</span>
            </span>
          </button>
          <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden" onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ''))} />
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-muted">
              {items.length}개 발견 · {items.filter((i) => i.pick).length}개 선택
              {items.some((i) => i.dup) && ` · 이미 있는 ${items.filter((i) => i.dup).length}개는 제외`}
            </span>
            <button className="font-semibold text-primary" onClick={() => setItems(items.map((i) => ({ ...i, pick: !items.every((x) => x.pick) })))}>
              {items.every((x) => x.pick) ? '모두 해제' : '모두 선택'}
            </button>
          </div>
          <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
            {items.map((it, idx) => (
              <label key={it.uid + idx} className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-hover">
                <Checkbox size={20} checked={it.pick} label={it.title} onChange={() => setItems(items.map((x, i) => (i === idx ? { ...x, pick: !x.pick } : x)))} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{it.kind === 'task' ? '☑️ ' : ''}{it.title}</span>
                  <span className="text-[13px] text-muted">
                    {formatKoreanDate(it.startDate, { year: true })}
                    {it.endDate !== it.startDate && ` ~ ${formatKoreanDate(it.endDate)}`}
                    {it.startTime && ` ${it.startTime}`}
                    {it.dup && ' · 이미 있음'}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" onClick={() => setItems(null)}>
              뒤로
            </Button>
            <Button className="flex-1" variant="primary" disabled={!items.some((i) => i.pick)} onClick={doImport}>
              가져오기
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
