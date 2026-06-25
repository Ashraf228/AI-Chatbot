#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="soule-demo"
COMPOSE_FILE="docker-compose.nolis-demo.yml"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <env-file>" >&2
  exit 64
fi

ENV_FILE="$1"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T api \
  node -e "fetch('http://127.0.0.1:5000/healthz').then(async r=>{console.log('api health:', r.status); process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T dashboard \
  node -e "fetch('http://127.0.0.1:3000/healthz').then(async r=>{console.log('dashboard health:', r.status); process.exit(r.ok?0:1)}).catch(()=>process.exit(1))"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T proxy \
  wget -q -O - http://127.0.0.1/healthz >/dev/null

echo "PASS: internal NOLIS demo health checks completed"
