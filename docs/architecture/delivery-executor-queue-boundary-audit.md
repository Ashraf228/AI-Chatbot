# Delivery Executor / Queue Execution Boundary Audit

## Summary

P1.2B-10A audits the current Delivery and Queue execution paths before any `DeliveryExecutor` or `QueueExecutionBoundary` is introduced.

The current system already has pure builder layers:

- `NotificationSafetyGuard` sanitizes delivery configuration and evaluates no-op conditions.
- `DeliveryPayloadBuilder` builds lead email delivery payloads and audit-safe projections.
- `DeliverySideEffectCommandBuilder` builds `queue_email_job` and `noop` data commands only.

These builders do not execute delivery, write queues, call external services, or change Public Widget response shape.

Status after P1.2B-10:

- P1.2B-10B through P1.2B-10E are implemented, merged, and production-validated.
- `apps/api/src/chat/delivery-execution.boundary.ts` adds only Delivery command classification, e-mail queue command validation, ExecutionPlan data objects, and audit/log-safe ExecutionPlan projections.
- The safe scope from this audit was kept: Execution Plans are data objects only and are not executed.
- No runtime execution, no queue writes, no `DeliveryExecutor`, no Orchestrator wiring, no feature flags, no migrations, and no Public Widget response changes were introduced.
- Deferred areas remain deferred: `email_jobs` writes, `webhook_jobs` writes, real DeliveryExecutor behavior, Orchestrator wiring, Webhook execution, Webhook signing/header handling, ToolExecutor/ToolDispatcher consolidation, IntegrationDispatcher changes, WebhookJobsService changes, EmailJobsService changes, and external integrations.
- Production validation completed on API commit `b852b40a1a6a0afaeb2fcd9441483bdc2dd7ae37`.

Status after P1.2B-11:

- P1.2B-11B through P1.2B-11E are implemented, merged, and production-validated.
- `apps/api/src/chat/email-delivery-executor.boundary.ts` adds only e-mail delivery plan classification, plan validation, result data objects, and audit/log-safe result projections.
- The safe scope from the EmailDeliveryExecutor audit was kept: results are data objects only and are not executed.
- No runtime execution, no queue writes, no `EmailJobsService.enqueue`, no `EmailJobsService.processPendingJobs`, no Orchestrator wiring, no worker/SMTP changes, no feature flags, no migrations, and no Public Widget response changes were introduced.
- Queue execution and real `email_jobs` / `webhook_jobs` writes remain deferred.
- Production validation completed on API commit `eed94afb67107329156ee59265093e49e1dce09a`.

Runtime delivery execution still lives in several older paths:

- `ChatAgentOrchestratorService.queueInternalLeadNotification` directly inserts `email_jobs`.
- `EmailJobsService.enqueue` inserts `email_jobs` and starts asynchronous processing.
- `WebhookJobsService.enqueue` inserts `webhook_jobs` and starts asynchronous processing.
- `IntegrationEventDispatcherService.dispatch` directly inserts `webhook_jobs` for configured webhook integrations.
- `ToolExecutorService` and `ToolDispatcherService` write leads, contact requests, tickets, conversation metadata, and webhooks through their own paths.

Recommended outcome: do not build a full DeliveryExecutor yet. P1.2B-11 has already added an unwired EmailDeliveryExecutor Boundary with validation/result types only. The next safe step is a read-only e-mail queue-write boundary audit before any `email_jobs` persistence or `EmailJobsService.enqueue` behavior is moved. Webhook execution, signing, ToolExecutor/ToolDispatcher consolidation, and IntegrationDispatcher changes should remain out of scope.

## Current Queue / Delivery Execution Locations

