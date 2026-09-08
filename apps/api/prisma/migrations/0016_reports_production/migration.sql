-- Production report & moderation fields

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "admin_note" TEXT;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "community_warning_visible" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "report_category_enum" ADD VALUE IF NOT EXISTS 'fake_profile';
ALTER TYPE "report_category_enum" ADD VALUE IF NOT EXISTS 'abusive_language';
ALTER TYPE "report_category_enum" ADD VALUE IF NOT EXISTS 'nudity';
ALTER TYPE "report_category_enum" ADD VALUE IF NOT EXISTS 'scam';
ALTER TYPE "report_category_enum" ADD VALUE IF NOT EXISTS 'underage';

CREATE INDEX IF NOT EXISTS "reports_reporter_id_created_at_idx"
  ON "reports"("reporter_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reports_status_created_at_idx"
  ON "reports"("status", "created_at" DESC);