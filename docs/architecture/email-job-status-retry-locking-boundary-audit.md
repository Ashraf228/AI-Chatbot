# Email Job Status / Retry / Locking Boundary Audit

## Summary

P1.2B-16A is a read-only audit for the `email_jobs` status, retry, and locking lifecycle. It documents the current `EmailJobsService.processPendingJobs` behavior and scopes a later boundary step without changing runtime code.

No code, SQL, deployment, migration, feature flag, production config, public widget response, SMTP behavior, queue write, or worker behavior is changed by this document.

The current production-validated refactor line already has pure data-object boundaries through `EmailJobWorkerBoundary`. Those boundaries do not execute SQL, read or write `email_jobs`, call `processPendingJobs`, send mail, or update `report_runs`. The real worker path remains `EmailJobsService.processPendingJobs`.

## Current Status Fields and Schema

### email_jobs

Source: `apps/api/migrations/002_email_jobs.sql`

| Table | Field | Type | Default | Nullable | Index/Constraint | Usage in code | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `email_jobs` | `id` | `TEXT` | none | no | primary key | Generated with `randomUUID()` in `EmailJobsService.enqueue`; used for updates | No semantic idempotency key; duplicates are possible at job level if callers enqueue twice. |
| `email_jobs` | `kind` | `TEXT` | none | no | `email_jobs_kind_created_idx` with `created_at` | `lead_notification` or `report`; report jobs trigger `report_runs` sync | Free-form DB type; no DB enum/check constraint. |
| `email_jobs` | `status` | `TEXT` | `queued` | no | `email_jobs_status_available_idx` with `available_at` | Worker selects `queued`, sets `processing`, `sent`, `queued`, or `failed` | Free-form DB type; status matrix is enforced only in code. |
| `email_jobs` | `recipient_email` | `TEXT` | none | no | none | Used as `to` for `ReportMailerService.send`; logged on failure | Contains personal data; current failure log includes recipient. |
| `email_jobs` | `subject` | `TEXT` | none | no | none | Used for mail send | May include user/site context. |
| `email_jobs` | `html` | `TEXT` | none | yes | none | Used for mail send | Body content must not be logged. |
| `email_jobs` | `text` | `TEXT` | none | yes | none | Used for mail send | Body content must not be logged. |
| `email_jobs` | `metadata` | `JSONB` | `{}` | no | none | Used for `reportRunId`; may also carry site/session/lead correlation from enqueue callers | No schema validation at DB level; sensitive metadata must be controlled by callers. |
| `email_jobs` | `retry_count` | `INTEGER` | `0` | no | none | Incremented only on send failure path | No DB constraint for non-negative values. |
| `email_jobs` | `max_attempts` | `INTEGER` | `5` | no | none | Inserted from input or default; compared to next retry count | No DB constraint for positive values. |
| `email_jobs` | `available_at` | `TIMESTAMPTZ` | `now()` | no | `email_jobs_status_available_idx` | Worker selects jobs with `available_at <= now()`; retry updates it | Delay policy is code-only. |
| `email_jobs` | `locked_at` | `TIMESTAMPTZ` | `null` | yes | none | Set on pick; cleared on sent/retry/failed | No stale lock recovery currently visible. |
| `email_jobs` | `sent_at` | `TIMESTAMPTZ` | `null` | yes | none | Set on success | No explicit failed timestamp exists. |
| `email_jobs` | `last_error` | `TEXT` | `null` | yes | none | Cleared on success; set on failure | Provider/SMTP errors may contain details; safe projection is needed before logs/audit. |
| `email_jobs` | `created_at` | `TIMESTAMPTZ` | `now()` | no | `email_jobs_kind_created_idx` | Used for stable pick ordering after `available_at` | Low. |
| `email_jobs` | `updated_at` | `TIMESTAMPTZ` | `now()` | no | none | Updated on pick, success, retry, final failure | Low. |

