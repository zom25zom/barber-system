import { apiFetch } from "./api";
import { getCustomerToken, getOwnerToken } from "./auth";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Registers Service Worker and subscribes device to Web Push API.
 * Enables push notifications even when the browser or tab is completely closed.
 */
export async function enableWebPushNotifications(role: "customer" | "owner"): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    // 1. Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // 2. Register Service Worker with root scope covering both customer and admin paths
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // 3. Fetch VAPID Public Key from server
    const { publicKey } = await apiFetch<{ publicKey: string }>("/api/push/vapid-public-key");
    if (!publicKey) return false;

    // 4. Subscribe to Push Manager
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    // 5. Send subscription to server
    const token = role === "customer" ? getCustomerToken() : getOwnerToken();
    const subJson = subscription.toJSON();

    await apiFetch("/api/push/subscribe", {
      method: "POST",
      token: token || undefined,
      body: {
        role,
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      },
    });

    return true;
  } catch (err) {
    console.error("Failed to enable Web Push:", err);
    return false;
  }
}
