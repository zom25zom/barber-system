-- Migration 0014: FK enforcement — salon_id REFERENCES salons(id) on ALL tenant tables
--
-- WHY:
--   Migration 0012 added an FK only on customers.salon_id. Every other
--   tenant-scoped table (barbers, services, work_schedules, bookings,
--   waitlist, notifications, push_subscriptions) still relied purely on
--   app-layer discipline (requireOwner / resolvePublicSalonStrict) to keep
--   salon_id consistent. This closes that gap at the DATABASE level: a
--   phantom/foreign salon_id can no longer be written even by a bug.
--
-- SAFETY NOTES (same proven pattern as 0012):
--   SQLite cannot ADD an FK constraint to an existing table → full rebuild.
--   DROP TABLE fires implicit DELETEs triggering ON DELETE CASCADE on
--   dependents, so we snapshot every affected table first, drop children
--   before parents, recreate everything identically (except the new FK),
--   restore rows with explicit column lists, recreate indexes, then drop
--   backups.
--
-- NOTE ON EXISTING DATA: the restore INSERTs would fail loudly if any row
-- referenced a salon that no longer exists — that is intentional (fail
-- closed). Migration 0010/0012 repair passes verified 0 orphans.
--
-- ALSO (session hygiene — see cleanup.ts / index.ts scheduled handler):
--   • idx_sessions_owner   — sessions purge / invalidation by owner
--   • idx_sessions_expiry  — periodic DELETE of expired sessions

-- ── 1. Backups ──────────────────────────────────────────────────────────
CREATE TABLE _mig14_barbers AS SELECT * FROM barbers;
CREATE TABLE _mig14_services AS SELECT * FROM services;
CREATE TABLE _mig14_work_schedules AS SELECT * FROM work_schedules;
CREATE TABLE _mig14_time_off AS SELECT * FROM barber_time_off;
CREATE TABLE _mig14_breaks AS SELECT * FROM barber_breaks;
CREATE TABLE _mig14_bookings AS SELECT * FROM bookings;
CREATE TABLE _mig14_bservices AS SELECT * FROM booking_services;
CREATE TABLE _mig14_waitlist AS SELECT * FROM waitlist;
CREATE TABLE _mig14_notifications AS SELECT * FROM notifications;
CREATE TABLE _mig14_push AS SELECT * FROM push_subscriptions;

-- ── 2. Drop children before parents ────────────────────────────────────
DROP TABLE push_subscriptions;
DROP TABLE notifications;
DROP TABLE booking_services;
DROP TABLE bookings;
DROP TABLE waitlist;
DROP TABLE barber_time_off;
DROP TABLE barber_breaks;
DROP TABLE work_schedules;
DROP TABLE services;
DROP TABLE barbers;

-- ── 3. Recreate parents first — barbers now carries the salon FK ───────
CREATE TABLE barbers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  photo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1,
  -- NEW: referential integrity for the tenant column
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO barbers_new (id, name, photo_url, is_active, created_at, salon_id)
  SELECT id, name, photo_url, is_active, created_at, salon_id FROM _mig14_barbers;
ALTER TABLE barbers_new RENAME TO barbers;
CREATE INDEX idx_barbers_salon ON barbers (salon_id, is_active);

-- ── services ────────────────────────────────────────────────────────────
CREATE TABLE services_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO services_new (id, barber_id, name, price, duration_minutes, created_at, salon_id)
  SELECT id, barber_id, name, price, duration_minutes, created_at, salon_id FROM _mig14_services;
ALTER TABLE services_new RENAME TO services;
CREATE INDEX idx_services_salon ON services (salon_id, barber_id);

-- ── work_schedules (shape unchanged; rebuilt because it references barbers) ──
CREATE TABLE work_schedules_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_day_off INTEGER NOT NULL DEFAULT 0,
  salon_id INTEGER NOT NULL DEFAULT 1,
  UNIQUE (barber_id, day_of_week),
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO work_schedules_new (id, barber_id, day_of_week, start_time, end_time, is_day_off, salon_id)
  SELECT id, barber_id, day_of_week, start_time, end_time, is_day_off, salon_id FROM _mig14_work_schedules;
ALTER TABLE work_schedules_new RENAME TO work_schedules;

