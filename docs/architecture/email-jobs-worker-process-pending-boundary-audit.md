# EmailJobs Worker / processPendingJobs Refactor Boundary Audit

## Summary

P1.2B-15A is a read-only audit for the worker side of e-mail delivery. It documents how `EmailJobsService.processPendingJobs` currently selects, locks, sends, retries, updates, and synchronizes e-mail jobs.

Current state:

- `EmailJobsService.processPendingJobs` is the real worker path.
- It owns job selection, `processing` locking, SMTP execution, retry/status updates, and `report_runs` synchronization.
- `EmailJobsService.enqueue` persists `email_jobs` rows and then starts `processPendingJobs()` as a fire-and-forget trigger.
- A Nest cron trigger also calls `processPendingJobs` every 30 seconds.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` still inserts directly into `email_jobs` and does not call `processPendingJobs`.
- Existing P1.2B boundaries remain pure data-object or validation layers and do not execute queue writes, SMTP sends, worker loops, or public widget behavior.

Recommended next implementation scope:

- P1.2B-15B should still avoid changing `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, SQL, SMTP, retry, locking, status, `report_runs`, or orchestrator wiring.
- The safe next code step is a pure `EmailJobWorkerBoundary` with request/result/plan data objects, validation helpers, no-op/blocked/failed result builders, retry-decision data objects, and audit-safe projections only.

## Current processPendingJobs Worker Behavior

| Method / Function | File | Responsibility | Reads `email_jobs` | Writes `email_jobs` | SMTP / Provider | Locking | Retry / Status | `report_runs` Sync | Error Behavior | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Inserts a queued e-mail job and starts processing | No | Yes, `INSERT INTO email_jobs` | No direct send | No | Initializes `retry_count=0`, `max_attempts` | No | Insert failure throws; processing is fire-and-forget | High, persistence and trigger are coupled |
| `EmailJobsService.processPendingJobs` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Worker loop that drains available queued jobs | Indirectly through `pickNextJob` | Indirectly through `processJob` | Yes, through `ReportMailerService.send` | In-process `isProcessing` guard | Processes until no eligible row remains | Yes, through `syncRelatedRecords` | DB errors outside the per-job send catch can escape | High, real worker path |
| `EmailJobsService.pickNextJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Selects one due job and marks it `processing` | Yes | Yes, `status='processing'`, `locked_at=now()` | No | `FOR UPDATE SKIP LOCKED` | No retry decision | No | Picker DB failure stops processing | High, concurrency boundary |
| `EmailJobsService.processJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Sends mail and sets final/retryable status | Uses picked row | Yes, `sent`, `queued`, or `failed` | Yes | Uses picked row | Increments retry count and schedules retry | Yes | Send failure is caught; status update failure after send remains critical | High |
| `EmailJobsService.syncRelatedRecords` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Syncs report run state for report jobs | No | No | No | No | Maps worker status to report status | Yes | Sync failure propagates from `processJob` | Medium |
| `ReportMailerService.send` | `apps/api/src/modules/widget/services/report-mailer.service.ts` | Performs Nodemailer SMTP send | No | No | Yes | No | No | No | Missing SMTP config or provider error throws | High |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Builds lead notification job and inserts directly | No | Yes, direct `INSERT INTO email_jobs` | No send; config check only | No | Initializes queued job fields | No | Errors are logged; public answer continues | High, bypasses `enqueue` and immediate trigger |

## Job Selection and Locking

Current job selection:

- Selects from `email_jobs`.
- Requires `status = 'queued'`.
- Requires `available_at <= now()`.
- Orders by `available_at ASC, created_at ASC`.
- Limits to one row per picker call.
- Uses `FOR UPDATE SKIP LOCKED`.
- Updates the picked row to `status='processing'`, `locked_at=now()`, `updated_at=now()`.
- Returns job id, kind, recipient, subject, HTML, text, metadata, retry count, and max attempts.

Important boundaries:

