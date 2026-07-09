# EmailJobsService.enqueue Split / Persistence-vs-Processing Audit

## Summary

P1.2B-13A is a read-only audit for splitting `EmailJobsService.enqueue` into clearer persistence and processing-trigger boundaries.

Current state:

- `EmailJobsService.enqueue` is not just a request builder. It persists rows into `email_jobs` and then starts `processPendingJobs()` as a fire-and-forget processing trigger.
- `EmailJobsService.processPendingJobs` owns worker-style queue processing, row locking, SMTP send execution, retry handling, status updates, and related `report_runs` synchronization.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` bypasses `EmailJobsService.enqueue` and directly inserts into `email_jobs`.
- `WidgetLeadsService.capture`, `ToolDispatcherService.executeCaptureLead`, and `WidgetAdminReportsService.runReport` call `EmailJobsService.enqueue`.
- Existing P1.2B boundaries remain pure data-object or validation layers. They do not write queues, send mail, trigger processing, or change public widget responses.

Recommended next implementation scope:

- P1.2B-13B should still avoid real `email_jobs` writes and should not change `EmailJobsService.enqueue` or `processPendingJobs`.
- The safe next code step is a pure `EmailJobPersistenceBoundary` and, optionally, pure `EmailJobProcessingTriggerBoundary` types/results/projections with focused tests.

## Status After P1.2B-13

P1.2B-13B through P1.2B-13E are implemented, merged, and production-validated.

- `apps/api/src/chat/email-job-persistence.boundary.ts` contains only persistence request/result data objects, source queue-write result classification helpers, persistence validation helpers, result builders, and safe projections.
- The safe scope from this audit was kept: the boundary validates and describes persistence request/result data only.
- No runtime execution, no `email_jobs` writes, no `EmailJobsService.enqueue`, no `EmailJobsService.processPendingJobs`, no processing trigger types, no Orchestrator wiring, no worker/SMTP changes, no webhooks, no external integrations, no feature flags, no migrations, and no Public Widget response changes were introduced.
- Audit/log-safe projections redact e-mail addresses, phone values, body fields, and secret-like fields.
- Production validation completed on API commit `8604f60f2a2822693f11b6accb066f3afab56c9f`.
- Deferred areas remain deferred: real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, processing trigger decisions, Orchestrator wiring, worker/SMTP execution, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring.

## Status After P1.2B-14

P1.2B-14B through P1.2B-14E are implemented, merged, and production-validated.

- `EmailJobProcessingTriggerBoundary` was added as a pure ProcessingTriggerRequest and ProcessingTriggerResult data-object layer after the persistence boundary.
- `EmailJobPersistenceBoundary` remains a pure validation, request, and result data-object layer.
- Processing trigger requests and results are not executed and are not wired into the orchestrator.
- Real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs` calls, Orchestrator wiring, worker/SMTP execution, retry/status/locking behavior, `report_runs` synchronization, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `3bfd9854894b7c5d241534877bf335e300dccd93`.

## Current EmailJobsService.enqueue Behavior

