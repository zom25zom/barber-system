import { enableWebPushNotifications } from "./push";

const recentNotifications = new Set<string>();
let lastSoundTime = 0;

/**
 * Synthesizes a pleasant luxury notification chime using the Web Audio API.
 * Strictly throttled so concurrent events only play ONE clean sound.
 */
export function playNotificationSound() {
  const nowMs = Date.now();
  if (nowMs - lastSoundTime < 1500) {
    return; // Ignore concurrent audio triggers
  }
  lastSoundTime = nowMs;

  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First note (E6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second note (B6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1975.53, now + 0.12);
    gain2.gain.setValueAtTime(0.35, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);
  } catch {
    // AudioContext blocked or not supported on device
  }
}

/**
 * Requests browser notification permission and subscribes to native Web Push.
 */
export async function requestNotificationPermission(role: "customer" | "owner" = "customer"): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const granted = await enableWebPushNotifications(role);
  return granted;
}

/**
 * Shows a native OS / Phone notification even when the browser or tab is in the background.
 * Strictly deduplicated to ensure exactly one notification is delivered.
 */
export function showBrowserNotification(title: string, body: string, url: string = "/my-bookings") {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  // Deduplicate identical title+body within 4 seconds
  const dedupKey = `${title}|${body}`;
  if (recentNotifications.has(dedupKey)) return;
  recentNotifications.add(dedupKey);
  setTimeout(() => recentNotifications.delete(dedupKey), 4000);

  if (Notification.permission === "granted") {
    try {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            vibrate: [300, 100, 300, 100, 300],
            data: { url },
            tag: "barber-notice-single",
            renotify: true,
            requireInteraction: true,
          } as NotificationOptions);
        });
      } else {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: "barber-notice-single",
        });
      }
    } catch {
      // Fallback
    }
  }
}
