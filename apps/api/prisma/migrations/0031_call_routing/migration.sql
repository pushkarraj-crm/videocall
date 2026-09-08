-- Call routing: real-host-first with AI fallback

CREATE TYPE "call_host_type_enum" AS ENUM ('REAL_HOST', 'AI_HOST');

ALTER TABLE "calls" ADD COLUMN "host_call_type" "call_host_type_enum";
ALTER TABLE "call_history" ADD COLUMN "host_call_type" "call_host_type_enum";
ALTER TABLE "virtual_host_sessions" ADD COLUMN "locked_video_url" VARCHAR(512);

CREATE TABLE "call_routing_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "ai_fallback_enabled" BOOLEAN NOT NULL DEFAULT true,
    "real_host_timeout_seconds" INTEGER NOT NULL DEFAULT 15,
    "preferred_region" VARCHAR(64),
    "preferred_language" VARCHAR(16),
    "random_ai_selection" BOOLEAN NOT NULL DEFAULT true,
    "default_ai_host_id" UUID,
    "max_concurrent_ai_sessions" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_routing_settings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calls_host_call_type_idx" ON "calls"("host_call_type");