import type { Context } from 'hono';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';

// ---------- multi-tenant ----------

/**
 * Multi-tenant: there is NO fixed SALON_ID anymore.
 *
 * • Authenticated requests: salon_id is derived from the user's own session
 *   (sessions.salon_id for owners, customers.salon_id for customers) inside
 *   requireOwner / requireCustomer — never from client input.
 * • Public (unauthenticated) booking traffic: the tenant is resolved from the
 *   request Host against salons.domain / salons.slug via resolvePublicSalonId().
 */
export const DEFAULT_SALON_ID = 1; // fallback until a salon registers its domain/slug

const ARABIC_TO_LATIN: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
  'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'ة': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ئ': 'y', 'ؤ': 'w', 'ء': '', 'ـ': '',
};

/**
 * Slug generation
 */

/**
 * Reserved slug words that must never be used as a salon slug.
 * These mirror every top-level route segment in apps/web/app (admin, book,
 * signup, …) plus platform paths (api, _next, uploads, …) — a salon with one
 * of these slugs would collide with / shadow a real application route.
 * Keep in sync with apps/web/app top-level folders and API paths.
 */
export const RESERVED_SLUGS = new Set([
  // App routes (apps/web/app top-level segments)
  'admin',
  // Platform-owner (Super Admin) routes — must never be shadowed by a salon
  'super-admin',
  'super-admin-login',
  'book',
  'login',
  'register',
  'signup',
  'my-bookings',
  'my-profile',
  'notifications',
  'theme-demo',
  // Platform / API / framework paths that must stay reachable
  'api',
  '_next',
  'static',
  'uploads',
  'manifest.json',
  'manifest-admin.json',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  // Safety catch-alls
  'salon',
  'www',
  'app',
  'root',
]);

/** Case-insensitive check whether a candidate slug is reserved. */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * Converts a salon name (Arabic or Latin) into a URL-friendly slug.
 * Arabic letters are transliterated; spaces/symbols become single dashes;
 * result is lowercased ASCII [a-z0-9-]. Falls back to "salon" if empty.
 */
export function slugifySalonName(name: string): string {
  const transliterated = [...name]
    .map((ch) => ARABIC_TO_LATIN[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return transliterated || 'salon';
}

/**
 * Resolves which salon an unauthenticated request belongs to.
 * Priority:
 *   1. ?salonSlug=... query/body param (path-based multi-tenancy, e.g. /salon-zomz)
 *   2. Request host vs salons.domain / salons.slug (domain-based)
 *   3. DEFAULT_SALON_ID fallback while only one salon exists
 */
export async function resolvePublicSalonId(c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined }; env: { DB: any } }): Promise<number> {
  const r = await resolvePublicSalonWithSource(c);
  // READ-only endpoints keep the documented DEFAULT_SALON_ID fallback (root
  // home page branding etc). Identity/INSERT endpoints must NOT rely on this
  // wrapper — they use resolvePublicSalonStrict() which rejects instead.
  return r.source ? r.id : DEFAULT_SALON_ID;
}

/**
 * Resolution WITH provenance.
 *   "slug"  → explicit ?salonSlug= param (path-based tenant)
 *   "host"  → custom-domain match against salons.domain/slug
 *   null    → nothing matched; caller decides whether DEFAULT_SALON_ID
 *             fallback is acceptable (READ-ONLY branding) or must be
 *             rejected (any identity/INSERT operation — see auth routes).
 */
export async function resolvePublicSalonWithSource(
  c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined }; env: { DB: any } },
): Promise<{ id: number; source: 'slug' | 'host' | null }> {
  try {
    // 1) Explicit path slug (passed by /[salonSlug]/* pages)
    const slug = c.req.query?.('salonSlug');
    if (slug && /^[a-zA-Z0-9-_]{1,60}$/.test(slug)) {
      const bySlug = await c.env.DB.prepare('SELECT id FROM salons WHERE slug = ?')
        .bind(slug.toLowerCase())
        .first();
      const typed = bySlug as unknown as { id: number } | null;
      if (typed?.id) return { id: typed.id, source: 'slug' };
    }

    // 2) Host-based matching — EXACT equality only (security: substring/LIKE
    //    matching would let any salon whose slug happens to appear inside the
    //    deployment host (e.g. "web", "barber", "workers") claim traffic —
    //    including identity-critical login/register flows — meant for the
    //    main domain. A host must equal the salon's registered custom domain
    //    or its slug exactly.
    const host = (c.req.header('x-forwarded-host') || c.req.header('host') || '')
      .split(':')[0]
      .toLowerCase();
    if (!host) return { id: 0, source: null };

    const row = await c.env.DB.prepare(
      `SELECT id FROM salons WHERE LOWER(domain) = ? OR LOWER(slug) = ?
       LIMIT 1`,
    )
      .bind(host, host)
      .first();

    const typed = row as unknown as { id: number } | null;
    if (typed?.id) return { id: typed.id, source: 'host' };
  } catch {
    // fall through to default
  }
  return { id: 0, source: null };
}