| Methode/Funktion | Datei | Verantwortung | schreibt DB | Tabelle | startet Processing | nutzt SMTP/Worker | nutzt Config/env | Fehlerverhalten | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Erstellt Job-ID, persistiert E-Mail-Job, gibt `{ id, queued: true }` zurueck | Ja | `email_jobs` | Ja, `void this.processPendingJobs()` | Nicht direkt SMTP, aber startet Processor | Keine direkte env-Nutzung | Insert-Fehler wirft; Processing-Fehler laeuft fire-and-forget ausserhalb des `await enqueue` | Hoch, weil Persistence und Processing-Trigger gekoppelt sind |
| `EmailJobsService.processPendingJobs` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Verarbeitet alle faelligen queued Jobs seriell | Ja, via Status-Updates | `email_jobs`, optional `report_runs` | Ist Processing | Ja, ueber `ReportMailerService.send` | Indirekt SMTP env im Mailer | Fehler pro Job wird gefangen, Retry/Failed-Status gesetzt, Event geloggt | Hoch, echter Worker/SMTP/Retry-Pfad |
| `EmailJobsService.pickNextJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Waehlt naechsten queued Job und setzt `processing` | Ja | `email_jobs` | Nein | Nein | Nein | DB-Fehler bricht Processing-Schleife ab | Mittel, Locking-/Concurrency-Grenze |
| `EmailJobsService.processJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Sendet Mail und setzt `sent`, `queued` oder `failed` | Ja | `email_jobs`, optional `report_runs` | Nein | Ja | Indirekt SMTP env | Sendefehler erzeugt Retry/Failed; Status-Update-Fehler kann nach Versand kritisch sein | Hoch, externe Side Effects |
| `EmailJobsService.syncRelatedRecords` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Synchronisiert Report-Run-Status bei Report-Jobs | Ja | `report_runs` | Nein | Nein | Nein | Fehler wuerde aus `processJob` propagieren | Mittel, Report-Konsistenz |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Baut Lead-Mail-Payload und inserted direkt `email_jobs` | Ja | `email_jobs` | Nein | Prueft SMTP-Konfiguration, sendet nicht | Indirekt via `ReportMailerService.isConfigured()` | Fehler wird geloggt; Chat-Antwort laeuft weiter | Hoch, bypassed zentralen Enqueue-Service |
| `WidgetLeadsService.capture` | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Speichert Public-Widget-Lead und queued Notification via `EmailJobsService.enqueue` | Indirekt | `widget_leads`, `email_jobs` | Indirekt via `enqueue` | Prueft SMTP-Konfiguration, sendet nicht direkt | Indirekt via Mailer-Konfigurationscheck | Queue-Fehler wird geloggt; Lead bleibt gespeichert | Mittel |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Speichert Agent-Run-Lead und queued Notification via `EmailJobsService.enqueue` | Indirekt | `widget_leads`, `email_jobs` | Indirekt via `enqueue` | Prueft SMTP-Konfiguration, sendet nicht direkt | Indirekt via Mailer-Konfigurationscheck | Queue-Fehler wird geloggt; Tool-Result markiert `queuedNotification=false` | Mittel |
| `WidgetAdminReportsService.runReport` | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Erstellt Report-Run und queued Report-Mail via `EmailJobsService.enqueue` | Indirekt | `report_runs`, `email_jobs` | Indirekt via `enqueue` | Assertet SMTP-Konfiguration | Indirekt via Mailer-Konfigurationscheck | Queue-/Build-Fehler setzt `report_runs` auf `failed` und wirft weiter | Mittel bis hoch |

## processPendingJobs Coupling

`EmailJobsService.enqueue` performs the persistence step and then immediately triggers processing:

- The trigger is `void this.processPendingJobs()`.
- The trigger is fire-and-forget and is not awaited.
- A successful DB insert can be returned to the caller while processing later fails.
- Processing failure does not make `enqueue` fail after the insert succeeds.
- DB insert failure makes `enqueue` fail and callers handle it differently.
- Cron also triggers `processPendingJobs` every 30 seconds.
- `processPendingJobs` uses an in-process `isProcessing` boolean to avoid same-process re-entry.
- `pickNextJob` uses `FOR UPDATE SKIP LOCKED` to reduce multi-worker row contention.

Processing responsibilities currently coupled to the same service:

- Select queued jobs whose `available_at <= now()`.
- Set picked jobs to `processing` and `locked_at = now()`.
- Send the mail through `ReportMailerService.send`.
- Mark jobs as `sent`, clear `locked_at`, clear `last_error`, and set `sent_at`.
- On send error, increment `retry_count`.
- Requeue with delayed `available_at` until `max_attempts` is reached.
- Mark jobs `failed` after attempts are exhausted.
- Log `email_job_failed` with job id, kind, recipient field, retry counters, exhausted flag, and error message.
- Sync related `report_runs` to `sent`, `queued`, or `failed` when metadata contains `reportRunId`.

## Current Email Queue Write Locations

