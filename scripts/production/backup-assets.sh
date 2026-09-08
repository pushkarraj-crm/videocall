#!/usr/bin/env bash
set -euo pipefail

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOADS_SRC="${UPLOADS_SRC:-/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

if [ ! -d "${UPLOADS_SRC}" ] || [ -z "$(ls -A "${UPLOADS_SRC}" 2>/dev/null || true)" ]; then
  echo "==> No uploads to back up at ${UPLOADS_SRC}"
  exit 0
fi

mkdir -p "${BACKUP_DIR}/assets/daily"

ASSET_FILE="${BACKUP_DIR}/assets/daily/uploads_${TIMESTAMP}.tar.gz"
echo "==> Backing up uploads to ${ASSET_FILE}"
tar -czf "${ASSET_FILE}" -C "$(dirname "${UPLOADS_SRC}")" "$(basename "${UPLOADS_SRC}")"

gunzip -t "${ASSET_FILE}"
find "${BACKUP_DIR}/assets/daily" -name 'uploads_*.tar.gz' -mtime +"${RETENTION_DAYS}" -delete

echo "==> Asset backup verified: ${ASSET_FILE} ($(du -h "${ASSET_FILE}" | cut -f1))"