# Email Queue Write Boundary Audit

Datum: 2026-07-07

## Summary

The email queue write boundary is still split across three live paths:

- `EmailJobsService.enqueue` is the general queue API for widget lead capture, tool-dispatcher lead capture, and report delivery.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` still writes `email_jobs` directly after lead capture.
- `EmailJobsService.processPendingJobs` is coupled to both persistence and SMTP delivery, and is triggered by cron plus opportunistically after `enqueue`.

The existing P1.2B delivery refactor steps are pure boundaries only. `DeliveryPayloadBuilder`, `DeliverySideEffectCommandBuilder`, `DeliveryExecutionBoundary`, and `EmailDeliveryExecutor` build or validate data objects, but they do not write `email_jobs`, send email, update report runs, or change public widget responses.

P1.2B-12B should therefore extract a narrow `EmailQueueWriteBoundary` or equivalent helper around queue-write input normalization and persistence policy. It should not introduce a real `EmailDeliveryExecutor`, move SMTP processing, change retry semantics, or change the public widget response.

## Status After P1.2B-12

P1.2B-12B through P1.2B-12E are implemented, merged, and production-validated.

- `apps/api/src/chat/email-queue-write.boundary.ts` contains only queue-write request/result data objects, source result classification helpers, queue write validation helpers, result builders, and safe projections.
- The safe scope from this audit was kept: the boundary builds and validates enqueue request/result data only.
- No runtime execution, no `email_jobs` writes, no `EmailJobsService.enqueue`, no `EmailJobsService.processPendingJobs`, no Orchestrator wiring, no worker/SMTP changes, no webhooks, no external integrations, no feature flags, no migrations, and no Public Widget response changes were introduced.
- Audit/log-safe projections redact e-mail addresses, phone values, body fields, and secret-like fields.
- Production validation completed on API commit `863739b1337e4ba6de48beb6779d861d2da117ce`.
- Deferred areas remain deferred: real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, Orchestrator wiring, worker/SMTP execution, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring.

## Status After P1.2B-13

P1.2B-13B through P1.2B-13E are implemented, merged, and production-validated.

- `EmailJobPersistenceBoundary` was added as a pure validation, request, and result data-object layer after the queue-write boundary.
- `EmailQueueWriteBoundary` remains a pure validation, request, and result data-object layer.
- Persistence requests and results are not executed and are not wired into the orchestrator.
- Real `email_jobs` writes, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, processing trigger decisions, Orchestrator wiring, worker/SMTP execution, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `8604f60f2a2822693f11b6accb066f3afab56c9f`.

## Status After P1.2B-14

P1.2B-14B through P1.2B-14E are implemented, merged, and production-validated.

- `EmailJobProcessingTriggerBoundary` was added as a pure validation, request, and result data-object layer after the persistence boundary.
- `EmailQueueWriteBoundary` and `EmailJobPersistenceBoundary` remain pure validation, request, and result data-object layers.
- Queue write requests, persistence requests, processing trigger requests, and their results are not executed and are not wired into the orchestrator.
- Real `email_jobs` writes, queue execution, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs` calls, Orchestrator wiring, worker/SMTP execution, retry/status/locking behavior, `report_runs` synchronization, webhooks, ToolExecutor/ToolDispatcher, IntegrationDispatcher, and production wiring remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `3bfd9854894b7c5d241534877bf335e300dccd93`.

## Current Email Queue Write Locations

| Location | Current behavior | Writes `email_jobs` | Triggers processing | Scope risk |
| --- | --- | --- | --- | --- |
| `apps/api/src/modules/widget/services/email-jobs.service.ts` `enqueue` | Inserts queued email job for `lead_notification` and `report` jobs | Yes | Yes, calls `processPendingJobs` asynchronously | High |
| `apps/api/src/chat/chat-agent-orchestrator.service.ts` `queueInternalLeadNotification` | Builds lead notification mail payload and inserts the job directly | Yes | No direct trigger; cron later processes | High |
| `apps/api/src/modules/widget/services/widget-leads.service.ts` `capture` | Captures public widget lead and calls `EmailJobsService.enqueue` when notification email and SMTP are configured | Indirect | Yes via `enqueue` | Medium |
| `apps/api/src/tools/tool-dispatcher.service.ts` `executeCaptureLead` | Stores tool-captured lead and calls `EmailJobsService.enqueue` for notification mail | Indirect | Yes via `enqueue` | Medium |
| `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` report trigger | Creates `report_runs`, renders report mail, and calls `EmailJobsService.enqueue` | Indirect | Yes via `enqueue` | Medium |
| `apps/api/src/modules/widget/services/email-jobs.service.ts` `processPendingJobs` | Picks queued jobs, sends mail through `ReportMailerService`, updates job/report state | No new job insert | Processes queue | High |