There are no explicit `tenant_id`, `site_id`, `session_id`, `conversation_id`, `lead_id`, `contact_request_id`, or `report_run_id` columns in `email_jobs`. Correlation is carried in `metadata` where callers include it.

### report_runs

Source: `apps/api/migrations/001_initial_schema.sql`

| Table | Field | Type | Default | Nullable | Index/Constraint | Usage in code | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `report_runs` | `id` | `TEXT` | none | no | primary key | Inserted before report email enqueue; referenced by `email_jobs.metadata.reportRunId` | Coupling is metadata-only; no FK from `email_jobs`. |
| `report_runs` | `site_id` | `TEXT` | none | yes | FK to `sites(id) ON DELETE SET NULL`; `report_runs_site_created_idx` | Report scoping and admin reads | Site can become null on delete. |
| `report_runs` | `frequency` | `TEXT` | none | no | none | Report display / generation | Free-form. |
| `report_runs` | `trigger_source` | `TEXT` | `manual` | no | none | Manual report runs | Free-form. |
| `report_runs` | `status` | `TEXT` | `queued` | no | none | Updated to `sent`, `failed`, or `queued` by `EmailJobsService.syncRelatedRecords` | Can diverge from `email_jobs` if sync fails after job status update. |
| `report_runs` | `recipient_email` | `TEXT` | none | yes | none | Report recipient record | Contains personal data. |
| `report_runs` | `report_subject` | `TEXT` | none | yes | none | Report display | May include site name. |
| `report_runs` | `error_message` | `TEXT` | none | yes | none | Set on report build/enqueue failure or email send failure/retry | Error text needs sanitizing if exposed. |
| `report_runs` | `created_at` | `TIMESTAMPTZ` | `now()` | no | `report_runs_site_created_idx` | Ordering | Low. |
| `report_runs` | `completed_at` | `TIMESTAMPTZ` | none | yes | none | Set on sent/failed | Retry-to-queued leaves `completed_at` unchanged. |

## Current Status Transition Lifecycle

Source: `apps/api/src/modules/widget/services/email-jobs.service.ts`

| Transition | Trigger | Preconditions | Previous status | Next status | Fields changed | Retry impact | Error path | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| insert queued | `EmailJobsService.enqueue` | Caller provides `kind`, recipient, subject, body, metadata | none | `queued` | Inserts `retry_count=0`, `max_attempts`, `available_at=now()`, timestamps | Starts at zero attempts | Insert error throws to caller | No semantic dedupe; enqueue immediately schedules async processing. |
| queued -> processing | `pickNextJob` inside worker loop | `status='queued'` and `available_at <= now()` | `queued` | `processing` | `locked_at=now()`, `updated_at=now()` | none | DB error escapes worker loop and clears in-memory flag in `finally` | Atomicity depends on single `UPDATE ... FROM next_job`; no explicit transaction wrapper is visible. |
| processing -> sent | `processJob` after mail send succeeds | Mail send completed | `processing` | `sent` | `sent_at=now()`, `locked_at=null`, `last_error=null`, `updated_at=now()` | no retry | If status update fails after send succeeds, duplicate mail risk exists on later recovery/manual intervention | Provider send success and DB update are not atomic. |
| processing -> queued | `processJob` catch path | Mail send failed and next retry not exhausted | `processing` | `queued` | `retry_count=nextRetryCount`, `available_at=now()+delay`, `locked_at=null`, `last_error=message`, `updated_at=now()` | increments retry count | If update fails, job can remain `processing` with stale `locked_at` | No stale recovery currently visible. |
| processing -> failed | `processJob` catch path | Mail send failed and next retry exhausted | `processing` | `failed` | `retry_count=nextRetryCount`, `locked_at=null`, `last_error=message`, `updated_at=now()` | final failure | If update fails, job can remain `processing` | No failed timestamp field. |
| queued remains queued | Worker skip | `available_at > now()` or no queued rows | `queued` | `queued` | none | no retry | none | Future jobs are skipped by selection query. |
| failed remains failed | Worker selection | Worker selects only `queued` | `failed` | `failed` | none | no retry | none | No admin requeue path identified in this audit. |
| stale processing | Not implemented in current service | API restart or failure after `processing` update | `processing` | unchanged | none | none | Job may remain stuck | No stale processing recovery path found. |

