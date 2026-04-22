#!/bin/sh
set -eu

TEMPLATE_PATH="/etc/nginx/templates/default.http.conf.template"

if [ "${TLS_ENABLED:-false}" = "true" ]; then
  : "${TLS_CERT_PATH:?TLS_CERT_PATH is required when TLS_ENABLED=true}"
  : "${TLS_KEY_PATH:?TLS_KEY_PATH is required when TLS_ENABLED=true}"

  if [ ! -f "${TLS_CERT_PATH}" ]; then
    echo "TLS certificate file not found: ${TLS_CERT_PATH}" >&2
    exit 1
  fi

  if [ ! -f "${TLS_KEY_PATH}" ]; then
    echo "TLS key file not found: ${TLS_KEY_PATH}" >&2
    exit 1
  fi

  TEMPLATE_PATH="/etc/nginx/templates/default.https.conf.template"
fi

envsubst '${ADMIN_DOMAIN} ${API_DOMAIN} ${WIDGET_DOMAIN} ${TLS_CERT_PATH} ${TLS_KEY_PATH}' \
  < "${TEMPLATE_PATH}" \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
