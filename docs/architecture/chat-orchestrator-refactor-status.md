# Chat Orchestrator Refactor Status

## Summary

P1.2B-1 through P1.2B-7 are implemented, merged, and production-validated. The refactor is intentionally behavior-neutral: public widget responses, response text, branch ordering, feature flags, and database schema remain unchanged.

The Conversation Engine is still not live for the public widget. AssistantProfile production migration has not been executed. Side effects were not hidden inside new helper modules; `ChatAgentOrchestratorService` remains the executor for database writes, queue writes, audit writes, lead finalization, contact request creation, conversation metadata persistence, and public response assembly.

Current production validation baseline:

| Component | Commit / State |
| --- | --- |
| API | `3727a5d5bbed6f3febaadf7b952f81464a07b3bf` |
| Dashboard | `25480866a7bffab7007adf1495477b4e22c7380a` |
| Widget | `7378ddb53bc3588cf35be3530fcbbf5d72e58b12` |
| Last migration | `028_generic_webhook_signing_modes.sql` |
| Migration count | `28` |
| Public widget | Legacy pipeline |
| Conversation Engine feature flags | Off |
| Conversation Engine in public widget | No |

## Implemented Refactor Steps

### P1.2B-1 LegacyRoutingGuard

File: `apps/api/src/chat/legacy-routing.guard.ts`

Purpose: centralize the distinction between universal sites and explicit legacy/local-service routing.

Implemented behavior:

- `industry=generic` remains universal.
- `botType=universal-assistant` remains universal.
- Explicit `handwerker` and `local-service` signals continue to route to legacy local-service behavior.
- `leadCaptureEnabled` alone does not trigger local-service legacy behavior.
- Ambiguous generic required fields do not become local-service markers.

### P1.2B-2 Local-Service-Legacy Helpers

File: `apps/api/src/chat/local-service-legacy.helpers.ts`

Extracted pure helpers:

- Local-service missing-field detection.
- Field labels.
- Address, phone, and full-name validation.
- Missing-field prompts.
- Local-service text cleanup.

Not moved:

- `captureLead`.
- `saveConversationMetadata`.
- `queueInternalLeadNotification`.
- Audit, database, mail, webhook, and ticket execution.

### P1.2B-3 Contact-Collection Helpers

File: `apps/api/src/chat/contact-collection.helpers.ts`

Extracted pure helpers:

- Contact extraction.
- Contact merge helpers.
- Missing required field detection.
- Conversation state builders.
- `pendingLead` and paused-lead state builders.
- Capture-ready decisions.

Not moved:

- `captureLead`.
- `createContactRequest`.
- `saveConversationMetadata`.
- `queueInternalLeadNotification`.
- `recordLeadAudit`.
- IT-ticket flow.

### P1.2B-4 Lead-Capture Builders

File: `apps/api/src/chat/lead-capture.builders.ts`

Extracted pure builders and decisions:

- `buildWidgetLeadPayload`.
- `buildContactRequestPayload`.
- `buildCompletedLeadMetadataPatch`.
- `buildLeadAuditPayload`.
- `buildLeadNotificationPayload`.
- `buildLeadEmailJobPayload`.
- `buildLeadSideEffectCommands`.
- `shouldCreateLead`.
- `shouldCreateContactRequest`.
- `shouldQueueLeadNotification`.
- `isLeadCaptureComplete`.
- `summarizeLeadConcern`.

Not moved:

- `captureLead`.
- `createContactRequest`.
- `saveConversationMetadata`.
- `queueInternalLeadNotification`.
- `recordLeadAudit`.
- `ToolExecutorService`.
- `ToolDispatcherService`.

### P1.2B-5 IT-Support / Ticket Helpers

File: `apps/api/src/chat/it-support-ticket.helpers.ts`

Extracted pure helpers and builders:

- `isActivePendingTicket`.
- `parseTicketForwardingStatus`.
- `mapTicketMissingFieldToAssistantAsk`.
- `buildTicketConversationState`.
- `buildTicketMetadataPatch`.
- `buildCompletedTicketMetadataPatch`.
- `buildAgentTicketPayload`.
- `isTicketCaptureComplete`.
- `shouldAskForTicketField`.
- `shouldCreateTicket`.
- `buildTicketSideEffectCommands`.
- `buildCreatedItTicketAnswer`.
- `withItSecurityWarning`.

