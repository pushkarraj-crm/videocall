-- Virtual Host Engine: profile types, sessions, memory

CREATE TYPE "host_profile_type_enum" AS ENUM ('REAL_HOST', 'MANAGED_HOST', 'AI_HOST');
CREATE TYPE "virtual_host_status_enum" AS ENUM ('ONLINE', 'OFFLINE', 'BUSY');

ALTER TABLE "host_profiles" ADD COLUMN "profile_type" "host_profile_type_enum" NOT NULL DEFAULT 'REAL_HOST';
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_voice" JSONB;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_avatar" JSONB;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_personality" JSONB;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_language" VARCHAR(16);
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_region" VARCHAR(64);
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_greeting" VARCHAR(500);
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_status" "virtual_host_status_enum";
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_gift_reactions" JSONB;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_schedule" JSONB;
ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_popularity" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "host_profiles_profile_type_virtual_host_enabled_idx"
  ON "host_profiles"("profile_type", "virtual_host_enabled");
CREATE INDEX "host_profiles_virtual_host_priority_idx"
  ON "host_profiles"("virtual_host_priority");

CREATE TABLE "virtual_host_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" VARCHAR(64) NOT NULL,
    "call_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "profile_type" "host_profile_type_enum" NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "coins_spent_units" BIGINT NOT NULL DEFAULT 0,
    "gifts_received_count" INTEGER NOT NULL DEFAULT 0,
    "rating" INTEGER,
    "conversation_summary" TEXT,
    "personality_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_host_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "virtual_host_sessions_session_id_key" ON "virtual_host_sessions"("session_id");
CREATE UNIQUE INDEX "virtual_host_sessions_call_id_key" ON "virtual_host_sessions"("call_id");
CREATE INDEX "virtual_host_sessions_user_id_started_at_idx"
  ON "virtual_host_sessions"("user_id", "started_at" DESC);
CREATE INDEX "virtual_host_sessions_host_id_started_at_idx"
  ON "virtual_host_sessions"("host_id", "started_at" DESC);
CREATE INDEX "virtual_host_sessions_profile_type_started_at_idx"
  ON "virtual_host_sessions"("profile_type", "started_at" DESC);

ALTER TABLE "virtual_host_sessions" ADD CONSTRAINT "virtual_host_sessions_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "virtual_host_sessions" ADD CONSTRAINT "virtual_host_sessions_host_id_fkey"
  FOREIGN KEY ("host_id") REFERENCES "host_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "virtual_host_sessions" ADD CONSTRAINT "virtual_host_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "virtual_host_memory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "host_id" UUID,
    "nickname" VARCHAR(64),
    "preferred_language" VARCHAR(16),
    "favorite_topics" JSONB NOT NULL DEFAULT '[]',
    "gift_history_summary" JSONB,
    "last_conversation_at" TIMESTAMPTZ(6),
    "friendship_score" INTEGER NOT NULL DEFAULT 0,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "favorite_virtual_host_ids" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_host_memory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "virtual_host_memory_user_id_host_id_key" ON "virtual_host_memory"("user_id", "host_id");
CREATE INDEX "virtual_host_memory_user_id_idx" ON "virtual_host_memory"("user_id");

ALTER TABLE "virtual_host_memory" ADD CONSTRAINT "virtual_host_memory_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;