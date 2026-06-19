# PostgreSQL Database Design — Social Video Communication Platform

**Version:** 1.0.0  
**Phase:** 1 — Database Foundation  
**Database:** PostgreSQL 15+  
**ORM:** Prisma  
**Primary Key Strategy:** UUID v4 (`gen_random_uuid()`)

---

## Design Conventions

| Convention | Rule |
|------------|------|
| Primary keys | `UUID` via `gen_random_uuid()` |
| Timestamps | `TIMESTAMPTZ` — `created_at`, `updated_at` on all mutable tables |
| Soft delete | `deleted_at TIMESTAMPTZ NULL` on user-facing entities |
| Money (INR) | `DECIMAL(12,2)` — never `FLOAT` |
| Coins | `BIGINT coin_units` — 1 coin = 100 units (avoids rounding loss) |
| PII | Sensitive fields encrypted at application layer; store hashes/masked values |
| Idempotency | `idempotency_key VARCHAR(128) UNIQUE` on financial mutations |
| Naming | `snake_case` tables/columns; plural table names |

### Coin Unit Reference

| Display | `coin_units` |
|---------|--------------|
| 1 coin | 100 |
| 5 coins/min | 500 units/min |
| 50 coins (referral) | 5,000 |
| 100 coins (₹100 pack) | 10,000 |

---

## 1. ER Diagram (Text Format)

```
                                    ┌─────────────────┐
                                    │ legal_documents │
                                    └────────┬────────┘
                                             │
┌──────────────┐     ┌──────────────┐   ┌────▼─────────┐
│ coin_packages│     │device_tokens │   │user_consents │
└──────┬───────┘     └──────┬───────┘   └──────┬───────┘
       │                    │                  │
       │              ┌─────▼──────────────────▼─────┐
       │              │           users              │◄──┐ (referred_by)
       │              │  id, firebase_uid, phone...  │───┘
       │              └─────┬───────────┬────────────┘
       │                    │           │
       │         ┌──────────┼───────────┼──────────────────────┐
       │         │          │           │                      │
       │    ┌────▼────┐ ┌───▼────┐ ┌────▼─────┐         ┌──────▼──────┐
       │    │user_roles│ │ wallets│ │ referrals│         │host_applic. │
       │    └─────────┘ └───┬────┘ └──────────┘         └──────┬──────┘
       │                    │                                    │
       │              ┌─────▼──────────┐                  ┌─────▼─────┐
       │              │wallet_transact.│                  │ host_kyc  │
       │              └─────┬──────────┘                  └─────┬─────┘
       │                    │                                    │
┌──────▼───────┐     ┌──────▼──────┐                    ┌────────▼────────┐
│   payments   │     │   calls     │◄───────────────────│ host_profiles   │
└──────┬───────┘     └──┬────┬─────┘                    └────────┬────────┘
       │                │    │                                   │
┌──────▼──────────┐     │    │         ┌───────────────┐  ┌──────▼────────┐
│payment_webhooks │     │    └────────►│call_billing_  │  │ host_earnings │
└─────────────────┘     │              │    ticks      │  └───────┬───────┘
                        │              └───────────────┘          │
                   ┌────▼────┐                              ┌─────▼──────┐
                   │ reports │                              │withdrawals │
                   └────┬────┘                              └────────────┘
                        │
        ┌───────────────┼───────────────────────────────────────────────┐
        │               │                                               │
   ┌────▼────┐    ┌─────▼──────┐   ┌──────────┐   ┌─────────┐   ┌──────▼──────┐
   │ blocks  │    │conversations│   │  swipes  │   │ matches │   │audit_logs   │
   └─────────┘    └─────┬──────┘   └──────────┘   └─────────┘   └─────────────┘
                        │
                  ┌─────▼─────┐
                  │ messages  │
                  └───────────┘

   ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐
   │abuse_signals    │  │account_suspensions│  │moderation_queue     │
   └─────────────────┘  └──────────────────┘  └─────────────────────┘

   ┌─────────────────┐  ┌──────────────────┐
   │grievance_tickets│  │ platform_config  │
   └─────────────────┘  └──────────────────┘
```

### Relationship Cardinality Summary

