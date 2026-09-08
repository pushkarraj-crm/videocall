-- Legal policies with versioning for production compliance

CREATE TABLE "legal_policies" (
    "slug" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "published_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_policies_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "legal_policy_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" VARCHAR(20) NOT NULL,
    "published_at" TIMESTAMPTZ(6) NOT NULL,
    "published_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legal_policy_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_policy_revisions_slug_published_at_idx" ON "legal_policy_revisions"("slug", "published_at" DESC);

ALTER TABLE "legal_policies" ADD CONSTRAINT "legal_policies_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "legal_policy_revisions" ADD CONSTRAINT "legal_policy_revisions_slug_fkey" FOREIGN KEY ("slug") REFERENCES "legal_policies"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "legal_policy_revisions" ADD CONSTRAINT "legal_policy_revisions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;