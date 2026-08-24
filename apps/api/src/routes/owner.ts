import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireOwner } from './auth';
import { sendNotification } from '../notify';
import {
  isValidTime,
  formatTime12Ar,
  SALON_ID,
  sha256,
  isPositiveInt,
  isPositivePrice,
  isValidDuration,
  isValidUrlOrDataUri,
} from '../utils';

export const ownerRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
ownerRoutes.use('*', requireOwner);

// ---------- Owner Change Password ----------

ownerRoutes.post('/change-password', async (c) => {
  const owner = c.get('owner');
  const body = await c.req.json().catch(() => ({} as any));
  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return c.json({ error: 'كلمة المرور الحالية والجديدة مطلوبتان' }, 400);
  }

  if (newPassword.length < 6 || newPassword.length > 100) {
    return c.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل وبحد أقصى 100 خانة' }, 400);
  }

  const ownerRecord = await c.env.DB.prepare(
    'SELECT password_hash FROM owners WHERE id = ? AND salon_id = ?',
  )
    .bind(owner.id, SALON_ID)
    .first<{ password_hash: string }>();

  if (!ownerRecord) return c.json({ error: 'الحساب غير موجود' }, 404);

  // 1. Verify current password
  const currentHash = await sha256(currentPassword);
  if (ownerRecord.password_hash !== currentHash) {
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

// ---------- Barbers CRUD — PRD 3.3 ----------

ownerRoutes.get('/barbers', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM barbers WHERE salon_id = ? ORDER BY name')
    .bind(SALON_ID)
    .all();
  return c.json({ barbers: results });
});

ownerRoutes.post('/barbers', async (c) => {
  const { name, photo_url } = await c.req.json().catch(() => ({} as any));
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 60) {
    return c.json({ error: 'اسم الحلاق مطلوب (بين 2 و 60 حرفاً)' }, 400);
  }
  if (photo_url && !isValidUrlOrDataUri(photo_url)) {
    return c.json({ error: 'رابط صورة الحلاق غير صالح' }, 400);
  }

  const res = await c.env.DB.prepare('INSERT INTO barbers (name, photo_url, salon_id) VALUES (?, ?, ?) RETURNING id')
    .bind(name.trim(), photo_url?.trim() || null, SALON_ID)
    .first<{ id: number }>();
  return c.json({ id: res!.id }, 201);
});

ownerRoutes.patch('/barbers/:id', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const id = Number(idRaw);

  const body = await c.req.json().catch(() => ({} as any));
  const fields: string[] = [];
  const values: any[] = [];

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 60) {
      return c.json({ error: 'اسم الحلاق يجب أن يكون بين 2 و 60 حرفاً' }, 400);
    }
    fields.push('name = ?');
    values.push(body.name.trim());
  }

  if (body.photo_url !== undefined) {
    if (body.photo_url && !isValidUrlOrDataUri(body.photo_url)) {
      return c.json({ error: 'رابط صورة الحلاق غير صالح' }, 400);
    }
    fields.push('photo_url = ?');
    values.push(body.photo_url ? String(body.photo_url).trim() : null);
  }

  if (body.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(body.is_active ? 1 : 0);
  }

  if (fields.length === 0) return c.json({ error: 'لا توجد بيانات للتحديث' }, 400);
  values.push(id, SALON_ID);

  const res = await c.env.DB.prepare(`UPDATE barbers SET ${fields.join(', ')} WHERE id = ? AND salon_id = ?`).bind(...values).run();
  if (res.meta.changes === 0) return c.json({ error: 'الحلاق غير موجود' }, 404);
  return c.json({ ok: true });
});

ownerRoutes.delete('/barbers/:id', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const id = Number(idRaw);

  const res = await c.env.DB.prepare('DELETE FROM barbers WHERE id = ? AND salon_id = ?').bind(id, SALON_ID).run();
  if (res.meta.changes === 0) return c.json({ error: 'الحلاق غير موجود' }, 404);
  return c.json({ ok: true });
});

