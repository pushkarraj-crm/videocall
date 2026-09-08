-- AI Conversation Quality Engine: long-term memory + conversation history

CREATE TABLE "ai_host_memory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nickname" VARCHAR(64),
    "favorite_color" VARCHAR(64),
    "favorite_food" VARCHAR(128),
    "favorite_movie" VARCHAR(128),
    "favorite_music" VARCHAR(128),
    "favorite_outfit" VARCHAR(128),
    "birthday" VARCHAR(64),
    "relationship_score" INTEGER NOT NULL DEFAULT 0,
    "last_call" TIMESTAMPTZ(6),
    "last_gift" TIMESTAMPTZ(6),
    "last_recharge" TIMESTAMPTZ(6),
    "notes" TEXT,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "preferred_language" VARCHAR(16),
    "city" VARCHAR(64),
    "country" VARCHAR(64),
    "hobbies" JSONB NOT NULL DEFAULT '[]',
    "work" VARCHAR(128),
    "favorite_topics" JSONB NOT NULL DEFAULT '[]',
    "memory_summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_host_memory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_host_memory_host_id_user_id_key" ON "ai_host_memory"("host_id", "user_id");
CREATE INDEX "ai_host_memory_user_id_idx" ON "ai_host_memory"("user_id");
CREATE INDEX "ai_host_memory_host_id_relationship_score_idx" ON "ai_host_memory"("host_id", "relationship_score" DESC);

ALTER TABLE "ai_host_memory" ADD CONSTRAINT "ai_host_memory_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_host_memory" ADD CONSTRAINT "ai_host_memory_host_id_fkey"
  FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "conversation_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "host_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "call_id" UUID,
    "user_message" TEXT NOT NULL,
    "ai_reply" TEXT NOT NULL,
    "emotion" VARCHAR(32),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversation_history_host_id_user_id_timestamp_idx"
  ON "conversation_history"("host_id", "user_id", "timestamp" DESC);
CREATE INDEX "conversation_history_call_id_idx" ON "conversation_history"("call_id");

ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_host_id_fkey"
  FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation_history" ADD CONSTRAINT "conversation_history_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;