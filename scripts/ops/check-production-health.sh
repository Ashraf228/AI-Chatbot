#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"

API_HEALTH_URL="${API_HEALTH_URL:-https://api.soulesmartbusiness.com/healthz}"
DASHBOARD_HEALTH_URL="${DASHBOARD_HEALTH_URL:-https://app.soulesmartbusiness.com/healthz}"
DASHBOARD_URL="${DASHBOARD_URL:-https://app.soulesmartbusiness.com/login}"
WIDGET_LOADER_URL="${WIDGET_LOADER_URL:-https://widget.soulesmartbusiness.com/loader.js}"
WIDGET_VERSION_URL="${WIDGET_VERSION_URL:-https://widget.soulesmartbusiness.com/version.json}"
WIDGET_CONFIG_BASE_URL="${WIDGET_CONFIG_BASE_URL:-https://widget.soulesmartbusiness.com/widget/config}"
PRIVACY_URL="${PRIVACY_URL:-https://www.rohrreinigung-ffm24.de/datenschutz}"
EXPECTED_SERVICES="${EXPECTED_SERVICES:-api dashboard widget proxy db redis}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
DISK_FAIL_PERCENT="${DISK_FAIL_PERCENT:-90}"
LOG_SCAN_SINCE="${LOG_SCAN_SINCE:-30m}"
LOG_SCAN_PATTERN="${LOG_SCAN_PATTERN:-error|exception|failed|fatal}"
RUN_LOG_SCAN="${RUN_LOG_SCAN:-true}"
BACKUP_HEALTH_SCRIPT="${BACKUP_HEALTH_SCRIPT:-$SCRIPT_DIR/check-last-backup.sh}"
OFFSITE_HEALTH_SCRIPT="${OFFSITE_HEALTH_SCRIPT:-$SCRIPT_DIR/check-offsite-backup.sh}"
JOB_HEALTH_SCRIPT="${JOB_HEALTH_SCRIPT:-$SCRIPT_DIR/check-job-health.sh}"

warns=0
fails=0

line() {
  printf '%s %s\n' "$1" "$2"
}

ok() {
  line "OK" "$1"
}

warn() {
  warns=$((warns + 1))
  line "WARN" "$1"
}

fail() {
  fails=$((fails + 1))
  line "FAIL" "$1"
}

json_field() {
  local body_file="$1"
  local field_name="$2"

  node -e "const fs = require('fs'); const key = process.argv[2]; try { const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const value = data?.[key]; if (typeof value === 'string' || typeof value === 'boolean') process.stdout.write(String(value)); } catch {}" "$body_file" "$field_name"
}

site_key_from_url() {
  local url="$1"

  node -e "try { const value = new URL(process.argv[1]).searchParams.get('siteKey'); if (value) process.stdout.write(value); } catch {}" "$url"
}

build_widget_config_url() {
  local base_url="$1"
  local site_key="$2"

  node -e "const url = new URL(process.argv[1]); url.searchParams.set('siteKey', process.argv[2]); process.stdout.write(url.toString());" "$base_url" "$site_key"
}

is_non_negative_int() {
  [[ "${1:-}" =~ ^[0-9]+$ ]]
}

for value in "$DISK_WARN_PERCENT" "$DISK_FAIL_PERCENT"; do
  if ! is_non_negative_int "$value"; then
    fail "Invalid disk threshold"
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

http_body() {
  local url="$1"
  local output_file="$2"
  local http_code
  http_code="$(curl -fsS -L --max-time 15 -o "$output_file" -w '%{http_code}' "$url" 2>/dev/null || true)"
  printf '%s' "$http_code"
}

check_http_status() {
  local label="$1"
  local url="$2"
  local body_file
  local code
  body_file="$(mktemp)"
  code="$(http_body "$url" "$body_file")"

  if [[ "$code" == "200" ]]; then
    ok "$label http=200"
  else
    fail "$label http=${code:-request_failed}"
  fi

  rm -f "$body_file"
}

api_body_file="$(mktemp)"
api_code="$(http_body "$API_HEALTH_URL" "$api_body_file")"
if [[ "$api_code" == "200" ]] &&
  grep -q '"status":"ok"' "$api_body_file" &&
  grep -q '"database":"ok"' "$api_body_file" &&
  grep -q '"redis":"ok"' "$api_body_file"; then
  ok "api health database=ok redis=ok"
