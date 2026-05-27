#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
OLD_PENDING_MINUTES="${JOB_OLD_PENDING_MINUTES:-30}"
FAILED_WINDOW_HOURS="${JOB_FAILED_WINDOW_HOURS:-24}"
FAILED_WARN_COUNT="${JOB_FAILED_WARN_COUNT:-1}"
FAILED_FAIL_COUNT="${JOB_FAILED_FAIL_COUNT:-10}"

warns=0
fails=0

line() {
  printf '%s %s\n' "$1" "$2"
}

warn() {
  warns=$((warns + 1))
  line "WARN" "$1"
}

fail() {
  fails=$((fails + 1))
  line "FAIL" "$1"
}

ok() {
  line "OK" "$1"
}

is_non_negative_int() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

for value in "$OLD_PENDING_MINUTES" "$FAILED_WINDOW_HOURS" "$FAILED_WARN_COUNT" "$FAILED_FAIL_COUNT"; do
  if ! is_non_negative_int "$value"; then
    fail "Invalid numeric threshold"
    exit 1
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  fail "Missing env file: $ENV_FILE"
  exit 1
fi

compose() {
  docker compose --project-directory "$PROJECT_DIR" --env-file "$ENV_FILE" "$@"
}

query_output="$(
  compose exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -At -F "|"' <<SQL
WITH config AS (
  SELECT
    interval '$OLD_PENDING_MINUTES minutes' AS old_pending_age,
    interval '$FAILED_WINDOW_HOURS hours' AS failed_window
),
email AS (
  SELECT
    CASE WHEN to_regclass('public.email_jobs') IS NULL THEN 0 ELSE (
      SELECT count(*) FROM email_jobs, config
      WHERE status IN ('queued', 'pending', 'retrying')
        AND COALESCE(available_at, created_at) < now() - config.old_pending_age
    ) END AS old_pending,
    CASE WHEN to_regclass('public.email_jobs') IS NULL THEN 0 ELSE (
      SELECT count(*) FROM email_jobs, config
      WHERE status = 'failed'
        AND COALESCE(updated_at, created_at) >= now() - config.failed_window
    ) END AS recent_failed
),
webhook AS (
  SELECT
    CASE WHEN to_regclass('public.webhook_jobs') IS NULL THEN 0 ELSE (
      SELECT count(*) FROM webhook_jobs, config
      WHERE status IN ('queued', 'pending', 'retrying')
        AND COALESCE(available_at, created_at) < now() - config.old_pending_age
    ) END AS old_pending,
    CASE WHEN to_regclass('public.webhook_jobs') IS NULL THEN 0 ELSE (
      SELECT count(*) FROM webhook_jobs, config
      WHERE status = 'failed'
        AND COALESCE(updated_at, created_at) >= now() - config.failed_window
    ) END AS recent_failed
)
SELECT 'email_jobs_old_pending', old_pending FROM email
UNION ALL SELECT 'email_jobs_recent_failed', recent_failed FROM email
UNION ALL SELECT 'webhook_jobs_old_pending', old_pending FROM webhook
UNION ALL SELECT 'webhook_jobs_recent_failed', recent_failed FROM webhook;
SQL
)"

while IFS='|' read -r metric count; do
  [[ -z "$metric" ]] && continue
  count="${count:-0}"

  case "$metric" in
    *_old_pending)
      if [[ "$count" -gt 0 ]]; then
        fail "$metric=$count older_than=${OLD_PENDING_MINUTES}m"
      else
        ok "$metric=0"
      fi
      ;;
    *_recent_failed)
      if [[ "$count" -ge "$FAILED_FAIL_COUNT" ]]; then
        fail "$metric=$count window=${FAILED_WINDOW_HOURS}h"
      elif [[ "$count" -ge "$FAILED_WARN_COUNT" ]]; then
        warn "$metric=$count window=${FAILED_WINDOW_HOURS}h"
      else
        ok "$metric=0"
      fi
      ;;
    *)
      warn "Unknown metric: $metric=$count"
      ;;
  esac
done <<< "$query_output"

if [[ "$fails" -gt 0 ]]; then
  exit 1
fi

if [[ "$warns" -gt 0 ]]; then
  exit 2
fi

exit 0
