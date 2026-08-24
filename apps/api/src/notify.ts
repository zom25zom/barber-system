import type { Context } from 'hono';
import type { Bindings } from './types';
import { dispatchWebPush } from './webpush';
import { SALON_ID, logRouteError } from './utils';

type RecipientType = 'owner' | 'customer';
type NotificationType = 'new_booking' | 'cancellation' | 'waitlist_available';

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
  const res = (await c.env.DB.prepare(
    `INSERT INTO notifications (recipient_type, recipient_id, type, message, booking_id, salon_id)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id, created_at`,
  )
    .bind(recipientType, recipientId, type, message, bookingId, SALON_ID)
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

  // 1. Fire-and-forget push to the WebSocket hub (for open browser tabs)
  try {
    const hub = c.env.NOTIFICATION_HUB.get(c.env.NOTIFICATION_HUB.idFromName(`salon-${SALON_ID}`));
    await hub.fetch('https://hub/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    // best-effort real-time delivery
  }

  // 2. Dispatch Native Web Push (wakes up mobile devices even when browser is closed)
  const title =
    recipientType === 'owner' ? 'صالون الحلاقة — حجز جديد أو تعديل 💈' : 'صالون الحلاقة — إشعار جديد 💈';
  const url = recipientType === 'owner' ? '/admin/bookings' : '/my-bookings';

  try {
    console.log(`[Notify] Dispatching Web Push → ${recipientType}${recipientId != null ? ` (id=${recipientId})` : ''} | type=${type} | salon=${SALON_ID}`);
    const results = await dispatchWebPush(c.env.DB, recipientType, recipientId, SALON_ID, {
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
}
