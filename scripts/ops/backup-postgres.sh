#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-backup_postgres}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077

timestamp="$(date -u +%Y%m%d_%H%M)"
backup_path="$BACKUP_DIR/${BACKUP_PREFIX}_${timestamp}.sql.gz"
tmp_path="${backup_path}.tmp"

cleanup_tmp() {
  rm -f "$tmp_path"
}
trap cleanup_tmp EXIT

docker compose --project-directory "$PROJECT_DIR" --env-file "$ENV_FILE" \
  exec -T db sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -9 > "$tmp_path"

backup_size="$(stat -c%s "$tmp_path" 2>/dev/null || stat -f%z "$tmp_path")"
if [[ "$backup_size" -lt 1000 ]]; then
  echo "Backup file is unexpectedly small: $backup_size bytes" >&2
  exit 1
fi

mv "$tmp_path" "$backup_path"
chmod 600 "$backup_path"

if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  find "$BACKUP_DIR" -type f -name "${BACKUP_PREFIX}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete
fi

echo "Backup created: $backup_path ($backup_size bytes)"
