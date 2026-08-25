import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireOwner } from './auth';
import { sendNotification } from '../notify';
import { scheduleBookingReminder } from '../reminders';
import { deleteOldUpload } from '../cleanup';
import { servicesDuration } from './public';
import {
  isValidDate,
  isValidTime,
  toMinutes,
  toHHMM,
  dayOfWeek,
  formatTime12Ar,
  SALON_ID,
  sha256,
  isPositiveInt,
  isPositivePrice,
  isValidDuration,
  isValidUrlOrDataUri,
  addDaysISO,
  salonNow,
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

    // Fetch the old photo URL before overwriting it, then delete its file from storage
    const current = await c.env.DB.prepare('SELECT photo_url FROM barbers WHERE id = ? AND salon_id = ?')
      .bind(id, SALON_ID)
      .first<{ photo_url: string | null }>();

    const newPhotoUrl = body.photo_url ? String(body.photo_url).trim() : null;
    const cleanedUp = await deleteOldUpload(c.env.DB, c.env.BUCKET, current?.photo_url, newPhotoUrl);
    if (!cleanedUp) {
      return c.json({ error: 'تعذر حذف الصورة القديمة من التخزين، لم يتم حفظ الرابط الجديد' }, 500);
    }

    fields.push('photo_url = ?');
    values.push(newPhotoUrl);
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
    return 'سعر غير صالح (يجب أن يكون رقماً أكبر من الصفر)';
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

// ---------- Specific Date Time Off (الإجازات المحددة بالتاريخ) ----------

ownerRoutes.get('/barbers/:id/time-off', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM barber_time_off WHERE barber_id = ? AND salon_id = ? ORDER BY date ASC',
  )
    .bind(barberId, SALON_ID)
    .all();
  return c.json({ time_off: results });
});

ownerRoutes.post('/barbers/:id/time-off', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { date, reason } = await c.req.json().catch(() => ({} as any));
  if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'تاريخ الإجازة غير صالح (YYYY-MM-DD)' }, 400);
  }

  // Check barber exists
  const barber = await c.env.DB.prepare('SELECT id FROM barbers WHERE id = ? AND salon_id = ?')
    .bind(barberId, SALON_ID)
    .first();
  if (!barber) return c.json({ error: 'الحلاق غير موجود' }, 404);

  try {
    const res = await c.env.DB.prepare(
      'INSERT INTO barber_time_off (barber_id, date, reason, salon_id) VALUES (?, ?, ?, ?) RETURNING id',
    )
      .bind(barberId, date, reason ? String(reason).trim() : null, SALON_ID)
      .first<{ id: number }>();
    return c.json({ id: res!.id, ok: true }, 201);
  } catch {
    return c.json({ error: 'هذا التاريخ مسجل مسبقاً كإجازة لهذا الحلاق' }, 409);
  }
});

ownerRoutes.delete('/barbers/:id/time-off/:timeOffId', async (c) => {
  const barberId = Number(c.req.param('id'));
  const timeOffId = Number(c.req.param('timeOffId'));
  if (!isPositiveInt(barberId) || !isPositiveInt(timeOffId)) {
    return c.json({ error: 'معرّف غير صالح' }, 400);
  }

  const res = await c.env.DB.prepare(
    'DELETE FROM barber_time_off WHERE id = ? AND barber_id = ? AND salon_id = ?',
  )
    .bind(timeOffId, barberId, SALON_ID)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'سجل الإجازة غير موجود' }, 404);
  return c.json({ ok: true });
});

// ---------- Daily Breaks (فترات الاستراحة اليومية المتعددة) ----------

ownerRoutes.get('/barbers/:id/breaks', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM barber_breaks WHERE barber_id = ? AND salon_id = ? ORDER BY day_of_week ASC, start_time ASC',
  )
    .bind(barberId, SALON_ID)
    .all();
  return c.json({ breaks: results });
});

