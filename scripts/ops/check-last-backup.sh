#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-backup_postgres}"
MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-48}"
MIN_SIZE_BYTES="${BACKUP_MIN_SIZE_BYTES:-1000}"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

if [[ ! "$MAX_AGE_HOURS" =~ ^[0-9]+$ ]] || [[ "$MAX_AGE_HOURS" -le 0 ]]; then
  echo "Invalid BACKUP_MAX_AGE_HOURS: $MAX_AGE_HOURS" >&2
  exit 1
fi

if [[ ! "$MIN_SIZE_BYTES" =~ ^[0-9]+$ ]] || [[ "$MIN_SIZE_BYTES" -le 0 ]]; then
  echo "Invalid BACKUP_MIN_SIZE_BYTES: $MIN_SIZE_BYTES" >&2
  exit 1
fi

newest_file="$(
  find "$BACKUP_DIR" -maxdepth 1 -type f -name "${BACKUP_PREFIX}_*.sql.gz" -printf '%T@ %p\n' \
    | sort -nr \
    | head -n 1 \
    | cut -d ' ' -f 2-
)"

if [[ -z "$newest_file" ]]; then
  echo "No backup found for pattern: $BACKUP_DIR/${BACKUP_PREFIX}_*.sql.gz" >&2
  exit 1
fi

backup_size="$(stat -c%s "$newest_file")"
if [[ "$backup_size" -lt "$MIN_SIZE_BYTES" ]]; then
  echo "Latest backup is too small: $newest_file ($backup_size bytes)" >&2
  exit 1
fi

backup_mtime="$(stat -c%Y "$newest_file")"
now="$(date +%s)"
age_seconds="$((now - backup_mtime))"
max_age_seconds="$((MAX_AGE_HOURS * 3600))"

if [[ "$age_seconds" -gt "$max_age_seconds" ]]; then
  echo "Latest backup is too old: $newest_file (${age_seconds}s old)" >&2
  exit 1
fi

echo "Latest backup OK: $newest_file ($backup_size bytes, ${age_seconds}s old)"
