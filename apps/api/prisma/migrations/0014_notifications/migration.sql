-- In-app push notifications
CREATE TYPE "notification_type_enum" AS ENUM (
  'incoming_call',
  'missed_call',
  'call_rejected',
  'call_cancelled',
  'recharge_success',
  'withdrawal_requested',
  'withdrawal_approved',
  'withdrawal_rejected',
  'kyc_submitted',
  'kyc_approved',
  'kyc_rejected',
  'admin_announcement'
);

CREATE TYPE "notification_priority_enum" AS ENUM ('normal', 'important', 'urgent');

CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "notification_type_enum" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "message" TEXT NOT NULL,
    "reference_id" UUID,
    "priority" "notification_priority_enum" NOT NULL DEFAULT 'normal',
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_is_read_created_at_idx"
  ON "notifications"("user_id", "is_read", "created_at" DESC);

CREATE INDEX "notifications_user_id_created_at_idx"
  ON "notifications"("user_id", "created_at" DESC);

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;