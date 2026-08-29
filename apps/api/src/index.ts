import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, Variables, SalonSettings } from './types';
import { authRoutes } from './routes/auth';
import { publicRoutes } from './routes/public';
import { ownerRoutes } from './routes/owner';
import { customerRoutes } from './routes/customer';
import { pushRoutes } from './routes/push';
import { uploadRoutes } from './routes/upload';
import { logRouteError, formatTime12Ar, resolvePublicSalonId } from './utils';
import type { MessageBatch, ReminderMessage } from './types';
import { dispatchWebPush } from './webpush';

export { NotificationHub } from './durable';

const REMINDER_LEAD_MINUTES = 20;
const SALON_TZ_OFFSET = '+03:00'; // Jordan — fixed UTC+3 (matches reminders.ts)

/**
 * Queue consumer for booking-reminders.
 *
 * Fires ~20 minutes before each confirmed booking. Because delayed queue
 * messages cannot be cancelled, the live DB state is re-verified here as the
 * single source of truth: reminders are skipped if the booking was cancelled,
 * or its date/time changed after scheduling (a modified booking would have a
 * different start_time than the one captured in the message).
 */
async function processReminderBatch(batch: MessageBatch<ReminderMessage>, env: Bindings): Promise<void> {
  for (const message of batch.messages) {
    const { bookingId, bookingDate, startTime } = message.body;
    try {
      const booking = await env.DB.prepare(
        `SELECT bk.id, bk.booking_date, bk.start_time, bk.status, bk.customer_id,
                br.name AS barber_name
         FROM bookings bk
         JOIN barbers br ON br.id = bk.barber_id
         WHERE bk.id = ? AND bk.salon_id = ?`,
      )
        .bind(bookingId, message.body.salonId)
        .first<{
          id: number;
          booking_date: string;
          start_time: string;
          status: string;
          customer_id: number;
          barber_name: string;
        }>();

      // Booking deleted → nothing to remind about
      if (!booking) {
        console.log(`[Reminder] Booking #${bookingId} no longer exists; skipping`);
        continue;
      }

      // Cancelled / completed / no-show after scheduling → skip
      if (booking.status !== 'confirmed') {
        console.log(`[Reminder] Booking #${bookingId} status is '${booking.status}'; skipping`);
        continue;
      }

      // Rescheduled to a different time after this reminder was queued → skip
      if (booking.booking_date !== bookingDate || booking.start_time !== startTime) {
        console.log(`[Reminder] Booking #${bookingId} moved to ${booking.booking_date} ${booking.start_time}; skipping stale reminder`);
        continue;
      }

      // Queue delay is capped at 24h (Cloudflare Queues rejects longer delays),
      // so re-chain the message until the reminder window (~20 min before start).
      const reminderTargetMs =
        new Date(`${bookingDate}T${startTime}:00${SALON_TZ_OFFSET}`).getTime() - REMINDER_LEAD_MINUTES * 60_000;
      const remainingSeconds = Math.floor((reminderTargetMs - Date.now()) / 1000);

      if (remainingSeconds > 60 && env.REMINDER_QUEUE) {
        const nextDelay = Math.min(remainingSeconds, 86_400);
        try {
          await env.REMINDER_QUEUE.send(message.body, { delaySeconds: nextDelay });
          console.log(`[Reminder] Booking #${bookingId}: re-chained, fires in ~${nextDelay}s`);
          continue;
        } catch (err) {
          console.error(`[Reminder] Re-chain failed for booking #${bookingId}, will retry:`, err);
          throw err;
        }
      }

      const cleanBarber = booking.barber_name.startsWith('الحلاق') ? booking.barber_name : `الحلاق ${booking.barber_name}`;
      const text = `موعدك مع ${cleanBarber} بعد ${REMINDER_LEAD_MINUTES} دقيقة! الساعة ${formatTime12Ar(startTime)} — نراك قريباً 💈`;

      // Deep-link the user inside THEIR salon (tenant-prefixed when slug exists)
      const slugRow = await env.DB.prepare('SELECT slug FROM salons WHERE id = ?')
        .bind(message.body.salonId)
        .first<{ slug: string | null }>();
      const deepLinkUrl = `${slugRow?.slug ? `/${slugRow.slug}` : ''}/my-bookings`;

      // Persist in-app notification record
      await env.DB.prepare(
        `INSERT INTO notifications (recipient_type, recipient_id, type, message, booking_id, salon_id)
         VALUES ('customer', ?, 'reminder', ?, ?, ?)`,
      )
        .bind(booking.customer_id, text, bookingId, message.body.salonId)
        .run();

      // Native Web Push — wakes the device even with the browser closed
      const results = await dispatchWebPush(env, 'customer', booking.customer_id, message.body.salonId, {
        title: 'تذكير بموعدك ⏰',
        message: text,
        url: deepLinkUrl,
        id: bookingId,
      });
      const delivered = results.filter((r) => r.success).length;
      console.log(`[Reminder] Booking #${bookingId}: push sent (${delivered}/${results.length} devices)`);
    } catch (err) {
      // Throwing triggers a retry (up to max_retries in wrangler.toml)
      console.error(`[Reminder] Failed processing booking #${bookingId}, will retry:`, err);
      throw err;
    }
  }
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*', // single-tenant; tighten to the Pages domain in production
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

// Comprehensive Health & Diagnostics endpoint for monitoring
app.get('/api/health', async (c) => {
  const start = Date.now();
  let d1Status = 'disconnected';
  let d1LatencyMs = 0;
  let tablesCount = 0;

  try {
    const d1Start = Date.now();
    const result = await c.env.DB.prepare(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table'",
    ).first<{ count: number }>();
    d1LatencyMs = Date.now() - d1Start;
    d1Status = 'connected';
    tablesCount = result?.count ?? 0;
  } catch (err) {
    logRouteError('/api/health', 'D1_CONNECTION_ERROR', err);
    d1Status = 'error';
  }

  let pushStatus = 'disabled';
  let pushLatencyMs = 0;
  try {
    if (c.env.NOTIFICATION_HUB) {
      const pStart = Date.now();
      const hub = c.env.NOTIFICATION_HUB.get(
        c.env.NOTIFICATION_HUB.idFromName('system-health-probe'),
      );
      const res = await hub.fetch('https://hub/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'health_check', limit: 100, windowSeconds: 60 }),
      });
      pushLatencyMs = Date.now() - pStart;
      pushStatus = res.ok ? 'connected' : 'degraded';
    }
  } catch (err) {
    logRouteError('/api/health', 'PUSH_HUB_ERROR', err);
    pushStatus = 'error';
  }

  const isHealthy = d1Status === 'connected' && pushStatus !== 'error';

  return c.json(
    {
      ok: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      totalLatencyMs: Date.now() - start,
      services: {
        database: {
          name: 'Cloudflare D1 (barber_db)',
          status: d1Status,
          latencyMs: d1LatencyMs,
          tablesCount,
        },
        pushService: {
          name: 'Durable Objects & WebSockets',
          status: pushStatus,
          latencyMs: pushLatencyMs,
        },
        storage: {
          name: 'Image Uploads (R2 / D1 Fallback)',
          status: 'ready',
          r2Bound: !!c.env.BUCKET,
        },
      },
    },
    isHealthy ? 200 : 503,
  );
});

