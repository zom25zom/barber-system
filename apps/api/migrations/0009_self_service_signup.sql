-- Self-service salon registration support:
-- 1. owners.username uniqueness becomes PER-SALON (multi-tenant) instead of global.
--    Recreate table without the global UNIQUE, add a composite index instead.
CREATE TABLE owners_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  salon_id INTEGER NOT NULL DEFAULT 1
);
INSERT INTO owners_new (id, username, password_hash, created_at, salon_id)
  SELECT id, username, password_hash, created_at, salon_id FROM owners;
DROP TABLE owners;
ALTER TABLE owners_new RENAME TO owners;
CREATE INDEX idx_owners_salon_username ON owners(salon_id, username);

-- 2. Subscription lifecycle field for self-service signups
ALTER TABLE salons ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial';
