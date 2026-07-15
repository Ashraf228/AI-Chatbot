# EmailJobProcessingTriggerBoundary Audit / Scope

## Summary

P1.2B-14A is a read-only audit for the boundary between e-mail job persistence and e-mail job processing triggers.

Current state:

- `EmailJobsService.enqueue` persists an `email_jobs` row and then starts `processPendingJobs()` as a fire-and-forget trigger.
- `EmailJobsService.processPendingJobs` is the real worker path. It picks queued jobs, marks them `processing`, sends mail through `ReportMailerService`, updates `email_jobs`, and synchronizes `report_runs` for report jobs.
- A cron trigger also calls `processPendingJobs` every 30 seconds.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` bypasses `EmailJobsService.enqueue` and inserts directly into `email_jobs`; it does not call `processPendingJobs`.
- Existing P1.2B builders and boundaries remain pure data-object or validation layers. They do not write queues, send mail, trigger processing, or change public widget responses.

Recommended next implementation scope:

- P1.2B-14B should not call `processPendingJobs` and should not change `EmailJobsService.enqueue`.
- The safe next code step is a pure `EmailJobProcessingTriggerBoundary` with request/result types, validation helpers, no-op/blocked/failed result builders, and log-/audit-safe projections only.

## Status After P1.2B-14

P1.2B-14B through P1.2B-14E are implemented, merged, and production-validated.

- `apps/api/src/chat/email-job-processing-trigger.boundary.ts` contains only ProcessingTriggerRequest and ProcessingTriggerResult data objects, source persistence result classification helpers, processing trigger validation helpers, result builders, and safe projections.
- The safe scope from this audit was kept: the boundary builds and validates processing trigger request/result data only.
- No runtime execution, no `processPendingJobs` call, no `EmailJobsService.enqueue`, no `EmailJobsService.processPendingJobs`, no Orchestrator wiring, no worker/SMTP changes, no retry/status/locking changes, no `report_runs` synchronization changes, no webhooks, no external integrations, no feature flags, no migrations, and no Public Widget response changes were introduced.
- Audit/log-safe projections redact e-mail addresses, phone values, body fields, and secret-like fields.
- Production validation completed on API commit `3bfd9854894b7c5d241534877bf335e300dccd93`.
- Deferred areas remain deferred: real `processPendingJobs` calls, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, worker/SMTP execution, retry/status/locking behavior, `report_runs` synchronization, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring.

## Current processPendingJobs Behavior

| Methode/Funktion | Datei | Verantwortung | liest email_jobs | schreibt email_jobs | SMTP/Provider | Locking | Retry/Status | report_runs Sync | Fehlerverhalten | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Persistiert einen neuen E-Mail-Job und startet danach Processing | Nein | Ja, `INSERT INTO email_jobs` mit `status='queued'` | Nein | Nein | Initialisiert `retry_count=0`, `max_attempts` | Nein | Insert-Fehler wirft; Processing laeuft fire-and-forget | Hoch, Persistence und Trigger sind gekoppelt |
| `EmailJobsService.processPendingJobs` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Worker-Schleife fuer faellige Jobs | Indirekt ueber `pickNextJob` | Indirekt ueber `processJob` | Ja, ueber `ReportMailerService.send` | In-process `isProcessing` | Verarbeitet bis keine Jobs mehr gepickt werden | Ja, ueber `syncRelatedRecords` | Picker-/DB-Fehler koennen aus der Schleife herauslaufen | Hoch, echter Worker/SMTP-Pfad |
| `EmailJobsService.pickNextJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Waehlt den naechsten faelligen Job und markiert ihn `processing` | Ja, `status='queued'` und `available_at <= now()` | Ja, `status='processing'`, `locked_at=now()` | Nein | `FOR UPDATE SKIP LOCKED` | Keine Retry-Logik | Nein | DB-Fehler bricht Processing ab | Mittel bis hoch, Concurrency-Grenze |
| `EmailJobsService.processJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Sendet Mail, setzt finalen oder retrybaren Status | Ja, ueber gepickte Row | Ja, `sent`, `queued` oder `failed` | Ja | Nutzt den gepickten Job | Erhoeht `retry_count`, delayed retry, final `failed` | Ja | Sendefehler wird gefangen; Statusupdate-Fehler nach erfolgreichem Send ist kritisch | Hoch |
| `EmailJobsService.syncRelatedRecords` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Synchronisiert Report-Run-Status fuer `kind='report'` | Nein | Nein | Nein | Nein | Setzt `report_runs` auf `sent`, `queued` oder `failed` | Ja | Sync-Fehler propagiert aus `processJob` | Mittel |
| `ReportMailerService.send` | `apps/api/src/modules/widget/services/report-mailer.service.ts` | SMTP/Nodemailer-Ausfuehrung | Nein | Nein | Ja | Nein | Nein | Nein | Fehlende Konfiguration oder SMTP-Fehler wirft | Hoch, externe Integration |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Baut Lead-Mail-Payload und inserted direkt `email_jobs` | Nein | Ja, direkter Insert | Nein, prueft nur Konfiguration | Nein | Initialisiert `queued` | Nein | Fehler wird geloggt; Chat-Antwort laeuft weiter | Hoch, bypassed `enqueue` und triggert Processing nicht |

## enqueue-to-processing Coupling

`EmailJobsService.enqueue` has two responsibilities in one method:

- Persistence: insert a queued row into `email_jobs`.
- Trigger: start `void this.processPendingJobs()` after the insert.

Coupling details:

- The trigger is fire-and-forget and not awaited.
- A caller can receive `{ id, queued: true }` even if the subsequent processing later fails.
- Processing errors do not make a successful enqueue fail.
- Insert errors still make `enqueue` fail.
- The fire-and-forget trigger runs on every successful `enqueue` call.
- Cron is a fallback and calls `processPendingJobs` every 30 seconds.
- The in-process `isProcessing` flag prevents same-process re-entry only.
- Multi-process safety relies on the database picker using `FOR UPDATE SKIP LOCKED`.
- Direct `email_jobs` inserts outside `EmailJobsService.enqueue` do not trigger immediate processing and rely on cron.

## Current Processing Trigger Locations

| Quelle | Datei | triggert processPendingJobs | schreibt email_jobs | liest email_jobs | SMTP/Worker beteiligt | Fehlerauswirkung | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Ja, `void this.processPendingJobs()` | Ja | Nein | Indirekt, fire-and-forget | Insert-Fehler wirft; Processing-Fehler entkoppelt | Hoch |
| `EmailJobsService` cron | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Ja, `@Cron('*/30 * * * * *')` | Nein | Ja | Ja | Cron-Fehler haengt an Worker-Pfad | Hoch |
| `EmailJobsService.processPendingJobs` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Ist der Worker | Ja, Status-Updates | Ja | Ja | Per-job Sendefehler wird Retry/Failed; andere DB-Fehler koennen entweichen | Hoch |
| `WidgetLeadsService.capture` | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Indirekt via `EmailJobsService.enqueue` | Indirekt | Nein | Indirekt | Queue-Fehler wird geloggt; Lead bleibt gespeichert | Mittel |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Indirekt via `EmailJobsService.enqueue` | Indirekt | Nein | Indirekt | Queue-Fehler wird geloggt; Tool-Result bleibt nutzbar | Mittel |
| `WidgetAdminReportsService.runReport` | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Indirekt via `EmailJobsService.enqueue` | Indirekt | Nein | Indirekt | Fehler setzt `report_runs` auf `failed` und wirft weiter | Mittel bis hoch |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Nein | Ja, direkter Insert | Nein | Nein | Fehler wird geloggt; Chat-Antwort bleibt unveraendert | Hoch |
| Admin/Activity read paths | `apps/api/src/modules/widget/services/widget-admin-leads.service.ts`, `apps/api/src/sites/site-agent-activity.service.ts` | Nein | Nein | Ja | Nein | Nur Anzeige/Status | Niedrig |

## Existing Builders and Boundaries

| Baustein | Aktueller Boundary-Status |
| --- | --- |
| `NotificationSafetyGuard` | Prueft/sanitizt/no-op; fuehrt nicht aus und schreibt keine Queues. |
| `DeliveryPayloadBuilder` | Baut Email-/Lead-Payloads; fuehrt nicht aus und schreibt keine Queues. |
| `DeliverySideEffectCommandBuilder` | Baut `queue_email_job` / `noop` Commands als Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `DeliveryExecutionBoundary` | Validiert Commands und baut ExecutionPlan-Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `EmailDeliveryExecutor` Boundary | Validiert ExecutionPlans und baut ready/skipped/blocked/failed Result-Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `EmailQueueWriteBoundary` | Validiert `EmailDeliveryExecutionResult` und baut EnqueueRequest-/EnqueueResult-Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `EmailJobPersistenceBoundary` | Validiert `EmailQueueWriteResult` und baut PersistenceRequest-/PersistenceResult-Datenobjekte; fuehrt nicht aus, schreibt keine Queues und ruft `processPendingJobs` nicht auf. |
| `EmailJobsService.processPendingJobs` | Fuehrt tatsaechliches Processing aus und darf nicht ohne separaten Scope in eine Boundary gezogen werden. |

## Processing Boundary

`processPendingJobs` currently owns the worker boundary:

- Starts only when `isProcessing` is false.
- Sets `isProcessing=true` for the whole processing loop.
- Repeatedly picks one queued job.
- Stops when no eligible queued job remains.
- Resets `isProcessing=false` in `finally`.

Important boundary observations:

- `isProcessing` is process-local, not distributed.
- `FOR UPDATE SKIP LOCKED` reduces duplicate row processing across concurrent workers.
- Only `status='queued'` jobs are picked.
- Stale `processing` jobs are not reclaimed by this query.
- The method does not accept tenant/site filters or batch parameters.
- The method drains all currently available queued jobs one-by-one.

## Worker / SMTP Boundary

SMTP execution is inside `ReportMailerService.send`:

- SMTP configuration is read from environment variables inside `ReportMailerService`.
- `assertConfigured()` throws if SMTP configuration is incomplete.
- Nodemailer is created per send.
- File and URL access are disabled in Nodemailer options.
- `sendMail` receives `from`, `to`, `subject`, `html`, and `text`.
- SMTP errors are wrapped and rethrown.

Worker risks:

- A successful provider send followed by a DB status update failure can make retry safety ambiguous.
- Error messages are stored in `last_error` and may be propagated to `report_runs.error_message`.
- `email_job_failed` logs include `recipientEmail` and provider error text.
- Provider-specific details must be treated as sensitive until sanitized.
- No later boundary should log full body, headers, credentials, or raw provider configuration.

## report_runs Coupling

Report delivery is coupled through `email_jobs.metadata.reportRunId`:

- `WidgetAdminReportsService.runReport` creates a `report_runs` row with `status='queued'`.
- The report e-mail job stores `reportRunId` in metadata.
- `EmailJobsService.syncRelatedRecords` checks `kind==='report'` and metadata `reportRunId`.
- On sent mail, `report_runs.status` becomes `sent`, `completed_at` is set, and `error_message` is cleared.
- On final failed mail, `report_runs.status` becomes `failed`, `completed_at` is set, and `error_message` is written.
- On retryable failure, `report_runs.status` becomes `queued`, and `error_message` stores the current error or retry marker.

Risks:

- `report_runs` state depends on metadata shape rather than a dedicated foreign key.
- A send success followed by `report_runs` sync failure can make reporting inconsistent.
- An enqueue failure after report-run creation sets `report_runs` to `failed` in the report service, not in the worker.
- Processing-trigger boundary code should not change report sync behavior.

## Idempotency, Duplicate and Locking Behavior

Current behavior:

- `email_jobs.id` is a random UUID.
- There is no visible semantic idempotency key for `leadId`, `reportRunId`, recipient, conversation, or session.
- There is no visible unique constraint enforced by the code path for duplicate queue rows.
- Correlation is stored in `metadata` and differs by caller.
- `FOR UPDATE SKIP LOCKED` helps avoid concurrent workers selecting the same queued row.
- `isProcessing` prevents same-process overlapping loops but not multi-process loops.
- Retry count increments in the failed send path.
- Delayed retry uses `available_at = now() + retry_delay`.
- Final failure occurs when `retry_count + 1 >= max_attempts`.

Open risks:

- Parallel API instances can both run `processPendingJobs`; DB locking should prevent picking the same queued row, but stale `processing` recovery is not handled here.
- API restart during processing can leave a row in `processing` with `locked_at`; current picker only selects queued rows.
- Send success plus failed status update can lead to duplicate-mail risk if recovery retries the row.
- Duplicate upstream enqueue can create duplicate e-mails because no job-level dedupe exists.
- There is no documented correlation ID dedicated to trigger attempts.

Tests currently cover:

- `EmailJobsService.enqueue` stores queued e-mail jobs.
- `EmailJobsService.processPendingJobs` retries failed report jobs and eventually marks `report_runs` failed.

Tests missing before worker refactor:

- Same-process re-entry guard.
- Multi-worker `SKIP LOCKED` behavior.
- Stale `processing` recovery policy.
- Send-success/status-update-failure behavior.
- Duplicate enqueue/idempotency behavior.
- Retry delay and max-attempt edge cases.

## Error Handling and No-op Behavior

Current behavior:

- Missing recipient:
  - Orchestrator logs `lead_notification_skipped` with reason `recipient_missing`.
  - Widget lead capture and ToolDispatcher skip the enqueue branch when no recipient is configured.
  - `EmailJobsService.enqueue` itself does not validate syntax and relies on callers/DB/provider.
- Invalid e-mail:
  - No syntax validation is visible in `EmailJobsService.enqueue`.
  - Provider send may fail later.
- Missing SMTP configuration:
  - Orchestrator and Widget lead capture skip and log when SMTP is not configured.
  - ToolDispatcher only queues when SMTP is configured.
  - Manual report run calls `assertConfigured()` and fails before enqueue.
- Provider timeout or SMTP error:
  - `ReportMailerService.send` throws.
  - `processJob` catches, increments retry, requeues or marks failed.
- DB error during status update:
  - Not isolated from the per-job send success path.
  - Can make delivery state ambiguous.
- `report_runs` sync error:
  - Propagates from `syncRelatedRecords`.
  - Needs separate worker-level handling before refactor.

Partial failures:

- Job persisted, but processing not immediately triggered.
- Job processing started, send failed.
- Send succeeded, but `email_jobs` status update failed.
- Send succeeded, but `report_runs` sync failed.
- Status set to `failed`, but retry policy expectations are unclear to callers.
- Retry can send duplicate mail if the previous send succeeded but persistence failed.

## Secret and Logging Boundaries

Current logging and storage:

- `email_jobs` stores real recipient, subject, HTML, text, and metadata because the worker needs them.
- `EmailJobsService` logs `recipientEmail`, retry counters, exhausted flag, job id, kind, and error message for failures.
- Orchestrator, Widget lead capture, and ToolDispatcher log recipient fields on skip/failure paths.
- SMTP credentials are read by `ReportMailerService` from environment variables and should never be logged.
- Existing safe projection helpers redact or omit secret-like keys, delivery targets, body fields, phone values, and e-mail values depending on context.

Fields a future processing trigger boundary must not log raw:

- `recipient_email`, `recipientEmail`, `to`.
- `html`, `text`, `body`.
- `lead.email`, `lead.phone`, `metadata.leadEmail`.
- SMTP environment variable values.
- Header, token, authorization, password, signing secret, and webhook target fields.
- Full provider error payloads until sanitized.

## Safe / Unsafe Scope

Safe for P1.2B-14B if code is allowed:

- Pure `EmailJobProcessingTriggerBoundary` types.
- `ProcessingTriggerRequest` data objects.
- `ProcessingTriggerResult` data objects.
- Trigger request validation helpers.
- Ready/skipped/no-op/blocked/failed result builders.
- Reason and error code enums.
- Log-/audit-safe trigger result projections.
- Unit tests proving no DB, queue, SMTP, logger, `process.env`, `EmailJobsService.enqueue`, or `processPendingJobs` dependency.
- No productive runtime usage.

Unsafe or deferred for P1.2B-14B:

- Actual `processPendingJobs` calls.
- Changing `EmailJobsService.enqueue`.
- Changing `EmailJobsService.processPendingJobs`.
- Decoupling queue persistence from processing.
- Changing queue worker start behavior.
- Changing retry, status, or locking behavior.
- Changing SMTP/provider execution.
- Changing `report_runs` synchronization.
- Rewiring `queueInternalLeadNotification`.
- Orchestrator wiring.
- Production wiring.
- Webhooks, ToolExecutor, ToolDispatcher, IntegrationDispatcher, and delivery channel activation.

Separately audit before implementation:

- `EmailJobsService.processPendingJobs` refactor.
- E-mail worker retry and locking behavior.
- SMTP provider logging boundary.
- E-mail queue idempotency key design.
- `email_jobs` schema and index audit.
- Report delivery processing boundary.
- ToolDispatcher e-mail paths.

## Proposed Boundary Services

### EmailJobProcessingTriggerBoundary

Initial scope:

- Own `ProcessingTriggerRequest` data objects.
- Own `ProcessingTriggerResult` data objects.
- Validate trigger request shape.
- Represent `ready_to_trigger`, `skipped`, `blocked`, and `failed` outcomes.
- Build safe projections for logs/audits.
- Perform no `processPendingJobs` call.
- Perform no DB, queue, SMTP, cron, worker, logger, or environment access.

### EmailJobProcessingTriggerSafetyGuard

Later pure scope:

- No-op enforcement.
- Duplicate trigger precondition validation.
- Safe logging projection checks.
- Retry/lock precondition checks as data validation only.
- No worker execution.

### EmailJobProcessingService / Worker Boundary

Separate future scope only:

- Encapsulate `processPendingJobs`.
- Own job selection, locking, retry, SMTP execution, status updates, stale-processing recovery, and report-run synchronization.
- Requires separate audit, tests, rollout plan, and rollback plan.

### EmailJobProcessingAdapter

Separate future scope only:

- Actual call path that may invoke `processPendingJobs`.
- Should be introduced only after the trigger boundary and worker boundary are validated independently.

## Recommended P1.2B-14B Scope

P1.2B-14B should implement only a pure trigger boundary shell:

- `EmailJobProcessingTriggerBoundary` module.
- `ProcessingTriggerRequest` type.
- `ProcessingTriggerResult` type.
- `validateProcessingTriggerRequest` helper.
- `buildReadyProcessingTriggerResult` helper.
- `buildSkippedProcessingTriggerResult` helper.
- `buildBlockedProcessingTriggerResult` helper.
- `buildFailedProcessingTriggerResult` helper.
- `buildSafeProcessingTriggerResultForLog` helper.
- `buildSafeProcessingTriggerResultForAudit` helper.
- Focused tests proving no side effects.

P1.2B-14B should not:

- Call `processPendingJobs`.
- Change `EmailJobsService.enqueue`.
- Change `EmailJobsService.processPendingJobs`.
- Insert into `email_jobs`.
- Change worker, SMTP, retry, status, locking, or `report_runs` behavior.
- Rewire Orchestrator, ToolDispatcher, ToolExecutor, webhooks, IntegrationDispatcher, or delivery channels.

If even this pure trigger boundary is considered too early, P1.2B-14B should remain another scope/test-plan document and no code should be implemented.

## Required Tests

Trigger request validation:

- Pending trigger request is classified as triggerable.
- Missing `reasonCode` is blocked.
- Invalid batch/request shape is blocked.
- Skipped/blocked/failed trigger result shapes are stable.
- No DB, queue, SMTP, logger, environment, `EmailJobsService.enqueue`, or `processPendingJobs` dependency exists.

Trigger result:

- `ready_to_trigger`, `skipped`, `blocked`, and `failed` result shapes are stable.
- `reasonCode` and `errorCode` remain stable.
- Log-safe output redacts recipient, body, contact values, and secret-like fields.
- No real processing job id or provider payload is required by pure result helpers.

No side effects:

- No `email_jobs` inserts.
- No `webhook_jobs` inserts.
- No DB dependency.
- No queue dependency.
- No `process.env`.
- No logger.
- No mail execution.
- No `EmailJobsService.enqueue`.
- No `EmailJobsService.processPendingJobs`.

Regression:

- `EmailJobPersistenceBoundary` tests remain green.
- `EmailQueueWriteBoundary` tests remain green.
- `EmailDeliveryExecutor` boundary tests remain green.
- `DeliveryExecutionBoundary` tests remain green.
- `DeliverySideEffectCommandBuilder` tests remain green.
- `DeliveryPayloadBuilder` tests remain green.
- `NotificationSafetyGuard` tests remain green.
- Lead-capture builder tests remain green.
- Widget chat flow tests remain green.
- Public Widget response shape remains unchanged.
- No unexpected `email_jobs`, `webhook_jobs`, `agent_tickets`, or `widget_leads`.

## Non-goals

P1.2B-14 is not intended to:

- Activate Conversation Engine in the public widget.
- Run AssistantProfile migration.
- Enable feature flags.
- Change Public Widget response shape or answer text.
- Add a DB migration.
- Change queue schema.
- Write `email_jobs`.
- Refactor `EmailJobsService.enqueue`.
- Refactor `EmailJobsService.processPendingJobs`.
- Call `processPendingJobs` in P1.2B-14B.
- Change worker, SMTP, retry, status, locking, or `report_runs` synchronization.
- Write `webhook_jobs`.
- Execute webhook signing or external integrations.
- Consolidate ToolExecutor / ToolDispatcher.
- Change IntegrationDispatcher.
- Automatically activate `deliveryChannels`.
- Add Orchestrator wiring.
- Add production wiring without a separate deploy plan.

## Current Status After P1.2B-16

EmailJobProcessingTriggerBoundary was implemented and production-validated in P1.2B-14. EmailJobWorkerBoundary was implemented and production-validated in P1.2B-15 as a pure WorkerPlan, StatusTransitionPlan, RetryDecision, WorkerResult, validation, and safe-projection layer.

EmailJobStatusPolicyBoundary was implemented and production-validated in P1.2B-16 as a pure StatusTransitionPolicy, RetryPolicy, LockingPolicy, StaleProcessingPolicy, PolicyResult, validation, and safe-projection layer. `processPendingJobs`, Worker/SMTP execution, status/retry/locking execution, stale-processing recovery, and real `email_jobs` writes or updates remain not extracted.

`processPendingJobs`, Worker/SMTP execution, real `email_jobs` reads, writes, and updates, retry/status/locking behavior, stale-processing recovery, and `report_runs` synchronization remain outside the extracted boundaries.

## Recommended Next Step

P1.2B-14A through P1.2B-16E are complete. The EmailJobProcessingTriggerBoundary is implemented, merged, and production-validated as a pure request/result boundary. P1.2B-15 is also complete and production-validated as a pure EmailJobWorkerBoundary. P1.2B-16 is complete and production-validated as a pure EmailJobStatusPolicyBoundary.

The next recommended step is `P1.2B-17A` as a read-only Email Jobs DB Schema / Idempotency Key Audit. It should scope DB schema/indexes, semantic idempotency keys, duplicate detection, migration/backfill risk, rollout strategy, rollback strategy, required DB tests, and safe logging/redaction before any SQL, DB, worker, SMTP, processing, status, retry, locking, or Orchestrator wiring changes are implemented.
## P1.2B-17 Status Note

P1.2B-17 implemented and production-validated `EmailJobIdempotencyBoundary` as a pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection data-object layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, backfill, unique index, constraint, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred.

## P1.2B-18 Status Note

P1.2B-18 implemented and production-validated `EmailJobIdempotencyMigrationPlanBoundary` as a pure enforcement-plan, migration-phase, unique-index-plan, backfill-plan, duplicate-conflict-policy, rollback-plan, validation, result-data, and safe-projection layer.

No DB migration, SQL, DB reads or writes, `email_jobs` reads/writes/updates, idempotency enforcement, unique index, constraint, backfill, existing duplicate cleanup, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, Worker/SMTP change, `report_runs` change, NOLIS-specific logic, or production wiring was introduced. Those areas remain deferred. Production validation is now green; `production-health-synthetic` returns widget config HTTP 200 with matching `siteKey` in the current baseline.

## P1.2B-19 Status Note

`EmailJobDuplicateAuditPlanBoundary` was implemented in P1.2B-19 as a pure duplicate-audit and cleanup-plan data-object layer and production-validated.

DB reads, SQL, `email_jobs` reads/writes/updates, duplicate cleanup, backfill, unique index or constraint work, idempotency enforcement, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs`, Orchestrator wiring, worker/SMTP execution, `report_runs` synchronization, webhooks, ToolExecutor/ToolDispatcher work, IntegrationDispatcher work, and Production wiring remain deferred.
