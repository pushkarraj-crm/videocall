-- AI Video Avatar Engine: video config + wardrobe on host profiles

ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "virtual_host_video" JSONB;
ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "virtual_host_wardrobe" JSONB;