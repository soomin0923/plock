import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { MusicTrack } from '../../types';
import { useData } from '../../data/DataProvider';
import { cx } from '../../lib/util';
import { loadYouTubeApi, thumbUrl, YT_STATE, ytErrorMessage, type YtPlayer } from './youtube';

// One YouTube player for the whole app, so music keeps playing while switching tabs.
// The track list lives in the synced prefs (same on every device); what is playing is per device.

export interface MusicApi {
  tracks: MusicTrack[];
  index: number;
  playing: boolean;
  loading: boolean;
  title: string;
  thumb?: string;
  error: string | null;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  playAt: (i: number) => void;
  videoVisible: boolean;
  setVideoVisible: (v: boolean) => void;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

const MusicContext = createContext<MusicApi | null>(null);

export function useMusic(): MusicApi {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error('useMusic outside MusicProvider');
  return ctx;
}

const INDEX_KEY = 'plock_music_index';
export const UNTITLED = '제목 없는 곡';

export function MusicProvider({ children }: { children: React.ReactNode }) {
  const { prefs, savePrefs } = useData();
  const tracks = useMemo(() => prefs.music || [], [prefs.music]);
  const [index, setIndex] = useState(() => Number(localStorage.getItem(INDEX_KEY)) || 0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nowTitle, setNowTitle] = useState('');
  const [nowVideo, setNowVideo] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const host = useRef<HTMLDivElement>(null);
  const player = useRef<YtPlayer | null>(null);
  const playerReady = useRef<Promise<YtPlayer> | null>(null);
  const loadedKey = useRef<string>('');
  const wantPlay = useRef(false);
  const failures = useRef(0);
  const state = useRef({ tracks, index, savePrefs });
  state.current = { tracks, index, savePrefs };

  const safeIndex = tracks.length ? Math.min(Math.max(index, 0), tracks.length - 1) : 0;
  const track = tracks[safeIndex];

  useEffect(() => {
    try {
      localStorage.setItem(INDEX_KEY, String(index));
    } catch {
      /* ignore */
    }
  }, [index]);

  const trackKey = (t?: MusicTrack) => (t ? `${t.videoId || ''}|${t.listId || ''}` : '');

  /** Put track `t` on the player; start it when `play` is set. */
  const load = useCallback((p: YtPlayer, t: MusicTrack, play: boolean) => {
    loadedKey.current = trackKey(t);
    setError(null);
    setNowTitle('');
    setNowVideo(t.videoId);
    if (t.listId) {
      const opts = { list: t.listId, listType: 'playlist' as const, index: 0 };
      if (play) p.loadPlaylist(opts);
      else p.cuePlaylist(opts);
    } else if (t.videoId) {
      if (play) p.loadVideoById(t.videoId);
      else p.cueVideoById(t.videoId);
    }
  }, []);

  const goTo = useCallback((i: number, play: boolean) => {
    const list = state.current.tracks;
    if (!list.length) return;
    const n = ((i % list.length) + list.length) % list.length;
    setIndex(n);
    wantPlay.current = play;
    if (player.current) load(player.current, list[n], play);
  }, [load]);

  const ensurePlayer = useCallback((): Promise<YtPlayer> => {
    if (playerReady.current) return playerReady.current;
    playerReady.current = loadYouTubeApi().then(
      (YT) =>
        new Promise<YtPlayer>((resolve) => {
          const el = document.createElement('div');
          host.current?.appendChild(el);
          new YT.Player(el, {
            width: '100%',
            height: '100%',
            playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
            events: {
              onReady: (e) => {
                player.current = e.target;
                e.target.setVolume(80);
                const { tracks: list, index: i } = state.current;
                if (list.length) load(e.target, list[Math.min(i, list.length - 1)], wantPlay.current);
                resolve(e.target);
              },
              onStateChange: (e) => {
                const p = e.target;
                if (e.data === YT_STATE.PLAYING) {
                  failures.current = 0;
                  setPlaying(true);
                  setLoading(false);
                  const d = p.getVideoData();
                  setNowTitle(d.title || '');
                  setNowVideo(d.video_id || undefined);
                  // Fill in a title the link lookup could not get.
                  const { tracks: list, index: i, savePrefs: save } = state.current;
                  const cur = list[i];
                  if (cur && cur.title === UNTITLED && !cur.listId && d.title) save({ music: list.map((t) => (t.id === cur.id ? { ...t, title: d.title! } : t)) });
                } else if (e.data === YT_STATE.PAUSED) {
                  setPlaying(false);
                } else if (e.data === YT_STATE.BUFFERING) {
                  setLoading(true);
                } else if (e.data === YT_STATE.ENDED) {
                  setPlaying(false);
                  // Playlists advance by themselves; ENDED means the whole track/list is over.
                  goTo(state.current.index + 1, true);
                } else if (e.data === YT_STATE.CUED) {
                  setLoading(false);
                }
              },
              onError: (e) => {
                setLoading(false);
                setPlaying(false);
                setError(ytErrorMessage(e.data));
                failures.current += 1;
                if (wantPlay.current && failures.current < state.current.tracks.length) {
                  setTimeout(() => goTo(state.current.index + 1, true), 1500);
                }
              },
            },
          });
        }),
    );
    playerReady.current.catch((err) => {
      playerReady.current = null;
      setLoading(false);
      setError((err as Error).message);
    });
    return playerReady.current;
  }, [goTo, load]);

  // Prepare the player once there is something to play, so the first tap starts instantly
  // (mobile browsers only allow playback started directly from a tap).
  useEffect(() => {
    if (tracks.length) ensurePlayer().catch(() => {});
  }, [tracks.length, ensurePlayer]);

  // If the current track was removed or changed elsewhere, load what is now at this position.
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    if (!track) {
      p.pauseVideo();
      setPlaying(false);
      loadedKey.current = '';
      return;
    }
    if (trackKey(track) !== loadedKey.current) load(p, track, playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.videoId, track?.listId]);

