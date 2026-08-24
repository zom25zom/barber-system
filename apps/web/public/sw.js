// Service Worker for Barber Shop Notifications & Background Web Push

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...");
  event.waitUntil(self.clients.claim());
});

// Push notification event (triggered by OS / Browser push service even when browser is closed)
self.addEventListener("push", (event) => {
  console.log("[SW] 🔔 Push event received!", event.data ? "with data" : "no data");

  let data = {
    title: "صالون الحلاقة — إشعار جديد 💈",
    message: "لديك تحديث جديد على حجزك أو دورك في الصالون.",
    url: "/my-bookings",
  };

  if (event.data) {
    try {
      data = event.data.json();
      console.log("[SW] Push payload parsed:", JSON.stringify(data));
    } catch {
      data.message = event.data.text();
      console.log("[SW] Push payload as text:", data.message);
    }
  }

  const title = data.title || "صالون الحلاقة — إشعار جديد 💈";
  const body = data.message || data.body || "لديك تحديث جديد على حجزك أو دورك في الصالون.";
  const url = data.url || "/my-bookings";

  const options = {
    body: body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [300, 100, 300, 100, 300],
    data: { url: url },
    tag: "barber-push-" + (data.id || Date.now()),
    renotify: true,
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle clicking on the notification on phone or desktop
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || "/";
  const urlToOpen = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
        if (client.url && "navigate" in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle push subscription expiry — re-subscribe automatically
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] pushsubscriptionchange — re-subscribing...");

  event.waitUntil(
    (async () => {
      try {
        // Fetch the VAPID public key
        const resp = await fetch("/api/push/vapid-public-key");
        const { publicKey } = await resp.json();

        if (!publicKey) {
          console.error("[SW] Could not fetch VAPID public key for re-subscription");
          return;
        }

        // Convert base64url to Uint8Array
        const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        const applicationServerKey = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          applicationServerKey[i] = rawData.charCodeAt(i);
        }

        // Re-subscribe
        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey,
        });

        const subJson = newSub.toJSON();

        // Send new subscription to server (without auth token — server will match by old endpoint if needed)
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: newSub.endpoint,
            keys: {
              p256dh: subJson.keys?.p256dh,
              auth: subJson.keys?.auth,
            },
          }),
        });

        console.log("[SW] ✓ Re-subscribed successfully after pushsubscriptionchange");

        // Remove old subscription if provided
        if (event.oldSubscription) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: event.oldSubscription.endpoint }),
          });
        }
      } catch (err) {
        console.error("[SW] ✗ Failed to re-subscribe:", err);
      }
    })()
  );
});