// ---------- Services per barber — PRD 3.4 ----------

ownerRoutes.get('/barbers/:id/services', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM services WHERE barber_id = ? AND salon_id = ? ORDER BY name',
  )
    .bind(barberId, SALON_ID)
    .all();
  return c.json({ services: results });
});

ownerRoutes.post('/barbers/:id/services', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { name, price, duration_minutes } = await c.req.json().catch(() => ({} as any));
  const err = validateService(name, price, duration_minutes);
  if (err) return c.json({ error: err }, 400);

  // Verify barber exists
  const barber = await c.env.DB.prepare('SELECT id FROM barbers WHERE id = ? AND salon_id = ?')
    .bind(barberId, SALON_ID)
    .first();
  if (!barber) return c.json({ error: 'الحلاق غير موجود' }, 404);

  const res = await c.env.DB.prepare(
    'INSERT INTO services (barber_id, name, price, duration_minutes, salon_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(barberId, name.trim(), Number(price), Number(duration_minutes), SALON_ID)
    .first<{ id: number }>();
  return c.json({ id: res!.id }, 201);
});

ownerRoutes.patch('/services/:id', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الخدمة غير صالح' }, 400);
  const id = Number(idRaw);

  const { name, price, duration_minutes } = await c.req.json().catch(() => ({} as any));
  const err = validateService(name, price, duration_minutes);
  if (err) return c.json({ error: err }, 400);

  const res = await c.env.DB.prepare(
    'UPDATE services SET name = ?, price = ?, duration_minutes = ? WHERE id = ? AND salon_id = ?',
  )
    .bind(name.trim(), Number(price), Number(duration_minutes), id, SALON_ID)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'الخدمة غير موجودة' }, 404);
  return c.json({ ok: true });
});

ownerRoutes.delete('/services/:id', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الخدمة غير صالح' }, 400);
  const id = Number(idRaw);

  const res = await c.env.DB.prepare('DELETE FROM services WHERE id = ? AND salon_id = ?')
    .bind(id, SALON_ID)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'الخدمة غير موجودة' }, 404);
  return c.json({ ok: true });
});

function validateService(name: any, price: any, duration: any): string | null {
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return 'اسم الخدمة مطلوب (بين 2 و 80 حرفاً)';
  }
  if (!isPositivePrice(price)) {
    return 'سعر غير صالح (يجب أن يكون رقماً موجباً بين 0.1 و 10,000)';
  }
  if (!isValidDuration(duration)) {
    return 'مدة غير صالحة (يجب أن تكون بين 5 و 480 دقيقة)';
  }
  return null;
}

// ---------- Work schedules per barber — PRD 3.3 / 3.10 ----------

ownerRoutes.get('/barbers/:id/schedule', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM work_schedules WHERE barber_id = ? AND salon_id = ? ORDER BY day_of_week',
  )
    .bind(barberId, SALON_ID)
    .all();
  return c.json({ schedule: results });
});

