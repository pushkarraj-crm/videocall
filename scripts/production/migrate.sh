#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BACKUP_BEFORE_MIGRATE="${BACKUP_BEFORE_MIGRATE:-true}"

if [ "${BACKUP_BEFORE_MIGRATE}" = "true" ]; then
  echo "==> Creating pre-migration backup"
  bash scripts/production/backup-postgres.sh
fi

echo "==> Running Prisma migrations"
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate deploy

echo "==> Migration status"
docker compose -f docker-compose.prod.yml exec -T api npx prisma migrate status

echo "==> Migrations complete"