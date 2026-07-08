# Delivery Side Effect Command Builder Scope

## Summary

This document defines the first safe scope for a future `DeliverySideEffectCommandBuilder`.
The goal is to separate delivery command construction from execution without changing live chat behavior, public widget responses, answer text, queue writes, database writes, or integration dispatch.

P1.2B-9B should only introduce pure, stateless command builders for existing lead/email delivery paths. Commands may describe what the existing runtime would do, but they must not execute it.

## Status After P1.2B-9

P1.2B-9B through P1.2B-9E are implemented, merged, and production-validated.

- `apps/api/src/chat/delivery-side-effect.commands.ts` contains pure DeliverySideEffectCommand data-object builders.
- `queue_email_job` remains a data object only and is not executed by the new helper.
- `noop` remains a data object only.
- Audit/log-safe command projections and e-mail/phone redaction are validated.
- The safe scope from this document was kept: no queue writes, no database writes, no DeliveryExecutor, no external integrations, no feature flags, no migrations, and no Public Widget response changes.
- Production validation completed on API commit `3e6f71cc235f7cc01a6cc41949dd7ac683241722`.
- Deferred areas remain deferred: `email_jobs` writes, `webhook_jobs` writes, webhook commands with signing or headers, DeliveryExecutor, ToolExecutor/ToolDispatcher consolidation, IntegrationDispatcher, WebhookJobsService, and external integrations.

## Status After P1.2B-10

P1.2B-10B through P1.2B-10E are implemented, merged, and production-validated.

- `DeliveryExecutionBoundary` was added as a pure validation and ExecutionPlan data-object layer.
- DeliverySideEffectCommandBuilder remains a pure command data-object layer.
- Command execution and queue writes remain outside both helper layers.
- `email_jobs`, `webhook_jobs`, DeliveryExecutor, Orchestrator wiring, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `b852b40a1a6a0afaeb2fcd9441483bdc2dd7ae37`.

## Status After P1.2B-11

P1.2B-11B through P1.2B-11E are implemented, merged, and production-validated.

- `EmailDeliveryExecutor` Boundary was added as a pure validation and result data-object layer.
- DeliverySideEffectCommandBuilder remains a pure command data-object layer.
- DeliveryExecutionBoundary remains a pure validation and ExecutionPlan data-object layer.
- Command, plan, and result layers remain side-effect-free.
- `email_jobs`, `webhook_jobs`, real DeliveryExecutor behavior, Orchestrator wiring, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService, worker/SMTP execution, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `eed94afb67107329156ee59265093e49e1dce09a`.

## Status After P1.2B-12

P1.2B-12B through P1.2B-12E are implemented, merged, and production-validated.

- `EmailQueueWriteBoundary` was added as a pure validation, request, and result data-object layer.
- DeliverySideEffectCommandBuilder remains a pure command data-object layer.
- DeliveryExecutionBoundary remains a pure validation and ExecutionPlan data-object layer.
- EmailDeliveryExecutor Boundary remains a pure validation and result data-object layer.
- Command, plan, result, and queue-request layers remain side-effect-free.
- `email_jobs`, `webhook_jobs`, real DeliveryExecutor behavior, Orchestrator wiring, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService execution, worker/SMTP execution, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `863739b1337e4ba6de48beb6779d861d2da117ce`.

## Status After P1.2B-13

P1.2B-13B through P1.2B-13E are implemented, merged, and production-validated.

- `EmailJobPersistenceBoundary` was added as a pure validation, request, and result data-object layer.
- DeliverySideEffectCommandBuilder, DeliveryExecutionBoundary, EmailDeliveryExecutor Boundary, and EmailQueueWriteBoundary remain pure data-object layers.
- Command, plan, result, queue-request, and persistence-request layers remain side-effect-free.
- `email_jobs`, `webhook_jobs`, real DeliveryExecutor behavior, Orchestrator wiring, ToolExecutor/ToolDispatcher, IntegrationDispatcher, WebhookJobsService, EmailJobsService execution, processing trigger decisions, worker/SMTP execution, and external integrations remain deferred.
- Public Widget response shape, answer text, feature flags, migrations, and side effects remained unchanged.
- Production validation completed on API commit `8604f60f2a2822693f11b6accb066f3afab56c9f`.

## Current Command / Side-Effect Locations

