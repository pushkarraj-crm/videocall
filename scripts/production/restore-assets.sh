#!/usr/bin/env bash
set -euo pipefail

: "${BACKUP_FILE:?Usage: BACKUP_FILE=/backups/assets/daily/uploads_xxx.tar.gz ./restore-assets.sh}"

UPLOADS_DEST="${UPLOADS_DEST:-/uploads}"

echo "==> Restoring uploads from ${BACKUP_FILE} to ${UPLOADS_DEST}"
echo "WARNING: This will merge/overwrite files. Press Ctrl+C to abort."
sleep 5

mkdir -p "${UPLOADS_DEST}"
tar -xzf "${BACKUP_FILE}" -C "$(dirname "${UPLOADS_DEST}")"

echo "==> Asset restore complete"