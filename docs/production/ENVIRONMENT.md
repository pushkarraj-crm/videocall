# Environment Guide

## Files

| File | Purpose |
|------|---------|
| `.env.production.example` | Production template |
| `.env.staging.example` | Staging template |
| `apps/api/.env` | Local development API |
| `apps/web/.env.local` | Local development web |

## Required in Production

The API validates these at startup and **fails fast** if missing:

- `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`
- `FIREBASE_PROJECT_ID`, `ZEGO_APP_ID`, `ZEGO_SERVER_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
- `COMMUNICATIONS_INTERNAL_API_KEY`
- `ENABLE_DEV_AUTH` must be `false`

## Worker vs API

| Variable | API Container | Worker Container |
|----------|---------------|------------------|
| `ENABLE_CRON_JOBS` | `false` | `true` |

## Storage Providers

| Provider | `STORAGE_PROVIDER` | Required vars |
|----------|-------------------|---------------|
| Local disk | `local` | `STORAGE_LOCAL_PATH` |
| AWS S3 | `s3` | `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` |
| Cloudflare R2 | `r2` | Above + `STORAGE_ENDPOINT` |