else
  fail "api health invalid http=${api_code:-request_failed}"
fi
api_commit="$(
  node -e "const fs = require('fs'); try { const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); if (typeof data.commit === 'string') process.stdout.write(data.commit); } catch {}" "$api_body_file"
)"
if [[ -z "$api_commit" ]]; then
  warn "api health commit missing"
elif [[ "$api_commit" == "unknown" ]]; then
  warn "api health commit=unknown"
else
  ok "apiRuntimeCommit=$api_commit"
fi
rm -f "$api_body_file"

server_repo_commit="$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)"
if [[ -n "$server_repo_commit" ]]; then
  ok "serverRepoCommit=$server_repo_commit"
else
  warn "serverRepoCommit unavailable"
fi

dashboard_health_body_file="$(mktemp)"
dashboard_health_code="$(http_body "$DASHBOARD_HEALTH_URL" "$dashboard_health_body_file")"
dashboard_commit="$(
  node -e "const fs = require('fs'); try { const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); if (typeof data.commit === 'string') process.stdout.write(data.commit); } catch {}" "$dashboard_health_body_file"
)"
if [[ "$dashboard_health_code" != "200" ]]; then
  fail "dashboard health http=${dashboard_health_code:-request_failed}"
elif [[ -z "$dashboard_commit" ]]; then
  warn "dashboardBuildCommit missing"
elif [[ "$dashboard_commit" == "unknown" ]]; then
  warn "dashboardBuildCommit=unknown"
else
  ok "dashboardBuildCommit=$dashboard_commit"
fi
rm -f "$dashboard_health_body_file"

check_http_status "dashboard login" "$DASHBOARD_URL"
check_http_status "widget loader" "$WIDGET_LOADER_URL"

widget_version_body_file="$(mktemp)"
widget_version_code="$(http_body "$WIDGET_VERSION_URL" "$widget_version_body_file")"
widget_commit="$(
  node -e "const fs = require('fs'); try { const data = JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); if (typeof data.commit === 'string') process.stdout.write(data.commit); } catch {}" "$widget_version_body_file"
)"
if [[ "$widget_version_code" != "200" ]]; then
  warn "widget version http=${widget_version_code:-request_failed}"
elif [[ -z "$widget_commit" ]]; then
  warn "widgetBuildCommit missing"
elif [[ "$widget_commit" == "unknown" ]]; then
  warn "widgetBuildCommit=unknown"
else
  ok "widgetBuildCommit=$widget_commit"
fi
rm -f "$widget_version_body_file"

legacy_widget_site_key=""
if [[ -n "${WIDGET_CONFIG_URL:-}" ]]; then
  legacy_widget_site_key="$(site_key_from_url "$WIDGET_CONFIG_URL")"
fi

synthetic_widget_site_key="${PRODUCTION_HEALTH_SYNTHETIC_SITE_KEY:-${EXPECTED_WIDGET_SITE_KEY:-${legacy_widget_site_key:-production-health-synthetic}}}"
synthetic_widget_config_url="${WIDGET_CONFIG_URL:-$(build_widget_config_url "$WIDGET_CONFIG_BASE_URL" "$synthetic_widget_site_key")}"
synthetic_widget_request_site_key="$(site_key_from_url "$synthetic_widget_config_url")"

config_body_file="$(mktemp)"
config_code="$(http_body "$synthetic_widget_config_url" "$config_body_file")"
config_response_site_key="$(json_field "$config_body_file" "siteKey")"

config_reachable="no"
if [[ "$config_code" == "200" ]]; then
  config_reachable="yes"
fi

config_diag="expectedSiteKey=$synthetic_widget_site_key"
if [[ -n "$synthetic_widget_request_site_key" ]]; then
  config_diag="$config_diag requestSiteKey=$synthetic_widget_request_site_key"
fi
config_diag="$config_diag http=${config_code:-request_failed} reachable=$config_reachable"
if [[ -n "$config_response_site_key" ]]; then
  config_diag="$config_diag responseSiteKey=$config_response_site_key"
fi

if [[ -z "$synthetic_widget_request_site_key" ]]; then
  fail "synthetic widget config request missing siteKey $config_diag drift_hint=url_missing_siteKey"
