#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?Usage: BACKUP_FILE=/backups/daily/platform_xxx.sql.gz ./restore-postgres.sh}"

POSTGRES_USER="${POSTGRES_USER:-platform}"
POSTGRES_DB="${POSTGRES_DB:-platform}"
PGHOST="${PGHOST:-postgres}"

echo "==> Restoring ${POSTGRES_DB} from ${BACKUP_FILE}"
echo "WARNING: This will overwrite the current database. Press Ctrl+C to abort."
sleep 5

gunzip -c "${BACKUP_FILE}" | PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}" psql \
  -h "${PGHOST}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --single-transaction

echo "==> Restore complete"