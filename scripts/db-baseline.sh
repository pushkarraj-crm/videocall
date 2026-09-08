#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Checking Prisma migration status..."

STATUS_OUTPUT="$(npm run db:migrate:status -w @platform/api 2>&1 || true)"

if echo "$STATUS_OUTPUT" | grep -q "P3005"; then
  echo "==> Database has schema but no migration history — baselining..."
  npm run db:baseline -w @platform/api
elif echo "$STATUS_OUTPUT" | grep -q "not yet been applied"; then
  echo "==> Pending migrations on existing schema — baselining..."
  npm run db:baseline -w @platform/api || {
    echo "==> Applying pending constraint migration..."
    npm run db:constraints -w @platform/api
    npm run db:baseline -w @platform/api
  }
else
  echo "==> Migration history already in sync."
fi

echo "Baseline complete."