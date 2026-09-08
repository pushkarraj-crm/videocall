# Monitoring Guide

## Sentry

Set in `.env.production`:

```
SENTRY_DSN=https://xxx@sentry.io/yyy
SENTRY_ENVIRONMENT=production
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/yyy
```

Install optional packages for full integration:

```bash
npm install @sentry/nestjs @sentry/nextjs -w @platform/api -w @platform/web
```

## Health Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/health` | Basic health + database |
| `GET /v1/health/live` | Liveness probe |
| `GET /v1/health/ready` | Readiness (DB, Redis, queues) |
| `GET /v1/health/metrics` | Active users, hosts, memory |

## Logs

Structured JSON logs from:
- API/Worker: Pino (`api_logs`, `worker_logs` volumes)
- NGINX: JSON access log (`nginx_logs` volume)

## Metrics to Watch

- CPU / Memory per container (`docker stats`)
- `http_req_duration` p95 (load tests)
- Error rate via Sentry
- `pendingWithdrawals` via `/health/metrics`
- PostgreSQL connections and slow queries