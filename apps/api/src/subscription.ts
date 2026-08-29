/**
 * Subscription lifecycle — shared helpers.
 *
 * Design notes:
 * • The monthly billing cycle is PER SALON: anchored to the salon's own
 *   `subscription_start_date` (e.g. registered on the 15th → renews every
 *   15th). Never a shared calendar month boundary.
 * • The renewal reminder is a COMPUTED value at request time (no stored
 *   flag): a salon is "in the reminder window" when today is within the
 *   last 2 days of its current cycle. This cannot drift out of sync and
 *   disappears the moment the super admin renews (start date resets).
 * • Every status transition is idempotent: the UPDATE is conditional on the
 *   current status and the log row is only written when the status actually
 *   changed — running the cron twice a day never double-logs.
 * • Nothing user-facing is hardcoded: the phone number, both message
 *   templates and the trial duration all come from `platform_settings`.
 */
import { createMiddleware } from 'hono/factory';
import type { Bindings, Variables } from './types';
import { todayISO, addDaysISO } from './utils';

export type SubscriptionStatus = 'trial' | 'active' | 'expired';

export type PlatformSettings = {
  renewal_phone: string;
  renewal_banner_template: string;
  expired_lockout_template: string;
  trial_duration_days: number;
};

const DEFAULT_SETTINGS: PlatformSettings = {
  renewal_phone: '0795105850',
  renewal_banner_template:
    'ينتهي اشتراكك الشهري بعد يومين ({date}). يرجى تجديد الاشتراك بالتواصل مع الرقم {phone} لتفادي توقف النظام.',
  expired_lockout_template:
    'لقد تم انتهاء دورة اشتراكك الشهري في النظام، يرجى إعادة تجديد اشتراكك من خلال التواصل مع الرقم {phone}',
  trial_duration_days: 30,
};

/** Load platform settings from D1, falling back to the documented defaults. */
export async function getPlatformSettings(db: Bindings['DB']): Promise<PlatformSettings> {
  const { results } = await db
    .prepare('SELECT key, value FROM platform_settings')
    .all<{ key: string; value: string }>();
  const map = new Map((results ?? []).map((r) => [r.key, r.value]));
  const trialDays = Number(map.get('trial_duration_days'));
  return {
    renewal_phone: map.get('renewal_phone') || DEFAULT_SETTINGS.renewal_phone,
    renewal_banner_template:
      map.get('renewal_banner_template') || DEFAULT_SETTINGS.renewal_banner_template,
    expired_lockout_template:
      map.get('expired_lockout_template') || DEFAULT_SETTINGS.expired_lockout_template,
    trial_duration_days:
      Number.isFinite(trialDays) && trialDays >= 1 && trialDays <= 365
        ? Math.floor(trialDays)
        : DEFAULT_SETTINGS.trial_duration_days,
  };
}

/** Interpolate {phone} (and any extra tokens like {date}) into a template. */
export function interpolateTemplate(
  template: string,
  settings: PlatformSettings,
  extra: Record<string, string> = {},
): string {
  let out = template.split('{phone}').join(settings.renewal_phone);
  for (const [key, value] of Object.entries(extra)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

/** The exact Arabic lockout message for an expired salon, phone included. */
export async function getLockoutMessage(db: Bindings['DB']): Promise<string> {
  const settings = await getPlatformSettings(db);
  return interpolateTemplate(settings.expired_lockout_template, settings);
}

const CUSTOMER_UNAVAILABLE_MESSAGE = 'هذا الصالون غير متاح حالياً، عد قريباً';

// ---------- per-salon cycle math (all dates YYYY-MM-DD, salon-local) ----------

/** Clamp to the month's last day (Jan 31 + 1 month → Feb 28/29, not Mar 3). */
function addMonthsClamped(d: Date, n: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, lastDayOfTarget)));
}

/**
 * End date of the salon's CURRENT monthly cycle, computed from ITS OWN
 * start date: start + N months, N = however many cycles have elapsed.
 * Returns null when the start date is missing/invalid.
 */
export function monthlyCycleEndDate(startISO: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) return null;
  const start = new Date(startISO + 'T00:00:00Z');
  const now = new Date(today + 'T00:00:00Z');
  if (isNaN(start.getTime()) || isNaN(now.getTime())) return null;
  let end = addMonthsClamped(start, 1);
  while (end < now) end = addMonthsClamped(end, 1);
  return end.toISOString().slice(0, 10);
}

/**
 * Days from today until the current cycle ends (0 = today is the last day).
 * Negative → the cycle end has already passed. Null → no valid start date.
 */