## Existing Builders and Boundaries

| Boundary | File | Role | Side effects |
| --- | --- | --- | --- |
| `DeliveryPayloadBuilder` | `apps/api/src/chat/delivery-payload.builders.ts` | Builds lead notification payloads and email job payload data | None |
| `DeliverySideEffectCommandBuilder` | `apps/api/src/chat/delivery-side-effect.commands.ts` | Converts delivery payload results into `queue_email_job` or `noop` commands | None |
| `DeliveryExecutionBoundary` | `apps/api/src/chat/delivery-execution.boundary.ts` | Validates delivery commands and returns execution plan data | None |
| `EmailDeliveryExecutor` boundary | `apps/api/src/chat/email-delivery-executor.boundary.ts` | Validates email delivery execution plans and returns result data | None |
| `NotificationSafetyGuard` | `apps/api/src/chat/notification-safety.guard.ts` | Sanitizes notification payloads and checks no-op/sensitive boundaries | None |
| `LeadCaptureBuilders` compatibility exports | `apps/api/src/chat/lead-capture.builders.ts` | Re-exports lead notification/email job builders and builds side-effect commands | None |

These boundaries are intentionally not wired to queue writes. Tests assert they do not import `PrismaService` and do not reference `email_jobs`, `webhook_jobs`, `widget_leads`, `agent_tickets`, or `audit_logs`.

## EmailJobsService.enqueue Behavior

`EmailJobsService.enqueue` currently performs three responsibilities:

1. Generates a random job ID.
2. Inserts a row into `email_jobs` with:
   - `kind`
   - `status='queued'`
   - `recipient_email`
   - `subject`
   - `html`
   - `text`
   - JSON `metadata`
   - `retry_count=0`
   - `max_attempts`, defaulting to `5`
   - `available_at=now()`
3. Calls `processPendingJobs()` asynchronously after the insert.

The method returns `{ id, queued: true }`. It does not expose a dry-run mode, idempotency key, dedupe check, or sanitized log/audit projection. Input validation is mostly structural and relies on callers to pass safe, already-rendered mail content.

## processPendingJobs Coupling

`processPendingJobs` is both a cron handler and an internal opportunistic worker trigger.

Current coupling:

- `enqueue` persists a job and immediately starts processing in the same service.
- `processPendingJobs` selects jobs with `FOR UPDATE SKIP LOCKED`.
- `processJob` sends via `ReportMailerService.send`.
- Success updates `email_jobs.status='sent'`, clears lock/error fields, and sets `sent_at`.
- Failure updates retry state, `available_at`, `last_error`, and eventually `status='failed'`.
- Report jobs update `report_runs` through `syncRelatedRecords`.

This means the queue-write boundary and worker boundary are not separated. Any refactor must avoid changing when processing starts unless a dedicated worker migration is planned separately.

## Email Job Side Effects

| Side effect | Current location | Notes |
| --- | --- | --- |
| `email_jobs` insert | `EmailJobsService.enqueue` and `ChatAgentOrchestratorService.queueInternalLeadNotification` | Direct Orchestrator insert bypasses the central service |
| SMTP send | `EmailJobsService.processJob` via `ReportMailerService.send` | Not part of P1.2B-12B |
| `email_jobs` status update | `EmailJobsService.processJob` | Includes retry, sent, failed, lock, and error state |
| `report_runs` update | `EmailJobsService.syncRelatedRecords` | Only for `kind='report'` with `metadata.reportRunId` |
| lead notification logs | Orchestrator, WidgetLeadsService, ToolDispatcherService, EmailJobsService | Some logs include full recipient fields today |
| lead capture writes | Orchestrator, WidgetLeadsService, ToolDispatcherService | Must stay outside email queue boundary |

## Idempotency and Duplicate Behavior

There is no queue-level unique constraint or semantic idempotency key for `email_jobs`.

Current duplicate protection happens before the queue write:

