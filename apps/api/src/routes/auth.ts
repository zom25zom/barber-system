import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables, Customer } from '../types';
import {
  sha256,
  randomToken,
  SALON_ID,
  getClientIP,
  checkRateLimit,
  isValidUsername,
  isValidPhone,
} from '../utils';

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ---------- Owner Login (Rate limited: 5 attempts per 15 mins per IP) ----------

authRoutes.post('/owner/login', async (c) => {
  const ip = getClientIP(c);
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, SALON_ID, `owner_login:${ip}`, 5, 900);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfter || 60) / 60);
    return c.json(
      { error: `تم تجاوز الحد المسموح لمحاولات الدخول. يرجى المحاولة بعد ${minutes} دقيقة.` },
      429,
    );
  }

  const { username, password } = await c.req.json().catch(() => ({} as any));
  if (!isValidUsername(username) || typeof password !== 'string' || password.length < 1 || password.length > 100) {
    return c.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان بشكل صحيح' }, 400);
  }

  const owner = await c.env.DB.prepare(
    'SELECT id, username, password_hash FROM owners WHERE username = ? AND salon_id = ?',
  )
    .bind(username.trim(), SALON_ID)
    .first<{ id: number; username: string; password_hash: string }>();

  if (!owner || owner.password_hash !== (await sha256(password))) {
    return c.json({ error: 'بيانات الدخول غير صحيحة' }, 401);
  }

  const token = randomToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await c.env.DB.prepare('INSERT INTO sessions (token, owner_id, expires_at) VALUES (?, ?, ?)')
    .bind(token, owner.id, expires)
    .run();

  return c.json({ token, owner: { id: owner.id, username: owner.username } });
});

authRoutes.post('/owner/logout', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  return c.json({ ok: true });
});

// ---------- Owner Change Password (Requires current password verification) ----------

authRoutes.post('/owner/change-password', async (c) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);

  const owner = await c.env.DB.prepare(
    `SELECT o.id, o.username, o.password_hash FROM sessions s JOIN owners o ON o.id = s.owner_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND o.salon_id = ?`,
  )
    .bind(token, SALON_ID)
    .first<{ id: number; username: string; password_hash: string }>();

  if (!owner) return c.json({ error: 'غير مصرح أو انتهت صلاحية الجلسة' }, 401);

  const body = await c.req.json().catch(() => ({} as any));
  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return c.json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' }, 400);
  }

  if (newPassword.length < 6 || newPassword.length > 100) {
    return c.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل وبحد أقصى 100 خانة' }, 400);
  }

  // 1. Verify current password
  const currentHash = await sha256(currentPassword);
  if (owner.password_hash !== currentHash) {
    return c.json({ error: 'كلمة المرور الحالية غير صحيحة' }, 400);
  }

  if (currentPassword === newPassword) {
    return c.json({ error: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية' }, 400);
  }

  // 2. Hash & update new password
  const newHash = await sha256(newPassword);
  await c.env.DB.prepare('UPDATE owners SET password_hash = ? WHERE id = ? AND salon_id = ?')
    .bind(newHash, owner.id, SALON_ID)
    .run();

  return c.json({ ok: true, message: 'تم تغيير كلمة المرور بنجاح' });
});

// ---------- Customer Register (Rate limited: 5 attempts per 15 mins per IP) ----------

authRoutes.post('/customer/register', async (c) => {
  const ip = getClientIP(c);
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, SALON_ID, `cust_register:${ip}`, 5, 900);
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
    .bind(SALON_ID, cleanUsername, cleanPhone)
    .first();
  if (exists) return c.json({ error: 'اسم المستخدم أو رقم الهاتف مسجل مسبقاً، سجّل دخولك' }, 409);

  const token = randomToken();
  const passwordHash = await sha256(password);
  const res = await c.env.DB.prepare(
    'INSERT INTO customers (username, phone, token, password_hash, salon_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(cleanUsername, cleanPhone, token, passwordHash, SALON_ID)
    .first<{ id: number }>();

  // No auto-login: the customer must sign in explicitly with phone + password
  return c.json(
    { ok: true, customer: { id: res!.id, username: cleanUsername, phone: cleanPhone } },
    201,
  );
});

// ---------- Customer Login (Rate limited: 5 attempts per 15 mins per IP) ----------

authRoutes.post('/customer/login', async (c) => {
  const ip = getClientIP(c);
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, SALON_ID, `cust_login:${ip}`, 5, 900);
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
    .bind(SALON_ID, cleanPhone)
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

export const requireOwner = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);
  const row = await c.env.DB.prepare(
    `SELECT o.id, o.username FROM sessions s JOIN owners o ON o.id = s.owner_id
     WHERE s.token = ? AND s.expires_at > datetime('now') AND o.salon_id = ?`,
  )
    .bind(token, SALON_ID)
    .first<{ id: number; username: string }>();
  if (!row) return c.json({ error: 'غير مصرح' }, 401);
  c.set('owner', row);
  await next();
});

export const requireCustomer = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const token = bearer(c);
  if (!token) return c.json({ error: 'غير مصرح' }, 401);
  const row = await c.env.DB.prepare('SELECT id, username, phone FROM customers WHERE token = ? AND salon_id = ?')
    .bind(token, SALON_ID)
    .first<Customer>();
  if (!row) return c.json({ error: 'غير مصرح' }, 401);
  c.set('customer', row);
  await next();
});
