# Migration 034: LLM usage measurement schema

Change class: `DB_MIGRATION`. Phase 5 is schema-only. Phase 6 supplies the usage
writers, readers and dashboard. Merging this split does not deploy either phase,
run an operational migration, create provider grants or activate provider access.

## Provenance and scope

- Integration baseline: `70dbe3836725ad764799e211b123234cd4d5e36a` (Phase 4).
- Source package: `fd60ed429956dd6c1ae0b64bc4e99640ee12e44d`.
- Source ZIP SHA-256: `dd0e901031cc46ee5cf91e722a95da137af3acacc5f15999e483bf93282e88d2`.
- `034_llm_usage_measurement.sql` is byte-identical to the reviewed source:
  SHA-256 `fab3d3ccbb1bf142d0fdf4e375ceefa5cd99c53bf8af8dc92dc09a872902e309`, 1645 bytes, mode `100644`.
- The existing migration-number test adjustment is also copied unchanged from
  that package; it preserves 033's unique number without requiring it to be last.
- The independent schema checks and their integration into the existing isolated
  PostgreSQL CI script are new split deltas requiring independent review.
- No runtime, dependency, lockfile, workflow, authorization or grant changes.
  Phase-1 DELETE protection, migration 033, Phase-3 cleanup protection and Phase-4
  ingestion enforcement remain inherited from the baseline.

## Schema audit and compatibility

Only `usage_events` changes: three metadata columns (`usage_status`, `provider_key`,
`call_outcome`), nullable input/output/total tokens and estimated cost, and one
validated CHECK constraint. Existing defaults and the event primary key remain.
There is no new table, index, grant, tenant scope or daily-aggregate alteration.

`legacy` is the default for historical rows and unchanged writers. Existing token
values, including zero, do not become provider-confirmed. `confirmed` requires
nonnegative integer tokens with input + output = total. `missing` requires NULL
tokens and cost; `incomplete` may retain individual nonnegative token values but
has NULL cost. New measurements require provider `openai` and an independent
outcome of `success`, `error` or `aborted`. Confirmed zero and unknown usage differ.
The constraint does not validate tariffs, implement accounting persistence,
enforce token budgets or replace application tenant/site authorization.

The migration's `IF NOT EXISTS` checks support re-execution on the expected schema;
they do not certify a pre-existing, manually altered column or same-named constraint.
The separately authorized target preflight must detect such drift before execution.
ALTER TABLE and CHECK validation take locks and may scan existing rows. There is no
production-size lock-duration or throughput claim from a small synthetic test.

## Migration and backfill plan

1. Before target access, obtain the separate environment/DB migration approval.
   Record the exact target, application artifact SHA and migration file hash.
2. Confirm a restorable backup and a demonstrated restore in isolation. Record
   retention, owner and restore procedure; a Git revert is not a data backup.
3. In an explicitly read-only preflight transaction, verify migrations 001-033,
   usage column types/defaults/nullability, constraints, relation size and current
   writers. Check for any partial 034/drift. Assess lock contention and the agreed
   maintenance window/timeouts. Stop on unexpected schema or data.
4. Exercise the exact migration on an approved isolated restore first, including
   existing-writer compatibility, unknown usage and the constraint checks below.
5. Apply through the existing transactional migration runner before Phase-6
   writers/readers. It records the migration version in the same transaction and
   serializes migration runners with its existing advisory lock. Do not use an
   untracked multi-statement operational SQL session as a substitute.
6. Confirm the recorded version, metadata columns and validated CHECK; verify an
   authorized application smoke. Keep provider access governed by existing grants.

Backfill plan: **none**. No UPDATE/DELETE or historical measurement reconstruction.
Do not relabel legacy events as confirmed, fill unknown tokens/cost with zero, or
rebuild daily usage totals in this phase. Failure to acquire locks or validate DDL
must abort the transaction; investigate before a separately controlled retry.

## Rollback and recovery plan

Application rollback retains the additive schema and all measurement evidence.
Before the later runtime rollout, the application rollback reference is the green
Phase-4 baseline above; keep its artifact available. Existing writers remain valid.

An automatic down migration is deliberately absent. Restoring NOT NULL fails once
unknown measurements exist; dropping metadata would erase their interpretation.
Any physical schema recovery needs a separate reviewed forward-recovery plan with
record preservation/export, retention decisions, a tested restore and an explicit
target approval. Never silently delete measurements or convert NULL to zero.
Do not remove already-applied migration history to make a runner retry it.

## Reproduction and evidence boundaries

The existing `Security PostgreSQL isolation` CI job supplies a fresh pgvector/
PostgreSQL-16 service, loopback connection and `security_boundary_test` database.
Run its existing command, `npm run test:security:postgres`, with that job's explicit
`SECURITY_POSTGRES_EXECUTE=1`, `SECURITY_POSTGRES_REQUIRED=1` and isolated database URL.
The script refuses other hosts/database names. The 034 helper additionally requires
PostgreSQL 16 and that database. It does not start processes or accept an extra URL.

After applying all SQL files 001-034 to the public schema, the helper performs ten
real database checks in a transaction-owned temporary schema. It reads the actual
001 usage table definitions and the current pipeline's event/daily INSERT SQL;
storage decisions and constraints are not mocked. It verifies transaction failure
and retry, legacy preservation, unchanged writers, unknown/zero distinction,
invalid measurement rejection, independent outcomes, primary-key/update checks,
unsafe NOT NULL restoration, repeatability and agreement with the full CI schema.
All helper fixtures/DDL roll back, and schema absence is asserted afterward.

This is a schema dry run, not the Phase-6 SDK/persistence/controller integration.
The CI security script applies SQL directly; it is not evidence of a fresh execution
of the production migration runner. Existing startup/runner regressions remain
separate. The original package's PostgreSQL 7/7 result is historical and is not a
new Phase-5 result. Current counts, CI SHA, manifests and logs belong in the PR's
evidence record. No local PostgreSQL execution is claimed when Docker is unavailable.

Independent split review, subsequent merge/Main-CI, target backup/restore and
operational migration/deployment gates remain separate. `EXTERNAL_IPV6_PROBE_REQUIRED`
and the historical external-connection evidence boundary remain open.
