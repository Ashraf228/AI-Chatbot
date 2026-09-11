#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
VALIDATION_SQL_FILE="${RESTORE_TEST_VALIDATION_SQL_FILE:-}"

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

if [[ -n "$VALIDATION_SQL_FILE" && ( ! -f "$VALIDATION_SQL_FILE" || ! -r "$VALIDATION_SQL_FILE" ) ]]; then
  echo "Restore validation SQL file is not readable: $VALIDATION_SQL_FILE" >&2
  exit 1
fi

RESTORE_DB="${RESTORE_TEST_DB:-restore_check_$(date -u +%Y%m%d_%H%M%S)}"
if [[ ! "$RESTORE_DB" =~ ^restore_check_[A-Za-z0-9_]+$ ]]; then
  echo "Refusing to restore into non-test database name: $RESTORE_DB" >&2
  exit 1
fi
if [[ ${#RESTORE_DB} -gt 63 ]]; then
  echo "Refusing restore database name longer than PostgreSQL's 63-byte identifier limit" >&2
  exit 1
fi

compose() {
  docker compose --project-directory "$PROJECT_DIR" --env-file "$ENV_FILE" "$@"
}

database_exists() {
  compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
    'psql -X -v ON_ERROR_STOP=1 -v "restore_db=$RESTORE_DB" -U "$POSTGRES_USER" --dbname="$POSTGRES_DB" -At' <<'SQL'
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM pg_database WHERE datname = :'restore_db'
) THEN 1 ELSE 0 END;
SQL
}

SOURCE_DB="$(compose exec -T db sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" --dbname="$POSTGRES_DB" -Atqc "SELECT current_database()"')"
SOURCE_DB="${SOURCE_DB//$'\r'/}"
if [[ -z "$SOURCE_DB" || "$SOURCE_DB" == *$'\n'* ]]; then
  echo "Could not determine the source database safely" >&2
  exit 1
fi
if [[ "$SOURCE_DB" == "$RESTORE_DB" ]]; then
  echo "Refusing to restore into the source database" >&2
  exit 1
fi

TARGET_EXISTS="$(database_exists)"
TARGET_EXISTS="${TARGET_EXISTS//$'\r'/}"
if [[ "$TARGET_EXISTS" != "0" ]]; then
  if [[ "$TARGET_EXISTS" == "1" ]]; then
    echo "Refusing to use an existing restore-test database: $RESTORE_DB" >&2
  else
    echo "Could not confirm that the restore-test database is absent" >&2
  fi
  exit 1
fi

restore_db_owned=false
cleanup_attempted=false

cleanup_owned_database() {
  if [[ "$restore_db_owned" != true || "$cleanup_attempted" == true ]]; then
    return 0
  fi

  cleanup_attempted=true
  if ! compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
    'dropdb -U "$POSTGRES_USER" -- "$RESTORE_DB"' >/dev/null; then
    echo "Failed to remove owned restore-test database: $RESTORE_DB" >&2
    return 1
  fi

  local target_exists
  if ! target_exists="$(database_exists)"; then
    echo "Could not verify removal of owned restore-test database: $RESTORE_DB" >&2
    return 1
  fi
  target_exists="${target_exists//$'\r'/}"
  if [[ "$target_exists" != "0" ]]; then
    echo "Owned restore-test database remains after cleanup: $RESTORE_DB" >&2
    return 1
  fi

  restore_db_owned=false
}

finish() {
  local primary_status=$?
  local cleanup_status=0
  trap - EXIT

  if [[ "$restore_db_owned" == true && "$cleanup_attempted" == false ]]; then
    cleanup_owned_database || cleanup_status=$?
  fi

  if [[ $primary_status -ne 0 ]]; then
    if [[ $cleanup_status -ne 0 ]]; then
      echo "Additional cleanup failure; the original restore-test failure remains primary" >&2
    fi
    exit "$primary_status"
  fi
  if [[ $cleanup_status -ne 0 ]]; then
    exit "$cleanup_status"
  fi

  if [[ -n "$VALIDATION_SQL_FILE" ]]; then
    echo "Restore test completed, validation passed, and temporary database removed: $RESTORE_DB"
  else
    echo "Restore test completed and temporary database removed: $RESTORE_DB"
    echo "No validation SQL file was supplied; restored data integrity was not independently verified"
  fi
}
trap finish EXIT

compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
  'createdb -U "$POSTGRES_USER" -- "$RESTORE_DB"'
restore_db_owned=true

gunzip -c "$BACKUP_FILE" | compose exec -T -e RESTORE_DB="$RESTORE_DB" db sh -lc \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" --dbname="$RESTORE_DB" >/dev/null'

if [[ -n "$VALIDATION_SQL_FILE" ]]; then
  compose exec -T -e RESTORE_DB="$RESTORE_DB" \
    -e 'PGOPTIONS=-c default_transaction_read_only=on' db sh -lc \
    'psql -X -1 -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" --dbname="$RESTORE_DB" >/dev/null' \
    < "$VALIDATION_SQL_FILE"
fi
