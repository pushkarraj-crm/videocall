# Platform Setup Guide

Production-ready social video platform monorepo integrating Next.js, NestJS, PostgreSQL, Prisma, Firebase Auth, Razorpay, and ZegoCloud.

## Architecture

```
platform/
├── apps/api/     NestJS backend  → http://localhost:3001/v1
├── apps/web/     Next.js frontend → http://localhost:3000
├── docker-compose.yml
└── scripts/
```

## Prerequisites

- Node.js 20+
- Docker Desktop (for PostgreSQL)
- npm 10+

Optional for full production integrations:

- Firebase project (Auth)
- Razorpay account (payments)
- ZegoCloud account (video calls)

## Quick Start (Local Dev)

```bash
cd platform
npm run setup    # Postgres + deps + schema + seed
npm run dev      # API + Web concurrently
```

Open http://localhost:3000 and use **Dev Login** buttons (User / Host / Admin) — no Firebase required.

### Dev Accounts (seeded)

| Role  | Phone          | Notes                    |
|-------|----------------|--------------------------|
| User  | +919999990001  | 500 coins pre-loaded     |
| Host  | +919999990002  | Available for calls      |
| Admin | +919999990003  | Admin panel access       |

## Environment Variables

### API (`apps/api/.env`)

Copy from `apps/api/.env.example`:

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 32 chars, platform JWT signing |
| `ENABLE_DEV_AUTH` | Dev | `true` enables `/auth/dev-login` |
| `FIREBASE_*` | Prod | Firebase Admin SDK credentials |
| `RAZORPAY_*` | Prod | Payment gateway keys |
| `ZEGO_*` | Prod | Video call tokens |

### Web (`apps/web/.env.local`)

```bash
cp apps/web/.env.example apps/web/.env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:3001/v1` |
| `NEXT_PUBLIC_ENABLE_DEV_AUTH` | Dev | `true` shows dev login buttons |
| `NEXT_PUBLIC_FIREBASE_*` | Prod | Firebase client SDK |
| `NEXT_PUBLIC_ZEGO_APP_ID` | Prod | ZegoCloud app ID |

## Integration Flows

### Authentication

1. **Production:** Firebase ID token → `POST /v1/auth/verify-token` → platform JWT
2. **Development:** `POST /v1/auth/dev-login` → platform JWT (no Firebase)
3. JWT stored in `localStorage` + `platform_token` cookie
4. Onboarding: `POST /v1/auth/complete-onboarding` (consents + profile + optional referral)

### Wallet & Payments

1. Coin packages: `GET /v1/payments/packages` (public)
2. Create order: `POST /v1/payments/create-order` → Razorpay checkout
3. Confirm: `POST /v1/payments/confirm` → credits wallet
4. Webhook: `POST /v1/payments/webhook` (Razorpay server events)
5. Balance: `GET /v1/wallet`

### Video Calls & Coin Deduction

1. User initiates: `POST /v1/calls/initiate` → Zego room + token
2. Both parties consent: `POST /v1/calls/:id/consent`
3. Host accepts: `POST /v1/calls/:id/accept`
4. Billing: `POST /v1/calls/:id/billing-tick` every 60s (5 coins/min)
5. Host polls: `GET /v1/calls/incoming` (every 3s on web)

### Referrals

1. Apply code during onboarding or `POST /v1/referrals/apply`
2. Qualify on first recharge
3. Rewards processed every 5 min via scheduled task

### Host Onboarding

1. Apply: `POST /v1/hosts/apply`
2. KYC: `POST /v1/hosts/kyc/initiate` → callback verifies
3. Admin approves: `POST /v1/admin/host-applications/:id/review`
4. Host goes online: `PATCH /v1/hosts/availability`
5. Withdraw: bank account + `POST /v1/hosts/withdrawals`

### Admin

Access at `/admin` with admin role. Endpoints under `/v1/admin/*`:

- User search & status
- Host application review
- Withdrawal approval
- Reports & moderation
- Platform config
- Analytics dashboard

## Database Commands

```bash
npm run db:push        # Sync schema to Postgres
npm run db:seed        # Platform config + packages + dev users
npm run db:constraints # Partial indexes & CHECK constraints
npm run db:studio      # Prisma Studio GUI
```

## Production Build

```bash
npm run build
cd apps/api && npm run start:prod
cd apps/web && npm run start
```

### Production Checklist

- [ ] Set `ENABLE_DEV_AUTH=false` on API
- [ ] Set `NEXT_PUBLIC_ENABLE_DEV_AUTH=false` on web
- [ ] Configure Firebase Admin + client credentials
- [ ] Configure Razorpay live keys + webhook URL
- [ ] Configure ZegoCloud app ID + server secret
- [ ] Use strong `JWT_SECRET` (32+ chars)
- [ ] Set `NODE_ENV=production`
- [ ] Run `npm run db:migrate -w @platform/api` for migrations
- [ ] Point Razorpay webhook to `https://your-api/v1/payments/webhook`

## Health Check

```bash
curl http://localhost:3001/v1/health
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Firebase is not configured` | Use dev login, or add Firebase credentials |
| `Razorpay is not configured` | Add keys or use dev user with seed coins |
| No hosts on home | Login as Host dev account, toggle availability |
| Incoming calls not showing | Host must be online; poll runs every 3s |
| DB connection refused | Run `docker compose up -d` |

## API Base URL

All endpoints are prefixed with `/v1`. Example:

```
GET  /v1/health
POST /v1/auth/verify-token
GET  /v1/payments/packages
POST /v1/calls/initiate
GET  /v1/calls/incoming
```