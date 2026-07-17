# Email Job Duplicate Staging Read-only Audit Operator Approval Decision

## Summary

`P1.2B-24A` through `P1.2B-25E` now cover the docs-only operator-approval-decision step, the docs-only runbook / explicit approval format step, the pure `EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalBoundary`, the pure `EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary`, the exact-commit Main-push CI gate on run `29573799471`, and the production-safe API-only deploy for a later possible staging `DB_READ_ONLY_AUDIT` concerning duplicate-risk review in `email_jobs`.

This step does not execute SQL, does not connect to a database, does not run a query runner, does not read `email_jobs`, does not read or write `webhook_jobs`, and does not produce query results or reports with live row data.

Its purpose is only to document the current approval state, the evidence required before any future approval, the human operator responsibilities, the allowed future staging-audit envelope, and the stop criteria that must block any later real staging DB read unless a separate explicit human approval task grants it.

Current documented baseline:

- `P1.2B-23A` is complete as the staging read-only scope / approval-preconditions step.
- `P1.2B-23B` is complete as the pure `EmailJobDuplicateStagingReadOnlyAuditScopeBoundary`.
- `P1.2B-23E` completed the API-only deploy on `577518a29eac8a9553309f4aadaf6ac7e12479bc`.
- `P1.2B-23E-G` completed the green safe Public-Widget smoke revalidation.
- `P1.2B-24D-E2` resolved the blocked gate using the exact-commit Docker fallback on `f315dc11b9caf175f3bfb5a302ee4a2b8ad9fa13`.
- `P1.2B-24E` completed the API-only deploy on `f315dc11b9caf175f3bfb5a302ee4a2b8ad9fa13`.
- `P1.2B-25A` is complete as the docs-only staging read-only audit runbook and explicit approval format step.
- `P1.2B-25B` through `P1.2B-25E` introduced and production-validated `EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary`.
- The exact Main-push CI gate is green on run `29573799471`.
- `P1.2B-Status-20` is complete.
- API live baseline is now `92c78a607386fa73a44bed8b6ede8c87e52420cf`.
- Previous live API baseline before `P1.2B-25E` was `f315dc11b9caf175f3bfb5a302ee4a2b8ad9fa13`.
- Previous API image before `P1.2B-25E` was `sha256:e79415fb4ead59b2b123bf657fc937c3cd26263522cbfbf86c1dff3f387716af`.
- Current API image is `sha256:37dc57843880051d6d2c7c339b13e320abb4c507137ab4fe7e68681bdb7a61e1`.
- Production health is green.
- Safe testsite smoke is green.
- Production DB target remains sanitized to `chatbot`.
- Migration count remains `28`.
- Latest migration remains `028_generic_webhook_signing_modes.sql`.
- Dashboard commit remains `3a276e7f0ef898bae791638b964087780da80c4d`.
- Widget commit remains `7378ddb53bc3588cf35be3530fcbbf5d72e58b12`.
- The API startup log shows `Database auto-migrations skipped`.

Production validation now documented for `P1.2B-25E`:

- API `/healthz` returned HTTP `200`.
- `apiCommit` matched `92c78a607386fa73a44bed8b6ede8c87e52420cf`.
- `database=ok` and `redis=ok` remained green.
- `scripts/ops/check-production-health.sh` returned exit code `0`.
- `production-health-synthetic` stayed green with HTTP `200` and matching `siteKey`.
- The safe Public-Widget smoke on `p04-internal-test-20260702102313` stayed green:
  - Loader `200`
  - Bundle `200`
  - Config `200`
  - Session `201`
  - Chat `201`
  - neutral response
  - answer text: `Klar, gerne. Wie heißt du und wie kann man dich am besten erreichen - per E-Mail oder Telefon?`
  - unchanged top-level response keys `sessionId`, `answer`, `parts`, `sources`, and `messages`
  - no debug, preview, knowledge, delivery, or secret fields

## Current Approval Decision

Current decision status must remain unchanged in this task:

| Decision Area | Current Decision |
| --- | --- |
| `DB_READ_ONLY_AUDIT` | not approved |
| Staging DB read | not approved |
| Production DB read | not approved |
| SQL execution | not allowed |
| Query runner | not allowed |
| Query results | not allowed |
| Reports with data | not allowed |
| Cleanup / Backfill / Enforcement | not allowed |

Reason: there is no explicit human operator approval for a real staging DB read in this task.

This document must not be interpreted as granting staging DB read approval, Production DB read approval, SQL approval, query-runner approval, report approval, or cleanup / backfill / enforcement approval.

## Required Evidence Before Approval

Any future real staging read-only audit must stop unless all of the following evidence is documented up front:

- confirmed staging environment
- confirmed staging DB target
- confirmed non-Production connection target
- confirmed read-only DB role
- confirmed absence of write privileges
- confirmed absence of migration / schema-change privileges
- confirmed query classes as categories only
- confirmed output policy
- confirmed PII handling rules
- confirmed performance / load review
- confirmed stop / abort procedure
- confirmed explicit human operator approval
- confirmed no-commit rule for query results
- confirmed no-report-with-data rule

