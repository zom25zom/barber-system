-- Migration: 0004_barber_flexibility.sql
-- Supports specific date time-offs and multiple daily breaks for barbers

CREATE TABLE IF NOT EXISTS barber_time_off (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL DEFAULT 1 REFERENCES salons(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(salon_id, barber_id, date)
);

CREATE TABLE IF NOT EXISTS barber_breaks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  salon_id INTEGER NOT NULL DEFAULT 1 REFERENCES salons(id) ON DELETE CASCADE,
  barber_id INTEGER NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  start_time TEXT NOT NULL,      -- "HH:MM"
  end_time TEXT NOT NULL,        -- "HH:MM"
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_barber_time_off ON barber_time_off(salon_id, barber_id, date);
CREATE INDEX IF NOT EXISTS idx_barber_breaks ON barber_breaks(salon_id, barber_id, day_of_week);
