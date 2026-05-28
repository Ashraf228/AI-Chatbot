#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
OFFSITE_ENV_FILE="${OFFSITE_ENV_FILE:-$PROJECT_DIR/.offsite-backup.env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
DRY_RUN="${DRY_RUN:-0}"
RESTIC_CACHE_DIR="${RESTIC_CACHE_DIR:-/var/cache/ai-chatbot-restic}"

required_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing offsite config: $name" >&2
    exit 1
  fi
}

if [[ ! -f "$OFFSITE_ENV_FILE" ]]; then
  echo "Missing offsite env file: $OFFSITE_ENV_FILE" >&2
  exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "Backup directory not found: $BACKUP_DIR" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$OFFSITE_ENV_FILE"
set +a

required_var RESTIC_REPOSITORY
required_var RESTIC_PASSWORD_FILE
required_var STORAGE_BOX_HOST
required_var STORAGE_BOX_USER
required_var STORAGE_BOX_PORT
required_var SSH_KEY_FILE

if [[ ! -f "$RESTIC_PASSWORD_FILE" ]]; then
  echo "Missing restic password file" >&2
  exit 1
fi

if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "Missing Storage Box SSH key file" >&2
  exit 1
fi

if ! command -v restic >/dev/null 2>&1; then
  echo "restic is not installed" >&2
  exit 1
fi

install -d -m 700 "$RESTIC_CACHE_DIR"

mapfile -t backup_files < <(
  find "$BACKUP_DIR" -maxdepth 1 -type f \
    \( -name 'backup_postgres_*.sql.gz' -o -name 'backup_manual_*.sql.gz' \) \
    -printf '%T@ %p\n' |
    sort -nr |
    cut -d ' ' -f 2-
)

if [[ "${#backup_files[@]}" -eq 0 ]]; then
  echo "No local PostgreSQL backup files found for offsite sync" >&2
  exit 1
fi

export RESTIC_PASSWORD_FILE
export RESTIC_CACHE_DIR

sftp_command="ssh -i $SSH_KEY_FILE -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p $STORAGE_BOX_PORT $STORAGE_BOX_USER@$STORAGE_BOX_HOST -s sftp"
restic_base=(restic -r "$RESTIC_REPOSITORY" -o "sftp.command=$sftp_command")

echo "Offsite sync candidate files=${#backup_files[@]}"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "DRY_RUN=1, no offsite backup created"
  "${restic_base[@]}" snapshots --tag ai-chatbot --tag postgres --tag production >/dev/null
  exit 0
fi

"${restic_base[@]}" backup \
  --tag ai-chatbot \
  --tag postgres \
  --tag production \
  "${backup_files[@]}"

echo "Offsite backup snapshot created"
"${restic_base[@]}" snapshots --tag ai-chatbot --tag postgres --tag production
