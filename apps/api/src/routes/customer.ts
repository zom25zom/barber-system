import { Hono } from 'hono';
import type { Bindings, Customer, Variables } from '../types';
import { requireCustomer } from './auth';
import { sendNotification, formatNewBookingMessage } from '../notify';
import { notifyWaitlist } from './owner';
import { servicesDuration } from './public';
import { scheduleBookingReminder } from '../reminders';
import {
  isValidDate,
  isValidTime,
  toMinutes,
  toHHMM,
  dayOfWeek,
  todayISO,
  formatTime12Ar,
  isPositiveInt,
  sha256,
  randomToken,
  isValidUsername,
  isValidPhone,
} from '../utils';

export const customerRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();
customerRoutes.use('*', requireCustomer);

// ---------- My profile (view / edit) ----------

customerRoutes.get('/profile', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const row = await c.env.DB.prepare(
    'SELECT id, username, phone FROM customers WHERE id = ? AND salon_id = ?',
  )
    .bind(customer.id, salonId)
    .first<Customer>();
  if (!row) return c.json({ error: 'الحساب غير موجود' }, 404);
  return c.json({ customer: row });
});

customerRoutes.patch('/profile', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const body = await c.req.json().catch(() => ({} as any));

  const updates: string[] = [];
  const values: any[] = [];

  if (body.username !== undefined) {
    if (!isValidUsername(body.username)) {
      return c.json({ error: 'الاسم مطلوب (بين 2 و 50 حرفاً بدون رموز خاصة)' }, 400);
    }
    const cleanUsername = body.username.trim();
    const taken = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE salon_id = ? AND username = ? AND id != ?',
    )
      .bind(salonId, cleanUsername, customer.id)
      .first();
    if (taken) return c.json({ error: 'هذا الاسم مستخدم من حساب آخر' }, 409);
    updates.push('username = ?');
    values.push(cleanUsername);
  }

  if (body.phone !== undefined) {
    if (!isValidPhone(body.phone)) {
      return c.json({ error: 'رقم هاتف غير صالح. يرجى إدخال رقم صحيح (بين 7 و 20 رقماً)' }, 400);
    }
    const cleanPhone = body.phone.trim();
    const taken = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE salon_id = ? AND phone = ? AND id != ?',
    )
      .bind(salonId, cleanPhone, customer.id)
      .first();
    if (taken) return c.json({ error: 'رقم الهاتف مسجل على حساب آخر' }, 409);
    updates.push('phone = ?');
    values.push(cleanPhone);
  }

  if (updates.length === 0) return c.json({ error: 'لا توجد بيانات للتحديث' }, 400);
  values.push(customer.id, salonId);

  const updated = await c.env.DB.prepare(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND salon_id = ? RETURNING id, username, phone`,
  )
    .bind(...values)
    .first<Customer>();

  return c.json({ ok: true, customer: updated });
});

// ---------- Change password (requires current password) ----------

customerRoutes.post('/change-password', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const body = await c.req.json().catch(() => ({} as any));
  const { newPassword } = body;

  if (typeof newPassword !== 'string') {
    return c.json({ error: 'كلمة المرور الجديدة مطلوبة' }, 400);
  }
  if (newPassword.length < 6 || newPassword.length > 100) {
    return c.json({ error: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل وبحد أقصى 100 خانة' }, 400);
  }

  const exists = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE id = ? AND salon_id = ?',
  )
    .bind(customer.id, salonId)
    .first();
  if (!exists) return c.json({ error: 'الحساب غير موجود' }, 404);

  // Direct reset: SQL UPDATE replaces the old hash in-place
  const newHash = await sha256(newPassword);

  // Rotate the session token → any other device using the old token is logged out instantly
  const newToken = randomToken();
  await c.env.DB.prepare('UPDATE customers SET password_hash = ?, token = ? WHERE id = ? AND salon_id = ?')
    .bind(newHash, newToken, customer.id, salonId)
    .run();

  return c.json({ ok: true, message: 'تم إعادة تعيين كلمة المرور بنجاح. يرجى تسجيل الدخول من جديد.' });
});

// ---------- Create booking — PRD 3.5 (auto-confirmed) ----------

customerRoutes.post('/bookings', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const body = await c.req.json().catch(() => ({} as any));
  const { barber_id, service_ids, date, start_time } = body;

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
    return c.json({ error: 'تاريخ الحجز غير صالح' }, 400);
  }

  if (!isValidTime(start_time)) {
    return c.json({ error: 'وقت الحجز غير صالح (HH:MM)' }, 400);
  }

  // Enforce single active booking policy: cannot book if already have a confirmed active booking
  const existingActive = await c.env.DB.prepare(
    "SELECT id, booking_date, start_time FROM bookings WHERE customer_id = ? AND status = 'confirmed' AND salon_id = ?",
  )
    .bind(customer.id, salonId)
    .first<{ id: number; booking_date: string; start_time: string }>();

  if (existingActive) {
    return c.json(
      {
        error: 'لديك حجز نشط بالفعل. لا يمكنك إجراء حجز جديد حتى يكتمل موعدك الحالي أو تقوم بإلغائه.',
        active_booking: existingActive,
      },
      400,
    );
  }

  const today = todayISO();
  const maxDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (date < today || date > maxDate) {
    return c.json({ error: 'الحجز متاح خلال أسبوع واحد فقط من تاريخ اليوم' }, 400);
  }

  const barber = await c.env.DB.prepare('SELECT id, name FROM barbers WHERE id = ? AND is_active = 1 AND salon_id = ?')
    .bind(Number(barber_id), salonId)
    .first<{ id: number; name: string }>();
  if (!barber) return c.json({ error: 'الحلاق غير متاح' }, 404);

  const ids = service_ids.map(Number);
  const totalDuration = await servicesDuration(c.env.DB, barber.id, ids);
  if (totalDuration == null) return c.json({ error: 'خدمات غير صالحة لهذا الحلاق' }, 400);

  // Validate against the barber's schedule
  const schedule = await c.env.DB.prepare(
    'SELECT start_time, end_time, is_day_off FROM work_schedules WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?',
  )
    .bind(barber.id, dayOfWeek(date), salonId)
    .first<{ start_time: string; end_time: string; is_day_off: number }>();
  if (!schedule || schedule.is_day_off) return c.json({ error: 'الحلاق في إجازة بهذا اليوم' }, 400);

  const start = toMinutes(start_time);
  const end = start + totalDuration;
  if (start < toMinutes(schedule.start_time) || end > toMinutes(schedule.end_time)) {
    return c.json({ error: 'الموعد خارج ساعات عمل الحلاق' }, 400);
  }

  const endTime = toHHMM(end);
  const conflictCheck = await checkConflict(c.env.DB, salonId, barber.id, date, start_time, endTime);
  if (conflictCheck) return c.json({ error: 'هذا الموعد لم يعد متاحاً' }, 409);

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
    .bind(customer.id, barber.id, date, start_time, endTime, totalPrice, salonId)
    .first<{ id: number }>();

  const stmts = (svcRows as any[]).map((s) =>
    c.env.DB.prepare(
      'INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes) VALUES (?, ?, ?, ?, ?)',
    ).bind(booking!.id, s.id, s.name, s.price, s.duration_minutes),
  );
  await c.env.DB.batch(stmts);

  // Schedule a push reminder 20 minutes before the appointment (skipped for urgent bookings)
  await scheduleBookingReminder(c.env, salonId, booking!.id, date, start_time);

  // If this customer had a waitlist entry for this slot, mark it fulfilled.
  await c.env.DB.prepare(
    `UPDATE waitlist SET status = 'fulfilled'
     WHERE customer_id = ? AND barber_id = ? AND desired_date = ? AND start_time = ? AND status IN ('waiting','notified') AND salon_id = ?`,
  )
    .bind(customer.id, barber.id, date, start_time, salonId)
    .run();

  await sendNotification(
    c, 'owner', null, 'new_booking',
    formatNewBookingMessage(customer.username, barber.name, date, formatTime12Ar(start_time)),
    booking!.id,
  );
  return c.json({ id: booking!.id, status: 'confirmed', total_price: totalPrice, end_time: endTime }, 201);
});

// ---------- My bookings ----------

customerRoutes.get('/bookings', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const { results } = await c.env.DB.prepare(
    `SELECT bk.*, br.name AS barber_name FROM bookings bk
     JOIN barbers br ON br.id = bk.barber_id
     WHERE bk.customer_id = ? AND bk.salon_id = ?
     ORDER BY bk.booking_date DESC, bk.start_time DESC LIMIT 200`,
  )
    .bind(customer.id, salonId)
    .all<any>();
  const ids = (results as any[]).map((b) => b.id);
  let services: any[] = [];
  if (ids.length) {
    const { results: svc } = await c.env.DB.prepare(
      `SELECT booking_id, name, price, duration_minutes FROM booking_services
       WHERE booking_id IN (${ids.map(() => '?').join(',')})`,
    )
      .bind(...ids)
      .all<any>();
    services = svc as any[];
  }
  return c.json({
    bookings: (results as any[]).map((b) => ({
      ...b,
      services: services.filter((s) => s.booking_id === b.id),
    })),
  });
});

// ---------- Modify booking (any time before the appointment) — PRD 3.6 ----------

customerRoutes.patch('/bookings/:id', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحجز غير صالح' }, 400);
  const id = Number(idRaw);

  const { date, start_time, service_ids } = await c.req.json().catch(() => ({} as any));

  const booking = await c.env.DB.prepare(
    "SELECT * FROM bookings WHERE id = ? AND customer_id = ? AND status = 'confirmed' AND salon_id = ?",
  )
    .bind(id, customer.id, salonId)
    .first<any>();
  if (!booking) return c.json({ error: 'الحجز غير موجود' }, 404);

  const newDate = date ?? booking.booking_date;
  const newStart = start_time ?? booking.start_time;
  if (!isValidDate(newDate) || !isValidTime(newStart)) return c.json({ error: 'تاريخ أو وقت غير صالح' }, 400);

  const today = todayISO();
  const maxDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (newDate < today || newDate > maxDate) {
    return c.json({ error: 'الحجز متاح خلال أسبوع واحد فقط من تاريخ اليوم' }, 400);
  }

  let ids: number[] | null = null;
  if (Array.isArray(service_ids) && service_ids.length > 0) {
    if (!service_ids.every((x: any) => isPositiveInt(x))) {
      return c.json({ error: 'قائمة الخدمات غير صالحة' }, 400);
    }
    ids = service_ids.map(Number);
  }

  let totalDuration: number;
  let svcRows: any[];
  if (ids) {
    const d = await servicesDuration(c.env.DB, booking.barber_id, ids);
    if (d == null) return c.json({ error: 'خدمات غير صالحة لهذا الحلاق' }, 400);
    totalDuration = d;
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await c.env.DB.prepare(
      `SELECT id, name, price, duration_minutes FROM services WHERE barber_id = ? AND id IN (${placeholders})`,
    )
      .bind(booking.barber_id, ...ids)
      .all<any>();
    svcRows = results as any[];
  } else {
    const { results } = await c.env.DB.prepare(
      'SELECT service_id AS id, name, price, duration_minutes FROM booking_services WHERE booking_id = ?',
    )
      .bind(id)
      .all<any>();
    svcRows = results as any[];
    totalDuration = svcRows.reduce((s, r) => s + r.duration_minutes, 0);
  }

  const schedule = await c.env.DB.prepare(
    'SELECT start_time, end_time, is_day_off FROM work_schedules WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?',
  )
    .bind(booking.barber_id, dayOfWeek(newDate), salonId)
    .first<any>();
  if (!schedule || schedule.is_day_off) return c.json({ error: 'الحلاق في إجازة بهذا اليوم' }, 400);

  const start = toMinutes(newStart);
  const end = start + totalDuration;
  if (start < toMinutes(schedule.start_time) || end > toMinutes(schedule.end_time)) {
    return c.json({ error: 'الموعد خارج ساعات عمل الحلاق' }, 400);
  }
  const newEnd = toHHMM(end);
  if (await checkConflict(c.env.DB, salonId, booking.barber_id, newDate, newStart, newEnd, id)) {
    return c.json({ error: 'هذا الموعد لم يعد متاحاً' }, 409);
  }

  const totalPrice = svcRows.reduce((s, r) => s + r.price, 0);
  const stmts: any[] = [
    c.env.DB.prepare(
      'UPDATE bookings SET booking_date = ?, start_time = ?, end_time = ?, total_price = ? WHERE id = ?',
    ).bind(newDate, newStart, newEnd, totalPrice, id),
  ];
  if (ids) {
    stmts.push(c.env.DB.prepare('DELETE FROM booking_services WHERE booking_id = ?').bind(id));
    for (const s of svcRows) {
      stmts.push(
        c.env.DB.prepare(
          'INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes) VALUES (?, ?, ?, ?, ?)',
        ).bind(id, s.id, s.name, s.price, s.duration_minutes),
      );
    }
  }
  await c.env.DB.batch(stmts);
  return c.json({ ok: true, end_time: newEnd, total_price: totalPrice });
});

// ---------- Cancel booking — PRD 3.6 ----------

customerRoutes.post('/bookings/:id/cancel', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف الحجز غير صالح' }, 400);
  const id = Number(idRaw);

  const booking = await c.env.DB.prepare(
    `SELECT bk.*, br.name AS barber_name FROM bookings bk JOIN barbers br ON br.id = bk.barber_id
     WHERE bk.id = ? AND bk.customer_id = ? AND bk.status = 'confirmed' AND bk.salon_id = ?`,
  )
    .bind(id, customer.id, salonId)
    .first<any>();
  if (!booking) return c.json({ error: 'الحجز غير موجود' }, 404);

  await c.env.DB.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").bind(id).run();
  await sendNotification(
    c, 'owner', null, 'cancellation',
    `ألغى ${customer.username} حجزه مع ${booking.barber_name} بتاريخ ${booking.booking_date} الساعة ${formatTime12Ar(booking.start_time)}.`,
    id,
  );
  await notifyWaitlist(c, booking);
  return c.json({ ok: true });
});

// ---------- Waitlist — PRD 3.8 ----------

customerRoutes.post('/waitlist', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const body = await c.req.json().catch(() => ({} as any));
  const { barber_id, date, start_time, end_time } = body;

  if (
    !isPositiveInt(barber_id) ||
    !isValidDate(date) ||
    !isValidTime(start_time) ||
    !isValidTime(end_time) ||
    toMinutes(start_time) >= toMinutes(end_time)
  ) {
    return c.json({ error: 'بيانات قائمة الانتظار غير صالحة (يرجى التأكد من أن وقت البداية قبل النهاية)' }, 400);
  }

  try {
    const res = await c.env.DB.prepare(
      `INSERT INTO waitlist (customer_id, barber_id, desired_date, start_time, end_time, salon_id)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(customer.id, Number(barber_id), date, start_time, end_time, salonId)
      .first<{ id: number }>();
    return c.json({ id: res!.id }, 201);
  } catch {
    return c.json({ error: 'أنت مسجل مسبقاً في قائمة الانتظار لهذا الموعد' }, 409);
  }
});

