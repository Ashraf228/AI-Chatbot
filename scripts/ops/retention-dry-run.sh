#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
BACKUP_PREFIX="${BACKUP_PREFIX:-backup_postgres}"

CONVERSATION_RETENTION_DAYS="${CONVERSATION_RETENTION_DAYS:-180}"
LEAD_RETENTION_DAYS="${LEAD_RETENTION_DAYS:-180}"
JOB_RETENTION_DAYS="${JOB_RETENTION_DAYS:-90}"
AUDIT_RETENTION_DAYS="${AUDIT_RETENTION_DAYS:-180}"
REPORT_RETENTION_DAYS="${REPORT_RETENTION_DAYS:-365}"
USAGE_REVIEW_DAYS="${USAGE_REVIEW_DAYS:-365}"
LOCAL_BACKUP_RETENTION_DAYS="${LOCAL_BACKUP_RETENTION_DAYS:-14}"

is_positive_int() {
  [[ "${1:-}" =~ ^[0-9]+$ ]] && [[ "$1" -gt 0 ]]
}

for value in \
  "$CONVERSATION_RETENTION_DAYS" \
  "$LEAD_RETENTION_DAYS" \
  "$JOB_RETENTION_DAYS" \
  "$AUDIT_RETENTION_DAYS" \
  "$REPORT_RETENTION_DAYS" \
  "$USAGE_REVIEW_DAYS" \
  "$LOCAL_BACKUP_RETENTION_DAYS"; do
  if ! is_positive_int "$value"; then
    echo "Invalid retention threshold" >&2
    exit 1
  fi
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

configured_cleanup="$(
  awk -F= '
    $1 == "RETENTION_CLEANUP_ENABLED" {
      value=$2
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)
      gsub(/^["'\'']|["'\'']$/, "", value)
      print tolower(value)
    }
  ' "$ENV_FILE" | tail -n 1
)"

automatic_cleanup_active="no"
if [[ "$configured_cleanup" == "true" ]]; then
  automatic_cleanup_active="yes"
fi

compose() {
  docker compose --project-directory "$PROJECT_DIR" --env-file "$ENV_FILE" "$@"
}

printf 'area|suggested_retention|candidate_count|total_count|automatic_cleanup_active|cleanup_status|notes\n'

compose exec -T db sh -lc 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB" -At -F "|"' <<SQL
WITH
conversation_candidates AS (
  SELECT c.id, c.site_id
  FROM conversations c
  WHERE c.last_active_at < now() - interval '$CONVERSATION_RETENTION_DAYS days'
),
lead_candidates AS (
  SELECT l.id, l.site_id
  FROM widget_leads l
  WHERE l.created_at < now() - interval '$LEAD_RETENTION_DAYS days'
),
report_candidates AS (
  SELECT r.id, r.site_id
  FROM report_runs r
  WHERE r.created_at < now() - interval '$REPORT_RETENTION_DAYS days'
),
email_job_candidates AS (
  SELECT id
  FROM email_jobs
  WHERE created_at < now() - interval '$JOB_RETENTION_DAYS days'
),
webhook_job_candidates AS (
  SELECT id, site_id
  FROM webhook_jobs
  WHERE created_at < now() - interval '$JOB_RETENTION_DAYS days'
),
test_lead_candidates AS (
  SELECT id
  FROM widget_leads
  WHERE upper(
    COALESCE(name, '') || ' ' ||
    COALESCE(email, '') || ' ' ||
    COALESCE(phone, '') || ' ' ||
    COALESCE(message, '')
  ) LIKE '%TEST%'
)
SELECT 'conversations',
       '30-180 days proposal; dry-run threshold ${CONVERSATION_RETENTION_DAYS}d',
       (SELECT count(*) FROM conversation_candidates),
       (SELECT count(*) FROM conversations),
       '$automatic_cleanup_active',
       'requires guarded RetentionService and RETENTION_CLEANUP_ENABLED=true',
       'site-scoped via conversations.site_id; messages cascade by FK'
UNION ALL
SELECT 'messages',
       'same as conversations; dry-run threshold ${CONVERSATION_RETENTION_DAYS}d',
       (SELECT count(*) FROM messages m JOIN conversation_candidates c ON c.id = m.conversation_id),
       (SELECT count(*) FROM messages),
       '$automatic_cleanup_active',
       'covered indirectly when expired conversations are deleted',
       'scope inherited through conversation_id'
UNION ALL
SELECT 'widget_leads',
       '90-180 days proposal; dry-run threshold ${LEAD_RETENTION_DAYS}d',
       (SELECT count(*) FROM lead_candidates),
       (SELECT count(*) FROM widget_leads),
       '$automatic_cleanup_active',
       'requires guarded RetentionService and RETENTION_CLEANUP_ENABLED=true',
       'site-scoped via widget_leads.site_id'
UNION ALL
SELECT 'report_runs',
       'site-config/default 365d; dry-run threshold ${REPORT_RETENTION_DAYS}d',
       (SELECT count(*) FROM report_candidates),
       (SELECT count(*) FROM report_runs),
       '$automatic_cleanup_active',
       'requires guarded RetentionService and RETENTION_CLEANUP_ENABLED=true',
       'site-scoped via report_runs.site_id'
UNION ALL
SELECT 'email_jobs',
       '30-90 days proposal; dry-run threshold ${JOB_RETENTION_DAYS}d',
       (SELECT count(*) FROM email_job_candidates),
       (SELECT count(*) FROM email_jobs),
       'no',
       'not covered by automatic retention',
       'global table without site_id; cleanup needs separate policy'
