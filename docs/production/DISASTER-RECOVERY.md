# Disaster Recovery

## RTO / RPO Targets

| Metric | Target |
|--------|--------|
| RPO (data loss) | ≤ 24 hours (daily backup) |
| RTO (recovery) | ≤ 2 hours |

## Recovery Steps

1. **Assess** — Identify scope (DB, server, region)
2. **Provision** — New VPS or failover region
3. **Restore env** — `.env.production` from vault
4. **Restore DB** — Latest verified backup
5. **Deploy** — `docker compose up -d --build`
6. **SSL** — Re-issue if needed
7. **Verify** — `verify-production.sh` + smoke tests
8. **DNS** — Point to new server if IP changed

## Backup Locations

- Primary: `pgbackups` Docker volume
- Recommended: Sync daily backups to S3/R2 offsite