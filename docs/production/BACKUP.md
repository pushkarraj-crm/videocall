# Backup Guide

## Automated Backups

Enable the backup sidecar:

```bash
docker compose -f docker-compose.prod.yml --profile backup up -d backup
```

## Schedule

| Type | Frequency | Retention |
|------|-----------|-----------|
| Daily | Every 24h | 30 days (configurable) |
| Weekly | Sundays | 90 days |
| Monthly | 1st of month | 365 days |

## Manual Backup

```bash
docker compose -f docker-compose.prod.yml exec backup /backup.sh
```

Backups are stored in the `pgbackups` volume at `/backups/daily/`.

## Verification

Each backup runs `gunzip -t` after creation to verify integrity.