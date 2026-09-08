-- Gift sending: wallet deduction, gift records, host earnings support

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'wallet_tx_type_enum' AND e.enumlabel = 'gift_send'
  ) THEN
    ALTER TYPE wallet_tx_type_enum ADD VALUE 'gift_send';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS call_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  gift_type VARCHAR(32) NOT NULL,
  coin_units BIGINT NOT NULL,
  host_earning_units BIGINT NOT NULL,
  platform_fee_units BIGINT NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS call_gifts_idempotency_key_key ON call_gifts(idempotency_key);
CREATE INDEX IF NOT EXISTS call_gifts_call_id_created_at_idx ON call_gifts(call_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_gifts_sender_id_created_at_idx ON call_gifts(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS call_gifts_recipient_id_created_at_idx ON call_gifts(recipient_id, created_at DESC);