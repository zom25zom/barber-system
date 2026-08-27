import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables, Customer } from '../types';
import {
  sha256,
  randomToken,
  resolvePublicSalonId,
  resolvePublicSalonStrict,
  getClientIP,
  checkRateLimit,
  isValidUsername,
  isValidPhone,
} from '../utils';

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ---------- Owner Login (Rate limited: 5 attempts per 5 mins per IP) ----------

authRoutes.post('/owner/login', async (c) => {
  const ip = getClientIP(c);
  const body = await c.req.json().catch(() => ({} as any));

  // ── Tenant resolution (multi-tenant) ──
  // Since migration 0009, owners.username is unique PER SALON only — never
  // globally. So the salon MUST be identifiable here. Priority:
  //   1. salonSlug sent explicitly in the JSON body (admin login form field,
  //      or the per-salon page /{salonSlug}/admin/login)
  //   2. ?salonSlug= query param / Host matching (resolvePublicSalonId)
  //   3. DEFAULT_SALON_ID fallback (single default-salon deployments only)
  let salonId: number;
  let salonInfo: { id: number; name: string; slug: string | null };

  const rawSlug = typeof body.salonSlug === 'string' ? body.salonSlug.trim() : '';
  if (rawSlug) {
    const slug = rawSlug.toLowerCase();
    if (!/^[a-zA-Z0-9-_]{1,60}$/.test(slug)) {
      return c.json({ error: 'معرّف الصالون غير صالح' }, 400);
    }
    const salon = await c.env.DB.prepare('SELECT id, name, slug FROM salons WHERE slug = ?')
      .bind(slug)
      .first<{ id: number; name: string; slug: string | null }>();
    if (!salon) {
      return c.json(
        { error: 'لم يتم العثور على صالون بهذا المعرّف. تأكد من رابط صالونك (مثال: salon-nkhba).' },
        404,
      );
    }
    salonId = salon.id;
    salonInfo = { id: salon.id, name: salon.name, slug: salon.slug };
  } else {
    const fallbackId = await resolvePublicSalonId(c);
    const salon = await c.env.DB.prepare('SELECT id, name, slug FROM salons WHERE id = ?')
      .bind(fallbackId)
      .first<{ id: number; name: string; slug: string | null }>();
    if (!salon) {
      return c.json(
        {
          error:
            'تعذر تحديد الصالون تلقائياً. يرجى إدخال حقل «معرّف الصالون» لتسجيل الدخول.',
        },
        400,
      );
    }
    salonId = salon.id;
    salonInfo = { id: salon.id, name: salon.name, slug: salon.slug };
  }

  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, salonId, `owner_login:${ip}`, 5, 300);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfter || 60) / 60);
    return c.json(
      { error: `تم تجاوز الحد المسموح لمحاولات الدخول. يرجى المحاولة بعد ${minutes} دقيقة.` },
      429,
    );
  }

  const { username, password } = body;
  if (!isValidUsername(username) || typeof password !== 'string' || password.length < 1 || password.length > 100) {
    return c.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان بشكل صحيح' }, 400);
  }

  const owner = await c.env.DB.prepare(
    'SELECT id, username, password_hash, salon_id FROM owners WHERE username = ? AND salon_id = ?',
  )
    .bind(username.trim(), salonId)
    .first<{ id: number; username: string; password_hash: string; salon_id: number }>();

  if (!owner || owner.password_hash !== (await sha256(password))) {
    return c.json({ error: 'بيانات الدخول غير صحيحة' }, 401);
  }

  const token = randomToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  // Tenant is bound INTO the session at creation time — every later request
  // reads salon_id from this row, never from client input.
  await c.env.DB.prepare(
    'INSERT INTO sessions (token, owner_id, expires_at, salon_id) VALUES (?, ?, ?, ?)',
  )
    .bind(token, owner.id, expires, owner.salon_id)
    .run();

  return c.json({ token, owner: { id: owner.id, username: owner.username }, salon: salonInfo });
});