| Parent | Child | Cardinality | On Delete |
|--------|-------|-------------|-----------|
| users | wallets | 1:1 | RESTRICT |
| users | user_roles | 1:N | CASCADE |
| users | referrals (as referrer) | 1:N | RESTRICT |
| users | referrals (as referred) | 1:1 | RESTRICT |
| users | host_applications | 1:1 | RESTRICT |
| users | host_kyc | 1:N | RESTRICT |
| users | host_profiles | 1:1 | RESTRICT |
| users | calls (caller/callee) | 1:N | RESTRICT |
| users | swipes | 1:N | CASCADE |
| wallets | wallet_transactions | 1:N | RESTRICT |
| users | payments | 1:N | RESTRICT |
| calls | call_billing_ticks | 1:N | CASCADE |
| calls | host_earnings | 1:N | RESTRICT |
| users | withdrawals | 1:N | RESTRICT |
| users | conversations | N:M (via participants) | RESTRICT |
| conversations | messages | 1:N | CASCADE |
| users | blocks | N:M (directed) | CASCADE |
| users | reports | 1:N | RESTRICT |
| users | audit_logs (actor) | 1:N | SET NULL |

---

## 2. Complete Table List

| # | Table | Domain | Soft Delete |
|---|-------|--------|-------------|
| 1 | `users` | Identity | Yes |
| 2 | `user_roles` | Identity | No |
| 3 | `user_consents` | Compliance | No |
| 4 | `legal_documents` | Compliance | No |
| 5 | `wallets` | Coin wallet | No |
| 6 | `wallet_transactions` | Coin wallet | No |
| 7 | `coin_packages` | Coin wallet | Yes |
| 8 | `referrals` | Referral | No |
| 9 | `host_applications` | Host/KYC | No |
| 10 | `host_kyc` | Host/KYC | No |
| 11 | `host_profiles` | Host/KYC | No |
| 12 | `host_earnings` | Host/KYC | No |
| 13 | `withdrawals` | Withdrawal | No |
| 14 | `host_bank_accounts` | Withdrawal | No |
| 15 | `calls` | Video call | No |
| 16 | `call_billing_ticks` | Video call | No |
| 17 | `call_consents` | Video call | No |
| 18 | `swipes` | Discovery | No |
| 19 | `matches` | Discovery | No |
| 20 | `conversations` | Messaging | Yes |
| 21 | `messages` | Messaging | Yes |
| 22 | `blocks` | Safety | No |
| 23 | `reports` | Reporting | No |
| 24 | `abuse_signals` | Moderation | No |
| 25 | `account_suspensions` | Moderation | No |
| 26 | `moderation_queue` | Admin moderation | No |
| 27 | `audit_logs` | Admin | No |
| 28 | `platform_config` | Admin | No |
| 29 | `grievance_tickets` | Compliance | No |
| 30 | `payments` | Payment | No |
| 31 | `payment_webhook_events` | Payment | No |
| 32 | `device_tokens` | Notifications | No |

**Total: 32 tables**

---

## 3. All Columns & 4. Data Types

### 3.1 `users`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | PK |
| firebase_uid | VARCHAR(128) | NO | — | Firebase Auth UID |
| phone | VARCHAR(15) | YES | — | E.164 format (+91...) |
| email | VARCHAR(255) | YES | — | From Google auth |
| display_name | VARCHAR(50) | NO | — | Public name |
| avatar_url | TEXT | YES | — | CDN URL |
| bio | VARCHAR(500) | YES | — | Profile bio |
| date_of_birth | DATE | NO | — | 18+ verification |
| gender | gender_enum | YES | — | Optional |
| primary_language | VARCHAR(10) | YES | 'en' | ISO 639-1 |
| referral_code | VARCHAR(20) | NO | — | Unique share code |
| referred_by_id | UUID | YES | — | FK → users |
| abuse_score | INTEGER | NO | 0 | 0–100 scale |
| status | user_status_enum | NO | 'active' | Account state |
| free_calls_used | SMALLINT | NO | 0 | Max 5 |
| device_fingerprint | VARCHAR(64) | YES | — | Fraud detection |
| last_seen_at | TIMESTAMPTZ | YES | — | Activity tracking |
| created_at | TIMESTAMPTZ | NO | now() | — |
| updated_at | TIMESTAMPTZ | NO | now() | — |
| deleted_at | TIMESTAMPTZ | YES | — | Soft delete |

