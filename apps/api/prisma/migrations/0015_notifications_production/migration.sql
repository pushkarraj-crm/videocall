-- Production notification schema: referenceType, image, priority scale, new event types

CREATE TYPE "notification_reference_type_enum" AS ENUM (
  'CALL',
  'WITHDRAWAL',
  'RECHARGE',
  'KYC',
  'SYSTEM'
);

ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'recharge_failed';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'system_notice';

ALTER TABLE "notifications"
  ADD COLUMN "reference_type" "notification_reference_type_enum",
  ADD COLUMN "image" TEXT;

-- Migrate priority scale: normal/important/urgent -> low/normal/high/urgent
CREATE TYPE "notification_priority_enum_v2" AS ENUM ('low', 'normal', 'high', 'urgent');

ALTER TABLE "notifications"
  ALTER COLUMN "priority" DROP DEFAULT;

ALTER TABLE "notifications"
  ALTER COLUMN "priority" TYPE "notification_priority_enum_v2"
  USING (
    CASE "priority"::text
      WHEN 'important' THEN 'high'::notification_priority_enum_v2
      WHEN 'urgent' THEN 'urgent'::notification_priority_enum_v2
      ELSE 'normal'::notification_priority_enum_v2
    END
  );

ALTER TABLE "notifications"
  ALTER COLUMN "priority" SET DEFAULT 'normal';

DROP TYPE "notification_priority_enum";
ALTER TYPE "notification_priority_enum_v2" RENAME TO "notification_priority_enum";

-- Backfill reference_type from notification type
UPDATE "notifications" SET "reference_type" = 'CALL'
  WHERE "type" IN ('incoming_call', 'missed_call', 'call_rejected', 'call_cancelled');

UPDATE "notifications" SET "reference_type" = 'WITHDRAWAL'
  WHERE "type" IN ('withdrawal_requested', 'withdrawal_approved', 'withdrawal_rejected');

UPDATE "notifications" SET "reference_type" = 'RECHARGE'
  WHERE "type" = 'recharge_success';

UPDATE "notifications" SET "reference_type" = 'KYC'
  WHERE "type" IN ('kyc_submitted', 'kyc_approved', 'kyc_rejected');

UPDATE "notifications" SET "reference_type" = 'SYSTEM'
  WHERE "type" = 'admin_announcement';

CREATE INDEX "notifications_user_id_reference_type_idx"
  ON "notifications"("user_id", "reference_type", "created_at" DESC);