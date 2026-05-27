#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HEALTH_SCRIPT="${HEALTH_SCRIPT:-$SCRIPT_DIR/check-production-health.sh}"
NOTIFY_SCRIPT="${NOTIFY_SCRIPT:-$SCRIPT_DIR/notify-production-health-failure.sh}"
ALERT_STATE_DIR="${ALERT_STATE_DIR:-/var/lib/ai-chatbot-monitoring}"
ALERT_COOLDOWN_SECONDS="${ALERT_COOLDOWN_SECONDS:-3600}"
CHECK_NAME="${CHECK_NAME:-production-health}"

tmp_output="$(mktemp)"
cleanup() {
  rm -f "$tmp_output"
}
trap cleanup EXIT

set +e
"$HEALTH_SCRIPT" >"$tmp_output" 2>&1
health_exit=$?
set -e

cat "$tmp_output"

install -d -m 700 "$ALERT_STATE_DIR"

if [[ "$health_exit" -eq 0 ]]; then
  rm -f "$ALERT_STATE_DIR/$CHECK_NAME.last"
  exit 0
fi

status="FAIL"
if [[ "$health_exit" -eq 2 ]]; then
  status="WARN"
fi

now="$(date +%s)"
last_file="$ALERT_STATE_DIR/$CHECK_NAME.last"
last_sent="0"
if [[ -f "$last_file" ]]; then
  last_sent="$(cat "$last_file" 2>/dev/null || printf '0')"
fi

if [[ "$last_sent" =~ ^[0-9]+$ ]] && (( now - last_sent < ALERT_COOLDOWN_SECONDS )); then
  printf 'WARN alert suppressed by cooldown check=%s status=%s cooldown=%ss\n' "$CHECK_NAME" "$status" "$ALERT_COOLDOWN_SECONDS"
  exit "$health_exit"
fi

hint="$(head -n 20 "$tmp_output" | tr '\n' '; ' | cut -c1-1500)"
if CHECK_NAME="$CHECK_NAME" CHECK_STATUS="$status" CHECK_HINT="$hint" "$NOTIFY_SCRIPT"; then
  printf '%s' "$now" >"$last_file"
else
  printf 'FAIL alert notification failed check=%s status=%s\n' "$CHECK_NAME" "$status" >&2
fi

exit "$health_exit"
