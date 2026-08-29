-- ═══════════════════════════════════════════════════════════════════════
-- 0015 — Subscription lifecycle + Super Admin (platform owner) isolation
-- ═══════════════════════════════════════════════════════════════════════
-- Adds:
--   1. Remaining subscription columns on `salons` (subscription_status
--      already exists since 0009, default 'trial').
--   2. subscription_status_log — audit trail of EVERY status change
--      (manual super-admin changes AND automatic system transitions).
--   3. platform_settings — key-value config (phone, message templates,
--      trial duration). Nothing subscription-related is ever hardcoded.
--   4. super_admins + super_admin_sessions — a FULLY separate auth realm
--      for the platform owner. NO default account is seeded on purpose:
--      create the first one after deployment via
--      scripts/create-super-admin.mjs (strong secret you generate).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1) Subscription columns on salons ──────────────────────────────────
-- The per-salon monthly cycle anchor: the date the current status/cycle
-- began (salon-local, Jordan UTC+3). A salon registered on the 15th
-- renews every 15th — never a shared calendar month.
ALTER TABLE salons ADD COLUMN subscription_start_date TEXT;

-- Currently always 'manual'. Stored as a field so a future value like
-- 'stripe' needs zero schema changes.
ALTER TABLE salons ADD COLUMN billing_cycle_type TEXT NOT NULL DEFAULT 'manual';

-- RESERVED for future payment-gateway integration — nullable, unused now,
-- present so the schema never needs a rewrite when payments arrive:
--   payment_provider  → e.g. 'stripe' | 'tap' | 'paypal'
--   payment_reference → provider subscription/customer id
ALTER TABLE salons ADD COLUMN payment_provider TEXT;
ALTER TABLE salons ADD COLUMN payment_reference TEXT;

-- Backfill: existing salons' first cycle anchors to their registration date
UPDATE salons
SET subscription_start_date = substr(created_at, 1, 10)
WHERE subscription_start_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_salons_subscription_status ON salons(subscription_status);

-- ── 2) Status-change audit log ─────────────────────────────────────────
-- changed_by = 'system'          → automatic cron transitions
-- changed_by = '<super_admin_id>' → manual change by the platform owner
CREATE TABLE subscription_status_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  changed_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sublog_salon ON subscription_status_log(salon_id, changed_at);

-- ── 3) Platform settings (key-value) ───────────────────────────────────
-- The renewal phone number lives HERE and only here: both the reminder
-- banner and the expired-lockout message interpolate {phone} from these
-- values at request time, so updating the number once updates everything.
CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO platform_settings (key, value) VALUES
  ('renewal_phone', '0795105850'),
  ('renewal_banner_template', 'ينتهي اشتراكك الشهري بعد يومين ({date}). يرجى تجديد الاشتراك بالتواصل مع الرقم {phone} لتفادي توقف النظام.'),
  ('expired_lockout_template', 'لقد تم انتهاء دورة اشتراكك الشهري في النظام، يرجى إعادة تجديد اشتراكك من خلال التواصل مع الرقم {phone}'),
  ('trial_duration_days', '30');

-- ── 4) Super Admin — fully isolated auth realm ─────────────────────────
-- Passwords use SALTED PBKDF2-SHA256 (100k iterations) — deliberately
-- stronger than the tenant owners' unsalted SHA-256, because this account
-- controls the entire platform.
CREATE TABLE super_admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Separate session table — NOT the tenant `sessions` table. Own expiry
-- policy (12h, enforced by the API layer).
CREATE TABLE super_admin_sessions (
  token TEXT PRIMARY KEY,
  super_admin_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_super_sessions_admin ON super_admin_sessions(super_admin_id);
