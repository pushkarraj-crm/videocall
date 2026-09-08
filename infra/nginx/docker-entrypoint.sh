#!/bin/sh
set -eu

: "${DOMAIN_NAME:=localhost}"
: "${API_DOMAIN:=api.${DOMAIN_NAME}}"
: "${ADMIN_DOMAIN:=admin.${DOMAIN_NAME}}"

export DOMAIN_NAME API_DOMAIN ADMIN_DOMAIN

envsubst '${DOMAIN_NAME} ${API_DOMAIN} ${ADMIN_DOMAIN}' \
  < /etc/nginx/templates/platform.conf.template \
  > /etc/nginx/conf.d/platform.conf

exec nginx -g 'daemon off;'