// Client-side image compression.
// Phone photos are 3–12MB; storing them raw blew past localStorage (5MB) and the Firestore
// document limit (1MiB) in the old version, so saves silently failed. Every image is now
// resized and re-encoded before it is stored.

export interface ImagePreset {
  maxSize: number; // longest edge in px
  maxBytes: number;
  keepAlpha?: boolean;
}

export const PHOTO_PRESET: ImagePreset = { maxSize: 1600, maxBytes: 650_000 };
export const STICKER_PRESET: ImagePreset = { maxSize: 640, maxBytes: 350_000, keepAlpha: true };
export const RECEIPT_PRESET: ImagePreset = { maxSize: 1400, maxBytes: 550_000 };

let webpSupport: boolean | null = null;
function canEncodeWebp(): boolean {
  if (webpSupport === null) {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      webpSupport = false;
    }
  }
  return webpSupport;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw new Error('이미지를 열 수 없습니다. JPG, PNG, WEBP 형식인지 확인해 주세요.');
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환 실패'))), type, quality);
  });
}

export async function compressImage(file: Blob, preset: ImagePreset): Promise<Blob> {
  const img = await decode(file);
  try {
    let scale = Math.min(1, preset.maxSize / Math.max(img.width, img.height));
    const type = canEncodeWebp() ? 'image/webp' : preset.keepAlpha ? 'image/png' : 'image/jpeg';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('이미지 처리를 지원하지 않는 브라우저입니다.');

    for (let attempt = 0; attempt < 8; attempt++) {
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!preset.keepAlpha && type === 'image/jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);

      if (type === 'image/png') {
        const blob = await toBlob(canvas, type);
        if (blob.size <= preset.maxBytes) return blob;
      } else {
        for (const q of [0.86, 0.76, 0.66, 0.56]) {
          const blob = await toBlob(canvas, type, q);
          if (blob.size <= preset.maxBytes) return blob;
        }
      }
      scale *= 0.75;
    }
    throw new Error('이미지가 너무 커서 저장할 수 없습니다.');
  } finally {
    img.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const url = await blobToDataUrl(blob);
  return url.slice(url.indexOf(',') + 1);
}

// ------------------------------------------------------------------ custom stickers

export type StickerShape = 'original' | 'cutout' | 'circle' | 'rounded';

/**
 * Turn any picture into a sticker:
 *  - original: as is (transparency kept)
 *  - cutout:   near-white background made transparent (drawings, screenshots, product shots)
 *  - circle / rounded: cropped with a white die-cut border
 */
export async function makeSticker(file: Blob, shape: StickerShape): Promise<Blob> {
  const img = await decode(file);
  try {
    const max = STICKER_PRESET.maxSize;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: shape === 'cutout' });
    if (!ctx) throw new Error('이미지 처리를 지원하지 않는 브라우저입니다.');

    if (shape === 'circle' || shape === 'rounded') {
      const side = Math.min(max, Math.min(img.width, img.height));
      canvas.width = canvas.height = side;
      const border = Math.round(side * 0.04);
      const r = shape === 'circle' ? side / 2 : side * 0.18;
      const path = (inset: number) => {
        const s = side - inset * 2;
        const rr = Math.max(0, r - inset);
        ctx.beginPath();
        if (shape === 'circle') ctx.arc(side / 2, side / 2, s / 2, 0, Math.PI * 2);
        else ctx.roundRect(inset, inset, s, s, rr);
        ctx.closePath();
      };
      path(0);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.save();
      path(border);
      ctx.clip();
      const scale = (side - border * 2) / Math.min(img.width, img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img.source, (side - w) / 2, (side - h) / 2, w, h);
      ctx.restore();
    } else {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img.source, 0, 0, canvas.width, canvas.height);
      if (shape === 'cutout') removeLightBackground(ctx, canvas.width, canvas.height);
    }
    return await compressCanvas(canvas, STICKER_PRESET);
  } finally {
    img.close();
  }
}

// ------------------------------------------------------------------ sticker effects (baked into the image)

export type StickerFx = 'none' | 'mono' | 'sepia' | 'pop' | 'outline' | '3d' | 'neon';

/**
 * Apply an effect to a finished sticker image. Pixel work is done by hand (no ctx.filter)
 * so it looks the same in Safari.
 */