// Replace the full week schedule: [{ day_of_week, start_time, end_time, is_day_off }]
ownerRoutes.put('/barbers/:id/schedule', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { days } = await c.req.json().catch(() => ({} as any));
  if (!Array.isArray(days) || days.length === 0 || days.length > 7) {
    return c.json({ error: 'صيغة جدول المواعيد غير صالحة' }, 400);
  }

  const stmts = [c.env.DB.prepare('DELETE FROM work_schedules WHERE barber_id = ? AND salon_id = ?').bind(barberId, SALON_ID)];
  for (const d of days) {
    const dow = Number(d.day_of_week);
    const off = d.is_day_off ? 1 : 0;
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) return c.json({ error: 'يوم غير صالح' }, 400);
    if (!off && (!isValidTime(d.start_time) || !isValidTime(d.end_time) || d.start_time >= d.end_time)) {
      return c.json({ error: `وقت غير صالح لليوم ${dow} (يجب أن يكون وقت البداية قبل النهاية)` }, 400);
    }
    stmts.push(
      c.env.DB.prepare(
        'INSERT INTO work_schedules (barber_id, day_of_week, start_time, end_time, is_day_off, salon_id) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind(barberId, dow, d.start_time ?? '09:00', d.end_time ?? '21:00', off, SALON_ID),
    );
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ---------- Bookings management — PRD 3.6 / 3.7 / 3.10 ----------

ownerRoutes.get('/bookings', async (c) => {
  const { barber_id, date, status, from, to } = c.req.query();
  const where: string[] = ['bk.salon_id = ?'];
  const params: any[] = [SALON_ID];

  if (barber_id && isPositiveInt(barber_id)) {
    where.push('bk.barber_id = ?');
    params.push(Number(barber_id));
  }
  if (date && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    where.push('bk.booking_date = ?');
    params.push(date);
  }
  if (from && typeof from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    where.push('bk.booking_date >= ?');
    params.push(from);
  }
  if (to && typeof to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    where.push('bk.booking_date <= ?');
    params.push(to);
  }
  if (status && ['confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
    where.push('bk.status = ?');
    params.push(status);
  }

  const sql = `
    SELECT bk.*, cu.username AS customer_name, cu.phone AS customer_phone, br.name AS barber_name
    FROM bookings bk
    JOIN customers cu ON cu.id = bk.customer_id
    JOIN barbers br ON br.id = bk.barber_id
    WHERE ${where.join(' AND ')}
    ORDER BY bk.created_at DESC
    LIMIT 500`;
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();

  // Attach service snapshots
  const ids = (results as any[]).map((b) => b.id);
  let services: any[] = [];
  if (ids.length) {
    const { results: svc } = await c.env.DB.prepare(
      `SELECT booking_id, name, price, duration_minutes FROM booking_services
       WHERE booking_id IN (${ids.map(() => '?').join(',')})`,
    )
      .bind(...ids)
      .all();
    services = svc as any[];
  }
  return c.json({
    bookings: (results as any[]).map((b) => ({
      ...b,
      services: services.filter((s) => s.booking_id === b.id),
    })),
  });
});

ownerRoutes.post('/bookings/:id/cancel', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحجز غير صالح' }, 400);
  const id = Number(idRaw);

  const booking = await c.env.DB.prepare(
    `SELECT bk.*, cu.username AS customer_name, br.name AS barber_name
     FROM bookings bk JOIN customers cu ON cu.id = bk.customer_id JOIN barbers br ON br.id = bk.barber_id
     WHERE bk.id = ? AND bk.salon_id = ?`,
  )
    .bind(id, SALON_ID)
    .first<any>();
  if (!booking) return c.json({ error: 'الحجز غير موجود' }, 404);
  if (booking.status !== 'confirmed') return c.json({ error: 'لا يمكن إلغاء هذا الحجز' }, 400);

  await c.env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(id).run();
  await sendNotification(
    c, 'customer', booking.customer_id, 'cancellation',
    `تم إلغاء حجزك مع ${booking.barber_name} بتاريخ ${booking.booking_date} من قبل إدارة الصالون.`,
    id,
  );
  await notifyWaitlist(c, booking);
  return c.json({ ok: true });
});

ownerRoutes.post('/bookings/:id/no-show', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحجز غير صالح' }, 400);
  const id = Number(idRaw);

  const res = await c.env.DB.prepare(
    "UPDATE bookings SET status = 'no_show' WHERE id = ? AND salon_id = ? AND status IN ('confirmed','completed')",
  )
    .bind(id, SALON_ID)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'الحجز غير موجود أو لا يمكن تعليمه' }, 404);
  return c.json({ ok: true });
});

ownerRoutes.post('/bookings/:id/complete', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحجز غير صالح' }, 400);
  const id = Number(idRaw);

  const res = await c.env.DB.prepare(
    "UPDATE bookings SET status = 'completed' WHERE id = ? AND salon_id = ? AND status = 'confirmed'",
  )
    .bind(id, SALON_ID)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'الحجز غير موجود أو لا يمكن تعليمه' }, 404);
  return c.json({ ok: true });
});

