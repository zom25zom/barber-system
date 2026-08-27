-- Multi-tenant infrastructure:
-- 1. sessions now carry the tenant (salon_id) inside the session itself,
--    so every authenticated API request derives salon_id from its own
--    session — never from a client-supplied value.
ALTER TABLE sessions ADD COLUMN salon_id INTEGER NOT NULL DEFAULT 1;

-- 2. Public salon identification (for unauthenticated booking traffic):
--    each salon can bind a custom domain or a slug subdomain.
ALTER TABLE salons ADD COLUMN domain TEXT;
ALTER TABLE salons ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_domain ON salons(domain) WHERE domain IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_salons_slug ON salons(slug) WHERE slug IS NOT NULL;
