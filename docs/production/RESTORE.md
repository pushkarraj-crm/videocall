# Restore Guide

## Database Restore

```bash
# 1. Stop API and worker to prevent writes
docker compose -f docker-compose.prod.yml stop api worker

# 2. Restore from backup
docker compose -f docker-compose.prod.yml exec -T backup \
  BACKUP_FILE=/backups/daily/platform_YYYYMMDDTHHMMSSZ.sql.gz \
  bash /restore-postgres.sh

# 3. Restart services
docker compose -f docker-compose.prod.yml up -d api worker
```

## Full Environment Restore

1. Provision new server
2. Restore `.env.production` from secure vault
3. `docker compose -f docker-compose.prod.yml up -d`
4. Restore database from latest backup
5. Run `migrate.sh` to ensure schema is current
6. Re-issue SSL if domain changed
7. Run `verify-production.sh`