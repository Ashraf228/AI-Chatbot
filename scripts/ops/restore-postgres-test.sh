#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/backup.sql.gz" >&2
  exit 1
fi

BACKUP_FILE="$1"
if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

RESTORE_DB="${RESTORE_TEST_DB:-restore_check_$(date -u +%Y%m%d_%H%M%S)}"
if [[ ! "$RESTORE_DB" =~ ^restore_check_[A-Za-z0-9_]+$ ]]; then
  echo "Refusing to restore into non-test database name: $RESTORE_DB" >&2
  exit 1
fi

compose() {
  docker compose --project-directory "$PROJECT_DIR" --env-file "$ENV_FILE" "$@"
}

cleanup() {
  compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
    'dropdb -U "$POSTGRES_USER" --if-exists "$RESTORE_DB"' >/dev/null 2>&1 || true
}
trap cleanup EXIT

compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
  'createdb -U "$POSTGRES_USER" "$RESTORE_DB"'

gunzip -c "$BACKUP_FILE" | compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$RESTORE_DB" >/dev/null'

compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$RESTORE_DB" -At' <<'SQL'
SELECT 'schema_migrations', count(*) FROM schema_migrations
UNION ALL SELECT 'tenants', count(*) FROM tenants
UNION ALL SELECT 'sites', count(*) FROM sites
UNION ALL SELECT 'widget_leads', count(*) FROM widget_leads
UNION ALL SELECT 'conversations', count(*) FROM conversations
UNION ALL SELECT 'messages', count(*) FROM messages
UNION ALL SELECT 'knowledge_sources', count(*) FROM knowledge_sources
UNION ALL SELECT 'chunks', count(*) FROM chunks
UNION ALL SELECT 'tenant_subscriptions', count(*) FROM tenant_subscriptions
UNION ALL SELECT 'site_modules', count(*) FROM site_modules
UNION ALL SELECT 'integration_connections', count(*) FROM integration_connections
UNION ALL SELECT 'usage_daily', count(*) FROM usage_daily
UNION ALL SELECT 'email_jobs', count(*) FROM email_jobs
UNION ALL SELECT 'webhook_jobs', count(*) FROM webhook_jobs;
SELECT 'rohrreinigung_site', count(*) FROM sites WHERE site_key = 'rohrreinigung-ffm24';
SQL

echo "Restore test completed and temporary database removed: $RESTORE_DB"
