# Site-Runtime Grant Concurrency

Migrations `032_site_runtime_grant_concurrency.sql` and
`033_site_runtime_llm_generation_grant_contract.sql` add database invariants for
`provider_approval_grants` rows with `scope_kind = 'site_runtime'`. They do not
create grants, activate a provider, or authorize runtime use.

## Preflight

Run the following against the intended database only after obtaining separate
operational approval. It returns technical counts and never selects tenant,
site, grant, or approval-evidence values:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f scripts/ops/site-runtime-grant-preflight.sql
```

All counts must be zero. The migration repeats the same material checks inside
its transaction, so a previously clean manual preflight is not a substitute for
the migration's own validation.

## Database Contract

Migration 032 initially constrained `site_runtime` to `query_embedding`.
Migration 033 adds the separate exact pair `purpose = llm_generation` and
`usage_contexts = ["llm_generation"]`. The query-embedding pair remains exact and
unchanged. Both purposes require `source_id IS NULL` and empty `source_types`;
neither purpose authorizes the other.

Separate partial exclusion constraints apply to non-revoked query-embedding and
LLM-generation rows. Their equality binding is `tenant_id`, `site_id`,
`provider_key`, `model`, and `environment`; validity uses
`[valid_from, expires_at)`, so adjacent windows are valid while overlapping
windows for the same purpose are rejected. A query-embedding grant and an LLM
generation grant can coexist because they authorize different provider uses.

## Operational Requirements

`btree_gist` and the required `CREATE EXTENSION` and `ALTER TABLE` privileges
must be available. Constraint construction can take a table lock and should be
scheduled accordingly. Missing privileges or conflicting existing rows abort the
migration atomically: no tracking entry and no partial constraint remain.

## Disposable Verification

Only run the PostgreSQL 16 test against a self-created disposable container:

```sh
POSTGRES16_SITE_RUNTIME_GRANT_CONCURRENCY_TEST=1 \
node --test apps/api/test/site-runtime-grant-concurrency.postgres16.test.cjs
```

The suite covers purpose, source/usage scope, interval overlap, concurrent
writers, rollback, and migration retry behavior using synthetic data.

## Rollback

Test rollback only in a disposable database. To remove the guarantees, drop the
two constraints introduced by migration 032:

```sql
ALTER TABLE provider_approval_grants
  DROP CONSTRAINT provider_approval_grants_site_runtime_no_overlap;
ALTER TABLE provider_approval_grants
  DROP CONSTRAINT provider_approval_grants_site_runtime_purpose_check;
```

Manual constraint removal does not remove migration 032 from `schema_migrations`.
The normal migration runner therefore skips the still-tracked migration and does
not recreate the constraints on a later run. Never delete or otherwise modify
the `schema_migrations` entry blindly, and never rewrite an already applied
migration 032.

Restoring the guarantees requires a separately approved forward-recovery
migration with the next free migration number. That recovery must inspect the
actual schema and data, fail closed on conflicting existing grants, and recreate
the guarantees together with its own tracking entry in one transaction. It must
not automatically clean up, merge, or revoke grants. Until that recovery and its
verification succeed, provisioning and activation must not rely on the removed
database guarantees.

Do not blindly remove `btree_gist`: it can be shared by other constraints or
indexes.

To roll back migration 033, first prove that no row with
`purpose = 'llm_generation'` remains, including revoked rows. Do not reinterpret
such rows as query-embedding grants. Then a separately reviewed forward-recovery
migration may drop `provider_approval_grants_site_runtime_llm_no_overlap` and
restore the query-only purpose and usage checks. The migration runner has no
down-migration path, so never edit `schema_migrations` or alter these constraints
manually on an operational database.

Rollback removes the new data guarantees and is not a deployment, provider,
public-widget, or runtime activation approval.