If any one of these evidence items is missing, the correct decision remains `blocked`.

## Operator Decision Matrix

| Decision Area | Current Decision | Required Before Approval | Notes |
| --- | --- | --- | --- |
| Staging DB read | not approved | yes | separate explicit human operator approval required |
| Production DB read | not approved | yes | must stay a separate later decision |
| SQL execution | not allowed | yes | not granted here under any interpretation |
| Query runner | not allowed | yes | must stay outside this task |
| Query results | not allowed | yes | no raw query-result handling in this task |
| Reports with data | not allowed | yes | no customer-data reports by default |
| PII fingerprinting | not approved | yes | recipient or content fingerprinting stays blocked |
| Manual review pack | not approved | yes | no customer-data review packs by default |
| Cleanup | not allowed | yes | must never be bundled into read-only audit approval |
| Backfill | not allowed | yes | separate later line only |
| Migration / index | not allowed | yes | out of scope here |
| Idempotency enforcement | not allowed | yes | separate runtime / schema line only |

No risky area is implicitly unlocked by a lower-risk approval.

## Allowed Future Staging Audit Envelope

Allowed future staging-audit scope remains categories only. This is not current approval and is not executable SQL.

- aggregate status / kind counts
- `reportRunId` duplicate-candidate counts
- source-metadata duplicate-candidate counts
- recipient-fingerprint candidate counts only with a separate PII strategy
- status-bucket scan
- time-window scan
- failed / retry ambiguity scan
- processing / stale ambiguity scan

High-risk and still deferred:

- content fingerprint scan
- status: high-risk
- decision: deferred
- gate: `blocked_without_pii_strategy`

## Explicit Non-Approval Clauses

This document is not any of the following:

- not a staging-read approval
- not a Production-read approval
- not a SQL approval
- not a query-runner approval
- not a query-results approval
- not a report approval
- not a cleanup approval
- not a backfill approval
- not an enforcement approval

This document must not be interpreted by an operator or by Codex as permission to run a real staging read-only audit.

## Stop Criteria Before Any Future Approval

Stop before any future approval if:

- the staging target is unclear
- a Production target could be used by mistake
- no read-only role exists
- write privileges are present
- a query has no `LIMIT`
- a query has no time window
- a query could cause a full-table scan
- a query would emit PII
- a query would emit `subject`, `html`, `text`, or body output
- a query would emit full metadata
- query results are expected to be committed
- a report would contain customer data
- performance risk is unclear
- PII fingerprinting is not explicitly approved
- operator approval is missing
- cleanup, update, or delete work would be needed
- staging contains unresolved live-PII handling risk

The correct result in any of these cases is `blocked`.

## Required Human Approval Format

Any later real approval must be explicit and task-scoped. Example only, not granted here:

> Example only, not granted in `P1.2B-24A`:
>
> "I approve `P1.2B-26A Staging DB_READ_ONLY_AUDIT Preflight`, staging only, read-only only, no SQL files in the repo, no reports with data, no `email_jobs` writes, no cleanup, no backfill, no enforcement."

This example shows the minimum specificity required for a later approval task. It is not an approval in this task.

## Relationship to Existing Boundaries

Current planning line:

- `EmailJobDuplicateReadOnlyQueryPlanBoundary` plans allowed future query classes.
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` plans execution preconditions and execution-order constraints.
- `EmailJobDuplicateReadOnlyAuditApprovalBoundary` models approval state and approval constraints.
- `EmailJobDuplicateStagingReadOnlyAuditScopeBoundary` models staging scope and approval-preconditions data.
- `EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalBoundary` models operator approval decisions, required evidence, decision matrices, non-approval clauses, human approval formats, stop criteria, results, validation helpers, classifiers, and safe projections.
- `EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary` models runbook, human approval format, preflight checklist, query envelope, safe output policy, stop criteria, abort model, result builders, validation helpers, classifiers, and safe projections.
- `P1.2B-24A` documents the operator-approval decision layer.

None of these steps executes a DB read.

## Recommended Next Step

`P1.2B-25A` through `P1.2B-25E` are now complete. They document the explicit
human approval format, the future staging-audit preflight checklist, the
allowed future query classes as categories only, the forbidden query and output
shapes, the safe output policy, the execution sequence, the stop criteria, and
the abort / rollback model, and they production-validate the pure
`EmailJobDuplicateStagingReadOnlyAuditRunbookBoundary` on
`92c78a607386fa73a44bed8b6ede8c87e52420cf`.

Recommended next step: `P1.2B-26A Staging DB_READ_ONLY_AUDIT Preflight Decision`

Recommended scope for `P1.2B-26A`:

- verify whether explicit human approval exists in the documented required format
- confirm that human approval is still absent if the required format is missing
- block any attempted staging read-only audit when approval is missing
- keep query classes, safe output policy, stop criteria, and abort model as documentation and boundary inputs only

Still not allowed in `P1.2B-26A`:

- DB reads
- SQL
- query runner
- `email_jobs` reads
- `webhook_jobs` reads
- query results
- reports with data
- cleanup
- backfill
- enforcement
- human approval as granted

## Non-goals

This task does not:

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
