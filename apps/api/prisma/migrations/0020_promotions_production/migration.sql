-- Production promo codes & campaign system

CREATE TYPE "promo_campaign_type_enum" AS ENUM (
  'welcome',
  'first_recharge',
  'weekend',
  'festival',
  'flash_sale',
  'cashback',
  'bonus_coins',
  'vip',
  'manual',
  'referral_bonus',
  'limited_time'
);

CREATE TYPE "promo_discount_type_enum" AS ENUM (
  'fixed_amount',
  'percentage',
  'bonus_coins',
  'cashback',
  'mixed'
);

CREATE TYPE "promo_visibility_enum" AS ENUM (
  'public',
  'private',
  'invite_only',
  'vip_only',
  'referral_only'
);

CREATE TYPE "campaign_status_enum" AS ENUM (
  'draft',
  'active',
  'paused',
  'ended'
);

CREATE TYPE "promo_usage_status_enum" AS ENUM (
  'pending',
  'completed',
  'cashback_pending',
  'cancelled'
);

CREATE TABLE "campaigns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(120) NOT NULL,
  "banner" TEXT,
  "status" "campaign_status_enum" NOT NULL DEFAULT 'draft',
  "start_date" TIMESTAMPTZ(6) NOT NULL,
  "end_date" TIMESTAMPTZ(6) NOT NULL,
  "priority" SMALLINT NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(32) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "campaign_type" "promo_campaign_type_enum" NOT NULL,
  "discount_type" "promo_discount_type_enum" NOT NULL,
  "discount_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "max_discount" DECIMAL(12,2),
  "minimum_recharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "bonus_coins" INTEGER NOT NULL DEFAULT 0,
  "cashback_coins" INTEGER NOT NULL DEFAULT 0,
  "usage_limit" INTEGER,
  "usage_per_user" INTEGER NOT NULL DEFAULT 1,
  "current_usage" INTEGER NOT NULL DEFAULT 0,
  "visibility" "promo_visibility_enum" NOT NULL DEFAULT 'public',
  "campaign_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_usages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "promo_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "discount_applied" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "bonus_coins_given" INTEGER NOT NULL DEFAULT 0,
  "cashback_coins_given" INTEGER NOT NULL DEFAULT 0,
  "status" "promo_usage_status_enum" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "promo_usages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "promo_id" UUID NOT NULL,
  "package_id" UUID,
  "custom_coins" INTEGER,
  "preview" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "promo_applications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");
CREATE INDEX "promo_codes_is_active_starts_at_expires_at_idx" ON "promo_codes"("is_active", "starts_at", "expires_at");
CREATE INDEX "promo_codes_campaign_type_is_active_idx" ON "promo_codes"("campaign_type", "is_active");
CREATE INDEX "promo_codes_campaign_id_idx" ON "promo_codes"("campaign_id");

CREATE UNIQUE INDEX "promo_usages_payment_id_key" ON "promo_usages"("payment_id");
CREATE INDEX "promo_usages_promo_id_created_at_idx" ON "promo_usages"("promo_id", "created_at" DESC);
CREATE INDEX "promo_usages_user_id_created_at_idx" ON "promo_usages"("user_id", "created_at" DESC);
CREATE INDEX "promo_usages_status_created_at_idx" ON "promo_usages"("status", "created_at");

CREATE UNIQUE INDEX "promo_applications_user_id_key" ON "promo_applications"("user_id");
CREATE INDEX "promo_applications_expires_at_idx" ON "promo_applications"("expires_at");

CREATE INDEX "campaigns_status_start_date_end_date_idx" ON "campaigns"("status", "start_date", "end_date");
CREATE INDEX "campaigns_priority_idx" ON "campaigns"("priority" DESC);

ALTER TABLE "promo_codes"
  ADD CONSTRAINT "promo_codes_campaign_id_fkey"
  FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "promo_usages"
  ADD CONSTRAINT "promo_usages_promo_id_fkey"
  FOREIGN KEY ("promo_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_usages"
  ADD CONSTRAINT "promo_usages_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_usages"
  ADD CONSTRAINT "promo_usages_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "promo_applications"
  ADD CONSTRAINT "promo_applications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promo_applications"
  ADD CONSTRAINT "promo_applications_promo_id_fkey"
  FOREIGN KEY ("promo_id") REFERENCES "promo_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;