/**
 * Super Admin — the PLATFORM OWNER's private API realm.
 *
 * Fully isolated from the tenant auth system:
 *   • own tables (super_admins / super_admin_sessions) — never touches
 *     `owners` / `sessions`
 *   • salted PBKDF2 password hashing (vs tenant unsalted SHA-256)
 *   • own login endpoint + shorter session expiry (12h vs 30d)
 *   • rate limiting mirrors the owner-login limiter (5 attempts / 5 min
 *     per IP, fail-closed, counted in the shared salon-0 DO room)
 *   • no CORS changes needed: the global CORS middleware in index.ts
 *     already covers every /api/* route including /api/super-admin/*
 *
 * NO default account exists anywhere: create the first one after
 * deployment via scripts/create-super-admin.mjs.
 */
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from '../types';
import {
  randomToken,
  getClientIP,
  checkRateLimit,
  isValidUsername,
  isPositiveInt,
  isValidPhone,
  hashPasswordPBKDF2,
  verifyPasswordPBKDF2,
} from '../utils';
import {
  getPlatformSettings,
  interpolateTemplate,
  setSalonSubscriptionStatus,
  type SubscriptionStatus,
} from '../subscription';

export const SUPER_ADMIN_SESSION_HOURS = 12;

type SuperAdmin = { id: number; username: string };

export const superAdminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ---------- Middleware ----------

function bearer(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const h = c.req.header('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Super Admin auth — the session row lives in super_admin_sessions. A
 * tenant owner token or a customer token can NEVER satisfy this check
 * (different table, different token space), and a super admin token can
 * never satisfy requireOwner/requireCustomer either.
 */
export const requireSuperAdmin = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);
  const row = await c.env.DB.prepare(
    `SELECT sa.id, sa.username FROM super_admin_sessions s
     JOIN super_admins sa ON sa.id = s.super_admin_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
  )
    .bind(token)
    .first<{ id: number; username: string }>();
  if (!row) {
    return c.json(
      { error: 'انتهت صلاحية جلستك، يرجى تسجيل الدخول من جديد', code: 'SESSION_EXPIRED' },
      401,
    );
  }
  c.set('superAdmin', { id: row.id, username: row.username });
  await next();
});

// ---------- Auth ----------

superAdminRoutes.post('/login', async (c) => {
  const ip = getClientIP(c);
  const body = await c.req.json().catch(() => ({} as any));
  const { username, password } = body;

  if (!isValidUsername(username) || typeof password !== 'string' || password.length < 1 || password.length > 128) {
    return c.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان بشكل صحيح' }, 400);
  }

  // ── Rate limit (pre-auth, per IP) — same pattern as owner login ──
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, 0, `super_admin_login:${ip}`, 5, 300, true);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfter || 60) / 60);
    return c.json(
      { error: `تم تجاوز الحد المسموح لمحاولات الدخول. يرجى المحاولة بعد ${minutes} دقيقة.` },
      429,
    );
  }

  const admin = await c.env.DB.prepare(
    'SELECT id, username, password_hash FROM super_admins WHERE username = ?',
  )
    .bind(String(username).trim())
    .first<{ id: number; username: string; password_hash: string }>();

  // Uniform 401 whether the account exists or the password is wrong — no
  // account enumeration on the platform-owner surface.
  if (!admin || !(await verifyPasswordPBKDF2(password, admin.password_hash))) {
    return c.json({ error: 'بيانات الدخول غير صحيحة' }, 401);
  }

  const token = randomToken();
  const expires = new Date(Date.now() + SUPER_ADMIN_SESSION_HOURS * 3600 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO super_admin_sessions (token, super_admin_id, expires_at) VALUES (?, ?, ?)',
  )
    .bind(token, admin.id, expires)
    .run();

  return c.json({ token, super_admin: { id: admin.id, username: admin.username } });
});

superAdminRoutes.post('/logout', async (c) => {
  const token = bearer(c);
  if (token) {
    await c.env.DB.prepare('DELETE FROM super_admin_sessions WHERE token = ?').bind(token).run();
  }
  return c.json({ ok: true });
});

superAdminRoutes.get('/me', requireSuperAdmin, async (c) => {
  return c.json({ super_admin: c.get('superAdmin') });
});

// ---------- Platform stats ----------

superAdminRoutes.get('/stats', requireSuperAdmin, async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total_salons,
       SUM(CASE WHEN subscription_status = 'trial' THEN 1 ELSE 0 END) AS trial_count,
       SUM(CASE WHEN subscription_status = 'active' THEN 1 ELSE 0 END) AS active_count,
       SUM(CASE WHEN subscription_status = 'expired' THEN 1 ELSE 0 END) AS expired_count,
       (SELECT COUNT(*) FROM bookings) AS total_bookings
     FROM salons`,
  ).first<{
    total_salons: number;
    trial_count: number | null;
    active_count: number | null;
    expired_count: number | null;
    total_bookings: number;
  }>();
  return c.json({
    stats: {
      total_salons: row?.total_salons ?? 0,
      trial: row?.trial_count ?? 0,
      active: row?.active_count ?? 0,
      expired: row?.expired_count ?? 0,
      total_bookings: row?.total_bookings ?? 0,
    },
  });
});