authRoutes.post('/owner/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return c.json({ ok: true });
});

// ---------- Owner Change Password (direct reset) ----------

authRoutes.post('/owner/change-password', async (c) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);

  // Session row carries the tenant — join on sessions.salon_id directly
  const owner = await c.env.DB.prepare(
    `SELECT o.id, o.username, s.salon_id FROM sessions s JOIN owners o ON o.id = s.owner_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
  )
    .bind(token)
    .first<{ id: number; username: string; salon_id: number }>();

  if (!owner) return c.json({ error: 'غير مصرح أو انتهت صلاحية الجلسة' }, 401);

  const body = await c.req.json().catch(() => ({} as any));
  const { newPassword } = body;

  if (typeof newPassword !== 'string') {
    return c.json({ error: 'كلمة المرور الجديدة مطلوبة' }, 400);
  }

  if (newPassword.length < 6 || newPassword.length > 100) {
    return c.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل وبحد أقصى 100 خانة' }, 400);
  }

  // Direct reset: SQL UPDATE replaces the old hash in-place
  const newHash = await sha256(newPassword);
  await c.env.DB.prepare('UPDATE owners SET password_hash = ? WHERE id = ?')
    .bind(newHash, owner.id)
    .run();

  // Invalidate ALL active sessions for this owner (all devices re-login)
  await c.env.DB.prepare('DELETE FROM sessions WHERE owner_id = ?').bind(owner.id).run();

  return c.json({ ok: true, message: 'تم إعادة تعيين كلمة المرور بنجاح. يرجى تسجيل الدخول من جديد.' });
});

// ---------- Customer Register (Rate limited: 5 attempts per 5 mins per IP) ----------

authRoutes.post('/customer/register', async (c) => {
  const ip = getClientIP(c);
  // STRICT tenant resolution — registration is an identity INSERT: no salon,
  // no registration. Silent DEFAULT_SALON_ID fallbacks are FORBIDDEN here.
  const strict = await resolvePublicSalonStrict(c);
  if (!strict) {
    return c.json(
      {
        error:
          'تعذر تحديد صالونك من الرابط. افتح صفحة التسجيل من رابط صالونك (مثال: example.com/{slug}/register) وأعد المحاولة.',
      },
      400,
    );
  }
  const salonId = strict;
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, salonId, `cust_register:${ip}`, 5, 300);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfter || 60) / 60);
    return c.json(
      { error: `تم تجاوز الحد المسموح لمحاولات التسجيل. يرجى الانتظار ${minutes} دقيقة.` },
      429,
    );
  }

  const { username, phone, password } = await c.req.json().catch(() => ({} as any));

  if (!isValidUsername(username)) {
    return c.json({ error: 'اسم المستخدم مطلوب (بين 2 و 50 حرفاً بدون رموز خاصة)' }, 400);
  }
  if (!isValidPhone(phone)) {
    return c.json({ error: 'رقم هاتف غير صالح. يرجى إدخال رقم صحيح (بين 7 و 20 رقماً)' }, 400);
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return c.json({ error: 'كلمة المرور مطلوبة (6 خانات على الأقل وبحد أقصى 100 خانة)' }, 400);
  }

  const cleanUsername = username.trim();
  const cleanPhone = phone.trim();

  const exists = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE salon_id = ? AND (username = ? OR phone = ?)',
  )
    .bind(salonId, cleanUsername, cleanPhone)
    .first();
  if (exists) return c.json({ error: 'اسم المستخدم أو رقم الهاتف مسجل مسبقاً، سجّل دخولك' }, 409);

  const token = randomToken();
  const passwordHash = await sha256(password);

  let res;
  try {
    res = await c.env.DB.prepare(
      'INSERT INTO customers (username, phone, token, password_hash, salon_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
    )
      .bind(cleanUsername, cleanPhone, token, passwordHash, salonId)
      .first<{ id: number }>();
  } catch {
    // Defensive: catches the rare race where two registrations for the same
    // salon pass the check simultaneously and hit idx_customers_salon_*.
    return c.json({ error: 'اسم المستخدم أو رقم الهاتف سُجّل للتو من جلسة أخرى، حاول مرة أخرى' }, 409);
  }

  // No auto-login: the customer must sign in explicitly with phone + password
  return c.json(
    { ok: true, customer: { id: res!.id, username: cleanUsername, phone: cleanPhone } },
    201,
  );
});

// ---------- Customer Login (Rate limited: 5 attempts per 5 mins per IP) ----------

authRoutes.post('/customer/login', async (c) => {
  const ip = getClientIP(c);
  // STRICT resolution — a login without a confident tenant could match the
  // same phone in several salons. Require explicit salon context.
  const strict = await resolvePublicSalonStrict(c);
  if (!strict) {
    return c.json(
      {
        error:
          'تعذر تحديد صالونك من الرابط. استخدم رابط صالونك ثم سجّل الدخول (مثال: example.com/{slug}/login).',
      },
      400,
    );
  }
  const salonId = strict;
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, salonId, `cust_login:${ip}`, 5, 300);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfter || 60) / 60);
    return c.json(
      { error: `تم تجاوز الحد المسموح لمحاولات تسجيل الدخول. يرجى الانتظار ${minutes} دقيقة.` },
      429,
    );
  }

  const { phone, password } = await c.req.json().catch(() => ({} as any));
  if (!isValidPhone(phone)) {
    return c.json({ error: 'أدخل رقم هاتف صحيح' }, 400);
  }
  if (typeof password !== 'string' || password.length < 1 || password.length > 100) {
    return c.json({ error: 'كلمة المرور مطلوبة' }, 400);
  }

  const cleanPhone = phone.trim();
  const customer = await c.env.DB.prepare(
    'SELECT id, username, phone, token, password_hash FROM customers WHERE salon_id = ? AND phone = ?',
  )
    .bind(salonId, cleanPhone)
    .first<{ id: number; username: string; phone: string; token: string; password_hash: string }>();

  // Same verification mechanism as owner login: compare against the stored hash.
  // Empty hash = legacy account created before passwords existed → reject.
  if (
    !customer ||
    !customer.password_hash ||
    customer.password_hash !== (await sha256(password))
  ) {
    return c.json({ error: 'رقم الهاتف أو كلمة المرور غير صحيحة' }, 401);
  }

  // Rotate the token on each login to keep sessions fresh.
  const token = randomToken();
  await c.env.DB.prepare('UPDATE customers SET token = ? WHERE id = ?').bind(token, customer.id).run();
  return c.json({ token, customer: { id: customer.id, username: customer.username, phone: customer.phone } });
});

// ---------- Middleware ----------

function bearer(c: any): string | null {
  const h = c.req.header('Authorization');
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

/**
 * Owner auth — the session row itself carries salon_id (bound at login).
 * Any request is scoped to THAT tenant; client-supplied salon_id is ignored.
 */
export const requireOwner = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);
  const row = await c.env.DB.prepare(
    `SELECT o.id, o.username, s.salon_id FROM sessions s JOIN owners o ON o.id = s.owner_id
     WHERE s.token = ? AND s.expires_at > datetime('now')`,
  )
    .bind(token)
    .first<{ id: number; username: string; salon_id: number }>();
  if (!row) return c.json({ error: 'غير مصرح' }, 401);
  c.set('owner', { id: row.id, username: row.username });
  c.set('salonId', row.salon_id);
  await next();
});

/**
 * Customer auth — customers.salon_id IS the tenant binding for the token.
 */
export const requireCustomer = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);
  const row = await c.env.DB.prepare(
    'SELECT id, username, phone, salon_id FROM customers WHERE token = ?',
  )
    .bind(token)
    .first<Customer & { salon_id: number }>();
  if (!row) return c.json({ error: 'غير مصرح' }, 401);
  c.set('customer', { id: row.id, username: row.username, phone: row.phone });
  c.set('salonId', row.salon_id);
  await next();
});