/**
 * STRICT resolution for identity/INSERT operations (register, login, etc).
 * Returns null when the tenant cannot be established with FULL confidence —
 * callers MUST reject instead of silently falling back to a default salon.
 * This eliminates the silent salon_id=1 corruption class of bugs.
 */
export async function resolvePublicSalonStrict(c: { req: { header: (name: string) => string | undefined; query: (name: string) => string | undefined }; env: { DB: any } }): Promise<number | null> {
  const r = await resolvePublicSalonWithSource(c);
  if (!r.source) return null;

  // Extra hardening: the salon row itself MUST exist — blocks writes into a
  // deleted/legacy salon id even if resolution somehow returns one.
  const exists = await c.env.DB.prepare('SELECT id FROM salons WHERE id = ?')
    .bind(r.id)
    .first();
  return exists ? r.id : null;
}

// ---------- crypto / tokens ----------

export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Super Admin password hashing (salted PBKDF2 — WebCrypto) ----------
// Deliberately STRONGER than the tenant owners' unsalted SHA-256: the super
// admin controls the entire platform. Format:
//   pbkdf2:sha256:<iterations>:<salt_b64>:<hash_b64>
// (hash = PBKDF2-HMAC-SHA256, 256-bit key — byte-compatible with
//  node:crypto pbkdf2Sync(..., 'sha256') so scripts can create accounts.)

const PBKDF2_ITERATIONS = 100_000;

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array([...atob(b64)].map((ch) => ch.charCodeAt(0)));
}

