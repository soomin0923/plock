import React, { useState } from 'react';
import { Disc3, Loader2, Music2, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Tv } from 'lucide-react';
import type { MusicTrack } from '../../types';
import { useData } from '../../data/DataProvider';
import { Button, Sheet, TextInput } from '../../components/ui';
import { useToast } from '../../components/Toast';
import { cx, newId } from '../../lib/util';
import { UNTITLED, useMusic } from './MusicProvider';
import { fetchTitle, parseYouTubeUrl, thumbUrl } from './youtube';

/** A record that spins while music plays; the label shows the current video's thumbnail. */
export function Vinyl({ size, spinning, thumb, arm = false, className }: { size: number; spinning: boolean; thumb?: string; arm?: boolean; className?: string }) {
  return (
    <div className={cx('relative flex-none', className)} style={{ width: size, height: size }}>
      <div
        className="vinyl-spin absolute inset-0 rounded-full shadow-[0_6px_18px_-6px_rgb(0_0_0/0.55)]"
        style={{
          animationPlayState: spinning ? 'running' : 'paused',
          background:
            'radial-gradient(circle at 50% 50%, transparent 0 33%, rgb(255 255 255 / 0.05) 33.5% 34%, transparent 34.5%), repeating-radial-gradient(circle at 50% 50%, #161616 0 2px, #222 2.5px 3.5px), #111',
        }}
      >
        <span className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(from 30deg, transparent 0 10%, rgb(255 255 255 / 0.10) 14%, transparent 20% 60%, rgb(255 255 255 / 0.07) 64%, transparent 70%)' }} />
        <span
          className="absolute rounded-full bg-primary-light bg-cover bg-center"
          style={{ inset: '31%', backgroundImage: thumb ? `url(${thumb})` : undefined, boxShadow: 'inset 0 0 0 2px rgb(0 0 0 / 0.25)' }}
        />
        <span className="absolute left-1/2 top-1/2 h-[5%] w-[5%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper" />
      </div>
      {arm && (
        <svg viewBox="0 0 40 100" className="absolute -right-[8%] -top-[4%] h-[78%] origin-[70%_10%] transition-transform duration-700" style={{ transform: `rotate(${spinning ? 22 : 0}deg)` }} aria-hidden>
          <circle cx="28" cy="10" r="8" fill="#e8e3dc" stroke="#bdb5aa" strokeWidth="2" />
          <path d="M28 10 L22 78 L14 92" stroke="#cfc8be" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <rect x="8" y="88" width="10" height="9" rx="2" fill="#9e968b" transform="rotate(-25 13 92)" />
        </svg>
      )}
    </div>
  );
}

function Controls({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const m = useMusic();
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const btn = cx('flex items-center justify-center rounded-full text-ink-soft transition hover:bg-hover hover:text-ink disabled:opacity-40', size === 'sm' ? 'h-8 w-8' : 'h-10 w-10');
  return (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} onClick={m.prev} disabled={!m.tracks.length} aria-label="이전 곡">
        <SkipBack className={icon} />
      </button>
      <button type="button" className={cx(btn, 'bg-ink/5')} onClick={m.toggle} aria-label={m.playing ? '일시정지' : '재생'}>
        {m.loading && !m.playing ? <Loader2 className={cx(icon, 'animate-spin')} /> : m.playing ? <Pause className={icon} /> : <Play className={icon} />}
      </button>
      <button type="button" className={btn} onClick={m.next} disabled={!m.tracks.length} aria-label="다음 곡">
        <SkipForward className={icon} />
      </button>
    </div>
  );
}

/** Desktop sidebar: record + title + controls. */
export function SidebarMusic() {
  const m = useMusic();
  return (
    <div className="mb-3 rounded-2xl border border-line bg-card/70 p-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={m.openSheet} aria-label="LP 플레이어 열기" className="rounded-full">
          <Vinyl size={64} spinning={m.playing} thumb={m.thumb} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-faint">{m.tracks.length ? `LP ${m.index + 1}/${m.tracks.length}` : 'LP'}</p>
          <button type="button" onClick={m.openSheet} className="block w-full truncate text-left text-[13px] font-semibold hover:underline" title={m.title}>
            {m.tracks.length ? m.title || '눌러서 켜기' : '판 올리기'}
          </button>
          {m.error && <p className="truncate text-[11px] text-expense" title={m.error}>{m.error}</p>}
        </div>
      </div>
      <div className="mt-2 flex justify-center">
        <Controls size="sm" />
      </div>
    </div>
  );
}

