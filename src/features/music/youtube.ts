// Minimal YouTube IFrame Player API wrapper. Works with youtube.com, youtu.be and
// music.youtube.com links (videos and playlists). No API key needed.

export interface YtLink {
  videoId?: string;
  listId?: string;
}

const ID = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeUrl(input: string): YtLink | null {
  const raw = input.trim();
  if (!raw) return null;
  if (ID.test(raw)) return { videoId: raw };
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  let videoId: string | undefined;
  if (host === 'youtu.be') videoId = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    videoId = url.searchParams.get('v') || undefined;
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/);
    if (!videoId && m) videoId = m[1];
  } else return null;
  if (videoId && !ID.test(videoId)) videoId = undefined;
  const list = url.searchParams.get('list') || undefined;
  // Auto-generated mixes (RD…) and "liked" lists can't be embedded as playlists.
  const listId = list && /^[A-Za-z0-9_-]{10,}$/.test(list) && !/^(RD|LL|WL)/.test(list) ? list : undefined;
  if (!videoId && !listId) return null;
  return { videoId, listId };
}

export function thumbUrl(videoId?: string): string | undefined {
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : undefined;
}

/** Best-effort title lookup (oEmbed, no key). Returns '' when unavailable. */
export async function fetchTitle(link: YtLink): Promise<string> {
  const target = link.videoId ? `https://www.youtube.com/watch?v=${link.videoId}` : `https://www.youtube.com/playlist?list=${link.listId}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(target)}`);
    if (!res.ok) return '';
    const j = (await res.json()) as { title?: string };
    return typeof j.title === 'string' ? j.title : '';
  } catch {
    return '';
  }
}

// ---- IFrame API (typed just enough for what the player uses)

export interface YtPlayer {
  playVideo(): void;
  pauseVideo(): void;
  nextVideo(): void;
  previousVideo(): void;
  seekTo(s: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
  getVideoData(): { title?: string; video_id?: string; author?: string };
  loadVideoById(id: string): void;
  cueVideoById(id: string): void;
  loadPlaylist(opts: { list: string; listType: 'playlist'; index?: number }): void;
  cuePlaylist(opts: { list: string; listType: 'playlist'; index?: number }): void;
  setVolume(v: number): void;
  destroy(): void;
}

interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      width?: number | string;
      height?: number | string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: { data: number; target: YtPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YtPlayer;
}

declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

let apiPromise: Promise<YtNamespace> | null = null;

export function loadYouTubeApi(): Promise<YtNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YtNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      if (window.YT) resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('YouTube 플레이어를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

export function ytErrorMessage(code: number): string {
  if (code === 101 || code === 150 || code === 153) return '이 곡은 다른 사이트에서 재생이 막혀 있어요 (업로더 설정).';
  if (code === 100) return '영상을 찾을 수 없어요 (삭제·비공개).';
  if (code === 2) return '링크가 올바르지 않아요.';
  return '재생 중 오류가 났어요.';
}
