-- Host KYC document submission fields
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "dob" DATE;
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "upi_id_enc" VARCHAR(128);
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "aadhaar_hash" VARCHAR(64);
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "admin_note" TEXT;
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "selfie_storage_key" VARCHAR(256);
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "aadhaar_front_storage_key" VARCHAR(256);
ALTER TABLE "host_kyc" ADD COLUMN IF NOT EXISTS "aadhaar_back_storage_key" VARCHAR(256);

ALTER TABLE "host_kyc" ALTER COLUMN "provider" SET DEFAULT 'manual';