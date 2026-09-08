# Deployment Guide

## Prerequisites

- Docker 24+ and Docker Compose v2
- Domain with DNS A records for `app.example.com` and `api.example.com`
- Ports 80 and 443 open

## AWS / DigitalOcean / Azure / VPS

The same `docker-compose.prod.yml` works on any Linux VPS:

1. Provision Ubuntu 22.04+ instance (4 vCPU, 8GB RAM recommended for 1000 concurrent)
2. Install Docker
3. Clone repository
4. Copy `.env.production.example` → `.env.production`
5. Run `docker compose -f docker-compose.prod.yml up -d --build`
6. Run `bash scripts/production/migrate.sh`
7. Run SSL init script
8. Verify with `verify-production.sh`

## Horizontal Scaling

- **API**: Scale with `docker compose up -d --scale api=3` behind NGINX upstream
- **Worker**: Run 1–2 worker instances (cron idempotency via DB)
- **Web**: Scale with `--scale web=2`
- **Redis**: Use managed Redis (ElastiCache, DO Managed Redis) — set `REDIS_URL`
- **PostgreSQL**: Use managed RDS/DO Postgres for production

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