export function cycleDaysRemaining(startISO: string, today: string): number | null {
  const end = monthlyCycleEndDate(startISO, today);
  if (!end) return null;
  return Math.round(
    (new Date(end + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86_400_000,
  );
}

/**
 * True when an ACTIVE salon is inside its 2-day renewal reminder window —
 * evaluated per salon from its own start date, never a shared boundary.
 */
export function isInRenewalWindow(subscriptionStartDate: string | null, today: string): boolean {
  if (!subscriptionStartDate) return false;
  const days = cycleDaysRemaining(subscriptionStartDate, today);
  return days !== null && days >= 0 && days <= 2;
}

// ---------- status transitions (idempotent + audited) ----------

/**
 * Change a salon's subscription status and write the audit log row — but
 * ONLY when the status actually changes. Safe to invoke repeatedly (cron
 * idempotency, double submissions) without duplicate log entries.
 *
 * Semantics (per the platform spec):
 *   → 'trial'  starts a fresh trial countdown from TODAY
 *   → 'active' resets subscription_start_date to TODAY (fresh monthly cycle)
 *   → 'expired' leaves the start date untouched (historical anchor)
 *
 * changedBy: 'system' for automatic transitions, the super admin's id (as
 * text) for manual changes made from the Super Admin dashboard.
 */
export async function setSalonSubscriptionStatus(
  db: Bindings['DB'],
  salonId: number,
  newStatus: SubscriptionStatus,
  changedBy: string,
): Promise<{ changed: boolean; old_status: string | null }> {
  const salon = await db
    .prepare('SELECT subscription_status, subscription_start_date FROM salons WHERE id = ?')
    .bind(salonId)
    .first<{ subscription_status: string; subscription_start_date: string | null }>();
  if (!salon) return { changed: false, old_status: null };

  const oldStatus = salon.subscription_status;
  const newStart =
    newStatus === 'expired' ? salon.subscription_start_date : todayISO();

  // Already in the target state with the same anchor → nothing to do/log.
  if (oldStatus === newStatus && salon.subscription_start_date === newStart) {
    return { changed: false, old_status: oldStatus };
  }

  const res = await db
    .prepare('UPDATE salons SET subscription_status = ?, subscription_start_date = ? WHERE id = ?')
    .bind(newStatus, newStart, salonId)
    .run();

  if ((res.meta?.changes ?? 0) > 0 && oldStatus !== newStatus) {
    await db
      .prepare(
        `INSERT INTO subscription_status_log (salon_id, old_status, new_status, changed_by)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(salonId, oldStatus, newStatus, changedBy)
      .run();
  }
  return { changed: true, old_status: oldStatus };
}

// ---------- daily cron lifecycle (Cloudflare Cron Trigger) ----------

/**
 * Runs once per day (wrangler.toml cron "30 3 * * *", routed by event.cron
 * in index.ts). Idempotent: only salons currently in trial/active are
 * selected, transitions are conditional, and log rows are only written on
 * real changes — re-running the same day is a no-op.
 *
 *  • trial  → expired  when start + trial_duration_days has passed
 *  • active → expired  when the salon's own monthly cycle end has passed
 * (the 2-days-before reminder needs no cron — it's computed per request.)
 */
export async function runSubscriptionLifecycle(env: Bindings): Promise<void> {
  const db = env.DB;
  const settings = await getPlatformSettings(db);
  const today = todayISO();

  // 1) Trials past their configured duration
  const { results: trials } = await db
    .prepare(
      `SELECT id, subscription_start_date FROM salons
       WHERE subscription_status = 'trial' AND subscription_start_date IS NOT NULL`,
    )
    .all<{ id: number; subscription_start_date: string }>();
  for (const s of trials ?? []) {
    const trialEnds = addDaysISO(s.subscription_start_date, settings.trial_duration_days);
    if (today > trialEnds) {
      await setSalonSubscriptionStatus(db, s.id, 'expired', 'system');
      console.log(`[Subscription] Salon ${s.id}: trial elapsed → expired (system)`);
    }
  }

  // 2) Active salons past their individual monthly cycle end
  const { results: actives } = await db
    .prepare(
      `SELECT id, subscription_start_date FROM salons
       WHERE subscription_status = 'active' AND subscription_start_date IS NOT NULL`,
    )
    .all<{ id: number; subscription_start_date: string }>();
  for (const s of actives ?? []) {
    const cycleEnd = monthlyCycleEndDate(s.subscription_start_date, today);
    if (cycleEnd && today > cycleEnd) {
      await setSalonSubscriptionStatus(db, s.id, 'expired', 'system');
      console.log(`[Subscription] Salon ${s.id}: monthly cycle ended ${cycleEnd} → expired (system)`);
    }
  }
}

// ---------- middleware ----------

/**
 * Customer-facing guard: blocks every /api/customer/* operation for an
 * expired salon — including new booking creation — with the fixed Arabic
 * unavailable message. Existing booking rows stay in the database
 * untouched; they simply become inaccessible until reactivation.
 * Used AFTER requireCustomer (which supplies `salonId`).
 */
export const requireSalonAvailable = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const salonId: number = c.get('salonId');
  const row = await c.env.DB.prepare('SELECT subscription_status FROM salons WHERE id = ?')
    .bind(salonId)
    .first<{ subscription_status: string }>();
  if (row?.subscription_status === 'expired') {
    return c.json({ error: CUSTOMER_UNAVAILABLE_MESSAGE, code: 'SALON_UNAVAILABLE' }, 403);
  }
  await next();
});

export { CUSTOMER_UNAVAILABLE_MESSAGE };