| Method / Function | File | Responsibility | Reads Metadata | Writes Metadata | Creates Side Effects | Response Text | Extraction Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `buildLeadDeliveryPayload` | `apps/api/src/chat/delivery-payload.builders.ts` | Builds a safe result around lead notification payload readiness or no-op state. | No | No | No | No | Low |
| `buildLeadEmailJobPayload` | `apps/api/src/chat/delivery-payload.builders.ts` | Builds the email job payload object from an already rendered lead notification email. | No | No | No | No | Low |
| `buildDeliveryAuditPayload` | `apps/api/src/chat/delivery-payload.builders.ts` | Builds sanitized delivery audit metadata. | No | No | No | No | Low |
| `buildSafeDeliveryPayloadForLog` | `apps/api/src/chat/delivery-payload.builders.ts` | Produces a log-safe delivery projection through `NotificationSafetyGuard`. | No | No | No | No | Low |
| `buildLeadSideEffectCommands` | `apps/api/src/chat/lead-capture.builders.ts` | Builds broad lead side-effect command data for lead insert, contact request, audit, metadata, and email queue intent. | No | No | No | No | Medium because it covers more than delivery. |
| `buildTicketSideEffectCommands` | `apps/api/src/chat/it-support-ticket.helpers.ts` | Builds broad ticket side-effect command data for ticket insert, audit, metadata, and notification intent. | No | No | No | No | Medium because ticket delivery should remain separate from lead/email delivery. |
| `captureLead` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Deduplicates and inserts `widget_leads`, then updates `widget_sessions`. | No | No | Yes: `widget_leads`, `widget_sessions`. | No | High |
| `createContactRequest` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Deduplicates and inserts `agent_contact_requests`. | No | No | Yes: contact request insert. | No | High |
| `saveConversationMetadata` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Persists `pendingLead`, `pendingTicket`, and `conversationState` patches. | Yes | Yes | Yes: `conversations` update. | No | High |
| `recordLeadAudit` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Writes lead-related audit entries. | No | No | Yes: `audit_logs` insert. | No | Medium |
| `queueInternalLeadNotification` | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Renders lead notification email, builds email job payload, inserts `email_jobs`, and logs queue result. | No | No | Yes: `email_jobs` insert and logging. | No | High |
| `ToolDispatcherService.executeCaptureLead` | `apps/api/src/tools/tool-dispatcher.service.ts` | Captures leads from tool runs and optionally enqueues notification email. | No | No | Yes: `widget_leads`, `email_jobs`. | No | High |
| `ToolDispatcherService.executePushWebhook` | `apps/api/src/tools/tool-dispatcher.service.ts` | Loads integration config, builds headers, and enqueues webhook jobs. | No | No | Yes: `webhook_jobs`, secret-bearing headers. | No | High |
| `ToolDispatcherService.createTicket` | `apps/api/src/tools/tool-dispatcher.service.ts` | Inserts `agent_tickets`, builds forwarding payloads, and may enqueue webhook jobs. | No | No | Yes: `agent_tickets`, `webhook_jobs`. | No | High |
| `ToolExecutorService.pushWebhook` | `apps/api/src/tools/tool-executor.service.ts` | Dispatches or enqueues webhook delivery from tool execution. | No | No | Yes: integration dispatch or `webhook_jobs`. | No | High |
| `IntegrationEventDispatcherService.dispatch` | `apps/api/src/integrations/integration-event-dispatcher.service.ts` | Builds webhook event payloads, headers, signing metadata, writes webhook jobs, and records audit results. | No | No | Yes: `webhook_jobs`, audit. | No | High |
| `WebhookJobsService.enqueue` | `apps/api/src/tools/webhook-jobs.service.ts` | Validates endpoint, serializes payload, protects signing secret, inserts `webhook_jobs`. | No | No | Yes: `webhook_jobs`. | No | High |
| `IntegrationsService.buildHeaders` | `apps/api/src/integrations/integrations.service.ts` | Builds delivery headers from integration config and secrets. | No | No | No DB write, but handles secret-bearing values. | No | High |

## Safe Command Candidates

P1.2B-9B may extract only data-only command creation for existing lead/email delivery flows:

- `queue_email_job` command for an email job payload that is already constructed from the existing `buildLeadEmailJobPayload` path.
- `noop` command for missing, disabled, or unsafe delivery configuration using `NotificationSafetyGuard` reason codes.
- `record_delivery_audit` command as a sanitized, data-only audit projection from `buildDeliveryAuditPayload`.
- `delivery_log_projection` helper for command logging that strips public-unsafe or sensitive delivery fields.

These candidates are safe only if the command builder remains pure and the existing orchestrator or existing services keep executing all writes.

## Unsafe / Deferred Areas

The following areas must remain out of scope for P1.2B-9B:

- Writing `email_jobs`.
- Writing `webhook_jobs`.
- Writing `widget_leads`.
- Writing `agent_tickets`.
- Writing `agent_contact_requests`.
- Updating `conversations.metadata`.
- Moving `recordLeadAudit` or other audit writes.
- Building webhook payloads that include headers, signing modes, signing secrets, endpoint URLs, API keys, or bearer tokens.
- Creating a `DeliveryExecutor`.
- Creating a `DeliverySideEffectCommandExecutor`.
- Changing `ToolExecutorService` or `ToolDispatcherService` behavior.
- Changing `IntegrationEventDispatcherService` behavior.
- Changing `WebhookJobsService` behavior.
- Changing email rendering in `LeadMailerService`.
- Changing any public widget response field, answer text, route, or status code.
- Automatically enabling `assistantProfile.deliveryChannels`.

