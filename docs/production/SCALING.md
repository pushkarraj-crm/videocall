# Scaling for 5,000 concurrent sessions

The production compose defaults are sized as a starting point for 5,000 connected application sessions:

| Service | Default replicas | Per-container limit |
|---------|------------------|---------------------|
| API | 6 | 1 vCPU, 1 GB RAM |
| Web | 2 | 1 vCPU, 768 MB RAM |
| Worker | 1 | 1 vCPU, 768 MB RAM |
| PostgreSQL | 1 | 4 vCPU, 8 GB RAM |
| NGINX | 1 | 2 vCPU, 1 GB RAM, 65,536 file descriptors |
| Redis | 1 | 2 vCPU, 1.5 GB RAM, 1 GB max dataset |

Use a host with at least 24 vCPU and 32 GB RAM for this compose topology. Managed Postgres and Redis are preferred for production; provision Postgres with enough CPU, memory, and IOPS for the application’s write rate. The API and worker connection pools default to 10 connections each. Keep their total, plus admin and monitoring connections, below the database connection limit.

Set `API_REPLICAS`, `WEB_REPLICAS`, and `PRISMA_CONNECTION_LIMIT` in `.env.production`, then redeploy:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

NGINX resolves the Compose service names periodically, so it can route to scaled API and web containers. Redis is shared by API replicas for rate limits and notification fan-out. If Redis is unavailable, rate limits fall back to per-process memory and notification delivery stays local to the connected API instance.

Incoming calls, call status, and gifts arrive through the Redis-backed notification stream. Jittered 30–40 second incoming-call checks and 30–45 second call/gift checks repair state after a missed event or stream reconnect. At 5,000 host sessions, incoming-call repair checks add roughly 125–167 requests per second instead of the old 1,667 requests per second. If all 5,000 sessions are in active calls, status and gift repair checks can add another roughly 222–333 requests per second. Validate with representative authenticated traffic before treating the target as achieved.

This sizing does not include Zego’s media capacity. Verify the account’s concurrent participant quota, bandwidth, and regional limits separately. The checked-in load-test report only covers a single local API process and does not establish 5,000-session capacity.