### 3.2 `user_roles`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| role | role_enum | NO | — |
| granted_by_id | UUID | YES | — |
| granted_at | TIMESTAMPTZ | NO | now() |
| revoked_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.3 `user_consents`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| document_type | consent_document_enum | NO | — |
| document_version | VARCHAR(20) | NO | — |
| legal_document_id | UUID | YES | — |
| ip_address | INET | YES | — |
| user_agent | TEXT | YES | — |
| consented_at | TIMESTAMPTZ | NO | now() |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.4 `legal_documents`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| document_type | consent_document_enum | NO | — |
| version | VARCHAR(20) | NO | — |
| title | VARCHAR(200) | NO | — |
| content_url | TEXT | NO | — |
| is_active | BOOLEAN | NO | false |
| published_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.5 `wallets`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| balance_units | BIGINT | NO | 0 |
| locked_units | BIGINT | NO | 0 |
| lifetime_credited_units | BIGINT | NO | 0 |
| lifetime_debited_units | BIGINT | NO | 0 |
| version | INTEGER | NO | 0 |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.6 `wallet_transactions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| wallet_id | UUID | NO | — |
| user_id | UUID | NO | — |
| type | wallet_tx_type_enum | NO | — |
| amount_units | BIGINT | NO | — |
| balance_after_units | BIGINT | NO | — |
| reference_type | VARCHAR(50) | YES | — |
| reference_id | UUID | YES | — |
| idempotency_key | VARCHAR(128) | NO | — |
| description | VARCHAR(255) | YES | — |
| metadata | JSONB | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.7 `coin_packages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| name | VARCHAR(100) | NO | — |
| price_inr | DECIMAL(12,2) | NO | — |
| coin_units | BIGINT | NO | — |
| bonus_units | BIGINT | NO | 0 |
| is_active | BOOLEAN | NO | true |
| sort_order | SMALLINT | NO | 0 |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |
| deleted_at | TIMESTAMPTZ | YES | — |

### 3.8 `referrals`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| referrer_id | UUID | NO | — |
| referred_id | UUID | NO | — |
| referral_code | VARCHAR(20) | NO | — |
| status | referral_status_enum | NO | 'pending' |
| referrer_reward_units | BIGINT | NO | 5000 |
| referred_reward_units | BIGINT | NO | 5000 |
| qualification_event | VARCHAR(50) | YES | — |
| qualified_at | TIMESTAMPTZ | YES | — |
| rewarded_at | TIMESTAMPTZ | YES | — |
| fraud_score | SMALLINT | NO | 0 |
| fraud_flags | JSONB | YES | — |
| hold_until | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.9 `host_applications`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| status | host_app_status_enum | NO | 'pending' |
| application_note | TEXT | YES | — |
| rejection_reason | TEXT | YES | — |
| reviewed_by_id | UUID | YES | — |
| reviewed_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.10 `host_kyc`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| provider | VARCHAR(50) | NO | — |
| provider_reference | VARCHAR(128) | YES | — |
| pan_hash | VARCHAR(64) | YES | — |
| pan_masked | VARCHAR(10) | YES | — |
| aadhaar_masked | VARCHAR(12) | YES | — |
| full_name | VARCHAR(100) | YES | — |
| verification_status | kyc_status_enum | NO | 'pending' |
| failure_reason | TEXT | YES | — |
| document_storage_refs | JSONB | YES | — |
| verified_at | TIMESTAMPTZ | YES | — |
| expires_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.11 `host_profiles`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| user_id | UUID | NO | — |
| is_available | BOOLEAN | NO | false |
| host_bio | VARCHAR(500) | YES | — |
| languages | JSONB | NO | '[]' |
| total_earnings_units | BIGINT | NO | 0 |
| withdrawable_units | BIGINT | NO | 0 |
| total_calls | INTEGER | NO | 0 |
| total_call_seconds | BIGINT | NO | 0 |
| rating_sum | INTEGER | NO | 0 |
| rating_count | INTEGER | NO | 0 |
| approved_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.12 `host_earnings`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| host_id | UUID | NO | — |
| call_id | UUID | NO | — |
| billing_tick_id | UUID | YES | — |
| gross_units | BIGINT | NO | — |
| platform_fee_units | BIGINT | NO | — |
| net_units | BIGINT | NO | — |
| status | earning_status_enum | NO | 'held' |
| available_at | TIMESTAMPTZ | NO | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.13 `withdrawals`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| host_id | UUID | NO | — |
| bank_account_id | UUID | NO | — |
| amount_units | BIGINT | NO | — |
| amount_inr | DECIMAL(12,2) | NO | — |
| tds_inr | DECIMAL(12,2) | NO | 0 |
| net_inr | DECIMAL(12,2) | NO | — |
| status | withdrawal_status_enum | NO | 'requested' |
| razorpay_payout_id | VARCHAR(64) | YES | — |
| utr | VARCHAR(64) | YES | — |
| rejection_reason | TEXT | YES | — |
| approved_by_id | UUID | YES | — |
| approved_at | TIMESTAMPTZ | YES | — |
| processed_at | TIMESTAMPTZ | YES | — |
| idempotency_key | VARCHAR(128) | NO | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.14 `host_bank_accounts`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| host_id | UUID | NO | — |
| account_holder_name | VARCHAR(100) | NO | — |
| account_number_enc | TEXT | NO | — |
| account_number_masked | VARCHAR(20) | NO | — |
| ifsc_code | VARCHAR(11) | NO | — |
| bank_name | VARCHAR(100) | YES | — |
| upi_id_enc | TEXT | YES | — |
| is_primary | BOOLEAN | NO | false |
| is_verified | BOOLEAN | NO | false |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.15 `calls`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| caller_id | UUID | NO | — |
| callee_id | UUID | NO | — |
| zego_room_id | VARCHAR(64) | NO | — |
| status | call_status_enum | NO | 'initiated' |
| is_free_call | BOOLEAN | NO | false |
| started_at | TIMESTAMPTZ | YES | — |
| answered_at | TIMESTAMPTZ | YES | — |
| ended_at | TIMESTAMPTZ | YES | — |
| duration_seconds | INTEGER | NO | 0 |
| coins_charged_units | BIGINT | NO | 0 |
| end_reason | call_end_reason_enum | YES | — |
| caller_ip | INET | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.16 `call_billing_ticks`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| call_id | UUID | NO | — |
| tick_number | INTEGER | NO | — |
| coins_deducted_units | BIGINT | NO | — |
| caller_balance_after_units | BIGINT | NO | — |
| host_earning_units | BIGINT | NO | — |
| platform_fee_units | BIGINT | NO | — |
| idempotency_key | VARCHAR(128) | NO | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.17 `call_consents`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| call_id | UUID | NO | — |
| user_id | UUID | NO | — |
| document_version | VARCHAR(20) | NO | — |
| ip_address | INET | YES | — |
| consented_at | TIMESTAMPTZ | NO | now() |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.18 `swipes`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| swiper_id | UUID | NO | — |
| target_id | UUID | NO | — |
| action | swipe_action_enum | NO | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.19 `matches`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_a_id | UUID | NO | — |
| user_b_id | UUID | NO | — |
| source | VARCHAR(20) | NO | 'swipe' |
| is_active | BOOLEAN | NO | true |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.20 `conversations`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| participant_a_id | UUID | NO | — |
| participant_b_id | UUID | NO | — |
| last_message_at | TIMESTAMPTZ | YES | — |
| last_message_preview | VARCHAR(100) | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |
| deleted_at | TIMESTAMPTZ | YES | — |

