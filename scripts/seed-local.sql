-- ═══════════════════════════════════════════════════════════════════════
-- seed-local.sql — realistic test data for LOCAL dev only (never --remote!)
--
-- Populates 2 salons, owners, barbers + services + work schedules,
-- customers, and bookings spread over the last/next few days with mixed
-- statuses so the dashboard, reports and peak-hours heatmap have data.
--
-- All dates are RELATIVE to today (date('now', '-N days')) so the seed is
-- always "fresh" no matter when you run it.
--
-- Login credentials it creates:
--   Owner salon 1 → username: admin1   password: test1234
--   Owner salon 2 → username: admin2   password: test1234
--   Customer login → phone: 0790000001..0790000006, password: test1234
--
-- Run from apps/api (where wrangler.toml lives):
--   npx wrangler d1 execute barber_db --local --file ../scripts/seed-local.sql
-- ═══════════════════════════════════════════════════════════════════════

-- ── 0) Wipe previous data (makes re-seeding idempotent) ────────────────
DELETE FROM notifications;
DELETE FROM waitlist;
DELETE FROM booking_services;
DELETE FROM bookings;
DELETE FROM work_schedules;
DELETE FROM services;
DELETE FROM barbers;
DELETE FROM sessions;
DELETE FROM super_admin_sessions;
DELETE FROM customers;
DELETE FROM owners;
DELETE FROM subscription_status_log;
DELETE FROM super_admins;
DELETE FROM salons;

-- ── 1) Salons ──────────────────────────────────────────────────────────
INSERT INTO salons (id, name, phone, slug, primary_color, subscription_status, subscription_start_date, created_at) VALUES
  (1, 'صالون النجم للحلاقة', '0791111111', 'alnajm',  '#f59e0b', 'active', date('now', '-60 days'), datetime('now', '-60 days')),
  (2, 'صالون الماسة',        '0792222222', 'almasa', '#0ea5e9', 'active', date('now', '-30 days'), datetime('now', '-30 days'));

-- ── 2) Owners (password for BOTH: test1234 → unsalted sha256 hex) ──────
INSERT INTO owners (id, username, password_hash, salon_id, created_at) VALUES
  (1, 'admin1', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1, datetime('now', '-60 days')),
  (2, 'admin2', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 2, datetime('now', '-30 days'));

-- ── 3) Barbers ─────────────────────────────────────────────────────────
INSERT INTO barbers (id, name, salon_id, is_active, created_at) VALUES
  (1, 'أحمد', 1, 1, datetime('now', '-55 days')),
  (2, 'خالد', 1, 1, datetime('now', '-55 days')),
  (3, 'يوسف', 1, 1, datetime('now', '-40 days')),
  (4, 'سامر', 2, 1, datetime('now', '-30 days')),
  (5, 'فادي', 2, 1, datetime('now', '-25 days'));

-- ── 4) Services (per barber) ───────────────────────────────────────────
INSERT INTO services (id, barber_id, salon_id, name, price, duration_minutes, created_at) VALUES
  -- أحمد (salon 1)
  (1,  1, 1, 'قص شعر',        7.0,  30, datetime('now', '-55 days')),
  (2,  1, 1, 'حلاقة ذقن',     4.0,  20, datetime('now', '-55 days')),
  (3,  1, 1, 'قص + ذقن',     10.0,  45, datetime('now', '-55 days')),
  -- خالد (salon 1)
  (4,  2, 1, 'قص شعر',        7.0,  30, datetime('now', '-55 days')),
  (5,  2, 1, 'تدريج شعر',     6.0,  25, datetime('now', '-55 days')),
  (6,  2, 1, 'عناية بالبشرة', 12.0, 40, datetime('now', '-55 days')),
  -- يوسف (salon 1)
  (7,  3, 1, 'قص شعر',        8.0,  30, datetime('now', '-40 days')),
  (8,  3, 1, 'حلاقة ذقن',     5.0,  20, datetime('now', '-40 days')),
  -- سامر (salon 2)
  (9,  4, 2, 'قص شعر',       12.0,  45, datetime('now', '-30 days')),
  (10, 4, 2, 'عناية باللحية',  8.0,  30, datetime('now', '-30 days')),
  (11, 4, 2, 'قص + لحية',     15.0,  60, datetime('now', '-30 days')),
  -- فادي (salon 2)
  (12, 5, 2, 'قص شعر',       10.0,  40, datetime('now', '-25 days')),
  (13, 5, 2, 'تدريج شعر',      8.0,  30, datetime('now', '-25 days'));