## NotificationSafetyGuard Integration

`NotificationSafetyGuard` should be the source for delivery safety decisions and sanitized projections:

- Use `getNotificationNoopReason` or `shouldNoopNotification` before returning a sendable command.
- Use `hasUsableEmailTarget` for lead/email command readiness.
- Use `sanitizeNotificationPayloadForAudit` before exposing command payloads to logs, diagnostics, or tests.
- Use `assertNoPublicDeliverySecrets` in tests for any public-facing command projection.
- Keep webhook target helpers available for later phases, but do not build webhook commands in P1.2B-9B.

The command builder may carry a real recipient email in an internal `EmailJobPayload`, because the existing queue path requires it. Any audit or log projection must never expose full email addresses, phone numbers, secrets, authorization headers, or endpoint secrets.

## DeliveryPayloadBuilder Integration

The future command builder should consume existing DeliveryPayloadBuilder outputs instead of rebuilding payload logic:

```ts
type DeliveryCommandBuildInput = {
  deliveryResult: DeliveryPayloadBuildResult<LeadNotificationPayload>;
  emailJobPayload?: EmailJobPayload;
  auditPayload?: Record<string, unknown>;
};
```

Expected behavior:

- If `deliveryResult.status === 'ready'` and `emailJobPayload` exists, return a `queue_email_job` command.
- If `deliveryResult.status === 'noop'`, return a `noop` command with the same reason code.
- Always provide a sanitized audit projection for diagnostics.
- Do not render emails. Email rendering stays in the existing lead mailer path.
- Do not insert queue rows. Queue insertion stays in the existing orchestrator path.

## Proposed Command Model

The first command model should stay intentionally small:

```ts
export type DeliverySideEffectCommand =
  | {
      type: 'queue_email_job';
      payload: EmailJobPayload;
      reasonCode: 'lead_email_ready';
      auditPayload: Record<string, unknown>;
    }
  | {
      type: 'record_delivery_audit';
      payload: Record<string, unknown>;
      reasonCode: 'delivery_audit_ready';
    }
  | {
      type: 'noop';
      reasonCode:
        | 'delivery_channel_disabled'
        | 'missing_delivery_config'
        | 'missing_delivery_target'
        | 'missing_email_target'
        | 'missing_webhook_target';
      auditPayload: Record<string, unknown>;
    };
```

Deferred command types:

- `queue_webhook_job`
- `dispatch_integration_event`
- `insert_agent_ticket`
- `insert_widget_lead`
- `create_contact_request`
- `update_conversation_metadata`
- `execute_delivery`

## Recommended P1.2B-9B Scope

Implement only:

- `apps/api/src/chat/delivery-side-effect.commands.ts`
- Pure lead/email command builders.
- Pure no-op command builders.
- Pure log-safe command projection helpers.
- Tests for ready, no-op, sanitized, and public-safe projections.
- No use of `process.env`, logger instances, DB clients, HTTP clients, queues, mail transports, or integration services.

Do not implement:

- Webhook command builders.
- Delivery execution.
- Any DB or queue writes.
- Any change to `queueInternalLeadNotification`.
- Any change to `ToolExecutorService`, `ToolDispatcherService`, `IntegrationEventDispatcherService`, or `WebhookJobsService`.
- Any public widget response change.

## Required Tests

P1.2B-9B should add focused unit tests for:

- Ready lead/email delivery produces exactly one `queue_email_job` command.
- Missing email target produces a `noop` command with `missing_email_target`.
- Disabled delivery channel produces a `noop` command with `delivery_channel_disabled`.
- Audit/log projection masks or omits full email addresses and phone numbers.
- Public projection contains no headers, secrets, tokens, endpoint URLs, authorization values, or raw delivery config.
- Command builder performs no DB writes, queue writes, network calls, or metadata mutation.
- Existing widget chat flow tests remain unchanged.
- Existing lead-capture builder tests remain unchanged.
- Existing notification safety guard tests remain unchanged.

## Non-goals

- No live chat behavior change.
- No public widget behavior change.
- No answer text change.
- No feature flag activation.
- No migration.
- No delivery channel activation.
- No webhook support in the command builder.
- No DeliveryExecutor or executor abstraction.
- No ToolExecutor or ToolDispatcher consolidation.
- No IntegrationDispatcher changes.
- No queue or database write relocation.

## Recommended Next Step

P1.2B-9, P1.2B-10, P1.2B-11, P1.2B-12, and P1.2B-13 are complete. The next recommended step is `P1.2B-14A` EmailJobProcessingTriggerBoundary Audit / Scope.

That audit should stay read-only and cover processing trigger decisions, `EmailJobsService.processPendingJobs`, worker/SMTP behavior, idempotency, duplicate prevention, no-op versus queue behavior, retry/status behavior, partial failure handling, audit/logging, Orchestrator wiring, and rollback behavior. It should not move queue writes, introduce executor wiring, include webhooks, call external integrations, or change Public Widget responses.