| Method / Function | File | Side Effect | Table / Service | Reads Config | Uses Secrets | Retry / Dedupe | Error Behavior | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Inserts lead email job directly | `email_jobs` | `leadNotificationEmail`, SMTP configured state | Recipient email only | No email-job dedupe; lead dedupe happens before capture | Catches and logs queue errors; chat response continues | Medium: duplicate mail jobs can be created if called repeatedly after lead creation path changes |
| `EmailJobsService.enqueue` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Inserts queued email job and triggers processor | `email_jobs`, `ReportMailerService` | Mail payload from caller | Recipient email in job row | Retry with `retry_count`, `max_attempts`, backoff; no dedupe | Insert errors throw; processing errors mark queued/failed | Medium: generic executor candidate, but currently mixes queue insert and processing trigger |
| `EmailJobsService.processPendingJobs` | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Sends email and updates job/report status | `email_jobs`, `report_runs`, SMTP | Job row | Recipient email; SMTP credentials are internal to mailer | `FOR UPDATE SKIP LOCKED`; retry/backoff; no idempotency key | Marks failed after max attempts; logs recipient email | Medium: true external side effect, not a builder boundary |
| `WidgetLeadsService.capture` | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Inserts widget lead; updates session; queues email notification | `widget_leads`, `widget_sessions`, `EmailJobsService` | `leadNotificationEmail`; SMTP configured state | Recipient email only | No lead dedupe in this service; relies on caller/session flow | Lead remains stored if email queue fails | Medium: public lead capture path; not part of Conversation Engine refactor |
| `ToolExecutorService.captureLead` | `apps/api/src/tools/tool-executor.service.ts` | Inserts widget lead; updates conversation metadata; dispatches integration event | `widget_leads`, `conversations.metadata`, `IntegrationEventDispatcherService` | Site and integration state indirectly | Depends on integrations | Dedupe by `site_id`, session, email/phone | Tool result returns skipped/failed; integration failures are caught in dispatch wrapper | High: tool path combines storage, metadata, and event dispatch |
| `ToolExecutorService.scheduleContact` | `apps/api/src/tools/tool-executor.service.ts` | Inserts contact request; updates conversation metadata; dispatches integration event | `agent_contact_requests`, `conversations.metadata`, `IntegrationEventDispatcherService` | Integration state indirectly | Depends on integrations | Dedupe by site/email/phone within one hour | Tool result can fail; dispatch wrapper catches integration failures | High: delivery-adjacent contact handoff path |
| `ToolExecutorService.createTicket` | `apps/api/src/tools/tool-executor.service.ts` | Inserts ticket; updates conversation metadata and ticket metadata; dispatches ticket event | `agent_tickets`, `conversations.metadata`, `IntegrationEventDispatcherService` | Integration state indirectly | Depends on integration secrets if webhook enabled | No clear ticket dedupe visible in this path | Returns failed tool result for errors; dispatch failures are summarized | High: ticket creation and forwarding are coupled |
| `ToolExecutorService.pushWebhook` | `apps/api/src/tools/tool-executor.service.ts` | Dispatches event or queues direct webhook | `webhook_jobs`, `IntegrationEventDispatcherService`, `WebhookJobsService` | Integration connection config | Headers, API keys, signing secret depending on config | Webhook queue retry only; no dedupe at enqueue | Skips when not connected; fails on missing endpoint | High: webhook execution boundary with secrets/signing |
| `ToolExecutorService.handoff` | `apps/api/src/tools/tool-executor.service.ts` | Updates conversation metadata; dispatches handoff event | `conversations.metadata`, `IntegrationEventDispatcherService` | Integration state indirectly | Depends on integrations | No dedupe for handoff event | Dispatch failures caught in wrapper | Medium: handoff marker and event dispatch are coupled |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Inserts widget lead; queues email notification | `widget_leads`, `EmailJobsService` | Site config `leadNotificationEmail`; SMTP configured state | Recipient email only | Dedupe by agent-run session and email | Queue errors logged; invocation still succeeds with `queuedNotification=false` | Medium: agent-run path duplicates widget lead notification logic |
| `ToolDispatcherService.executeScheduleContact` | `apps/api/src/tools/tool-dispatcher.service.ts` | Inserts contact request | `agent_contact_requests` | None beyond run/site | No | No dedupe visible in dispatcher path | Throws on missing email/phone | Medium: separate contact request execution path |
| `ToolDispatcherService.executeCreateTicket` | `apps/api/src/tools/tool-dispatcher.service.ts` | Inserts ticket; optionally queues ticket webhook; updates ticket metadata | `agent_tickets`, `webhook_jobs` | Property ticketing config, integration config | API key or bearer token can be placed into headers; signing handled by job service when configured | No ticket dedupe; webhook queue retry only | Throws on invalid input; invocation finalized failed | High: includes webhook headers and ticket forwarding |
| `ToolDispatcherService.executePushWebhook` | `apps/api/src/tools/tool-dispatcher.service.ts` | Queues direct webhook job | `WebhookJobsService`, `webhook_jobs` | Integration connection config | Headers, API keys, signing secret depending on config | Webhook queue retry only; no enqueue dedupe | Throws if integration invalid or missing endpoint | High: direct webhook queue boundary |
| `IntegrationEventDispatcherService.dispatch` | `apps/api/src/integrations/integration-event-dispatcher.service.ts` | Inserts webhook job and records audit log | `webhook_jobs`, `audit_logs` | Active integration event connections | Headers and signing secret | No enqueue dedupe; queue retry later | Per-connection failure logged/audited and returned as failed | High: central event-to-webhook queue writer |
| `WebhookJobsService.enqueue` | `apps/api/src/tools/webhook-jobs.service.ts` | Validates URL, protects signing secret, inserts webhook job, triggers processor | `webhook_jobs` | Payload from caller | Signing secret; headers may contain authorization/API key | Retry via processor; no dedupe | Insert/validation errors throw | High: true webhook queue writer |
| `WebhookJobsService.processPendingJobs` | `apps/api/src/tools/webhook-jobs.service.ts` | Executes external HTTP webhook and updates job status | `webhook_jobs`, external HTTP target | Job row | Decrypts signing secret and sends headers | `FOR UPDATE SKIP LOCKED`; retry/backoff; no idempotency key visible | Non-2xx or exceptions mark queued/failed | Very high: external integration execution boundary |
| `TicketWebhookConfigService.sendTest` | `apps/api/src/integrations/ticket-webhook-config.service.ts` | Queues test webhook through dispatcher; patches integration test status | `webhook_jobs`, integration config | Ticket webhook config | Signing handled by dispatcher/integrations | Queue retry only; no dedupe | Throws if unconfigured; updates test status queued/failed | High: dashboard-triggered webhook test path |
| `WidgetAdminReportsService.triggerManualReport` | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Inserts report run and queues report email | `report_runs`, `email_jobs` | Report subscription recipient | Recipient email only | Report job retry; no duplicate protection beyond caller behavior | Marks report run failed when build/queue fails | Medium: report delivery path should not be folded into lead delivery executor |
| `WidgetAdminLeadsService.listLeads` | `apps/api/src/modules/widget/services/widget-admin-leads.service.ts` | Reads delivery status only | `email_jobs`, `webhook_jobs` | None | No | N/A | N/A | Low: read model, not execution |