ownerRoutes.post('/barbers/:id/breaks', async (c) => {
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  const barberId = Number(idRaw);

  const { day_of_week, start_time, end_time } = await c.req.json().catch(() => ({} as any));
  const dow = Number(day_of_week);

  if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
    return c.json({ error: 'يوم الأسبوع غير صالح (0-6)' }, 400);
  }
  if (!isValidTime(start_time) || !isValidTime(end_time) || start_time >= end_time) {
    return c.json({ error: 'وقت الاستراحة غير صالح (يجب أن يكون وقت البداية قبل وقت النهاية)' }, 400);
  }

  // Check barber exists
  const barber = await c.env.DB.prepare('SELECT id FROM barbers WHERE id = ? AND salon_id = ?')
    .bind(barberId, SALON_ID)
    .first();
  if (!barber) return c.json({ error: 'الحلاق غير موجود' }, 404);

  const res = await c.env.DB.prepare(
    'INSERT INTO barber_breaks (barber_id, day_of_week, start_time, end_time, salon_id) VALUES (?, ?, ?, ?, ?) RETURNING id',
  )
    .bind(barberId, dow, start_time, end_time, SALON_ID)
    .first<{ id: number }>();

  return c.json({ id: res!.id, ok: true }, 201);
});

ownerRoutes.delete('/barbers/:id/breaks/:breakId', async (c) => {
  const barberId = Number(c.req.param('id'));
  const breakId = Number(c.req.param('breakId'));
  if (!isPositiveInt(barberId) || !isPositiveInt(breakId)) {
    return c.json({ error: 'معرّف غير صالح' }, 400);
  }

  const res = await c.env.DB.prepare(
    'DELETE FROM barber_breaks WHERE id = ? AND barber_id = ? AND salon_id = ?',
  )
    .bind(breakId, barberId, SALON_ID)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'سجل الاستراحة غير موجود' }, 404);
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

// ---------- Customers lookup / search for manual booking ----------

ownerRoutes.get('/customers', async (c) => {
  const q = c.req.query('q');
  if (q && typeof q === 'string' && q.trim()) {
    const term = `%${q.trim()}%`;
    const { results } = await c.env.DB.prepare(
      `SELECT id, username, phone FROM customers
       WHERE salon_id = ? AND (username LIKE ? OR phone LIKE ?)
       ORDER BY username LIMIT 30`,
    )
      .bind(SALON_ID, term, term)
      .all();
    return c.json({ customers: results });
  }

  const { results } = await c.env.DB.prepare(
    'SELECT id, username, phone FROM customers WHERE salon_id = ? ORDER BY id DESC LIMIT 50',
  )
    .bind(SALON_ID)
    .all();
  return c.json({ customers: results });
});

// ---------- Manual booking creation by owner ----------