- There is no tenant, site, kind, or batch parameter on `processPendingJobs`.
- The worker drains all currently eligible queued jobs one by one.
- The in-process `isProcessing` boolean prevents same-process re-entry only.
- Multi-process contention relies on database row locking.
- Stale `processing` rows are not reclaimed by the picker.
- A process crash after a row becomes `processing` can leave the row locked logically by status even though the DB transaction is gone.

## Status Transition Lifecycle

Current lifecycle:

- New rows are inserted with `status='queued'`.
- The picker sets eligible rows to `status='processing'` and sets `locked_at`.
- On successful SMTP send:
  - `status='sent'`
  - `sent_at=now()`
  - `locked_at=null`
  - `last_error=null`
  - `updated_at=now()`
- On retryable send failure:
  - `status='queued'`
  - `retry_count` increments
  - `available_at` is delayed
  - `locked_at=null`
  - `last_error` stores the error message
  - `updated_at=now()`
- On exhausted send failure:
  - `status='failed'`
  - `retry_count` increments
  - `locked_at=null`
  - `last_error` stores the error message
  - `updated_at=now()`

Schema notes:

- `email_jobs` has `available_at`, `locked_at`, `sent_at`, `last_error`, `created_at`, and `updated_at`.
- There is no separate `failed_at`, `processing_at`, or `completed_at` column.
- `locked_at` doubles as the processing timestamp.
- `sent_at` is the only final success timestamp.

## Retry and Failure Handling

Current retry behavior:

- `retry_count` starts at `0`.
- `max_attempts` defaults to `5`.
- On send failure, `nextRetryCount = retry_count + 1`.
- A job is exhausted when `nextRetryCount >= max_attempts`.
- Retryable failures become `status='queued'`.
- Retry delay is `min(nextRetryCount * 2, 30)` minutes.
- Final failures become `status='failed'`.
- Failed jobs are not selected again by the current picker.

Risks:

- Failed jobs require explicit future policy before any retry/recovery refactor.
- Stale `processing` jobs are not recovered by the current picker.
- A successful SMTP send followed by a failed `email_jobs` status update can create duplicate-send risk if a later recovery retries the row.
- A successful e-mail status update followed by a failed `report_runs` sync can create report-state inconsistency.
- Provider error messages are stored in `last_error` and can also be copied to `report_runs.error_message`.

## SMTP / Provider Boundary

SMTP execution is isolated in `ReportMailerService.send`:

- SMTP config is read from environment variables inside `ReportMailerService`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `REPORTS_FROM_EMAIL` or fallback sender are used as config fields.
- `assertConfigured()` throws if required SMTP configuration is missing.
- Nodemailer transport is created per send.
- `disableFileAccess` and `disableUrlAccess` are enabled.
- `sendMail` receives `from`, `to`, `subject`, `html`, and `text`.
- SMTP/provider errors are wrapped as an internal server error and rethrown.

Risks:

- Provider error strings may include sensitive provider detail and must be sanitized before broader audit/log projections.
- `processPendingJobs` passes real recipient, subject, HTML, and text to the SMTP provider.
- Future worker boundaries must never log full HTML, full text body, SMTP credentials, transport headers, or raw provider config.
- Timeout and partial-success semantics are provider-owned today and not explicitly modeled in worker result data.

## report_runs Sync Boundary

`report_runs` coupling is metadata-based:

- `WidgetAdminReportsService.runReport` creates a `report_runs` row with `status='queued'`.
- It enqueues a `kind='report'` e-mail job with `metadata.reportRunId`.
- `EmailJobsService.syncRelatedRecords` checks that `job.kind === 'report'` and that `metadata.reportRunId` is a string.
- On sent mail, the report run becomes `sent`, `completed_at` is set, and `error_message` is cleared.
- On final failed mail, the report run becomes `failed`, `completed_at` is set, and `error_message` is written.
- On retryable failure, the report run remains or becomes `queued`, and `error_message` is updated.

Risks:

- There is no hard foreign key from `email_jobs` to `report_runs`.
- The relationship depends on JSON metadata shape.
- A send success followed by `report_runs` sync failure can leave mail delivered but report status not sent.
- A report-run sync success followed by a later worker exception can make worker state and report state hard to reason about.
- Lead notifications do not use `report_runs`.

