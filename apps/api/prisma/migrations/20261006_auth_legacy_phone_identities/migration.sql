-- Preserve unique phone-only identities from the previous authentication system.
-- Profile phone numbers on email accounts are not proof of phone ownership.
INSERT INTO "auth_phone_identities" ("phone", "user_id")
SELECT "phone", "id" FROM "users"
WHERE "phone" ~ '^\+[1-9][0-9]{7,14}$' AND "email" IS NULL AND "deleted_at" IS NULL
  AND "phone" IN (SELECT "phone" FROM "users" WHERE "deleted_at" IS NULL GROUP BY "phone" HAVING COUNT(*) = 1)
ON CONFLICT DO NOTHING;
