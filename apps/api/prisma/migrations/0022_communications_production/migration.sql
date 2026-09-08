-- Production email & SMS communications (additive)

CREATE TYPE "communication_channel_enum" AS ENUM ('email', 'sms', 'whatsapp');

CREATE TYPE "communication_event_type_enum" AS ENUM (
  'welcome_email',
  'signup_success',
  'google_login_welcome',
  'otp_verification',
  'password_reset',
  'login_new_device',
  'security_alert',
  'recharge_success',
  'recharge_failed',
  'receipt',
  'invoice',
  'kyc_submitted',
  'kyc_approved',
  'kyc_rejected',
  'withdrawal_submitted',
  'withdrawal_approved',
  'withdrawal_rejected',
  'withdrawal_paid',
  'missed_call_summary',
  'monthly_call_summary',
  'referral_reward',
  'friend_joined',
  'coupon_available',
  'coupon_expiry',
  'festival_offer',
  'admin_announcement',
  'maintenance',
  'feature_release',
  'admin_custom'
);

CREATE TYPE "communication_queue_status_enum" AS ENUM (
  'pending',
  'processing',
  'sent',
  'failed',
  'dead_letter'
);

CREATE TYPE "communication_log_status_enum" AS ENUM (
  'sent',
  'delivered',
  'opened',
  'clicked',
  'failed',
  'bounced',
  'spam',
  'unsubscribed'
);

CREATE TYPE "communication_campaign_status_enum" AS ENUM (
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled'
);

CREATE TYPE "communication_audience_enum" AS ENUM (
  'all_users',
  'hosts',
  'users',
  'verified_hosts',
  'vip_users',
  'single_user'
);

CREATE TABLE "communication_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "marketing_emails" BOOLEAN NOT NULL DEFAULT true,
  "transactional_emails" BOOLEAN NOT NULL DEFAULT true,
  "sms" BOOLEAN NOT NULL DEFAULT true,
  "promotion_emails" BOOLEAN NOT NULL DEFAULT true,
  "promotion_sms" BOOLEAN NOT NULL DEFAULT true,
  "referral_updates" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "communication_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_settings_user_id_key" ON "communication_settings"("user_id");

ALTER TABLE "communication_settings"
  ADD CONSTRAINT "communication_settings_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "communication_campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_id" UUID NOT NULL,
  "channel" "communication_channel_enum" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "subject" VARCHAR(300),
  "body" TEXT NOT NULL,
  "html_body" TEXT,
  "audience" "communication_audience_enum" NOT NULL,
  "target_user_id" UUID,
  "status" "communication_campaign_status_enum" NOT NULL DEFAULT 'draft',
  "scheduled_at" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "recipient_count" INTEGER NOT NULL DEFAULT 0,
  "delivered_count" INTEGER NOT NULL DEFAULT 0,
  "opened_count" INTEGER NOT NULL DEFAULT 0,
  "clicked_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "bounced_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "communication_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "communication_campaigns_status_scheduled_at_idx"
  ON "communication_campaigns"("status", "scheduled_at");

CREATE INDEX "communication_campaigns_admin_id_created_at_idx"
  ON "communication_campaigns"("admin_id", "created_at" DESC);

CREATE INDEX "communication_campaigns_channel_status_idx"
  ON "communication_campaigns"("channel", "status");

ALTER TABLE "communication_campaigns"
  ADD CONSTRAINT "communication_campaigns_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "communication_queue" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "campaign_id" UUID,
  "channel" "communication_channel_enum" NOT NULL,
  "event_type" "communication_event_type_enum" NOT NULL,
  "recipient" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(300),
  "body" TEXT NOT NULL,
  "html_body" TEXT,
  "template_key" VARCHAR(50) NOT NULL,
  "template_data" JSONB,
  "status" "communication_queue_status_enum" NOT NULL DEFAULT 'pending',
  "idempotency_key" VARCHAR(128) NOT NULL,
  "attempts" SMALLINT NOT NULL DEFAULT 0,
  "max_attempts" SMALLINT NOT NULL DEFAULT 5,
  "next_retry_at" TIMESTAMPTZ(6),
  "last_error" TEXT,
  "reference_id" UUID,
  "reference_type" VARCHAR(30),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "processed_at" TIMESTAMPTZ(6),

  CONSTRAINT "communication_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_queue_idempotency_key_key"
  ON "communication_queue"("idempotency_key");

CREATE INDEX "communication_queue_status_next_retry_at_created_at_idx"
  ON "communication_queue"("status", "next_retry_at", "created_at");

CREATE INDEX "communication_queue_user_id_event_type_created_at_idx"
  ON "communication_queue"("user_id", "event_type", "created_at" DESC);

CREATE INDEX "communication_queue_campaign_id_idx"
  ON "communication_queue"("campaign_id");

ALTER TABLE "communication_queue"
  ADD CONSTRAINT "communication_queue_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "communication_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "communication_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "campaign_id" UUID,
  "queue_item_id" UUID,
  "channel" "communication_channel_enum" NOT NULL,
  "event_type" "communication_event_type_enum" NOT NULL,
  "recipient" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(300),
  "status" "communication_log_status_enum" NOT NULL DEFAULT 'sent',
  "provider_id" VARCHAR(128),
  "provider_response" JSONB,
  "retry_count" SMALLINT NOT NULL DEFAULT 0,
  "opened_at" TIMESTAMPTZ(6),
  "clicked_at" TIMESTAMPTZ(6),
  "delivered_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "bounce_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_logs_queue_item_id_key"
  ON "communication_logs"("queue_item_id");

CREATE INDEX "communication_logs_channel_status_created_at_idx"
  ON "communication_logs"("channel", "status", "created_at" DESC);

CREATE INDEX "communication_logs_user_id_created_at_idx"
  ON "communication_logs"("user_id", "created_at" DESC);

CREATE INDEX "communication_logs_campaign_id_status_idx"
  ON "communication_logs"("campaign_id", "status");

CREATE INDEX "communication_logs_event_type_created_at_idx"
  ON "communication_logs"("event_type", "created_at" DESC);

ALTER TABLE "communication_logs"
  ADD CONSTRAINT "communication_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication_logs"
  ADD CONSTRAINT "communication_logs_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "communication_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "communication_logs"
  ADD CONSTRAINT "communication_logs_queue_item_id_fkey"
  FOREIGN KEY ("queue_item_id") REFERENCES "communication_queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;