customerRoutes.get('/waitlist', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const { results } = await c.env.DB.prepare(
    `SELECT w.*, br.name AS barber_name FROM waitlist w
     JOIN barbers br ON br.id = w.barber_id
     WHERE w.customer_id = ? AND w.salon_id = ? ORDER BY w.id DESC LIMIT 100`,
  )
    .bind(customer.id, salonId)
    .all();
  return c.json({ waitlist: results });
});

customerRoutes.delete('/waitlist/:id', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const idRaw = c.req.param('id');
  if (!isPositiveInt(idRaw)) return c.json({ error: 'معرّف قائمة الانتظار غير صالح' }, 400);
  const id = Number(idRaw);

  const res = await c.env.DB.prepare('DELETE FROM waitlist WHERE id = ? AND customer_id = ? AND salon_id = ?')
    .bind(id, customer.id, salonId)
    .run();
  if (res.meta.changes === 0) return c.json({ error: 'غير موجود' }, 404);
  return c.json({ ok: true });
});

// ---------- Live Queue ("الدور") Tracker with Delay & Countdown Support ----------

customerRoutes.get('/queue', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const today = todayISO();
  const clientTime = c.req.query('clientTime');

  let currentMinutes = -1;
  if (clientTime && isValidTime(clientTime)) {
    currentMinutes = toMinutes(clientTime);
  } else {
    const now = new Date();
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    currentMinutes = (utcMins + 180) % 1440; // UTC+3 local Arab time
  }

  // Find customer's confirmed active bookings for today or later
  const { results: myBookings } = await c.env.DB.prepare(
    `SELECT bk.*, br.name AS barber_name FROM bookings bk
     JOIN barbers br ON br.id = bk.barber_id
     WHERE bk.customer_id = ? AND bk.status = 'confirmed' AND bk.booking_date >= ? AND bk.salon_id = ?
     ORDER BY bk.booking_date ASC, bk.start_time ASC`,
  )
    .bind(customer.id, today, salonId)
    .all<any>();

  const queueItems = [];

  for (const b of myBookings as any[]) {
    // Find all prior bookings for the same barber on that date scheduled before this booking
    const { results: priorBookings } = await c.env.DB.prepare(
      `SELECT bk.id, bk.start_time, bk.end_time, bk.status, bk.customer_id
       FROM bookings bk
       WHERE bk.barber_id = ? AND bk.booking_date = ? AND bk.salon_id = ?
         AND bk.start_time < ? AND bk.status IN ('confirmed', 'completed')
       ORDER BY bk.start_time ASC`,
    )
      .bind(b.barber_id, b.booking_date, salonId, b.start_time)
      .all<any>();

    const uncompletedPrior = (priorBookings as any[]).filter((x) => x.status === 'confirmed');
    const peopleAhead = uncompletedPrior.length;

    const myStartMins = toMinutes(b.start_time);
    // "دورك الآن" only when no one is ahead AND the appointment time has actually arrived
    // (allow a small 3-minute early threshold) — never immediately after booking creation.
    const TURN_EARLY_THRESHOLD_MIN = 3;
    const isMyTurn =
      peopleAhead === 0 &&
      b.booking_date === today &&
      currentMinutes >= myStartMins - TURN_EARLY_THRESHOLD_MIN;

    // Calculate total duration for uncompleted prior bookings
    const uncompletedIds = uncompletedPrior.map((x) => x.id);
    let aheadTotalMinutes = 0;
    if (uncompletedIds.length > 0) {
      const placeholders = uncompletedIds.map(() => '?').join(',');
      const { results: aheadSvc } = await c.env.DB.prepare(
        `SELECT SUM(duration_minutes) as total_mins FROM booking_services WHERE booking_id IN (${placeholders})`,
      )
        .bind(...uncompletedIds)
        .all<{ total_mins: number }>();
      aheadTotalMinutes = aheadSvc[0]?.total_mins || uncompletedPrior.length * 30;
    }

    // Calculate dynamic delay and expected finish time of uncompleted prior bookings
    let maxPriorEndMins = myStartMins;

    for (const ub of uncompletedPrior) {
      const ubEnd = toMinutes(ub.end_time);
      const ubStart = toMinutes(ub.start_time);

      let expectedFinish = ubEnd;
      // If today and time has passed the appointment start time without being marked completed
      if (b.booking_date === today && currentMinutes > ubStart) {
        if (currentMinutes > ubEnd) {
          // Running late: assume 5 minutes needed to wrap up
          expectedFinish = currentMinutes + 5;
        }
      }
      if (expectedFinish > maxPriorEndMins) {
        maxPriorEndMins = expectedFinish;
      }
    }

    const delayMinutes = Math.max(0, maxPriorEndMins - myStartMins);
    const effectiveStartMins = myStartMins + delayMinutes;
    const effectiveStartTime = toHHMM(effectiveStartMins);
    const targetDatetimeIso = `${b.booking_date}T${effectiveStartTime}:00`;

    // Get services for my booking
    const { results: myServices } = await c.env.DB.prepare(
      'SELECT name, price, duration_minutes FROM booking_services WHERE booking_id = ?',
    )
      .bind(b.id)
      .all<any>();

    queueItems.push({
      booking_id: b.id,
      barber_id: b.barber_id,
      barber_name: b.barber_name,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: b.end_time,
      effective_start_time: effectiveStartTime,
      delay_minutes: delayMinutes,
      target_datetime_iso: targetDatetimeIso,
      total_price: b.total_price,
      services: myServices,
      people_ahead: peopleAhead,
      queue_number: peopleAhead + 1,
      estimated_wait_minutes: aheadTotalMinutes,
      is_my_turn: isMyTurn,
    });
  }

  return c.json({ queue: queueItems });
});

