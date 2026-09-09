# Site-Runtime Grant Concurrency

Migration `032_site_runtime_grant_concurrency.sql` adds database invariants for
`provider_approval_grants` rows with `scope_kind = 'site_runtime'`. It does not
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

For `site_runtime`, `purpose` must be exactly `query_embedding`; the existing
scope checks also require `source_id IS NULL`, empty `source_types`, and exactly
`["query_embedding"]` in `usage_contexts`.

The partial exclusion constraint applies only to non-revoked site-runtime
query-embedding rows. Its equality binding is `tenant_id`, `site_id`,
`provider_key`, `model`, and `environment`; `scope_kind` and `purpose` are
constant within the partial predicate. Validity uses `[valid_from, expires_at)`,
so adjacent windows are valid while overlapping windows are rejected.

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
indexes. Rollback removes the new data guarantees and is not a deployment,
provider, public-widget, or runtime activation approval.