## Current Retry Policy

| Retry case | Condition | retry_count | max_attempts | Delay | Next status | Final failed when | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| first retryable send failure | Send throws, `retry_count + 1 < max_attempts` | incremented by 1 | DB row value or fallback `5` | `min(nextRetryCount * 2, 30)` minutes | `queued` | no | Delay formula is code-only and not DB-constrained. |
| repeated retryable send failure | Send throws repeatedly before exhaustion | incremented by 1 per caught failure | DB row value or fallback `5` | capped at 30 minutes | `queued` | no | Same provider timeout and SMTP errors are treated the same. |
| final failure | Send throws and `nextRetryCount >= max_attempts` | incremented by 1 | DB row value or fallback `5` | none | `failed` | yes | No failed timestamp; only `updated_at` and `last_error`. |
| invalid retry_count / max_attempts | Not explicitly validated in service | coerced with `Number(...)` fallback behavior | fallback `5` only for falsy `max_attempts` | computed if retry path proceeds | `queued` or `failed` | implementation-dependent | Pure `EmailJobWorkerBoundary` validates these as data, but service does not use it. |
| future available_at | `available_at > now()` | unchanged | unchanged | existing future time | remains `queued` | no | Correctly skipped by selection query. |
| failed jobs | `status='failed'` | unchanged | unchanged | none | remains `failed` | final | No automatic requeue. |

The pure `EmailJobWorkerBoundary` already has deterministic `RetryDecision` data objects and caps normalized retry delay at 30 minutes. That boundary is not wired into `EmailJobsService`.

## Current Locking Boundary

| Locking aspect | Current state | Protection | Not covered | Risk | Test need |
| --- | --- | --- | --- | --- | --- |
| Selection query | `WITH next_job AS (...) UPDATE email_jobs ... FROM next_job RETURNING ...` | Pick and status update are one SQL statement | No explicit transaction wrapper in service | Depends on database statement semantics | Unit/integration test for SQL shape and behavior. |
| Lock mode | `FOR UPDATE SKIP LOCKED` in `next_job` CTE | Parallel workers should skip locked selected rows | No direct parallel-worker test found | Race behavior not regression-locked | DB-backed concurrency test. |
| Batch size | `LIMIT 1` | One job per pick iteration | No configurable batch validation in service | Low throughput but simpler semantics | Pure policy can validate limit. |
| In-process guard | `private isProcessing = false` | Prevents concurrent loops inside one Node process | Does not coordinate across processes/containers | Multi-instance concurrency relies on DB lock only | Multi-process test if production scales worker instances. |
| API restart during transaction | DB statement should rollback if interrupted before commit | Database handles statement atomicity | Not documented/tested | Low/medium | DB-backed failure test only if needed. |
| API restart after `processing` | Job remains `processing` with `locked_at` | None found | No stale processing recovery | Stuck email job risk | Stale processing policy audit/test. |
| Processing timeout | No timeout field beyond `locked_at` | None | No recovery job/admin requeue identified | Stuck job risk | Stale threshold design required. |
| Admin requeue | Not identified | none | No manual recovery path in audited files | Operational burden | Separate admin recovery audit. |

## Stale Processing Recovery

No stale-processing recovery path was found in `EmailJobsService.processPendingJobs`.

Observed behavior:

- `locked_at` is set when a job is picked.
- `locked_at` is cleared only after success or failure handling reaches an update.
- Worker selection only considers `status='queued'`.
- A job left in `processing` is not selected again by the current worker.

Risk:

- If the API process stops or the DB update fails after `queued -> processing`, the job can remain in `processing`.
- If mail send succeeds but the `processing -> sent` update fails, later manual or automated recovery could duplicate delivery unless idempotency is designed first.

## Idempotency and Duplicate Risks

| Question | Current answer | Risk |
| --- | --- | --- |
| Semantic idempotency key exists? | Not in `email_jobs` schema. | Duplicate jobs can exist for the same semantic event. |
| Unique constraint against duplicate email jobs? | Not found. | No DB-level dedupe. |
| Correlation columns exist? | No explicit columns for site/session/conversation/lead/report; correlation is metadata-only. | Harder to query and constrain. |
| Lead/report dedupe before enqueue? | Some caller-specific dedupe exists outside this service; not a generic job-level guarantee. | Duplicates possible if caller retries enqueue. |
| Can same job be sent twice? | Normal path avoids it after `sent`; send-success/status-update-failure can create duplicate risk if recovered incorrectly. | Requires idempotency design before stale recovery. |
| Provider-level idempotency? | Not visible in `ReportMailerService` boundary from this audit. | Provider duplicate protection unknown. |
| Audit marker for duplicates? | Not found as generic job-level marker. | Duplicate detection is operationally harder. |

## report_runs Interaction

Report jobs are created by `WidgetAdminReportsService.runReport`:

- `report_runs` row is inserted with `status='queued'`.
- `EmailJobsService.enqueue` is called with `kind='report'`.
- `metadata.reportRunId` links the email job to the report run.

`EmailJobsService.syncRelatedRecords` updates report runs after email status changes:

| Email job status path | report_runs update | Timing | Risk |
| --- | --- | --- | --- |
| `sent` | `status='sent'`, `completed_at=now()`, `error_message=null` | After `email_jobs` is updated to `sent` | If report sync fails, email job is sent but report remains stale. |
| retry `queued` | `status='queued'`, `error_message='Queued for retry'` or error message | After `email_jobs` is updated back to `queued` | Report can show queued while email job waits for future `available_at`. |
| final `failed` | `status='failed'`, `completed_at=now()`, error message | After `email_jobs` is updated to `failed` | If report sync fails, report and email job diverge. |

There is no hard foreign key from `email_jobs.metadata.reportRunId` to `report_runs.id`. The coupling is convention-based and should remain unchanged until a separate schema/index/idempotency plan exists.

## Error Handling and No-op Behavior

| Case | Current behavior | User response affected | Admin visible | Auditability / risk |
| --- | --- | --- | --- | --- |
| Missing recipient before enqueue | Callers may block before enqueue; `email_jobs.recipient_email` is NOT NULL | Depends on caller | Usually visible as setup/report error | No generic worker no-op. |
| Invalid email address | No validation in `EmailJobsService.enqueue` beyond caller behavior | Depends on mailer/provider | Failure path records `last_error` | Needs validation boundary before queue writes if changed. |
| Missing SMTP/provider config | `ReportMailerService.send` can throw | Public widget answer should not change for async jobs | `last_error` and logs | Failure log currently includes recipient and error message. |
| Provider timeout / SMTP failure | Caught in `processJob`; retry or final failed | Public widget answer should not change | `email_jobs.last_error`, retry_count, report_runs status | Same retry policy for all provider errors. |
| DB error on pick | Escapes worker loop, in-memory flag clears | No direct public response impact | Logs depend on Nest/runtime | Job remains queued if update fails before commit. |
| DB error after send success | Escapes catch? The send is inside `try`; DB success update failure is caught as error and retry update is attempted | Potential duplicate risk later | Could log failure and set retry path | High-risk edge because send may already have happened. |
| DB error on retry/fail update | Escapes catch path | No direct public response impact | Runtime logs | Job can remain `processing`. |
| report_runs sync error | Occurs after email job update | No direct public response impact | Runtime logs | `email_jobs` and `report_runs` can diverge. |
| Invalid body/payload | Mailer/provider may throw or caller may block | Depends on caller | Failure path | Body must not be logged. |
| Metadata invalid | `metadata` is JSONB; service only checks `reportRunId` shape for report sync | No direct public response impact | Limited | Missing reportRunId skips report sync. |