## Current Processing Trigger Locations

| Source | File | Triggers `processPendingJobs` | Writes `email_jobs` | Reads `email_jobs` | SMTP / Worker Involved | Error Impact | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Yes, `void this.processPendingJobs()` | Yes | No | Indirectly | Insert failure throws; processing errors are decoupled | High |
| `EmailJobsService` cron | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Yes, `@Cron('*/30 * * * * *')` | No | Yes | Yes | Worker errors can surface in scheduled path | High |
| `WidgetLeadsService.capture` | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Indirectly through `enqueue` | Indirectly | No | Indirectly | Queue failure is logged; lead remains saved | Medium |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Indirectly through `enqueue` | Indirectly | No | Indirectly | Queue failure is logged; tool result can remain successful with notification false | Medium |
| `WidgetAdminReportsService.runReport` | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Indirectly through `enqueue` | Indirectly | No | Indirectly | Failure sets report run failed and rethrows | Medium to high |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | No | Yes, direct insert | No | No immediate worker | Failure is logged; public answer continues | High |
| Admin lead/report read paths | `apps/api/src/modules/widget/services/widget-admin-leads.service.ts`, report services | No | No | Yes | No | Display only | Low |

## Existing Builders and Boundaries

| Boundary | Current role |
| --- | --- |
| `NotificationSafetyGuard` | Sanitizes/no-ops/validates Delivery-related values; does not execute and writes no queues. |
| `DeliveryPayloadBuilder` | Builds lead/e-mail payload data; does not execute and writes no queues. |
| `DeliverySideEffectCommandBuilder` | Builds `queue_email_job` or `noop` command data objects; does not execute and writes no queues. |
| `DeliveryExecutionBoundary` | Validates commands and builds ExecutionPlan data objects; does not execute and writes no queues. |
| `EmailDeliveryExecutor` Boundary | Validates ExecutionPlans and builds ready/skipped/blocked/failed result data objects; does not execute and writes no queues. |
| `EmailQueueWriteBoundary` | Validates EmailDeliveryExecutionResult and builds EnqueueRequest/EnqueueResult data objects; does not execute and writes no queues. |
| `EmailJobPersistenceBoundary` | Validates EmailQueueWriteResult and builds PersistenceRequest/PersistenceResult data objects; does not execute and writes no queues. |
| `EmailJobProcessingTriggerBoundary` | Validates EmailJobPersistenceResult and builds ProcessingTriggerRequest/ProcessingTriggerResult data objects; does not execute and does not call `processPendingJobs`. |
| `EmailJobsService.processPendingJobs` | Real worker path; owns SMTP, status, retry, locking, and report sync. |

## Idempotency, Duplicate and Recovery Risks

Current idempotency state:

- `email_jobs.id` is a random UUID.
- There is no semantic idempotency key column.
- There is no unique constraint for lead, report run, recipient, conversation, session, or site.
- Correlation data is stored in JSON `metadata`, and the shape differs by caller.
- `WidgetAdminLeadsService` correlates lead e-mail status through `metadata->>'leadId'` or `metadata->>'leadEmail'`, not a hard FK.
- `ToolDispatcherService.executeCaptureLead` dedupes some lead creation by agent-run session and e-mail before enqueueing, but this is not job-level dedupe.
- `ChatAgentOrchestratorService` reduces repeated lead completion with conversation metadata, but its direct queue insert has no job-level dedupe.

Recovery risks:

- Stale `processing` jobs are not selected again.
- There is no current stale-processing recovery policy.
- Duplicate upstream enqueue can create duplicate e-mails.
- Duplicate report triggers can create multiple report jobs.
- Send success plus failed status update is the highest-risk duplicate-send scenario.
- Any future recovery must separate "mail may have been sent" from "mail definitely not sent".

## Error Handling and No-op Behavior

Current no-op behavior:

