-- Migration 0012: FK enforcement — customers.salon_id REFERENCES salons(id)
--
-- WHY:
--   Closes the last integrity gap that allowed BUG-2 (customers rows with
--   salon_id=1 pointing at a nonexistent salon). The DB can now reject any
--   write whose salon_id does not exist, as a second line of defense behind
--   resolvePublicSalonStrict() in the API layer.
--
-- SAFETY NOTES (same pattern as 0010):
--   SQLite cannot ADD an FK constraint to an existing table → full rebuild.
--   DROP TABLE fires implicit DELETEs triggering ON DELETE CASCADE on
--   dependents, so we snapshot every affected table first, drop children
--   before parents, recreate everything identically (except the new FK),
--   restore rows, then drop backups.
--
-- NOTE ON EXISTING DATA: this migration requires ZERO orphan rows
-- (customers.salon_id not present in salons). Migration 0010 already left a
-- clean dataset and the remote repair pass verified 0 orphans remain.

-- ── 1. Backups ──────────────────────────────────────────────────────────
CREATE TABLE _mig12_customers AS SELECT * FROM customers;
CREATE TABLE _mig12_bookings AS SELECT * FROM bookings;
CREATE TABLE _mig12_bservices AS SELECT * FROM booking_services;
CREATE TABLE _mig12_waitlist AS SELECT * FROM waitlist;

-- ── 2. Drop children first ─────────────────────────────────────────────
DROP TABLE booking_services;
DROP TABLE bookings;
DROP TABLE waitlist;
DROP TABLE customers;

-- ── 3a. customers — rebuilt WITH FK to salons(id) ───────────────────────
CREATE TABLE customers_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  phone TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  -- NEW: referential integrity — no more phantom salon_id values possible
  FOREIGN KEY (salon_id) REFERENCES salons(id)
);
INSERT INTO customers_new (id, username, phone, token, created_at, salon_id, password_hash)
  SELECT id, username, phone, token, created_at, salon_id, password_hash FROM _mig12_customers;
ALTER TABLE customers_new RENAME TO customers;

CREATE INDEX idx_customers_salon_username ON customers(salon_id, username);
CREATE INDEX idx_customers_salon_phone ON customers(salon_id, phone);
CREATE INDEX idx_customers_token ON customers(token);

-- ── 3b. bookings — exact recreation (unchanged shape) ───────────────────
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
  SELECT id, customer_id, barber_id, booking_date, start_time, end_time, status, total_price, created_at, salon_id FROM _mig12_bookings;
CREATE INDEX idx_bookings_barber_date ON bookings (barber_id, booking_date, status);
CREATE INDEX idx_bookings_customer ON bookings (customer_id);
CREATE INDEX idx_bookings_salon_date ON bookings (salon_id, barber_id, booking_date, status);

-- ── 3c. booking_services ────────────────────────────────────────────────
CREATE TABLE booking_services (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  PRIMARY KEY (booking_id, service_id)
);
INSERT INTO booking_services (booking_id, service_id, name, price, duration_minutes)
  SELECT booking_id, service_id, name, price, duration_minutes FROM _mig12_bservices;

-- ── 3d. waitlist ───────────────────────────────────────────────────────
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
  UNIQUE (customer_id, barber_id, desired_date, start_time)
);
INSERT INTO waitlist (id, customer_id, barber_id, desired_date, start_time, end_time, status, created_at, salon_id)
  SELECT id, customer_id, barber_id, desired_date, start_time, end_time, status, created_at, salon_id FROM _mig12_waitlist;
CREATE INDEX idx_waitlist_salon_date ON waitlist (salon_id, barber_id, desired_date, status);

-- ── 4. Cleanup backups ─────────────────────────────────────────────────
DROP TABLE _mig12_customers;
DROP TABLE _mig12_bookings;
DROP TABLE _mig12_bservices;
DROP TABLE _mig12_waitlist;
