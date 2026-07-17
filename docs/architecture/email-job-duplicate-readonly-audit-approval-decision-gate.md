# Email Job Duplicate Read-only Audit Approval / Execution Decision Gate

## Summary

`P1.2B-22A` is a docs-only approval / execution decision gate for any later real `DB_READ_ONLY_AUDIT` concerning duplicate-risk review in `email_jobs`.

This step does not execute SQL, does not connect to a database, does not read or write `email_jobs`, does not introduce a query runner, and does not produce query results or reports with live row data.

Its purpose is only to document which approvals, preconditions, sequencing rules, stop criteria, and output limits must be satisfied before any later explicit read-only DB audit could be considered.

Default decision status for this task:

- `DB_READ_ONLY_AUDIT` approval: not granted
- Production DB read approval: not granted
- Staging DB read approval: not granted
- Query execution in this task: not allowed

## Current Readiness State

Current documented baseline:

- `P1.2B-20` introduced `EmailJobDuplicateReadOnlyQueryPlanBoundary`.
- `P1.2B-21` introduced `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary`.
- `P1.2B-22B` through `P1.2B-22E` introduced and production-validated `EmailJobDuplicateReadOnlyAuditApprovalBoundary`.
- All three boundaries are production-validated as pure data-object / plan / safety layers only.
- API live baseline is `cfa992b448016545d1fba1bdbaba3af3716991e6`.
- Main-CI / Docker gate was green on run `29446620828`.
- The actual live API / Dashboard basis before the P1.2B-22 API-only deploy was already `3a276e7f0ef898bae791638b964087780da80c4d`; this is a baseline correction, not a regression.
- The previous API image before the deploy was `sha256:d922f9b389089ef9b2a495728b498bb4ab27454ec4f68eeb7eadf7d8befc5854`.
- The deployed API image is `sha256:ccbbfcaf21cb83746169c2e9407368bec9ba5f6f67120f401dab6de0559c664e`.
- Production health is green.
- `check-production-health.sh` returned exit code `0`.
- `production-health-synthetic` returned HTTP `200` with matching `siteKey`.
- Production DB target remains sanitized to `chatbot` with no `soule_demo` recurrence.
- Migration count remains `28`.
- Latest migration remains `028_generic_webhook_signing_modes.sql`.
- Database auto-migrations remained skipped and `db:migrate` was not executed.
- Public widget remains unchanged on the legacy pipeline.

Current hard boundaries remain:

- no productive runtime use of the duplicate audit planning layers
- no SQL execution
- no DB reads
- no `email_jobs` reads, writes, or updates
- no `webhook_jobs` reads, writes, or updates
- no query runner
- no query results
- no reports with live row data
- no cleanup, backfill, index, constraint, or idempotency enforcement work

## Decision Status

Current gate status:

| Decision Area | Status |
| --- | --- |
| `DB_READ_ONLY_AUDIT` | not approved |
| Staging DB read | not approved |
| Production DB read | not approved |
| SQL execution | not allowed |
| Query runner | not allowed |
| Query results | not allowed |
| Reports with data | not allowed |
| Cleanup | not allowed |
| Backfill | not allowed |
| Idempotency enforcement | not allowed |

This document intentionally does not grant any DB-read approval. It only records what must be true before a later explicit approval task could do so.

## Approval Matrix

| Approval Area | Required Approval | Current Status | Who/What Must Approve | Notes |
| --- | --- | --- | --- | --- |
| Docs-only planning | no | granted for this task only | current DOKU_ONLY assignment | documentation only, no DB access |
| Staging read-only DB audit | yes | not granted | explicit later human assignment | separate task required |
| Production read-only DB audit | yes | not granted | explicit later human assignment | separate task required |
| PII fingerprinting strategy | yes | not granted | explicit privacy and human approval | recipient/content fingerprinting stays blocked |
| Report generation | yes | not granted | explicit later human assignment | no reports with data in this task |
| Manual review pack generation | yes | not granted | explicit later human assignment | no customer-data packs by default |
| Cleanup | yes | not granted | explicit later human assignment | must never be combined with read-only audit by default |
| Backfill | yes | not granted | explicit later human assignment | out of scope here |
| Migration / index | yes | not granted | explicit later human assignment | separate migration line required |
| Idempotency enforcement | yes | not granted | explicit later human assignment | separate runtime / schema line required |

No risky area is implicitly unlocked by a lower-risk approval.

## Environment Sequencing

Required sequencing for any later real duplicate audit:

1. Complete docs-only decision-gate work.
2. If needed, add pure approval / sequencing boundary structures and runbook guidance.
3. Only then consider a staging read-only audit, and only with separate explicit approval.
4. Only after a successful separately approved staging path may a Production read-only audit even be considered.
5. A Production read-only audit still requires its own separate explicit approval and must not be inferred from staging approval.

This task does not allow direct Production DB access and does not authorize a staging query either.

