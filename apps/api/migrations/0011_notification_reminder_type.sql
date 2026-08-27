-- Migration 0011: Allow 'reminder' notification type (fixes broken reminders)
--
-- BUG BEING FIXED:
--   Migration 0001 defined notifications.type CHECK as:
--       CHECK (type IN ('new_booking','cancellation','waitlist_available'))
--   The reminder feature (booking-reminders queue consumer in index.ts) inserts
--   type = 'reminder' → every reminder INSERT fails with SQLITE_CONSTRAINT_CHECK.
--   The queue retries 3× then drops the message. Result: customers NEVER receive
--   their 20-minute-before appointment reminders, while the rest of the booking
--   flow appears healthy.
--
-- Fix: recreate the table with 'reminder' added to the allowed set and restore
-- all rows. No other table references notifications (no FK), so a plain
-- backup/swap rebuild is safe.

CREATE TABLE notifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('owner','customer')),
  recipient_id INTEGER,
  type TEXT NOT NULL CHECK (type IN ('new_booking','cancellation','waitlist_available','reminder')),
  message TEXT NOT NULL,
  booking_id INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1
);

INSERT INTO notifications_new (id, recipient_type, recipient_id, type, message, booking_id, is_read, created_at, salon_id)
  SELECT id, recipient_type, recipient_id, type, message, booking_id, is_read, created_at, salon_id FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

CREATE INDEX idx_notifications_recipient ON notifications (recipient_type, recipient_id, is_read);
CREATE INDEX idx_notifications_salon ON notifications (salon_id, recipient_type, recipient_id, is_read);