## Secret and Logging Boundaries

Current `EmailJobsService` failure logging includes:

- `jobId`
- `kind`
- `recipientEmail`
- `retryCount`
- `maxAttempts`
- `exhausted`
- `error`

Current service does not log `html` or `text` body fields in the audited failure log. It does log recipient email and raw error message. SMTP config/secrets are not logged directly in this service, but provider errors must still be treated as potentially sensitive.

Existing safe projections:

- `NotificationSafetyGuard` sanitizes delivery data.
- `EmailDeliveryExecutor` Boundary provides safe e-mail result projections.
- `EmailQueueWriteBoundary` provides safe queue request/result projections.
- `EmailJobPersistenceBoundary` provides safe persistence request/result projections.
- `EmailJobProcessingTriggerBoundary` provides safe trigger request/result projections.
- `EmailJobWorkerBoundary` provides safe worker selection, status transition, retry decision, and worker result projections.

A later Status/Retry/Locking boundary should reuse the same redaction approach and must not expose recipient email, subject/body content, provider error text, SQL text, secrets, or full metadata in generic logs.

## Existing Builders and Boundaries

| Boundary | Current role | Executes side effects? | Writes queues or DB? |
| --- | --- | --- | --- |
| `NotificationSafetyGuard` | Sanitizes delivery config/payloads and builds no-op decisions | no | no |
| `DeliveryPayloadBuilder` | Builds email/lead payload data | no | no |
| `DeliverySideEffectCommandBuilder` | Builds `queue_email_job` / `noop` command data | no | no |
| `DeliveryExecutionBoundary` | Validates commands and builds ExecutionPlan data | no | no |
| `EmailDeliveryExecutor` Boundary | Validates ExecutionPlans and builds result data | no | no |
| `EmailQueueWriteBoundary` | Validates e-mail delivery results and builds queue request/result data | no | no |
| `EmailJobPersistenceBoundary` | Validates queue results and builds persistence request/result data | no | no |
| `EmailJobProcessingTriggerBoundary` | Validates persistence results and builds processing trigger request/result data | no | no |
| `EmailJobWorkerBoundary` | Builds WorkerSelectionPlan, StatusTransitionPlan, RetryDecision, and WorkerResult data | no | no |
| `EmailJobsService.processPendingJobs` | Real worker, SQL, SMTP, status, retry, locking, and report sync path | yes | yes |

## Safe / Unsafe Scope

### Safe for P1.2B-16B if code is allowed

- Pure `EmailJobStatusPolicyBoundary` types.
- `StatusTransitionPolicy` data objects.
- `RetryPolicy` data objects.
- `LockingPolicy` data objects.
- `StaleProcessingPolicy` data objects.
- Validation helpers.
- `noop`, `blocked`, and `failed` result helpers.
- Log/audit-safe PolicyResult projections.
- No productive runtime usage.
- No SQL.
- No DB or queue reads.
- No DB or queue writes.
- No `email_jobs` reads, writes, or updates.
- No `processPendingJobs` call.
- No SMTP/provider call.
- No `EmailJobsService.enqueue` call.

### Not safe for P1.2B-16B

- Status transition SQL changes.
- `queued -> processing` SQL changes.
- `processing -> sent` SQL changes.
- `retry_count` / `available_at` update changes.
- `FOR UPDATE SKIP LOCKED` query changes.
- Stale processing recovery implementation.
- `processPendingJobs` changes or calls.
- `EmailJobsService.enqueue` changes.
- Worker/SMTP execution changes.
- `report_runs` sync changes.
- `email_jobs` schema changes.
- Idempotency key introduction.
- Orchestrator wiring.
- Production wiring.

