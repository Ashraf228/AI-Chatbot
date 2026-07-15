# Email Job Duplicate Read-only DB Audit Execution Plan

## Summary

`P1.2B-21A` started as a documentation-only execution plan for a later explicit read-only duplicate audit against live `email_jobs` rows.

This step does not execute SQL, does not connect to a database, does not read `email_jobs`, does not write `email_jobs`, and does not change runtime code, production wiring, or production configuration.

Its purpose is to define the exact safe order, preconditions, output rules, and stop criteria for a future dedicated DB-read-only audit task that operates on live data without drifting into cleanup, requeue, or idempotency enforcement work.

`P1.2B-21B` through `P1.2B-21E` are now complete and production-validated. They added `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` as a pure data-object execution-boundary layer only and deployed it API-only on `cf696042b68f463923e6f026a75658c563c51985` without introducing real DB reads, SQL, query runners, reports, cleanup, or production wiring.

## Current Baseline

This execution plan builds on the already completed and production-validated planning layers:

- `P1.2B-19` duplicate audit / cleanup scope
- `P1.2B-19B` through `P1.2B-19E` pure `EmailJobDuplicateAuditPlanBoundary`
- `P1.2B-20A` read-only duplicate query plan audit
- `P1.2B-20B` through `P1.2B-20E` pure `EmailJobDuplicateReadOnlyQueryPlanBoundary` and production-safe deploy

Current main baseline for the planning line:

- `origin/main` includes squash commit `cfa992b448016545d1fba1bdbaba3af3716991e6`
- `EmailJobDuplicateReadOnlyQueryPlanBoundary` is deployed as pure data-object logic only
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` is deployed as pure data-object logic only
- `EmailJobDuplicateReadOnlyAuditApprovalBoundary` is deployed as pure data-object logic only
- API runtime is production-validated on `cfa992b448016545d1fba1bdbaba3af3716991e6`
- previous live API runtime commit before the deploy was `3a276e7f0ef898bae791638b964087780da80c4d`
- Main-CI / Docker gate was green on run `29446620828`
- Production health is green
- `check-production-health.sh` returned exit code `0`
- `production-health-synthetic` returned HTTP `200` with matching `siteKey`
- the sanitized Production DB target remains `chatbot` and the earlier `soule_demo` drift did not recur
- migration count remains `28`
- latest migration remains `028_generic_webhook_signing_modes.sql`
- database auto-migrations remained skipped
- `db:migrate` was not executed
- public widget remains on the legacy pipeline and public response shape remains unchanged
- no productive runtime wiring was introduced
- no SQL execution was introduced
- no DB reads were introduced
- no `email_jobs` reads, writes, or updates were introduced
- no cleanup, backfill, unique index, constraint, or idempotency enforcement was introduced

## P1.2B-21 Status Update

`P1.2B-21B` through `P1.2B-21E` implemented and production-validated `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` as a pure execution-boundary layer only.

Implemented data-object scope:

- DB-audit preconditions
- DB-audit query steps
- DB-audit approval gates
- DB-audit output policies
- DB-audit risk assessments
- DB-audit execution plans
- DB-audit execution results
- validation helpers
- `ready` / `skipped` / `blocked` / `failed` result builders
- result classification helpers
- safe log and audit projections

Still not introduced or approved:

- a real `DB_READ_ONLY_AUDIT`
- DB reads
- SQL execution
- SQL files
- `email_jobs` reads, writes, or updates
- `webhook_jobs` reads, writes, or updates
- query runner implementation
- query results
- reports with data
- CSV or JSON exports
- duplicate cleanup
- backfill
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService.enqueue` refactor
- `processPendingJobs` refactor
- Orchestrator wiring
- Production wiring

The live runtime still contains the same side-effecting paths as before:

- `ChatAgentOrchestratorService.queueInternalLeadNotification`
- `EmailJobsService.enqueue`
- `EmailJobsService.processPendingJobs`
- `WidgetLeadsService.capture`
- `ToolDispatcherService.executeCaptureLead`
- `WidgetAdminReportsService.runReport`

