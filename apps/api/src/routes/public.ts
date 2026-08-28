import { Hono } from 'hono';
import type { Bindings, SalonSettings, Variables } from '../types';
import { requireOwner } from './auth';
import { deleteOldUpload } from '../cleanup';
import {
  toMinutes,
  toHHMM,
  isValidDate,
  isValidTime,
  dayOfWeek,
  todayISO,
  isValidPhone,
  isValidUsername,
  isValidHexColor,
  isValidUrlOrDataUri,
  resolvePublicSalonId,
  getClientIP,
  checkRateLimit,
  randomToken,
  sha256,
  slugifySalonName,
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
    .bind((await resolvePublicSalonId(c)))
    .first<SalonSettings>();
  if (!salon) return c.json({ error: 'Salon not found' }, 404);
  return c.json({ salon });
});

publicRoutes.put('/salon-settings', requireOwner, async (c) => {
  // SECURITY: the target tenant is ALWAYS the owner's own session salon.
  // (Previously this used resolvePublicSalonId() — an owner of salon B could
  // overwrite salon A's settings by calling the endpoint without a slug.)
  const sessionSalonId = c.get('salonId');
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

  // Fetch the old logo URL before overwriting it, then delete its file from storage
  if (cleanLogo !== undefined) {
    const current = await c.env.DB.prepare('SELECT logo_url FROM salons WHERE id = ?')
      .bind(sessionSalonId)
      .first<{ logo_url: string | null }>();

    const cleanedUp = await deleteOldUpload(c.env.DB, c.env.BUCKET, current?.logo_url, cleanLogo);
    if (!cleanedUp) {
      return c.json({ error: 'تعذر حذف الشعار القديم من التخزين، لم يتم حفظ الرابط الجديد' }, 500);
    }
  }

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
      sessionSalonId,
    )
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT id, name, phone, logo_url, primary_color, 
            social_facebook, social_instagram, social_tiktok, social_whatsapp, maps_url 
     FROM salons WHERE id = ?`,
  )
    .bind(sessionSalonId)
    .first<SalonSettings>();

  return c.json({ ok: true, salon: updated });
});

// Dynamic PWA Web App Manifest endpoints generated from database
publicRoutes.get('/manifest.json', async (c) => {
  const salon = await c.env.DB.prepare(
    'SELECT name, primary_color, logo_url FROM salons WHERE id = ?',
  )
    .bind((await resolvePublicSalonId(c)))
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
    .bind((await resolvePublicSalonId(c)))
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
    .bind((await resolvePublicSalonId(c)))
    .all();
  return c.json({ services: results });
});

// Public barbers list with their services — used by the booking flow
publicRoutes.get('/barbers', async (c) => {
  const { results: barbers } = await c.env.DB.prepare(
    'SELECT id, name, photo_url FROM barbers WHERE is_active = 1 AND salon_id = ? ORDER BY name',
  )
    .bind((await resolvePublicSalonId(c)))
    .all();
  const { results: services } = await c.env.DB.prepare(
    `SELECT id, barber_id, name, price, duration_minutes FROM services
     WHERE barber_id IN (SELECT id FROM barbers WHERE is_active = 1 AND salon_id = ?) ORDER BY name`,
  )
    .bind((await resolvePublicSalonId(c)))
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
  const date = c.req.query('date') ?? '';
  const serviceIds = (c.req.query('serviceIds') ?? '')
    .split(',')
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (!isValidDate(date)) return c.json({ error: 'تاريخ غير صالح' }, 400);
  if (serviceIds.length === 0) return c.json({ error: 'اختر خدمة واحدة على الأقل' }, 400);

  const salonId = await resolvePublicSalonId(c);

  // Verify barber belongs to this salon
  const barberCheck = await c.env.DB.prepare(
    'SELECT id FROM barbers WHERE id = ? AND salon_id = ? AND is_active = 1',
  )
    .bind(barberId, salonId)
    .first();
  if (!barberCheck) return c.json({ error: 'الحلاق غير متاح' }, 404);

  return c.json(await computeBarberAvailability(c.env.DB, salonId, barberId, date, serviceIds, c.req.query('clientTime')));
});

/**
 * Core slot computation shared by the PUBLIC availability endpoint and the
 * session-scoped OWNER endpoint (/api/owner/barbers/:id/availability used by
 * the admin manual booking form — tenant derived from the owner session, so
 * the admin panel never falls back to DEFAULT_SALON_ID).
 * Returns either { error, status } or the availability payload.
 */
export async function computeBarberAvailability(
  db: D1Database,
  salonId: number,
  barberId: number,
  date: string,
  serviceIds: number[],
  clientTime: string | null | undefined,
): Promise<
  | { error: string; status: number }
  | { date: string; slots: { start_time: string; end_time: string }[]; total_duration: number; is_time_off?: boolean; reason?: string | null }
> {
  // One-week advance booking window — PRD 3.5(4)
  const today = todayISO();
  const maxDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  if (date < today || date > maxDate) {
    return { error: 'الحجز متاح خلال أسبوع واحد فقط من تاريخ اليوم', status: 400 };
  }

  const totalDuration = await servicesDuration(db, barberId, serviceIds);
  if (totalDuration == null) return { error: 'خدمات غير صالحة لهذا الحلاق', status: 400 };

  // 1. Check specific date time-off (إجازة مخصصة بتاريخ محدد)
  const timeOff = await db
    .prepare('SELECT id, reason FROM barber_time_off WHERE barber_id = ? AND date = ? AND salon_id = ?')
    .bind(barberId, date, salonId)
    .first<{ id: number; reason: string | null }>();

  if (timeOff) {
    return { date, slots: [], total_duration: totalDuration, is_time_off: true, reason: timeOff.reason };
  }

  // 2. Check weekly schedule
  const schedule = await db
    .prepare('SELECT start_time, end_time, is_day_off FROM work_schedules WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?')
    .bind(barberId, dayOfWeek(date), salonId)
    .first<{ start_time: string; end_time: string; is_day_off: number }>();

  if (!schedule || schedule.is_day_off) return { date, slots: [], total_duration: totalDuration };

  // 3. Get existing bookings for that date
  const { results: bookings } = await db
    .prepare(
      `SELECT start_time, end_time FROM bookings
     WHERE barber_id = ? AND booking_date = ? AND status = 'confirmed' AND salon_id = ?`,
    )
    .bind(barberId, date, salonId)
    .all<{ start_time: string; end_time: string }>();

  // 4. Get breaks for that day of week (فترات الاستراحة)
  const { results: breaks } = await db
    .prepare('SELECT start_time, end_time FROM barber_breaks WHERE barber_id = ? AND day_of_week = ? AND salon_id = ?')
    .bind(barberId, dayOfWeek(date), salonId)
    .all<{ start_time: string; end_time: string }>();

  const busy = [
    ...(bookings as any[]).map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)] as const),
    ...(breaks as any[]).map((br) => [toMinutes(br.start_time), toMinutes(br.end_time)] as const),
  ];

  const open = toMinutes(schedule.start_time);
  const close = toMinutes(schedule.end_time);

  // Check client time if passed, or fallback to local Arab time (UTC+3)
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
  return { date, slots, total_duration: totalDuration };
}

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


// ---------- Self-service salon registration ----------

/**
 * POST /api/salons/register
 * Body: { name, phone, adminUsername, password }
 */
publicRoutes.post('/salons/register', async (c) => {
  const ip = getClientIP(c);
  const rl = await checkRateLimit(c.env.NOTIFICATION_HUB, 0, `salon_register:${ip}`, 5, 3600);
  if (!rl.allowed) {
    const minutes = Math.ceil((rl.retryAfter || 60) / 60);
    return c.json({ error: `تم تجاوز الحد المسموح لمحاولات التسجيل. يرجى المحاولة بعد ${minutes} دقيقة.` }, 429);
  }

  const body = await c.req.json().catch(() => ({} as any));
  const { name, phone, adminUsername, password } = body;

  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
    return c.json({ error: 'اسم الصالون مطلوب (بين 2 و 80 حرفاً)' }, 400);
  }
  if (phone && !isValidPhone(phone)) {
    return c.json({ error: 'رقم هاتف غير صالح' }, 400);
  }
  if (!isValidUsername(adminUsername) || typeof adminUsername !== 'string') {
    return c.json({ error: 'اسم مستخدم الأدمن مطلوب (بين 2 و 50 حرفاً بدون رموز خاصة)' }, 400);
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 100) {
    return c.json({ error: 'كلمة المرور مطلوبة (6 خانات على الأقل وبحد أقصى 100 خانة)' }, 400);
  }

  const cleanName = name.trim();
  const cleanPhone = phone ? String(phone).trim() : null;
  const cleanUsername = adminUsername.trim();
  const passwordHash = await sha256(password);

  // Generate a unique URL-friendly slug from the salon name (Arabic transliteration supported)
  let slug = slugifySalonName(cleanName);
  for (let i = 2; ; i++) {
    const taken = await c.env.DB.prepare('SELECT id FROM salons WHERE slug = ?').bind(slug).first();
    if (!taken) break;
    slug = `${slugifySalonName(cleanName)}-${i}`;
    if (i > 100) return c.json({ error: 'تعذر توليد رابط فريد للصالون، حاول اسماً مختلفاً' }, 500);
  }

  // Create the tenant
  const salonRes = await c.env.DB.prepare(
    `INSERT INTO salons (name, phone, slug, subscription_status) VALUES (?, ?, ?, 'trial')
     RETURNING id`,
  )
    .bind(cleanName, cleanPhone, slug)
    .first<{ id: number }>();
  const newSalonId = salonRes!.id;

  // Owner username unique WITHIN this salon only
  const ownerTaken = await c.env.DB.prepare(
    'SELECT id FROM owners WHERE salon_id = ? AND username = ?',
  )
    .bind(newSalonId, cleanUsername)
    .first();
  if (ownerTaken) {
    await c.env.DB.prepare('DELETE FROM salons WHERE id = ?').bind(newSalonId).run();
    return c.json({ error: 'اسم المستخدم محجوز، اختر اسماً آخر' }, 409);
  }

  const ownerRes = await c.env.DB.prepare(
    'INSERT INTO owners (username, password_hash, salon_id) VALUES (?, ?, ?) RETURNING id',
  )
    .bind(cleanUsername, passwordHash, newSalonId)
    .first<{ id: number }>();

  // Immediate session — carries the new tenant id inside it
  const token = randomToken();
  const expires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await c.env.DB.prepare(
    'INSERT INTO sessions (token, owner_id, expires_at, salon_id) VALUES (?, ?, ?, ?)',
  )
    .bind(token, ownerRes!.id, expires, newSalonId)
    .run();

  const origin = new URL(c.req.url).origin;
  return c.json(
    {
      ok: true,
      token,
      owner: { id: ownerRes!.id, username: cleanUsername },
      salon: { id: newSalonId, name: cleanName, slug },
      publicUrl: `${origin}/${slug}`,
    },
    201,
  );
});
