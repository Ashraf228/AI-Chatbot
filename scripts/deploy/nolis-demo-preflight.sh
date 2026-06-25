#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="soule-demo"
COMPOSE_FILE="docker-compose.nolis-demo.yml"
EXPECTED_COMMIT="d8be0773c54e176e4e9fd63aae90766193ee526c"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <env-file>" >&2
  exit 64
fi

ENV_FILE="$1"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "FAIL: env file not found" >&2
  exit 66
fi

if [[ -n "$(git status --short)" ]]; then
  echo "FAIL: working tree is not clean" >&2
  exit 70
fi

current_commit="$(git rev-parse HEAD)"
if [[ "$current_commit" != "$EXPECTED_COMMIT" ]]; then
  echo "FAIL: unexpected commit $current_commit" >&2
  exit 70
fi

docker --version >/dev/null
docker compose version >/dev/null

if ! grep -Eq '^EXISTING_EDGE_NETWORK=.+' "$ENV_FILE"; then
  echo "FAIL: EXISTING_EDGE_NETWORK is not set in env file" >&2
  exit 78
fi

edge_network="$(grep -E '^EXISTING_EDGE_NETWORK=' "$ENV_FILE" | tail -n 1 | cut -d= -f2-)"
if ! docker network inspect "$edge_network" >/dev/null 2>&1; then
  echo "FAIL: configured external edge network does not exist" >&2
  exit 78
fi

required_vars=(
  APP_COMMIT_SHA
  EXISTING_EDGE_NETWORK
  ADMIN_DOMAIN
  API_DOMAIN
  WIDGET_DOMAIN
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  OPENAI_API_KEY
  ADMIN_KEY
  DASHBOARD_INTERNAL_TOKEN
  ADMIN_PANEL_PASSWORD_HASH
  ADMIN_SESSION_SECRET
  INTEGRATION_SECRET_KEY
  PUBLIC_API_BASE_URL
  PUBLIC_WIDGET_BUNDLE_URL
  NEXT_PUBLIC_WIDGET_LOADER_URL
  CORS_ALLOWED_ORIGINS
  EVALUATION_MOCK_HANDOFF_ENABLED
  EVALUATION_MOCK_RECEIVER_ORIGIN
  EVALUATION_MOCK_HANDOFF_SECRET_B64
  DEMO_PUBLIC_URL
  DEMO_TENANT_SLUG
  DEMO_SITE_SLUG
  DEMO_VIEWER_EMAIL
  DEMO_VIEWER_PASSWORD
  DEMO_VIEWER_EXPIRES_AT
)

missing=0
for name in "${required_vars[@]}"; do
  if grep -Eq "^${name}=.+" "$ENV_FILE"; then
    echo "${name}: set"
  else
    echo "${name}: missing"
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "FAIL: required env entries are missing" >&2
  exit 78
fi

if ss -lnt | awk '{print $4}' | grep -Eq ':(80|443)$'; then
  echo "INFO: host ports 80/443 are already in use; demo stack must not publish them"
fi

if grep -Eq '^[[:space:]]+-[[:space:]]+"?0\.0\.0\.0:' "$COMPOSE_FILE"; then
  echo "FAIL: compose file contains a public 0.0.0.0 port binding" >&2
  exit 70
fi

if [[ -f docs/security/audit-exceptions.md ]] && grep -q '2026-07-03' docs/security/audit-exceptions.md; then
  today="$(date -u +%Y-%m-%d)"
  if [[ "$today" > "2026-07-03" ]]; then
    echo "FAIL: documented Next/PostCSS audit exception date has passed" >&2
    exit 70
  fi
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" config --quiet

echo "PASS: NOLIS demo preflight completed"