/** Notify all waitlisted customers whose requested slot overlaps a freed booking. */
export async function notifyWaitlist(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<any>,
  booking: { barber_id: number; booking_date: string; start_time: string; end_time: string },
) {
  const { results } = await c.env.DB.prepare(
    `SELECT w.id, w.customer_id FROM waitlist w
     WHERE w.barber_id = ? AND w.desired_date = ? AND w.status = 'waiting' AND w.salon_id = ?
       AND w.start_time < ? AND w.end_time > ?`,
  )
    .bind(booking.barber_id, booking.booking_date, SALON_ID, booking.end_time, booking.start_time)
    .all();

  for (const w of results as any[]) {
    await c.env.DB.prepare("UPDATE waitlist SET status = 'notified' WHERE id = ?").bind(w.id).run();
    await sendNotification(
      c, 'customer', w.customer_id, 'waitlist_available',
      `أصبح الموعد الذي كنت تنتظره متاحاً (${booking.booking_date} الساعة ${formatTime12Ar(booking.start_time)}) — احجز الآن!`,
      null,
    );
  }
}

// ---------- Reports & statistics — PRD 3.10 ----------

ownerRoutes.get('/stats', async (c) => {
  const db = c.env.DB;
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const daily = await db.prepare(
    `SELECT booking_date AS date, COUNT(*) AS count FROM bookings
     WHERE booking_date BETWEEN ? AND ? AND status != 'cancelled' AND salon_id = ?
     GROUP BY booking_date ORDER BY booking_date`,
  ).bind(weekAgo, today, SALON_ID).all();

  const revenue = await db.prepare(
    `SELECT COALESCE(SUM(total_price), 0) AS expected_revenue, COUNT(*) AS bookings
     FROM bookings WHERE booking_date BETWEEN ? AND ? AND status IN ('confirmed','completed') AND salon_id = ?`,
  ).bind(weekAgo, today, SALON_ID).first();

  const topServices = await db.prepare(
    `SELECT bs.name, COUNT(*) AS count, SUM(bs.price) AS revenue
     FROM booking_services bs
     JOIN bookings bk ON bk.id = bs.booking_id
     WHERE bk.status != 'cancelled' AND bk.salon_id = ?
     GROUP BY bs.name ORDER BY count DESC LIMIT 5`,
  ).bind(SALON_ID).all();

  const noShows = await db.prepare(
    `SELECT cu.username AS customer_name, br.name AS barber_name, COUNT(*) AS count
     FROM bookings bk
     JOIN customers cu ON cu.id = bk.customer_id
     JOIN barbers br ON br.id = bk.barber_id
     WHERE bk.status = 'no_show' AND bk.salon_id = ?
     GROUP BY bk.customer_id, bk.barber_id ORDER BY count DESC LIMIT 10`,
  ).bind(SALON_ID).all();

  const totals = await db.prepare(
    `SELECT status, COUNT(*) AS count FROM bookings WHERE salon_id = ? GROUP BY status`,
  ).bind(SALON_ID).all();

  return c.json({
    daily: daily.results,
    week: revenue,
    top_services: topServices.results,
    no_shows: noShows.results,
    totals: totals.results,
  });
});

// ---------- Owner notifications ----------

ownerRoutes.get('/notifications', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE recipient_type = 'owner' AND salon_id = ?
     ORDER BY id DESC LIMIT 100`,
  ).bind(SALON_ID).all();
  return c.json({ notifications: results });
});

ownerRoutes.post('/notifications/read-all', async (c) => {
  await c.env.DB.prepare("UPDATE notifications SET is_read = 1 WHERE recipient_type = 'owner' AND salon_id = ?")
    .bind(SALON_ID)
    .run();
  return c.json({ ok: true });
});
