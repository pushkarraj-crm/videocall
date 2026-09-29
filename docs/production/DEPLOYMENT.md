# Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- Domain with DNS A records for `app.example.com` and `api.example.com`
- Ports 80 and 443 open

## AWS / DigitalOcean / Azure / VPS

The same `docker-compose.prod.yml` works on any Linux VPS:

1. For a 5,000-session starting point, provision at least 24 vCPU and 32GB RAM, or use managed Postgres/Redis plus compute with equivalent aggregate capacity. This is a starting size, not a measured guarantee.
2. Install Docker
3. Clone repository
4. Copy `.env.production.example` → `.env.production`
5. Run `bash scripts/production/deploy.sh`
6. Run SSL init script
7. Verify with `verify-production.sh`

## Horizontal Scaling

- **API**: The production compose file starts 6 API replicas by default. Set `API_REPLICAS` in `.env.production` to tune the count. NGINX refreshes Docker DNS and distributes traffic across replicas.
- **Worker**: Run 1–2 worker instances (cron idempotency via DB)
- **Web**: The production compose file starts 2 web replicas by default. Set `WEB_REPLICAS` to tune the count.
- **Database pool**: Each API and worker process is capped at `PRISMA_CONNECTION_LIMIT` connections. Keep `API_REPLICAS × PRISMA_CONNECTION_LIMIT + worker pools + operational connections` below PostgreSQL `max_connections`.
- **Redis**: Use managed Redis (ElastiCache, DO Managed Redis) — set `REDIS_URL`
- **PostgreSQL**: Use managed RDS/DO Postgres for production

Video and audio streams use Zego; confirm the Zego project’s concurrent-user quota and regional media capacity separately from API capacity.

## Rollback

```bash
# GitHub Actions deploy workflow supports rollback=true
# Or manually:
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --no-build
```

## Cloudflare CDN

1. Point DNS to Cloudflare (orange cloud)
2. Set SSL mode to **Full (strict)**
3. Enable Brotli, Auto Minify, caching for `/_next/static/*`
4. WebSocket support: enable for Zego signaling paths