- `ChatAgentOrchestratorService.captureLead` dedupes lead rows by site/session and matching email or phone.
- `ToolDispatcherService.executeCaptureLead` dedupes tool-created leads by site/session and email.
- `WidgetLeadsService.capture` inserts a lead and then queues notification without an email-job dedupe layer.
- Report delivery creates a `report_runs` row and queues one report email for that run.

Risk:

- Retried caller execution after a successful lead insert but before/after email queue insert can still create duplicate email jobs if the caller path is not idempotent.
- The direct Orchestrator insert and `EmailJobsService.enqueue` can diverge in defaults or future validations.
- Random job IDs prevent accidental primary-key collisions but do not prevent semantic duplicates.

P1.2B-12B may document and normalize optional correlation metadata, but should not add DB constraints or change retry/dedupe behavior without a migration plan.

## Error Handling and No-op Behavior

Current no-op and error behavior:

- Missing lead notification recipient in the Orchestrator logs `lead_notification_skipped` and returns.
- SMTP not configured logs `lead_notification_skipped` and returns.
- `WidgetLeadsService` and `ToolDispatcherService` skip queueing when SMTP is not configured.
- Queue insert failures are caught by lead notification callers and logged, while lead capture remains completed.
- Report queue failures mark the corresponding `report_runs` row as failed and rethrow.
- Worker send failures retry with increasing delay and eventually mark the job failed.

Risk:

- Lead notification queue failures are non-blocking for lead capture, but report queue failures are blocking for report trigger results.
- Error logging can include recipient fields.
- `enqueue` has no no-op result type; no-op logic lives in callers or pure helper boundaries.

## Secret and Logging Boundaries

Email queue records contain sensitive or personal data:

- `recipient_email`
- rendered `html`
- rendered `text`
- `metadata.leadEmail`
- report recipient metadata
- failure `last_error`

Existing pure boundaries provide safe projections for delivery payloads, commands, execution plans, and email delivery results. The live queue writer does not yet consistently use these projections.

Logging risks to preserve and later improve carefully:

- `lead_notification_skipped`, `lead_notification_queued`, and `lead_notification_failed` include recipient fields in some paths.
- `email_job_failed` logs recipient fields and error messages.
- Report and lead mail bodies are stored in `email_jobs`; they must never be copied into logs or audit docs.

P1.2B-12B should prefer sanitized queue-write result projections for logs/tests, but should not redact persisted queue payloads because the worker needs the actual recipient and message body.

## Safe Scope for P1.2B-12B

Allowed:

- Create a pure or narrow `EmailQueueWriteBoundary` / helper module.
- Normalize `EmailJobPayload` into an `EmailQueueWriteInput`.
- Validate required queue-write fields without sending email.
- Build sanitized log/audit projections for queue-write attempts and results.
- Build no-op / blocked result data objects for missing input.
- Add tests that prove the boundary does not send email, process jobs, or write other queues.
- Keep existing queue writes in their current services.
- Optionally route the Orchestrator direct insert through a local helper only if SQL, params, defaults, and response behavior remain byte-for-byte equivalent in tests.

## Unsafe / Deferred Scope

Not allowed for P1.2B-12B:

- Move `EmailJobsService.enqueue` into `EmailDeliveryExecutor`.
- Move SMTP sending or worker processing.
- Change `processPendingJobs`.
- Change cron timing, locking, retry, backoff, `max_attempts`, or failure semantics.
- Add DB constraints or migrations.
- Introduce a real `DeliveryExecutor`.
- Write `email_jobs` from pure helper modules.
- Write `webhook_jobs`, `agent_tickets`, `widget_leads`, or `audit_logs`.
- Change public widget responses, response texts, or live routing.
- Change ToolExecutor, ToolDispatcher, IntegrationDispatcher, or WebhookJobs behavior.
- Add webhook payload/signing/header handling to email queue scope.

## Proposed Boundary Services

Recommended staged target:

| Stage | Boundary | Responsibility | Executes side effects |
| --- | --- | --- | --- |
| P1.2B-12B | `EmailQueueWriteBoundary` | Validate/normalize queue-write inputs and produce sanitized projections | No |
| Later | `EmailJobsService.enqueue` wrapper cleanup | Use normalized inputs consistently, preserving behavior | Yes, only where it already writes |
| Later | Orchestrator queue insert alignment | Replace direct SQL insert with central queue writer or equivalent adapter | Yes, behavior-preserving only |
| Later | Worker boundary | Separate `processPendingJobs` from enqueue trigger if needed | Yes, separate project |
| Later | Real `EmailDeliveryExecutor` | Execute validated plans by invoking queue writer | Yes, only after isolated validation |