-- ── barber_time_off / barber_breaks (identical shape to migration 0004; rebuilt
--    because dropping barbers requires its dependents gone first) ──────────
CREATE TABLE barber_time_off (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL DEFAULT 1 REFERENCES salons(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(salon_id, barber_id, date)
);
INSERT INTO barber_time_off (id, salon_id, barber_id, date, reason, created_at)
  SELECT id, salon_id, barber_id, date, reason, created_at FROM _mig14_time_off;
CREATE INDEX idx_barber_time_off ON barber_time_off(salon_id, barber_id, date);

CREATE TABLE barber_breaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL DEFAULT 1 REFERENCES salons(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO barber_breaks (id, salon_id, barber_id, day_of_week, start_time, end_time, created_at)
  SELECT id, salon_id, barber_id, day_of_week, start_time, end_time, created_at FROM _mig14_breaks;
CREATE INDEX idx_barber_breaks ON barber_breaks(salon_id, barber_id, day_of_week);

-- ── bookings (0012 shape + salon FK; keeps 0013 partial unique indexes) ──
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  booking_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  total_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO bookings (id, customer_id, barber_id, booking_date, start_time, end_time, status, total_price, created_at, salon_id)
  SELECT id, customer_id, barber_id, booking_date, start_time, end_time, status, total_price, created_at, salon_id FROM _mig14_bookings;
CREATE INDEX idx_bookings_barber_date ON bookings (barber_id, booking_date, status);
CREATE INDEX idx_bookings_customer ON bookings (customer_id);
CREATE INDEX idx_bookings_salon_date ON bookings (salon_id, barber_id, booking_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_barber_slot
  ON bookings (barber_id, booking_date, start_time) WHERE status = 'confirmed';
CREATE UNIQUE INDEX IF NOT EXISTS ux_bookings_customer_active
  ON bookings (customer_id) WHERE status = 'confirmed';

-- ── booking_services (shape unchanged) ──────────────────────────────────
CREATE TABLE booking_services (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  PRIMARY KEY (booking_id, service_id)
);
INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes)
  SELECT booking_id, service_id, name, price, duration_minutes FROM _mig14_bservices;

-- ── waitlist (0012 shape + salon FK) ────────────────────────────────────
CREATE TABLE waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  desired_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','notified','fulfilled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1,
  UNIQUE (customer_id, barber_id, desired_date, start_time),
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO waitlist (id, customer_id, barber_id, desired_date, start_time, end_time, status, created_at, salon_id)
  SELECT id, customer_id, barber_id, desired_date, start_time, end_time, status, created_at, salon_id FROM _mig14_waitlist;
CREATE INDEX idx_waitlist_salon_date ON waitlist (salon_id, barber_id, desired_date, status);

-- ── notifications (0011 shape + salon FK) ───────────────────────────────
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('owner','customer')),
  recipient_id INTEGER,
  type TEXT NOT NULL CHECK (type IN ('new_booking','cancellation','waitlist_available','reminder')),
  message TEXT NOT NULL,
  booking_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO notifications (id, recipient_type, recipient_id, type, message, booking_id, is_read, created_at, salon_id)
  SELECT id, recipient_type, recipient_id, type, message, booking_id, is_read, created_at, salon_id FROM _mig14_notifications;
CREATE INDEX idx_notifications_recipient ON notifications (recipient_type, recipient_id, is_read);
CREATE INDEX idx_notifications_salon ON notifications (salon_id, recipient_type, recipient_id, is_read);

-- ── push_subscriptions (0002 shape + salon FK) ──────────────────────────
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_type TEXT NOT NULL,
  customer_id INTEGER,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  salon_id INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO push_subscriptions (id, user_type, customer_id, endpoint, p256dh, auth, created_at, salon_id)
  SELECT id, user_type, customer_id, endpoint, p256dh, auth, created_at, salon_id FROM _mig14_push;
CREATE INDEX idx_push_user ON push_subscriptions (user_type, customer_id);
CREATE INDEX idx_push_salon ON push_subscriptions (salon_id, user_type, customer_id);

-- ── 4. Session indexes (periodic purge + owner invalidation) ───────────
CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

-- ── 5. Cleanup backups ─────────────────────────────────────────────────
DROP TABLE _mig14_barbers;
DROP TABLE _mig14_services;
DROP TABLE _mig14_work_schedules;
DROP TABLE _mig14_time_off;
DROP TABLE _mig14_breaks;
DROP TABLE _mig14_bookings;
DROP TABLE _mig14_bservices;
DROP TABLE _mig14_waitlist;
DROP TABLE _mig14_notifications;
DROP TABLE _mig14_push;
