import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { cx } from '../lib/util';

/** Renders an image ref (`asset:` stored image, or a plain URL). */
export function AssetImage({
  src,
  alt = '',
  className,
  imgClassName,
  onClick,
  draggable = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
  draggable?: boolean;
}) {
  const url = useImageUrl(src);
  if (url === undefined) return <div className={cx('animate-pulse bg-hover', className)} />;
  if (url === null)
    return (
      <div className={cx('flex items-center justify-center bg-hover text-faint', className)} title="이미지를 불러오지 못했습니다">
        <ImageOff className="h-1/3 max-h-6 w-1/3 max-w-6" />
      </div>
    );
  return (
    <div className={className} onClick={onClick}>
      <img src={url} alt={alt} draggable={draggable} className={cx('h-full w-full object-cover', imgClassName)} />
    </div>
  );
}

/** undefined = loading, null = missing */
export function useImageUrl(src: string | undefined): string | null | undefined {
  const { loadImageUrl } = useData();
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    let alive = true;
    setUrl(undefined);
    loadImageUrl(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src, loadImageUrl]);
  return url;
}

export function ImageViewer({ src, onClose }: { src: string | null; onClose: () => void }) {
  const url = useImageUrl(src || undefined);
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);
  if (!src) return null;
  return (
    <div className="animate-fade fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4" onClick={onClose} role="dialog" aria-label="사진 보기">
      {url ? <img src={url} alt="" className="max-h-full max-w-full rounded-lg object-contain" /> : <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />}
    </div>
  );
}
