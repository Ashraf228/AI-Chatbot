# Delivery Payload Builder Scope

## Summary

P1.2B-8A scopes a future `DeliveryPayloadBuilder` extraction. It is intentionally documentation-only and does not introduce code, queue writes, database writes, delivery execution, feature flags, migrations, public widget changes, or Conversation Engine activation.

The safe next code step is narrow: extract only pure payload builders that already behave as data-object builders today. The executor boundary must remain unchanged. `ChatAgentOrchestratorService`, `ToolExecutorService`, `ToolDispatcherService`, `IntegrationEventDispatcherService`, `EmailJobsService`, and `WebhookJobsService` must continue to own side effects until separately audited.

## Status After P1.2B-8

P1.2B-8B through P1.2B-8E are implemented, merged, and production-validated.

- `apps/api/src/chat/delivery-payload.builders.ts` now contains pure lead/email Delivery payload builders, no-op target decisions, and audit/log-safe Delivery projections.
- `apps/api/src/chat/lead-capture.builders.ts` keeps its existing API and delegates compatible payload-building behavior to the new builder.
- The safe scope from this document was kept: no queue writes, no DB writes, no DeliveryExecutor, no external integrations, no feature flags, no migrations, and no Public Widget response changes.
- Deferred areas remain deferred: webhook payloads with headers/signing, ToolExecutor/ToolDispatcher consolidation, IntegrationDispatcher, WebhookJobs, DeliverySideEffectCommandBuilder, and DeliveryExecutor.
- Production validation completed on API commit `cbf561963bf4b33faa5889af79c71b7ae2127fb0`.

## Status After P1.2B-9

P1.2B-9B through P1.2B-9E are implemented, merged, and production-validated.

- `DeliverySideEffectCommandBuilder` was added as a pure command data-object layer.
- `queue_email_job` and `noop` commands remain data objects only.
- Delivery payload execution and queue writes remain outside the builder.
- `email_jobs`, `webhook_jobs`, DeliveryExecutor, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `3e6f71cc235f7cc01a6cc41949dd7ac683241722`.

## Status After P1.2B-10

P1.2B-10B through P1.2B-10E are implemented, merged, and production-validated.

- `DeliveryExecutionBoundary` was added as a pure validation and ExecutionPlan data-object layer.
- Payload, command, and ExecutionPlan layers remain side-effect-free.
- `DeliveryPayloadBuilder` remains pure payload/projection logic.
- `DeliverySideEffectCommandBuilder` remains pure command data-object logic.
- Execution Plans are not executed and are not wired into the orchestrator.
- `email_jobs`, `webhook_jobs`, DeliveryExecutor, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `b852b40a1a6a0afaeb2fcd9441483bdc2dd7ae37`.

## Status After P1.2B-11

P1.2B-11B through P1.2B-11E are implemented, merged, and production-validated.

- `EmailDeliveryExecutor` Boundary was added as a pure validation and result data-object layer.
- Payload, command, ExecutionPlan, and result layers remain side-effect-free.
- `DeliveryPayloadBuilder` remains pure payload/projection logic.
- `DeliverySideEffectCommandBuilder` remains pure command data-object logic.
- `DeliveryExecutionBoundary` remains pure validation and ExecutionPlan logic.
- Email delivery results are not executed and are not wired into the orchestrator.
- `email_jobs`, `webhook_jobs`, real DeliveryExecutor behavior, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService, worker/SMTP execution, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `eed94afb67107329156ee59265093e49e1dce09a`.

## Status After P1.2B-12

P1.2B-12B through P1.2B-12E are implemented, merged, and production-validated.

- `EmailQueueWriteBoundary` was added as a pure validation, request, and result data-object layer.
- Payload, command, ExecutionPlan, result, and queue-request layers remain side-effect-free.
- `DeliveryPayloadBuilder` remains pure payload/projection logic.
- `DeliverySideEffectCommandBuilder` remains pure command data-object logic.
- `DeliveryExecutionBoundary` remains pure validation and ExecutionPlan logic.
- `EmailDeliveryExecutor` Boundary remains pure validation and result data-object logic.
- Queue write requests and results are not executed and are not wired into the orchestrator.
- `email_jobs`, `webhook_jobs`, real DeliveryExecutor behavior, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService execution, worker/SMTP execution, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `863739b1337e4ba6de48beb6779d861d2da117ce`.

