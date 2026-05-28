#!/usr/bin/env bash
set -Eeuo pipefail

if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
else
  PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
  SCRIPT_DIR="$PROJECT_DIR/scripts/ops"
fi
OFFSITE_ENV_FILE="${OFFSITE_ENV_FILE:-$PROJECT_DIR/.offsite-backup.env}"
RESTIC_CACHE_DIR="${RESTIC_CACHE_DIR:-/var/cache/ai-chatbot-restic}"
RESTIC_KEEP_DAILY="${RESTIC_KEEP_DAILY:-14}"
RESTIC_KEEP_WEEKLY="${RESTIC_KEEP_WEEKLY:-4}"

required_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "FAIL missing offsite config: $name" >&2
    exit 1
  fi
}

is_non_negative_int() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

if ! is_non_negative_int "$RESTIC_KEEP_DAILY"; then
  echo "FAIL invalid RESTIC_KEEP_DAILY" >&2
  exit 1
fi

if ! is_non_negative_int "$RESTIC_KEEP_WEEKLY"; then
  echo "FAIL invalid RESTIC_KEEP_WEEKLY" >&2
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
tag_args=(--tag ai-chatbot --tag postgres --tag production)

snapshots_file="$(mktemp)"
forget_file="$(mktemp)"
cleanup() {
  rm -f "$snapshots_file" "$forget_file"
}
trap cleanup EXIT

"${restic_base[@]}" snapshots --json "${tag_args[@]}" >"$snapshots_file"

python3 - "$snapshots_file" <<'PY'
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

snapshots = json.loads(Path(sys.argv[1]).read_text() or "[]")
snapshots.sort(key=lambda item: datetime.fromisoformat(item["time"].replace("Z", "+00:00")))
tags = sorted({tag for item in snapshots for tag in (item.get("tags") or [])})
hosts = sorted({item.get("hostname") for item in snapshots if item.get("hostname")})

oldest = snapshots[0]["time"] if snapshots else None
newest = snapshots[-1]["time"] if snapshots else None

print("Snapshot scope: tags=ai-chatbot,postgres,production")
print(f"Snapshots matching scope: {len(snapshots)}")
print(f"Oldest snapshot time: {oldest or 'none'}")
print(f"Newest snapshot time: {newest or 'none'}")
print(f"Hosts: {', '.join(hosts) if hosts else 'none'}")
print(f"Observed tags: {', '.join(tags) if tags else 'none'}")
PY

if [[ ! -s "$snapshots_file" ]]; then
  echo "FAIL no snapshot data returned" >&2
  exit 1
fi

snapshot_count="$(python3 - "$snapshots_file" <<'PY'
import json
import sys
from pathlib import Path
print(len(json.loads(Path(sys.argv[1]).read_text() or "[]")))
PY
)"

if [[ "$snapshot_count" -eq 0 ]]; then
  echo "FAIL no snapshots match the retention tag scope" >&2
  exit 1
fi

"${restic_base[@]}" forget \
  --dry-run \
  --json \
  --keep-daily "$RESTIC_KEEP_DAILY" \
  --keep-weekly "$RESTIC_KEEP_WEEKLY" \
  "${tag_args[@]}" >"$forget_file"

python3 - "$forget_file" "$RESTIC_KEEP_DAILY" "$RESTIC_KEEP_WEEKLY" <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

data = json.loads(Path(sys.argv[1]).read_text() or "[]")
keep_daily = sys.argv[2]
keep_weekly = sys.argv[3]

if isinstance(data, dict):
    groups = data.get("groups") or [data]
elif isinstance(data, list):
    groups = data
else:
    groups = []

keep = 0
remove = 0
for group in groups:
    if not isinstance(group, dict):
        continue
    keep += len(group.get("keep") or [])
    remove += len(group.get("remove") or [])

print("Retention policy dry-run only")
print(f"Policy: keep-daily={keep_daily}, keep-weekly={keep_weekly}")
print(f"Snapshots that would be kept: {keep}")
print(f"Snapshots that would be forgotten: {remove}")
print("Nothing deleted: yes")
print("Prune executed: no")
PY