### 3.21 `messages`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| conversation_id | UUID | NO | — |
| sender_id | UUID | NO | — |
| content | TEXT | NO | — |
| moderation_status | msg_moderation_enum | NO | 'approved' |
| flagged_reason | VARCHAR(100) | YES | — |
| read_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |
| deleted_at | TIMESTAMPTZ | YES | — |

### 3.22 `blocks`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| blocker_id | UUID | NO | — |
| blocked_id | UUID | NO | — |
| reason | VARCHAR(255) | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.23 `reports`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| reporter_id | UUID | NO | — |
| reported_id | UUID | NO | — |
| call_id | UUID | YES | — |
| message_id | UUID | YES | — |
| category | report_category_enum | NO | — |
| description | TEXT | YES | — |
| evidence_url | TEXT | YES | — |
| status | report_status_enum | NO | 'open' |
| severity | report_severity_enum | NO | 'medium' |
| assigned_to_id | UUID | YES | — |
| resolution | TEXT | YES | — |
| resolution_action | resolution_action_enum | YES | — |
| resolved_by_id | UUID | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |
| resolved_at | TIMESTAMPTZ | YES | — |

### 3.24 `abuse_signals`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| signal_type | VARCHAR(50) | NO | — |
| score_delta | INTEGER | NO | — |
| source_table | VARCHAR(50) | YES | — |
| source_id | UUID | YES | — |
| metadata | JSONB | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.25 `account_suspensions`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| reason | TEXT | NO | — |
| suspended_by_id | UUID | NO | — |
| report_id | UUID | YES | — |
| starts_at | TIMESTAMPTZ | NO | now() |
| ends_at | TIMESTAMPTZ | YES | — |
| is_permanent | BOOLEAN | NO | false |
| appeal_status | appeal_status_enum | NO | 'none' |
| appeal_notes | TEXT | YES | — |
| lifted_at | TIMESTAMPTZ | YES | — |
| lifted_by_id | UUID | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.26 `moderation_queue`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| target_type | moderation_target_enum | NO | — |
| target_id | UUID | NO | — |
| user_id | UUID | YES | — |
| status | moderation_status_enum | NO | 'pending' |
| priority | SMALLINT | NO | 5 |
| auto_flag_reason | VARCHAR(100) | YES | — |
| moderator_notes | TEXT | YES | — |
| reviewed_by_id | UUID | YES | — |
| reviewed_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.27 `audit_logs`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| actor_id | UUID | YES | — |
| actor_role | VARCHAR(30) | YES | — |
| action | VARCHAR(100) | NO | — |
| entity_type | VARCHAR(50) | NO | — |
| entity_id | UUID | YES | — |
| old_value | JSONB | YES | — |
| new_value | JSONB | YES | — |
| ip_address | INET | YES | — |
| user_agent | TEXT | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.28 `platform_config`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| key | VARCHAR(100) | NO | — |
| value | JSONB | NO | — |
| description | TEXT | YES | — |
| updated_by_id | UUID | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.29 `grievance_tickets`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | YES | — |
| complainant_name | VARCHAR(100) | NO | — |
| complainant_email | VARCHAR(255) | NO | — |
| subject | VARCHAR(200) | NO | — |
| description | TEXT | NO | — |
| status | grievance_status_enum | NO | 'received' |
| acknowledged_at | TIMESTAMPTZ | YES | — |
| resolved_at | TIMESTAMPTZ | YES | — |
| officer_notes | TEXT | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.30 `payments`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| package_id | UUID | YES | — |
| razorpay_order_id | VARCHAR(64) | NO | — |
| razorpay_payment_id | VARCHAR(64) | YES | — |
| razorpay_signature | VARCHAR(128) | YES | — |
| amount_inr | DECIMAL(12,2) | NO | — |
| gst_inr | DECIMAL(12,2) | NO | 0 |
| total_inr | DECIMAL(12,2) | NO | — |
| coin_units_credited | BIGINT | NO | 0 |
| status | payment_status_enum | NO | 'created' |
| payment_method | VARCHAR(30) | YES | — |
| invoice_number | VARCHAR(30) | YES | — |
| invoice_url | TEXT | YES | — |
| failure_reason | TEXT | YES | — |
| idempotency_key | VARCHAR(128) | NO | — |
| metadata | JSONB | YES | — |
| paid_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