## Current Payload-Building Locations

| Methode/Funktion | Datei | Payload-Typ | liest Config | nutzt sensitive Werte | erzeugt Side Effects | kann pure extrahiert werden | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `buildLeadNotificationPayload` | `apps/api/src/chat/lead-capture.builders.ts` | Lead notification DTO for mail rendering | Parameters only | `recipientEmail`, contact fields | No | Already pure; can move or wrap first | Medium |
| `buildLeadEmailJobPayload` | `apps/api/src/chat/lead-capture.builders.ts` | `email_jobs` insert payload | Rendered mail object | `recipientEmail`, `leadEmail` | No | Already pure; safe candidate | Medium |
| `buildLeadSideEffectCommands` | `apps/api/src/chat/lead-capture.builders.ts` | Data-only command list | Parameters only | Contact fields, optional mail target | No | Partially safe, but includes non-delivery commands | Medium |
| `queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Lead email job data plus queue insert | `leadNotificationEmail`, SMTP state | Recipient and contact fields | Yes, writes `email_jobs` | No; only inner payload construction can be isolated | High |
| `LeadMailerService.buildLeadNotification` | `apps/api/src/modules/widget/services/lead-mailer.service.ts` | Rendered HTML/text mail | Lead notification DTO | Contact fields and dashboard URL | No | Defer; rendering is separate from payload building | Medium |
| `ToolDispatcherService.executeCaptureLead` notification branch | `apps/api/src/tools/tool-dispatcher.service.ts` | Tool lead notification mail payload | `leadNotificationEmail`, SMTP state | Recipient and lead fields | Yes, writes `email_jobs` through service | Not for P1.2B-8B | High |
| `ToolDispatcherService.executePushWebhook` | `apps/api/src/tools/tool-dispatcher.service.ts` | Webhook job payload, headers, signing data | Integration config and secrets | Endpoint, auth headers, signing secret | Yes, writes `webhook_jobs` | Not for P1.2B-8B | Very high |
| `ToolExecutorService.pushWebhook` | `apps/api/src/tools/tool-executor.service.ts` | Webhook job payload, headers, signing data | Integration config and secrets | Endpoint, auth headers, signing secret | Yes, writes `webhook_jobs` | Not for P1.2B-8B | Very high |
| `ToolDispatcherService.createTicket` forwarding branch | `apps/api/src/tools/tool-dispatcher.service.ts` | Ticket webhook payload and headers | Ticket integration config and secrets | Reporter contact fields and auth headers | Yes, writes `agent_tickets` and `webhook_jobs` | Not for P1.2B-8B | Very high |
| `IntegrationEventDispatcherService.dispatch` | `apps/api/src/integrations/integration-event-dispatcher.service.ts` | Integration event webhook payload body, headers, audit metadata | Active integration config and secrets | Endpoint, headers, signing secret, event payload | Yes, writes `webhook_jobs` and audit logs | Not for P1.2B-8B | Very high |
| `IntegrationsService.testForSite` | `apps/api/src/integrations/integrations.service.ts` | Test webhook body and headers | Integration config and secrets | Endpoint, headers, signing secret | Yes, external HTTP request | Not for P1.2B-8B | Very high |
| `IntegrationsService.buildHeaders` | `apps/api/src/integrations/integrations.service.ts` | Transport headers | Integration config and secrets | Authorization, API key, signing secret | No | Defer; security-critical transport boundary | Very high |
| `WebhookJobsService.enqueue` | `apps/api/src/tools/webhook-jobs.service.ts` | Persisted webhook job row | Endpoint, headers, payload, signing secret | Endpoint, headers, signing secret | Yes, writes `webhook_jobs` and triggers worker | No | Very high |
| `TicketWebhookConfigService.sendTest` | `apps/api/src/integrations/ticket-webhook-config.service.ts` | Ticket test event payload | Ticket webhook config | Test contact fields | Yes, dispatches event and updates config status | No | High |

## Safe Extraction Candidates

Safe candidates for P1.2B-8B are limited to data-object builders that can be tested without mocks for database, queue, SMTP, HTTP, integration, or worker behavior.

- `buildLeadNotificationPayload` can become or be wrapped by `buildLeadDeliveryPayload`.
- `buildLeadEmailJobPayload` can become or be wrapped by `buildEmailJobPayload`.
- Audit/log-safe projections can be added around existing notification payloads using `sanitizeNotificationPayloadForAudit`.
- No-op decisions for missing email targets can use `shouldNoopNotification` or `hasUsableEmailTarget` before building a payload.
- Input immutability and redaction tests can be added without changing runtime behavior.

These candidates still contain private delivery data for internal processing. They are safe only if the new builder remains pure and the orchestrator continues to decide when to persist or enqueue.

## Unsafe / Deferred Areas

The following areas must not be included in P1.2B-8B:

- `email_jobs` writes in `queueInternalLeadNotification`, `EmailJobsService.enqueue`, or tool paths.
- `webhook_jobs` writes in `ToolExecutorService`, `ToolDispatcherService`, `IntegrationEventDispatcherService`, or `WebhookJobsService`.
- Any external HTTP execution, including integration test webhooks.
- `IntegrationsService.buildHeaders`, because it mixes customer headers, reserved header filtering, bearer/API-key headers, and legacy signing secrets.
- HMAC signing, `payload_body` generation, `event_id` generation, and protected signing-secret persistence.
- Ticket forwarding status changes, because `queued` depends on actual queue write success.
- ToolExecutor/ToolDispatcher consolidation.
- Automatic activation or interpretation of `assistantProfile.deliveryChannels` as live public-widget delivery.
- Lead or ticket finalization decisions.
- Conversation metadata updates.
- Public widget response shape.

## NotificationSafetyGuard Integration

`NotificationSafetyGuard` should remain a pure safety and sanitizing layer. It must not execute delivery.

Relevant current and future integration points:

- `sanitizeDeliveryConfigForAdminRead` is already used by Admin Read sanitizing for `assistantProfile.deliveryChannels`.
- `sanitizeDeliveryConfigForLog` should be used before logging delivery config-like structures.
- `sanitizeNotificationPayloadForAudit` is the right boundary for audit/log-safe copies of mail or webhook payloads.
- `stripPublicNotificationFields` should protect any object that could reach public widget or customer-facing responses.
- `hasUsableEmailTarget` can gate email-payload construction.
- `hasUsableWebhookTarget` can gate future webhook-payload construction, but not queue writes.
- `shouldNoopNotification` can represent missing/disabled delivery targets as data.
- `assertNoPublicDeliverySecrets` can be used in tests to protect public DTOs.

Payloads may internally retain sensitive values required for delivery, such as recipient address, endpoint URL, auth headers, or signing material. Those values must never appear in public responses, admin diagnostics, generic logs, or audit metadata without redaction/removal.

## Proposed DeliveryPayloadBuilder Shape

A later code step may add:

```ts
// apps/api/src/chat/delivery-payload.builders.ts

