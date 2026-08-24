import { Hono } from 'hono';
import type { Bindings, SalonSettings, Variables } from '../types';
import { requireOwner } from './auth';
import {
  toMinutes,
  toHHMM,
  isValidDate,
  isValidTime,
  dayOfWeek,
  todayISO,
  SALON_ID,
  isValidPhone,
  isValidHexColor,
  isValidUrlOrDataUri,
  isPositiveInt,
} from '../utils';

export const publicRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ---------- Salon settings (dynamic branding — consumed by frontend & edited by owner) ----------

publicRoutes.get('/salon-settings', async (c) => {
  const salon = await c.env.DB.prepare(
    `SELECT id, name, phone, logo_url, primary_color, 
            social_facebook, social_instagram, social_tiktok, social_whatsapp, maps_url 
     FROM salons WHERE id = ?`,
  )
    .bind(SALON_ID)
    .first<SalonSettings>();
  if (!salon) return c.json({ error: 'Salon not found' }, 404);
  return c.json({ salon });
});

publicRoutes.put('/salon-settings', requireOwner, async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const {
    name,
    phone,
    primary_color,
    logo_url,
    social_facebook,
    social_instagram,
    social_tiktok,
    social_whatsapp,
    maps_url,
  } = body;

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return c.json({ error: 'اسم الصالون مطلوب (بين 2 و 80 حرفاً)' }, 400);
  }

  if (phone && !isValidPhone(phone)) {
    return c.json({ error: 'رقم هاتف الصالون غير صالح' }, 400);
  }

  if (primary_color && !isValidHexColor(primary_color)) {
    return c.json({ error: 'رمز اللون غير صالح (يجب أن يكون بصيغة Hex مثل #f59e0b)' }, 400);
  }

  if (logo_url && !isValidUrlOrDataUri(logo_url)) {
    return c.json({ error: 'رابط الشعار غير صالح' }, 400);
  }

  const cleanName = name.trim();
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanColor = primary_color ? String(primary_color).trim() : '#f59e0b';
  const cleanLogo = logo_url ? String(logo_url).trim() : null;
  const cleanFacebook = social_facebook ? String(social_facebook).trim() : null;
  const cleanInstagram = social_instagram ? String(social_instagram).trim() : null;
  const cleanTiktok = social_tiktok ? String(social_tiktok).trim() : null;
  const cleanWhatsapp = social_whatsapp ? String(social_whatsapp).trim() : null;
  const cleanMaps = maps_url ? String(maps_url).trim() : null;

  await c.env.DB.prepare(
    `UPDATE salons 
     SET name = ?, phone = ?, primary_color = ?, logo_url = ?,
         social_facebook = ?, social_instagram = ?, social_tiktok = ?, social_whatsapp = ?, maps_url = ?
     WHERE id = ?`,
  )
    .bind(
      cleanName,
      cleanPhone,
      cleanColor,
      cleanLogo,
      cleanFacebook,
      cleanInstagram,
      cleanTiktok,
      cleanWhatsapp,
      cleanMaps,
      SALON_ID,
    )
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT id, name, phone, logo_url, primary_color, 
            social_facebook, social_instagram, social_tiktok, social_whatsapp, maps_url 
     FROM salons WHERE id = ?`,
  )
    .bind(SALON_ID)
    .first<SalonSettings>();

  return c.json({ ok: true, salon: updated });
});

// Dynamic PWA Web App Manifest endpoints generated from database
publicRoutes.get('/manifest.json', async (c) => {
  const salon = await c.env.DB.prepare(
    'SELECT name, primary_color, logo_url FROM salons WHERE id = ?',
  )
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

publicRoutes.get('/manifest-admin.json', async (c) => {
  const salon = await c.env.DB.prepare(
    'SELECT name, primary_color, logo_url FROM salons WHERE id = ?',
  )
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

// Public services & prices list (no login required) — PRD 3.1
publicRoutes.get('/services', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.price, s.duration_minutes, s.barber_id, b.name AS barber_name
     FROM services s JOIN barbers b ON b.id = s.barber_id
     WHERE b.is_active = 1 AND b.salon_id = ?
     ORDER BY b.name, s.name`,
  )
    .bind(SALON_ID)
    .all();
  return c.json({ services: results });
});

// Public barbers list with their services — used by the booking flow
publicRoutes.get('/barbers', async (c) => {
  const { results: barbers } = await c.env.DB.prepare(
    'SELECT id, name, photo_url FROM barbers WHERE is_active = 1 AND salon_id = ? ORDER BY name',
  )
    .bind(SALON_ID)
    .all();
  const { results: services } = await c.env.DB.prepare(
    `SELECT id, barber_id, name, price, duration_minutes FROM services
     WHERE barber_id IN (SELECT id FROM barbers WHERE is_active = 1 AND salon_id = ?) ORDER BY name`,
  )
    .bind(SALON_ID)
    .all();
  const byBarber = new Map<number, any[]>();
  for (const s of services as any[]) {
    if (!byBarber.has(s.barber_id)) byBarber.set(s.barber_id, []);
    byBarber.get(s.barber_id)!.push(s);
  }
  return c.json({
    barbers: (barbers as any[]).map((b) => ({ ...b, services: byBarber.get(b.id) ?? [] })),
  });
});