### 3.31 `payment_webhook_events`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| razorpay_event_id | VARCHAR(64) | NO | — |
| event_type | VARCHAR(50) | NO | — |
| payment_id | UUID | YES | — |
| payload | JSONB | NO | — |
| processed | BOOLEAN | NO | false |
| processed_at | TIMESTAMPTZ | YES | — |
| error | TEXT | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |

### 3.32 `device_tokens`

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| id | UUID | NO | gen_random_uuid() |
| user_id | UUID | NO | — |
| token_hash | VARCHAR(64) | NO | — |
| platform | device_platform_enum | NO | — |
| is_active | BOOLEAN | NO | true |
| last_used_at | TIMESTAMPTZ | YES | — |
| created_at | TIMESTAMPTZ | NO | now() |
| updated_at | TIMESTAMPTZ | NO | now() |

---

## 5. Relationships (Foreign Keys)

```sql
-- Identity
user_roles.user_id              → users.id
user_roles.granted_by_id        → users.id
user_consents.user_id           → users.id
user_consents.legal_document_id → legal_documents.id
users.referred_by_id            → users.id

-- Wallet
wallets.user_id                 → users.id
wallet_transactions.wallet_id   → wallets.id
wallet_transactions.user_id     → users.id

-- Referral
referrals.referrer_id           → users.id
referrals.referred_id           → users.id

-- Host
host_applications.user_id       → users.id
host_applications.reviewed_by_id → users.id
host_kyc.user_id                → users.id
host_profiles.user_id           → users.id
host_earnings.host_id           → users.id
host_earnings.call_id           → calls.id
host_earnings.billing_tick_id   → call_billing_ticks.id
host_bank_accounts.host_id      → users.id
withdrawals.host_id             → users.id
withdrawals.bank_account_id     → host_bank_accounts.id
withdrawals.approved_by_id      → users.id

-- Calls
calls.caller_id                 → users.id
calls.callee_id                 → users.id
call_billing_ticks.call_id      → calls.id
call_consents.call_id           → calls.id
call_consents.user_id           → users.id

-- Discovery
swipes.swiper_id                → users.id
swipes.target_id                → users.id
matches.user_a_id               → users.id
matches.user_b_id               → users.id

-- Messaging
conversations.participant_a_id  → users.id
conversations.participant_b_id  → users.id
messages.conversation_id        → conversations.id
messages.sender_id              → users.id

-- Safety
blocks.blocker_id               → users.id
blocks.blocked_id               → users.id
reports.reporter_id             → users.id
reports.reported_id             → users.id
reports.call_id                 → calls.id
reports.message_id              → messages.id
reports.assigned_to_id          → users.id
reports.resolved_by_id          → users.id
abuse_signals.user_id           → users.id
account_suspensions.user_id     → users.id
account_suspensions.suspended_by_id → users.id
account_suspensions.report_id   → reports.id
account_suspensions.lifted_by_id → users.id
moderation_queue.user_id        → users.id
moderation_queue.reviewed_by_id → users.id

-- Admin
audit_logs.actor_id             → users.id
platform_config.updated_by_id   → users.id
grievance_tickets.user_id       → users.id

-- Payments
payments.user_id                → users.id
payments.package_id             → coin_packages.id
payment_webhook_events.payment_id → payments.id

-- Notifications
device_tokens.user_id           → users.id
```

