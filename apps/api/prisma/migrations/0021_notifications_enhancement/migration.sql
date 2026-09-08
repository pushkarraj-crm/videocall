-- Production push notification enhancements (additive)

ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'call_ended';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'withdrawal_paid';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'referral_reward';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'friend_joined';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'coupon_available';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'coupon_expiring';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'festival_offer';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'bonus_coins';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'new_follower';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'new_review';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'rating_milestone';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'maintenance_notice';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'feature_release';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'security_alert';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'password_changed';
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'login_new_device';

ALTER TYPE "notification_reference_type_enum" ADD VALUE IF NOT EXISTS 'REFERRAL';
ALTER TYPE "notification_reference_type_enum" ADD VALUE IF NOT EXISTS 'PROMOTION';

CREATE TYPE "notification_broadcast_status_enum" AS ENUM ('draft', 'scheduled', 'sent', 'cancelled');

ALTER TABLE "notifications"
  ADD COLUMN IF NOT EXISTS "clicked" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "notifications_user_id_clicked_idx"
  ON "notifications"("user_id", "clicked", "created_at" DESC);

CREATE TABLE "notification_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "incoming_calls" BOOLEAN NOT NULL DEFAULT true,
  "recharge" BOOLEAN NOT NULL DEFAULT true,
  "referral" BOOLEAN NOT NULL DEFAULT true,
  "promotions" BOOLEAN NOT NULL DEFAULT true,
  "withdrawals" BOOLEAN NOT NULL DEFAULT true,
  "kyc" BOOLEAN NOT NULL DEFAULT true,
  "reviews" BOOLEAN NOT NULL DEFAULT true,
  "announcements" BOOLEAN NOT NULL DEFAULT true,
  "browser_push" BOOLEAN NOT NULL DEFAULT true,
  "sound" BOOLEAN NOT NULL DEFAULT true,
  "vibration" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_settings_user_id_key" ON "notification_settings"("user_id");

ALTER TABLE "notification_settings"
  ADD CONSTRAINT "notification_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "notification_broadcasts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "target" VARCHAR(30) NOT NULL,
  "priority" "notification_priority_enum" NOT NULL DEFAULT 'normal',
  "status" "notification_broadcast_status_enum" NOT NULL DEFAULT 'draft',
  "scheduled_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "read_count" INTEGER NOT NULL DEFAULT 0,
  "click_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_broadcasts_status_scheduled_at_idx"
  ON "notification_broadcasts"("status", "scheduled_at");

CREATE INDEX "notification_broadcasts_admin_id_created_at_idx"
  ON "notification_broadcasts"("admin_id", "created_at" DESC);

ALTER TABLE "notification_broadcasts"
  ADD CONSTRAINT "notification_broadcasts_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;