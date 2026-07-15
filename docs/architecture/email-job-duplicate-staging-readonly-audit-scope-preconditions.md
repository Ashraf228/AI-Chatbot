# Email Job Duplicate Staging Read-only Audit Scope / Approval Preconditions

## Summary

`P1.2B-23A` is a docs-only staging-read-only-audit scope and preconditions step for a later possible duplicate-risk review in `email_jobs`.

This step does not execute SQL, does not connect to a database, does not run a query runner, does not read `email_jobs`, does not read or write `webhook_jobs`, does not write `email_jobs`, and does not produce query results or reports with live row data.

Its purpose is only to document the requirements, limits, allowed future query classes, safe output policy, and stop criteria that must exist before any later explicitly approved staging `DB_READ_ONLY_AUDIT` could even be considered.

Current documented baseline:

- `P1.2B-22` is complete and production-validated.
- `P1.2B-Status-19` is complete.
- `main` includes `9988d9db41cf8de876bbfae78bc1204067909a4e`.
- API live baseline remains `cfa992b448016545d1fba1bdbaba3af3716991e6`.
- Production health is green.
- Production DB target remains sanitized to `chatbot`.
- Migration count remains `28`.
- Latest migration remains `028_generic_webhook_signing_modes.sql`.
- Public widget remains unchanged on the legacy pipeline.
- No real `DB_READ_ONLY_AUDIT` has been approved or executed.

## Current Decision State

Decision status must remain unchanged in this task:

| Decision Area | Status |
| --- | --- |
| `DB_READ_ONLY_AUDIT` | not approved |
| Staging DB read | not approved |
| Production DB read | not approved |
| SQL execution | not allowed |
| Query runner | not allowed |
| Query results | not allowed |
| Reports with data | not allowed |
| Cleanup / Backfill / Enforcement | not allowed |

This document does not grant any DB-read approval. It records only what would need to be true before a later separate staging-read-only task could proceed.

## Purpose of a Future Staging Read-only Audit

The purpose of a later staging read-only audit would be limited to duplicate-risk understanding only:

- staging must come before any later Production read consideration
- the goal is risk visibility, not action
- no cleanup may be derived automatically from staging results
- no enforcement may be derived automatically from staging results
- no Production decision may be inferred from staging results without a separate Production approval task

Staging evidence is therefore only a scoped precondition layer for future decision-making, not a replacement for Production approval.

## Required Preconditions Before Any Future Staging DB Read

Any future staging read-only task must stop unless all of the following are explicitly documented up front:

- dedicated task assignment with change class `DB_READ_ONLY_AUDIT_STAGING`
- explicit human approval
- confirmed staging environment
- staging DB target documented unambiguously
- confirmed non-Production connection target
- read-only DB role
- no write privileges
- no migration permissions
- no cleanup permissions
- no backfill permissions
- explicit query limits
- explicit time window
- explicit query timeout
- no `SELECT *`
- no raw PII output
- no full metadata dumps
- no `subject`, `html`, `text`, or body output
- no `last_error` or provider-error output
- no query results committed into the repository
- no reports committed into the repository
- sanitized output review before sharing results
- load / performance review
- stop / abort procedure

If any one of these preconditions is missing, the future staging-read task must return `blocked`.

## Allowed Future Staging Query Classes

Allowed future staging query classes are categories only. They are not SQL and are not approved for execution here.

- aggregate status / kind counts
- `reportRunId` duplicate-candidate counts
- source-metadata duplicate-candidate counts
- recipient-fingerprint candidate counts
- status-bucket scan
- time-window scan
- failed / retry ambiguity scan
- processing / stale ambiguity scan

High-risk and deferred:

- content-fingerprint scan remains deferred
- content fingerprinting is high risk
- content fingerprinting requires a separate PII / fingerprinting approval path

## Forbidden Query / Output Shapes

The following shapes remain forbidden unless a later explicit task overrides them with stronger approval:

