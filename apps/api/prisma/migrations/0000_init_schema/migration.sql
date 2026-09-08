CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_status_enum" AS ENUM ('active', 'suspended', 'banned', 'deleted');

-- CreateEnum
CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "role_enum" AS ENUM ('user', 'host', 'moderator', 'admin', 'super_admin', 'grievance_officer', 'support');

-- CreateEnum
CREATE TYPE "consent_document_enum" AS ENUM ('terms', 'privacy', 'community_guidelines', 'host_agreement', 'pre_call', 'age_declaration');

-- CreateEnum
CREATE TYPE "wallet_tx_type_enum" AS ENUM ('recharge', 'call_charge', 'referral_bonus', 'host_earning', 'withdrawal', 'refund', 'admin_adjustment', 'payout_reversal');

-- CreateEnum
CREATE TYPE "payment_status_enum" AS ENUM ('created', 'authorized', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "referral_status_enum" AS ENUM ('pending', 'qualified', 'rewarded', 'rejected');

-- CreateEnum
CREATE TYPE "host_app_status_enum" AS ENUM ('pending', 'kyc_submitted', 'under_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "kyc_status_enum" AS ENUM ('pending', 'in_review', 'verified', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "earning_status_enum" AS ENUM ('held', 'available', 'paid', 'reversed');

-- CreateEnum
CREATE TYPE "withdrawal_status_enum" AS ENUM ('requested', 'approved', 'processing', 'completed', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "swipe_action_enum" AS ENUM ('like', 'pass');

-- CreateEnum
CREATE TYPE "call_status_enum" AS ENUM ('initiated', 'ringing', 'active', 'ended', 'missed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "call_end_reason_enum" AS ENUM ('user_ended', 'balance_zero', 'timeout', 'reported', 'network_error', 'admin_terminated');

-- CreateEnum
CREATE TYPE "msg_moderation_enum" AS ENUM ('pending', 'approved', 'flagged', 'removed');

-- CreateEnum
CREATE TYPE "report_category_enum" AS ENUM ('harassment', 'spam', 'inappropriate_content', 'fraud', 'minor_safety', 'impersonation', 'other');

-- CreateEnum
CREATE TYPE "report_status_enum" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed', 'escalated');

-- CreateEnum
CREATE TYPE "report_severity_enum" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "resolution_action_enum" AS ENUM ('warning', 'content_removed', 'temp_suspend', 'permanent_ban', 'payout_hold', 'dismissed');

-- CreateEnum
CREATE TYPE "appeal_status_enum" AS ENUM ('none', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "moderation_target_enum" AS ENUM ('user_profile', 'avatar', 'bio', 'message', 'host_application');

-- CreateEnum
CREATE TYPE "moderation_status_enum" AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'escalated');

-- CreateEnum
CREATE TYPE "grievance_status_enum" AS ENUM ('received', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "device_platform_enum" AS ENUM ('web', 'android', 'ios');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firebase_uid" VARCHAR(128) NOT NULL,
    "phone" VARCHAR(15),
    "email" VARCHAR(255),
    "display_name" VARCHAR(50) NOT NULL,
    "avatar_url" TEXT,
    "bio" VARCHAR(500),
    "date_of_birth" DATE NOT NULL,
    "gender" "gender_enum",
    "primary_language" VARCHAR(10) NOT NULL DEFAULT 'en',
    "referral_code" VARCHAR(20) NOT NULL,
    "referred_by_id" UUID,
    "abuse_score" INTEGER NOT NULL DEFAULT 0,
    "status" "user_status_enum" NOT NULL DEFAULT 'active',
    "free_calls_used" SMALLINT NOT NULL DEFAULT 0,
    "device_fingerprint" VARCHAR(64),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "role" "role_enum" NOT NULL,
    "granted_by_id" UUID,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "document_type" "consent_document_enum" NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content_url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "document_type" "consent_document_enum" NOT NULL,
    "document_version" VARCHAR(20) NOT NULL,
    "legal_document_id" UUID,
    "ip_address" INET,
    "user_agent" TEXT,
    "consented_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "balance_units" BIGINT NOT NULL DEFAULT 0,
    "locked_units" BIGINT NOT NULL DEFAULT 0,
    "lifetime_credited_units" BIGINT NOT NULL DEFAULT 0,
    "lifetime_debited_units" BIGINT NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "wallet_tx_type_enum" NOT NULL,
    "amount_units" BIGINT NOT NULL,
    "balance_after_units" BIGINT NOT NULL,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "description" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coin_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "price_inr" DECIMAL(12,2) NOT NULL,
    "coin_units" BIGINT NOT NULL,
    "bonus_units" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "coin_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referrer_id" UUID NOT NULL,
    "referred_id" UUID NOT NULL,
    "referral_code" VARCHAR(20) NOT NULL,
    "status" "referral_status_enum" NOT NULL DEFAULT 'pending',
    "referrer_reward_units" BIGINT NOT NULL DEFAULT 5000,
    "referred_reward_units" BIGINT NOT NULL DEFAULT 5000,
    "qualification_event" VARCHAR(50),
    "qualified_at" TIMESTAMPTZ(6),
    "rewarded_at" TIMESTAMPTZ(6),
    "fraud_score" SMALLINT NOT NULL DEFAULT 0,
    "fraud_flags" JSONB,
    "hold_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" "host_app_status_enum" NOT NULL DEFAULT 'pending',
    "application_note" TEXT,
    "rejection_reason" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "host_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_kyc" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_reference" VARCHAR(128),
    "pan_hash" VARCHAR(64),
    "pan_masked" VARCHAR(10),
    "aadhaar_masked" VARCHAR(12),
    "full_name" VARCHAR(100),
    "verification_status" "kyc_status_enum" NOT NULL DEFAULT 'pending',
    "failure_reason" TEXT,
    "document_storage_refs" JSONB,
    "verified_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "host_kyc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_profiles" (
    "user_id" UUID NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "host_bio" VARCHAR(500),
    "languages" JSONB NOT NULL DEFAULT '[]',
    "total_earnings_units" BIGINT NOT NULL DEFAULT 0,
    "withdrawable_units" BIGINT NOT NULL DEFAULT 0,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "total_call_seconds" BIGINT NOT NULL DEFAULT 0,
    "rating_sum" INTEGER NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "host_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "host_earnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "call_id" UUID NOT NULL,
    "billing_tick_id" UUID,
    "gross_units" BIGINT NOT NULL,
    "platform_fee_units" BIGINT NOT NULL,
    "net_units" BIGINT NOT NULL,
    "status" "earning_status_enum" NOT NULL DEFAULT 'held',
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_earnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "host_bank_accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "account_holder_name" VARCHAR(100) NOT NULL,
    "account_number_enc" TEXT NOT NULL,
    "account_number_masked" VARCHAR(20) NOT NULL,
    "ifsc_code" VARCHAR(11) NOT NULL,
    "bank_name" VARCHAR(100),
    "upi_id_enc" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "host_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "bank_account_id" UUID NOT NULL,
    "amount_units" BIGINT NOT NULL,
    "amount_inr" DECIMAL(12,2) NOT NULL,
    "tds_inr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_inr" DECIMAL(12,2) NOT NULL,
    "status" "withdrawal_status_enum" NOT NULL DEFAULT 'requested',
    "razorpay_payout_id" VARCHAR(64),
    "utr" VARCHAR(64),
    "rejection_reason" TEXT,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "processed_at" TIMESTAMPTZ(6),
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "caller_id" UUID NOT NULL,
    "callee_id" UUID NOT NULL,
    "zego_room_id" VARCHAR(64) NOT NULL,
    "status" "call_status_enum" NOT NULL DEFAULT 'initiated',
    "is_free_call" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6),
    "answered_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "coins_charged_units" BIGINT NOT NULL DEFAULT 0,
    "end_reason" "call_end_reason_enum",
    "caller_ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_billing_ticks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "call_id" UUID NOT NULL,
    "tick_number" INTEGER NOT NULL,
    "coins_deducted_units" BIGINT NOT NULL,
    "caller_balance_after_units" BIGINT NOT NULL,
    "host_earning_units" BIGINT NOT NULL,
    "platform_fee_units" BIGINT NOT NULL,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_billing_ticks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "call_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_version" VARCHAR(20) NOT NULL,
    "ip_address" INET,
    "consented_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "swiper_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "action" "swipe_action_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'swipe',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participant_a_id" UUID NOT NULL,
    "participant_b_id" UUID NOT NULL,
    "last_message_at" TIMESTAMPTZ(6),
    "last_message_preview" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "moderation_status" "msg_moderation_enum" NOT NULL DEFAULT 'approved',
    "flagged_reason" VARCHAR(100),
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "reason" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "reported_id" UUID NOT NULL,
    "call_id" UUID,
    "message_id" UUID,
    "category" "report_category_enum" NOT NULL,
    "description" TEXT,
    "evidence_url" TEXT,
    "status" "report_status_enum" NOT NULL DEFAULT 'open',
    "severity" "report_severity_enum" NOT NULL DEFAULT 'medium',
    "assigned_to_id" UUID,
    "resolution" TEXT,
    "resolution_action" "resolution_action_enum",
    "resolved_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_signals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "signal_type" VARCHAR(50) NOT NULL,
    "score_delta" INTEGER NOT NULL,
    "source_table" VARCHAR(50),
    "source_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_suspensions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "suspended_by_id" UUID NOT NULL,
    "report_id" UUID,
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),
    "is_permanent" BOOLEAN NOT NULL DEFAULT false,
    "appeal_status" "appeal_status_enum" NOT NULL DEFAULT 'none',
    "appeal_notes" TEXT,
    "lifted_at" TIMESTAMPTZ(6),
    "lifted_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderation_queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "moderation_target_enum" NOT NULL,
    "target_id" UUID NOT NULL,
    "user_id" UUID,
    "status" "moderation_status_enum" NOT NULL DEFAULT 'pending',
    "priority" SMALLINT NOT NULL DEFAULT 5,
    "auto_flag_reason" VARCHAR(100),
    "moderator_notes" TEXT,
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "moderation_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID,
    "actor_role" VARCHAR(30),
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_config" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "grievance_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "complainant_name" VARCHAR(100) NOT NULL,
    "complainant_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "grievance_status_enum" NOT NULL DEFAULT 'received',
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "officer_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "grievance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "package_id" UUID,
    "razorpay_order_id" VARCHAR(64) NOT NULL,
    "razorpay_payment_id" VARCHAR(64),
    "razorpay_signature" VARCHAR(128),
    "amount_inr" DECIMAL(12,2) NOT NULL,
    "gst_inr" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_inr" DECIMAL(12,2) NOT NULL,
    "coin_units_credited" BIGINT NOT NULL DEFAULT 0,
    "status" "payment_status_enum" NOT NULL DEFAULT 'created',
    "payment_method" VARCHAR(30),
    "invoice_number" VARCHAR(30),
    "invoice_url" TEXT,
    "failure_reason" TEXT,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "metadata" JSONB,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_webhook_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "razorpay_event_id" VARCHAR(64) NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "payment_id" UUID,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processed_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "platform" "device_platform_enum" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- CreateIndex
CREATE INDEX "users_status_deleted_at_idx" ON "users"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "users_abuse_score_idx" ON "users"("abuse_score" DESC);

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at" DESC);

-- CreateIndex
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");

-- CreateIndex
CREATE INDEX "user_roles_role_idx" ON "user_roles"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE INDEX "legal_documents_document_type_is_active_idx" ON "legal_documents"("document_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "legal_documents_document_type_version_key" ON "legal_documents"("document_type", "version");

-- CreateIndex
CREATE INDEX "user_consents_user_id_document_type_idx" ON "user_consents"("user_id", "document_type");

-- CreateIndex
CREATE INDEX "user_consents_consented_at_idx" ON "user_consents"("consented_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_type_created_at_idx" ON "wallet_transactions"("user_id", "type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_type_reference_id_idx" ON "wallet_transactions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "coin_packages_is_active_sort_order_idx" ON "coin_packages"("is_active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_id_key" ON "referrals"("referred_id");

-- CreateIndex
CREATE INDEX "referrals_referrer_id_status_idx" ON "referrals"("referrer_id", "status");

-- CreateIndex
CREATE INDEX "referrals_status_hold_until_idx" ON "referrals"("status", "hold_until");

-- CreateIndex
CREATE INDEX "referrals_created_at_idx" ON "referrals"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "host_applications_user_id_key" ON "host_applications"("user_id");

-- CreateIndex
CREATE INDEX "host_applications_status_created_at_idx" ON "host_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "host_kyc_user_id_verification_status_idx" ON "host_kyc"("user_id", "verification_status");

-- CreateIndex
CREATE INDEX "host_kyc_provider_reference_idx" ON "host_kyc"("provider_reference");

-- CreateIndex
CREATE INDEX "host_profiles_is_available_idx" ON "host_profiles"("is_available");

-- CreateIndex
CREATE INDEX "host_earnings_host_id_status_available_at_idx" ON "host_earnings"("host_id", "status", "available_at");

-- CreateIndex
CREATE INDEX "host_earnings_call_id_idx" ON "host_earnings"("call_id");

-- CreateIndex
CREATE INDEX "host_bank_accounts_host_id_is_primary_idx" ON "host_bank_accounts"("host_id", "is_primary");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_idempotency_key_key" ON "withdrawals"("idempotency_key");

-- CreateIndex
CREATE INDEX "withdrawals_host_id_status_created_at_idx" ON "withdrawals"("host_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "withdrawals_status_created_at_idx" ON "withdrawals"("status", "created_at");

-- CreateIndex
CREATE INDEX "calls_caller_id_created_at_idx" ON "calls"("caller_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "calls_callee_id_created_at_idx" ON "calls"("callee_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "calls_status_idx" ON "calls"("status");

-- CreateIndex
CREATE INDEX "calls_zego_room_id_idx" ON "calls"("zego_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_billing_ticks_idempotency_key_key" ON "call_billing_ticks"("idempotency_key");

-- CreateIndex
CREATE INDEX "call_billing_ticks_call_id_idx" ON "call_billing_ticks"("call_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_billing_ticks_call_id_tick_number_key" ON "call_billing_ticks"("call_id", "tick_number");

-- CreateIndex
CREATE UNIQUE INDEX "call_consents_call_id_user_id_key" ON "call_consents"("call_id", "user_id");

-- CreateIndex
CREATE INDEX "swipes_swiper_id_created_at_idx" ON "swipes"("swiper_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "swipes_target_id_action_idx" ON "swipes"("target_id", "action");

-- CreateIndex
CREATE UNIQUE INDEX "swipes_swiper_id_target_id_key" ON "swipes"("swiper_id", "target_id");

-- CreateIndex
CREATE INDEX "matches_user_a_id_is_active_idx" ON "matches"("user_a_id", "is_active");

-- CreateIndex
CREATE INDEX "matches_user_b_id_is_active_idx" ON "matches"("user_b_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "matches_user_a_id_user_b_id_key" ON "matches"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "conversations_participant_a_id_last_message_at_idx" ON "conversations"("participant_a_id", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "conversations_participant_b_id_last_message_at_idx" ON "conversations"("participant_b_id", "last_message_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_participant_a_id_participant_b_id_key" ON "conversations"("participant_a_id", "participant_b_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_moderation_status_created_at_idx" ON "messages"("moderation_status", "created_at");

-- CreateIndex
CREATE INDEX "blocks_blocked_id_idx" ON "blocks"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "blocks_blocker_id_blocked_id_key" ON "blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "reports_status_severity_created_at_idx" ON "reports"("status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "reports_reported_id_created_at_idx" ON "reports"("reported_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_assigned_to_id_status_idx" ON "reports"("assigned_to_id", "status");

-- CreateIndex
CREATE INDEX "abuse_signals_user_id_created_at_idx" ON "abuse_signals"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "abuse_signals_signal_type_created_at_idx" ON "abuse_signals"("signal_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "account_suspensions_user_id_ends_at_idx" ON "account_suspensions"("user_id", "ends_at");

-- CreateIndex
CREATE INDEX "account_suspensions_appeal_status_idx" ON "account_suspensions"("appeal_status");

-- CreateIndex
CREATE INDEX "moderation_queue_status_priority_created_at_idx" ON "moderation_queue"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "moderation_queue_target_type_target_id_idx" ON "moderation_queue"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "moderation_queue_user_id_idx" ON "moderation_queue"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "grievance_tickets_status_created_at_idx" ON "grievance_tickets"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpay_order_id_key" ON "payments"("razorpay_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE INDEX "payments_razorpay_payment_id_idx" ON "payments"("razorpay_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_webhook_events_razorpay_event_id_key" ON "payment_webhook_events"("razorpay_event_id");

-- CreateIndex
CREATE INDEX "payment_webhook_events_processed_created_at_idx" ON "payment_webhook_events"("processed", "created_at");

-- CreateIndex
CREATE INDEX "payment_webhook_events_event_type_created_at_idx" ON "payment_webhook_events"("event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "device_tokens_user_id_is_active_idx" ON "device_tokens"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_user_id_token_hash_key" ON "device_tokens"("user_id", "token_hash");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_legal_document_id_fkey" FOREIGN KEY ("legal_document_id") REFERENCES "legal_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_id_fkey" FOREIGN KEY ("referred_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_applications" ADD CONSTRAINT "host_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_applications" ADD CONSTRAINT "host_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_kyc" ADD CONSTRAINT "host_kyc_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_profiles" ADD CONSTRAINT "host_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_earnings" ADD CONSTRAINT "host_earnings_billing_tick_id_fkey" FOREIGN KEY ("billing_tick_id") REFERENCES "call_billing_ticks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "host_bank_accounts" ADD CONSTRAINT "host_bank_accounts_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "host_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_caller_id_fkey" FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_callee_id_fkey" FOREIGN KEY ("callee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_billing_ticks" ADD CONSTRAINT "call_billing_ticks_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_consents" ADD CONSTRAINT "call_consents_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_consents" ADD CONSTRAINT "call_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_swiper_id_fkey" FOREIGN KEY ("swiper_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipes" ADD CONSTRAINT "swipes_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_a_id_fkey" FOREIGN KEY ("participant_a_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant_b_id_fkey" FOREIGN KEY ("participant_b_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_id_fkey" FOREIGN KEY ("reported_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_signals" ADD CONSTRAINT "abuse_signals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_suspended_by_id_fkey" FOREIGN KEY ("suspended_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_lifted_by_id_fkey" FOREIGN KEY ("lifted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_queue" ADD CONSTRAINT "moderation_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "moderation_queue" ADD CONSTRAINT "moderation_queue_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grievance_tickets" ADD CONSTRAINT "grievance_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "coin_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

