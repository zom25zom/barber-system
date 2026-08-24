-- Barbershop Booking System - Initial schema
-- Times are stored as "HH:MM" (24h); UI converts to 12-hour AM/PM display.

CREATE TABLE owners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE barbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  photo_url TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE work_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,           -- 0=Sunday .. 6=Saturday
  start_time TEXT NOT NULL,               -- "HH:MM"
  end_time TEXT NOT NULL,                 -- "HH:MM"
  is_day_off INTEGER NOT NULL DEFAULT 0,
  UNIQUE (barber_id, day_of_week)
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  booking_date TEXT NOT NULL,             -- "YYYY-MM-DD"
  start_time TEXT NOT NULL,               -- "HH:MM"
  end_time TEXT NOT NULL,                 -- "HH:MM"
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','cancelled','completed','no_show')),
  total_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookings_barber_date ON bookings (barber_id, booking_date, status);
CREATE INDEX idx_bookings_customer ON bookings (customer_id);

CREATE TABLE booking_services (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  duration_minutes INTEGER NOT NULL,
  PRIMARY KEY (booking_id, service_id)
);

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
  UNIQUE (customer_id, barber_id, desired_date, start_time)
);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('owner','customer')),
  recipient_id INTEGER,                   -- customer id; NULL for owner
  type TEXT NOT NULL CHECK (type IN ('new_booking','cancellation','waitlist_available')),
  message TEXT NOT NULL,
  booking_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifications_recipient ON notifications (recipient_type, recipient_id, is_read);

-- Default owner account (username: admin / password: admin123) -- change after first login.
INSERT INTO owners (username, password_hash) VALUES
  ('admin', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');
