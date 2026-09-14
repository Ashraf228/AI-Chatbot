# Site-Runtime LLM Generation Grant Schema Contract

Migration `033_site_runtime_llm_generation_grant_contract.sql` extends the
database contract for `provider_approval_grants` without wiring an LLM runtime.
It permits a second exact `site_runtime` pair:

- `purpose = query_embedding` with `usage_contexts = ["query_embedding"]`;
- `purpose = llm_generation` with `usage_contexts = ["llm_generation"]`.

The existing source-scope constraint still requires `source_id IS NULL` and an
empty `source_types` array for both pairs. Query embedding and LLM generation are
separate permissions: a row for one purpose does not authorize the other.

## Migration Audit

Migration 033 performs no `INSERT`, `UPDATE`, or `DELETE`. It validates existing
site-runtime purpose/usage pairs and overlapping active LLM-generation windows
before replacing the query-only purpose and usage checks. It preserves the
query-embedding exclusion constraint from migration 032 and adds a second
partial exclusion constraint for active LLM-generation rows.

Both exclusion constraints bind `tenant_id`, `site_id`, `provider_key`, `model`,
and `environment`. They use half-open validity ranges, so adjacent windows are
allowed and overlapping windows for the same purpose are rejected. A query grant
and an LLM grant may coexist for the same binding because their purposes differ.

The production migration runner executes the migration SQL and its
`schema_migrations` entry in one transaction. A failed validation or constraint
creation therefore leaves no migration-033 tracking row or partial 033
constraint. `ALTER TABLE` requires an appropriate maintenance window and can
wait for concurrent table users.

## Preflight and Migration Plan

Operational use requires a separate database-change approval. Before that
change, run `scripts/ops/site-runtime-grant-preflight.sql` in a read-only
transaction and require every count to be zero. The preflight reports only
technical counts; it does not select tenant, site, grant, or evidence values.

The approved migration procedure must:

1. confirm the intended database, backup/restore point, migration runner build,
   and required `ALTER TABLE` privileges;
2. stop or fence grant writers for the migration window;
3. run the read-only preflight and resolve any non-zero count under a separate
   data-change authorization;
4. apply the immutable migration through the production migration runner;
5. verify migration tracking and all query/LLM purpose, usage, and overlap
   constraints before any later runtime phase is considered.

This repository package does not perform those operational steps.

## Backfill

No backfill is required. Migration 032 admits only query-embedding
`site_runtime` rows, and migration 033 neither creates LLM grants nor
reinterprets an existing row. Existing valid query grants remain unchanged.
Any incompatible historical row blocks the migration rather than being repaired
or coerced automatically.

## Rollback and Forward Recovery

The migration runner has no down-migration path. Do not edit or delete the
historical `schema_migrations` entry and do not rewrite migration 033 after it has
been applied.

Schema rollback requires a separately reviewed forward-recovery migration. It
must first stop LLM-grant writers and prove that no `llm_generation` row remains,
including revoked rows. Removal or retention decisions for such rows require a
separate data-change and restore plan; rows must never be converted into query
grants. The forward-recovery migration can then atomically drop the LLM overlap
constraint and restore the query-only purpose and usage checks under its own new
migration number.

Application/runtime rollback is a separate concern. This schema split does not
contain an LLM provider client, runtime authorization lookup, transport, grant
writer, provisioning path, or activation. A later Phase 3 package must enforce a
fresh persisted LLM-generation grant at every provider boundary before the new
schema capability can be used.

This migration and its tests are not a staging, production, provider,
public-widget, enterprise, pilot, or runtime activation approval.