// ---------- Customer notifications ----------

customerRoutes.get('/notifications', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM notifications WHERE recipient_type = 'customer' AND recipient_id = ? AND salon_id = ?
     ORDER BY id DESC LIMIT 100`,
  )
    .bind(customer.id, salonId)
    .all();
  return c.json({ notifications: results });
});

customerRoutes.post('/notifications/read-all', async (c) => {
  const salonId: number = c.get('salonId');
  const customer = c.get('customer');
  await c.env.DB.prepare(
    "UPDATE notifications SET is_read = 1 WHERE recipient_type = 'customer' AND recipient_id = ? AND salon_id = ?",
  )
    .bind(customer.id, salonId)
    .run();
  return c.json({ ok: true });
});

// ---------- shared ----------

async function checkConflict(
  db: D1Database,
  salonId: number,
  barberId: number,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT id FROM bookings
       WHERE barber_id = ? AND booking_date = ? AND status = 'confirmed' AND salon_id = ?
         AND start_time < ? AND end_time > ? ${excludeBookingId ? 'AND id != ?' : ''}
       LIMIT 1`,
    )
    .bind(...(excludeBookingId
      ? [barberId, date, salonId, endTime, startTime, excludeBookingId]
      : [barberId, date, salonId, endTime, startTime]))
    .first();
  return row != null;
}
