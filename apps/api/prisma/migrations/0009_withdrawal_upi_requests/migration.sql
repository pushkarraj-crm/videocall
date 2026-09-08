-- UPI-based withdrawal requests: extend withdrawals table (withdrawal_requests)
ALTER TABLE "withdrawals" ALTER COLUMN "bank_account_id" DROP NOT NULL;

ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "upi_id" VARCHAR(128);
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "account_holder_name" VARCHAR(128);
ALTER TABLE "withdrawals" ADD COLUMN IF NOT EXISTS "admin_note" TEXT;