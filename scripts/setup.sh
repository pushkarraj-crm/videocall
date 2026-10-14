#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for file in apps/api/package.json apps/web/package.json apps/api/.env.example apps/web/.env.example; do
  if [ ! -f "$file" ]; then
    echo "Missing $file — this checkout is incomplete. Restore the project files first."
    exit 1
  fi
done

# Use an existing PostgreSQL server when Docker Desktop is unavailable.
DATABASE_MODE="${DATABASE_MODE:-auto}"
if [ "$DATABASE_MODE" = auto ]; then
  if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    DATABASE_MODE=external
  else
    DATABASE_MODE=docker
  fi
fi
case "$DATABASE_MODE" in
  docker)
    if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
      echo "Docker is unavailable. Start Docker Desktop and enable WSL integration."
      echo "For an existing PostgreSQL server, use: DATABASE_MODE=external npm run setup"
      exit 1
    fi
    echo "==> Starting PostgreSQL..."
    docker compose up -d postgres
    echo "==> Waiting for database (up to 60 seconds)..."
    ready=false
    for attempt in {1..60}; do
      if docker compose exec -T postgres pg_isready -U postgres -d platform >/dev/null 2>&1; then
        ready=true
        break
      fi
      sleep 1
    done
    if [ "$ready" != true ]; then
      echo "PostgreSQL did not become ready. Check: docker compose logs postgres"
      exit 1
    fi
    ;;
  external)
    echo "==> Using existing PostgreSQL server from apps/api/.env"
    ;;
  *)
    echo "Invalid DATABASE_MODE: $DATABASE_MODE (use auto, docker or external)"
    exit 1
    ;;
esac

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

# Development uses db push above. Do not mark historical migrations as applied:
# the current schema does not prove that their SQL/data changes were executed.

echo ""
echo "Setup complete."
echo "  API:  http://localhost:3001/v1"
echo "  Web:  http://localhost:3000"
echo ""
echo "Run 'npm run dev' to start both services."
