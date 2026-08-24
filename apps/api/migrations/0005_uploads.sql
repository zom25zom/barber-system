-- Migration: 0005_uploads.sql
-- Table for binary media storage fallback when R2 is provisioning or local

CREATE TABLE IF NOT EXISTS uploads (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
