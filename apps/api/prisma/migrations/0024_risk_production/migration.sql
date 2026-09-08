-- Production anti-fraud & risk detection (additive)

CREATE TYPE "risk_level_enum" AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TYPE "risk_event_type_enum" AS ENUM (
  'signup',
  'login',
  'recharge',
  'withdrawal',
  'referral',
  'coupon',
  'call',
  'profile_update',
  'device_change',
  'payment_failed',
  'kyc_submit'
);

CREATE TYPE "fraud_flag_type_enum" AS ENUM (
  'account_abuse',
  'referral_fraud',
  'promo_fraud',
  'wallet_fraud',
  'withdrawal_fraud',
  'kyc_fraud',
  'call_fraud',
  'geo_anomaly',
  'device_abuse',
  'multi_account'
);

CREATE TYPE "fraud_flag_status_enum" AS ENUM (
  'open',
  'reviewing',
  'resolved',
  'dismissed',
  'safe'
);

CREATE TYPE "risk_queue_status_enum" AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

CREATE TABLE "risk_user_profiles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "aggregate_score" SMALLINT NOT NULL DEFAULT 0,
  "risk_level" "risk_level_enum" NOT NULL DEFAULT 'low',
  "freeze_withdrawals" BOOLEAN NOT NULL DEFAULT false,
  "freeze_referral_rewards" BOOLEAN NOT NULL DEFAULT false,
  "freeze_coupon_redemption" BOOLEAN NOT NULL DEFAULT false,
  "require_re_kyc" BOOLEAN NOT NULL DEFAULT false,
  "last_event_at" TIMESTAMPTZ(6),
  "last_country" VARCHAR(2),
  "last_ip" INET,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "risk_user_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "risk_user_profiles_user_id_key" ON "risk_user_profiles"("user_id");
CREATE INDEX "risk_user_profiles_risk_level_aggregate_score_idx"
  ON "risk_user_profiles"("risk_level", "aggregate_score" DESC);

ALTER TABLE "risk_user_profiles"
  ADD CONSTRAINT "risk_user_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "risk_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "event_type" "risk_event_type_enum" NOT NULL,
  "risk_score" SMALLINT NOT NULL,
  "risk_level" "risk_level_enum" NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "rule_id" VARCHAR(50),
  "metadata" JSONB,
  "ip_address" INET,
  "device_id" VARCHAR(64),
  "fingerprint" VARCHAR(64),
  "country" VARCHAR(2),
  "city" VARCHAR(100),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "risk_events_user_id_created_at_idx" ON "risk_events"("user_id", "created_at" DESC);
CREATE INDEX "risk_events_risk_level_created_at_idx" ON "risk_events"("risk_level", "created_at" DESC);
CREATE INDEX "risk_events_event_type_created_at_idx" ON "risk_events"("event_type", "created_at" DESC);
CREATE INDEX "risk_events_fingerprint_created_at_idx" ON "risk_events"("fingerprint", "created_at" DESC);
CREATE INDEX "risk_events_ip_address_created_at_idx" ON "risk_events"("ip_address", "created_at" DESC);

ALTER TABLE "risk_events"
  ADD CONSTRAINT "risk_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "fraud_flags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "fraud_flag_type_enum" NOT NULL,
  "status" "fraud_flag_status_enum" NOT NULL DEFAULT 'open',
  "risk_score" SMALLINT NOT NULL DEFAULT 0,
  "rule_id" VARCHAR(50),
  "reason" TEXT,
  "admin_note" TEXT,
  "resolved_at" TIMESTAMPTZ(6),
  "resolved_by_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "fraud_flags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fraud_flags_user_id_status_idx" ON "fraud_flags"("user_id", "status");
CREATE INDEX "fraud_flags_status_created_at_idx" ON "fraud_flags"("status", "created_at" DESC);
CREATE INDEX "fraud_flags_type_status_idx" ON "fraud_flags"("type", "status");

ALTER TABLE "fraud_flags"
  ADD CONSTRAINT "fraud_flags_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "device_fingerprint_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "fingerprint_hash" VARCHAR(64) NOT NULL,
  "platform" VARCHAR(20),
  "os" VARCHAR(50),
  "timezone" VARCHAR(50),
  "language" VARCHAR(20),
  "resolution" VARCHAR(20),
  "browser" VARCHAR(50),
  "last_ip" INET,
  "last_country" VARCHAR(2),
  "last_city" VARCHAR(100),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "device_fingerprint_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "device_fingerprint_records_user_id_fingerprint_hash_key"
  ON "device_fingerprint_records"("user_id", "fingerprint_hash");
CREATE INDEX "device_fingerprint_records_fingerprint_hash_idx"
  ON "device_fingerprint_records"("fingerprint_hash");
CREATE INDEX "device_fingerprint_records_last_ip_idx" ON "device_fingerprint_records"("last_ip");

ALTER TABLE "device_fingerprint_records"
  ADD CONSTRAINT "device_fingerprint_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "risk_decision_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "admin_id" UUID,
  "action" VARCHAR(100) NOT NULL,
  "rule_id" VARCHAR(50),
  "risk_score" SMALLINT,
  "details" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "risk_decision_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "risk_decision_audits_user_id_created_at_idx"
  ON "risk_decision_audits"("user_id", "created_at" DESC);
CREATE INDEX "risk_decision_audits_admin_id_created_at_idx"
  ON "risk_decision_audits"("admin_id", "created_at" DESC);
CREATE INDEX "risk_decision_audits_action_created_at_idx"
  ON "risk_decision_audits"("action", "created_at" DESC);

ALTER TABLE "risk_decision_audits"
  ADD CONSTRAINT "risk_decision_audits_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "risk_queue" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "event_type" "risk_event_type_enum" NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "risk_queue_status_enum" NOT NULL DEFAULT 'pending',
  "idempotency_key" VARCHAR(128) NOT NULL,
  "attempts" SMALLINT NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMPTZ(6),

  CONSTRAINT "risk_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "risk_queue_idempotency_key_key" ON "risk_queue"("idempotency_key");
CREATE INDEX "risk_queue_status_created_at_idx" ON "risk_queue"("status", "created_at");