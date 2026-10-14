#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f apps/api/.env ]; then
  echo "Missing apps/api/.env — run 'npm run setup' first."
  exit 1
fi

if [ ! -f apps/web/.env.local ]; then
  cp apps/web/.env.example apps/web/.env.local
fi

npx concurrently \
  --kill-others-on-fail \
  --names api,web \
  --prefix-colors blue,green \
  "npm run dev:api" \
  "npm run dev:web"