UNION ALL
SELECT 'webhook_jobs',
       '30-90 days proposal; dry-run threshold ${JOB_RETENTION_DAYS}d',
       (SELECT count(*) FROM webhook_job_candidates),
       (SELECT count(*) FROM webhook_jobs),
       'no',
       'not covered by automatic retention',
       'site-scoped via webhook_jobs.site_id'
UNION ALL
SELECT 'agent_contact_requests',
       'treat like leads; dry-run threshold ${LEAD_RETENTION_DAYS}d',
       (SELECT count(*) FROM agent_contact_requests WHERE created_at < now() - interval '$LEAD_RETENTION_DAYS days'),
       (SELECT count(*) FROM agent_contact_requests),
       'no',
       'not covered by automatic retention',
       'site-scoped via agent_contact_requests.site_id'
UNION ALL
SELECT 'agent_tickets',
       'support retention to define; dry-run threshold ${LEAD_RETENTION_DAYS}d',
       (SELECT count(*) FROM agent_tickets WHERE created_at < now() - interval '$LEAD_RETENTION_DAYS days'),
       (SELECT count(*) FROM agent_tickets),
       'no',
       'not covered by automatic retention',
       'site-scoped via agent_tickets.site_id'
UNION ALL
SELECT 'audit_logs',
       'policy target 180d; dry-run threshold ${AUDIT_RETENTION_DAYS}d',
       (SELECT count(*) FROM audit_logs WHERE created_at < now() - interval '$AUDIT_RETENTION_DAYS days'),
       (SELECT count(*) FROM audit_logs),
       'no',
       'not covered by automatic retention',
       'site_id and tenant_id present; do not delete before legal review'
UNION ALL
SELECT 'usage_daily',
       'contract/tax review; dry-run review threshold ${USAGE_REVIEW_DAYS}d',
       (SELECT count(*) FROM usage_daily WHERE day < current_date - ${USAGE_REVIEW_DAYS}),
       (SELECT count(*) FROM usage_daily),
       'no',
       'not covered by automatic retention',
       'tenant_id and site_id present; avoid premature deletion'
UNION ALL
SELECT 'usage_events',
       'contract/tax review; dry-run review threshold ${USAGE_REVIEW_DAYS}d',
       (SELECT count(*) FROM usage_events WHERE created_at < now() - interval '$USAGE_REVIEW_DAYS days'),
       (SELECT count(*) FROM usage_events),
       'no',
       'not covered by automatic retention',
       'tenant_id and site_id present; avoid premature deletion'
UNION ALL
SELECT 'knowledge_sources',
       'keep while customer/contract active',
       0,
       (SELECT count(*) FROM knowledge_sources),
       'no',
       'manual source/site delete only',
       'site_id and tenant_id present; contract-end process required'
UNION ALL
SELECT 'documents',
       'same as knowledge sources',
       0,
       (SELECT count(*) FROM documents),
       'no',
       'manual source/site delete only',
       'site_id and tenant_id present; chunks cascade by FK'
UNION ALL
SELECT 'chunks',
       'same as knowledge sources',
       0,
       (SELECT count(*) FROM chunks),
       'no',
       'manual source/site delete only',
       'site_id and tenant_id present; do not age-delete without customer policy'
UNION ALL
SELECT 'widget_sessions',
       'review with conversations; dry-run threshold ${CONVERSATION_RETENTION_DAYS}d',
       (SELECT count(*) FROM widget_sessions WHERE last_seen_at < now() - interval '$CONVERSATION_RETENTION_DAYS days'),
       (SELECT count(*) FROM widget_sessions),
       'no',
       'not covered by automatic retention',
       'site-scoped via widget_sessions.site_id'
UNION ALL
SELECT 'widget_events',
       'technical/event retention to define; dry-run threshold ${CONVERSATION_RETENTION_DAYS}d',
       (SELECT count(*) FROM widget_events WHERE created_at < now() - interval '$CONVERSATION_RETENTION_DAYS days'),
       (SELECT count(*) FROM widget_events),
       'no',
       'not covered by automatic retention',
       'site-scoped via widget_events.site_id'
UNION ALL
SELECT 'test_marked_widget_leads',
       'delete promptly or keep clearly marked',
       (SELECT count(*) FROM test_lead_candidates),
       (SELECT count(*) FROM widget_leads),
       'no',
       'manual review/delete only',
       'count only; rows matching TEST marker in lead fields';
SQL

backup_total=0
backup_candidates=0
if [[ -d "$BACKUP_DIR" ]]; then
  backup_total="$(find "$BACKUP_DIR" -type f -name "${BACKUP_PREFIX}_*.sql.gz" | wc -l | tr -d ' ')"
  backup_candidates="$(find "$BACKUP_DIR" -type f -name "${BACKUP_PREFIX}_*.sql.gz" -mtime +"$LOCAL_BACKUP_RETENTION_DAYS" | wc -l | tr -d ' ')"
fi

printf '%s|%s|%s|%s|%s|%s|%s\n' \
  "local_db_backups" \
  "active local retention ${LOCAL_BACKUP_RETENTION_DAYS}d" \
  "$backup_candidates" \
  "$backup_total" \
  "yes" \
  "backup-postgres.sh deletes matching old backup files during backup runs" \
  "filesystem count only; no files deleted by this dry-run"

printf '%s|%s|%s|%s|%s|%s|%s\n' \
  "offsite_restic_snapshots" \
  "proposal 14 daily + 4 weekly after approval" \
  "not_checked" \
  "not_checked" \
  "no" \
  "prune not active" \
  "use check-offsite-backup.sh for freshness; retention/prune requires separate approval"