## Side Effects

Current side effects are split across chat, widget, tool, integration, and queue services.

| Area | Writes `email_jobs` | Writes `webhook_jobs` | Writes `agent_contact_requests` | Writes `agent_tickets` | Writes `widget_leads` | Writes `conversations.metadata` | Writes `audit_logs` | External Calls |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Live chat lead flow | Yes, direct SQL in orchestrator | No | Yes, for appointment/contact request | No | Yes | Yes | Yes, lead audit | No direct external call |
| Public lead capture endpoint | Yes, through `EmailJobsService` | No | No | No | Yes | Session update only | No | SMTP later through job processor |
| Email job service | Yes | No | No | No | No | No | No | SMTP send during processing |
| Webhook job service | No | Yes | No | No | No | No | No | HTTP `fetch` during processing |
| ToolExecutor | No direct email queue visible | Yes, through dispatcher or webhook service | Yes | Yes | Yes | Yes | Tool audit through `ToolAuditService` | Indirect webhook queue and later HTTP |
| ToolDispatcher | Yes, lead/report-style notification | Yes | Yes | Yes | Yes | No conversation metadata in dispatcher itself | Tool invocation rows | Indirect webhook queue and later HTTP |
| IntegrationEventDispatcher | No | Yes, direct SQL | No | No | No | No | Yes | No direct HTTP; queue processor sends later |
| Ticket webhook config test | No | Yes, via dispatcher | No | No | No | No | Integration audit | No direct HTTP; queue processor sends later |

## Existing Builders and Guards

`NotificationSafetyGuard` is pure. It redacts or strips sensitive delivery fields for log, audit, admin read, and public modes. It also evaluates whether email or webhook targets are usable and returns no-op reason codes. It does not write queues, invoke mailers, invoke webhooks, read environment variables, or call providers.

`DeliveryPayloadBuilder` is pure. It builds lead notification payloads, email job payloads, and audit/log projections. It returns `ready` or `noop` results. It does not write `email_jobs`, `webhook_jobs`, `widget_leads`, `agent_tickets`, or `audit_logs`.

`DeliverySideEffectCommandBuilder` is pure. It builds `queue_email_job` and `noop` commands as data objects. It does not execute commands, import queue services, or call external integrations.