Because those paths still mutate live queue state, any future duplicate audit must stay read-only and must not mix execution with cleanup or runtime refactoring.

## Objective of the Future DB-read Task

The future DB-read-only task should answer only these questions:

- How large is the duplicate-risk surface by `status` and `kind`?
- Do live rows show meaningful duplicate clusters around `metadata.reportRunId`?
- Do live rows show meaningful duplicate clusters around source metadata such as `leadId`, `contactRequestId`, `conversationId`, or `sessionId`?
- Are duplicate-risk clusters concentrated in specific time windows?
- How much ambiguity exists between duplicate recreation and legitimate retry / stale-processing behavior?

The future DB-read-only task must not answer these questions by mutating data:

- which rows should be deleted
- which rows should be retried
- which rows should be marked duplicate
- whether a unique index should be added immediately
- whether idempotency enforcement can be switched on now

Those remain later decisions after sanitized read-only evidence exists.

## Required Preconditions for Any Later Execution

The future DB-read-only execution must stop unless all of the following are true:

- explicit separate approval exists for a live Production DB read
- DB target is confirmed as sanitized `chatbot`
- the chosen DB role is read-only
- read-only transaction mode is enabled if technically available
- Production health is green before the read starts
- no production migration is pending
- no production auto-migration path is active
- the exact main commit being assessed is pinned and documented
- bounded time window is documented before the query starts
- bounded `LIMIT` is documented before the query starts
- explicit query timeout is documented before the query starts
- low-risk execution window is chosen
- sanitized output rules are agreed before execution

If any one of those preconditions is missing, the future task should be treated as blocked rather than improvised.

## Planned Execution Order

The future DB-read-only audit should execute query classes in the following order only. The order is intentionally low-risk to higher-risk and aggregate-first.

| Phase | Query class | Purpose | Allowed output | Blockers |
| --- | --- | --- | --- | --- |
| 0 | Preflight only | Confirm DB target, read-only role, timeout, limit, and health gates | sanitized readiness checklist only | unclear target, no read-only role, unhealthy Production |
| 1 | `aggregate_by_status_kind` | Size the duplicate-risk surface without identifier-level output | aggregate counts only | missing time window or missing limit |
| 2 | `status_bucket_scan` | Split counts into safe operational buckets | status/risk bucket counts only | raw-row request, unbounded scan |
| 3 | `time_window_scan` | Identify concentration windows and possible replay spikes | time-bucket counts only | unbounded time range |
| 4 | `duplicate_by_report_run` | Measure strongest currently documented soft correlation path | aggregate cluster counts and pseudonymized grouping only | raw `reportRunId` output, no metadata-scan approval |
| 5 | `duplicate_by_source_metadata` | Measure lead/contact/conversation/source clusters | aggregate counts by normalized source family only | raw metadata output, no load review |
| 6 | `failed_retry_ambiguity` | Separate duplicate recreation from legitimate retry semantics | ambiguity bucket counts only | retry interpretation without status framing |
| 7 | `processing_stale_ambiguity` | Measure `processing` ambiguity without cleanup claims | stale-risk bucket counts only | any cleanup action or stale-row mutation |
| 8 | `duplicate_by_recipient_fingerprint` | Optional only after separate privacy approval | pseudonymized fingerprint bucket counts only | no approved hashing strategy |
| blocked | `duplicate_by_content_fingerprint` | Explicitly not allowed yet | none | content fingerprinting remains blocked |

Interpretation rules for the later execution:

- The task must stop after any phase that already answers the question safely.
- Identifier-bearing phases are never required if aggregate phases are sufficient.
- Recipient fingerprinting is optional and separately gated.
- Content fingerprinting stays blocked until a separate privacy decision exists.

## Output and Handling Policy

Allowed future outputs:

- aggregate counts
- status buckets
- kind buckets
- time-window counts
- ambiguity bucket counts
- pseudonymized identifier buckets only if separately approved
- reason codes
- query-class names
- sanitized written summary in task output

Forbidden future outputs:

- raw row dumps
- raw `recipient_email` / `recipientEmail`
- raw `subject`
- raw `html`
- raw `text`
- raw payload bodies
- full `metadata`
- raw provider or SMTP errors
- raw `reportRunId`, `leadId`, `contactRequestId`, `conversationId`, or `sessionId` unless sensitivity is separately cleared
- CSV exports
- JSON exports
- committed query results
- customer screenshots
- direct PR attachments containing live row data

Handling rules:

- results stay ephemeral and sanitized
- no query results are committed into the repository
- no customer data is copied into comments, PRs, or docs
- any later written summary must stay aggregate-only unless a stronger approval explicitly exists

## Performance and Safety Constraints

The future DB-read-only task should assume:

- `metadata` correlation scans are potentially expensive
- `reportRunId` grouping is useful but still metadata-driven
- full-table scans are unsafe without explicit bounded windows
- `processing` rows are operationally ambiguous and high-risk to interpret
- retry-related rows can be semantically ambiguous even if they look duplicated

Required constraints for later execution:

- always use a bounded time window
- always use an explicit limit
- always use an explicit timeout
- run aggregate-first
- stop before broadening scope if a safer phase already gives enough evidence
- never use `SELECT *`
- never request raw content columns
- never pivot from read-only evidence into cleanup in the same task

## Explicit Stop Criteria for the Later Execution

The future DB-read-only execution must stop immediately if:

- DB target is not clearly `chatbot`
- a read-write role would be required
- timeout or limit cannot be applied
- query shape would emit raw PII
- query shape would emit full metadata
- query shape would emit message subject/body material
- the read would require an unbounded scan
- Production health is not green
- the result consumer asks for CSV/JSON export
- cleanup, retry, requeue, delete, or mark-duplicate work becomes necessary to "finish" the task
- the evidence would need to be committed to the repo

If any stop criterion is hit, the correct result is `blocked`, not a risky fallback.

## Not in Scope

`P1.2B-21A` does not introduce or approve:

- SQL execution
- real `DB_READ_ONLY_AUDIT` execution
- Production DB reads
- staging DB reads
- query runner implementation
- repository implementation
- `email_jobs` reads, writes, or updates
- duplicate cleanup
- backfill
- hard delete
- soft delete or mark-duplicate paths
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService.enqueue` changes
- `EmailJobsService.processPendingJobs` changes
- Orchestrator wiring
- worker or SMTP behavior changes
- `report_runs` synchronization changes
- webhook execution
- feature flags
- migration
- deploy

## Evidence Required to Close the Future Execution Task

The future DB-read-only execution task should not be considered complete unless it documents:

- exact commit / environment / DB target context
- read-only role confirmation
- preflight health status
- executed query classes in order
- bounded window, limit, and timeout used for each phase
- sanitized aggregate findings only
- whether later manual review, cleanup planning, or idempotency work is justified
- whether performance or privacy blockers were encountered

## Recommended Next Step

`P1.2B-22A` is now the documented approval / execution decision gate for this line, and `P1.2B-22B` through `P1.2B-22E` completed the pure `EmailJobDuplicateReadOnlyAuditApprovalBoundary` plus production validation on `cfa992b448016545d1fba1bdbaba3af3716991e6`. The line still leaves `DB_READ_ONLY_AUDIT`, staging DB reads, and Production DB reads explicitly not approved, and it adds no SQL, query runner, query results, or report generation.

If this line continues, the next safe step is `P1.2B-23A` as a docs-only staging-read scope / approval-preconditions task only.

Preferred next step:

1. document whether staging read-only audit preparation is allowed
2. document the required staging environment and read-only role
3. document allowed future query classes as categories only
4. document allowed outputs and mandatory stop criteria
5. keep all DB reads, SQL, query runners, query-result handling, reports, cleanup, and backfill out of scope

The main rule remains: `P1.2B-23A` must still not run live DB queries, SQL, query runners, query-result handling, reports, cleanup, or backfill. Actual live duplicate audit execution must stay a separate read-only task with explicit approval, sanitized output, and no cleanup action in the same turn.
