// Notification & Audio Utility for Plock App

export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const now = ctx.currentTime;

    // Chime note 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Chime note 2
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.12); // E5
    gain2.gain.setValueAtTime(0.18, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);

    // Chime note 3
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(783.99, now + 0.25); // G5
    gain3.gain.setValueAtTime(0.2, now + 0.25);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.25);
    osc3.stop(now + 0.65);
  } catch (e) {
    console.warn('[Notification] Could not play audio chime:', e);
  }
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    alert('이 브라우저는 웹 푸시 알림을 지원하지 않습니다.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (e) {
    console.error('Error requesting notification permission:', e);
    return false;
  }
}

export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[Service Worker] Registered successfully:', registration.scope);
      return registration;
    } catch (err) {
      console.warn('[Service Worker] Registration failed:', err);
    }
  }
  return null;
}

export async function sendBrowserNotification(title: string, body: string, tag?: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const options: NotificationOptions = {
    body,
    icon: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=128&auto=format&fit=crop&q=80',
    badge: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=128&auto=format&fit=crop&q=80',
    tag: tag || `alert_${Date.now()}`,
    vibrate: [200, 100, 200],
    requireInteraction: true,
  } as any;

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, options);
        return;
      }
    }
    // Fallback to standard Notification API
    new Notification(title, options);
  } catch (e) {
    console.warn('Browser notification trigger fallback error:', e);
    try {
      new Notification(title, options);
    } catch (err) {
      console.error('Final Notification error:', err);
    }
  }
}
