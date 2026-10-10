import React, { useLayoutEffect, useRef, useState } from 'react';
import { RotateCw, Sticker as StickerIcon, X } from 'lucide-react';
import type { DiaryEntry, StickerPlacement } from '../../types';
import { useImageUrl } from '../../components/AssetImage';
import { DIARY_FONTS, MOODS, WEATHERS } from '../../data/defaults';
import { parseYmd, WEEKDAYS_KR } from '../../lib/date';
import { clamp, cx } from '../../lib/util';

export function diaryDateLabel(date: string) {
  const d = parseYmd(date);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KR[d.getDay()]}요일`;
}

interface DiaryPageProps {
  entry: DiaryEntry;
  editable?: boolean;
  onChange?: (patch: Partial<DiaryEntry>) => void;
  selectedSticker?: string | null;
  onSelectSticker?: (id: string | null) => void;
  onPhotoClick?: (ref: string) => void;
  onPhotoToSticker?: (ref: string) => void;
  pageRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  thumbnail?: boolean;
}

export function DiaryPage({
  entry,
  editable = false,
  onChange,
  selectedSticker = null,
  onSelectSticker,
  onPhotoClick,
  onPhotoToSticker,
  pageRef: externalRef,
  className,
  thumbnail,
}: DiaryPageProps) {
  const ownRef = useRef<HTMLDivElement>(null);
  const pageRef = externalRef || ownRef;
  const font = DIARY_FONTS.find((f) => f.id === entry.font) || DIARY_FONTS[0];
  const mood = MOODS.find((m) => m.id === entry.mood);
  const weather = WEATHERS.find((w) => w.id === entry.weather);

  // Grow the page so stickers placed below the text are never cut off.
  const stickerBottom = entry.stickers.reduce((m, s) => Math.max(m, s.y + s.size * 0.7), 0);

  return (
    <div
      ref={pageRef}
      className={cx('diary-page overflow-hidden', `paper-${entry.paper}`, `diary-font-${entry.font}`, className)}
      style={{ fontFamily: font.family, minHeight: stickerBottom ? `${stickerBottom + 4}cqw` : undefined }}
      onPointerDown={editable ? () => onSelectSticker?.(null) : undefined}
    >
      <div className="diary-inner">
        <div className="diary-meta mb-[2.4cqw] flex flex-wrap items-center gap-x-[2cqw] text-ink-soft" style={{ fontFamily: DIARY_FONTS[0].family }}>
          <span>{diaryDateLabel(entry.date)}</span>
          {weather && <span>{weather.emoji} {weather.label}</span>}
          {mood && (
            <span className="rounded-full px-[2cqw] py-[0.5cqw]" style={{ background: `${mood.color}26`, color: mood.color }}>
              {mood.emoji} {mood.label}
            </span>
          )}
        </div>

        {editable ? (
          <AutoTextarea
            value={entry.title}
            onChange={(v) => onChange?.({ title: v.replace(/\n/g, ' ') })}
            placeholder="제목"
            className="diary-title mb-[3cqw]"
            singleLine
            pageRef={pageRef}
          />
        ) : (
          entry.title && <h1 className="diary-title mb-[3cqw] break-keep">{entry.title}</h1>
        )}

        {editable ? (
          <AutoTextarea value={entry.content} onChange={(v) => onChange?.({ content: v })} placeholder="오늘 하루는 어땠나요?" className="diary-body" pageRef={pageRef} />
        ) : (
          <div className="diary-body">{thumbnail ? entry.content.slice(0, 600) : entry.content}</div>
        )}

        {entry.photos.length > 0 && (
          <div className={cx('diary-photos', entry.photos.length === 1 ? 'grid-cols-1' : entry.photos.length === 2 || entry.photos.length === 4 ? 'grid-cols-2' : 'grid-cols-3')}>
            {entry.photos.map((ref) => (
              <PagePhoto
                key={ref}
                src={ref}
                single={entry.photos.length === 1}
                editable={editable}
                onClick={() => onPhotoClick?.(ref)}
                onRemove={() => onChange?.({ photos: entry.photos.filter((p) => p !== ref) })}
                onToSticker={onPhotoToSticker ? () => onPhotoToSticker(ref) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <StickerLayer
        stickers={entry.stickers}
        editable={editable}
        selected={selectedSticker}
        onSelect={(id) => onSelectSticker?.(id)}
        onChange={(stickers) => onChange?.({ stickers })}
        pageRef={pageRef}
      />
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  singleLine,
  pageRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  singleLine?: boolean;
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(resize, [value]);
  useLayoutEffect(() => {
    // Font sizes follow the page width, so re-measure when the page is resized.
    const page = pageRef.current;
    if (!page || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(resize);
    ro.observe(page);
    return () => ro.disconnect();
  }, [pageRef]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={singleLine ? (e) => e.key === 'Enter' && e.preventDefault() : undefined}
      className={cx('block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none', className)}
    />
  );
}

function PagePhoto({ src, single, editable, onClick, onRemove, onToSticker }: { src: string; single: boolean; editable: boolean; onClick: () => void; onRemove: () => void; onToSticker?: () => void }) {
  const url = useImageUrl(src);
  return (
    <div className={cx('relative bg-black/5', !single && 'aspect-square')} onClick={editable ? undefined : onClick}>
      {url ? (
        <img src={url} alt="" draggable={false} className={cx('block w-full', single ? 'h-auto max-h-[140cqw] object-contain' : 'h-full object-cover', !editable && 'cursor-zoom-in')} />
      ) : (
        <div className={cx('w-full', single ? 'aspect-[4/3]' : 'h-full', url === undefined && 'animate-pulse')} />
      )}
      {editable && (
        <div className="absolute right-1.5 top-1.5 flex gap-1.5">
          {onToSticker && (
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onToSticker} className="flex h-8 items-center gap-1 rounded-full bg-black/60 px-2.5 text-xs font-semibold text-white backdrop-blur" title="스티커처럼 자유롭게 배치">
              <StickerIcon className="h-3.5 w-3.5" /> 스티커로
            </button>
          )}
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onRemove} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur" aria-label="사진 빼기">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ stickers

type Gesture =
  | { kind: 'move'; id: string; startX: number; startY: number; x: number; y: number; unit: number }
  | { kind: 'transform'; id: string; cx: number; cy: number; dist: number; angle: number; size: number; rotation: number };

export function StickerLayer({
  stickers,
  editable,
  selected,
  onSelect,
  onChange,
  pageRef,
}: {
  stickers: StickerPlacement[];
  editable: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (next: StickerPlacement[]) => void;
  pageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const gesture = useRef<Gesture | null>(null);
  const [live, setLive] = useState<{ id: string; patch: Partial<StickerPlacement> } | null>(null);

  if (!stickers.length) return null;

  const begin = (e: React.PointerEvent, s: StickerPlacement, kind: 'move' | 'transform') => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect(s.id);
    const page = pageRef.current;
    if (!page) return;
    const rect = page.getBoundingClientRect();
    const unit = rect.width / 100;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    if (kind === 'move') {
      gesture.current = { kind, id: s.id, startX: e.clientX, startY: e.clientY, x: s.x, y: s.y, unit };
    } else {
      const cx = rect.left + s.x * unit;
      const cy = rect.top + s.y * unit;
      gesture.current = {
        kind,
        id: s.id,
        cx,
        cy,
        dist: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy)),
        angle: Math.atan2(e.clientY - cy, e.clientX - cx),
        size: s.size,
        rotation: s.rotation,
      };
    }
  };

  const move = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    e.preventDefault();
    if (g.kind === 'move') {
      setLive({ id: g.id, patch: { x: clamp(g.x + (e.clientX - g.startX) / g.unit, 0, 100), y: Math.max(0, g.y + (e.clientY - g.startY) / g.unit) } });
    } else {
      const dist = Math.hypot(e.clientX - g.cx, e.clientY - g.cy);
      const angle = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      let rotation = g.rotation + ((angle - g.angle) * 180) / Math.PI;
      rotation = ((rotation % 360) + 540) % 360 - 180;
      if (Math.abs(rotation) < 4) rotation = 0; // snap upright
      setLive({ id: g.id, patch: { size: clamp((g.size * dist) / g.dist, 5, 95), rotation: Math.round(rotation * 10) / 10 } });
    }
  };

  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g && live && live.id === g.id) {
      const round = (n: number) => Math.round(n * 100) / 100;
      onChange(
        stickers.map((s) =>
          s.id === live.id
            ? {
                ...s,
                ...Object.fromEntries(Object.entries(live.patch).map(([k, v]) => [k, typeof v === 'number' ? round(v) : v])),
              }
            : s,
        ),
      );
    }
    setLive(null);
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      {stickers.map((base) => {
        const s = live?.id === base.id ? { ...base, ...live.patch } : base;
        const isSel = editable && selected === s.id;
        return (
          <div
            key={s.id}
            className={cx('sticker', editable ? 'pointer-events-auto cursor-grab active:cursor-grabbing' : 'pointer-events-none', isSel && 'sticker-selected')}
            style={{
              left: `${s.x}cqw`,
              top: `${s.y}cqw`,
              width: `${s.size}cqw`,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg)`,
              zIndex: 10 + s.z,
            }}
            onPointerDown={(e) => begin(e, s, 'move')}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            data-sticker={s.id}
          >
            <span className={cx('sticker-fx', s.effect && `fx-${s.effect}`)}>
              {s.kind === 'emoji' ? (
                <span className="sticker-emoji" style={{ fontSize: `${s.size * 0.86}cqw` }}>
                  {s.value}
                </span>
              ) : (
                <StickerImage src={s.value} />
              )}
            </span>
            {isSel && (
              <span
                className="sticker-handle -bottom-[18px] -right-[18px] cursor-nwse-resize"
                onPointerDown={(e) => begin(e, s, 'transform')}
                onPointerMove={move}
                onPointerUp={end}
                onPointerCancel={end}
                role="slider"
                aria-label="크기·회전 조절"
                aria-valuenow={Math.round(s.size)}
                data-handle
              >
                <RotateCw className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StickerImage({ src }: { src: string }) {
  const url = useImageUrl(src);
  if (!url) return <span className="block aspect-square w-full rounded-lg bg-black/5" />;
  return <img src={url} alt="" draggable={false} />;
}
