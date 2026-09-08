#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/v1}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

exec npx tsx scripts/production/verify-production.ts