import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { Bindings } from './types';

/**
 * SECURITY (rotated keypair):
 * The previous VAPID private key was hardcoded in this file and committed to
 * git — it must be considered compromised. The keypair below was rotated:
 *
 *   • PRIVATE key lives ONLY in a Worker secret:  npx wrangler secret put VAPID_PRIVATE_KEY
 *     (local dev: apps/api/.dev.vars, which is gitignored)
 *   • The PUBLIC key is not secret and is safe in source — browsers need it
 *     to subscribe (served via GET /api/push/vapid-public-key).
 *
 * ⚠️ Because the keypair changed, all existing push subscriptions were signed
 * for the old key and are rejected (403) by push services. dispatchWebPush()
 * now purges subscriptions on 403 as well so clients silently re-subscribe.
 */
export const VAPID_PUBLIC_KEY =
  'BDbLBgjyDprDJS_o3nRRHdTsd_arg3l0jIp3L3G2SLDAig786GceXdIFSRgprLenxwpdcCGm5T3uFs7S-uPEaG0';

const VAPID_SUBJECT = 'mailto:support@barbershop.jo';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/**
 * Resolves the VAPID keys for this invocation. The private key MUST be
 * provided via the environment binding (Worker secret) — there is no source
 * fallback by design, so a missing secret fails loudly instead of silently
 * reusing a compromised key.
 */
export function getVapidKeys(env: { VAPID_PRIVATE_KEY?: string; VAPID_PUBLIC_KEY?: string }): VapidKeys {
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      '[WebPush] VAPID_PRIVATE_KEY is not configured. ' +
        'Set it with: npx wrangler secret put VAPID_PRIVATE_KEY (or apps/api/.dev.vars locally).',
    );
  }
  return { publicKey: env.VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY, privateKey };
}

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
  env: Pick<Bindings, 'DB' | 'VAPID_PRIVATE_KEY' | 'VAPID_PUBLIC_KEY'>,
  userType: 'owner' | 'customer',
  customerId: number | null,
  salonId: number,
  payload: PushPayload,
): Promise<PushResult[]> {
  const db = env.DB;
  const results: PushResult[] = [];

  // Fail fast (and loudly) when the secret is missing — before touching the DB.
  const vapidKeys = getVapidKeys(env);

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
            publicKey: vapidKeys.publicKey,
            privateKey: vapidKeys.privateKey,
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

        // Expired (404), unsubscribed (410), or signed with the WRONG VAPID
        // key (403 — expected once right after the key rotation): remove the
        // dead subscription so the client re-subscribes with the new key.
        if (res.status === 404 || res.status === 410 || res.status === 403) {
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
