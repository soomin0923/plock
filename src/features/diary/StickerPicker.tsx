import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useData } from '../../data/DataProvider';
import { AssetImage } from '../../components/AssetImage';
import { Segmented, useConfirm } from '../../components/ui';
import { EMOJI_STICKERS } from '../../data/defaults';
import { cx } from '../../lib/util';

export function StickerPicker({ onPick, onMake }: { onPick: (kind: 'emoji' | 'image', value: string) => void; onMake: () => void }) {
  const { data, remove, releaseImages } = useData();
  const confirm = useConfirm();
  const [tab, setTab] = useState<'mine' | string>(data.stickers.length ? 'mine' : EMOJI_STICKERS[0].group);
  const [manage, setManage] = useState(false);
  const mine = [...data.stickers].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <div className="no-scrollbar -mx-1 mb-3 overflow-x-auto px-1">
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[{ value: 'mine', label: `내 스티커 ${mine.length || ''}` }, ...EMOJI_STICKERS.map((g) => ({ value: g.group, label: g.group }))]}
        />
      </div>
      {tab === 'mine' ? (
        <div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button onClick={onMake} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line-strong text-[12px] font-semibold text-muted hover:border-primary hover:text-primary">
              <Plus className="h-5 w-5" />
              만들기
            </button>
            {mine.map((s) => (
              <div key={s.id} className="relative">
                <button
                  onClick={() => !manage && onPick('image', s.src)}
                  title={s.name}
                  className={cx('flex aspect-square w-full items-center justify-center rounded-2xl bg-hover/70 p-1.5 transition hover:bg-hover', manage && 'opacity-60')}
                >
                  <AssetImage src={s.src} className="h-full w-full" imgClassName="object-contain" />
                </button>
                {manage && (
                  <button
                    onClick={async () => {
                      if (!(await confirm({ title: '스티커를 보관함에서 지울까요?', message: '이미 붙인 일기에서는 지워지지 않아요.', confirmLabel: '지우기', danger: true }))) return;
                      remove('stickers', s.id);
                      releaseImages([s.src], { col: 'stickers', id: s.id });
                    }}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-expense text-white shadow"
                    aria-label={`${s.name} 지우기`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {mine.length === 0 ? (
            <p className="mt-3 text-[13px] text-muted">갤러리 사진이나 그림으로 나만의 스티커를 만들어 보세요. 한 번 만들면 계속 쓸 수 있어요.</p>
          ) : (
            <button onClick={() => setManage((m) => !m)} className="mt-3 text-[13px] font-semibold text-muted hover:text-ink">
              {manage ? '완료' : '스티커 정리'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-8 gap-1">
          {EMOJI_STICKERS.find((g) => g.group === tab)?.items.map((em) => (
            <button key={em} onClick={() => onPick('emoji', em)} className="flex aspect-square items-center justify-center rounded-xl text-[28px] transition hover:bg-hover active:scale-90">
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