/** Phones: a small spinning record above the tab bar once a track exists. */
export function FloatingMusic() {
  const m = useMusic();
  if (!m.tracks.length || m.videoVisible) return null;
  return (
    <button
      type="button"
      onClick={m.openSheet}
      aria-label={m.playing ? `재생 중: ${m.title}` : 'LP 플레이어'}
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-3 z-[35] rounded-full lg:hidden"
    >
      <Vinyl size={52} spinning={m.playing} thumb={m.thumb} />
      {!m.playing && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Play className="h-4 w-4 fill-white text-white drop-shadow" />
        </span>
      )}
    </button>
  );
}

export function MusicSheet() {
  const m = useMusic();
  const { prefs, savePrefs } = useData();
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const link = parseYouTubeUrl(url);
    if (!link) return toast('YouTube 또는 YouTube Music 링크를 붙여 넣어 주세요.', 'info');
    setAdding(true);
    const title = (await fetchTitle(link)) || (link.listId && !link.videoId ? '재생목록' : UNTITLED);
    const track: MusicTrack = { id: newId('trk'), title, ...link };
    const list = [...(prefs.music || []), track];
    savePrefs({ music: list });
    setUrl('');
    setAdding(false);
    toast(`‘${title}’ 판을 올렸어요.`);
    if (list.length === 1) m.playAt(0);
  };

  const removeAt = (i: number) => {
    const list = (prefs.music || []).filter((_, j) => j !== i);
    savePrefs({ music: list.length ? list : undefined });
  };

  return (
    <Sheet open={m.sheetOpen} onClose={m.closeSheet} title="LP 플레이어" size="sm">
      <div className="flex flex-col items-center">
        <Vinyl size={184} spinning={m.playing} thumb={m.thumb} arm />
        <p className="mt-4 line-clamp-2 min-h-[1.5em] max-w-full text-center text-[15px] font-bold">{m.tracks.length ? m.title || '재생을 눌러 주세요' : '아직 올린 판이 없어요'}</p>
        {m.error && <p className="mt-1 text-center text-[13px] text-expense">{m.error}</p>}
        <div className="mt-2 flex items-center gap-2">
          <Controls />
          <button
            type="button"
            onClick={() => m.setVideoVisible(!m.videoVisible)}
            disabled={!m.tracks.length}
            aria-pressed={m.videoVisible}
            className={cx('ml-1 flex h-10 items-center gap-1 rounded-full px-3 text-[13px] font-semibold transition disabled:opacity-40', m.videoVisible ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-hover')}
          >
            <Tv className="h-4 w-4" /> 영상
          </button>
        </div>
      </div>

      <form onSubmit={add} className="mt-5 flex gap-2">
        <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="YouTube / YouTube Music 링크 붙여넣기" inputMode="url" aria-label="곡 링크" />
        <Button type="submit" variant="primary" disabled={!url.trim() || adding} icon={adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}>
          올리기
        </Button>
      </form>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">곡 하나, 재생목록 모두 돼요. 목록은 계정에 저장돼 다른 기기에서도 그대로 보여요.</p>

      {m.tracks.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {m.tracks.map((t, i) => {
            const current = i === m.index;
            return (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2">
                <button type="button" onClick={() => m.playAt(i)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  {t.videoId ? (
                    <img src={thumbUrl(t.videoId)} alt="" className="h-9 w-12 flex-none rounded-md bg-hover object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  ) : (
                    <span className="flex h-9 w-12 flex-none items-center justify-center rounded-md bg-hover text-muted">
                      <Music2 className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className={cx('block truncate text-[14px] font-semibold', current && 'text-primary')}>{t.title}</span>
                    <span className="block text-[12px] text-muted">{t.listId ? '재생목록' : '곡'}{current && m.playing ? ' · 재생 중' : ''}</span>
                  </span>
                </button>
                {current && m.playing && <Disc3 className="h-4 w-4 flex-none animate-spin text-primary" />}
                <button type="button" onClick={() => removeAt(i)} aria-label={`${t.title} 빼기`} className="flex-none rounded-lg p-1.5 text-faint hover:bg-hover hover:text-expense">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        YouTube 공식 플레이어로 재생해요(광고 포함 가능). 업로더가 외부 재생을 막은 곡은 건너뛰어요. 휴대폰에서 화면을 끄거나 다른 앱으로 가면 브라우저가 재생을 멈출 수 있어요.
      </p>
    </Sheet>
  );
}