`DeliveryExecutionBoundary` is pure. It classifies supported command objects, validates e-mail queue command payloads, builds `queue`, `noop`, and `blocked` ExecutionPlan data objects, and returns audit/log-safe projections with e-mail and phone redaction. It does not write queues, invoke mailers, invoke webhooks, mutate metadata, import queue services, or call external integrations.

These boundaries are suitable inputs for a later executor, but they must remain separate from queue writing and external execution.

## Email Delivery Execution

There are three current email queue-writing patterns:

1. `ChatAgentOrchestratorService.queueInternalLeadNotification` directly inserts `email_jobs` for completed live-chat leads.
2. `EmailJobsService.enqueue` inserts `email_jobs` for widget lead notifications and reports.
3. `ToolDispatcherService.executeCaptureLead` queues lead notification emails through `EmailJobsService`.

The most limited future executor candidate is email-only and should accept only already-built `queue_email_job` commands. It should not build mail content, decide whether delivery should happen, or change chat answers.

Important current behavior to preserve:

- Missing lead recipient in live chat is a no-op with `lead_notification_skipped`.
- SMTP not configured is a no-op with `lead_notification_skipped`.
- Queue insert failure after lead capture is logged and does not break the public chat response.
- `EmailJobsService.enqueue` starts background processing with `void this.processPendingJobs()`.
- Email processing uses status transitions `queued`, `processing`, `sent`, and `failed`.
- Email retry backoff increments `retry_count` until `max_attempts`.

## Webhook Delivery Execution

Webhook queue and execution are higher risk and should not be included in the first executor scope.

Current webhook paths include:

- `WebhookJobsService.enqueue`, which validates public URLs, protects signing secrets, inserts `webhook_jobs`, and starts processing.
- `WebhookJobsService.processPendingJobs`, which sends HTTP requests via `fetch`.
- `IntegrationEventDispatcherService.dispatch`, which converts active event connections into `webhook_jobs` rows and writes audit logs.
- `ToolExecutorService.pushWebhook`, which either dispatches an event or directly queues a webhook.
- `ToolDispatcherService.executePushWebhook`, which directly queues a webhook for an agent run.
- `ToolDispatcherService.executeCreateTicket`, which can queue a ticket webhook when forwarding is enabled.
- `TicketWebhookConfigService.sendTest`, which queues a test webhook and writes test status.

Important current behavior to preserve:

- Webhook URL validation happens before enqueue.
- HMAC signing secrets may be encrypted into `webhook_jobs.signing_secret`.
- Headers may include authorization or API-key fields.
- Webhook jobs are processed asynchronously with locking and retry/backoff.
- Non-2xx responses are treated as failures and retried until exhausted.
- `last_response_body` is clipped.
- Missing or invalid HMAC signing secret marks the job failed/queued according to retry behavior and does not send a request.

## Tool / Integration Delivery Paths

`ToolExecutorService` and `ToolDispatcherService` are not simple delivery executors. They combine validation, storage, metadata mutation, queueing, integration dispatch, audit, and user-facing tool results.

They should not be consolidated into P1.2B-10B because:

- They create primary business records (`widget_leads`, `agent_contact_requests`, `agent_tickets`).
- They update `conversations.metadata`.
- They call `IntegrationEventDispatcherService`.
- They queue webhooks with headers and signing material.
- They manage tool or run status and audit lifecycle.

`IntegrationEventDispatcherService` should also remain outside the first executor scope. It is already a separate boundary, but it directly writes `webhook_jobs` and `audit_logs` while reading active integration connections.

## Idempotency and Duplicate Behavior

Current dedupe behavior is uneven:

- Live chat lead capture checks existing `widget_leads` by `site_id`, `session_id`, email, or phone before inserting.
- ToolExecutor lead capture repeats the same dedupe inside the monthly limit transaction.
- ToolDispatcher lead capture checks `site_id`, agent-run session, and email.
- Contact requests in the orchestrator and ToolExecutor dedupe by site/email/phone within one hour.
- ToolDispatcher contact requests do not show equivalent dedupe.
- `email_jobs` has retry behavior but no visible idempotency key or duplicate prevention for equivalent lead notifications.
- `webhook_jobs` has retry behavior but no visible idempotency key or enqueue duplicate prevention.
- `agent_tickets` insertion paths do not show broad dedupe, except pending ticket state can prevent duplicate live-chat ticket creation after a created ticket is stored in metadata.
- `IntegrationEventDispatcherService` creates a fresh event/job ID for each dispatch.
- Queue processors use `FOR UPDATE SKIP LOCKED`, which helps concurrent workers but does not dedupe semantically duplicate jobs.

