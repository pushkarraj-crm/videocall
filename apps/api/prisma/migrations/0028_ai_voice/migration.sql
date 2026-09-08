-- AI Voice Streaming Engine: session audit log

CREATE TABLE "virtual_host_voice_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stream_id" VARCHAR(64) NOT NULL,
    "call_id" UUID NOT NULL,
    "session_id" VARCHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "voice_provider" VARCHAR(32) NOT NULL,
    "voice_id" VARCHAR(64) NOT NULL,
    "language" VARCHAR(16) NOT NULL,
    "event_type" VARCHAR(32) NOT NULL DEFAULT 'message',
    "text_length" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "first_chunk_ms" INTEGER,
    "speech_duration_ms" INTEGER NOT NULL DEFAULT 0,
    "interrupted" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "virtual_host_voice_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "virtual_host_voice_sessions_stream_id_key" ON "virtual_host_voice_sessions"("stream_id");
CREATE INDEX "virtual_host_voice_sessions_call_id_created_at_idx"
  ON "virtual_host_voice_sessions"("call_id", "created_at" DESC);
CREATE INDEX "virtual_host_voice_sessions_host_id_created_at_idx"
  ON "virtual_host_voice_sessions"("host_id", "created_at" DESC);

ALTER TABLE "virtual_host_voice_sessions" ADD CONSTRAINT "virtual_host_voice_sessions_call_id_fkey"
  FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "virtual_host_voice_sessions" ADD CONSTRAINT "virtual_host_voice_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "virtual_host_voice_sessions" ADD CONSTRAINT "virtual_host_voice_sessions_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "virtual_host_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;