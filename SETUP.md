# Platform Setup Guide

Production-ready social video platform monorepo integrating Next.js, NestJS, PostgreSQL, Prisma, native authentication, Razorpay, and ZegoCloud.

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

- Google OAuth client (Google login)
- Razorpay account (payments)
- ZegoCloud account (video calls)

## Quick Start (Local Dev)

```bash
cd platform
npm run setup    # Postgres + deps + schema + seed
npm run dev      # API + Web concurrently
```

Web development uses Turbopack to reduce compiler memory usage. The first visit
to a route still compiles it; later visits reuse the compiled route. If you need
the previous compiler for debugging, run `npm run dev:webpack -w @platform/web`
with the API running separately. For deployment, use the production build rather
than `npm run dev`; development login shortcuts are disabled in production.

Auth request regression checks: from `apps/web`, run
`npx tsx scripts/auth-refresh.test.ts`.

For the extracted project in this workspace, the project directory is
`~/Videocall/platform/platform` in WSL.

Docker Desktop must be running with WSL integration enabled for your distribution.
Setup automatically uses local PostgreSQL when it is accepting connections on
port 5432. If PostgreSQL is installed directly in WSL instead, start it with
`sudo service postgresql start`, configure the database in `apps/api/.env`, and run:

```bash
DATABASE_MODE=external npm run setup
npm run dev
```

Setup preserves existing environment files and uses Prisma schema push for local
development. Production migration deployment is a separate operation.

Open http://localhost:3000 and use **Dev Login** buttons (User / Host / Admin) — local PostgreSQL authentication.

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
| `NEXT_PUBLIC_ZEGO_APP_ID` | Prod | ZegoCloud app ID |

## Integration Flows

### Authentication

1. **Email/password:** `POST /v1/auth/register` or `/auth/login` → platform JWT
2. **Google and phone:** native OAuth and provider-delivered OTP → platform JWT
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
- [ ] Configure Google OAuth, MSG91 SMS Flow, and SMTP (see docs/NATIVE_AUTH.md)
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
| `Razorpay is not configured` | Add keys or use dev user with seed coins |
| No hosts on home | Login as Host dev account, toggle availability |
| Incoming calls not showing | Host must be online; poll runs every 3s |
| DB connection refused | Run `docker compose up -d` |

## API Base URL

All endpoints are prefixed with `/v1`. Example:

```
GET  /v1/health
POST /v1/auth/login
POST /v1/auth/register
POST /v1/auth/phone/request
POST /v1/auth/phone/verify
GET  /v1/payments/packages
POST /v1/calls/initiate
GET  /v1/calls/incoming
```

Authentication configuration and migration: [Native auth guide](docs/NATIVE_AUTH.md).
