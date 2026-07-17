# Email Job Duplicate Staging Read-only Audit Runbook / Explicit Approval Format

## Summary

`P1.2B-25A` is the docs-only runbook and approval-format step for a possible
later staging `DB_READ_ONLY_AUDIT` concerning duplicate-risk review in
`email_jobs`. `P1.2B-25B` through `P1.2B-25E` now add the pure
`EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary`, the exact-commit
Main-push CI gate, the API-only production-safe deploy, and the green safe
Public-Widget smoke revalidation on the deploy commit
`92c78a607386fa73a44bed8b6ede8c87e52420cf`.

This step does not grant a real DB-read approval, does not execute a staging DB
query, does not execute SQL, does not add a query runner, and does not create
query results or reports with live row data.

Its purpose is only to define how a later explicitly approved staging read-only
audit would need to be approved, prepared, executed, stopped, and documented.

Current documented baseline:

- `P1.2B-24A` is complete as the operator-approval decision layer.
- `P1.2B-24B` through `P1.2B-24E` are complete as the pure
  `EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalBoundary` plus the
  exact-commit Docker fallback gate and API-only production-safe deploy.
- `P1.2B-25B` through `P1.2B-25E` are complete as the pure
  `EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary`, the exact-commit
  Main-push CI gate on run `29573799471`, and the API-only production-safe
  deploy.
- `main` currently points to `92c78a607386fa73a44bed8b6ede8c87e52420cf`.
- API live commit is now `92c78a607386fa73a44bed8b6ede8c87e52420cf`.
- Previous live API commit before `P1.2B-25E` was
  `f315dc11b9caf175f3bfb5a302ee4a2b8ad9fa13`.
- Previous API image before `P1.2B-25E` was
  `sha256:e79415fb4ead59b2b123bf657fc937c3cd26263522cbfbf86c1dff3f387716af`.
- Current API image is
  `sha256:37dc57843880051d6d2c7c339b13e320abb4c507137ab4fe7e68681bdb7a61e1`.
- Production health remains green.
- Safe Public Widget smoke remains green.
- Production DB target remains sanitized to `chatbot`.
- Migration count remains `28`.
- Latest migration remains `028_generic_webhook_signing_modes.sql`.
- `RUN_MIGRATIONS_ON_STARTUP` remains unset.
- `ALLOW_PRODUCTION_AUTO_MIGRATIONS` remains unset.
- API startup log still shows migration skip.

## Current Approval State

The approval state must remain unchanged in `P1.2B-25A`:

| Decision Area | Current State |
| --- | --- |
| `DB_READ_ONLY_AUDIT` | not approved |
| Staging DB read | not approved |
| Production DB read | not approved |
| SQL execution | not allowed |
| Query runner | not allowed |
| Query results | not allowed |
| Reports with data | not allowed |
| Cleanup / Backfill / Enforcement | not allowed |
| Human approval | not granted |

This runbook must not be interpreted by an operator or by Codex as permission to
start a real staging read-only audit.

## Required Human Approval Format

Any later real approval must be explicit, task-scoped, and separate from this
runbook. Example only, not granted here:

> Example only, not granted in `P1.2B-25A`:
>
> "Ich gebe `P1.2B-26A Staging DB_READ_ONLY_AUDIT Preflight` frei,
> ausschließlich für Staging, ausschließlich read-only, ohne SQL-Dateien im
> Repo, ohne Reports mit Daten, ohne `email_jobs` Writes, ohne Cleanup, ohne
> Backfill, ohne Enforcement."

This example exists only to show the required specificity. It is not an
approval in `P1.2B-25A`. Without a separate explicit approval of this quality,
Codex must not start a staging audit.

## Staging Audit Preflight Checklist

Any future real staging read-only audit must stop unless all of the following
are confirmed up front:

- staging environment is explicitly confirmed
- staging DB target is explicitly confirmed
- Production target is explicitly excluded
- read-only role is confirmed
- absence of write privileges is confirmed
- absence of migration privileges is confirmed
- absence of cleanup / backfill privileges is confirmed
- allowed query classes are confirmed as categories only
- output policy is confirmed
- PII handling rules are confirmed
- performance and load risk are reviewed
- stop / abort procedure is confirmed
- no query results will be committed into the repo
- no reports with data will be produced in the repo
- no CSV or JSON exports will be produced
- explicit human approval is separately present

If any of these items is missing, the correct result remains `blocked`.

## Allowed Future Query Classes

Allowed future staging query scope remains categories only. This section does
not provide executable SQL.

- aggregate status / kind counts
- `reportRunId` duplicate-candidate counts
- source-metadata duplicate-candidate counts
- recipient-fingerprint candidate counts only with a separate PII strategy
- status-bucket scan
- time-window scan
- failed / retry ambiguity scan
- processing / stale ambiguity scan

Content fingerprint scan remains:

- high-risk
- deferred
- `blocked_without_pii_strategy`

## Forbidden Query / Output Shapes

Forbidden future query or output shapes include:

- `SELECT *`
- raw rows
- raw `recipient_email` / `recipientEmail`
- `subject`
- `html`
- `text`
- `body`
- `payload`
- full metadata
- `last_error`
- provider error details
- full `reportRunId` when sensitive
- full lead, contact, or conversation identifiers when sensitive
- CSV or JSON dumps
- committed reports
- screenshots or copied outputs containing customer data
- Production identifiers copied into PRs

