import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { VAPID_PUBLIC_KEY, dispatchWebPush } from '../webpush';
import { SALON_ID } from '../utils';

export const pushRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Return VAPID Public Key for browser pushManager.subscribe
pushRoutes.get('/vapid-public-key', (c) => {
  return c.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Save or update browser Web Push Subscription
pushRoutes.post('/subscribe', async (c) => {
  const authHeader = c.req.header('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  const body = await c.req.json().catch(() => ({} as any));
  const { endpoint, keys, role, user_type: explicitUserType } = body;

  let userType: 'owner' | 'customer' = (role === 'owner' || explicitUserType === 'owner') ? 'owner' : 'customer';
  let customerId: number | null = null;

  // Check token in database
  if (token) {
    const ownerRow = await c.env.DB.prepare(
      `SELECT s.owner_id FROM sessions s JOIN owners o ON o.id = s.owner_id WHERE s.token = ? AND s.expires_at > datetime('now') AND o.salon_id = ?`,
    )
      .bind(token, SALON_ID)
      .first<{ owner_id: number }>();

    if (ownerRow) {
      userType = 'owner';
    } else {
      const custRow = await c.env.DB.prepare('SELECT id FROM customers WHERE token = ? AND salon_id = ?')
        .bind(token, SALON_ID)
        .first<{ id: number }>();
      if (custRow) {
        userType = 'customer';
        customerId = custRow.id;
      }
    }
  }
  if (!endpoint || typeof endpoint !== 'string' || !keys?.p256dh || !keys?.auth) {
    return c.json({ error: 'بيانات اشتراك الإشعارات غير مكتملة' }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_type, customer_id, endpoint, p256dh, auth, salon_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET
       user_type = excluded.user_type,
       customer_id = excluded.customer_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       salon_id = excluded.salon_id,
       created_at = CURRENT_TIMESTAMP`,
  )
    .bind(userType, customerId, endpoint, keys.p256dh, keys.auth, SALON_ID)
    .run();

  console.log(`[Push] ✓ Subscription saved: ${userType}${customerId != null ? ` (customer_id=${customerId})` : ''} → ${endpoint.substring(0, 50)}...`);

  return c.json({ ok: true, user_type: userType, customer_id: customerId });
});

// Unsubscribe endpoint
pushRoutes.post('/unsubscribe', async (c) => {
  const { endpoint } = await c.req.json().catch(() => ({} as any));
  if (endpoint) {
    await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND salon_id = ?')
      .bind(endpoint, SALON_ID)
      .run();
    console.log(`[Push] 🗑 Subscription removed: ${endpoint.substring(0, 50)}...`);
  }
  return c.json({ ok: true });
});

/**
 * Test endpoint — sends a test push notification and returns detailed results.
 * POST /api/push/test  { "userType": "owner" | "customer", "customerId": number | null }
 *
 * This lets you verify that web-push.sendNotification reaches the Push Service
 * and get back the HTTP status code from FCM/APNs/Mozilla Push.
 */
pushRoutes.post('/test', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const userType: 'owner' | 'customer' = body.userType === 'owner' ? 'owner' : 'customer';
  const customerId: number | null = body.customerId ?? null;

  console.log(`[Push Test] ════ Starting test push for ${userType}${customerId != null ? ` (customer_id=${customerId})` : ''} ════`);

  const results = await dispatchWebPush(c.env.DB, userType, customerId, SALON_ID, {
    title: '🧪 إشعار تجريبي — صالون الحلاقة',
    message: `هذا إشعار تجريبي للتحقق من عمل Web Push. الوقت: ${new Date().toLocaleTimeString('ar-JO')}`,
    url: userType === 'owner' ? '/admin/bookings' : '/my-bookings',
  });

  console.log(`[Push Test] ════ Test complete. Results: ${JSON.stringify(results)} ════`);

  // Also count total subscriptions for diagnostics
  const { results: allSubs } = await c.env.DB.prepare(
    'SELECT id, user_type, customer_id, endpoint, created_at FROM push_subscriptions WHERE salon_id = ? ORDER BY created_at DESC',
  )
    .bind(SALON_ID)
    .all();

  return c.json({
    ok: true,
    test_target: { userType, customerId },
    push_results: results,
    total_subscriptions: allSubs?.length ?? 0,
    subscriptions: (allSubs ?? []).map((s: any) => ({
      id: s.id,
      user_type: s.user_type,
      customer_id: s.customer_id,
      endpoint: s.endpoint?.substring(0, 60) + '...',
      created_at: s.created_at,
    })),
  });
});

// Debug: list all subscriptions
pushRoutes.get('/subscriptions', async (c) => {
  const { results: subs } = await c.env.DB.prepare(
    'SELECT id, user_type, customer_id, endpoint, created_at FROM push_subscriptions WHERE salon_id = ? ORDER BY created_at DESC',
  )
    .bind(SALON_ID)
    .all();

  return c.json({
    count: subs?.length ?? 0,
    subscriptions: (subs ?? []).map((s: any) => ({
      id: s.id,
      user_type: s.user_type,
      customer_id: s.customer_id,
      endpoint: s.endpoint?.substring(0, 60) + '...',
      created_at: s.created_at,
    })),
  });
});
