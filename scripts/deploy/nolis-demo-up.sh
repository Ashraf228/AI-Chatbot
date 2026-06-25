#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="soule-demo"
COMPOSE_FILE="docker-compose.nolis-demo.yml"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <env-file>" >&2
  exit 64
fi

ENV_FILE="$1"

echo "This starts or updates the isolated NOLIS demo stack only."
echo "It does not change DNS, firewall rules, certificates, or the production edge proxy."
read -r -p "Type DEPLOY SOULE DEMO to continue: " confirmation

if [[ "$confirmation" != "DEPLOY SOULE DEMO" ]]; then
  echo "Aborted."
  exit 130
fi

scripts/deploy/nolis-demo-preflight.sh "$ENV_FILE"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d --build db redis api dashboard widget proxy

echo "PASS: NOLIS demo stack up command completed"
