# Email Delivery Executor Scope

## Summary

P1.2B-11A is a read-only scope check for a future `EmailDeliveryExecutor`.

The current production-validated state already has pure delivery layers:

- `NotificationSafetyGuard` sanitizes delivery configuration and detects no-op conditions.
- `DeliveryPayloadBuilder` builds lead/email payload data and safe projections.
- `DeliverySideEffectCommandBuilder` builds `queue_email_job` and `noop` command data.
- `DeliveryExecutionBoundary` validates command data and builds ExecutionPlan data.

None of these layers writes queues, sends mail, calls webhooks, mutates chat metadata, changes answer text, or changes the Public Widget response.

The safest next implementation step is still not real execution. P1.2B-11B should introduce only an unwired e-mail execution interface, result shapes, validation/no-op/blocked helpers, and log-safe result projections. It should not write `email_jobs` yet.

## Status After P1.2B-11

P1.2B-11B through P1.2B-11E are implemented, merged, and production-validated.

- `apps/api/src/chat/email-delivery-executor.boundary.ts` contains only e-mail delivery validation, classification, result data-object builders, and safe projections.
- `EmailDeliveryExecutionStatus`, `EmailDeliveryExecutionResult`, and `EmailDeliveryPlanValidationResult` are implemented as data shapes.
- `ready`, `skipped`, `blocked`, and `failed` result builders remain side-effect-free.
- Audit/log-safe result projections redact e-mail and phone values.
- The safe scope from this document was kept: no runtime execution, no `email_jobs` writes, no `EmailJobsService.enqueue`, no `EmailJobsService.processPendingJobs`, no Orchestrator wiring, no worker/SMTP changes, no webhooks, no external integrations, no feature flags, no migrations, and no Public Widget response changes.
- Production validation completed on API commit `eed94afb67107329156ee59265093e49e1dce09a`.
- Deferred areas remain deferred: real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, worker/SMTP execution, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring.

## Status After P1.2B-12

P1.2B-12B through P1.2B-12E are implemented, merged, and production-validated.

- `EmailQueueWriteBoundary` was added as a pure validation, request, and result data-object layer.
- `EmailDeliveryExecutor` Boundary remains a pure validation and result data-object layer.
- Queue write requests and results are not executed and are not wired into the orchestrator.
- Queue execution, real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, worker/SMTP execution, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `863739b1337e4ba6de48beb6779d861d2da117ce`.

## Status After P1.2B-13

P1.2B-13B through P1.2B-13E are implemented, merged, and production-validated.

- `EmailJobPersistenceBoundary` was added as a pure validation, request, and result data-object layer.
- `EmailDeliveryExecutor` Boundary and `EmailQueueWriteBoundary` remain pure data-object boundaries.
- Persistence requests and results are not executed and are not wired into the orchestrator.
- Real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, processing trigger decisions, Orchestrator wiring, worker/SMTP execution, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `8604f60f2a2822693f11b6accb066f3afab56c9f`.

## Status After P1.2B-14

P1.2B-14B through P1.2B-14E are implemented, merged, and production-validated.