elif [[ "$config_code" != "200" ]]; then
  if [[ "$config_code" == "404" ]]; then
    fail "synthetic widget config missing $config_diag drift_hint=missing_or_stale_synthetic_key"
  elif [[ "$config_code" == "403" ]]; then
    fail "synthetic widget config inactive $config_diag drift_hint=inactive_synthetic_key"
  else
    fail "synthetic widget config unreachable $config_diag"
  fi
elif [[ -z "$config_response_site_key" ]]; then
  fail "synthetic widget config response missing siteKey $config_diag drift_hint=invalid_or_unexpected_payload"
elif [[ "$synthetic_widget_request_site_key" != "$synthetic_widget_site_key" ]]; then
  fail "synthetic widget config request mismatch $config_diag drift_hint=url_or_env_mismatch"
elif [[ "$config_response_site_key" != "$synthetic_widget_site_key" ]]; then
  fail "synthetic widget config response mismatch $config_diag drift_hint=config_or_key_drift"
else
  ok "synthetic widget config siteKey=$synthetic_widget_site_key http=200 reachable=yes"
fi
rm -f "$config_body_file"

check_http_status "privacy url" "$PRIVACY_URL"

for service in $EXPECTED_SERVICES; do
  container_id="$(compose ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$container_id" ]]; then
    fail "container $service missing"
    continue
  fi

  state="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || true)"

  if [[ "$state" != "running" ]]; then
    fail "container $service state=${state:-unknown}"
  elif [[ "$health" != "healthy" && "$health" != "none" ]]; then
    fail "container $service health=$health"
  else
    ok "container $service state=running health=$health"
  fi
done

if "$BACKUP_HEALTH_SCRIPT"; then
  ok "backup freshness"
else
  fail "backup freshness"
fi

if [[ -x "$OFFSITE_HEALTH_SCRIPT" ]]; then
  if "$OFFSITE_HEALTH_SCRIPT"; then
    ok "offsite backup freshness"
  else
    offsite_exit=$?
    if [[ "$offsite_exit" -eq 2 ]]; then
      warn "offsite backup has warnings"
    else
      fail "offsite backup failed"
    fi
  fi
else
  fail "offsite backup health script missing"
fi

if "$JOB_HEALTH_SCRIPT"; then
  ok "job health"
else
  job_exit=$?
  if [[ "$job_exit" -eq 2 ]]; then
    warn "job health has warnings"
  else
    fail "job health failed"
  fi
fi

docker_root="$(docker info --format '{{.DockerRootDir}}' 2>/dev/null || true)"
disk_paths=("/" "$PROJECT_DIR")
if [[ -n "$docker_root" && -d "$docker_root" ]]; then
  disk_paths+=("$docker_root")
fi

seen_paths=" "
for path in "${disk_paths[@]}"; do
  [[ -d "$path" ]] || continue
  canonical_path="$(cd "$path" && pwd -P)"
  if [[ "$seen_paths" == *" $canonical_path "* ]]; then
    continue
  fi
  seen_paths="$seen_paths$canonical_path "

  usage="$(df -P "$canonical_path" | awk 'NR==2 { gsub("%", "", $5); print $5 }')"
  if [[ -z "$usage" ]]; then
    warn "disk $canonical_path usage_unknown"
  elif [[ "$usage" -ge "$DISK_FAIL_PERCENT" ]]; then
    fail "disk $canonical_path usage=${usage}%"
  elif [[ "$usage" -ge "$DISK_WARN_PERCENT" ]]; then
    warn "disk $canonical_path usage=${usage}%"
  else
    ok "disk $canonical_path usage=${usage}%"
  fi
done

if [[ "$RUN_LOG_SCAN" == "true" ]]; then
  log_matches="$(
    compose logs --since "$LOG_SCAN_SINCE" api widget proxy 2>/dev/null |
      grep -Eic "$LOG_SCAN_PATTERN" || true
  )"
  if [[ "${log_matches:-0}" -gt 0 ]]; then
    warn "recent logs contain $log_matches matching lines since=$LOG_SCAN_SINCE"
  else
    ok "recent logs no critical pattern since=$LOG_SCAN_SINCE"
  fi
fi

repo_commit="$(git -C "$PROJECT_DIR" rev-parse HEAD 2>/dev/null || true)"
if [[ -n "$repo_commit" ]]; then
  ok "repo commit=$repo_commit"
else
  warn "repo commit unavailable"
fi

if [[ "$fails" -gt 0 ]]; then
  exit 1
fi

if [[ "$warns" -gt 0 ]]; then
  exit 2
fi

exit 0
