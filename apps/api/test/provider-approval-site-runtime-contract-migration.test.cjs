const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationsDir = path.join(__dirname, '..', 'migrations');

function readMigration(name) {
  return fs.readFileSync(path.join(migrationsDir, name), 'utf8');
}

test('site runtime concurrency migration uses the next free migration number', () => {
  const files = fs.readdirSync(migrationsDir).filter((entry) => /^\d+_.*\.sql$/i.test(entry)).sort();
  assert.equal(files.at(-1), '032_site_runtime_grant_concurrency.sql');
});

test('032 migration validates site-runtime purpose and prevents overlapping active windows', () => {
  const sql = readMigration('032_site_runtime_grant_concurrency.sql');
  assert.match(sql, /CREATE EXTENSION IF NOT EXISTS btree_gist/i);
  assert.match(sql, /purpose IS DISTINCT FROM 'query_embedding'/i);
  assert.match(sql, /provider_approval_grants_site_runtime_purpose_check/i);
  assert.match(sql, /EXCLUDE USING gist/i);
  assert.match(sql, /tstzrange\(valid_from, expires_at, '\[\)'\) WITH &&/i);
  assert.match(sql, /revoked_at IS NULL/i);
  assert.match(sql, /scope_kind = 'site_runtime'/i);
  assert.match(sql, /purpose = 'query_embedding'/i);
});

test('historical provider approval storage migration remains unchanged at 030', () => {
  const sql = readMigration('030_provider_approval_storage_schema.sql');
  assert.match(sql, /provider_approval_grants_source_types_check/i);
  assert.match(sql, /jsonb_array_length\(source_types\) > 0/i);
  assert.doesNotMatch(sql, /\bscope_kind\b/i);
});

test('031 migration backfills scope_kind without upgrading any historical row to site_runtime', () => {
  const sql = readMigration('031_query_embedding_site_runtime_grant_contract.sql');
  assert.match(sql, /ADD COLUMN scope_kind TEXT/i);
  assert.match(sql, /WHEN source_id IS NOT NULL THEN 'source'/i);
  assert.match(sql, /ELSE 'source_type'/i);
  assert.doesNotMatch(sql, /SET scope_kind = 'site_runtime'/i);
});

test('031 migration replaces the global source_types non-empty constraint with scope-aware checks', () => {
  const sql = readMigration('031_query_embedding_site_runtime_grant_contract.sql');
  assert.match(sql, /DROP CONSTRAINT provider_approval_grants_source_types_check/i);
  assert.match(sql, /ADD CONSTRAINT provider_approval_grants_source_scope_check/i);
  assert.match(sql, /scope_kind = 'source'[\s\S]*jsonb_array_length\(source_types\) > 0/i);
  assert.match(sql, /scope_kind = 'source_type'[\s\S]*jsonb_array_length\(source_types\) > 0/i);
  assert.match(sql, /scope_kind = 'site_runtime'[\s\S]*source_types = '\[\]'::jsonb/i);
});

test('031 migration constrains site_runtime usage and adds a dedicated lookup index', () => {
  const sql = readMigration('031_query_embedding_site_runtime_grant_contract.sql');
  assert.match(sql, /provider_approval_grants_site_runtime_usage_check/i);
  assert.match(sql, /usage_contexts = '\["query_embedding"\]'::jsonb/i);
  assert.match(sql, /ALTER COLUMN scope_kind SET NOT NULL/i);
  assert.match(sql, /CREATE INDEX IF NOT EXISTS provider_approval_grants_site_runtime_lookup_idx/i);
  assert.match(sql, /scope_kind = 'site_runtime'/i);
});