  const toggle = useCallback(() => {
    if (!state.current.tracks.length) return setSheetOpen(true);
    const p = player.current;
    if (!p) {
      wantPlay.current = true;
      setLoading(true);
      ensurePlayer().then((pl) => pl.playVideo()).catch(() => {});
      return;
    }
    if (playing) {
      wantPlay.current = false;
      p.pauseVideo();
    } else {
      wantPlay.current = true;
      failures.current = 0;
      if (!loadedKey.current) load(p, state.current.tracks[Math.min(state.current.index, state.current.tracks.length - 1)], true);
      else p.playVideo();
    }
  }, [playing, ensurePlayer, load]);

  const next = useCallback(() => {
    const p = player.current;
    const list = p?.getPlaylist?.();
    if (p && list && list.length > 1 && p.getPlaylistIndex() < list.length - 1) {
      wantPlay.current = true;
      return p.nextVideo();
    }
    goTo(state.current.index + 1, true);
  }, [goTo]);

  const prev = useCallback(() => {
    const p = player.current;
    if (p && p.getCurrentTime() > 5) return p.seekTo(0, true);
    const list = p?.getPlaylist?.();
    if (p && list && list.length > 1 && p.getPlaylistIndex() > 0) return p.previousVideo();
    goTo(state.current.index - 1, true);
  }, [goTo]);

  const playAt = useCallback(
    (i: number) => {
      failures.current = 0;
      if (!player.current) {
        setIndex(i);
        wantPlay.current = true;
        setLoading(true);
        ensurePlayer().catch(() => {});
        return;
      }
      goTo(i, true);
    },
    [goTo, ensurePlayer],
  );

  const api: MusicApi = {
    tracks,
    index: safeIndex,
    playing,
    loading,
    title: nowTitle || track?.title || '',
    thumb: thumbUrl(nowVideo || track?.videoId),
    error,
    toggle,
    next,
    prev,
    playAt,
    videoVisible,
    setVideoVisible,
    sheetOpen,
    openSheet: () => setSheetOpen(true),
    closeSheet: () => setSheetOpen(false),
  };

  return (
    <MusicContext.Provider value={api}>
      {children}
      {/* The YouTube player itself. Kept in the page (not display:none) so audio keeps playing;
          shown as a small floating window when "영상 보기" is on. */}
      <div
        className={cx(
          'fixed z-[45] overflow-hidden rounded-2xl bg-black shadow-pop transition',
          videoVisible ? 'bottom-[calc(76px+env(safe-area-inset-bottom))] right-3 h-[158px] w-[280px] lg:bottom-4 lg:right-4' : 'pointer-events-none -left-[400px] bottom-0 h-[200px] w-[200px] opacity-0',
        )}
        aria-hidden={!videoVisible}
      >
        <div ref={host} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
        {videoVisible && (
          <button onClick={() => setVideoVisible(false)} aria-label="영상 닫기" className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </MusicContext.Provider>
  );
}