export async function applyStickerFx(blob: Blob, fx: StickerFx, accent = '#C1876B'): Promise<Blob> {
  if (fx === 'none') return blob;
  const img = await decode(blob);
  try {
    const w = img.width;
    const h = img.height;
    const pad = fx === 'outline' || fx === '3d' || fx === 'neon' ? Math.round(Math.max(w, h) * 0.07) : 0;
    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('이미지 처리를 지원하지 않는 브라우저입니다.');

    // Color effects
    const base = document.createElement('canvas');
    base.width = w;
    base.height = h;
    const bctx = base.getContext('2d', { willReadFrequently: true })!;
    bctx.drawImage(img.source, 0, 0, w, h);
    if (fx === 'mono' || fx === 'sepia' || fx === 'pop') {
      const d = bctx.getImageData(0, 0, w, h);
      const px = d.data;
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if (fx === 'mono') {
          const y = 0.299 * r + 0.587 * g + 0.114 * b;
          const c = Math.max(0, Math.min(255, (y - 128) * 1.12 + 128));
          px[i] = px[i + 1] = px[i + 2] = c;
        } else if (fx === 'sepia') {
          px[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
          px[i + 1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
          px[i + 2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
        } else {
          // pop art: boost saturation, then posterize to 5 levels
          const avg = (r + g + b) / 3;
          const sat = (v: number) => Math.max(0, Math.min(255, avg + (v - avg) * 1.9));
          const post = (v: number) => Math.round(sat(v) / 63.75) * 63.75;
          px[i] = post(r);
          px[i + 1] = post(g);
          px[i + 2] = post(b);
        }
      }
      bctx.putImageData(d, 0, 0);
    }

    // Shape effects: a silhouette ring around the sticker
    if (pad) {
      const ring = Math.max(2, Math.round(pad * (fx === 'neon' ? 0.45 : 0.6)));
      const sil = document.createElement('canvas');
      sil.width = canvas.width;
      sil.height = canvas.height;
      const sctx = sil.getContext('2d')!;
      const steps = 24;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        sctx.drawImage(base, pad + Math.cos(a) * ring, pad + Math.sin(a) * ring);
      }
      sctx.globalCompositeOperation = 'source-in';
      sctx.fillStyle = fx === 'neon' ? accent : '#ffffff';
      sctx.fillRect(0, 0, sil.width, sil.height);

      ctx.save();
      if (fx === '3d') {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = pad * 0.5;
        ctx.shadowOffsetX = pad * 0.18;
        ctx.shadowOffsetY = pad * 0.35;
      } else if (fx === 'neon') {
        ctx.shadowColor = accent;
        ctx.shadowBlur = pad * 0.8;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = pad * 0.25;
      }
      ctx.drawImage(sil, 0, 0);
      if (fx === 'neon') ctx.drawImage(sil, 0, 0); // stronger glow
      ctx.restore();
    }
    ctx.drawImage(base, pad, pad);

    if (fx === '3d') {
      // glossy highlight on the upper half + soft shade at the bottom, clipped to the sticker
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const gl = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gl.addColorStop(0, 'rgba(255,255,255,0.45)');
      gl.addColorStop(0.45, 'rgba(255,255,255,0.08)');
      gl.addColorStop(0.5, 'rgba(255,255,255,0)');
      gl.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = gl;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    return await compressCanvas(canvas, STICKER_PRESET);
  } finally {
    img.close();
  }
}

/** Flood-fill from the edges: light pixels connected to the border become transparent. */
function removeLightBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const visited = new Uint8Array(w * h);
  const isLight = (i: number) => {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], a = px[i * 4 + 3];
    if (a < 20) return true;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return min > 205 && max - min < 40;
  };
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (visited[i] || !isLight(i)) continue;
    visited[i] = 1;
    px[i * 4 + 3] = 0;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  // Soften the edge: half-transparent pixels next to removed ones.
  for (let i = 0; i < w * h; i++) {
    if (visited[i]) continue;
    const x = i % w;
    const near = (x > 0 && visited[i - 1]) || (x < w - 1 && visited[i + 1]) || (i >= w && visited[i - w]) || (i < w * (h - 1) && visited[i + w]);
    if (near && isLight(i)) px[i * 4 + 3] = Math.min(px[i * 4 + 3], 110);
  }
  ctx.putImageData(data, 0, 0);
}

async function compressCanvas(canvas: HTMLCanvasElement, preset: ImagePreset): Promise<Blob> {
  const type = canEncodeWebp() ? 'image/webp' : 'image/png';
  let current = canvas;
  for (let attempt = 0; attempt < 6; attempt++) {
    const blob = type === 'image/png' ? await toBlob(current, type) : await toBlob(current, type, 0.9);
    if (blob.size <= preset.maxBytes) return blob;
    const next = document.createElement('canvas');
    next.width = Math.round(current.width * 0.75);
    next.height = Math.round(current.height * 0.75);
    next.getContext('2d')!.drawImage(current, 0, 0, next.width, next.height);
    current = next;
  }
  throw new Error('스티커 이미지가 너무 큽니다.');
}
