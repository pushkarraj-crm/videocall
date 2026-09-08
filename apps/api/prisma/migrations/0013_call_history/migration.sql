-- Call History records (read-only audit of completed calls)
CREATE TYPE "call_history_type_enum" AS ENUM ('audio', 'video');
CREATE TYPE "call_history_status_enum" AS ENUM (
  'ringing',
  'connected',
  'completed',
  'missed',
  'rejected',
  'cancelled',
  'failed'
);
CREATE TYPE "call_history_ended_by_enum" AS ENUM ('caller', 'host', 'system');

CREATE TABLE "call_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "call_id" UUID NOT NULL,
    "caller_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "type" "call_history_type_enum" NOT NULL DEFAULT 'video',
    "status" "call_history_status_enum" NOT NULL DEFAULT 'ringing',
    "started_at" TIMESTAMPTZ(6),
    "answered_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "coins_spent_units" BIGINT NOT NULL DEFAULT 0,
    "host_earning_units" BIGINT NOT NULL DEFAULT 0,
    "platform_commission_units" BIGINT NOT NULL DEFAULT 0,
    "ended_by" "call_history_ended_by_enum",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "call_history_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "call_history_call_id_key" ON "call_history"("call_id");
CREATE INDEX "call_history_caller_id_created_at_idx" ON "call_history"("caller_id", "created_at" DESC);
CREATE INDEX "call_history_host_id_created_at_idx" ON "call_history"("host_id", "created_at" DESC);
CREATE INDEX "call_history_status_created_at_idx" ON "call_history"("status", "created_at" DESC);

ALTER TABLE "call_history" ADD CONSTRAINT "call_history_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "call_history" ADD CONSTRAINT "call_history_caller_id_fkey"
  FOREIGN KEY ("caller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_history" ADD CONSTRAINT "call_history_host_id_fkey"
  FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;