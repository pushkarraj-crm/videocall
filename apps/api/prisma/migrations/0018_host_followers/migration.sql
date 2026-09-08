-- Host favorites / follow system

CREATE TABLE IF NOT EXISTS "host_followers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "host_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "host_followers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "host_followers_host_id_user_id_key" UNIQUE ("host_id", "user_id"),
  CONSTRAINT "host_followers_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "host_followers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "host_followers_host_id_deleted_at_created_at_idx"
  ON "host_followers"("host_id", "deleted_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "host_followers_user_id_deleted_at_created_at_idx"
  ON "host_followers"("user_id", "deleted_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "host_followers_created_at_idx"
  ON "host_followers"("created_at" DESC);