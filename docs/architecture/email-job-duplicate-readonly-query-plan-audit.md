# Email Job Duplicate Read-only Query Plan Audit

## Summary

`P1.2B-20A` is a documentation-only audit for a future read-only duplicate review of `email_jobs`.

This step does not execute SQL, does not connect to a database, does not read `email_jobs`, and does not produce any report with live row data. Its purpose is to define a safe query, scope, output, approval, and stop-criteria model for a later dedicated `DB_READ_ONLY_AUDIT` task.

Current documented baseline for this planning step:

- `P1.2B-19` is complete and production-validated.
- `EmailJobDuplicateAuditPlanBoundary` is production-validated as pure data-object logic only.
- `P1.2B-20B` through `P1.2B-20E` are complete and production-validated.
- `EmailJobDuplicateReadOnlyQueryPlanBoundary` is production-validated as pure data-object logic only.
- `P1.2B-21B` through `P1.2B-21E` are complete and production-validated.
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` is production-validated as pure data-object logic only.
- `P1.2B-22B` through `P1.2B-22E` are complete and production-validated.
- `EmailJobDuplicateReadOnlyAuditApprovalBoundary` is production-validated as pure data-object logic only.
- API baseline is documented at commit `cfa992b448016545d1fba1bdbaba3af3716991e6`.
- Main-CI / Docker gate is documented as green on run `29446620828`.
- Production health is documented as green.
- `check-production-health.sh` is documented as green with exit code `0`.
- `production-health-synthetic` is documented as HTTP `200` with matching `siteKey`.
- Migration count is documented as `28`.
- Latest migration is documented as `028_generic_webhook_signing_modes.sql`.
- Production DB target is documented as `chatbot`.
- Production DB drift guard is documented as green with no `soule_demo` recurrence.
- Public widget remains on the legacy pipeline.
- Conversation Engine remains off for the public widget.
- Feature flags remain off.

The current code and architecture indicate multiple duplicate-risk write paths:

- `ChatAgentOrchestratorService.queueInternalLeadNotification` performs a direct `INSERT INTO email_jobs`.
- `EmailJobsService.enqueue` persists queue rows and immediately triggers `processPendingJobs`.
- `WidgetLeadsService.capture` enqueues lead notifications through `EmailJobsService.enqueue`.
- `ToolDispatcherService.executeCaptureLead` enqueues lead notifications through `EmailJobsService.enqueue`.
- `WidgetAdminReportsService.runReport` creates `report_runs` rows and then enqueues report emails with `metadata.reportRunId`.

The same codebase also confirms the current hard boundaries:

- No semantic idempotency key exists in `email_jobs`.
- No unique duplicate-prevention constraint exists in `email_jobs`.
- Correlation data such as `siteId`, `sessionId`, `leadId`, and `reportRunId` is metadata-driven and not first-class schema.
- `EmailJobDuplicateAuditPlanBoundary` remains pure helper logic and is not a query runner, repository, or cleanup executor.

## Current Audit Boundary State

`P1.2B-19` introduced only pure duplicate-audit planning objects and safe projections:

- `EmailJobDuplicateAuditPlanBoundary`
- `DuplicateCandidate`
- `DuplicateRiskGroup`
- `CleanupEligibilityPolicy`
- `DuplicateAuditPlan`
- `CleanupPlan`
- `ManualReviewDecision`
- `DuplicateAuditPlanResult`
- validation helpers
- safe log and audit projections

`P1.2B-19` did not introduce:

- DB reads
- SQL execution
- `email_jobs` reads, writes, or updates
- duplicate cleanup
- backfill
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService.enqueue` refactor
- `EmailJobsService.processPendingJobs` refactor
- Orchestrator wiring
- Production wiring

The current runtime split remains:

- Pure boundaries define safe types, policies, and projections.
- `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` defines execution preconditions, query steps, approval gates, output policies, risk assessments, execution plans, execution results, validation, classification, and safe projections only.
- `EmailJobsService` remains the real persistence and worker executor.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` remains a direct queue writer.
- `report_runs` synchronization remains runtime code inside `EmailJobsService`.

Because those runtime paths are still live and side-effecting, any future duplicate audit must stay explicitly read-only and must not be allowed to drift into cleanup, requeue, or enforcement work.

## Read-only Query Classes

Planned query classes are conceptual only. They are not executable SQL and are not approved for current execution.

| Query Class | Purpose | Candidate Fields | Output Shape | PII Risk | Performance Risk | Approval Needed | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Aggregate by status/kind | Count jobs by `status` and `kind` to size the problem space | `status`, `kind`, optional bounded `created_at` window | counts only by bucket | low | low to medium depending on time range | explicit Production read-only approval for live DB | proposed_only |
| Candidate duplicate by `reportRunId` | Estimate possible report duplicates from metadata correlation | `kind`, `status`, `metadata.reportRunId`, bounded `created_at` | aggregate duplicate bucket counts with pseudonymized identifier class only | medium | high without expression index on `metadata.reportRunId` | explicit Production read-only approval plus sanitized-output review | proposed_only |
| Candidate duplicate by lead/contact/conversation metadata | Estimate source-ID duplicates across lead, contact, or conversation flows | `metadata.siteId`, `metadata.leadId`, `metadata.contactRequestId`, `metadata.conversationId`, `metadata.sessionId`, `kind`, `status` | aggregate counts by normalized source class only | medium | high because metadata scans are likely JSONB scans | explicit Production read-only approval plus query-plan review | proposed_only |
| Candidate duplicate by recipient fingerprint | Estimate clusters by recipient identity without raw mailbox output | derived recipient fingerprint only, plus `kind`, `status` | fingerprint bucket counts only | high unless hashing strategy is pre-approved | medium to high depending on derivation path | separate fingerprinting approval plus Production read-only approval | blocked_until_hashing_strategy |
| Candidate duplicate by content fingerprint | Estimate semantic duplicates by content similarity | derived subject/body fingerprint only, plus `kind`, `status` | fingerprint bucket counts only | very high | high | separate PII and hashing approval plus query-plan review | blocked |
| Status-sensitive duplicate buckets | Split duplicate candidates into `queued`, `processing`, `sent`, and `failed` risk groups | `status`, normalized duplicate class, bounded time window | counts only by risk bucket | low to medium | medium | explicit Production read-only approval | proposed_only |
| Time-window duplicate scan | Detect concentration of duplicates in bounded windows | bounded `created_at`, normalized duplicate key class, `status`, `kind` | counts only by time bucket | low to medium | medium to high without narrow windowing | explicit Production read-only approval plus bounded window requirement | proposed_only |
| Failed/retry ambiguity scan | Separate likely duplicate recreation from legitimate retry behavior | `status`, `retry_count`, `max_attempts`, `available_at`, bounded duplicate class | counts only by ambiguity category | medium | medium | explicit Production read-only approval plus manual-review framing | proposed_only |
| Processing stale ambiguity scan | Detect risk clusters involving `processing` rows without making cleanup claims | `status`, `locked_at`, bounded `created_at`, duplicate class | counts only by stale-risk bucket | low to medium | medium | explicit Production read-only approval plus load-risk review | proposed_only |

Interpretation requirements for the query classes:

- `queued`, `processing`, `sent`, and `failed` must never be collapsed into a single cleanup claim.
- `processing` results are risk indicators only and cannot support any cleanup recommendation.
- `failed` results cannot distinguish retry semantics without manual review.
- `reportRunId` is the strongest currently documented correlation field, but it is still metadata-driven and soft-coupled.
- recipient and content fingerprint classes remain blocked until a separate hashing and privacy decision exists.

PSEUDOCODE - DO NOT RUN

- aggregate class: group by bounded `status` and `kind`, return counts only
- report duplicate class: group by pseudonymized `reportRunId` bucket and status, return counts only
- source metadata class: group by normalized source identifier family and status, return counts only
- stale-processing class: bucket `processing` rows by bounded age ranges, return counts only

## Safe Output and Sanitization Rules

Allowed future output:

- aggregate counts
- status buckets
- kind buckets
- time-window counts
- risk-group counts
- pseudonymized or fingerprinted identifiers only if separately approved
- reason codes
- query-class names
- safe Markdown summaries
- safe tables with counts only

Forbidden future output:

- raw `recipient_email`
- raw `recipientEmail`
- `subject`
- `html`
- `text`
- `body`
- payload bodies
- full `metadata`
- raw `last_error`
- raw provider or SMTP errors
- full `reportRunId` if sensitivity is not cleared
- full lead, contact, conversation, or session identifiers when sensitivity is unclear
- customer names
- raw URLs with tokens
- full row dumps
- committed CSV or JSON exports
- committed query results

Sanitization rules for any later DB-read task:

- never emit raw mailbox values
- never emit subject or body material
- never emit full metadata blobs
- never emit raw error strings
- prefer counts over identifiers
- if identifiers are unavoidable, use a separately approved pseudonymization or hashing rule
- keep outputs ephemeral and local unless an explicit follow-up approval permits a different handling path

## Query Safety Gates

Before any real DB-read task is allowed, all of the following gates must pass:

- separate task with change class `DB_READ_ONLY_AUDIT`
- explicit approval for Production DB read
- explicit confirmation that the DB target is `chatbot`
- no write capability in the chosen DB role
- read-only transaction mode if technically available
- no `SELECT *`
- no raw PII columns in output
- no subject, `html`, `text`, or body output
- no full metadata output
- bounded `LIMIT` and bounded time window
- explicit query timeout
- explicit load-risk assessment
- sanitized output review before any result is shared
- no committed query results
- no customer data in the PR

Any future query plan that cannot satisfy those gates is out of scope by default.

## Performance and Index Risks

Current schema and code imply the following likely performance profile:

- `email_jobs_status_available_idx` supports status plus availability lookups, not duplicate correlation.
- `email_jobs_kind_created_idx` supports kind plus creation-time ordering, not duplicate correlation.
- no documented index exists for `metadata.reportRunId`.
- no documented index exists for `metadata.leadId`, `metadata.contactRequestId`, `metadata.conversationId`, or `metadata.sessionId`.
- no documented first-class correlation columns exist for `siteId`, `leadId`, `contactRequestId`, `conversationId`, `sessionId`, or `reportRunId`.

Primary risk areas:

- `metadata.reportRunId` scans are likely expensive without an expression index.
- generic metadata correlation queries are likely JSONB-heavy and may degrade into full scans.
- recipient-based scans are PII-sensitive even before performance is considered.
- subject, `html`, `text`, and body-derived scans are both expensive and privacy-sensitive.
- unbounded time-range aggregation is unsafe without query-plan review.
- `processing` or retry ambiguity scans may require careful time windows to avoid noisy and expensive reads.

Required future constraints:

- always use bounded time windows
- always use explicit limits
- avoid broad metadata scans without a prior performance review
- avoid peak-load execution windows
- treat full-table aggregation as blocked unless separately approved with a query-plan review

## Approval Model

Required approval layers for later work:

| Future activity | Approval model |
| --- | --- |
| Doku-only query planning | no DB approval required |
| Read-only staging query | separate explicit approval |
| Read-only Production query | separate explicit approval |
| Recipient hashing or fingerprinting strategy | separate explicit approval |
| Content hashing strategy | separate explicit approval |
| Report generation from query results | separate explicit approval |
| Cleanup planning with live results | separate explicit approval |
| Cleanup execution | separate explicit approval |
| Backfill | separate explicit approval |
| Migration or index work | separate explicit approval |
| Idempotency enforcement | separate explicit approval |

No lower approval tier implicitly unlocks the next one.

## Stop Criteria for Future DB Reads

Stop before a real DB read if any of the following is true:

- DB target context is unclear
- DB target is not confirmed as `chatbot`
- no read-only role is available
- query shape includes `SELECT *`
- planned output includes raw PII
- planned output includes `subject`, `html`, `text`, or body material
- planned output includes full metadata
- query has no explicit limit or no explicit time window
- query is likely to cause a full-table scan and performance risk is not signed off
- query results are intended to be committed
- reports would contain customer data
- cleanup, update, or delete work would be required to finish the task
- approval is missing

If any stop criterion is hit, the task should terminate as blocked rather than continue with a risky fallback.

## Existing Builders and Boundaries

Current pure boundaries:

- `EmailJobDuplicateAuditPlanBoundary` builds duplicate candidates, risk groups, cleanup eligibility, manual-review decisions, plan objects, and safe projections only
- `EmailJobIdempotencyBoundary` defines idempotency-key and dedupe data-object logic only
- `EmailJobIdempotencyMigrationPlanBoundary` defines migration and enforcement planning data objects only
- `EmailJobStatusPolicyBoundary` defines status, retry, locking, and stale-processing policy data objects only
- `EmailJobWorkerBoundary` defines worker selection, transition, retry, and result data objects only
- `EmailQueueWriteBoundary` defines queue-write request and validation objects only
- `EmailJobPersistenceBoundary` defines persistence request and validation objects only
- `EmailJobProcessingTriggerBoundary` defines trigger request and validation objects only

Current side-effecting runtime components:

- `EmailJobsService` performs real queue persistence, worker selection, status transitions, retry handling, SMTP send execution, and `report_runs` synchronization
- `ChatAgentOrchestratorService.queueInternalLeadNotification` performs a direct `email_jobs` insert
- `WidgetLeadsService.capture` and `ToolDispatcherService.executeCaptureLead` enqueue real lead notifications
- `WidgetAdminReportsService.runReport` creates real `report_runs` rows and enqueues real report jobs

Deferred components that do not exist as approved runtime in this step:

- DB audit repository for duplicate queries
- query runner for `email_jobs` duplicate audits
- live duplicate report generator
- cleanup executor
- backfill runner

## Safe / Unsafe Scope

### Safe scope in this planning step

- read-only code analysis
- read-only documentation analysis
- read-only migration and schema analysis from files
- documentation of future query classes
- documentation of sanitization rules
- documentation of approval gates
- documentation of stop criteria
- documentation of performance risks

### Unsafe or deferred scope

- real SQL execution
- real DB connection
- Production DB reads
- staging DB reads without explicit approval
- query runner code
- repository code
- `email_jobs` reads, writes, or updates
- `report_runs` reads or writes for duplicate auditing
- CSV or JSON exports
- committed query results
- duplicate cleanup
- backfill
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService.enqueue` changes
- `processPendingJobs` changes
- Orchestrator wiring
- Production wiring