### Separate audits needed

- EmailJobs DB schema / index audit.
- Email Job idempotency key design.
- Email Worker SMTP provider boundary.
- Email Worker status transition implementation plan.
- `report_runs` sync refactor audit.
- Stale processing recovery design.

## Proposed Boundary Services

### EmailJobStatusPolicyBoundary

- StatusTransitionPolicy data objects.
- Allowed transition matrix.
- Transition validation.
- Safe projection.
- No SQL.

### EmailJobRetryPolicyBoundary

- RetryDecision data objects.
- `maxAttempts` and delay validation.
- `final_failed` decision.
- Safe projection.
- No DB update.

### EmailJobLockingPolicyBoundary

- LockingPolicy data objects.
- Lock mode validation.
- Batch/limit validation.
- Stale-processing policy as data.
- No SQL.

### EmailJobStaleProcessingPolicyBoundary

- Stale threshold data.
- Recovery candidate data.
- Recovery decision data.
- No requeue in the first step.

### EmailJobStatusRepository

Later separate module only:

- Actual SQL updates.
- DB-backed locking.
- DB-backed retry/status updates.
- Only after DB, idempotency, rollback, and test plan approval.

## Recommended P1.2B-16B Scope

Recommended option: P1.2B-16B should still include no SQL, no DB access, and no `email_jobs` updates.

Safe scope:

- `EmailJobStatusPolicyBoundary` interface / types.
- `StatusTransitionPolicy` data objects.
- `RetryPolicy` data objects.
- `LockingPolicy` data objects.
- `StaleProcessingPolicy` data objects.
- Validation, no-op, blocked, and failed helpers.
- Log/audit-safe PolicyResult projections.
- No DB or queue reads.
- No DB or queue writes.
- No `processPendingJobs`.
- No SMTP/provider call.
- No `EmailJobsService.enqueue`.
- No Orchestrator usage.
- No productive wiring.

Not allowed:

- `email_jobs` reads, writes, or updates.
- SQL.
- `FOR UPDATE SKIP LOCKED` query changes.
- Status transition execution.
- Retry update execution.
- Locking changes.
- Stale processing recovery execution.
- `processPendingJobs` changes or calls.
- `EmailJobsService.enqueue` changes.
- `EmailJobsService.processPendingJobs` changes.
- Worker/SMTP changes.
- `report_runs` sync changes.
- `queueInternalLeadNotification` rewiring.
- Orchestrator wiring.
- Webhooks.
- ToolExecutor/ToolDispatcher.
- IntegrationDispatcher.
- Automatic `deliveryChannels` activation.

## Required Tests

### Status Transition Policy

- `queued -> processing` is allowed.
- `processing -> sent` is allowed.
- `processing -> retry_queued` is allowed.
- `processing -> failed` is allowed.
- `sent -> processing` is blocked.
- `failed -> processing` is blocked.
- Unknown status is blocked.
- No DB update occurs.

### Retry Policy

- `retry_count < max_attempts` is retryable.
- `retry_count >= max_attempts` is `final_failed`.
- Invalid `retry_count` is blocked.
- Invalid `max_attempts` is blocked.
- Delay is deterministic and capped.
- No `available_at` update occurs.

### Locking Policy

- `for_update_skip_locked` lock mode is allowed as a data object.
- Invalid lock mode is blocked.
- Limit `1` is valid.
- Batch size above safe limit is blocked.
- No SQL occurs.

### Stale Processing Policy

- `processing` older than threshold returns recovery candidate data.
- Fresh `processing` returns no-op.
- `sent` and `failed` are not recovery candidates.
- No requeue occurs.

### Safe Projection

- No recipient email leak.
- No body leak.
- No provider error leak.
- No SQL leak.
- No secrets.

### No Side Effects