## Safe Output Policy

If a later staging audit is explicitly approved, the safe output envelope must
stay limited to sanitized aggregates such as:

- aggregate counts
- status buckets
- kind buckets
- risk-group counts
- reason-code counts
- pseudonymized or fingerprinted identifiers only with a separate PII approval

Still not allowed:

- raw rows
- customer data
- personal data
- query results in the repo
- reports with data in the repo

## Execution Sequence for Future Staging Audit

This is a future sequence only. Nothing in this section may be executed by
`P1.2B-25A`.

- `P1.2B-26A Staging DB_READ_ONLY_AUDIT Preflight`
- `P1.2B-26B Staging Aggregate Query Execution`
- `P1.2B-26C Sanitized Staging Audit Summary`
- `P1.2B-26D Review / Decision Gate`
- any Production-read decision only afterward and in a separate task

## Stop Criteria

Stop before or during any later audit if:

- environment is unclear
- staging target is not confirmed
- a Production target could be used by mistake
- no read-only role exists
- write privileges are present
- a query has no `LIMIT`
- a query has no time window
- a query could create a full-table scan
- a query emits PII
- a query emits `subject`, `html`, `text`, or body output
- a query emits full metadata
- query results are expected to be committed
- a report would contain customer data
- performance risk is unclear
- PII fingerprinting is not explicitly approved
- operator approval is missing
- cleanup, update, or delete work would be required
- staging contains unresolved live-PII handling risk

The correct result in all of these cases is `blocked`.

## Abort / Rollback Model

Read-only audit work does not require a DB rollback because no writes are
allowed.

Rollback, if needed, applies only to local artifacts such as logs, notes, or
reports that should not exist:

- if forbidden outputs are generated, delete them immediately and do not commit
  them
- document the incident and stop the task
- if the wrong DB environment is detected, abort immediately

## Relationship to Existing Boundaries

Current planning line:

- `EmailJobDuplicateReadOnlyQueryPlanBoundary` plans query classes.
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` plans execution
  preconditions.
- `EmailJobDuplicateReadOnlyAuditApprovalBoundary` models approval status.
- `EmailJobDuplicateStagingReadOnlyAuditScopeBoundary` models staging scope.
- `EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalBoundary` models
  operator approval decisions.
- `EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary` models runbooks,
  human approval formats, preflight checklists, allowed query-class envelopes,
  output policies, stop criteria, abort models, results, validation helpers,
  classifiers, and safe projections without granting approval.
- `P1.2B-25A` documents the runbook and explicit approval format.

None of these steps executes a DB read.

`P1.2B-25 Boundary` is now implemented and production-validated:

- `apps/api/src/chat/email-job-duplicate-staging-readonly-audit-runbook.boundary.ts`
- `apps/api/test/email-job-duplicate-staging-readonly-audit-runbook-boundary.test.cjs`
- runbook data objects
- human approval format data objects
- preflight checklist data objects
- allowed query class envelope data objects
- safe output policy data objects
- stop criteria data objects
- abort model data objects
- runbook result data objects
- validation helper
- ready / skipped / blocked / failed result builders
- classifier helpers
- safe log / audit projections

Production validation documented for `P1.2B-25E`:

- exact Main-push CI run `29573799471` green on
  `92c78a607386fa73a44bed8b6ede8c87e52420cf`
- API-only deploy only
- API `/healthz` HTTP `200`
- `apiCommit` matched `92c78a607386fa73a44bed8b6ede8c87e52420cf`
- `database=ok` and `redis=ok`
- `scripts/ops/check-production-health.sh` exit `0`
- `production-health-synthetic` HTTP `200` with matching `siteKey`
- safe Public-Widget smoke on `p04-internal-test-20260702102313` stayed green:
  - Loader `200`
  - Bundle `200`
  - Config `200`
  - Session `201`
  - Chat `201`
  - neutral answer text
  - unchanged top-level response keys `sessionId`, `answer`, `parts`, `sources`,
    and `messages`
  - no debug, preview, knowledge, delivery, or secret fields

## Recommended Next Step

Recommended next step:
`P1.2B-26A Staging DB_READ_ONLY_AUDIT Preflight Decision`

Recommended scope for `P1.2B-26A`:

- verify whether the explicit human approval exists in the required format
- verify that approval remains staging-only and read-only-only
- block if no explicit approval exists
- keep all DB reads, SQL, query runners, query results, and reports out of
  scope
- document only the preflight decision state

Still not allowed in `P1.2B-26A`:

- DB reads
- staging DB reads
- Production DB reads
- SQL
- query runner
- `email_jobs` reads
- `webhook_jobs` reads
- query results
- reports with data
- cleanup
- backfill
- enforcement

## Non-goals

`P1.2B-25A` does not:

- approve a real `DB_READ_ONLY_AUDIT`
- run a staging DB query
- run a Production DB query
- perform DB reads
- run SQL
- create SQL files
- read, write, or update `email_jobs`
- run a query runner
- produce query results
- produce reports with data
- perform duplicate cleanup
- perform backfill
- add a unique index or constraint
- introduce idempotency enforcement
- deploy
- migrate
- change feature flags
- change Production config
- change the public widget
- add NOLIS-specific logic
- grant a real human approval