Partial failure risks:

- Lead insert can succeed while email queue insert fails; current behavior logs and keeps the lead.
- Ticket insert can succeed while forwarding enqueue fails; current behavior records forwarding status in metadata where implemented.
- Integration dispatcher can enqueue some configured integrations and fail others; results are per connection.
- API restart after queue insert is acceptable because cron processors pick `queued` rows later.

## Error Handling and No-op Behavior

Observed behavior:

- Missing live-chat `leadNotificationEmail`: no-op log, no queue insert.
- Missing SMTP configuration: no-op log, no queue insert.
- Email queue insert failure after lead capture: caught and logged; user response remains successful.
- Missing public lead notification SMTP config: skipped log; lead remains captured.
- Missing webhook endpoint in ToolExecutor direct push: failed result.
- Missing or disconnected webhook integration in direct push: skipped or thrown depending on ToolExecutor vs ToolDispatcher path.
- Invalid webhook URL: enqueue throws via URL validation.
- Invalid HMAC secret during webhook processing: job failure/retry path, no request sent.
- External webhook non-2xx: job failure/retry path.
- SMTP send failure: job failure/retry path.
- IntegrationEventDispatcher per-connection failure: warning, audit log, failed result entry.
- ToolExecutor integration dispatch failure: caught by wrapper and converted to failed dispatch result.

The future executor must preserve the distinction between:

- no-op because delivery is not configured,
- validation failure before queue insert,
- queue insert failure after primary record creation,
- asynchronous worker failure after queue insert,
- external delivery failure after worker execution.

## Secret and Logging Boundaries

Sensitive field names in current delivery paths include:

- `authorization`
- `bearerToken`
- `apiKey`
- `signingSecret`
- `x-api-key`
- `x-webhook-secret`
- `headers`
- `webhookUrl`
- `endpointUrl`
- `recipientEmail`

Known protections:

- `NotificationSafetyGuard` redacts secret-like keys in log/audit mode and strips delivery targets for admin/public modes.
- `IntegrationEventDispatcherService` records audit metadata with masked headers.
- `WebhookJobsService` can encrypt signing secrets when `IntegrationSecretsService` is configured.
- Public notification stripping removes `deliveryChannels` containers.

Open logging risks to keep in scope for later hardening:

- `EmailJobsService.processJob` logs `recipientEmail` on failure.
- `ChatAgentOrchestratorService.queueInternalLeadNotification` logs `recipientEmail` for SMTP-not-configured and queue-failure paths.
- Tool and integration errors may include provider error messages; these must not include headers, tokens, or full payloads.
- `webhook_jobs.headers` can contain authorization/API-key material by design; admin reads and logs must never expose raw headers.
- `webhook_jobs.signing_secret` may be stored unencrypted if crypto is not configured.

Future executor logs should use only audit/log-safe projections and must not serialize raw command payloads with recipient emails, headers, tokens, signing secrets, or webhook URLs.

## Proposed Boundary Services

### DeliveryExecutorService

Later umbrella boundary for delivery side-effect commands.

Responsibilities:

- Accept validated `DeliverySideEffectCommand` objects.
- Route supported command types to specific executors.
- Return structured execution results.
- Enforce no-op commands as no writes.
- Apply log-safe projections only.

Non-responsibilities in first step:

- Webhook execution.
- ToolExecutor/ToolDispatcher consolidation.
- IntegrationDispatcher replacement.
- Public Widget response changes.

### EmailDeliveryExecutor

Safest first executor candidate.

Responsibilities:

- Accept only `queue_email_job` commands.
- Validate recipient, subject, and metadata.
- Insert one `email_jobs` row using existing schema.
- Return `{ status, jobId, reasonCode }`.
- Preserve current no-op and queue-failure semantics.

Constraints:

- No webhook support.
- No SMTP send.
- No direct external call.
- No response text change.
- No automatic wiring into chat until separately planned.

### WebhookDeliveryExecutor

Defer to a separate audit/implementation.

Responsibilities later:

- Validate URLs.
- Build and store webhook headers safely.
- Store signing material safely.
- Queue `webhook_jobs`.
- Coordinate retries and status.

This is unsafe for P1.2B-10B because signing, headers, URL validation, secrets storage, and external worker behavior are tightly coupled.

### DeliveryExecutionSafetyGuard

