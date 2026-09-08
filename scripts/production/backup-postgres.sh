#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

POSTGRES_USER="${POSTGRES_USER:-platform}"
POSTGRES_DB="${POSTGRES_DB:-platform}"
PGHOST="${PGHOST:-postgres}"

mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"

DAILY_FILE="${BACKUP_DIR}/daily/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

dump_via_docker() {
  docker compose -f "${ROOT}/docker-compose.prod.yml" exec -T postgres \
    sh -c "PGPASSWORD=\${POSTGRES_PASSWORD} pg_dump -U ${POSTGRES_USER} -d ${POSTGRES_DB} --no-owner --no-acl" \
    | gzip > "${DAILY_FILE}"
}

dump_via_host() {
  PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}" pg_dump \
    -h "${PGHOST}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    --no-owner --no-acl | gzip > "${DAILY_FILE}"
}

echo "==> Backing up ${POSTGRES_DB} to ${DAILY_FILE}"

if docker compose -f "${ROOT}/docker-compose.prod.yml" ps postgres 2>/dev/null | grep -qE 'running|Up'; then
  dump_via_docker
elif command -v pg_dump >/dev/null 2>&1 && PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_isready -h "${PGHOST}" -U "${POSTGRES_USER}" >/dev/null 2>&1; then
  dump_via_host
else
  echo "ERROR: Postgres is not reachable via Docker or host pg_dump" >&2
  exit 1
fi

if [ "$(date -u +%u)" = "7" ]; then
  cp "${DAILY_FILE}" "${BACKUP_DIR}/weekly/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
fi

if [ "$(date -u +%d)" = "01" ]; then
  cp "${DAILY_FILE}" "${BACKUP_DIR}/monthly/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
fi

find "${BACKUP_DIR}/daily" -name '*.sql.gz' -mtime +"${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}/weekly" -name '*.sql.gz' -mtime +90 -delete
find "${BACKUP_DIR}/monthly" -name '*.sql.gz' -mtime +365 -delete

gunzip -t "${DAILY_FILE}"
echo "==> Backup verified: ${DAILY_FILE} ($(du -h "${DAILY_FILE}" | cut -f1))"