## Proposed Boundary Services

If a later `P1.2B-20B` code-only planning step is approved, the safe pure-boundary candidates are:

| Boundary service | Purpose | Allowed in `P1.2B-20B` |
| --- | --- | --- |
| `EmailJobDuplicateReadOnlyQueryPlanBoundary` | define query-class plan objects and validation only | yes |
| `EmailJobDuplicateQuerySafetyGateBoundary` | define safety-gate objects and validation only | yes |
| `EmailJobDuplicateQueryOutputPolicyBoundary` | define safe output policy objects and validation only | yes |
| `EmailJobDuplicateQueryApprovalBoundary` | define approval requirement objects and validation only | yes |
| `EmailJobDuplicateQueryRiskBoundary` | define risk-assessment objects and validation only | yes |
| `EmailJobDuplicateAuditRepository` | actual DB-read query execution | no |
| `EmailJobDuplicateAuditReportBuilder` | result rendering from live rows | no |
| `EmailJobDuplicateCleanupRunner` | cleanup execution | no |

## Recommended P1.2B-20B Scope

Safe recommended scope for `P1.2B-20B`, if code work is explicitly allowed:

- pure `EmailJobDuplicateReadOnlyQueryPlanBoundary`
- `QueryClassPlan` data objects
- `QuerySafetyGate` data objects
- `QueryOutputPolicy` data objects
- `QueryApprovalRequirement` data objects
- `QueryRiskAssessment` data objects
- validation helpers
- safe projection helpers
- no productive runtime usage
- no SQL
- no DB reads
- no DB writes
- no `email_jobs` reads, writes, or updates
- no report generation
- no cleanup
- no backfill