Potential pure validation layer for later executor steps.

Responsibilities:

- Validate command shape.
- Reject unsupported command types.
- Produce log-safe and audit-safe projections.
- Enforce no-op behavior.
- Optionally check idempotency/correlation keys before writes, once a policy exists.

## Safe / Unsafe Scope

Safe for later planning:

- Document an `EmailDeliveryExecutor` micro-plan.
- Add pure executor interfaces and result types with no wiring.
- Add validation helpers for command shape and log-safe output.
- Add an unwired executor shell that does not write queues.
- Add tests proving no-op commands do not write.

Potentially safe only with a separate implementation plan:

- Wire `queue_email_job` command execution to existing live-chat lead notification.
- Replace direct orchestrator `email_jobs` insert with an email-only executor.
- Preserve exact user response and queue-failure behavior.

Unsafe for P1.2B-10B:

- `webhook_jobs` writes.
- Webhook signing/header behavior.
- Direct external webhook execution.
- ToolExecutor/ToolDispatcher consolidation.
- IntegrationEventDispatcher replacement.
- DeliveryChannels automatic live activation.
- Queue schema changes.
- New retry engine.
- New idempotency semantics.
- Public Widget response changes.
- Conversation Engine live activation.

Separate audits recommended:

- `WebhookExecutionBoundary`
- `ToolDeliveryBoundary`
- `IntegrationDispatcherBoundary`
- `QueueRetryAndIdempotencyAudit`
- `DeliverySecretsLoggingAudit`

## Required Tests

Command validation:

- `noop` command is accepted and performs no writes.
- Invalid command type is rejected.
- `queue_email_job` without payload is rejected.
- Command log projection redacts recipient email and contact values.
- Secret-like keys are never present in executor logs.

Email queue execution:

- Valid `queue_email_job` command inserts exactly one `email_jobs` row.
- Missing recipient creates no insert and returns controlled failure/no-op.
- Queue insert DB failure returns controlled error.
- Existing no-op conditions remain no-op.
- User-facing chat answer remains unchanged when executor is introduced.
- Lead remains stored when email queueing fails.

Idempotency and duplicate behavior:

- Duplicate command behavior is explicitly tested once policy is selected.
- Existing lead dedupe remains unchanged.
- Existing contact request dedupe remains unchanged.
- No duplicate `email_jobs` are introduced by refactor wiring.

Webhook deferred:

- Email executor does not write `webhook_jobs`.
- Webhook commands are unsupported/deferred.
- Webhook headers/signing are not imported by email executor.

Regression:

- `DeliveryPayloadBuilder` remains pure.
- `DeliverySideEffectCommandBuilder` remains pure.
- `NotificationSafetyGuard` remains pure.
- `ChatAgentOrchestratorService` public response shape is unchanged.
- Public Widget response contains no debug, preview, delivery, or secret fields.
- Existing smoke tests for chat, leads, tickets, webhooks, and security boundaries remain green.

## Non-goals

P1.2B-10 is not intended to:

- Activate Conversation Engine in the Public Widget.
- Migrate AssistantProfile.
- Enable feature flags.
- Change Public Widget response shape.
- Change answer text.
- Create a DB migration.
- Change queue schema.
- Introduce a new retry engine.
- Execute webhook signing.
- Write `webhook_jobs` through a new path.
- Consolidate ToolExecutor or ToolDispatcher.
- Replace IntegrationEventDispatcher.
- Automatically activate `deliveryChannels`.
- Call external integrations directly.
- Wire a new executor into production chat without a separate deploy plan.

## Recommended Next Step

P1.2B-10 and P1.2B-11 are complete. P1.2B-10B did not build a full DeliveryExecutor, and P1.2B-11B did not write queues or wire execution.

Recommended next step:

1. Create `P1.2B-12A` as an Email Queue Write / `EmailJobsService.enqueue` Boundary Audit only.
2. Keep it email-only and queue-write-focused.
3. Do not move queue writes or introduce executor wiring in the audit step.
4. Do not wire it into `ChatAgentOrchestratorService`.
5. Do not include webhooks, signing, ToolExecutor, ToolDispatcher, or IntegrationDispatcher.
6. Scope idempotency, duplicate prevention, no-op versus queue behavior, retry/status behavior, partial failure handling, audit/logging, queue execution result, worker/SMTP behavior, rollback behavior, and tests before any implementation.

This keeps the next step small enough to validate without changing live chat behavior.
