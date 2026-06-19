-- Migration: Extensions, partial unique indexes, and check constraints
-- Apply AFTER `prisma migrate dev` generates base tables, or run manually.

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- PARTIAL UNIQUE INDEXES (soft-delete aware)
-- Prisma cannot express these natively; required for production uniqueness.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_active_idx
  ON users (phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_idx
  ON users (email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;

-- Active host discovery
CREATE INDEX IF NOT EXISTS host_profiles_available_idx
  ON host_profiles (is_available)
  WHERE is_available = true;

-- Active calls monitoring
CREATE INDEX IF NOT EXISTS calls_active_status_idx
  ON calls (status)
  WHERE status IN ('ringing', 'active');

-- Referral fraud hold queue
CREATE INDEX IF NOT EXISTS referrals_pending_hold_idx
  ON referrals (hold_until)
  WHERE status = 'pending';

-- Active suspensions
CREATE INDEX IF NOT EXISTS account_suspensions_active_idx
  ON account_suspensions (user_id, ends_at)
  WHERE lifted_at IS NULL;

-- =============================================================================
-- CHECK CONSTRAINTS
-- =============================================================================

ALTER TABLE users
  ADD CONSTRAINT users_age_18_check
  CHECK (date_of_birth <= (CURRENT_DATE - INTERVAL '18 years'));

ALTER TABLE users
  ADD CONSTRAINT users_abuse_score_check
  CHECK (abuse_score >= 0 AND abuse_score <= 100);

ALTER TABLE users
  ADD CONSTRAINT users_free_calls_check
  CHECK (free_calls_used >= 0 AND free_calls_used <= 5);

ALTER TABLE wallets
  ADD CONSTRAINT wallets_balance_non_negative
  CHECK (balance_units >= 0);

ALTER TABLE wallets
  ADD CONSTRAINT wallets_locked_non_negative
  CHECK (locked_units >= 0);

ALTER TABLE wallet_transactions
  ADD CONSTRAINT wallet_tx_amount_non_zero
  CHECK (amount_units <> 0);

ALTER TABLE host_profiles
  ADD CONSTRAINT host_profiles_earnings_non_negative
  CHECK (total_earnings_units >= 0 AND withdrawable_units >= 0);

ALTER TABLE host_profiles
  ADD CONSTRAINT host_profiles_rating_count_non_negative
  CHECK (rating_count >= 0);

ALTER TABLE host_earnings
  ADD CONSTRAINT host_earnings_split_check
  CHECK (gross_units = platform_fee_units + net_units AND net_units >= 0);

ALTER TABLE calls
  ADD CONSTRAINT calls_different_participants
  CHECK (caller_id <> callee_id);

ALTER TABLE calls
  ADD CONSTRAINT calls_duration_non_negative
  CHECK (duration_seconds >= 0);

ALTER TABLE calls
  ADD CONSTRAINT calls_coins_non_negative
  CHECK (coins_charged_units >= 0);

ALTER TABLE swipes
  ADD CONSTRAINT swipes_different_users
  CHECK (swiper_id <> target_id);

ALTER TABLE blocks
  ADD CONSTRAINT blocks_different_users
  CHECK (blocker_id <> blocked_id);

ALTER TABLE matches
  ADD CONSTRAINT matches_canonical_order
  CHECK (user_a_id < user_b_id);

ALTER TABLE conversations
  ADD CONSTRAINT conversations_canonical_order
  CHECK (participant_a_id < participant_b_id);

ALTER TABLE referrals
  ADD CONSTRAINT referrals_no_self_referral
  CHECK (referrer_id <> referred_id);

ALTER TABLE withdrawals
  ADD CONSTRAINT withdrawals_amount_positive
  CHECK (amount_units > 0 AND amount_inr > 0 AND net_inr > 0);

ALTER TABLE payments
  ADD CONSTRAINT payments_amount_positive
  CHECK (amount_inr > 0 AND total_inr > 0);

ALTER TABLE coin_packages
  ADD CONSTRAINT coin_packages_positive
  CHECK (price_inr > 0 AND coin_units > 0);