export type DeliveryPayloadBuildResult<T> =
  | { status: 'ready'; payload: T; auditPayload: Record<string, unknown> }
  | { status: 'noop'; reasonCode: string; auditPayload: Record<string, unknown> };

export function buildEmailJobPayload(input: BuildEmailJobPayloadInput): DeliveryPayloadBuildResult<EmailJobPayload>;

export function buildLeadDeliveryPayload(input: BuildLeadDeliveryPayloadInput): DeliveryPayloadBuildResult<LeadDeliveryPayload>;

export function buildDeliveryAuditPayload(input: unknown): Record<string, unknown>;

export function buildSafeDeliveryPayloadForLog(input: unknown): Record<string, unknown>;
```

Names can be adjusted during implementation, but the boundary must stay pure:

- no `process.env`,
- no logger,
- no database access,
- no queue access,
- no fetch or external calls,
- no mutation of input objects,
- no answer-text construction,
- no feature-flag checks,
- no automatic `deliveryChannels` activation.

Webhook-oriented builders should be planned but deferred unless the extracted function only wraps an already-built non-secret payload. Header construction, signing, endpoint validation, and queue row construction should remain out of scope.

## Recommended P1.2B-8B Scope

P1.2B-8B should do only this:

- Create `apps/api/src/chat/delivery-payload.builders.ts`.
- Move or wrap lead email notification payload building from `lead-capture.builders.ts`.
- Keep `LeadMailerService.buildLeadNotification` unchanged.
- Keep `queueInternalLeadNotification` as the executor.
- Use `hasUsableEmailTarget` or `shouldNoopNotification` for data-only no-op results.
- Use `sanitizeNotificationPayloadForAudit` for audit/log-safe payload variants.
- Add focused unit tests for payload building, no-op behavior, sanitizing, and input immutability.
- Keep all existing lead, ticket, widget, notification safety, and smoke tests green.

P1.2B-8B should explicitly not do this:

- write `email_jobs`,
- write `webhook_jobs`,
- introduce `DeliverySideEffectCommandBuilder`,
- introduce `DeliveryExecutor`,
- change `ToolExecutorService`,
- change `ToolDispatcherService`,
- change `IntegrationEventDispatcherService`,
- change `WebhookJobsService`,
- execute webhook signing,
- change SMTP or email rendering,
- change lead or ticket finalization,
- alter conversation metadata,
- expose new public widget fields,
- enable feature flags,
- migrate or activate AssistantProfile delivery.

## Required Tests

### Email Payload Builder

- Builds a ready payload only when a valid recipient exists.
- Returns a no-op result when recipient email is missing or disabled.
- Preserves existing lead notification metadata shape.
- Does not mutate input objects.
- Keeps lead/contact fields compatible with current mail rendering.
- Does not place secrets into audit/log-safe payloads.

### Webhook Payload Builder

Webhook builders should mostly remain deferred. If a tiny webhook payload projection is added later, tests must prove:

- no queue write happens,
- missing or disabled webhook target returns no-op,
- `webhookUrl` is removed or redacted in audit/log-safe output,
- `signingSecret`, `token`, `apiKey`, and `authorization` never appear in safe output,
- headers are sanitized through `NotificationSafetyGuard`.

### Audit / Log Safe Payload

- Sensitive fields are removed or redacted.
- `recipientEmail` is not exposed in public or generic audit-safe output.
- Auth headers are redacted.
- Nested delivery channel config is sanitized recursively.
- Existing `NotificationSafetyGuard` tests remain green.

### Regression

- `notification-safety-guard.test.cjs` remains green.
- `lead-capture-builders.test.cjs` remains green.
- `it-support-ticket-helpers.test.cjs` remains green.
- `chat-agent-orchestrator.service.test.cjs` remains green.
- `widget-chat-flow.test.cjs` remains green.
- Public widget response shape remains unchanged.
- No unexpected `email_jobs` or `webhook_jobs` are created in compare/preview/test paths.

## Non-goals

- No DeliveryExecutor implementation.
- No email or webhook job execution.
- No DB writes.
- No queue writes.
- No external integration calls.
- No ToolExecutor/ToolDispatcher consolidation.
- No IntegrationEventDispatcher refactor.
- No WebhookJobsService refactor.
- No feature flags.
- No Conversation Engine public-widget activation.
- No AssistantProfile production migration.
- No Public Widget response change.
- No answer-text modernization.
- No automatic activation of `deliveryChannels`.
- No webhook signing execution.

## Recommended Next Step

P1.2B-8, P1.2B-9, P1.2B-10, P1.2B-11, and P1.2B-12 are complete. The next recommended step is `P1.2B-13A` EmailJobsService.enqueue Split / Persistence-vs-Processing Audit. Defer queue writes, webhook payload execution, signing, executor wiring, worker/SMTP changes, and external integrations until that audit defines a safe boundary.