---

## 6. Indexes

### Primary & Unique Indexes (automatic + explicit)

| Table | Index | Type |
|-------|-------|------|
| users | firebase_uid | UNIQUE |
| users | referral_code | UNIQUE |
| users | phone (WHERE deleted_at IS NULL) | UNIQUE PARTIAL |
| users | email (WHERE deleted_at IS NULL) | UNIQUE PARTIAL |
| wallets | user_id | UNIQUE |
| wallet_transactions | idempotency_key | UNIQUE |
| referrals | referred_id | UNIQUE |
| host_applications | user_id | UNIQUE |
| host_profiles | user_id | UNIQUE (PK) |
| swipes | (swiper_id, target_id) | UNIQUE |
| matches | (user_a_id, user_b_id) | UNIQUE |
| blocks | (blocker_id, blocked_id) | UNIQUE |
| call_billing_ticks | idempotency_key | UNIQUE |
| call_billing_ticks | (call_id, tick_number) | UNIQUE |
| call_consents | (call_id, user_id) | UNIQUE |
| payments | razorpay_order_id | UNIQUE |
| payments | idempotency_key | UNIQUE |
| payment_webhook_events | razorpay_event_id | UNIQUE |
| withdrawals | idempotency_key | UNIQUE |
| conversations | (participant_a_id, participant_b_id) | UNIQUE |
| legal_documents | (document_type, version) | UNIQUE |
| device_tokens | (user_id, token_hash) | UNIQUE |
| platform_config | key | UNIQUE (PK) |

### Performance Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| users | (status, deleted_at) | Active user queries |
| users | (abuse_score DESC) | Abuse monitoring |
| users | created_at DESC | Registration analytics |
| host_profiles | (is_available, deleted_at) WHERE is_available | Discovery |
| calls | (caller_id, created_at DESC) | Call history |
| calls | (callee_id, created_at DESC) | Host call history |
| calls | (status) WHERE status IN ('ringing','active') | Active calls |
| wallet_transactions | (wallet_id, created_at DESC) | Ledger |
| wallet_transactions | (user_id, type, created_at DESC) | User tx filter |
| payments | (user_id, created_at DESC) | Payment history |
| payments | (status, created_at) | Reconciliation |
| referrals | (referrer_id, status) | Referral stats |
| referrals | (hold_until) WHERE status = 'pending' | Fraud hold queue |
| host_earnings | (host_id, status, available_at) | Payout eligibility |
| withdrawals | (host_id, status, created_at DESC) | Withdrawal history |
| reports | (status, severity, created_at) | Moderation queue |
| reports | (reported_id, created_at DESC) | User report history |
| abuse_signals | (user_id, created_at DESC) | Score computation |
| account_suspensions | (user_id, ends_at) WHERE lifted_at IS NULL | Active suspensions |
| moderation_queue | (status, priority, created_at) | Review queue |
| audit_logs | (entity_type, entity_id, created_at DESC) | Entity audit trail |
| audit_logs | (actor_id, created_at DESC) | Admin actions |
| messages | (conversation_id, created_at DESC) | Chat pagination |
| grievance_tickets | (status, created_at) | IT Rules SLA |
| swipes | (swiper_id, created_at DESC) | Swipe history |
| matches | (user_a_id, is_active) | User matches |
| matches | (user_b_id, is_active) | User matches |

---

## 7. Constraints

### Check Constraints