async function pbkdf2Derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPasswordPBKDF2(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await pbkdf2Derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${bytesToB64(salt)}:${bytesToB64(hash)}`;
}

export async function verifyPasswordPBKDF2(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000) return false;
  try {
    const salt = b64ToBytes(parts[3]);
    const expected = b64ToBytes(parts[4]);
    const actual = await pbkdf2Derive(password, salt, iterations);
    // Constant-time comparison
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
    return diff === 0;
  } catch {
    return false;
  }
}

export function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Structured Error Logging ----------

export function logRouteError(
  endpoint: string,
  errorType: string,
  err: unknown,
  details?: Record<string, unknown>,
) {
  const timestamp = new Date().toISOString();
  const errorMessage = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  console.error(
    `[ROUTE_ERROR] [${timestamp}] [${endpoint}] [${errorType}]`,
    JSON.stringify({
      timestamp,
      endpoint,
      errorType,
      errorMessage,
      stack,
      ...details,
    }),
  );
}

// ---------- IP Extraction & Distributed Rate Limiting ----------

/** Extract real client IP behind Cloudflare or proxies */
export function getClientIP(c: Context<any>): string {
  const cfIp = c.req.header('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();

  return '127.0.0.1';
}

/**
 * Atomic distributed rate limiter powered by Durable Objects.
 * Example: 5 attempts per 15 minutes (limit=5, windowSeconds=900)
 *
 * failClosed (default false): auth-critical endpoints (login/register)
 * should DENY on DO errors — a failed limiter must never open an
 * unthrottled brute-force window. Less sensitive, revenue-facing
 * endpoints (bookings, uploads, availability) stay fail-open so a
 * transient DO hiccup can't take the booking funnel down.
 */
export async function checkRateLimit(
  hubNamespace: DurableObjectNamespace,
  salonId: number,
  key: string,
  limit: number = 5,
  windowSeconds: number = 900,
  failClosed: boolean = false,
): Promise<{ allowed: boolean; remaining?: number; retryAfter?: number }> {
  try {
    const hub = hubNamespace.get(hubNamespace.idFromName(`salon-${salonId}`));
    const res = await hub.fetch('https://hub/rate-limit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, limit, windowSeconds }),
    });
    const data = (await res.json()) as { allowed: boolean; remaining?: number; retryAfter?: number };
    return data;
  } catch (err) {
    console.error('[RateLimiter] Check error:', err);
    if (failClosed) {
      // Fail CLOSED: deny rather than allow (brute-force protection wins)
      return { allowed: false, retryAfter: 60 };
    }
    // On DO connection error, fail open to avoid service disruption
    return { allowed: true };
  }
}

// ---------- Strict Input Validation Helpers ----------

/** Validates username: 2-50 characters, trimmed, no control characters */
export function isValidUsername(username: unknown): username is string {
  if (typeof username !== 'string') return false;
  const trimmed = username.trim();
  return trimmed.length >= 2 && trimmed.length <= 50 && !/[\u0000-\u001F\u007F]/.test(trimmed);
}

/** Validates phone numbers: digits, optional leading +, spaces, dashes; length 7-20 */
export function isValidPhone(phone: unknown): phone is string {
  if (typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  return trimmed.length >= 7 && trimmed.length <= 20 && /^[+\d][\d\s-]{6,19}$/.test(trimmed);
}

/** Validates CSS hex color (#RGB, #RRGGBB) */
export function isValidHexColor(color: unknown): color is string {
  if (typeof color !== 'string') return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim());
}

/** Validates positive integer IDs (1, 2, 3...) */
export function isPositiveInt(n: unknown): n is number {
  const num = Number(n);
  return Number.isInteger(num) && num > 0;
}

/** Validates positive prices (any positive decimal/integer > 0) */
export function isPositivePrice(n: unknown): n is number {
  const num = Number(n);
  return Number.isFinite(num) && num > 0;
}

/** Validates service durations (5 minutes to 480 minutes / 8 hours) */
export function isValidDuration(n: unknown): n is number {
  const num = Number(n);
  return Number.isInteger(num) && num >= 5 && num <= 480;
}

/** Validates barber / walk-in customer display names: 2-60 chars after trim */
export function isValidBarberName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const t = name.trim();
  return t.length >= 2 && t.length <= 60;
}

/** Validates service names: 2-80 chars after trim */
export function isValidServiceName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const t = name.trim();
  return t.length >= 2 && t.length <= 80;
}

/** Validates salon names: 2-80 chars after trim */
export function isValidSalonName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  const t = name.trim();
  return t.length >= 2 && t.length <= 80;
}

/**
 * Validates a full service payload (name / price / duration_minutes).
 * Returns an Arabic error message or null when valid. Shared by the owner
 * service create/update endpoints so the rules can never drift apart.
 */
export function validateServiceInput(
  name: unknown,
  price: unknown,
  duration: unknown,
): string | null {
  if (!isValidServiceName(name)) return 'اسم الخدمة مطلوب (بين 2 و 80 حرفاً)';
  if (!isPositivePrice(price)) return 'سعر غير صالح (يجب أن يكون رقماً أكبر من الصفر)';
  if (!isValidDuration(duration)) return 'مدة غير صالحة (يجب أن تكون بين 5 و 480 دقيقة)';
  return null;
}

/** Validates URLs or Data URIs with length limits */
export function isValidUrlOrDataUri(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (trimmed.length > 2000000) return false; // 2MB max
  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  );
}

// ---------- time helpers ("HH:MM" 24h internal) ----------

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format time to 12-hour Arabic time (e.g. "01:30 مساءً", "09:00 صباحاً" or "01:30 م", "09:00 ص") */
export function formatTime12Ar(
  time: string | number | Date | null | undefined,
  shortPeriod: boolean = false,
): string {
  if (!time && time !== 0) return '';

  let h = 0;
  let m = 0;

  if (time instanceof Date) {
    h = time.getHours();
    m = time.getMinutes();
  } else if (typeof time === 'number') {
    h = Math.floor(time);
    m = 0;
  } else if (typeof time === 'string') {
    const trimmed = time.trim();
    if (trimmed.includes('T') || (trimmed.includes('-') && trimmed.includes(':'))) {
      const d = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T') + (trimmed.endsWith('Z') ? '' : 'Z'));
      if (!isNaN(d.getTime())) {
        h = d.getHours();
        m = d.getMinutes();
      } else {
        return time;
      }
    } else if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      h = Number(parts[0]);
      m = Number(parts[1]);
    } else {
      h = Number(trimmed);
      m = 0;
    }
  }

  if (isNaN(h) || isNaN(m)) return String(time);

  const period = shortPeriod ? (h < 12 ? 'ص' : 'م') : (h < 12 ? 'صباحاً' : 'مساءً');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/** Salon timezone offset (Jordan — UTC+3 fixed, no DST since 2022). */
export const SALON_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Current moment shifted into salon-local time as a real Date (use with getUTC* getters). */
export function salonNow(): Date {
  return new Date(Date.now() + SALON_TZ_OFFSET_MS);
}

/** Today as YYYY-MM-DD in SALON-LOCAL time (Jordan, UTC+3) — NOT raw UTC. */
export function todayISO(): string {
  return new Date(Date.now() + SALON_TZ_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0=Sunday .. 6=Saturday for a YYYY-MM-DD date. */
export function dayOfWeek(dateISO: string): number {
  return new Date(dateISO + 'T00:00:00Z').getUTCDay();
}

export function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
}

export function isValidTime(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function nowMinutesLocal(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}