| Quelle | Datei | schreibt `email_jobs` direkt | ruft `EmailJobsService.enqueue` | triggert `processPendingJobs` | Empfaengerquelle | Dedupe/Idempotency | Fehlerauswirkung | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Ja | Nein | Ja, fire-and-forget | Caller `to` | Kein semantischer Key; zufaellige Job-ID | Insert-Fehler wirft; Processing laeuft entkoppelt | Hoch |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Ja | Nein | Nein | Site config `leadNotificationEmail` / fallback fields | Kein Job-Dedupe; Lead-Capture-State verhindert teilweise Mehrfachabschluss | Fehler intern geloggt; Chat-Antwort bleibt | Hoch |
| `WidgetLeadsService.capture` | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Nein | Ja | Ja, indirekt | Public widget site config | Kein Job-Dedupe; Lead insert selbst nicht semantisch dedupliziert | Queue-Fehler intern geloggt; Lead bleibt | Mittel |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Nein | Ja | Ja, indirekt | Site config `leadNotificationEmail` | Dedupe fuer Agent-Run Lead via session/email vor Lead-Insert; kein Job-Dedupe | Queue-Fehler intern geloggt; Tool-Result bleibt erfolgreich mit `queuedNotification=false` | Mittel |
| `WidgetAdminReportsService.runReport` | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Nein | Ja | Ja, indirekt | Erster aktiver Report-Empfaenger | Kein generischer Job-Dedupe; ReportRun-ID in metadata | Fehler setzt ReportRun failed und wirft weiter | Mittel bis hoch |
| `EmailJobsService.processPendingJobs` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Nein | Nein | Ist Processing | Persistierte `recipient_email` | Locking via `FOR UPDATE SKIP LOCKED`; kein semantischer Dedupe-Key | Retry/failed/sent Status | Hoch |

## Existing Builders and Boundaries

| Baustein | Aktueller Boundary-Status |
| --- | --- |
| `NotificationSafetyGuard` | Prueft/sanitizt/no-op; fuehrt nicht aus und schreibt keine Queues. |
| `DeliveryPayloadBuilder` | Baut Email-/Lead-Payloads; fuehrt nicht aus und schreibt keine Queues. |
| `DeliverySideEffectCommandBuilder` | Baut `queue_email_job` / `noop` Commands als Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `DeliveryExecutionBoundary` | Validiert Commands und baut ExecutionPlan-Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `EmailDeliveryExecutor` Boundary | Validiert ExecutionPlans und baut ready/skipped/blocked/failed Result-Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `EmailQueueWriteBoundary` | Validiert `EmailDeliveryExecutionResult` und baut EnqueueRequest-/EnqueueResult-Datenobjekte; fuehrt nicht aus und schreibt keine Queues. |
| `EmailJobsService.enqueue` | Schreibt aktuell real `email_jobs` und startet nach dem Insert `processPendingJobs`. |

## Persistence Boundary

Current persistence fields written by `EmailJobsService.enqueue`:

- `id`: random UUID.
- `kind`: `lead_notification` or `report`.
- `status`: initialized to `queued`.
- `recipient_email`: caller-provided target.
- `subject`: caller-provided subject.
- `html`: caller-provided HTML or null.
- `text`: caller-provided text or null.
- `metadata`: caller-provided object or empty object.
- `retry_count`: initialized to `0`.
- `max_attempts`: caller-provided `maxAttempts` or `5`.
- `available_at`: `now()`.
- `locked_at`: null.
- `sent_at`: null.
- `last_error`: null.
- `created_at`: `now()`.
- `updated_at`: `now()`.

Important persistence findings:

