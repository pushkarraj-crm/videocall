#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DEPLOY_MODE="${DEPLOY_MODE:-docker}"
ENV_FILE="${ENV_FILE:-.env.production}"

echo "==> Platform deploy (${DEPLOY_MODE})"

if [ ! -f "${ENV_FILE}" ]; then
  echo "Missing ${ENV_FILE}. Copy from .env.production.example first."
  exit 1
fi

npx tsx scripts/production/verify-env.ts --file "${ENV_FILE}"

if [ "${DEPLOY_MODE}" = "docker" ]; then
  docker compose -f docker-compose.prod.yml build
  bash scripts/production/migrate.sh
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  docker compose -f docker-compose.prod.yml ps
elif [ "${DEPLOY_MODE}" = "pm2" ]; then
  npm run build
  pm2 reload ecosystem.config.cjs --env production --update-env
  pm2 save
else
  echo "Unknown DEPLOY_MODE: ${DEPLOY_MODE}"
  exit 1
fi

npx tsx scripts/production/verify-production.ts

echo "==> Deploy complete"