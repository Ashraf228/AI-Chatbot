const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function getMigrationFile() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const file = fs
    .readdirSync(migrationsDir)
    .find((entry) => /provider_approval_storage_schema\.sql$/i.test(entry));

  assert.ok(file, 'expected provider approval storage migration file');
  return path.join(migrationsDir, file);
}

function getSql() {
  return fs.readFileSync(getMigrationFile(), 'utf8');
}

test('provider approval storage migration file exists with expected name', () => {
  const file = getMigrationFile();
  assert.match(path.basename(file), /^030_provider_approval_storage_schema\.sql$/);
});

test('migration defines provider approval grants and audit tables', () => {
  const sql = getSql();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS provider_approval_grants/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS provider_approval_audit_events/i);
});

test('migration includes required grant scope, policy, timing, and auditability fields', () => {
  const sql = getSql();
  const requiredPatterns = [
    /\btenant_id TEXT NOT NULL\b/i,
    /\bsite_id TEXT NOT NULL\b/i,
    /\bsource_id TEXT\b/i,
    /\bsource_types JSONB NOT NULL DEFAULT '\[\]'::jsonb\b/i,
    /\busage_contexts JSONB NOT NULL DEFAULT '\[\]'::jsonb\b/i,
    /\benvironment TEXT NOT NULL\b/i,
    /\bprovider_key TEXT NOT NULL\b/i,
    /\bmodel TEXT NOT NULL\b/i,
    /\bembedding_dimension INTEGER\b/i,
    /\bprovider_region TEXT\b/i,
    /\bdata_categories JSONB NOT NULL DEFAULT '\[\]'::jsonb\b/i,
    /\bcustomer_data_approved BOOLEAN NOT NULL DEFAULT false\b/i,
    /\bproduction_approved BOOLEAN NOT NULL DEFAULT false\b/i,
    /\bprovider_dpa_approved BOOLEAN NOT NULL DEFAULT false\b/i,
    /\bpurpose TEXT NOT NULL\b/i,
    /\bretention_policy TEXT NOT NULL\b/i,
    /\bredaction_policy TEXT NOT NULL\b/i,
    /\blogging_policy TEXT NOT NULL\b/i,
    /\bdeletion_policy TEXT NOT NULL\b/i,
    /\breindex_policy TEXT\b/i,
    /\brate_limit TEXT NOT NULL\b/i,
    /\bcost_limit TEXT NOT NULL\b/i,
    /\bvalid_from TIMESTAMPTZ NOT NULL\b/i,
    /\bexpires_at TIMESTAMPTZ NOT NULL\b/i,
    /\brevoked_at TIMESTAMPTZ\b/i,
    /\brevoked_by TEXT\b/i,
    /\brevocation_reason TEXT\b/i,
    /\bapproved_by TEXT NOT NULL\b/i,
    /\bapproval_evidence_ref TEXT NOT NULL\b/i,
    /created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/i,
    /updated_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/i,
  ];

  for (const pattern of requiredPatterns) {
    assert.match(sql, pattern);
  }
});

test('migration keeps approval defaults deny-first and enforces expiry and revocation checks', () => {
  const sql = getSql();
  assert.match(sql, /customer_data_approved BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(sql, /production_approved BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(sql, /provider_dpa_approved BOOLEAN NOT NULL DEFAULT false/i);
  assert.match(sql, /expires_at > valid_from/i);
  assert.match(sql, /revoked_at IS NULL[\s\S]*revoked_by IS NULL[\s\S]*revocation_reason IS NULL/i);
  assert.match(sql, /revoked_at IS NOT NULL[\s\S]*revoked_by IS NOT NULL[\s\S]*revocation_reason IS NOT NULL/i);
});

test('migration adds required indexes for tenant site active lookup and audit correlation', () => {
  const sql = getSql();
  const indexPatterns = [
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_tenant_site_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_tenant_site_source_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_active_lookup_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_revoked_lookup_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_expiry_lookup_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_provider_model_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_grants_evidence_ref_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_tenant_site_time_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_grant_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_type_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_request_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_correlation_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_source_idx/i,
    /CREATE INDEX IF NOT EXISTS provider_approval_audit_events_provider_model_idx/i,
  ];

  for (const pattern of indexPatterns) {
    assert.match(sql, pattern);
  }
});

test('migration contains required audit fields and event types', () => {
  const sql = getSql();
  const requiredPatterns = [
    /\bapproval_grant_id TEXT\b/i,
    /\bactor_id TEXT NOT NULL\b/i,
    /\bactor_role TEXT NOT NULL\b/i,
    /\bevent_type TEXT NOT NULL\b/i,
    /\bdecision_code TEXT NOT NULL\b/i,
    /\busage_context TEXT NOT NULL\b/i,
    /\bsanitized_reason TEXT NOT NULL\b/i,
    /\brequest_id TEXT\b/i,
    /\bcorrelation_id TEXT\b/i,
    /approval_created/i,
    /approval_updated/i,
    /approval_revoked/i,
    /approval_expired/i,
    /approval_checked/i,
    /approval_denied/i,
    /provider_call_blocked/i,
    /embedding_job_requested/i,
    /embedding_job_started/i,
    /embedding_job_blocked/i,
    /embedding_job_completed/i,
    /embedding_job_failed/i,
  ];

  for (const pattern of requiredPatterns) {
    assert.match(sql, pattern);
  }
});

test('migration does not contain destructive SQL, seeded data, or secret-like columns', () => {
  const sql = getSql();
  const forbiddenPatterns = [
    /\bDROP TABLE\b/i,
    /\bTRUNCATE\b/i,
    /\bINSERT INTO\b/i,
    /\bapi_key\b/i,
    /\bsecret\b/i,
    /\bpassword\b/i,
    /\bcredential\b/i,
    /\baccess_token\b/i,
    /\brefresh_token\b/i,
    /\btoken\b/i,
  ];

  for (const pattern of forbiddenPatterns) {
    assert.doesNotMatch(sql, pattern);
  }
});
