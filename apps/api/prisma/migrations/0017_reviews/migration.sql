-- Host rating & review system

CREATE TABLE IF NOT EXISTS "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "call_id" UUID NOT NULL,
  "host_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "rating" SMALLINT NOT NULL,
  "review_text" TEXT,
  "is_hidden" BOOLEAN NOT NULL DEFAULT false,
  "is_reported" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_call_id_key" UNIQUE ("call_id"),
  CONSTRAINT "reviews_call_id_fkey" FOREIGN KEY ("call_id") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reviews_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE INDEX IF NOT EXISTS "reviews_host_id_created_at_idx"
  ON "reviews"("host_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reviews_user_id_created_at_idx"
  ON "reviews"("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reviews_rating_created_at_idx"
  ON "reviews"("rating", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reviews_is_hidden_is_reported_idx"
  ON "reviews"("is_hidden", "is_reported");