#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="soule-demo"
COMPOSE_FILE="docker-compose.nolis-demo.yml"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <env-file>" >&2
  exit 64
fi

ENV_FILE="$1"

echo "This stops the isolated NOLIS demo stack."
echo "Volumes, images and build cache will not be deleted."
read -r -p "Type STOP SOULE DEMO to continue: " confirmation

if [[ "$confirmation" != "STOP SOULE DEMO" ]]; then
  echo "Aborted."
  exit 130
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down --remove-orphans

echo "PASS: NOLIS demo stack stopped without deleting volumes"
