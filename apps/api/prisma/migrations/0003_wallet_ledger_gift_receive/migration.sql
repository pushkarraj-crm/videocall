-- Add gift_receive to wallet transaction types
ALTER TYPE "wallet_tx_type_enum" ADD VALUE IF NOT EXISTS 'gift_receive';