```sql
-- users
CHECK (date_of_birth <= CURRENT_DATE - INTERVAL '18 years')
CHECK (abuse_score >= 0 AND abuse_score <= 100)
CHECK (free_calls_used >= 0 AND free_calls_used <= 5)

-- wallets
CHECK (balance_units >= 0)
CHECK (locked_units >= 0)
CHECK (lifetime_credited_units >= 0)
CHECK (lifetime_debited_units >= 0)

-- wallet_transactions
CHECK (amount_units != 0)

-- host_profiles
CHECK (total_earnings_units >= 0)
CHECK (withdrawable_units >= 0)
CHECK (rating_count >= 0)

-- calls
CHECK (caller_id != callee_id)
CHECK (duration_seconds >= 0)
CHECK (coins_charged_units >= 0)

-- swipes
CHECK (swiper_id != target_id)

-- blocks
CHECK (blocker_id != blocked_id)

-- matches
CHECK (user_a_id < user_b_id)  -- canonical ordering

-- conversations
CHECK (participant_a_id < participant_b_id)  -- canonical ordering

-- referrals
CHECK (referrer_id != referred_id)

-- host_earnings
CHECK (gross_units = platform_fee_units + net_units)
CHECK (net_units >= 0)

-- withdrawals
CHECK (amount_units > 0)
CHECK (amount_inr > 0)
CHECK (net_inr > 0)

-- payments
CHECK (amount_inr > 0)
CHECK (total_inr > 0)

-- coin_packages
CHECK (price_inr > 0)
CHECK (coin_units > 0)
```

### Business Rules (Application-Enforced)

| Rule | Enforcement |
|------|-------------|
| Wallet balance never negative | Optimistic lock (`version`) + transaction |
| Billing tick idempotency | Unique `idempotency_key` per tick |
| One active host application | Unique `user_id` on host_applications |
| Referral self-reference blocked | CHECK + app validation |
| Soft-deleted users excluded from discovery | `deleted_at IS NULL` filter |
| Suspended users cannot initiate calls | App + DB trigger optional |

---

## 8. Coin Wallet Schema

```
users (1) ────── (1) wallets
                    │
                    ├── balance_units      (available coins)
                    ├── locked_units       (in-flight call reservation)
                    ├── lifetime_credited  (audit)
                    ├── lifetime_debited   (audit)
                    └── version            (optimistic concurrency)

wallets (1) ──── (N) wallet_transactions
                         ├── type: RECHARGE | CALL_CHARGE | REFERRAL_BONUS
                         │        HOST_EARNING | WITHDRAWAL | REFUND
                         │        FREE_CALL_GRANT | ADMIN_ADJUSTMENT
                         ├── amount_units (+ credit, − debit)
                         ├── balance_after_units
                         ├── reference_type + reference_id
                         └── idempotency_key (UNIQUE)

coin_packages ──── payments (recharge catalog)
```

### Transaction Types

| Type | Direction | Trigger |
|------|-----------|---------|
| `RECHARGE` | Credit | Razorpay payment success |
| `CALL_CHARGE` | Debit | Billing tick (caller) |
| `REFERRAL_BONUS` | Credit | Referral qualified |
| `FREE_CALL_GRANT` | N/A | Tracked via calls.is_free_call |
| `HOST_EARNING` | Credit | Billing tick (internal ledger) |
| `WITHDRAWAL` | Debit | Payout processed |
| `REFUND` | Debit/Credit | Razorpay refund |
| `ADMIN_ADJUSTMENT` | Either | Admin action (audited) |

---

## 9. Referral Schema

```
users.referral_code ──► referrals.referral_code
users.referred_by_id  ──► users.id

referrals
  ├── referrer_id          FK users
  ├── referred_id          FK users (UNIQUE — one referrer per user)
  ├── status               pending → qualified → rewarded | rejected
  ├── referrer_reward_units  DEFAULT 5000 (50 coins)
  ├── referred_reward_units  DEFAULT 5000 (50 coins)
  ├── fraud_score          0–100
  ├── fraud_flags          JSONB
  └── hold_until           Delayed reward for fraud review
```

### Status Machine

```
pending ──(qualification event)──► qualified ──(reward job)──► rewarded
   │                                    │
   └──(fraud detected)──► rejected ◄───┘
```

---

## 10. Host / KYC Schema

```
users ──► host_applications (1:1)
      ──► host_kyc (1:N, latest verified wins)
      ──► host_profiles (1:1, created on approval)
      ──► host_bank_accounts (1:N)
      ──► host_earnings (1:N)
      ──► withdrawals (1:N)

host_kyc
  ├── pan_hash / pan_masked     (never store plain PAN)
  ├── aadhaar_masked
  ├── provider + provider_reference
  └── verification_status       pending | in_review | verified | failed | expired

host_profiles
  ├── is_available              Discovery + call routing
  ├── total_earnings_units      Lifetime gross to host
  ├── withdrawable_units        After hold period
  └── rating_sum / rating_count Computed rating

host_earnings
  ├── gross_units = platform_fee + net
  ├── status: held → available → paid
  └── available_at              now() + 7 days default hold
```

---

## 11. Video Call Schema