// ---------- Salons management ----------

superAdminRoutes.get('/salons', requireSuperAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.slug, s.created_at, s.phone,
            s.subscription_status, s.subscription_start_date, s.billing_cycle_type,
            (SELECT COUNT(*) FROM bookings bk WHERE bk.salon_id = s.id) AS bookings_count
     FROM salons s
     ORDER BY s.created_at DESC, s.id DESC`,
  ).all();
  return c.json({ salons: results ?? [] });
});

/**
 * Manual status change from the dashboard.
 *   trial   → fresh trial countdown starting TODAY
 *   active  → subscription_start_date reset to TODAY (fresh monthly cycle)
 *   expired → immediate lockout of the salon (admin + public side)
 */
superAdminRoutes.patch('/salons/:id/status', requireSuperAdmin, async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الصالون غير صالح' }, 400);

  const body = await c.req.json().catch(() => ({} as any));
  const status = body?.status;
  if (status !== 'trial' && status !== 'active' && status !== 'expired') {
    return c.json({ error: 'حالة الاشتراك يجب أن تكون: trial أو active أو expired' }, 400);
  }

  const exists = await c.env.DB.prepare('SELECT id FROM salons WHERE id = ?')
    .bind(Number(idRaw))
    .first();
  if (!exists) return c.json({ error: 'الصالون غير موجود' }, 404);

  // changed_by = the super admin's id (vs 'system' for automatic transitions)
  const admin = c.get('superAdmin');
  const result = await setSalonSubscriptionStatus(
    c.env.DB,
    Number(idRaw),
    status as SubscriptionStatus,
    String(admin.id),
  );

  const salon = await c.env.DB.prepare(
    'SELECT id, name, slug, subscription_status, subscription_start_date FROM salons WHERE id = ?',
  )
    .bind(Number(idRaw))
    .first();
  return c.json({ ok: true, changed: result.changed, salon });
});

/** Audit trail for one salon's subscription status changes. */
superAdminRoutes.get('/salons/:id/status-log', requireSuperAdmin, async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الصالون غير صالح' }, 400);
  const { results } = await c.env.DB.prepare(
    `SELECT id, old_status, new_status, changed_at, changed_by
     FROM subscription_status_log WHERE salon_id = ? ORDER BY id DESC LIMIT 100`,
  )
    .bind(Number(idRaw))
    .all();
  return c.json({ log: results ?? [] });
});

// ---------- Platform settings CRUD ----------

superAdminRoutes.get('/settings', requireSuperAdmin, async (c) => {
  const settings = await getPlatformSettings(c.env.DB);
  return c.json({ settings });
});

superAdminRoutes.put('/settings', requireSuperAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const updates: { key: string; value: string }[] = [];

  if (body.renewal_phone !== undefined) {
    if (!isValidPhone(body.renewal_phone)) {
      return c.json({ error: 'رقم الهاتف غير صالح (بين 7 و 20 رقماً)' }, 400);
    }
    updates.push({ key: 'renewal_phone', value: String(body.renewal_phone).trim() });
  }

  if (body.renewal_banner_template !== undefined) {
    if (typeof body.renewal_banner_template !== 'string' || !body.renewal_banner_template.includes('{phone}')) {
      return c.json({ error: 'قالب رسالة التذكير يجب أن يحتوي على {phone}' }, 400);
    }
    updates.push({ key: 'renewal_banner_template', value: body.renewal_banner_template.trim() });
  }

  if (body.expired_lockout_template !== undefined) {
    if (typeof body.expired_lockout_template !== 'string' || !body.expired_lockout_template.includes('{phone}')) {
      return c.json({ error: 'قالب رسالة الإقفال يجب أن يحتوي على {phone}' }, 400);
    }
    updates.push({ key: 'expired_lockout_template', value: body.expired_lockout_template.trim() });
  }

  if (body.trial_duration_days !== undefined) {
    const days = Number(body.trial_duration_days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return c.json({ error: 'مدة التجربة يجب أن تكون رقماً صحيحاً بين 1 و 365 يوماً' }, 400);
    }
    updates.push({ key: 'trial_duration_days', value: String(days) });
  }

  if (updates.length === 0) return c.json({ error: 'لا توجد بيانات للتحديث' }, 400);

  for (const u of updates) {
    await c.env.DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    )
      .bind(u.key, u.value)
      .run();
  }

  const settings = await getPlatformSettings(c.env.DB);
  return c.json({ ok: true, settings });
});

/** Preview helper: the exact lockout message customers/owners would see now. */
superAdminRoutes.get('/lockout-preview', requireSuperAdmin, async (c) => {
  const settings = await getPlatformSettings(c.env.DB);
  return c.json({ message: interpolateTemplate(settings.expired_lockout_template, settings) });
});
