#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

: "${DOMAIN_NAME:?Set DOMAIN_NAME}"
: "${LETSENCRYPT_EMAIL:?Set LETSENCRYPT_EMAIL}"

API_DOMAIN="${API_DOMAIN:-api.${DOMAIN_NAME}}"
ADMIN_DOMAIN="${ADMIN_DOMAIN:-admin.${DOMAIN_NAME}}"

echo "==> Requesting Let's Encrypt certificate"
echo "    app:   ${DOMAIN_NAME}"
echo "    api:   ${API_DOMAIN}"
echo "    admin: ${ADMIN_DOMAIN}"

docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "${LETSENCRYPT_EMAIL}" \
  --agree-tos --no-eff-email \
  -d "${DOMAIN_NAME}" \
  -d "${API_DOMAIN}" \
  -d "${ADMIN_DOMAIN}"

echo "==> Reloading NGINX"
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

echo "==> SSL certificate issued. HTTPS redirect is active."