- Missing lead notification recipient:
  - Orchestrator logs `lead_notification_skipped` with reason `recipient_missing`.
  - Widget lead capture and ToolDispatcher do not enqueue when no recipient is configured.
- SMTP not configured:
  - Orchestrator and Widget lead capture log skip events.
  - ToolDispatcher leaves `queuedNotification=false`.
  - Manual report run fails before queueing through `assertConfigured()`.
- Missing or malformed recipient in `EmailJobsService.enqueue`:
  - The service does not validate e-mail syntax.
  - The DB rejects null but not malformed text.
  - SMTP/provider may fail later.

Current failure behavior:

- Insert failure in `enqueue` throws.
- Send failure is caught in `processJob`, then the job is requeued or marked failed.
- Picker failure can break the worker loop.
- Status update failure after successful send is not separately modeled.
- Report sync failure can propagate from `processJob`.
- Public widget answer text is not changed by notification failures in existing chat paths.

Partial failures to preserve in future tests:

- Job persisted, processing trigger did not run immediately.
- Job processing started, SMTP send failed.
- SMTP send succeeded, `email_jobs` status update failed.
- SMTP send succeeded, `report_runs` sync failed.
- Job marked failed after retries.
- Retry sends duplicate mail after an ambiguous prior attempt.

## Secret and Logging Boundaries

Current sensitive fields:

- `recipient_email`
- `subject`
- `html`
- `text`
- `metadata`
- SMTP environment field names
- Provider error messages

Current logs include:

- `email_job_failed` with job id, kind, recipient field, retry counters, exhausted flag, and error message.
- Lead notification skip/failure events that may include recipient fields.

Future worker boundaries must not log:

- Full recipient values.
- Full HTML or text bodies.
- SMTP host/user/pass values.
- Provider headers.
- Authorization, token, api key, signing secret, or webhook secret fields.
- Full user messages, phone numbers, or free-form contact content.

Safe projections should:

- Redact e-mail addresses.
- Omit full body content.
- Truncate and sanitize provider errors.
- Include only stable job ids, kind, status, retry counters, reason codes, and non-secret correlation references.

## Safe / Unsafe Scope

Safe for P1.2B-15B, if code is allowed:

- Pure `EmailJobWorkerBoundary` types.
- `WorkerSelectionPlan` data objects.
- `StatusTransitionPlan` data objects.
- `RetryDecision` data objects.
- `WorkerResult` data objects.
- Validation helpers for worker plans.
- No-op, blocked, and failed result helpers.
- Audit/log-safe worker result projections.
- No DB dependency.
- No queue writes.
- No SMTP/provider call.
- No `processPendingJobs` call.
- No `EmailJobsService.enqueue` call.
- No productive runtime use.

Unsafe or deferred for P1.2B-15B:

- Actual `EmailJobsService.processPendingJobs` refactor.
- Actual worker-loop code movement.
- Job selection SQL changes.
- Locking changes.
- Status transition changes.
- Retry/attempt behavior changes.
- SMTP/provider execution changes.
- `report_runs` synchronization changes.
- `EmailJobsService.enqueue` changes.
- `queueInternalLeadNotification` rewiring.
- Orchestrator wiring.
- Webhooks or webhook jobs.
- ToolExecutor/ToolDispatcher changes.
- IntegrationDispatcher changes.
- Production wiring.

Separately audit before implementation:

- EmailJobs DB schema and index design.
- E-mail job idempotency key design.
- SMTP provider logging and error redaction.
- Worker retry/locking implementation.
- Stale processing recovery.
- Report delivery processing boundary.
- ToolDispatcher e-mail paths.

## Proposed Boundary Services

### EmailJobWorkerBoundary

Initial scope:

- `WorkerSelectionPlan` data objects.
- `StatusTransitionPlan` data objects.
- `RetryDecision` data objects.
- `WorkerResult` data objects.
- Validation helpers.
- No-op/blocked/failed result builders.
- Audit-safe projections.

Not in initial scope:

- SQL.
- SMTP.
- `processPendingJobs`.
- `EmailJobsService.enqueue`.
- Runtime wiring.

