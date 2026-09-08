-- Prevent duplicate Razorpay payment fulfillment
CREATE UNIQUE INDEX IF NOT EXISTS "payments_razorpay_payment_id_unique"
  ON "payments"("razorpay_payment_id")
  WHERE "razorpay_payment_id" IS NOT NULL;