Not moved:

- `agent_tickets` insert.
- `saveConversationMetadata`.
- Ticket notification and audit execution.
- LeadCapture.
- ContactCollection.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- IT-/ticket-side-effect execution.

### P1.2B-6 HandoffPolicy Helpers

File: `apps/api/src/chat/handoff-policy.helpers.ts`

Extracted pure helpers and decisions:

- Handoff rule normalization.
- Required-field readiness.
- Prepare/defer handoff decision.
- Post-capture action priority.

Existing post-capture action priority is preserved:

- `scheduleUrl` -> `suggest_schedule`.
- `contactRequestId` -> `handoff_to_contact`.
- fallback -> `capture_lead`.

Not moved:

- `email_jobs`.
- `webhook_jobs`.
- `deliveryChannels` execution.
- `queueInternalLeadNotification`.
- `createContactRequest`.
- `captureLead`.
- `saveConversationMetadata`.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `DeliveryExecutor`.

### P1.2B-7 NotificationSafetyGuard

File: `apps/api/src/chat/notification-safety.guard.ts`

Extracted pure helpers and decisions:

- `isSensitiveDeliveryKey`.
- `isSensitiveDeliveryPath`.
- `isDeliverySecretField`.
- `sanitizeDeliveryHeaders`.
- `sanitizeDeliveryConfigForLog`.
- `sanitizeDeliveryConfigForAdminRead`.
- `sanitizeNotificationPayloadForAudit`.
- `stripPublicNotificationFields`.
- `hasUsableEmailTarget`.
- `hasUsableWebhookTarget`.
- `hasAnyUsableDeliveryTarget`.
- `getNotificationNoopReason`.
- `shouldNoopNotification`.
- `getPublicUnsafeDeliveryKeys`.
- `assertNoPublicDeliverySecrets`.

Productive use:

- Existing Admin Read sanitizing for `assistantProfile.deliveryChannels` now uses `NotificationSafetyGuard`.
- Raw Delivery secrets are not returned in Admin Read output.
- No Live Delivery decision was changed.

Not introduced or moved:

- `DeliveryPayloadBuilder`.
- `DeliverySideEffectCommandBuilder`.
- `DeliveryExecutor`.
- `email_jobs`.
- `webhook_jobs`.
- `queueInternalLeadNotification`.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- External integrations.
- Public Widget response shape.

## Still in ChatAgentOrchestrator

The following responsibilities deliberately remain in `ChatAgentOrchestratorService`:

- Side-effect execution.
- Database writes.
- Queue writes.
- Lead finalization.
- Ticket finalization.
- Contact request creation.
- Lead audit execution.
- Ticket audit/notification execution.
- Delivery execution.
- `email_jobs` / `webhook_jobs` creation.
- `queueInternalLeadNotification`.
- Delivery payload construction.
- Conversation metadata persistence.
- ToolExecutor/ToolDispatcher separation.
- Final decision ordering.
- IT-/ticket-side-effect execution.
- Public response assembly.

This is intentional. The extracted modules are pure helpers/builders only; they prepare values and decisions but do not execute side effects.

## Safety Boundaries

The P1.2B-1 through P1.2B-7 refactor keeps these boundaries:

- No public widget response change.
- Public Widget does not expose `deliveryChannels`, `signingSecret`, `token`, `apiKey`, `authorization`, `recipientEmail`, or `webhookUrl`.
- No Conversation Engine public activation.
- No AssistantProfile production migration.
- No feature flags enabled.
- No database migration.
- No hidden side effects introduced.
- No `DeliveryPayloadBuilder` introduced.
- No `DeliverySideEffectCommandBuilder` introduced.
- No DeliveryExecutor introduced.
- No `email_jobs` / `webhook_jobs` moved into helpers.
- No automatic `deliveryChannels` activation.
- No ToolExecutor/ToolDispatcher consolidation.
- No `agent_tickets` insert moved into helpers.
- No response text changes intended.
- No branch-order changes intended.

## Production Validation

The refactor groups were deployed incrementally and validated after each production-safe API deploy.

Validation summary:

