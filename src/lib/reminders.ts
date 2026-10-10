import { useEffect, useRef } from 'react';
import { useData } from '../data/DataProvider';
import { useDeviceSettings } from './deviceSettings';
import { hmToMinutes, today } from './date';

// Simple reminders: while Plock is open (tab or installed app), notify N minutes before
// timed events and tasks. (Background push would need a server; this keeps the app serverless.)

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

async function notify(title: string, body: string, tag: string) {
  const options: NotificationOptions = { body, tag, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) return void (await reg.showNotification(title, options));
  } catch {
    /* fall back below */
  }
  try {
    new Notification(title, options);
  } catch {
    /* ignore (e.g. Android Chrome requires the service worker path) */
  }
}

let audioCtx: AudioContext | null = null;

/** Short two-note chime (no audio file needed). Browsers allow it after the user has interacted with the page. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const t0 = audioCtx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + 0.62);
    });
  } catch {
    /* audio unavailable */
  }
}

export function testReminder(sound: boolean) {
  if (sound) playChime();
  return notify('🔔 Plock 알림 테스트', '이렇게 알려 드려요.', `test-${Date.now()}`);
}

export function useReminders() {
  const { data, loaded } = useData();
  const { remindersEnabled, reminderLead, reminderSound } = useDeviceSettings();
  const latest = useRef(data);
  latest.current = data;

  useEffect(() => {
    if (!loaded || !remindersEnabled || !('Notification' in window)) return;
    const sentKey = 'plock_reminders_sent';
    const sent = new Set<string>(JSON.parse(sessionStorage.getItem(sentKey) || '[]'));

    const check = () => {
      if (Notification.permission !== 'granted') return;
      const d = today();
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const due: { key: string; title: string; body: string }[] = [];
      for (const e of latest.current.events) {
        if (e.done || !e.startTime || e.startDate !== d) continue;
        const diff = hmToMinutes(e.startTime) - nowMin;
        if (diff >= 0 && diff <= reminderLead) due.push({ key: `e:${e.id}:${d}:${e.startTime}`, title: `⏰ ${e.title}`, body: diff === 0 ? '지금 시작해요' : `${diff}분 후 시작 (${e.startTime})` });
      }
      for (const t of latest.current.tasks) {
        if (t.done || !t.dueTime || t.dueDate !== d) continue;
        const diff = hmToMinutes(t.dueTime) - nowMin;
        if (diff >= 0 && diff <= reminderLead) due.push({ key: `t:${t.id}:${d}:${t.dueTime}`, title: `✅ ${t.title}`, body: diff === 0 ? '지금 마감이에요' : `${diff}분 후 마감 (${t.dueTime})` });
      }
      let fresh = 0;
      for (const item of due) {
        if (sent.has(item.key)) continue;
        sent.add(item.key);
        fresh++;
        notify(item.title, item.body, item.key);
      }
      if (fresh && reminderSound) playChime();
      sessionStorage.setItem(sentKey, JSON.stringify(Array.from(sent)));
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, [loaded, remindersEnabled, reminderLead, reminderSound]);
}
