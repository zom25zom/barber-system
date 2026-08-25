-- Customer accounts now authenticate with phone + password (same SHA-256 hashing as owners).
-- Existing customers get an empty hash; they must set a password before logging in again.
-- The legacy `token` column is kept: it still stores the rotated session token used by requireCustomer.
ALTER TABLE customers ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';