The important boundary is conceptual: queue-write preparation can be extracted safely now; queue-write execution and worker execution should remain visible and explicit.

## Recommended P1.2B-12B Scope

Implement only:

1. `apps/api/src/chat/email-queue-write.boundary.ts` or similarly named pure helper.
2. Types for queue-write input/result data.
3. Validation for:
   - `kind`
   - `recipientEmail`
   - `subject`
   - at least one body field
   - required metadata fields for lead notifications where available
4. Conversion from `EmailJobPayload` to queue-write input data.
5. Sanitized log/audit projections that redact email addresses, phone numbers, body fields, and secret-like keys.
6. Tests proving:
   - valid lead email payload becomes queue-write-ready data.
   - missing recipient/body becomes blocked/no-op data.
   - projections redact contact/body fields.
   - source remains side-effect free.

Do not wire it into `EmailJobsService.enqueue` or `ChatAgentOrchestratorService.queueInternalLeadNotification` in the first implementation unless the PR explicitly stays behavior-neutral and has focused regression tests for all existing call paths.

## Required Tests

Minimum new or updated tests:

- `email-queue-write-boundary.test.cjs`
  - valid lead notification payload validates.
  - valid report payload validates if report scope is included.
  - missing recipient blocks.
  - missing subject/body blocks.
  - sanitized projection redacts recipient, lead email, phone-like values, and body content.
  - source file has no `PrismaService`, `email_jobs`, `webhook_jobs`, `widget_leads`, `agent_tickets`, `audit_logs`, `ReportMailerService`, `process.env`, or SMTP calls.

Existing regression tests to keep green:

- `apps/api/test/email-jobs.service.test.cjs`
- `apps/api/test/widget-leads.service.test.cjs`
- `apps/api/test/tool-dispatcher.service.test.cjs`
- `apps/api/test/chat-agent-orchestrator.service.test.cjs`
- `apps/api/test/widget-chat-flow.test.cjs`
- `apps/api/test/delivery-payload-builders.test.cjs`
- `apps/api/test/delivery-side-effect-commands.test.cjs`
- `apps/api/test/delivery-execution-boundary.test.cjs`
- `apps/api/test/email-delivery-executor-boundary.test.cjs`
- `apps/api/test/notification-safety-guard.test.cjs`

Suggested command set for implementation PR:

```bash
npm run check:api
npm run build:api
node --test apps/api/test/email-queue-write-boundary.test.cjs
node --test apps/api/test/email-jobs.service.test.cjs
node --test apps/api/test/widget-leads.service.test.cjs
node --test apps/api/test/tool-dispatcher.service.test.cjs
node --test apps/api/test/chat-agent-orchestrator.service.test.cjs
node --test apps/api/test/widget-chat-flow.test.cjs
node --test apps/api/test/delivery-payload-builders.test.cjs
node --test apps/api/test/delivery-side-effect-commands.test.cjs
node --test apps/api/test/delivery-execution-boundary.test.cjs
node --test apps/api/test/email-delivery-executor-boundary.test.cjs
npm run test:smoke --workspace=apps/api
npm run check:all
npm run security:audit:production-contexts
npm run security:check-authorization-matrix
npm run test:security-boundaries
git diff --check
```

## Non-goals

- No deploy.
- No migration.
- No feature flags.
- No Production config changes.
- No AssistantProfile migration.
- No Conversation Engine public-widget activation.
- No public widget response changes.
- No response text changes.
- No new queue writes in this audit.
- No SMTP execution changes.
- No worker or cron changes.
- No webhook delivery changes.
- No ToolExecutor, ToolDispatcher, IntegrationDispatcher, or WebhookJobs changes.

## Recommended Next Step

P1.2B-12, P1.2B-13, and P1.2B-14 are complete. The next recommended step is `P1.2B-15A` EmailJobs Worker / processPendingJobs Refactor Boundary Audit.

That audit should remain read-only and cover processing trigger decisions, `EmailJobsService.processPendingJobs`, worker/SMTP behavior, idempotency, duplicate prevention, no-op versus queue behavior, retry/status behavior, partial failure handling, audit/logging, Orchestrator wiring, and rollback behavior before any processing trigger or worker code is moved.