## Required Preconditions Before Any Future `DB_READ_ONLY_AUDIT`

Any future real DB-read task must stop unless all of the following are documented up front:

- explicit dedicated `DB_READ_ONLY_AUDIT` assignment
- confirmed DB target `chatbot`
- confirmed environment
- confirmed read-only DB role
- no write privileges
- read-only transaction mode if technically available
- explicit query limits
- explicit time window
- explicit query timeout
- no `SELECT *`
- no raw PII output
- no full metadata dumps
- no `subject`, `html`, `text`, or body output
- no `last_error` or provider-error output
- no reports committed into the repository
- no CSV or JSON exports committed or attached by default
- sanitized output review before any result is shared
- load / performance review
- rollback / abort procedure
- incident stop criteria

If any one of these preconditions is missing, the later task must return `blocked`.

## Allowed Future Query Classes

Allowed future query classes are categories only. They are not SQL and are not approved for execution here.

- aggregate status / kind counts
- `reportRunId` duplicate-candidate counts
- source-metadata duplicate-candidate counts
- recipient-fingerprint candidate counts only after separate privacy approval
- status-bucket scan
- time-window scan
- failed / retry ambiguity scan
- processing / stale ambiguity scan

High-risk and deferred:

- content fingerprint scan remains blocked until a separate privacy and sensitivity decision exists

## Forbidden Query and Output Shapes

The following shapes remain forbidden for any future audit unless a later explicit task overrides them with stronger approval:

- `SELECT *`
- raw rows
- raw `recipient_email` or `recipientEmail`
- `subject`
- `html`
- `text`
- `body`
- full `metadata`
- `last_error`
- raw provider or SMTP errors
- full `reportRunId` if sensitivity is unclear
- full lead, contact, or conversation identifiers if sensitivity is unclear
- CSV dumps
- JSON dumps
- committed reports
- screenshots or copied outputs with customer data

## Stop Criteria

Stop before any real DB read if:

- DB target is unclear
- DB target is not `chatbot`
- no read-only role exists
- query has no `LIMIT`
- query has no time window
- query could cause a full-table scan
- query emits PII
- query emits `subject`, `html`, `text`, or body output
- query emits full metadata
- query results are expected to be committed
- a report would contain customer data
- performance risk is unclear
- required approval is missing
- cleanup, update, or delete work would be needed to finish the task

The correct result in any of these cases is `blocked`.

## Safe Output Policy

Allowed output classes for any later approved audit:

- aggregate counts
- status buckets
- kind buckets
- risk-group counts
- reason codes
- pseudonymized or fingerprinted identifiers only with separate explicit approval

Not allowed by default:

- raw row material
- raw identifiers
- raw content fields
- raw metadata
- customer-data report packs

## Operator and Execution Responsibility

Execution responsibility remains constrained:

- Codex must not start a real `DB_READ_ONLY_AUDIT` on its own.
- Any real DB read requires explicit human approval in a separate task.
- Results must not be automatically committed.
- No Production query may run without a separate gate.
- No staging query may run without a separate gate.

## Relationship to Existing Boundaries

Current planning line:

- `EmailJobDuplicateReadOnlyQueryPlanBoundary` models allowed query classes and safe query-shape planning.
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` models execution preconditions, query steps, approval gates, output policies, risk assessments, execution plans, execution results, and safe projections.
- `P1.2B-22A` defines the approval, sequencing, stop-criteria, and output-governance layer for any later read-only audit.
- `P1.2B-23A` defines the staging-read-only scope and preconditions layer for any later staging audit assignment.

None of those steps executes a DB read.

## Recommended Next Step

`P1.2B-23A` is now the documented staging-read-only scope / preconditions step, and `P1.2B-24A` through `P1.2B-24E` now add the documented operator-approval-decision step, the pure `EmailJobDuplicateStagingReadOnlyAuditOperatorApprovalBoundary`, the exact-commit Docker-fallback gate, the API-only production-safe deploy on `f315dc11b9caf175f3bfb5a302ee4a2b8ad9fa13`, and the green safe-smoke revalidation. None of these steps grants staging DB read approval, Production DB read approval, SQL execution, query runners, reports, cleanup, backfill, enforcement, or human approval.

Recommended next step: `P1.2B-25A Email Job Duplicate Staging Read-only Audit Runbook / Explicit Approval Format`

Recommended scope for `P1.2B-25A`:

- explicit human approval wording only
- staging read-only preflight checks
- allowed future staging query classes as categories only
- allowed sanitized output shapes
- mandatory stop criteria
- explicit confirmation that approval remains not granted

Still not allowed in `P1.2B-25A`:

- DB reads
- SQL
- query runner
- `email_jobs` reads
- `webhook_jobs` reads
- query results
- reports with live data
- cleanup
- backfill
- runtime wiring
- production wiring
- human approval as granted
- enforcement
- real `DB_READ_ONLY_AUDIT`
