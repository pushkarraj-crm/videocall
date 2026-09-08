#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Starting PostgreSQL..."
docker compose up -d

echo "==> Waiting for database..."
until docker compose exec -T postgres pg_isready -U postgres -d platform >/dev/null 2>&1; do
  sleep 1
done

echo "==> Creating environment files..."
if [ ! -f apps/api/.env ]; then
  cp apps/api/.env.example apps/api/.env
  echo "    Created apps/api/.env"
fi
if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.example apps/web/.env.local
  echo "    Created apps/web/.env.local"
fi

echo "==> Installing dependencies..."
npm install

echo "==> Pushing Prisma schema..."
npm run db:push -w @platform/api

echo "==> Applying database constraints..."
npm run db:constraints -w @platform/api

echo "==> Seeding database..."
npm run db:seed -w @platform/api

echo "==> Syncing migration history for existing databases..."
bash scripts/db-baseline.sh

echo ""
echo "Setup complete."
echo "  API:  http://localhost:3001/v1"
echo "  Web:  http://localhost:3000"
echo ""
echo "Run 'npm run dev' to start both services."