-- ── 5) Work schedules ──────────────────────────────────────────────────
-- day_of_week: 0=Sunday .. 6=Saturday. Friday (5) off for everyone.
INSERT INTO work_schedules (barber_id, salon_id, day_of_week, start_time, end_time, is_day_off) VALUES
  -- أحمد: Sat–Thu 10:00–22:00
  (1, 1, 0, '10:00', '22:00', 0), (1, 1, 1, '10:00', '22:00', 0), (1, 1, 2, '10:00', '22:00', 0),
  (1, 1, 3, '10:00', '22:00', 0), (1, 1, 4, '10:00', '22:00', 0), (1, 1, 5, '10:00', '22:00', 1),
  (1, 1, 6, '10:00', '22:00', 0),
  -- خالد: Sat–Thu 12:00–22:00
  (2, 1, 0, '12:00', '22:00', 0), (2, 1, 1, '12:00', '22:00', 0), (2, 1, 2, '12:00', '22:00', 0),
  (2, 1, 3, '12:00', '22:00', 0), (2, 1, 4, '12:00', '22:00', 0), (2, 1, 5, '12:00', '22:00', 1),
  (2, 1, 6, '12:00', '22:00', 0),
  -- يوسف: Sun–Thu 10:00–18:00, Saturday off too
  (3, 1, 0, '10:00', '18:00', 0), (3, 1, 1, '10:00', '18:00', 0), (3, 1, 2, '10:00', '18:00', 0),
  (3, 1, 3, '10:00', '18:00', 0), (3, 1, 4, '10:00', '18:00', 0), (3, 1, 5, '10:00', '18:00', 1),
  (3, 1, 6, '10:00', '18:00', 1),
  -- سامر: Sat–Thu 11:00–21:00
  (4, 2, 0, '11:00', '21:00', 0), (4, 2, 1, '11:00', '21:00', 0), (4, 2, 2, '11:00', '21:00', 0),
  (4, 2, 3, '11:00', '21:00', 0), (4, 2, 4, '11:00', '21:00', 0), (4, 2, 5, '11:00', '21:00', 1),
  (4, 2, 6, '11:00', '21:00', 0),
  -- فادي: Sat–Thu 14:00–22:00
  (5, 2, 0, '14:00', '22:00', 0), (5, 2, 1, '14:00', '22:00', 0), (5, 2, 2, '14:00', '22:00', 0),
  (5, 2, 3, '14:00', '22:00', 0), (5, 2, 4, '14:00', '22:00', 0), (5, 2, 5, '14:00', '22:00', 1),
  (5, 2, 6, '14:00', '22:00', 0);

-- ── 6) Customers (password for ALL: test1234 — same unsalted sha256) ───
INSERT INTO customers (id, username, phone, token, password_hash, salon_id, created_at) VALUES
  (1, 'عمر',  '0790000001', 'dev-token-c1', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1, datetime('now', '-50 days')),
  (2, 'ليث',  '0790000002', 'dev-token-c2', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1, datetime('now', '-45 days')),
  (3, 'زياد', '0790000003', 'dev-token-c3', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 1, datetime('now', '-35 days')),
  (4, 'كرم',  '0790000004', 'dev-token-c4', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 2, datetime('now', '-28 days')),
  (5, 'مالك', '0790000005', 'dev-token-c5', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 2, datetime('now', '-20 days')),
  (6, 'رامي', '0790000006', 'dev-token-c6', '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244', 2, datetime('now', '-15 days'));

