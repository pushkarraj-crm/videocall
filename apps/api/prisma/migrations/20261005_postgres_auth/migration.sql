-- Additive migration: existing identities, wallets, roles and user IDs are preserved.
CREATE TABLE "auth_credentials" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "email_verified_at" TIMESTAMPTZ(6),
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL
);
CREATE TABLE "auth_recovery_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email" VARCHAR(255) NOT NULL,
  "purpose" VARCHAR(20) NOT NULL,
  "intent" VARCHAR(10),
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "auth_recovery_tokens_user_id_purpose_idx" ON "auth_recovery_tokens"("user_id", "purpose");
CREATE INDEX "auth_recovery_tokens_expires_at_idx" ON "auth_recovery_tokens"("expires_at");
CREATE TABLE "auth_google_identities" (
  "subject" VARCHAR(255) PRIMARY KEY,
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE TABLE "auth_phone_identities" (
  "phone" VARCHAR(16) PRIMARY KEY,
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE TABLE "auth_otp_challenges" (
  "id" UUID PRIMARY KEY,
  "phone" VARCHAR(16) NOT NULL,
  "code_hash" VARCHAR(64) NOT NULL,
  "intent" VARCHAR(10) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "auth_otp_challenges_phone_created_at_idx" ON "auth_otp_challenges"("phone", "created_at");
CREATE INDEX "auth_otp_challenges_expires_at_idx" ON "auth_otp_challenges"("expires_at");
ALTER TABLE "users" ALTER COLUMN "phone" TYPE VARCHAR(16);
