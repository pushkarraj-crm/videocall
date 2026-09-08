-- AI Host CMS: persisted asset slug, gallery, username
ALTER TABLE "host_profiles"
  ADD COLUMN IF NOT EXISTS "virtual_host_asset_slug" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "virtual_host_gallery" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "virtual_host_username" VARCHAR(50);

CREATE INDEX IF NOT EXISTS "host_profiles_virtual_host_asset_slug_idx"
  ON "host_profiles" ("virtual_host_asset_slug");