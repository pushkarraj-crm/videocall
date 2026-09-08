-- Production referral & invite enhancements (additive columns)

ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "reward_given" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ(6);
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6);
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "admin_note" TEXT;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "referred_ip" INET;
ALTER TABLE "referrals" ADD COLUMN IF NOT EXISTS "referred_device_fingerprint" VARCHAR(64);

UPDATE "referrals" SET "completed_at" = "qualified_at" WHERE "qualified_at" IS NOT NULL AND "completed_at" IS NULL;
UPDATE "referrals" SET "reward_given" = true WHERE "status" = 'rewarded' AND "reward_given" = false;
UPDATE "referrals" SET "cancelled_at" = "updated_at" WHERE "status" = 'rejected' AND "cancelled_at" IS NULL;

CREATE INDEX IF NOT EXISTS "referrals_status_completed_at_idx"
  ON "referrals"("status", "completed_at" DESC);

CREATE INDEX IF NOT EXISTS "referrals_reward_given_idx"
  ON "referrals"("reward_given", "created_at" DESC);