Still not safe for `P1.2B-20B`:

- actual SQL queries
- Production DB reads
- staging DB reads without explicit approval
- query runner implementation
- repository implementation
- report export
- CSV or JSON output artifacts
- `email_jobs` reads
- cleanup
- backfill
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService` changes
- `processPendingJobs` changes
- Orchestrator wiring

Separate audits remain required for:

- actual read-only DB query execution plan
- recipient hashing and fingerprinting strategy
- content hashing strategy
- query performance review
- report handling and no-commit policy
- manual review process
- cleanup runbook

## Required Tests

Future pure-boundary tests for `P1.2B-20B` should cover at least:

- QueryClassPlan validation:
  - aggregate count plan valid
  - `reportRunId` duplicate plan valid
  - recipient fingerprint plan blocked without approved strategy
  - content fingerprint plan blocked without approved strategy
  - no raw row output allowed
- QuerySafetyGate:
  - requires read-only approval
  - blocks `SELECT *`
  - blocks raw PII output
  - blocks queries without limit
  - blocks unbounded metadata scans
- QueryOutputPolicy:
  - aggregate-only output allowed
  - raw recipient blocked
  - subject, `html`, `text`, and body blocked
  - full metadata blocked
  - raw `last_error` blocked
- QueryRiskAssessment:
  - JSON metadata scan marked high risk
  - content scan marked blocked or high risk
  - time-window requirement enforced
- No side effects:
  - no DB dependency
  - no SQL execution
  - no query runner
  - no `process.env`
  - no logger output with PII
  - no `email_jobs` repository
  - no report artifact generation

## Non-goals

Non-goals for `P1.2B-20A`:

- no Production DB query
- no DB reads
- no DB writes
- no SQL execution
- no SQL files
- no `email_jobs` reads, writes, or updates
- no `SELECT *`
- no query runner
- no reports with data
- no CSV or JSON exports
- no commit of query results
- no duplicate cleanup
- no backfill
- no hard delete
- no soft delete or mark-duplicate path
- no unique index
- no constraint
- no idempotency enforcement
- no `EmailJobsService.enqueue` refactor
- no `processPendingJobs` refactor
- no Orchestrator wiring
- no Production wiring
- no migration
- no feature flags
- no public widget response change
- no Conversation Engine live activation
- no customer-site mutation
- no NOLIS-specific logic

## Recommended Next Step

`P1.2B-20A` through `P1.2B-20E`, `P1.2B-21B` through `P1.2B-21E`, `P1.2B-22A` through `P1.2B-22E`, and `P1.2B-23A` are now complete. The approval decision gate, the pure `EmailJobDuplicateReadOnlyAuditApprovalBoundary`, and the staging-read-only scope / preconditions document are in place, and the next safe step is `P1.2B-23B` as a pure staging-scope-boundary task.

That next step should decide only:

- whether a real `DB_READ_ONLY_AUDIT` is approved
- which environment is allowed first
- which read-only role is required
- which query classes are allowed
- which outputs are allowed
- which stop criteria are mandatory

`P1.2B-23B` must still remain outside runtime code, SQL execution, `email_jobs` reads or writes, query runners, reports with live data, cleanup, backfill, unique index or constraint work, and idempotency enforcement unless a later explicit DB-read-only audit assignment approves more.
