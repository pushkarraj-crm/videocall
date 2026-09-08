-- Host live availability: heartbeat tracking + 20s accept timeout default

CREATE TABLE "host_heartbeats" (
    "user_id" UUID NOT NULL,
    "last_beat_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "host_heartbeats_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "host_heartbeats_last_beat_at_idx" ON "host_heartbeats"("last_beat_at");

ALTER TABLE "host_heartbeats" ADD CONSTRAINT "host_heartbeats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill heartbeat for currently online real hosts so routing stays stable
INSERT INTO "host_heartbeats" ("user_id", "last_beat_at", "updated_at")
SELECT hp."user_id", NOW(), NOW()
FROM "host_profiles" hp
WHERE hp."is_online" = true
  AND hp."profile_type" = 'REAL_HOST'
ON CONFLICT ("user_id") DO UPDATE
SET "last_beat_at" = EXCLUDED."last_beat_at", "updated_at" = EXCLUDED."updated_at";

-- Default accept timeout: 20 seconds
ALTER TABLE "call_routing_settings" ALTER COLUMN "real_host_timeout_seconds" SET DEFAULT 20;

UPDATE "call_routing_settings"
SET "real_host_timeout_seconds" = 20
WHERE "id" = 'default' AND "real_host_timeout_seconds" < 20;