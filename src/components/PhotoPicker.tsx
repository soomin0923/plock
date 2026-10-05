import React, { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useToast } from './Toast';
import { AssetImage, ImageViewer } from './AssetImage';
import { Spinner } from './ui';
import { PHOTO_PRESET, type ImagePreset } from '../lib/image';
import { cx } from '../lib/util';

/** Thumbnails + "add photo" tile. Images are compressed and stored as assets on pick. */
export function PhotoPicker({
  value,
  onChange,
  max = 8,
  preset = PHOTO_PRESET,
  onAdded,
  label = '사진 추가',
  className,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  preset?: ImagePreset;
  onAdded?: (refs: string[]) => void;
  label?: string;
  className?: string;
}) {
  const { saveImage } = useData();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);

  const pick = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, Math.max(0, max - value.length));
    if (list.length < files.length) toast(`사진은 최대 ${max}장까지 넣을 수 있어요.`, 'info');
    setBusy(list.length);
    const added: string[] = [];
    for (const f of list) {
      try {
        added.push(await saveImage(f, preset));
      } catch (e) {
        toast((e as Error).message, 'error');
      }
      setBusy((b) => b - 1);
    }
    if (added.length) {
      onChange([...value, ...added]);
      onAdded?.(added);
    }
  };

  return (
    <div className={cx('flex flex-wrap gap-2', className)}>
      {value.map((ref) => (
        <div key={ref} className="relative h-20 w-20">
          <AssetImage src={ref} className="h-20 w-20 overflow-hidden rounded-xl border border-line" onClick={() => setViewing(ref)} />
          <button
            type="button"
            onClick={() => onChange(value.filter((r) => r !== ref))}
            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow"
            aria-label="사진 빼기"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      {Array.from({ length: busy }).map((_, i) => (
        <div key={`busy${i}`} className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-line-strong text-muted">
          <Spinner />
        </div>
      ))}
      {value.length + busy < max && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs font-medium text-muted transition hover:border-primary hover:text-primary"
        >
          <ImagePlus className="h-5 w-5" />
          {label}
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={max - value.length > 1}
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      <ImageViewer src={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}
