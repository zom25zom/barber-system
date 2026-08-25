import { buildPushPayload } from '@block65/webcrypto-web-push';

export const VAPID_PUBLIC_KEY =
  'BI50Mcwva1NNFDZahPtIZQRP8GBOl32NBP9P2TXY42_NTCbuIU8gGatRKyUDPJJnkxzJ0XK8dXqiQVrCP8arsjQ';

const VAPID_PRIVATE_KEY =
  'sxq0yDR5kpwesbDh8xryc00O8dZJuZLhMXF0LqNBm7A';

const VAPID_SUBJECT = 'mailto:support@barbershop.jo';

export interface PushPayload {
  title: string;
  message: string;
  url?: string;
  id?: number | null;
}

/** Result of a single push dispatch attempt */
export interface PushResult {
  subId: number;
  endpoint: string;
  status: number;
  statusText: string;
  success: boolean;
  error?: string;
  removed?: boolean;
}

/**
 * Dispatches a native Web Push Notification to all subscribed devices for the given user.
 * This wakes up Android / iOS devices even when the browser or tab is completely closed.
 *
 * Returns detailed results for logging / diagnostics.
 */
export async function dispatchWebPush(
  db: D1Database,
  userType: 'owner' | 'customer',
  customerId: number | null,
  salonId: number,
  payload: PushPayload,
): Promise<PushResult[]> {
  const results: PushResult[] = [];

  try {
    let query = 'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_type = ? AND salon_id = ?';
    const params: any[] = [userType, salonId];
    if (userType === 'customer' && customerId != null) {
      query += ' AND customer_id = ?';
      params.push(customerId);
    }

    const { results: subs } = (await db.prepare(query).bind(...params).all()) as {
      results: {
        id: number;
        endpoint: string;
        p256dh: string;
        auth: string;
      }[];
    };

    if (!subs || subs.length === 0) {
      console.log(`[WebPush] ⚠ No subscriptions found for ${userType}${customerId != null ? ` (customer_id=${customerId})` : ''} salon=${salonId}`);
      return results;
    }

    console.log(`[WebPush] Found ${subs.length} subscription(s) for ${userType}${customerId != null ? ` (customer_id=${customerId})` : ''} salon=${salonId}`);

    const payloadData = {
      title: payload.title,
      message: payload.message,
      body: payload.message,
      url: payload.url || (userType === 'owner' ? '/admin/bookings' : '/my-bookings'),
      id: payload.id,
      timestamp: Date.now(),
    };

    console.log(`[WebPush] Payload: ${JSON.stringify({ title: payloadData.title, message: payloadData.message, url: payloadData.url })}`);

    const pushPromises = subs.map(async (sub) => {
      const shortEndpoint = sub.endpoint.length > 80
        ? sub.endpoint.substring(0, 40) + '...' + sub.endpoint.substring(sub.endpoint.length - 30)
        : sub.endpoint;

      try {
        console.log(`[WebPush] → Building payload for sub #${sub.id} | endpoint: ${shortEndpoint}`);

        const pushPayload = await buildPushPayload(
          {
            data: payloadData,
            options: {
              // Short TTL (1h): the push must be delivered now or dropped —
              // combined with urgency=high this discourages Doze-mode batching.
              ttl: 3600,
              urgency: 'high',
            },
          },
          {
            endpoint: sub.endpoint,
            expirationTime: null,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          {
            subject: VAPID_SUBJECT,
            publicKey: VAPID_PUBLIC_KEY,
            privateKey: VAPID_PRIVATE_KEY,
          },
        );

        console.log(`[WebPush] → Sending to Push Service for sub #${sub.id} | TTL=${pushPayload.headers['ttl']} | Urgency=${pushPayload.headers['urgency'] ?? '(not set)'}`);

        const res = await fetch(sub.endpoint, {
          method: 'POST',
          headers: pushPayload.headers,
          body: pushPayload.body,
        });

        const responseBody = await res.text().catch(() => '');

        const result: PushResult = {
          subId: sub.id,
          endpoint: shortEndpoint,
          status: res.status,
          statusText: res.statusText,
          success: res.status >= 200 && res.status < 300,
        };

        if (res.status >= 200 && res.status < 300) {
          console.log(`[WebPush] ✓ Push Service responded: ${res.status} ${res.statusText} (sub #${sub.id})`);
        } else {
          console.warn(`[WebPush] ✗ Push Service rejected: ${res.status} ${res.statusText} (sub #${sub.id}) body: ${responseBody}`);
          result.error = `${res.status} ${res.statusText}: ${responseBody}`;
        }

        // If endpoint is expired or unsubscribed, remove from database
        if (res.status === 404 || res.status === 410) {
          console.log(`[WebPush] 🗑 Removing expired/gone subscription #${sub.id}`);
          await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
          result.removed = true;
        }

        results.push(result);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[WebPush] ✗ Failed to dispatch to sub #${sub.id}: ${errMsg}`);
        results.push({
          subId: sub.id,
          endpoint: shortEndpoint,
          status: 0,
          statusText: 'FETCH_ERROR',
          success: false,
          error: errMsg,
        });
      }
    });

    await Promise.allSettled(pushPromises);

    const successCount = results.filter((r) => r.success).length;
    console.log(`[WebPush] ════ Batch complete: ${successCount}/${results.length} delivered successfully ════`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[WebPush] ✗ Batch dispatch failed: ${errMsg}`);
  }

  return results;
}