// Available time slots for a barber on a date, given selected services — PRD 3.5
publicRoutes.get('/barbers/:id/availability', async (c) => {
  const barberId = Number(c.req.param('id'));
  const date = c.req.query('date');
  const serviceIds = (c.req.query('serviceIds') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (!isValidDate(date)) return c.json({ error: 'تاريخ غير صالح' }, 400);
  if (serviceIds.length === 0) return c.json({ error: 'اختر خدمة واحدة على الأقل' }, 400);

  // One-week advance booking window — PRD 3.5(4)
  const today = todayISO();
  const maxDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (date < today || date > maxDate) {
    return c.json({ error: 'الحجز متاح خلال أسبوع واحد فقط من تاريخ اليوم' }, 400);
  }

  // Verify barber belongs to this salon
  const barberCheck = await c.env.DB.prepare(
    'SELECT id FROM barbers WHERE id = ? AND salon_id = ? AND is_active = 1',
  )
    .bind(barberId, SALON_ID)
    .first();
  if (!barberCheck) return c.json({ error: 'الحلاق غير متاح' }, 404);

  const totalDuration = await servicesDuration(c.env.DB, barberId, serviceIds);
  if (totalDuration == null) return c.json({ error: 'خدمات غير صالحة لهذا الحلاق' }, 400);

  // 1. Check specific date time-off (إجازة مخصصة بتاريخ محدد)
  const timeOff = await c.env.DB.prepare(
    'SELECT id, reason FROM barber_time_off WHERE barber_id = ? AND date = ? AND salon_id = ?',
  )
    .bind(barberId, date, SALON_ID)
    .first<{ id: number; reason: string | null }>();

  if (timeOff) {
    return c.json({ date, slots: [], total_duration: totalDuration, is_time_off: true, reason: timeOff.reason });
  }

  // 2. Check weekly schedule
  const schedule = await c.env.DB.prepare(
    'SELECT start_time, end_time, is_day_off FROM work_schedules WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?',
  )
    .bind(barberId, dayOfWeek(date), SALON_ID)
    .first<{ start_time: string; end_time: string; is_day_off: number }>();

  if (!schedule || schedule.is_day_off) return c.json({ date, slots: [], total_duration: totalDuration });

  // 3. Get existing bookings for that date
  const { results: bookings } = await c.env.DB.prepare(
    `SELECT start_time, end_time FROM bookings
     WHERE barber_id = ? AND booking_date = ? AND status = 'confirmed' AND salon_id = ?`,
  )
    .bind(barberId, date, SALON_ID)
    .all<{ start_time: string; end_time: string }>();

  // 4. Get breaks for that day of week (فترات الاستراحة)
  const { results: breaks } = await c.env.DB.prepare(
    'SELECT start_time, end_time FROM barber_breaks WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?',
  )
    .bind(barberId, dayOfWeek(date), SALON_ID)
    .all<{ start_time: string; end_time: string }>();

  const busy = [
    ...(bookings as any[]).map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)] as const),
    ...(breaks as any[]).map((br) => [toMinutes(br.start_time), toMinutes(br.end_time)] as const),
  ];

  const open = toMinutes(schedule.start_time);
  const close = toMinutes(schedule.end_time);

  // Check client time if passed, or fallback to local Arab time (UTC+3)
  const clientTime = c.req.query('clientTime');
  let currentMinutes = -1;
  if (clientTime && isValidTime(clientTime)) {
    currentMinutes = toMinutes(clientTime);
  } else {
    const now = new Date();
    const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes();
    currentMinutes = (utcMins + 180) % 1440; // UTC+3
  }

  const STEP = 30; // Fixed 30-minute intervals (e.g. 09:00, 09:30, 10:00, 10:30)
  const slots: { start_time: string; end_time: string }[] = [];
  for (let t = open; t + totalDuration <= close; t += STEP) {
    // If date is today, skip any slots that are in the past
    if (date === today && t < currentMinutes) {
      continue;
    }

    const end = t + totalDuration;
    const overlaps = busy.some(([bs, be]) => t < be && end > bs);
    if (!overlaps) slots.push({ start_time: toHHMM(t), end_time: toHHMM(end) });
  }
  return c.json({ date, slots, total_duration: totalDuration });
});

/** Sum durations of the given services, verifying they all belong to the barber. */
export async function servicesDuration(
  db: D1Database,
  barberId: number,
  serviceIds: number[],
): Promise<number | null> {
  const placeholders = serviceIds.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT duration_minutes FROM services WHERE barber_id = ? AND id IN (${placeholders})`)
    .bind(barberId, ...serviceIds)
    .all<{ duration_minutes: number }>();
  if (results.length !== serviceIds.length) return null;
  return (results as any[]).reduce((sum, s) => sum + s.duration_minutes, 0);
}
