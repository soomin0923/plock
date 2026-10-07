import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { Button, Field, Sheet, Spinner, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { applyStickerFx, makeSticker, type StickerFx, type StickerShape } from '../../lib/image';
import { getDeviceSettings } from '../../lib/deviceSettings';
import { cx, newId, nowIso } from '../../lib/util';

const SHAPES: { id: StickerShape; label: string; hint: string }[] = [
  { id: 'original', label: '원본', hint: '그대로' },
  { id: 'cutout', label: '배경 지우기', hint: '흰 배경 투명하게' },
  { id: 'circle', label: '동그라미', hint: '원형 + 흰 테두리' },
  { id: 'rounded', label: '둥근 네모', hint: '모서리 둥글게' },
];

export const EFFECTS: { id: StickerFx; label: string }[] = [
  { id: 'none', label: '효과 없음' },
  { id: '3d', label: '3D 입체' },
  { id: 'outline', label: '흰 테두리' },
  { id: 'mono', label: '흑백' },
  { id: 'sepia', label: '빈티지' },
  { id: 'pop', label: '팝아트' },
  { id: 'neon', label: '네온' },
];

/** Pick any image from the gallery and turn it into a reusable sticker. */
export function StickerMaker({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (src: string) => void }) {
  const { storeImage, upsert } = useData();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previews, setPreviews] = useState<Partial<Record<StickerShape, { blob: Blob; url: string }>>>({});
  const [shape, setShape] = useState<StickerShape>('original');
  const [fx, setFx] = useState<StickerFx>('none');
  const [fxPreviews, setFxPreviews] = useState<Partial<Record<StickerFx, { blob: Blob; url: string }>>>({});
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setName('');
      setShape('original');
      setFx('none');
    }
  }, [open]);

  // Effect previews for the chosen shape.
  const shapeBlob = previews[shape]?.blob;
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    setFxPreviews({});
    if (!shapeBlob) return;
    (async () => {
      for (const e of EFFECTS) {
        try {
          const blob = await applyStickerFx(shapeBlob, e.id, getDeviceSettings().themeColor);
          const url = e.id === 'none' ? '' : URL.createObjectURL(blob);
          if (url) urls.push(url);
          if (!alive) return;
          setFxPreviews((p) => ({ ...p, [e.id]: { blob, url: url || previews[shape]!.url } }));
        } catch {
          /* skip this effect */
        }
      }
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeBlob]);

  const chosen = fxPreviews[fx] || (fx === 'none' ? previews[shape] : undefined);

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    setPreviews({});
    if (!file) return;
    (async () => {
      for (const s of SHAPES) {
        try {
          const blob = await makeSticker(file, s.id);
          const url = URL.createObjectURL(blob);
          urls.push(url);
          if (!alive) return;
          setPreviews((p) => ({ ...p, [s.id]: { blob, url } }));
        } catch (e) {
          if (s.id === 'original') toast((e as Error).message, 'error');
        }
      }
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [file, toast]);

  const save = async () => {
    const p = chosen;
    if (!p) return;
    setBusy(true);
    try {
      const src = await storeImage(p.blob);
      const now = nowIso();
      upsert('stickers', { id: newId('stk'), name: name.trim() || file?.name.replace(/\.[^.]+$/, '') || '내 스티커', src, createdAt: now, updatedAt: now });
      toast('스티커를 만들었어요.');
      onCreated?.(src);
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="내 스티커 만들기">
      {!file ? (
        <button onClick={() => input.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong px-4 py-10 text-muted hover:border-primary hover:text-primary">
          <ImagePlus className="h-8 w-8" />
          <span className="font-semibold">갤러리에서 이미지 고르기</span>
          <span className="text-[13px]">사진, 그림, 캡처 무엇이든 스티커가 돼요</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="checker flex h-48 items-center justify-center rounded-2xl" style={{ backgroundImage: 'repeating-conic-gradient(#f1ece5 0% 25%, #fff 0% 50%)', backgroundSize: '20px 20px' }}>
            {chosen ? <img src={chosen.url} alt="미리보기" className="max-h-44 max-w-[80%] object-contain" /> : <Spinner className="text-primary" />}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {SHAPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setShape(s.id)}
                className={cx('flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition', shape === s.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-hover')}
              >
                <span className="flex h-12 w-12 items-center justify-center">
                  {previews[s.id] ? <img src={previews[s.id]!.url} alt="" className="max-h-12 max-w-12 object-contain" /> : <Spinner className="text-faint" />}
                </span>
                <span className="text-[12px] font-semibold leading-tight">{s.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted">{SHAPES.find((s) => s.id === shape)?.hint}</p>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">효과</p>
            <div className="drag-scroll no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="스티커 효과">
              {EFFECTS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={fx === e.id}
                  onClick={() => setFx(e.id)}
                  className={cx('flex w-[72px] flex-none flex-col items-center gap-1 rounded-xl border p-2 text-center transition', fx === e.id ? 'border-primary bg-primary-soft' : 'border-line hover:bg-hover')}
                >
                  <span className="flex h-12 w-12 items-center justify-center">
                    {fxPreviews[e.id] ? <img src={fxPreviews[e.id]!.url} alt="" className="max-h-12 max-w-12 object-contain" /> : <Spinner className="text-faint" />}
                  </span>
                  <span className="text-[12px] font-semibold leading-tight">{e.label}</span>
                </button>
              ))}
            </div>
          </div>
          <Field label="이름 (선택)">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 우리 강아지" />
          </Field>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => input.current?.click()}>
              다른 이미지
            </Button>
            <Button className="flex-1" variant="primary" disabled={!chosen || busy} onClick={save}>
              {busy ? <Spinner /> : onCreated ? '만들고 붙이기' : '만들기'}
            </Button>
          </div>
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          e.target.value = '';
        }}
      />
    </Sheet>
  );
}
