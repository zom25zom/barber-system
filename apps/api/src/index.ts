import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, Variables, SalonSettings } from './types';
import { authRoutes } from './routes/auth';
import { publicRoutes } from './routes/public';
import { ownerRoutes } from './routes/owner';
import { customerRoutes } from './routes/customer';
import { pushRoutes } from './routes/push';
import { SALON_ID } from './utils';

export { NotificationHub } from './durable';

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*', // single-tenant; tighten to the Pages domain in production
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/api/health', (c) => c.json({ ok: true }));

app.route('/api/auth', authRoutes);
app.route('/api', publicRoutes);
app.route('/api/owner', ownerRoutes);
app.route('/api/customer', customerRoutes);
app.route('/api/push', pushRoutes);

// Dynamic PWA Web App Manifests directly served from D1 database
app.get('/manifest.json', async (c) => {
  const salon = await c.env.DB.prepare('SELECT name, primary_color, logo_url FROM salons WHERE id = ?')
    .bind(SALON_ID)
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
  const salon = await c.env.DB.prepare('SELECT name, primary_color, logo_url FROM salons WHERE id = ?')
    .bind(SALON_ID)
    .first<SalonSettings>();

  const name = salon?.name || 'إدارة الصالون';
  const color = salon?.primary_color || '#09090b';
  const logo = salon?.logo_url || '/icon-192.png';

  return c.json({
    name: `لوحة تحكم ${name} — الإدارة`,
    short_name: `إدارة ${name}`,
    description: `لوحة تحكم وإدارة ${name} والحجوزات والإشعارات`,
    start_url: '/admin',
    scope: '/admin',
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
  if (role === 'owner') {
    const row = await c.env.DB.prepare(
      `SELECT s.owner_id FROM sessions s JOIN owners o ON o.id = s.owner_id
       WHERE s.token = ? AND s.expires_at > datetime('now') AND o.salon_id = ?`,
    )
      .bind(token, SALON_ID)
      .first();
    if (!row) return c.json({ error: 'غير مصرح' }, 401);
  } else {
    const row = await c.env.DB.prepare('SELECT id FROM customers WHERE token = ? AND salon_id = ?')
      .bind(token, SALON_ID)
      .first<{ id: number }>();
    if (!row) return c.json({ error: 'غير مصرح' }, 401);
    customerId = row.id;
  }

  // Each salon gets its own Durable Object instance for WebSocket isolation
  const hub = c.env.NOTIFICATION_HUB.get(c.env.NOTIFICATION_HUB.idFromName(`salon-${SALON_ID}`));
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
  console.error(err);
  return c.json({ error: 'خطأ داخلي في الخادم' }, 500);
});

export default app;
