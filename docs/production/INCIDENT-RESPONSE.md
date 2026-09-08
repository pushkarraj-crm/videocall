# Incident Response Guide

## Severity Levels

| Level | Example | Response |
|-------|---------|----------|
| P1 | API down, payments failing | Immediate, all hands |
| P2 | Degraded calls, slow responses | 30 min response |
| P3 | Non-critical feature issue | Next business day |

## P1 Playbook

1. Check `/v1/health/ready` on all instances
2. Check `docker compose ps` — restart unhealthy containers
3. Check PostgreSQL disk and connections
4. Check Redis connectivity
5. Review Sentry for error spikes
6. If data issue: stop writes, restore from backup
7. Communicate status to stakeholders

## Rollback Decision

Rollback if:
- New deploy correlates with error spike
- Migration caused data corruption
- Critical payment/call path broken

```bash
# Deploy workflow with rollback=true
# Or: git checkout <previous-sha> && docker compose up -d --build
```