ownerRoutes.post('/bookings', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const {
    customer_id,
    customer_name,
    customer_phone,
    barber_id,
    service_ids,
    date,
    start_time,
  } = body;

  // 1. Resolve or create customer
  let customer: { id: number; username: string; phone: string } | null = null;
  if (customer_id && isPositiveInt(customer_id)) {
    customer = await c.env.DB.prepare(
      'SELECT id, username, phone FROM customers WHERE id = ? AND salon_id = ?',
    )
      .bind(Number(customer_id), SALON_ID)
      .first<{ id: number; username: string; phone: string }>();
    if (!customer) return c.json({ error: 'الزبون المحدد غير موجود' }, 404);
  } else if (customer_name && customer_phone) {
    const cName = String(customer_name).trim();
    const cPhone = String(customer_phone).trim();
    if (cName.length < 2 || cName.length > 60) {
      return c.json({ error: 'اسم الزبون مطلوب (بين 2 و 60 حرفاً)' }, 400);
    }
    if (cPhone.length < 6 || cPhone.length > 30) {
      return c.json({ error: 'رقم هاتف الزبون غير صالح (6 خانات على الأقل)' }, 400);
    }

    // Check if customer with this phone already exists
    const existing = await c.env.DB.prepare(
      'SELECT id, username, phone FROM customers WHERE phone = ? AND salon_id = ?',
    )
      .bind(cPhone, SALON_ID)
      .first<{ id: number; username: string; phone: string }>();

    if (existing) {
      customer = existing;
    } else {
      const token = crypto.randomUUID();
      const newCust = await c.env.DB.prepare(
        'INSERT INTO customers (username, phone, token, salon_id) VALUES (?, ?, ?, ?) RETURNING id, username, phone',
      )
        .bind(cName, cPhone, token, SALON_ID)
        .first<{ id: number; username: string; phone: string }>();
      customer = newCust;
    }
  } else {
    return c.json({ error: 'يرجى تحديد زبون موجود أو إدخال اسم ورقم هاتف الزبون' }, 400);
  }

  if (!isPositiveInt(barber_id)) {
    return c.json({ error: 'معرّف الحلاق غير صالح' }, 400);
  }

  if (
    !Array.isArray(service_ids) ||
    service_ids.length === 0 ||
    service_ids.length > 10 ||
    !service_ids.every((id) => isPositiveInt(id))
  ) {
    return c.json({ error: 'يرجى اختيار خدمة واحدة صالحة على الأقل (بحد أقصى 10 خدمات)' }, 400);
  }

  if (!isValidDate(date)) {
    return c.json({ error: 'تاريخ الحجز غير صالح (YYYY-MM-DD)' }, 400);
  }

  if (!isValidTime(start_time)) {
    return c.json({ error: 'وقت الحجز غير صالح (HH:MM)' }, 400);
  }

  const barber = await c.env.DB.prepare(
    'SELECT id, name FROM barbers WHERE id = ? AND is_active = 1 AND salon_id = ?',
  )
    .bind(Number(barber_id), SALON_ID)
    .first<{ id: number; name: string }>();
  if (!barber) return c.json({ error: 'الحلاق غير متاح' }, 404);

  const ids = service_ids.map(Number);
  const totalDuration = await servicesDuration(c.env.DB, barber.id, ids);
  if (totalDuration == null) return c.json({ error: 'خدمات غير صالحة لهذا الحلاق' }, 400);

  // Check specific date time-off (إجازة مخصصة بتاريخ محدد)
  const timeOff = await c.env.DB.prepare(
    'SELECT id, reason FROM barber_time_off WHERE barber_id = ? AND date = ? AND salon_id = ?',
  )
    .bind(barber.id, date, SALON_ID)
    .first<{ id: number; reason: string | null }>();
  if (timeOff) {
    return c.json(
      { error: `الحلاق في إجازة خاصة بتاريخ ${date}${timeOff.reason ? ` (${timeOff.reason})` : ''}` },
      400,
    );
  }

  // Check weekly schedule
  const schedule = await c.env.DB.prepare(
    'SELECT start_time, end_time, is_day_off FROM work_schedules WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?',
  )
    .bind(barber.id, dayOfWeek(date), SALON_ID)
    .first<{ start_time: string; end_time: string; is_day_off: number }>();
  if (!schedule || schedule.is_day_off) {
    return c.json({ error: 'الحلاق في عطلة أسبوعية بهذا اليوم' }, 400);
  }

  const start = toMinutes(start_time);
  const end = start + totalDuration;
  if (start < toMinutes(schedule.start_time) || end > toMinutes(schedule.end_time)) {
    return c.json({ error: 'الموعد المحدد يقع خارج ساعات دوام عمل الحلاق' }, 400);
  }

  // Check breaks for that day
  const { results: breaks } = await c.env.DB.prepare(
    'SELECT start_time, end_time FROM barber_breaks WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?',
  )
    .bind(barber.id, dayOfWeek(date), SALON_ID)
    .all<{ start_time: string; end_time: string }>();

  const overlapsBreak = (breaks as any[]).some((br) => {
    const bs = toMinutes(br.start_time);
    const be = toMinutes(br.end_time);
    return start < be && end > bs;
  });
  if (overlapsBreak) {
    return c.json({ error: 'الموعد يتعارض مع فترة استراحة الحلاق' }, 400);
  }

  const endTime = toHHMM(end);

  // Check conflict with other confirmed bookings
  const conflict = await c.env.DB.prepare(
    `SELECT id FROM bookings
     WHERE barber_id = ? AND booking_date = ? AND status = 'confirmed' AND salon_id = ?
       AND start_time < ? AND end_time > ?
     LIMIT 1`,
  )
    .bind(barber.id, date, SALON_ID, endTime, start_time)
    .first();
  if (conflict) {
    return c.json({ error: 'هذا الموعد يتعارض مع حجز مؤكد آخر للحلاق' }, 409);
  }

  // Snapshot services and compute total price
  const placeholders = ids.map(() => '?').join(',');
  const { results: svcRows } = await c.env.DB.prepare(
    `SELECT id, name, price, duration_minutes FROM services WHERE barber_id = ? AND id IN (${placeholders})`,
  )
    .bind(barber.id, ...ids)
    .all<any>();
  const totalPrice = (svcRows as any[]).reduce((s, r) => s + r.price, 0);

  const booking = await c.env.DB.prepare(
    `INSERT INTO bookings (customer_id, barber_id, booking_date, start_time, end_time, status, total_price, salon_id)
     VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?) RETURNING id`,
  )
    .bind(customer!.id, barber.id, date, start_time, endTime, totalPrice, SALON_ID)
    .first<{ id: number }>();

  const stmts = (svcRows as any[]).map((s) =>
    c.env.DB.prepare(
      'INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes) VALUES (?, ?, ?, ?, ?)',
    ).bind(booking!.id, s.id, s.name, s.price, s.duration_minutes),
  );
  await c.env.DB.batch(stmts);

  // Schedule a push reminder 20 minutes before the appointment (skipped for urgent bookings)
  await scheduleBookingReminder(c.env, booking!.id, date, start_time);

  // Notify customer
  await sendNotification(
    c,
    'customer',
    customer!.id,
    'new_booking',
    `تم تسجيل حجز جديد لك مع الحلاق ${barber.name} بتاريخ ${date} الساعة ${formatTime12Ar(start_time)}.`,
    booking!.id,
  );

  return c.json(
    {
      ok: true,
      booking_id: booking!.id,
      customer_id: customer!.id,
      customer_name: customer!.username,
      status: 'confirmed',
      total_price: totalPrice,
      end_time: endTime,
    },
    201,
  );
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
    `تم إلغاء حجزك مع ${booking.barber_name} بتاريخ ${booking.booking_date}${booking.start_time ? ` الساعة ${formatTime12Ar(booking.start_time)}` : ''} من قبل إدارة الصالون.`,
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

// ---------- Financial & Peak Hours Analytics Reports ----------

ownerRoutes.get('/reports', async (c) => {
  const db = c.env.DB;
  const { period = 'this_month', from: qFrom, to: qTo } = c.req.query();
  // Salon-local "today" (Jordan UTC+3) — raw UTC would lag a day between 00:00-03:00 local.
  const now = salonNow();
  const today = now.toISOString().slice(0, 10);

  let startDate = today;
  let endDate = today;

  if (period === 'today') {
    startDate = today;
    endDate = today;
  } else if (period === 'this_week') {
    // Calendar week (Sunday..Saturday) in salon-local time — includes upcoming days
    const dow = now.getUTCDay(); // 0=Sunday
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow))
      .toISOString().slice(0, 10);
    endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow + 6))
      .toISOString().slice(0, 10);
  } else if (period === 'this_month') {
    // Calendar month — extends to end of month so future-dated bookings
    // (e.g. appointments already marked completed) are included.
    startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  } else if (period === 'week') {
    startDate = addDaysISO(today, -6);
    endDate = today;
  } else if (period === 'month') {
    startDate = addDaysISO(today, -29);
    endDate = today;
  } else if (period === 'custom') {
    startDate = qFrom && /^\d{4}-\d{2}-\d{2}$/.test(qFrom) ? qFrom : today;
    endDate = qTo && /^\d{4}-\d{2}-\d{2}$/.test(qTo) ? qTo : today;
    if (startDate > endDate) {
      const tmp = startDate;
      startDate = endDate;
      endDate = tmp;
    }
  }

  // Diagnostic log — verifies the exact inclusive range used by all report queries
  console.log(`[Reports] period=${period} | start_date=${startDate} | end_date=${endDate} (BETWEEN, end-day inclusive)`);

  // 1. Overall Summary
  const summary = await db.prepare(
    `SELECT 
       COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_price ELSE 0 END), 0) AS total_revenue,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END), 0) AS completed_revenue,
       COUNT(*) AS total_bookings,
       COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_count,
       COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) AS confirmed_count,
       COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
       COALESCE(SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END), 0) AS no_show_count
     FROM bookings
     WHERE salon_id = ? AND booking_date BETWEEN ? AND ?`,
  )
    .bind(SALON_ID, startDate, endDate)
    .first<{
      total_revenue: number;
      completed_revenue: number;
      total_bookings: number;
      completed_count: number;
      confirmed_count: number;
      cancelled_count: number;
      no_show_count: number;
    }>();

  // 2. Revenue & bookings per barber
  const { results: revenueByBarber } = await db.prepare(
    `SELECT 
       br.id AS barber_id,
       br.name AS barber_name,
       br.photo_url,
       COALESCE(SUM(CASE WHEN bk.status IN ('confirmed', 'completed') THEN bk.total_price ELSE 0 END), 0) AS revenue,
       COALESCE(SUM(CASE WHEN bk.status IN ('confirmed', 'completed') THEN 1 ELSE 0 END), 0) AS bookings_count,
       COALESCE(SUM(CASE WHEN bk.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed_count
     FROM barbers br
     LEFT JOIN bookings bk ON bk.barber_id = br.id AND bk.salon_id = br.salon_id AND bk.booking_date BETWEEN ? AND ?
     WHERE br.salon_id = ?
     GROUP BY br.id, br.name, br.photo_url
     ORDER BY revenue DESC`,
  )
    .bind(startDate, endDate, SALON_ID)
    .all();

  // 3. Revenue & count per service
  const { results: revenueByService } = await db.prepare(
    `SELECT 
       bs.name AS service_name,
       COUNT(*) AS count,
       COALESCE(SUM(bs.price), 0) AS revenue
     FROM booking_services bs
     JOIN bookings bk ON bk.id = bs.booking_id
     WHERE bk.salon_id = ? AND bk.status IN ('confirmed', 'completed') AND bk.booking_date BETWEEN ? AND ?
     GROUP BY bs.name
     ORDER BY revenue DESC`,
  )
    .bind(SALON_ID, startDate, endDate)
    .all();

  // 4. Daily Trend
  const { results: dailyTrend } = await db.prepare(
    `SELECT 
       booking_date AS date,
       COUNT(*) AS bookings_count,
       COALESCE(SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total_price ELSE 0 END), 0) AS revenue
     FROM bookings
     WHERE salon_id = ? AND booking_date BETWEEN ? AND ? AND status != 'cancelled'
     GROUP BY booking_date
     ORDER BY booking_date ASC`,
  )
    .bind(SALON_ID, startDate, endDate)
    .all();

  // 5. Peak Hours Heatmap Matrix (Days 0..6 x Hours)
  const { results: peakHours } = await db.prepare(
    `SELECT 
       CAST(strftime('%w', booking_date) AS INTEGER) AS day_of_week,
       CAST(substr(start_time, 1, 2) AS INTEGER) AS hour,
       COUNT(*) AS count
     FROM bookings
     WHERE salon_id = ? AND status != 'cancelled' AND booking_date BETWEEN ? AND ?
     GROUP BY day_of_week, hour
     ORDER BY day_of_week, hour`,
  )
    .bind(SALON_ID, startDate, endDate)
    .all();

  const completedAndConfirmed = (summary?.completed_count || 0) + (summary?.confirmed_count || 0);
  const avgTicket = completedAndConfirmed > 0
    ? Number(((summary?.total_revenue || 0) / completedAndConfirmed).toFixed(2))
    : 0;

  return c.json({
    period,
    from: startDate,
    to: endDate,
    summary: {
      total_revenue: summary?.total_revenue ?? 0,
      completed_revenue: summary?.completed_revenue ?? 0,
      total_bookings: summary?.total_bookings ?? 0,
      completed_count: summary?.completed_count ?? 0,
      confirmed_count: summary?.confirmed_count ?? 0,
      cancelled_count: summary?.cancelled_count ?? 0,
      no_show_count: summary?.no_show_count ?? 0,
      avg_ticket: avgTicket,
    },
    revenue_by_barber: revenueByBarber,
    revenue_by_service: revenueByService,
    daily_trend: dailyTrend,
    peak_hours: peakHours,
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