- The table schema has no `tenant_id`, `site_id`, `session_id`, `conversation_id`, `lead_id`, `contact_request_id`, `correlation_id`, or `idempotency_key` columns.
- Correlation data is stored only inside `metadata`, and shape differs by caller.
- There is no unique constraint or semantic dedupe index.
- There is no explicit transaction around enqueue insert plus processing trigger.
- The return value is `{ id, queued: true }`.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` duplicates insert logic and does not call `EmailJobsService.enqueue`.

## Processing Trigger Boundary

Current processing-trigger behavior:

- `EmailJobsService.enqueue` starts processing immediately after insert with `void this.processPendingJobs()`.
- The fire-and-forget trigger means callers cannot distinguish "persisted only" from "persisted and processing started successfully".
- The trigger is intentionally not awaited, so processing errors are handled inside the worker path and do not affect the enqueue return value.
- Cron provides a second safety trigger every 30 seconds.
- An API restart after insert but before the fire-and-forget call completes should still be recovered by cron if the job remains `queued`.
- An API restart during processing can leave a job in `processing` with `locked_at` set; the current picker only selects `queued` jobs, so stale `processing` recovery needs separate audit before any worker changes.

## Idempotency and Duplicate Behavior

Current idempotency state:

- No semantic idempotency key exists on `email_jobs`.
- No unique constraint prevents duplicate jobs for the same lead, report run, recipient, or conversation.
- `email_jobs.id` is a random UUID primary key.
- `metadata` may contain `siteId`, `sessionId`, `leadId`, `leadEmail`, `agentRunId`, `reportRunId`, or `frequency`, depending on caller.
- `WidgetAdminLeadsService` later correlates leads to e-mail jobs through `metadata->>'leadId'` or `metadata->>'leadEmail'`, not a dedicated FK.
- `ToolDispatcherService.executeCaptureLead` dedupes lead creation by agent-run session and e-mail before enqueueing; this is not job-level dedupe.
- `ToolExecutorService.captureLead` dedupes lead creation and integration dispatching, but does not use `EmailJobsService.enqueue`.
- `ChatAgentOrchestratorService` uses `pendingLead.completedLeadId` / conversation metadata to reduce repeated lead completion, but its direct queue insert has no job-level dedupe.
- `processPendingJobs` uses `FOR UPDATE SKIP LOCKED` to reduce concurrent processing of the same queued row.
- Retry behavior is based on `retry_count`, `max_attempts`, delayed `available_at`, and final `failed` status.

Duplicate risk examples:

- Same lead can produce more than one job if the upstream flow creates or replays queue logic without a stable job-level idempotency key.
- Same report can be queued more than once if manual triggering is repeated; `reportRunId` helps correlation but is not a uniqueness boundary.
- A sent mail followed by a failed status update could create uncertainty about whether retry is safe.
- Stale `processing` jobs after process crash need separate worker recovery analysis.

## Error Handling and No-op Behavior

Current no-op and error behavior:

- Missing `leadNotificationEmail`:
  - Orchestrator logs `lead_notification_skipped` with reason `recipient_missing`.
  - Widget public lead capture simply does not enter the notification branch.
  - ToolDispatcher simply does not enter the notification branch.
- SMTP not configured:
  - Orchestrator logs `lead_notification_skipped` with reason `smtp_not_configured`.
  - Widget public lead capture logs `lead_notification_skipped` with reason `smtp_not_configured`.
  - ToolDispatcher does not currently log a skip for this branch; it leaves `queuedNotification=false`.
  - Report run calls `assertConfigured` and fails before queueing.
- Empty or invalid recipient:
  - DTO/admin validation catches some config writes elsewhere.
  - `EmailJobsService.enqueue` itself does not validate e-mail syntax.
  - `email_jobs.recipient_email` is non-null, so DB rejects null but not malformed text.
- DB insert failure:
  - `EmailJobsService.enqueue` throws.
  - Widget and ToolDispatcher catch and log queue failure.
  - Report run catches, marks `report_runs` failed, and rethrows.
  - Orchestrator direct insert catches and logs without affecting chat answer.
- `processPendingJobs` failure:
  - Per-job send failures are caught and converted to retry/failed status.
  - Picker or DB-level failures outside per-job handling can escape the process loop.
- SMTP/provider failure:
  - `ReportMailerService.send` throws an internal error.
  - `processJob` catches, increments retry count, delays next attempt, or marks failed.
- Status-update failure after send:
  - Not isolated today; a successful SMTP send followed by DB update failure could create delivery uncertainty.
- User-facing chat behavior:
  - Lead or ticket chat response is not changed by notification queue failure in Orchestrator/Widget/ToolDispatcher paths.

Partial-failure cases to preserve in future tests:

- Lead stored, but e-mail job missing.
- E-mail job written, but processing fails.
- E-mail sent, but status update fails.
- Report run queued, but e-mail enqueue fails and report run becomes failed.
- Audit/log event written, but e-mail job missing.

## Secret and Logging Boundaries

Current sensitive boundaries:

- SMTP credentials are read only inside `ReportMailerService` from process environment.
- `EmailJobsService` logs `recipientEmail` and error message in `email_job_failed`.
- `ChatAgentOrchestratorService`, `WidgetLeadsService`, and `ToolDispatcherService` log `recipientEmail` on notification skip/failure/queued events.
- `email_jobs` stores real recipient, subject, HTML, text, and metadata because worker execution needs them.
- Mail body can include lead/contact details and must not be logged in future boundary projections.
- Existing pure boundaries provide log/audit-safe projection helpers and tests for redacting targets, body fields, phone values, and secret-like keys.
- Admin read paths show e-mail delivery status and attempts, but not the full queued mail body.
- Public Widget response paths must never expose delivery channels, queue details, recipient, body, provider config, or preview/debug fields.

Fields that a later split must never log without sanitizing:

- `recipient_email`.
- `recipientEmail`.
- `to`.
- `html`.
- `text`.
- `body`.
- `lead.email`.
- `lead.phone`.
- `metadata.leadEmail`.
- `SMTP_*` values.
- `authorization`, `apiKey`, `token`, `signingSecret`, `webhookUrl`.

## Safe / Unsafe Scope

Safe for P1.2B-13B if code is allowed:

- Pure `EmailJobPersistenceRequest` type.
- Pure `EmailJobPersistenceResult` type.
- Pure `EmailJobProcessingTriggerRequest` type.
- Pure `EmailJobProcessingTriggerResult` type.
- `validateEmailJobPersistenceRequest` helper.
- `validateEmailJobProcessingTriggerRequest` helper.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Log-/audit-safe projections.
- Reason/error code enums.
- Focused unit tests.
- No productive runtime usage.
- No DB, queue, SMTP, logger, `process.env`, `EmailJobsService.enqueue`, or `processPendingJobs` dependency.

Unsafe or deferred for P1.2B-13B:

- Actual `email_jobs` inserts.
- Changing `EmailJobsService.enqueue`.
- Decoupling or changing `processPendingJobs`.
- Rewiring `queueInternalLeadNotification`.
- Any `ChatAgentOrchestratorService` wiring.
- Retry/status behavior changes.
- Introducing a new dedupe policy.
- Queue schema or migration changes.
- Worker behavior changes.
- SMTP/mail execution changes.
- User response behavior changes.
- Production wiring.
- Webhooks, signing, or `webhook_jobs`.
- ToolExecutor/ToolDispatcher consolidation.
- IntegrationDispatcher changes.
- Automatic `deliveryChannels` activation.

Separately audit before implementation:

- `EmailJobsService.processPendingJobs` worker boundary.
- Retry, stale `processing` job recovery, and locking behavior.
- SMTP provider logging boundary.
- E-mail queue idempotency key design.
- `email_jobs` schema/index migration plan.
- Report delivery e-mail paths.
- ToolDispatcher e-mail paths.

## Proposed Boundary Services

### EmailJobPersistenceBoundary

Initial scope:

- Own `EmailJobPersistenceRequest` data objects.
- Own `EmailJobPersistenceResult` data objects.
- Validate request shape before persistence.
- Build safe projections for logs/audits.
- Return `ready`, `skipped`, `blocked`, and `failed` data objects.
- In first step, perform no DB writes and call no services.

Later adapter, only after separate approval:

- `EmailJobPersistenceAdapter` may encapsulate actual `email_jobs` insert.
- It must not trigger processing in the same operation unless explicitly scoped.
- It needs transaction, idempotency, failure, and rollback tests.

### EmailJobProcessingTriggerBoundary

Initial scope:

- Own trigger request/result data objects.
- Validate whether a persisted job is eligible to trigger processing.
- Represent no-op/blocked/failed trigger outcomes.
- In first step, perform no `processPendingJobs` call.

Later worker boundary, only after separate audit:

- `EmailJobProcessingService` / Worker Boundary may encapsulate processing.
- It must cover locking, retry, SMTP send, status updates, stale `processing` recovery, and report-run synchronization.

## Recommended P1.2B-13B Scope

Recommended implementation for P1.2B-13B:

- Add a pure `EmailJobPersistenceBoundary` module.
- Add persistence request/result types.
- Add validation helpers.
- Add no-op/blocked/failed result builders.
- Add safe log/audit projection helpers.
- Optionally add pure ProcessingTriggerBoundary types/results, but do not call them from runtime paths.
- Add focused unit tests proving no side effects.

P1.2B-13B should not:

- Write `email_jobs`.
- Change `EmailJobsService.enqueue`.
- Change `EmailJobsService.processPendingJobs`.
- Rewire `queueInternalLeadNotification`.
- Touch `ChatAgentOrchestratorService`.
- Touch worker/SMTP execution.
- Touch webhooks, ToolExecutor, ToolDispatcher, IntegrationDispatcher, or delivery channels.
- Change Public Widget response shape.

If this is still considered too early, P1.2B-13B should remain another scope/test-plan document and no code should be implemented.

## Required Tests

Persistence request validation:

- `ready_to_enqueue` source result can become persistence-request-capable.
- `skipped`, `blocked`, and `failed` source results are not persistable.
- Missing recipient blocks.
- Missing subject/body blocks.
- Invalid metadata blocks if required correlation fields are absent.
- Invalid request returns blocked/failed result.
- No DB or queue execution occurs.

Persistence result shape:

- `pending`, `skipped`, `blocked`, and `failed` result shapes stay stable.
- `reasonCode` and `errorCode` stay stable.
- Log-safe output redacts recipient, body, phone, e-mail, and secret-like fields.
- No persisted job id is present while no DB write exists.

Processing trigger boundary:

- No `processPendingJobs` call.
- Trigger request/result is a data object only.
- Failed trigger result is a data object only.

No side effects:

- No `email_jobs` insert.
- No DB dependency.
- No queue dependency.
- No `process.env`.
- No logger.
- No SMTP/mail execution.
- No `EmailJobsService.enqueue`.
- No `EmailJobsService.processPendingJobs`.

Regression:

- `email-queue-write-boundary` tests remain green.
- `email-delivery-executor-boundary` tests remain green.
- `delivery-execution-boundary` tests remain green.
- `delivery-side-effect-commands` tests remain green.
- `delivery-payload-builders` tests remain green.
- `notification-safety-guard` tests remain green.
- `lead-capture-builders` tests remain green.
- `widget-chat-flow` tests remain green.
- Public Widget response shape remains unchanged.
- No unexpected `email_jobs` or `webhook_jobs`.

## Non-goals

P1.2B-13 is not intended to:

- Activate the Conversation Engine in the public widget.
- Run AssistantProfile migration.
- Enable feature flags.
- Change Public Widget response shape.
- Add a DB migration.
- Change queue schema.
- Write `email_jobs` in P1.2B-13B.
- Refactor `EmailJobsService.enqueue` in P1.2B-13B.
- Refactor `EmailJobsService.processPendingJobs` in P1.2B-13B.
- Write `webhook_jobs`.
- Execute webhook signing or external integrations.
- Consolidate ToolExecutor / ToolDispatcher.
- Change IntegrationDispatcher.
- Automatically activate `deliveryChannels`.
- Modernize answer text.
- Add Orchestrator wiring.
- Add production wiring without a separate deploy plan.

## Current Status After P1.2B-16

EmailJobPersistenceBoundary was production-validated in P1.2B-13. EmailJobProcessingTriggerBoundary was production-validated in P1.2B-14. EmailJobWorkerBoundary was production-validated in P1.2B-15 as a pure WorkerPlan, StatusTransitionPlan, RetryDecision, WorkerResult, validation, and safe-projection layer.

EmailJobStatusPolicyBoundary was production-validated in P1.2B-16 as a pure StatusTransitionPolicy, RetryPolicy, LockingPolicy, StaleProcessingPolicy, PolicyResult, validation, and safe-projection layer. `processPendingJobs`, `EmailJobsService.enqueue`, and real `email_jobs` reads, writes, or updates remain not extracted.

`processPendingJobs`, `EmailJobsService.enqueue`, real `email_jobs` reads, writes, and updates, worker/SMTP execution, retry/status/locking behavior, stale-processing recovery, and `report_runs` synchronization remain outside the extracted boundaries.

## Recommended Next Step

P1.2B-13, P1.2B-14, P1.2B-15, and P1.2B-16 are complete. The next recommended step is `P1.2B-17A` Email Jobs DB Schema / Idempotency Key Audit.

That audit should remain read-only and cover status transition policy, retry decision policy, locking boundaries, stale processing recovery, idempotency, duplicate prevention, audit/logging, rollback behavior, and tests before any worker code or SQL behavior is moved.
