# Chat Orchestrator Refactor Status

## Summary

P1.2B-1 through P1.2B-4 are implemented, merged, and production-validated. The refactor is intentionally behavior-neutral: public widget responses, response text, branch ordering, feature flags, and database schema remain unchanged.

The Conversation Engine is still not live for the public widget. AssistantProfile production migration has not been executed. Side effects were not hidden inside new helper modules; `ChatAgentOrchestratorService` remains the executor for database writes, queue writes, audit writes, lead finalization, contact request creation, conversation metadata persistence, and public response assembly.

Current production validation baseline:

| Component | Commit / State |
| --- | --- |
| API | `9096ac04248e99eb884abdb6e6d5725f2e846f2a` |
| Dashboard | `25480866a7bffab7007adf1495477b4e22c7380a` |
| Widget | `7378ddb53bc3588cf35be3530fcbbf5d72e58b12` |
| Last migration | `028_generic_webhook_signing_modes.sql` |
| Public widget | Legacy pipeline |
| Conversation Engine feature flags | Off |

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

## Still in ChatAgentOrchestrator

The following responsibilities deliberately remain in `ChatAgentOrchestratorService`:

- Side-effect execution.
- Database writes.
- Queue writes.
- Lead finalization.
- Contact request creation.
- Lead audit execution.
- Conversation metadata persistence.
- ToolExecutor/ToolDispatcher separation.
- IT-ticket flow.
- Final decision ordering.
- Public response assembly.

This is intentional. The extracted modules are pure helpers/builders only; they prepare values and decisions but do not execute side effects.

## Safety Boundaries

The P1.2B-1 through P1.2B-4 refactor keeps these boundaries:

- No public widget response change.
- No Conversation Engine public activation.
- No AssistantProfile production migration.
- No feature flags enabled.
- No database migration.
- No hidden side effects introduced.
- No ToolExecutor/ToolDispatcher consolidation.
- No response text changes intended.
- No branch-order changes intended.

## Production Validation

The refactor groups were deployed incrementally and validated after each production-safe API deploy.

Validation summary:

- API health green.
- Database and Redis health green.
- Public widget smoke green.
- Universal internal testsite smoke green.
- Universal testsite did not receive branch, Handwerker, local-service, Einsatzadresse, or Dringlichkeit wording.
- Public widget response shape remained unchanged.
- No debug, preview, compare, response-quality, or knowledge-preview fields exposed publicly.
- No unexpected `widget_leads`, `email_jobs`, `webhook_jobs`, or `agent_tickets`.
- No ingestion.
- No new documents or chunks.
- No critical API logs.
- Database auto-migrations skipped in production.
- Authorization Matrix passed.
- Security Boundaries passed.

## Remaining Risks

- `ChatAgentOrchestratorService` is still large.
- Side-effect execution is still concentrated in the orchestrator.
- `LeadCaptureFlowService` is not yet a real service; P1.2B-4 only extracted pure builders.
- `ToolExecutorService` and `ToolDispatcherService` still have separate lead-capture-related paths.
- IT-ticket flow is still inside the broader live-chat orchestration path.
- Contact, lead, ticket, and handoff logic still overlap in state and metadata.
- Several regression tests are text-sensitive, so future wording changes need explicit review.

## Recommended Next Steps

1. Do not immediately continue with a broad refactor.
2. Prefer the next audit as one of:
   - `P1.2B-5A` IT-support/ticket-flow micro-audit.
   - `P1.2B-4C` LeadCaptureFlowService command-executor audit.
3. Do not consolidate `ToolExecutorService` and `ToolDispatcherService` without a dedicated audit.
4. Do not activate the Conversation Engine in the public widget as part of this refactor line.

The next best technical area is the IT-support/ticket flow, because it can create real `agent_tickets` and has risk characteristics similar to lead capture.
