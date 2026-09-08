-- AI Conversation Engine extensions

ALTER TABLE "host_profiles" ADD COLUMN "virtual_host_conversation" JSONB;

ALTER TABLE "virtual_host_memory" ADD COLUMN "conversation_history" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "virtual_host_memory" ADD COLUMN "last_call_summary" TEXT;

ALTER TABLE "virtual_host_sessions" ADD COLUMN "turn_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "virtual_host_sessions" ADD COLUMN "avg_response_ms" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "virtual_host_conversation_turns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" VARCHAR(64) NOT NULL,
    "call_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "event_type" VARCHAR(32) NOT NULL DEFAULT 'message',
    "content" TEXT NOT NULL,
    "emotion" VARCHAR(32),
    "response_ms" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "virtual_host_conversation_turns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "virtual_host_conversation_turns_call_id_created_at_idx"
  ON "virtual_host_conversation_turns"("call_id", "created_at");
CREATE INDEX "virtual_host_conversation_turns_session_id_created_at_idx"
  ON "virtual_host_conversation_turns"("session_id", "created_at");
CREATE INDEX "virtual_host_conversation_turns_host_id_created_at_idx"
  ON "virtual_host_conversation_turns"("host_id", "created_at");

ALTER TABLE "virtual_host_conversation_turns" ADD CONSTRAINT "virtual_host_conversation_turns_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "virtual_host_conversation_turns" ADD CONSTRAINT "virtual_host_conversation_turns_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;