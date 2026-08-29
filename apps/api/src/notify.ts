import type { Context } from 'hono';
import type { Bindings } from './types';
import { dispatchWebPush } from './webpush';
import { logRouteError } from './utils';

type RecipientType = 'owner' | 'customer';
type NotificationType = 'new_booking' | 'cancellation' | 'waitlist_available';

/**
 * Format standard new booking notification text
 * الصيغة الموحدة: "حجز جديد: [اسم الزبون] مع الحلاق [اسم الحلاق]"
 */
export function formatNewBookingMessage(
  customerName: string,
  barberName: string,
  date?: string,
  time?: string,
): string {
  const cleanBarber = barberName.startsWith('الحلاق') ? barberName : `الحلاق ${barberName}`;
  if (date && time) {
    return `حجز جديد: ${customerName} مع ${cleanBarber} بتاريخ ${date} الساعة ${time}.`;
  }
  return `حجز جديد: ${customerName} مع ${cleanBarber}`;
}

/**
 * Persist a notification and push it in real time through:
 * 1. Durable Object WebSocket hub (for live active pages)
 * 2. Native Web Push API (for mobile and desktop even when the browser is completely closed)
 */
export async function sendNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<any>,
  recipientType: RecipientType,
  recipientId: number | null,
  type: NotificationType,
  message: string,
  bookingId: number | null = null,
): Promise<void> {
  // Tenant derived from the authenticated session context (never client input)
  const salonId: number = c.get('salonId');

  // Deep-link URLs must keep the user inside their own salon — customers get
  // a tenant-prefixed path (/{slug}/my-bookings) when the salon has a slug.
  const slugRow = (await c.env.DB.prepare('SELECT slug FROM salons WHERE id = ?')
    .bind(salonId)
    .first()) as { slug: string | null } | null;
  const slugPrefix = slugRow?.slug ? `/${slugRow.slug}` : '';

  const res = (await c.env.DB.prepare(
    `INSERT INTO notifications (recipient_type, recipient_id, type, message, booking_id, salon_id)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id, created_at`,
  )
    .bind(recipientType, recipientId, type, message, bookingId, salonId)
    .first()) as { id: number; created_at: string } | null;

  const payload = {
    id: res?.id,
    recipient_type: recipientType,
    recipient_id: recipientId,
    type,
    message,
    booking_id: bookingId,
    created_at: res?.created_at ?? new Date().toISOString(),
  };

  // 1. Live push to the WebSocket hub (for open browser tabs) — best-effort.
  //    The DO may need a cold start on first use after idle; failures are
  //    non-fatal and must never delay or break the Web Push below.
  const hubBroadcastPromise = (async () => {
    try {
      const hub = c.env.NOTIFICATION_HUB.get(c.env.NOTIFICATION_HUB.idFromName(`salon-${salonId}`));
      await hub.fetch('https://hub/broadcast', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      // best-effort real-time delivery
    }
  })();

  // 2. Native Web Push (wakes up devices even when browser is completely closed)
  const title =
    recipientType === 'owner' ? 'صالون الحلاقة — حجز جديد أو تعديل 💈' : 'صالون الحلاقة — إشعار جديد 💈';
  const url =
    recipientType === 'owner'
      ? '/admin/bookings' // admin panel is session-global by design
      : `${slugPrefix}/my-bookings`;

  const webPushPromise = (async () => {
    try {
      console.log(`[Notify] Dispatching Web Push → ${recipientType}${recipientId != null ? ` (id=${recipientId})` : ''} | type=${type} | salon=${salonId}`);
      const results = await dispatchWebPush(c.env, recipientType, recipientId, salonId, {
        title,
        message,
        url,
        id: res?.id,
      });
      const successCount = results.filter((r) => r.success).length;
      console.log(`[Notify] Web Push dispatch done: ${successCount}/${results.length} delivered`);
    } catch (err) {
      logRouteError('/notify', 'WEB_PUSH_DISPATCH_ERROR', err, { recipientType, recipientId, type });
    }
  })();

  // Fire the real-time delivery work (DO hub + Web Push). Using waitUntil when
  // available guarantees completion even if the HTTP response finishes early
  // (e.g. client disconnects, or a cold-started Worker hits response streaming
  // edge cases) — while also unblocking the booking request from push latency.
  const deliveryWork = Promise.allSettled([hubBroadcastPromise, webPushPromise]);

  const ctx = c.executionCtx;
  if (ctx?.waitUntil) {
    ctx.waitUntil(deliveryWork);
  } else {
    await deliveryWork;
  }
}