### EmailJobWorkerSafetyGuard

Potential later scope:

- Duplicate-prevention prechecks.
- Stale-processing policy validation.
- Retry/attempt validation.
- Safe logging policy.
- No-op enforcement.

Not in initial scope:

- Worker execution.
- DB writes.
- SMTP sends.

### EmailJobWorkerRepository

Separate future scope only:

- Job selection SQL.
- `FOR UPDATE SKIP LOCKED`.
- Status updates.
- Stale-processing recovery.
- DB tests and rollback plan.

### EmailJobSmtpProviderBoundary

Separate future scope only:

- SMTP/provider call isolation.
- Provider timeout behavior.
- Provider error redaction.
- No raw credentials or raw provider config in logs.

### ReportRunSyncBoundary

Separate future scope only:

- `report_runs` status synchronization.
- Metadata/FK risk handling.
- Partial-failure handling between e-mail send and report-state update.

## Recommended P1.2B-15B Scope

P1.2B-15B should not change `EmailJobsService.processPendingJobs`, `EmailJobsService.enqueue`, SQL, SMTP, `report_runs`, or orchestration.

Recommended code scope:

- Add pure `EmailJobWorkerBoundary` data types and helpers.
- Add `WorkerSelectionPlan`, `StatusTransitionPlan`, `RetryDecision`, and `WorkerResult` objects.
- Add validation helpers for allowed statuses, retry counters, max attempts, and reason codes.
- Add no-op/blocked/failed result builders.
- Add audit-safe projections.
- Add focused tests proving no DB, queue, SMTP, logger, `process.env`, or worker invocation exists.

Explicitly not allowed:

- `processPendingJobs` changes or calls.
- `EmailJobsService.enqueue` changes.
- `email_jobs` insert/update/delete.
- Job selection SQL changes.
- Locking changes.
- Retry/status behavior changes.
- SMTP/provider changes.
- `report_runs` sync changes.
- `queueInternalLeadNotification` rewiring.
- Orchestrator wiring.
- Webhooks.
- ToolExecutor/ToolDispatcher changes.
- IntegrationDispatcher changes.
- Automatic `deliveryChannels` activation.

## Required Tests

Worker plan validation:

- Pending selection plan is valid.
- Invalid status is blocked.
- Missing reason code is blocked.
- Invalid retry decision is blocked.
- No DB or queue execution is possible.

Status transition plan:

- `queued` or selected job to `processing` is represented as a data object.
- `processing` to `sent` is represented as a data object.
- `processing` to `failed` is represented as a data object.
- Retryable failure to future `queued` is represented as a data object.
- No SQL or DB update is executed.

Retry decision:

- `attempts < maxAttempts` is retryable.
- `attempts >= maxAttempts` is final failed.
- Negative or non-finite attempts are blocked.
- Invalid max attempts are blocked.
- No worker start occurs.

Safe projection:

- `recipientEmail` is redacted.
- Body fields are omitted.
- Provider errors are sanitized.
- Secret-like field names are redacted.

No side effects:

- No `email_jobs` insert.
- No `email_jobs` update.
- No DB dependency.
- No queue dependency.
- No `process.env`.
- No logger.
- No mail execution.
- No `EmailJobsService.enqueue`.
- No `processPendingJobs`.
- No SMTP provider.
- No `report_runs` sync.

Regression:

- `EmailJobProcessingTriggerBoundary` tests remain green.
- `EmailJobPersistenceBoundary` tests remain green.
- `EmailQueueWriteBoundary` tests remain green.
- `EmailDeliveryExecutor` Boundary tests remain green.
- `DeliveryExecutionBoundary` tests remain green.
- `DeliverySideEffectCommandBuilder` tests remain green.
- `DeliveryPayloadBuilder` tests remain green.
- `NotificationSafetyGuard` tests remain green.
- Lead-capture builder tests remain green.
- Widget chat flow tests remain green.
- Public widget response shape remains unchanged.
- No unexpected `email_jobs`, `webhook_jobs`, `widget_leads`, or `agent_tickets`.

