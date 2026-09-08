-- Admin user management fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_note" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_revoked_at" TIMESTAMPTZ(6);

ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "admin_calls_disabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "host_profiles" ADD COLUMN IF NOT EXISTS "admin_withdrawals_disabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "admin_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_user_id" UUID,
    "details" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_logs_admin_id_created_at_idx"
  ON "admin_logs"("admin_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "admin_logs_target_user_id_created_at_idx"
  ON "admin_logs"("target_user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "admin_logs_action_created_at_idx"
  ON "admin_logs"("action", "created_at" DESC);

ALTER TABLE "admin_logs"
  ADD CONSTRAINT "admin_logs_admin_id_fkey"
  FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_logs"
  ADD CONSTRAINT "admin_logs_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;