- No `email_jobs` reads.
- No `email_jobs` updates.
- No DB dependency.
- No queue dependency.
- No `process.env`.
- No logger.
- No mail execution.
- No `EmailJobsService.enqueue`.
- No `processPendingJobs`.
- No SMTP provider.
- No `report_runs` sync.

### Regression

- `EmailJobWorkerBoundary` tests remain green.
- `EmailJobProcessingTriggerBoundary` tests remain green.
- `EmailJobPersistenceBoundary` tests remain green.
- `EmailQueueWriteBoundary` tests remain green.
- `EmailDeliveryExecutor` Boundary tests remain green.
- `DeliveryExecutionBoundary` tests remain green.
- `DeliverySideEffectCommandBuilder` tests remain green.
- `DeliveryPayloadBuilder` tests remain green.
- `NotificationSafetyGuard` tests remain green.
- LeadCapture tests remain green.
- Widget Chat Flow tests remain green.
- Public Widget Response Shape remains unchanged.
- No unexpected `email_jobs` or `webhook_jobs`.

## Non-goals

- No Conversation Engine live activation.
- No AssistantProfile migration.
- No feature flags.
- No Public Widget response change.
- No DB migration.
- No queue schema change.
- No `email_jobs` reads, writes, or updates.
- No SQL.
- No `EmailJobsService.enqueue` refactor.
- No `EmailJobsService.processPendingJobs` refactor.
- No `processPendingJobs` call in P1.2B-16B.
- No worker/SMTP change.
- No `report_runs` sync change.
- No retry/status/locking change.
- No stale processing recovery change.
- No `webhook_jobs` writes.
- No webhook signing execution.
- No ToolExecutor/ToolDispatcher consolidation.
- No IntegrationDispatcher change.
- No automatic activation of `deliveryChannels`.
- No direct external integration.
- No answer text modernization.
- No Orchestrator wiring.
- No production wiring without a separate deploy plan.

## Recommended Next Step

P1.2B-16B through P1.2B-16E are implemented, merged, deployed API-only, and production-validated. The safe scope was preserved.

The implemented `EmailJobStatusPolicyBoundary` builds only StatusTransitionPolicy, RetryPolicy, LockingPolicy, StaleProcessingPolicy, and PolicyResult data objects plus validation helpers and audit/log-safe projections. It introduced no runtime execution, no SQL, no DB reads or writes, no `email_jobs` reads, writes, or updates, no `processPendingJobs` call, no `EmailJobsService.enqueue` or `EmailJobsService.processPendingJobs` change, no Orchestrator wiring, no Worker/SMTP/retry/status/locking/stale-processing recovery behavior change, no `report_runs` synchronization change, no NOLIS-specific logic, and no municipality-specific hardcoding.

Deferred areas remain deferred:

- Real status transition execution.
- Real retry updates.
- Real locking queries.
- Stale-processing recovery.
- SQL / DB reads / DB writes.
- `email_jobs` reads, writes, and updates.
- `processPendingJobs`.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- Orchestrator wiring.
- Worker / SMTP execution.
- `report_runs` synchronization.
- Webhooks.
- `ToolExecutorService` / `ToolDispatcherService`.
- `IntegrationDispatcher`.
- Production wiring.

P1.2B-16 is complete. Proceed next to `P1.2B-17A` as an Email Jobs DB Schema / Idempotency Key Audit only.

Historical P1.2B-16B scope was:

- `EmailJobStatusPolicyBoundary`.
- Status transition, retry, locking, and stale-processing policy data objects.
- Validation and safe projection helpers.
- Tests proving no SQL, DB access, queue writes, SMTP calls, `processPendingJobs`, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `report_runs` sync, Orchestrator wiring, or public widget response changes.

Do not implement status update SQL, stale recovery, idempotency keys, worker/SMTP changes, or production wiring in P1.2B-16B.
## P1.2B-17 Status Note

P1.2B-17 implemented and production-validated `EmailJobIdempotencyBoundary` as a pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection data-object layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, backfill, unique index, constraint, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred.
