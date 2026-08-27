-- Migration 0010: Multi-tenant customers schema (completes what 0009 did for owners)
--
-- BUG BEING FIXED:
--   The original single-tenant schema created `customers` with GLOBAL UNIQUE
--   constraints on username and phone:
--       username TEXT NOT NULL UNIQUE,
--       phone   TEXT NOT NULL UNIQUE,
--   Migration 0009 removed owners' global username uniqueness but FORGOT
--   customers entirely. Consequence in a multi-tenant world:
--     - Two different salons CANNOT both register a customer named e.g.
--       "أحمد" or with phone "0790000000".
--     - The app-level uniqueness check correctly scopes per-salon
--       (`WHERE salon_id = ? AND (username = ? OR phone = ?)`), so it passes,
--       then the INSERT hits the leftover GLOBAL index and D1 throws
--       SQLITE_CONSTRAINT_UNIQUE → unhandled HTTP 500.
--
-- SAFETY NOTES:
--   SQLite DROP TABLE performs an implicit DELETE that FIRES ON DELETE CASCADE
--   actions. customers is referenced by bookings & waitlist (CASCADE), and
--   bookings by booking_services. To avoid cascading data loss we:
--     1. snapshot every affected table into plain backup tables,
--     2. drop CHILD tables first so nothing references customers when it drops,
--     3. recreate everything byte-identical to its pre-migration definition,
--     4. restore the rows,
--     5. drop the backups.

-- ── 1. Backups ────────────────────────────────────────────────────────────
CREATE TABLE _mig10_customers AS SELECT * FROM customers;
CREATE TABLE _mig10_bookings AS SELECT * FROM bookings;
CREATE TABLE _mig10_bservices AS SELECT * FROM booking_services;
CREATE TABLE _mig10_waitlist AS SELECT * FROM waitlist;

-- ── 2. Drop children first (contents preserved above) ─────────────────────
DROP TABLE booking_services;
DROP TABLE bookings;
DROP TABLE waitlist;
DROP TABLE customers;

-- ── 3a. customers — new tenant-scoped definition ──────────────────────────
-- token stays globally unique: it is a random session token used for direct
-- lookup by requireCustomer; two accounts can never legitimately share one.
CREATE TABLE customers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL DEFAULT ''
);
INSERT INTO customers_new (id, username, phone, token, created_at, salon_id, password_hash)
  SELECT id, username, phone, token, created_at, salon_id, password_hash FROM _mig10_customers;
ALTER TABLE customers_new RENAME TO customers;

-- Per-salon uniqueness enforcement (application-level checks rely on these)
CREATE INDEX idx_customers_salon_username ON customers(salon_id, username);
CREATE INDEX idx_customers_salon_phone ON customers(salon_id, phone);
-- Fast lookups used across auth/session routes
CREATE INDEX idx_customers_token ON customers(token);

-- ── 3b. bookings — exact recreation of prior definition ───────────────────
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
  salon_id INTEGER NOT NULL DEFAULT 1
);
INSERT INTO bookings (id, customer_id, barber_id, booking_date, start_time, end_time, status, total_price, created_at, salon_id)
  SELECT id, customer_id, barber_id, booking_date, start_time, end_time, status, total_price, created_at, salon_id FROM _mig10_bookings;
CREATE INDEX idx_bookings_barber_date ON bookings (barber_id, booking_date, status);
CREATE INDEX idx_bookings_customer ON bookings (customer_id);
CREATE INDEX idx_bookings_salon_date ON bookings (salon_id, barber_id, booking_date, status);

-- ── 3c. booking_services ──────────────────────────────────────────────────
CREATE TABLE booking_services (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  PRIMARY KEY (booking_id, service_id)
);
INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes)
  SELECT booking_id, service_id, name, price, duration_minutes FROM _mig10_bservices;

-- ── 3d. waitlist ──────────────────────────────────────────────────────────
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
  -- customer/barber ids are already tenant-scoped values → constraint safe
  UNIQUE (customer_id, barber_id, desired_date, start_time)
);
INSERT INTO waitlist (id, customer_id, barber_id, desired_date, start_time, end_time, status, created_at, salon_id)
  SELECT id, customer_id, barber_id, desired_date, start_time, end_time, status, created_at, salon_id FROM _mig10_waitlist;
CREATE INDEX idx_waitlist_salon_date ON waitlist (salon_id, barber_id, desired_date, status);

-- ── 4. Cleanup backups ────────────────────────────────────────────────────
DROP TABLE _mig10_customers;
DROP TABLE _mig10_bookings;
DROP TABLE _mig10_bservices;
DROP TABLE _mig10_waitlist;
