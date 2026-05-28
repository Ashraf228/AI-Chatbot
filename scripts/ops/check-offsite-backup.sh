#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
OFFSITE_ENV_FILE="${OFFSITE_ENV_FILE:-$PROJECT_DIR/.offsite-backup.env}"
MAX_AGE_HOURS="${OFFSITE_BACKUP_MAX_AGE_HOURS:-48}"
MIN_FILE_BYTES="${OFFSITE_BACKUP_MIN_FILE_BYTES:-1000}"
RESTIC_CACHE_DIR="${RESTIC_CACHE_DIR:-/var/cache/ai-chatbot-restic}"

required_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "FAIL missing offsite config: $name" >&2
    exit 1
  fi
}

is_positive_int() {
  [[ "${1:-}" =~ ^[0-9]+$ ]] && [[ "$1" -gt 0 ]]
}

if ! is_positive_int "$MAX_AGE_HOURS"; then
  echo "FAIL invalid OFFSITE_BACKUP_MAX_AGE_HOURS" >&2
  exit 1
fi

if ! is_positive_int "$MIN_FILE_BYTES"; then
  echo "FAIL invalid OFFSITE_BACKUP_MIN_FILE_BYTES" >&2
  exit 1
fi

if [[ ! -f "$OFFSITE_ENV_FILE" ]]; then
  echo "FAIL missing offsite env file" >&2
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
  echo "FAIL missing restic password file" >&2
  exit 1
fi

if [[ ! -f "$SSH_KEY_FILE" ]]; then
  echo "FAIL missing Storage Box SSH key file" >&2
  exit 1
fi

if ! command -v restic >/dev/null 2>&1; then
  echo "FAIL restic is not installed" >&2
  exit 1
fi

install -d -m 700 "$RESTIC_CACHE_DIR"

export RESTIC_PASSWORD_FILE
export RESTIC_CACHE_DIR

sftp_command="ssh -i $SSH_KEY_FILE -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new -p $STORAGE_BOX_PORT $STORAGE_BOX_USER@$STORAGE_BOX_HOST -s sftp"
restic_base=(restic -r "$RESTIC_REPOSITORY" -o "sftp.command=$sftp_command")

snapshots_file="$(mktemp)"
ls_file="$(mktemp)"
cleanup() {
  rm -f "$snapshots_file" "$ls_file"
}
trap cleanup EXIT

"${restic_base[@]}" snapshots --json --tag ai-chatbot --tag postgres --tag production >"$snapshots_file"

snapshot_info="$(
  python3 - "$snapshots_file" "$MAX_AGE_HOURS" <<'PY'
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

snapshots = json.loads(Path(sys.argv[1]).read_text() or "[]")
max_age_hours = int(sys.argv[2])

if not snapshots:
    print("ERROR|no_snapshots")
    sys.exit(0)

def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))

latest = max(snapshots, key=lambda item: parse_time(item["time"]))
latest_time = parse_time(latest["time"])
now = datetime.now(timezone.utc)
age_seconds = int((now - latest_time).total_seconds())
max_age_seconds = max_age_hours * 3600

paths = latest.get("paths") or []
has_backup_path = any(str(path).endswith(".sql.gz") for path in paths)

status = "OK"
if age_seconds > max_age_seconds:
    status = "OLD"
elif not has_backup_path:
    status = "NO_BACKUP_PATH"

print("|".join([
    status,
    latest["short_id"],
    str(age_seconds),
    str(len(snapshots)),
]))
PY
)"

IFS='|' read -r snapshot_status snapshot_id snapshot_age snapshot_count <<<"$snapshot_info"

case "$snapshot_status" in
  ERROR)
    echo "FAIL offsite backup has no snapshots" >&2
    exit 1
    ;;
  OLD)
    echo "FAIL offsite backup too old age_seconds=$snapshot_age snapshots=$snapshot_count" >&2
    exit 1
    ;;
  NO_BACKUP_PATH)
    echo "FAIL latest offsite snapshot does not list PostgreSQL backup files" >&2
    exit 1
    ;;
  OK)
    ;;
  *)
    echo "FAIL offsite snapshot status unknown" >&2
    exit 1
    ;;
esac

"${restic_base[@]}" ls --json "$snapshot_id" >"$ls_file"

file_info="$(
  python3 - "$ls_file" "$MIN_FILE_BYTES" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

min_size = int(sys.argv[2])
count = 0
total = 0
small = 0

for raw in Path(sys.argv[1]).read_text().splitlines():
    if not raw.strip():
        continue
    item = json.loads(raw)
    if item.get("type") != "file":
        continue
    path = str(item.get("path", ""))
    if not path.endswith(".sql.gz"):
        continue
    size = int(item.get("size") or 0)
    count += 1
    total += size
    if size < min_size:
        small += 1

if count == 0:
    print("ERROR|0|0|0")
elif small:
    print(f"SMALL|{count}|{total}|{small}")
else:
    print(f"OK|{count}|{total}|0")
PY
)"

IFS='|' read -r file_status file_count file_total file_small <<<"$file_info"
if [[ "$file_status" != "OK" ]]; then
  echo "FAIL offsite backup files invalid count=${file_count:-0} small=${file_small:-0}" >&2
  exit 1
fi

echo "OK offsite backup latest_age_seconds=$snapshot_age snapshots=$snapshot_count files=$file_count total_bytes=$file_total"
