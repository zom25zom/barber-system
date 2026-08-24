-- Multi-Tenant Readiness Migration
-- Adds salon_id to all tenant-scoped tables for future multi-tenant SaaS support.
-- Default salon (id=1) ensures backward compatibility with existing data.

-- 1. Create the salons master table
CREATE TABLE salons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#f59e0b',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed default salon matching existing data
INSERT INTO salons (id, name) VALUES (1, 'Default Salon');

-- 2. Add salon_id column to every tenant-scoped table (DEFAULT 1 = existing data)
-- Note: SQLite ALTER TABLE does not support REFERENCES in ADD COLUMN with non-null defaults,
-- so foreign key relationships are enforced at the application layer and via indexes.
ALTER TABLE owners ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE customers ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE barbers ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE services ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_schedules ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bookings ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE waitlist ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE push_subscriptions ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;

-- 3. Composite unique indexes (salon_id + original unique columns)
-- These prepare the schema for multi-tenant: same username/phone allowed across salons.
-- Note: SQLite cannot DROP the original UNIQUE constraints via ALTER TABLE,
-- so they remain as a stricter (but harmless in single-tenant) guard.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_salon_username ON customers (salon_id, username);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_salon_phone ON customers (salon_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_salon_username ON owners (salon_id, username);

-- Composite indexes for query performance with salon_id
CREATE INDEX IF NOT EXISTS idx_barbers_salon ON barbers (salon_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_salon_date ON bookings (salon_id, barber_id, booking_date, status);
CREATE INDEX IF NOT EXISTS idx_notifications_salon ON notifications (salon_id, recipient_type, recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_push_salon ON push_subscriptions (salon_id, user_type, customer_id);
CREATE INDEX IF NOT EXISTS idx_services_salon ON services (salon_id, barber_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_salon ON waitlist (salon_id, barber_id, desired_date, status);