app.route('/api/auth', authRoutes);
app.route('/api', uploadRoutes);
app.route('/api', publicRoutes);
app.route('/api/owner', ownerRoutes);
app.route('/api/customer', customerRoutes);
app.route('/api/push', pushRoutes);

// Dynamic PWA Web App Manifests directly served from D1 database
app.get('/manifest.json', async (c) => {
  const salonId = await resolvePublicSalonId(c);
  const salon = await c.env.DB.prepare('SELECT name, primary_color, logo_url FROM salons WHERE id = ?')
    .bind(salonId)
    .first<SalonSettings>();

  const name = salon?.name || 'صالون الحلاقة';
  const color = salon?.primary_color || '#09090b';
  const logo = salon?.logo_url || '/icon-192.png';

  return c.json({
    name: `${name} — احجز موعدك`,
    short_name: name,
    description: `نظام حجز مواعيد ${name} — اختر الحلاق والخدمة والموعد المناسب لك`,
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    theme_color: color,
    background_color: '#09090b',
    icons: [
      {
        src: logo,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: salon?.logo_url || '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    categories: ['lifestyle', 'utilities'],
    prefer_related_applications: false,
  });
});

app.get('/manifest-admin.json', async (c) => {
  const salonId = await resolvePublicSalonId(c);
  const salon = await c.env.DB.prepare('SELECT name, primary_color, logo_url FROM salons WHERE id = ?')
    .bind(salonId)
    .first<SalonSettings>();

  const name = salon?.name || 'إدارة الصالون';
  const color = salon?.primary_color || '#09090b';
  const logo = salon?.logo_url || '/icon-192.png';

  return c.json({
    name: `لوحة تحكم ${name} — الإدارة`,
    short_name: `إدارة ${name}`,
    description: `لوحة تحكم وإدارة ${name} والحجوزات والإشعارات`,
    start_url: '/admin',
    scope: '/',
    id: '/admin',
    display: 'standalone',
    orientation: 'portrait',
    dir: 'rtl',
    lang: 'ar',
    theme_color: color,
    background_color: '#09090b',
    icons: [
      {
        src: logo,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: salon?.logo_url || '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    categories: ['business', 'utilities'],
    prefer_related_applications: false,
  });
});

// Real-time notifications via Durable Objects — PRD 3.9
// GET /api/notifications/ws?role=owner|customer&token=...
app.get('/api/notifications/ws', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'WebSocket endpoint' }, 426);
  }
  const role = c.req.query('role');
  const token = c.req.query('token');
  if (!token || (role !== 'owner' && role !== 'customer')) {
    return c.json({ error: 'غير مصرح' }, 401);
  }

  let customerId: number | null = null;
  let wsSalonId: number | null = null;
  if (role === 'owner') {
    const row = await c.env.DB.prepare(
      `SELECT s.owner_id, s.salon_id FROM sessions s JOIN owners o ON o.id = s.owner_id
       WHERE s.token = ? AND s.expires_at > datetime('now')`,
    )
      .bind(token)
      .first<{ owner_id: number; salon_id: number }>();
    if (!row) return c.json({ error: 'غير مصرح' }, 401);
    wsSalonId = row.salon_id;
  } else {
    const row = await c.env.DB.prepare('SELECT id, salon_id FROM customers WHERE token = ?')
      .bind(token)
      .first<{ id: number; salon_id: number }>();
    if (!row) return c.json({ error: 'غير مصرح' }, 401);
    customerId = row.id;
    wsSalonId = row.salon_id;
  }

  // Each salon gets its own Durable Object instance for WebSocket isolation —
  // named dynamically after the session's tenant.
  const hub = c.env.NOTIFICATION_HUB.get(c.env.NOTIFICATION_HUB.idFromName(`salon-${wsSalonId}`));
  const url = new URL('https://hub/ws');
  url.searchParams.set('role', role);
  if (customerId != null) url.searchParams.set('customerId', String(customerId));
  return hub.fetch(new Request(url.toString(), c.req.raw));
});

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Not found' }, 404);
  }
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});
app.onError((err, c) => {
  const timestamp = new Date().toISOString();
  const endpoint = `${c.req.method} ${c.req.url}`;
  const clientIp =
    c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '127.0.0.1';

  console.error(
    `[WORKER_ERROR] [${timestamp}] [${endpoint}] [${err.name || 'InternalError'}]`,
    JSON.stringify({
      timestamp,
      endpoint,
      method: c.req.method,
      url: c.req.url,
      clientIp,
      errorName: err.name || 'Error',
      errorMessage: err.message,
      stack: err.stack,
    }),
  );

  return c.json({ error: 'خطأ داخلي في الخادم' }, 500);
});

// Combined worker entrypoint: Hono app (HTTP) + Queues consumer (reminders)
export default {
  fetch: (req: Request, env: Bindings, ctx: ExecutionContext) => app.fetch(req, env, ctx),
  queue: processReminderBatch as ExportedHandler<Bindings>['queue'],
} satisfies ExportedHandler<Bindings>;