```
users ──► calls (as caller or callee)
calls ──► call_billing_ticks (1:N, one per minute)
calls ──► call_consents (1:N, both parties)
calls ──► host_earnings (via billing ticks)
calls ──► reports (optional FK)

calls
  ├── status: initiated → ringing → active → ended
  │                    ↘ missed / rejected / cancelled
  ├── is_free_call       (free_calls_used < 5)
  ├── coins_charged_units (sum of ticks)
  └── end_reason         user_ended | balance_zero | timeout | reported | error

call_billing_ticks
  ├── tick_number        Sequential from 1
  ├── coins_deducted_units  DEFAULT 500 (5 coins)
  ├── host_earning_units    350 (70%)
  ├── platform_fee_units    150 (30%)
  └── idempotency_key    call:{call_id}:tick:{n}
```

---

## 12. Messaging Schema

```
users ──► conversations (participant_a or participant_b)
conversations ──► messages (1:N)

conversations
  ├── participant_a_id < participant_b_id  (canonical pair)
  ├── last_message_at                        (denormalized)
  └── soft delete via deleted_at

messages
  ├── moderation_status  pending | approved | flagged | removed
  ├── content            TEXT (max 2000 chars app-level)
  └── soft delete via deleted_at
```

---

## 13. Admin Moderation Schema

```
reports ──► account_suspensions (optional link)
reports ──► abuse_signals (via app logic)
moderation_queue ──► profiles, messages, avatars (polymorphic target)
audit_logs ──► all admin actions (immutable)
platform_config ──► runtime settings (coin rates, free calls, etc.)

moderation_queue.target_type:
  USER_PROFILE | AVATAR | BIO | MESSAGE | HOST_APPLICATION

account_suspensions
  ├── is_permanent
  ├── ends_at (NULL if permanent)
  ├── appeal_status: none | pending | approved | rejected
  └── lifted_at / lifted_by_id
```

---

## 14. Reporting Schema

```
reports
  ├── reporter_id    (required)
  ├── reported_id    (required)
  ├── call_id        (optional — in-call report)
  ├── message_id     (optional — message report)
  ├── category       harassment | spam | inappropriate_content | fraud
  │                  minor_safety | impersonation | other
  ├── severity       low | medium | high | critical
  ├── status         open | reviewing | resolved | dismissed | escalated
  └── resolution_action  warning | content_removed | temp_suspend
                         | permanent_ban | payout_hold | dismissed

abuse_signals (feeds users.abuse_score)
  ├── signal_type    report_received | report_upheld | blocked_by_users
  │                  call_reported | message_flagged | referral_fraud
  └── score_delta    Integer (+/-)
```

---

## 15. Payment Schema

```
coin_packages ──► payments
payments ──► payment_webhook_events
payments ──► wallet_transactions (on success)

payments
  ├── razorpay_order_id     (created at order time)
  ├── razorpay_payment_id   (filled on success)
  ├── amount_inr            (base price)
  ├── gst_inr               (18%)
  ├── total_inr             (amount + GST)
  ├── coin_units_credited   (package + bonus)
  ├── invoice_number        (GST compliant)
  └── status: created | authorized | paid | failed | refunded

payment_webhook_events
  ├── razorpay_event_id     UNIQUE (idempotent processing)
  ├── payload               Full webhook JSONB
  └── processed             Boolean guard
```

---

## 16. Withdrawal Schema

```
host_profiles.withdrawable_units ──► withdrawals

host_bank_accounts
  ├── account_number_enc       (AES-256 app layer)
  ├── account_number_masked    (XXXX1234)
  ├── ifsc_code
  └── upi_id_enc (optional)

withdrawals
  ├── amount_units             (deducted from withdrawable_units)
  ├── amount_inr               (converted at host rate)
  ├── tds_inr                  (Section 194O if applicable)
  ├── net_inr                  (amount_inr - tds_inr)
  ├── status: requested | approved | processing | completed | rejected | failed
  ├── razorpay_payout_id
  └── utr                      (bank transfer reference)
```

### Conversion Formula

```
host_inr_rate: 70 host net units = ₹10
amount_inr = (amount_units / 70) * 10
```

---

## Seed Config (`platform_config` defaults)

| Key | Value |
|-----|-------|
| `billing.coins_per_minute_units` | 500 |
| `billing.free_call_limit` | 5 |
| `billing.free_call_max_seconds` | 180 |
| `billing.host_share_percent` | 70 |
| `referral.reward_units` | 5000 |
| `referral.qualification_window_hours` | 24 |
| `referral.fraud_hold_hours` | 72 |
| `withdrawal.min_units` | 50000 |
| `withdrawal.hold_days` | 7 |
| `abuse.suspend_threshold` | 80 |
| `abuse.ban_threshold` | 100 |