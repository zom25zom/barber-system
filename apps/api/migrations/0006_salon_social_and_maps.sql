-- Add social links and Google Maps URL to salons table
ALTER TABLE salons ADD COLUMN social_facebook TEXT;
ALTER TABLE salons ADD COLUMN social_instagram TEXT;
ALTER TABLE salons ADD COLUMN social_tiktok TEXT;
ALTER TABLE salons ADD COLUMN social_whatsapp TEXT;
ALTER TABLE salons ADD COLUMN maps_url TEXT;