-- ── 7) Bookings (mixed dates + statuses) ───────────────────────────────
INSERT INTO bookings (id, customer_id, barber_id, salon_id, booking_date, start_time, end_time, status, total_price, created_at) VALUES
  -- past — completed
  (1,  1, 1, 1, date('now', '-9 days'), '10:00', '10:30', 'completed', 7.0,  datetime('now', '-9 days', '-2 hours')),
  (2,  2, 1, 1, date('now', '-9 days'), '11:00', '11:20', 'completed', 4.0,  datetime('now', '-9 days', '-3 hours')),
  (4,  1, 2, 1, date('now', '-6 days'), '17:00', '17:40', 'completed', 12.0, datetime('now', '-6 days', '-1 hours')),
  (6,  4, 4, 2, date('now', '-4 days'), '11:00', '12:00', 'completed', 15.0, datetime('now', '-4 days', '-2 hours')),
  (8,  2, 3, 1, date('now', '-2 days'), '19:00', '19:30', 'completed', 8.0,  datetime('now', '-2 days', '-4 hours')),
  (9,  3, 1, 1, date('now', '-1 days'), '10:30', '11:15', 'completed', 10.0, datetime('now', '-1 days', '-2 hours')),
  -- past — no-show
  (3,  3, 2, 1, date('now', '-8 days'), '12:00', '12:25', 'no_show',   6.0,  datetime('now', '-8 days', '-1 hours')),
  (7,  6, 4, 2, date('now', '-3 days'), '18:00', '18:30', 'no_show',   8.0,  datetime('now', '-3 days', '-3 hours')),
  -- past — cancelled
  (5,  4, 1, 1, date('now', '-5 days'), '15:00', '15:30', 'cancelled', 7.0,  datetime('now', '-5 days', '-6 hours')),
  -- today — confirmed
  (10, 1, 1, 1, date('now'),            '12:00', '12:30', 'confirmed', 7.0,  datetime('now', '-1 hours')),
  (11, 4, 2, 1, date('now'),            '16:00', '16:30', 'confirmed', 7.0,  datetime('now', '-30 minutes')),
  -- future — confirmed
  (12, 5, 1, 1, date('now', '+1 days'), '11:00', '11:30', 'confirmed', 7.0,  datetime('now', '-20 minutes')),
  (13, 6, 4, 2, date('now', '+1 days'), '17:00', '17:45', 'confirmed', 12.0, datetime('now', '-15 minutes')),
  (14, 2, 3, 1, date('now', '+2 days'), '18:00', '18:20', 'confirmed', 5.0,  datetime('now', '-10 minutes'));

-- Services attached to each booking (snapshot of name/price/duration)
INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes) VALUES
  (1,  1,  'قص شعر',        7.0,  30),
  (2,  2,  'حلاقة ذقن',     4.0,  20),
  (3,  5,  'تدريج شعر',     6.0,  25),
  (4,  6,  'عناية بالبشرة', 12.0, 40),
  (5,  1,  'قص شعر',        7.0,  30),
  (6,  11, 'قص + لحية',     15.0, 60),
  (7,  10, 'عناية باللحية', 8.0,  30),
  (8,  7,  'قص شعر',        8.0,  30),
  (9,  3,  'قص + ذقن',      10.0, 45),
  (10, 1,  'قص شعر',        7.0,  30),
  (11, 4,  'قص شعر',        7.0,  30),
  (12, 1,  'قص شعر',        7.0,  30),
  (13, 9,  'قص شعر',        12.0, 45),
  (14, 8,  'حلاقة ذقن',     5.0,  20);

-- ── 8) Owner notifications (unread ones light up the admin badge) ──────
INSERT INTO notifications (recipient_type, recipient_id, salon_id, type, message, booking_id, is_read, created_at) VALUES
  ('owner', NULL, 1, 'new_booking',  'حجز جديد من عمر — أحمد، اليوم 12:00',  10, 0, datetime('now', '-1 hours')),
  ('owner', NULL, 1, 'new_booking',  'حجز جديد من كرم — خالد، اليوم 16:00',  11, 0, datetime('now', '-30 minutes')),
  ('owner', NULL, 1, 'cancellation', 'أُلغي حجز كرم مع أحمد',                5,  0, datetime('now', '-5 days')),
  ('owner', NULL, 1, 'new_booking',  'حجز جديد من ليث — أحمد، غداً 11:00',   12, 1, datetime('now', '-20 minutes')),
  ('owner', NULL, 2, 'new_booking',  'حجز جديد من رامي — سامر، غداً 17:00',  13, 0, datetime('now', '-15 minutes'));

-- ── 9) One waitlist entry (waiting for a slot) ─────────────────────────
INSERT INTO waitlist (customer_id, barber_id, salon_id, desired_date, start_time, end_time, status, created_at) VALUES
  (2, 1, 1, date('now', '+2 days'), '17:00', '17:30', 'waiting', datetime('now', '-2 hours'));

-- Done. Sanity checks:
--   SELECT salon_id, status, COUNT(*) FROM bookings GROUP BY 1, 2;
--   SELECT id, name, slug FROM salons;
