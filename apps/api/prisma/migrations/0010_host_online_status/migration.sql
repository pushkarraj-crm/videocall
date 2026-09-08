-- Host online / offline / busy availability
ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "is_online" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "is_busy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ(6);

UPDATE "host_profiles" SET "is_online" = "is_available" WHERE "is_online" = false AND "is_available" = true;

CREATE INDEX IF NOT EXISTS "host_profiles_is_online_idx" ON "host_profiles"("is_online");