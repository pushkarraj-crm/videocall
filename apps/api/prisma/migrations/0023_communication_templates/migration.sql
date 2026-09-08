-- Communication templates, split SMS settings, log enhancements (additive)

ALTER TYPE "communication_log_status_enum" ADD VALUE IF NOT EXISTS 'queued' BEFORE 'sent';

ALTER TABLE "communication_settings"
  ADD COLUMN IF NOT EXISTS "marketing_sms" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "transactional_sms" BOOLEAN NOT NULL DEFAULT true;

UPDATE "communication_settings"
SET "marketing_sms" = "sms", "transactional_sms" = "sms"
WHERE "marketing_sms" = true AND "transactional_sms" = true;

CREATE TABLE "communication_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" VARCHAR(50) NOT NULL,
  "channel" "communication_channel_enum" NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "subject" VARCHAR(300),
  "body" TEXT NOT NULL,
  "html_body" TEXT,
  "variables" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "communication_templates_type_channel_key"
  ON "communication_templates"("type", "channel");

CREATE INDEX "communication_templates_channel_is_active_idx"
  ON "communication_templates"("channel", "is_active");

ALTER TABLE "communication_logs"
  ADD COLUMN IF NOT EXISTS "template_id" UUID,
  ADD COLUMN IF NOT EXISTS "template" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "provider" VARCHAR(30);

ALTER TABLE "communication_logs"
  ADD CONSTRAINT "communication_logs_template_id_fkey"
  FOREIGN KEY ("template_id") REFERENCES "communication_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;