## Non-goals

- No Conversation Engine public activation.
- No AssistantProfile migration.
- No feature flags.
- No public widget response change.
- No DB migration.
- No queue schema change.
- No `email_jobs` writes or updates.
- No `EmailJobsService.enqueue` refactor.
- No `EmailJobsService.processPendingJobs` refactor.
- No `processPendingJobs` call in P1.2B-15B.
- No worker or SMTP change.
- No `report_runs` sync change.
- No retry, status, locking, or stale-processing recovery change.
- No `webhook_jobs` writes.
- No webhook signing execution.
- No ToolExecutor/ToolDispatcher consolidation.
- No IntegrationDispatcher change.
- No automatic `deliveryChannels` activation.
- No direct external integration.
- No answer text modernization.
- No Orchestrator wiring.
- No production wiring without a separate deploy plan.

## Current Status After P1.2B-16

P1.2B-15B through P1.2B-15E are implemented, merged, deployed API-only, and production-validated. The safe scope was preserved.

The implemented `EmailJobWorkerBoundary` builds only WorkerSelectionPlan, StatusTransitionPlan, RetryDecision, and WorkerResult data objects plus validation helpers and audit/log-safe projections. It introduced no runtime execution, no `processPendingJobs` call, no `EmailJobsService.enqueue` or `EmailJobsService.processPendingJobs` change, no SQL, no DB reads or writes, no `email_jobs` reads, writes, or updates, no Orchestrator wiring, and no Worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` behavior change.

P1.2B-16B through P1.2B-16E are also implemented and production-validated. The implemented `EmailJobStatusPolicyBoundary` adds only pure StatusTransitionPolicy, RetryPolicy, LockingPolicy, StaleProcessingPolicy, PolicyResult, validation, and safe-projection data-object logic. `processPendingJobs`, SQL, Worker/SMTP execution, real `email_jobs` reads/writes/updates, status/retry/locking execution, stale-processing recovery, and `report_runs` synchronization remain not extracted.

Deferred areas remain deferred:

- Real `processPendingJobs` execution.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- SQL, DB reads, and DB writes.
- `email_jobs` reads, writes, and updates.
- Orchestrator wiring.
- Worker and SMTP execution.
- Retry, status, and locking behavior.
- Stale-processing recovery.
- `report_runs` synchronization.
- Webhooks.
- ToolExecutor/ToolDispatcher.
- IntegrationDispatcher.
- Production wiring.

## Recommended Next Step

Proceed with `P1.2B-17A` only as a read-only Email Jobs DB Schema / Idempotency Key Audit. It should not implement code, SQL, DB changes, `email_jobs` reads/writes/updates, `processPendingJobs` refactors, queue writes, worker/SMTP changes, Orchestrator wiring, or production wiring.
## P1.2B-17 Status Note

P1.2B-17 implemented and production-validated `EmailJobIdempotencyBoundary` as a pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection data-object layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, backfill, unique index, constraint, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred.

## P1.2B-18 Status Note

P1.2B-18 implemented and production-validated `EmailJobIdempotencyMigrationPlanBoundary` as a pure enforcement-plan, migration-phase, unique-index-plan, backfill-plan, duplicate-conflict-policy, rollback-plan, validation, result-data, and safe-projection layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, unique index, constraint, backfill, existing duplicate cleanup, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred. Production validation is now green; `production-health-synthetic` returns widget config HTTP 200 with matching `siteKey` in the current baseline.

## P1.2B-19 Status Note

`EmailJobDuplicateAuditPlanBoundary` was implemented in P1.2B-19 as a pure duplicate-audit and cleanup-plan data-object layer and production-validated.

DB reads, SQL, `email_jobs` reads/writes/updates, duplicate cleanup, backfill, unique index or constraint work, idempotency enforcement, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs`, Orchestrator wiring, worker/SMTP execution, `report_runs` synchronization, webhooks, ToolExecutor/ToolDispatcher work, IntegrationDispatcher work, and Production wiring remain deferred.