- `EmailJobProcessingTriggerBoundary` was added as a pure validation, request, and result data-object layer.
- EmailDeliveryExecutor Boundary, EmailQueueWriteBoundary, and EmailJobPersistenceBoundary remain pure validation/result/request layers.
- Queue execution, processing execution, real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs` calls, worker/SMTP execution, retry/status/locking behavior, `report_runs` synchronization, and real `webhook_jobs` writes remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `3bfd9854894b7c5d241534877bf335e300dccd93`.

## Current Email Delivery Locations

| Method / Function | File | Responsibility | Writes `email_jobs` | Reads Config | Uses Recipient | Uses Secrets | Dedupe / Idempotency | Error Behavior | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ChatAgentOrchestratorService.queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Builds a live-chat lead notification and directly inserts an e-mail queue row. | Yes, direct SQL insert | `leadNotificationEmail`; SMTP configured state | `recipientEmail` | No SMTP secret directly; mailer config is checked indirectly | No e-mail-job idempotency key; relies on lead capture state before queueing | Missing recipient or SMTP is no-op; insert failure is caught and logged; chat response continues | High |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Inserts a queued e-mail job and immediately triggers pending-job processing. | Yes | Caller-provided payload only | `input.to` | No direct SMTP secret; processing uses mailer | Random job id; no semantic dedupe key | Insert errors throw; processor errors are retried/failed | High |
| `EmailJobsService.processPendingJobs` / `processJob` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Locks queued jobs, sends mail, updates status and report runs. | Updates `email_jobs` | Job row | `recipient_email` | SMTP credentials through `ReportMailerService` | `FOR UPDATE SKIP LOCKED` prevents concurrent pick; no duplicate prevention | Retry/backoff until `max_attempts`, then `failed`; logs failure | High |
| `WidgetLeadsService.capture` | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Public lead capture inserts lead/session data and queues a lead notification through `EmailJobsService`. | Yes, through `EmailJobsService.enqueue` | `leadNotificationEmail`; SMTP configured state | Site lead notification recipient | No direct SMTP secret | No service-local semantic e-mail dedupe | Lead remains stored if queueing fails | Medium |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Agent-run lead capture inserts lead and queues a notification through `EmailJobsService`. | Yes, through `EmailJobsService.enqueue` | Site config `leadNotificationEmail`; SMTP configured state | Site lead notification recipient | No direct SMTP secret | Dedupe by agent-run session and lead e-mail before lead insert | Queue errors are logged; invocation returns with `queuedNotification=false` | Medium |
| `WidgetAdminReportsService.runReport` | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Manual report run inserts report metadata and queues report e-mail through `EmailJobsService`. | Yes, through `EmailJobsService.enqueue` | Report subscription recipient | Report recipient | No direct SMTP secret | Report run id exists, but no generic e-mail job dedupe | Queue/build failure marks report run failed | Medium |
| `DeliveryPayloadBuilder` | `apps/api/src/chat/delivery-payload.builders.ts` | Builds lead notification payloads and e-mail job payload data. | No | Parameters only | `recipientEmail` in data object | No | None; pure builder | No throw for missing target in delivery payload path; no-op result possible | Low |
| `DeliverySideEffectCommandBuilder` | `apps/api/src/chat/delivery-side-effect.commands.ts` | Builds `queue_email_job` or `noop` command data from prepared payloads. | No | Parameters only | `recipientEmail` inside payload | No | None; pure builder | Missing e-mail job payload becomes `noop` command | Low |
| `DeliveryExecutionBoundary` | `apps/api/src/chat/delivery-execution.boundary.ts` | Validates command data and builds `queue_email_job`, `noop`, or `blocked` ExecutionPlan data. | No | Parameters only | `recipientEmail` inside payload | No | None; pure boundary | Invalid commands become blocked plans | Low |
| `NotificationSafetyGuard` | `apps/api/src/chat/notification-safety.guard.ts` | Sanitizes delivery config/payloads and evaluates target/no-op conditions. | No | Parameters only | Redacts/strips targets depending on mode | Redacts secret-like fields | None; pure guard | Missing/disabled targets become no-op reasons | Low |

## Existing Builders and Boundaries

`NotificationSafetyGuard` checks, sanitizes, strips, or redacts delivery-related data. It can identify usable e-mail targets and no-op reasons. It does not execute, write queues, read `process.env`, call providers, or log raw secrets.

`DeliveryPayloadBuilder` builds lead notification payloads and e-mail job payloads from already-known inputs. It does not render SMTP messages by itself, write `email_jobs`, enqueue workers, call mailers, or persist audit rows.

`DeliverySideEffectCommandBuilder` wraps prepared payloads into `queue_email_job` command data or emits `noop` command data. It does not execute commands and does not import queue services.

`DeliveryExecutionBoundary` validates command shape and creates ExecutionPlan data. Its `queue_email_job` plan is still only a data object. It does not insert into `email_jobs`, start workers, call `EmailJobsService`, or change chat responses.

## Email Job Side Effects

The only production e-mail side-effect table is `email_jobs`.

Current writers are:

- direct SQL in `ChatAgentOrchestratorService.queueInternalLeadNotification`,
- `EmailJobsService.enqueue`, used by public lead capture, agent-run lead capture, and report delivery.

Current processor behavior:

- picks queued rows with `FOR UPDATE SKIP LOCKED`,
- transitions jobs through `queued`, `processing`, `sent`, and `failed`,
- calls `ReportMailerService.send`,
- updates `report_runs` for report jobs,
- retries with increasing backoff until `max_attempts` is exhausted.

A future `EmailDeliveryExecutor` would be the first new component allowed to write `email_jobs`. That makes it a runtime boundary, not just another builder. It must stay separate from webhooks, ToolExecutor, ToolDispatcher, IntegrationDispatcher, and SMTP processing.

## Idempotency and Duplicate Behavior

Current duplicate prevention is uneven and mostly happens before e-mail queueing:

- Live-chat lead capture stores completion state and dedupes lead/contact records before notification queueing.
- `ToolExecutorService.captureLead` dedupes by `site_id`, session, e-mail, or phone before lead insert.
- `ToolDispatcherService.executeCaptureLead` dedupes by agent-run session and e-mail before lead insert.
- `EmailJobsService.enqueue` always creates a new random job id.
- `email_jobs` has retry state but no visible semantic idempotency key for lead notification jobs.
- `pendingLead.completedLeadId` can prevent repeat live-chat lead finalization, but it is not an e-mail-job idempotency key.
- `contactRequestId`, `conversationId`, `sessionId`, `siteId`, and `leadId` appear in related metadata paths, but there is no uniform uniqueness constraint for e-mail delivery.

Risk cases:

- A refactor that calls an e-mail executor twice for the same completed lead could create duplicate `email_jobs`.
- API restart after primary lead insert but before e-mail job insert keeps the lead and loses the notification under current direct-call semantics.
- API restart after e-mail job insert is recoverable because the cron processor can pick queued jobs later.
- Re-running public or agent lead capture may dedupe the lead in some paths, but report e-mails and direct e-mail queue calls do not have generic duplicate protection.

P1.2B-11B should not introduce a new dedupe policy. It should document required inputs for a later policy, such as `tenantId`, `siteId`, `sessionId`, `leadId`, `contactRequestId`, `conversationId`, command type, and reason code.

## Error Handling and No-op Behavior

Current no-op and failure behavior:

- Missing live-chat `leadNotificationEmail`: log skip and do not insert.
- Missing SMTP configuration in live chat or public lead capture: log skip and do not insert.
- Empty or invalid `recipientEmail` in pure builders: no-op or blocked data object depending on layer.
- `EmailJobsService.enqueue` insert failure: throws to caller.
- Live-chat `queueInternalLeadNotification` catches queue failure and keeps chat response successful.
- `WidgetLeadsService.capture` catches queue failure and keeps the stored lead.
- `ToolDispatcherService.executeCaptureLead` catches queue failure and reports `queuedNotification=false`.
- `EmailJobsService.processJob` catches SMTP/worker failures, retries, and eventually marks jobs failed.
- Report delivery failure can mark the corresponding report run failed.

A future executor must preserve these distinctions:

- no-op because e-mail delivery is not configured,
- blocked because command data is invalid,
- failed because queue insert failed after the primary business record exists,
- failed asynchronously because the worker or SMTP send failed,
- skipped because command type is not executable.

User-facing chat answers must not depend on the e-mail queue outcome.

## Secret and Logging Boundaries

Fields that must not be logged raw by a future executor:

- recipient e-mail values,
- lead contact e-mail values,
- lead phone values,
- mail body contents when they include user text,
- authorization headers,
- API keys,
- bearer tokens,
- signing secrets,
- webhook URLs,
- database URLs,
- SMTP credentials.

Current protections:

- `NotificationSafetyGuard` strips recipient and delivery target fields from admin/public views and redacts them for audit projections.
- `DeliveryPayloadBuilder`, `DeliverySideEffectCommandBuilder`, and `DeliveryExecutionBoundary` provide safe projection helpers.
- Public Widget paths must not expose delivery channels, preview data, or admin-only delivery fields.

Current risks to avoid expanding:

- Some existing internal log events include `recipientEmail`.
- `EmailJobsService.processJob` logs `recipientEmail` on failed send.
- E-mail job rows store recipient, subject, html, text, and metadata because the worker needs them.
- User-provided contact details can be present in rendered e-mail bodies and job metadata.

P1.2B-11B should use only log-safe result projections. It should not log raw command payloads, rendered mail bodies, e-mail job metadata, or recipient values.

## Safe / Unsafe Scope

Safe for P1.2B-11B if code is allowed:

- `EmailDeliveryExecutor` interface and type definitions.
- `EmailDeliveryExecutionResult` data shapes.
- validation helpers that accept an ExecutionPlan or command data object.
- no-op result builders.
- blocked result builders.
- failed result builders without queue writes.
- log-safe and audit-safe result projections.
- tests proving no DB, queue, SMTP, logger, or `process.env` dependency.
- an unwired executor shell that refuses or simulates execution without side effects.

Unsafe for P1.2B-11B:

- actual `email_jobs` inserts,
- `EmailJobsService.enqueue` calls,
- `queueInternalLeadNotification` rewiring,
- Orchestrator wiring,
- public lead capture rewiring,
- agent-run ToolDispatcher rewiring,
- report-delivery rewiring,
- retry/status behavior changes,
- semantic dedupe policy changes,
- DB schema or unique constraint changes,
- worker or SMTP behavior changes,
- any `webhook_jobs` work,
- webhook signing/header movement,
- ToolExecutor or ToolDispatcher consolidation,
- IntegrationDispatcher changes,
- DeliveryChannels automatic activation,
- Public Widget response changes.

Separate audits recommended:

- Email job dedupe and idempotency policy.
- Email worker retry and failure semantics.
- Webhook execution boundary.
- Tool delivery boundary.
- Integration dispatcher boundary.
- Delivery secrets and logging hardening.

## Proposed Boundary Services

### EmailDeliveryExecutor

Later runtime boundary for e-mail queue execution.

Eventual responsibilities:

- accept only validated `queue_email_job` ExecutionPlans,
- reject or skip `noop` and `blocked` plans,
- insert one `email_jobs` row through a narrowly scoped persistence path,
- return a structured execution result,
- never send SMTP directly,
- never execute webhooks,
- never change chat answers.

P1.2B-11B should not implement the queue insert yet.

### EmailDeliveryExecutionSafetyGuard

Pure pre-execution validation boundary.

Responsibilities:

- validate recipient presence without logging it,
- validate subject and body availability,
- validate required metadata fields,
- classify unsupported command types,
- build safe reason and error codes,
- provide log-safe projections.

It should not read environment variables, query the database, or decide idempotency beyond reporting missing correlation fields.

### EmailDeliveryExecutionResult Builder

Pure result object builder.

Responsibilities:

- build `executed`, `skipped`, `blocked`, and `failed` result data,
- include stable `reasonCode` and `errorCode`,
- include optional `jobId` only after a real executor exists,
- produce audit/log-safe projections with redacted contact values.

### EmailJobPersistenceAdapter

Deferred persistence boundary.

Potential future responsibilities:

- encapsulate the existing `email_jobs` insert,
- preserve current schema and status defaults,
- keep worker behavior unchanged,
- eventually support a separately approved idempotency policy.

This adapter should not be part of P1.2B-11B.

## Recommended P1.2B-11B Scope

Recommended scope:

- create an unwired `EmailDeliveryExecutor` type/interface layer,
- define result types and reason/error codes,
- add pure validation/no-op/blocked/failed result helpers,
- add log-safe and audit-safe projection helpers,
- add tests proving no side effects,
- leave all current runtime paths untouched.

Do not write `email_jobs` in P1.2B-11B.

Do not call `EmailJobsService.enqueue` in P1.2B-11B.

Do not wire the executor into `ChatAgentOrchestratorService`.

If even an executor shell feels too early during implementation review, reduce P1.2B-11B to result/validation helpers only and defer the executor class name until the persistence boundary is approved.

## Required Tests

Executor validation:

- `noop` plan returns skipped result.
- `blocked` plan returns blocked result.
- unsupported action returns blocked result.
- invalid e-mail queue plan returns blocked result.
- valid `queue_email_job` plan is recognized as executable but not executed in P1.2B-11B.

Execution result:

- `executed`, `skipped`, `blocked`, and `failed` result shapes are stable.
- `reasonCode` and `errorCode` are stable.
- log-safe and audit-safe projections redact e-mail and phone values.
- raw mail body and recipient values are not present in safe projections.

No side effects:

- no `email_jobs` insert,
- no `webhook_jobs` insert,
- no `widget_leads` insert,
- no `agent_tickets` insert,
- no `audit_logs` insert,
- no `EmailJobsService` import,
- no `ReportMailerService` import,
- no `process.env`,
- no logger requirement,
- no SMTP call.

Regression:

- `delivery-execution-boundary.test.cjs` remains green.
- `delivery-side-effect-commands.test.cjs` remains green.
- `delivery-payload-builders.test.cjs` remains green.
- `notification-safety-guard.test.cjs` remains green.
- `lead-capture-builders.test.cjs` remains green.
- `chat-agent-orchestrator.service.test.cjs` remains green.
- `widget-chat-flow.test.cjs` remains green.
- `email-jobs.service.test.cjs` remains green and unchanged.
- Public Widget response shape remains unchanged.

## Non-goals

P1.2B-11 is not:

- a Conversation Engine live activation,
- an AssistantProfile migration,
- a feature-flag rollout,
- a Public Widget response change,
- a chat answer text change,
- a DB migration,
- a queue schema change,
- an e-mail job writer in P1.2B-11B,
- a webhook executor,
- a webhook signing/header refactor,
- a ToolExecutor/ToolDispatcher consolidation,
- an IntegrationDispatcher change,
- a report delivery rewrite,
- an SMTP worker rewrite,
- an automatic deliveryChannels activation,
- a production wiring step.

## Current Status After P1.2B-16

EmailDeliveryExecutor Boundary was production-validated in P1.2B-11. EmailQueueWriteBoundary was production-validated in P1.2B-12. EmailJobPersistenceBoundary was production-validated in P1.2B-13. EmailJobProcessingTriggerBoundary was production-validated in P1.2B-14. EmailJobWorkerBoundary was production-validated in P1.2B-15. EmailJobStatusPolicyBoundary was production-validated in P1.2B-16.

Queue execution, processing execution, status/retry/locking execution, and real `email_jobs` / `webhook_jobs` writes remain not extracted.

Queue and processing execution, real `email_jobs`/`webhook_jobs` writes, worker/SMTP execution, retry/status/locking behavior, stale-processing recovery, and `report_runs` synchronization remain outside the extracted boundaries.

## Recommended Next Step

P1.2B-11 through P1.2B-16 are complete. The next recommended step is `P1.2B-17A` Email Jobs DB Schema / Idempotency Key Audit.

That audit should remain read-only and cover status transition policy, retry decision policy, locking boundaries, stale processing recovery, idempotency, duplicate prevention, audit/logging, Orchestrator wiring, rollback behavior, and tests before any processing trigger, worker, SQL, queue-write, or status-update code is moved.

Do not implement actual `email_jobs` insertion, executor wiring, worker changes, SMTP changes, webhooks, external integrations, or Public Widget response changes until that separate queue-write scope is approved.