- API-only deploy to `3727a5d5bbed6f3febaadf7b952f81464a07b3bf` completed successfully for P1.2B-7.
- API `/healthz` green with the target API commit.
- Database and Redis health green.
- Migration remained `028_generic_webhook_signing_modes.sql` with 28 applied migrations.
- Database auto-migrations skipped on API startup.
- Public widget loader, bundle, config, and chat smoke green.
- Universal internal testsite smoke green.
- Universal testsite did not receive branch, Handwerker, local-service, Einsatzadresse, or Dringlichkeit wording.
- Public widget response shape remained unchanged.
- No debug, preview, compare, response-quality, knowledge-preview, knowledge-grounding, Delivery, or Secret fields exposed publicly.
- Admin Read was checked for the internal testsite.
- `assistantProfile.deliveryChannels` was sanitized through `NotificationSafetyGuard`.
- Raw Delivery secrets were not visible in Admin Read output.
- No unexpected `widget_leads`, `email_jobs`, `webhook_jobs`, or `agent_tickets`.
- One technical smoke conversation was created by the explicit production smoke test.
- HandoffPolicy helper compatibility validated.
- Required-field readiness validated.
- Prepare/defer handoff decision compatibility validated.
- Post-capture action priority validated: `scheduleUrl` -> `suggest_schedule`, `contactRequestId` -> `handoff_to_contact`, fallback -> `capture_lead`.
- NotificationSafetyGuard helper compatibility validated.
- Sensitive Delivery key/path detection validated.
- Delivery config, header, admin-read, public-output, and audit sanitizing validated.
- Notification no-op decisions validated as data-only helpers.
- Live Delivery decision behavior remained unchanged.
- Side effects remained in `ChatAgentOrchestratorService`.
- `DeliveryPayloadBuilder` was not introduced.
- `DeliverySideEffectCommandBuilder` was not introduced.
- `DeliveryExecutor` was not introduced.
- `queueInternalLeadNotification` remained unchanged.
- `ToolExecutorService` and `ToolDispatcherService` remained unchanged.
- No ingestion.
- No new documents or chunks.
- Final log scan clean.
- Database auto-migrations skipped in production.
- Authorization Matrix passed.
- Security Boundaries passed.
- Rollback was not required.

Operational note:

- During the API recreate there was one brief widget upstream connection error while the API container was being replaced.
- Some read-only SQL probe queries were initially misquoted and produced database syntax errors in logs.
- The final post-stabilization log scan was clean; no application, migration, or runtime error remained.

## Remaining Risks

- `ChatAgentOrchestratorService` is still large.
- Side-effect execution is still concentrated in the orchestrator.
- `LeadCaptureFlowService` is not yet a real service; P1.2B-4 only extracted pure builders.
- `ToolExecutorService` and `ToolDispatcherService` still have separate lead-capture-related paths.
- `ItSupportTicketFlowService` is not yet a real service; P1.2B-5 only extracted pure helpers and builders.
- Handoff policy and NotificationSafetyGuard are extracted as pure helpers, but delivery payload building is not yet isolated.
- Contact, lead, ticket, and handoff logic still overlap in state and metadata.
- Several regression tests are text-sensitive, so future wording changes need explicit review.

## Recommended Next Steps

1. Do not immediately continue with a broad refactor.
2. Prefer the next audit as:
   - `P1.2B-8A` DeliveryPayload Builder micro-plan / scope-check.
3. Do not consolidate `ToolExecutorService` and `ToolDispatcherService` without a dedicated audit.
4. Do not activate the Conversation Engine in the public widget as part of this refactor line.

The next best technical area is DeliveryPayload Builder. After NotificationSafetyGuard extraction, the remaining high-risk side-effect area includes `email_jobs`, `webhook_jobs`, `deliveryChannels`, notification payloads, sensitive delivery values, fallback/no-op behavior, and overlap with LeadCapture and TicketFlow.

Recommended scope for the next code step:

- Payload builders only.
- No queue writes.
- No delivery execution.
- No external integrations.
- No ToolExecutor/ToolDispatcher consolidation.
- No Public Widget response change.
- No automatic `deliveryChannels` activation.

Status: `P1.2B-7` completed the NotificationSafetyGuard extraction and production validation. `P1.2B-8A` should scope the DeliveryPayload Builder boundary before any code extraction.