- `SELECT *`
- raw rows
- raw `recipient_email` / `recipientEmail`
- `subject`
- `html`
- `text`
- `body`
- `payload`
- full `metadata`
- `last_error`
- raw provider or SMTP errors
- full `reportRunId` where sensitivity is unclear
- full lead / contact / conversation identifiers where sensitivity is unclear
- CSV dumps
- JSON dumps
- committed reports
- screenshots or copied outputs containing customer data
- Production identifiers copied into PRs

## Safe Output Policy for a Future Staging Audit

Allowed later output classes, only if separately approved in a later task:

- aggregate counts
- status buckets
- kind buckets
- risk-group counts
- reason codes
- pseudonymized or fingerprinted identifiers only with a separate explicit approval

Not allowed:

- raw rows
- customer data
- personally identifiable information
- query results in the repository
- reports with live row data by default

## Staging-vs-Production Separation

Staging must stay operationally separate from Production:

- a staging audit is not a Production-read approval
- any Production read requires a separate task and separate approval
- staging findings must not be transferred automatically to Production decisions
- staging must not be treated as low-risk by default if it contains copied live PII
- if staging contains live or near-live customer data, PII rules must be treated as Production-grade

## Approval Requirements

| Approval Area | Current Status | Required Before Execution | Notes |
| --- | --- | --- | --- |
| Staging DB read | not granted | yes | separate later human approval required |
| Production DB read | not granted | yes | must stay separate from staging approval |
| PII fingerprinting | not granted | yes | required before any recipient or content fingerprinting |
| Report generation | not granted | yes | no reports with data by default |
| Manual review pack | not granted | yes | no customer-data packs by default |
| Cleanup | not granted | yes | must stay separate from read-only audit |
| Backfill | not granted | yes | out of scope here |
| Migration / index | not granted | yes | separate migration line required |
| Idempotency enforcement | not granted | yes | separate runtime / schema line required |

No risky area is unlocked by a lower-risk approval.

## Stop Criteria

Stop before any real staging read if:

- the environment is unclear
- the staging DB target is not confirmed
- a Production target could be used by mistake
- no read-only role exists
- a query has no `LIMIT`
- a query has no time window
- a query could cause a full-table scan
- a query emits PII
- a query emits `subject`, `html`, `text`, or body output
- a query emits full metadata
- query results are expected to be committed
- a report would contain customer data
- performance risk is unclear
- required approval is missing
- cleanup, update, or delete work would be needed to finish the task
- staging contains unresolved live-PII handling risk

The correct result in any of these cases is `blocked`.

## Relationship to Existing Boundaries

Current planning line:

- `EmailJobDuplicateReadOnlyQueryPlanBoundary` models future query classes.
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` models execution preconditions and planning order.
- `EmailJobDuplicateReadOnlyAuditApprovalBoundary` models approval status and approval constraints.
- `P1.2B-23A` defines the staging-read-only scope and preconditions layer.

None of those steps executes a DB read.

## Recommended Next Step

Recommended next step: `P1.2B-23B EmailJobDuplicateStagingReadOnlyAuditScopeBoundary`

Recommended scope for `P1.2B-23B`:

- pure `StagingAuditScope` data objects
- `StagingEnvironmentRequirement` data objects
- `StagingQueryClassAllowance` data objects
- `StagingOutputPolicy` data objects
- `StagingStopCriteria` data objects
- result builders
- safe projections
- tests

Still not allowed in `P1.2B-23B`:

- DB reads
- SQL
- query runner
- `email_jobs` reads
- reports with live data
- cleanup
- backfill
- enforcement

## Non-goals

This task does not:

- approve a real `DB_READ_ONLY_AUDIT`
- approve staging DB reads
- approve Production DB reads
- run SQL
- create SQL files
- run a query runner
- add a repository
- produce query results
- produce reports with data
- export CSV or JSON data
- perform duplicate cleanup
- perform backfill
- add a unique index or constraint
- introduce idempotency enforcement
- refactor `EmailJobsService.enqueue`
- refactor `processPendingJobs`
- read, write, or update `webhook_jobs`
- add Orchestrator wiring
- add Production wiring
- change the public widget
- add NOLIS-specific logic
