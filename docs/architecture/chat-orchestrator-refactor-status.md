# Chat Orchestrator Refactor Status

## Summary

P1.2B-1 through P1.2B-17 are implemented, merged, and production-validated. The refactor is intentionally behavior-neutral: public widget responses, response text, branch ordering, feature flags, and database schema remain unchanged.

The Conversation Engine is still not live for the public widget. AssistantProfile production migration has not been executed. Side effects were not hidden inside new helper modules; `ChatAgentOrchestratorService` remains the executor for database reads/writes, queue writes, audit writes, lead finalization, contact request creation, conversation metadata persistence, and public response assembly.

Current production validation baseline:

| Component | Commit / State |
| --- | --- |
| API | `a82225d3fbecf06346dd7c5c45c522e783662a67` |
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

- `DeliverySideEffectCommandBuilder`.
- `DeliveryExecutor`.
- `email_jobs`.
- `webhook_jobs`.
- `queueInternalLeadNotification`.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- External integrations.
- Public Widget response shape.

### P1.2B-8 DeliveryPayloadBuilder

File: `apps/api/src/chat/delivery-payload.builders.ts`

Extracted pure helpers and builders:

- Lead/email Delivery payload builders.
- Delivery target and no-op decision helpers.
- Audit/log-safe Delivery projections.
- `NotificationSafetyGuard` integration for sanitizing and no-op safety.

Compatibility preserved:

- `apps/api/src/chat/lead-capture.builders.ts` keeps its existing public API.
- `lead-capture.builders.ts` delegates to the new DeliveryPayloadBuilder file.
- Answer text remains unchanged.
- Side effects remain unchanged and outside the new builder.
- Existing lead notification payload and email-job payload shapes remain compatible.

Not introduced or moved:

- Webhook payloads with signing or custom transport headers.
- `DeliverySideEffectCommandBuilder`.
- `DeliveryExecutor`.
- `email_jobs`.
- `webhook_jobs`.
- `queueInternalLeadNotification`.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- External integrations.
- Public Widget response shape.

### P1.2B-9 DeliverySideEffectCommandBuilder

File: `apps/api/src/chat/delivery-side-effect.commands.ts`

Extracted pure command builders and projections:

- DeliverySideEffectCommand data-object builders.
- `queue_email_job` command as a data object.
- `noop` command as a data object.
- Lead email Delivery commands.
- Audit/log-safe command projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- Builders are prepared but not wired into orchestrator or executor paths.
- Commands are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.

Not introduced or moved:

- `email_jobs` writes.
- `webhook_jobs` writes.
- Webhook commands with signing or transport headers.
- `DeliveryExecutor`.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-10 DeliveryExecutionBoundary

File: `apps/api/src/chat/delivery-execution.boundary.ts`

Extracted pure validation and execution-plan helpers:

- Delivery command classification helpers.
- Email queue command validation helpers.
- ExecutionPlan data objects.
- `noop` and `blocked` Execution Plans.
- Email queue Execution Plan as a data object.
- Audit/log-safe ExecutionPlan projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to queue or execution paths.
- Plans are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.

Not introduced or moved:

- `email_jobs` writes.
- `webhook_jobs` writes.
- Webhook execution.
- Webhook signing or transport-header handling.
- A real `DeliveryExecutor`.
- Orchestrator wiring.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- `EmailJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-11 EmailDeliveryExecutor Boundary

File: `apps/api/src/chat/email-delivery-executor.boundary.ts`

Extracted pure validation and result helpers:

- `EmailDeliveryExecutionStatus`.
- `EmailDeliveryExecutionResult`.
- `EmailDeliveryPlanValidationResult`.
- Email delivery plan classification helpers.
- Email delivery plan validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe result projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to queue or execution paths.
- Results are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.

Not introduced or moved:

- `email_jobs` writes.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-12 EmailQueueWriteBoundary

File: `apps/api/src/chat/email-queue-write.boundary.ts`

Extracted pure validation, request, and result helpers:

- `EmailQueueWriteRequest`.
- `EmailQueueWriteResult`.
- `EmailQueueWriteValidationResult`.
- `EmailQueueWriteCorrelation`.
- Source Result Classification helpers.
- Queue Write Validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe request and result projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService` or queue/execution paths.
- Requests and results are data objects only and are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.

Not introduced or moved:

- `email_jobs` writes.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-13 EmailJobPersistenceBoundary

File: `apps/api/src/chat/email-job-persistence.boundary.ts`

Extracted pure validation, request, and result helpers:

- `EmailJobPersistenceRequest`.
- `EmailJobPersistenceResult`.
- Source Queue Write result classification helpers.
- Persistence validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe persistence request and result projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, queue persistence, or processing paths.
- Requests and results are data objects only and are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.

Not introduced or moved:

- `email_jobs` writes.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- Email processing trigger types.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-14 EmailJobProcessingTriggerBoundary

File: `apps/api/src/chat/email-job-processing-trigger.boundary.ts`

Extracted pure validation, request, and result helpers:

- `EmailJobProcessingTriggerRequest`.
- `EmailJobProcessingTriggerResult`.
- Source Persistence Result Classification helpers.
- Processing Trigger Validation helpers.
- `ready_to_trigger`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe ProcessingTriggerRequest and ProcessingTriggerResult projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, worker, SMTP, retry, locking, status, or `report_runs` paths.
- ProcessingTriggerRequests and ProcessingTriggerResults are data objects only and are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- `email_jobs` writes.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs` calls.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- Retry, status, or locking changes.
- `report_runs` synchronization changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-15 EmailJobWorkerBoundary

File: `apps/api/src/chat/email-job-worker.boundary.ts`

Extracted pure validation, worker-plan, status-transition, retry-decision, and result helpers:

- `WorkerSelectionPlan` data objects.
- `StatusTransitionPlan` data objects.
- `RetryDecision` data objects.
- `WorkerResult` data objects.
- Worker input and plan validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe WorkerPlan and WorkerResult projections.
- E-mail and phone redaction for safe projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, worker, SMTP, retry, locking, status, stale-processing recovery, or `report_runs` paths.
- WorkerSelectionPlans, StatusTransitionPlans, RetryDecisions, and WorkerResults are data objects only and are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- `email_jobs` reads.
- `email_jobs` writes.
- `email_jobs` updates.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs` calls.
- SQL execution.
- `FOR UPDATE SKIP LOCKED` execution.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- Retry, status, or locking changes.
- Stale-processing recovery changes.
- `report_runs` synchronization changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.

### P1.2B-16 EmailJobStatusPolicyBoundary

File: `apps/api/src/chat/email-job-status-policy.boundary.ts`

Extracted pure validation, status-policy, retry-policy, locking-policy, stale-processing-policy, and result helpers:

- `StatusTransitionPolicy` data objects.
- `RetryPolicy` data objects.
- `LockingPolicy` data objects.
- `StaleProcessingPolicy` data objects.
- `PolicyResult` data objects.
- Status Transition Validation Helper.
- Retry Policy Validation Helper.
- Locking Policy Validation Helper.
- Stale Processing Policy Validation Helper.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe Policy projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, database, `email_jobs`, worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` paths.
- StatusTransitionPolicies, RetryPolicies, LockingPolicies, StaleProcessingPolicies, and PolicyResults are data objects only and are not executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- `email_jobs` reads.
- `email_jobs` writes.
- `email_jobs` updates.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs` calls.
- SQL execution.
- `FOR UPDATE SKIP LOCKED` execution.
- Status Transition Execution.
- Retry Update Execution.
- Locking Query Execution.
- Stale-processing recovery execution.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- Retry, status, or locking changes.
- Stale-processing recovery changes.
- `report_runs` synchronization changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.
- NOLIS-specific logic.
- Municipality-specific hardcoding.

### P1.2B-17 EmailJobIdempotencyBoundary

File: `apps/api/src/chat/email-job-idempotency.boundary.ts`

Extracted pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection helpers:

- `IdempotencyKeyCandidate` data objects.
- `IdempotencyKeyPolicy` data objects.
- `DedupeDecision` data objects.
- `SchemaPlan` data objects.
- `BackfillRisk` data objects.
- Validation helpers.
- `allow`, `skip`, `blocked`, and `failed` decision builders.
- Audit/log-safe idempotency projections.
- Privacy-safe recipient identity handling.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, database, `email_jobs`, worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` paths.
- IdempotencyKeyCandidates, IdempotencyKeyPolicies, DedupeDecisions, SchemaPlans, and BackfillRisks are data objects only and are not productively enforced.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- Database migration.
- SQL.
- Database reads.
- Database writes.
- `email_jobs` reads.
- `email_jobs` writes.
- `email_jobs` updates.
- `idempotency_key` column.
- Unique index.
- Constraint.
- Backfill.
- Existing duplicate cleanup.
- Idempotency enforcement.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs` calls.
- `webhook_jobs` writes.
- Webhook execution.
- A real `EmailDeliveryExecutor` with execution.
- `DeliveryExecutor`.
- Orchestrator wiring.
- Worker or SMTP changes.
- Retry, status, or locking changes.
- Stale-processing recovery changes.
- `report_runs` synchronization changes.
- `ToolExecutorService`.
- `ToolDispatcherService`.
- `IntegrationDispatcher`.
- `WebhookJobsService`.
- External integrations.
- Public Widget response shape.
- Conversation Engine public activation.
- NOLIS-specific logic.
- Municipality-specific hardcoding.

## Still in ChatAgentOrchestrator

The following responsibilities deliberately remain in `ChatAgentOrchestratorService`:

- Side-effect execution.
- Database reads.
- Database writes.
- Queue writes.
- Lead finalization.
- Ticket finalization.
- Contact request creation.
- Lead audit execution.
- Ticket audit/notification execution.
- Delivery execution.
- `email_jobs` / `webhook_jobs` creation.
- `email_jobs` reads and updates.
- `queueInternalLeadNotification`.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs` execution.
- Worker and SMTP execution.
- Retry, status, and locking behavior.
- `report_runs` synchronization.
- Webhook signing / webhook headers.
- WebhookJobsService execution.
- EmailJobsService execution.
- Contact request creation.
- Lead audit execution.
- Ticket audit/notification execution.
- Delivery command execution.
- Email queue write execution.
- Email job persistence execution.
- Email processing trigger execution.
- Email worker execution wiring.
- Email status, retry, locking, and stale-processing policy execution.
- Email idempotency enforcement.
- Email job schema management.
- Idempotency key enforcement.
- Dedupe enforcement.
- Existing duplicate cleanup.
- Backfill / migration.
- Email processing execution wiring.
- Delivery execution wiring.
- Email execution wiring.
- Queue write execution.
- Worker, SMTP, retry, status, locking, and stale-processing recovery execution.
- Conversation metadata persistence.
- ToolExecutor/ToolDispatcher separation.
- IntegrationDispatcher.
- Final decision ordering.
- IT-/ticket-side-effect execution.
- Public response assembly.

This is intentional. The extracted modules are pure helpers/builders only; they prepare values and decisions but do not execute side effects.

## Safety Boundaries

The P1.2B-1 through P1.2B-17 refactor keeps these boundaries:

- No public widget response change.
- Public Widget does not expose `deliveryChannels`, `signingSecret`, `token`, `apiKey`, `authorization`, `recipientEmail`, or `webhookUrl`.
- No Conversation Engine public activation.
- No AssistantProfile production migration.
- No feature flags enabled.
- No database migration.
- No hidden side effects introduced.
- `DeliveryPayloadBuilder` is pure payload/projection logic only.
- `DeliverySideEffectCommandBuilder` is pure command data-object logic only.
- `DeliveryExecutionBoundary` is pure validation and ExecutionPlan logic only.
- `EmailDeliveryExecutor` boundary is pure validation and result-data logic only.
- `EmailQueueWriteBoundary` is pure validation, request-data, result-data, and safe-projection logic only.
- `EmailJobPersistenceBoundary` is pure validation, request-data, result-data, and safe-projection logic only.
- `EmailJobProcessingTriggerBoundary` is pure validation, request-data, result-data, and safe-projection logic only.
- `EmailJobWorkerBoundary` is pure validation, plan-data, result-data, and safe-projection logic only.
- `EmailJobStatusPolicyBoundary` is pure status-transition-policy, retry-policy, locking-policy, stale-processing-policy, result-data, validation, and safe-projection logic only.
- `EmailJobIdempotencyBoundary` is pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection data-object logic only.
- No real EmailDeliveryExecutor with execution introduced.
- No productive DeliverySideEffectCommand runtime execution introduced.
- No productive EmailDeliveryExecutor runtime execution introduced.
- No productive EmailQueueWriteBoundary runtime execution introduced.
- No productive EmailJobPersistenceBoundary runtime execution introduced.
- No productive EmailJobProcessingTriggerBoundary runtime execution introduced.
- No productive EmailJobWorkerBoundary runtime execution introduced.
- No productive EmailJobStatusPolicyBoundary runtime execution introduced.
- No productive EmailJobIdempotencyBoundary runtime execution introduced.
- No EmailJobPersistenceBoundary Orchestrator wiring introduced.
- No EmailJobProcessingTriggerBoundary Orchestrator wiring introduced.
- No EmailJobWorkerBoundary Orchestrator wiring introduced.
- No EmailJobStatusPolicyBoundary Orchestrator wiring introduced.
- No EmailJobIdempotencyBoundary Orchestrator wiring introduced.
- No `processPendingJobs` call introduced.
- No DeliveryExecutor introduced.
- No Orchestrator wiring introduced for Delivery execution.
- No `email_jobs` / `webhook_jobs` moved into helpers.
- No automatic `deliveryChannels` activation.
- No ToolExecutor/ToolDispatcher consolidation.
- No IntegrationDispatcher changes.
- No `agent_tickets` insert moved into helpers.
- No webhook signing or webhook headers moved into helpers.
- No webhook commands with signing or headers introduced.
- No Webhook execution introduced.
- No WebhookJobsService or EmailJobsService behavior changed.
- No `EmailJobsService.enqueue` or `EmailJobsService.processPendingJobs` behavior changed.
- No EmailJobsService behavior changed.
- No SQL, DB read, DB write, queue write, `email_jobs` read, `email_jobs` write, or `email_jobs` update introduced by `EmailJobStatusPolicyBoundary`.
- No SQL, DB read, DB write, queue write, `email_jobs` read, `email_jobs` write, or `email_jobs` update introduced by `EmailJobIdempotencyBoundary`.
- No `idempotency_key` column, unique index, constraint, backfill, duplicate cleanup, or idempotency enforcement introduced.
- No status transition execution, retry update execution, locking query execution, or stale-processing recovery execution introduced.
- No worker or SMTP behavior changed.
- No retry, status, or locking behavior changed.
- No stale-processing recovery behavior changed.
- No `report_runs` synchronization changed.
- No automatic `deliveryChannels` activation.
- No response text changes intended.
- No branch-order changes intended.
- No NOLIS-specific logic or municipality-specific hardcoding introduced.

## Production Validation

The refactor groups were deployed incrementally and validated after each production-safe API deploy.

Validation summary:

- API-only deploy to `cbf561963bf4b33faa5889af79c71b7ae2127fb0` completed successfully for P1.2B-8.
- API-only deploy to `3e6f71cc235f7cc01a6cc41949dd7ac683241722` completed successfully for P1.2B-9.
- API-only deploy to `b852b40a1a6a0afaeb2fcd9441483bdc2dd7ae37` completed successfully for P1.2B-10.
- API-only deploy to `eed94afb67107329156ee59265093e49e1dce09a` completed successfully for P1.2B-11.
- API-only deploy to `863739b1337e4ba6de48beb6779d861d2da117ce` completed successfully for P1.2B-12.
- API-only deploy to `8604f60f2a2822693f11b6accb066f3afab56c9f` completed successfully for P1.2B-13.
- API-only deploy to `3bfd9854894b7c5d241534877bf335e300dccd93` completed successfully for P1.2B-14.
- API-only deploy to `5b57f4c0710e87197e30a1fdd158a5901ebbb85e` completed successfully for P1.2B-15.
- API-only deploy to `473c392295eee0b907fdee81e464fb0acfc76e08` completed successfully for P1.2B-16.
- API-only deploy to `a82225d3fbecf06346dd7c5c45c522e783662a67` completed successfully with a yellow operational note for P1.2B-17.
- API `/healthz` green with the target API commit.
- Database and Redis health green.
- Migration remained `028_generic_webhook_signing_modes.sql` with 28 applied migrations.
- Database auto-migrations skipped on API startup.
- `db:migrate` was not executed.
- Public widget loader, bundle, config, and chat smoke green.
- Universal internal testsite smoke green.
- Universal testsite response was neutral.
- Universal testsite did not receive Branchen-, Handwerker-, local-service-, Einsatzadresse-, vollständige-Adresse-, Dringlichkeit-, or vor-Ort wording.
- Public widget response shape remained unchanged.
- No debug, preview, compare, response-quality, knowledge-preview, knowledge-grounding, Delivery, or Secret fields exposed publicly.
- Public output did not expose `deliveryChannels`, `signingSecret`, `token`, `apiKey`, `authorization`, `recipientEmail`, or `webhookUrl`.
- The existing public response field `messages[].tokens` remains a legacy count field and is not a secret or provider token.
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
- DeliveryPayloadBuilder helper compatibility validated.
- Lead/email payload builder compatibility validated.
- No-op Delivery target decision compatibility validated.
- Audit/log-safe Delivery projection compatibility validated.
- `lead-capture.builders.ts` API compatibility validated.
- DeliverySideEffectCommandBuilder compatibility validated.
- `queue_email_job` remains a data object only.
- `noop` remains a data object only.
- Lead e-mail Delivery command projection compatibility validated.
- Audit/log-safe command projections validated.
- E-mail and phone redaction compatibility validated.
- No productive DeliverySideEffectCommand runtime usage introduced.
- DeliveryExecutionBoundary compatibility validated.
- Delivery command classification validated.
- Email queue command validation validated.
- ExecutionPlan data objects validated.
- `noop` and `blocked` Execution Plans validated.
- Email queue Execution Plan validated as a data object only.
- Audit/log-safe ExecutionPlan projections validated.
- E-mail and phone redaction for ExecutionPlan projections validated.
- No productive DeliveryExecutionBoundary runtime usage introduced.
- No DeliveryExecutionBoundary Orchestrator wiring introduced.
- EmailDeliveryExecutor Boundary compatibility validated.
- EmailDeliveryExecutionResult types validated.
- Email delivery plan classification validated.
- Email delivery plan validation validated.
- `ready`, `skipped`, `blocked`, and `failed` result builders validated.
- Audit/log-safe e-mail result projections validated.
- E-mail and phone redaction for e-mail result projections validated.
- No productive EmailDeliveryExecutor runtime usage introduced.
- No EmailDeliveryExecutor Orchestrator wiring introduced.
- `EmailJobsService.enqueue` remained unchanged.
- `EmailJobsService.processPendingJobs` remained unchanged.
- Worker and SMTP behavior remained unchanged.
- EmailQueueWriteBoundary compatibility validated.
- EmailQueueWriteRequest and EmailQueueWriteResult types validated.
- Source result classification validated.
- Queue Write validation validated.
- `ready`, `skipped`, `blocked`, and `failed` queue-write result builders validated.
- Audit/log-safe queue-write request and result projections validated.
- E-mail and phone redaction for queue-write projections validated.
- No productive EmailQueueWriteBoundary runtime usage introduced.
- No EmailQueueWriteBoundary Orchestrator wiring introduced.
- No `EmailJobsService.enqueue` usage introduced or changed.
- No `EmailJobsService.processPendingJobs` usage introduced or changed.
- EmailJobPersistenceBoundary compatibility validated.
- EmailJobPersistenceRequest and EmailJobPersistenceResult types validated.
- Source Queue Write result classification validated.
- Persistence validation validated.
- `ready`, `skipped`, `blocked`, and `failed` persistence result builders validated.
- Audit/log-safe persistence request and result projections validated.
- E-mail and phone redaction for persistence projections validated.
- No productive EmailJobPersistenceBoundary runtime usage introduced.
- No EmailJobPersistenceBoundary Orchestrator wiring introduced.
- EmailJobProcessingTriggerBoundary compatibility validated.
- EmailJobProcessingTriggerRequest and EmailJobProcessingTriggerResult types validated.
- Source Persistence Result Classification validated.
- Processing Trigger Validation validated.
- `ready_to_trigger`, `skipped`, `blocked`, and `failed` processing-trigger result builders validated.
- Audit/log-safe processing-trigger request and result projections validated.
- E-mail and phone redaction for processing-trigger projections validated.
- No productive EmailJobProcessingTriggerBoundary runtime usage introduced.
- No EmailJobProcessingTriggerBoundary Orchestrator wiring introduced.
- No `processPendingJobs` call introduced.
- No `EmailJobsService.enqueue` usage introduced or changed.
- No `EmailJobsService.processPendingJobs` usage introduced or changed.
- No worker, SMTP, retry, status, locking, or `report_runs` synchronization behavior changed.
- EmailJobWorkerBoundary compatibility validated.
- WorkerSelectionPlan data objects validated.
- StatusTransitionPlan data objects validated.
- RetryDecision data objects validated.
- WorkerResult data objects validated.
- Worker input and plan validation helpers validated.
- `ready`, `skipped`, `blocked`, and `failed` WorkerResult builders validated.
- Audit/log-safe WorkerPlan and WorkerResult projections validated.
- E-mail and phone redaction for worker projections validated.
- No productive EmailJobWorkerBoundary runtime usage introduced.
- No EmailJobWorkerBoundary Orchestrator wiring introduced.
- No `processPendingJobs` call introduced.
- No SQL introduced or executed.
- No DB reads or writes introduced.
- No `email_jobs` reads, writes, or updates introduced.
- No Worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` synchronization behavior changed.
- EmailJobStatusPolicyBoundary compatibility validated.
- StatusTransitionPolicy data objects validated.
- RetryPolicy data objects validated.
- LockingPolicy data objects validated.
- StaleProcessingPolicy data objects validated.
- PolicyResult data objects validated.
- Status Transition, Retry, Locking, and Stale Processing validation helpers validated.
- `ready`, `skipped`, `blocked`, and `failed` PolicyResult builders validated.
- Audit/log-safe Policy projections validated.
- No productive EmailJobStatusPolicyBoundary runtime usage introduced.
- No EmailJobStatusPolicyBoundary Orchestrator wiring introduced.
- No SQL introduced or executed by the boundary.
- No DB reads or writes introduced by the boundary.
- No queue writes introduced by the boundary.
- No `email_jobs` reads, writes, or updates introduced by the boundary.
- No `processPendingJobs` call introduced.
- No status transition execution introduced.
- No retry update execution introduced.
- No locking query execution introduced.
- No stale-processing recovery execution introduced.
- No Worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` synchronization behavior changed.
- EmailJobIdempotencyBoundary compatibility validated.
- IdempotencyKeyCandidate data objects validated.
- IdempotencyKeyPolicy data objects validated.
- DedupeDecision data objects validated.
- SchemaPlan data objects validated.
- BackfillRisk data objects validated.
- Validation helpers validated.
- `allow`, `skip`, `blocked`, and `failed` decision builders validated.
- Audit/log-safe idempotency projections validated.
- Privacy-safe recipient identity handling validated.
- No productive EmailJobIdempotencyBoundary runtime usage introduced.
- No EmailJobIdempotencyBoundary Orchestrator wiring introduced.
- No SQL introduced or executed by the boundary.
- No DB reads or writes introduced by the boundary.
- No queue writes introduced by the boundary.
- No `email_jobs` reads, writes, or updates introduced by the boundary.
- No `idempotency_key` column introduced.
- No unique index or constraint introduced.
- No backfill introduced.
- No existing duplicate cleanup introduced.
- No idempotency enforcement introduced.
- No `EmailJobsService.enqueue` usage introduced or changed.
- No `EmailJobsService.processPendingJobs` usage introduced or changed.
- No `processPendingJobs` call introduced.
- No worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` synchronization behavior changed.
- No NOLIS-specific logic or municipality-specific hardcoding introduced.
- No Delivery, Integration, or Processing execution occurred during validation.
- Worker and SMTP behavior remained unchanged.
- No Delivery or Integration execution occurred during validation.
- Side effects remained in `ChatAgentOrchestratorService`.
- `DeliveryExecutor` was not introduced.
- Webhook commands with signing or headers were not introduced.
- Webhook payloads with signing or headers were not extracted.
- `queueInternalLeadNotification` remained unchanged.
- `ToolExecutorService` and `ToolDispatcherService` remained unchanged.
- `IntegrationDispatcher` remained unchanged.
- `WebhookJobsService` remained unchanged.
- `EmailJobsService` remained unchanged.
- No ingestion.
- No new documents or chunks.
- Final log scan clean.
- Database auto-migrations skipped in production.
- Authorization Matrix passed.
- Security Boundaries passed.
- Rollback was not required.
- Rollback point was documented.

Operational note:

- P1.2B-17E had yellow status because the first API recreate pointed the API at non-existent database name `soule_demo`.
- The non-secret Production DB configuration was corrected to the existing database name `chatbot`.
- Only the `api` service was recreated after the correction.
- API `/healthz` was green after the second API recreate.
- No migration, `db:migrate`, DB rollback, or application rollback was required.
- Migration count remained 28 and the latest migration remained `028_generic_webhook_signing_modes.sql`.
- The yellow status is a resolved Production config drift note, not a runtime behavior change in P1.2B-17.
- Recommended follow-up: run a Production config drift check that compares runtime config against the documented Compose/env template before future API-only deploys.
- During the API recreate there was one brief widget upstream connection error while the API container was being replaced.
- Some read-only SQL probe queries were initially misquoted and produced database syntax errors in logs.
- The string scan matched only the existing `messages[].tokens` field; this is not a secret or provider token.
- A non-critical Next.js Server Action mismatch appeared in Dashboard logs and was unrelated to the API-only deploy.
- The Dashboard also showed repeated Next.js `Failed to find Server Action` messages during P1.2B-17E; Dashboard health stayed HTTP 200, Dashboard was not redeployed, the relationship to the API-only deploy is not established, and this should be observed separately.
- The final API post-stabilization log scan was clean; no application, migration, idempotency-boundary, Delivery, or runtime error remained.
- P1.2B-12, P1.2B-13, P1.2B-14, P1.2B-15, and P1.2B-16 validation created explicit technical smoke conversations on the internal testsite; no leads, e-mail jobs, webhook jobs, tickets, documents, chunks, or Delivery executions were created.
- P1.2B-14 validation documented technical smoke conversations increasing `conversations` from 40 to 42.
- P1.2B-15 validation documented one technical smoke conversation and no unexpected leads, e-mail jobs, webhook jobs, tickets, documents, chunks, Delivery execution, Integration execution, or Processing execution.
- P1.2B-16 validation documented one technical smoke conversation increasing `conversations` from 43 to 44; `widget_leads`, `email_jobs`, `webhook_jobs`, `agent_tickets`, documents, chunks, and `report_runs` remained unchanged.
- P1.2B-17 validation documented one technical smoke conversation increasing `conversations` from 44 to 45; `widget_leads`, `email_jobs`, `webhook_jobs`, `agent_tickets`, documents, chunks, and `report_runs` remained unchanged.

## Remaining Risks

- `ChatAgentOrchestratorService` is still large.
- Side-effect execution is still concentrated in the orchestrator.
- `LeadCaptureFlowService` is not yet a real service; P1.2B-4 only extracted pure builders.
- `ToolExecutorService` and `ToolDispatcherService` still have separate lead-capture-related paths.
- `ItSupportTicketFlowService` is not yet a real service; P1.2B-5 only extracted pure helpers and builders.
- Handoff policy, NotificationSafetyGuard, DeliveryPayloadBuilder, DeliverySideEffectCommandBuilder, DeliveryExecutionBoundary, EmailDeliveryExecutor Boundary, EmailQueueWriteBoundary, EmailJobPersistenceBoundary, EmailJobProcessingTriggerBoundary, EmailJobWorkerBoundary, EmailJobStatusPolicyBoundary, and EmailJobIdempotencyBoundary are extracted as pure helpers/builders, but Delivery execution, e-mail job persistence execution, e-mail processing execution, e-mail worker execution, e-mail status/retry/locking execution, DB schema changes, and e-mail idempotency enforcement are not wired into a real executor.
- Production DB config drift was corrected during P1.2B-17E and should be audited separately before additional API-only deploys.
- Dashboard Server Action mismatch logs should be observed separately; they are not a P1.2B-17 blocker because Dashboard health stayed green and Dashboard was not redeployed.
- Contact, lead, ticket, and handoff logic still overlap in state and metadata.
- Several regression tests are text-sensitive, so future wording changes need explicit review.

## Recommended Next Steps

1. Do not immediately continue with a broad refactor.
2. Prefer the next audit as:
   - `P1.2B-18A` Email Job Idempotency Enforcement / Migration Plan Audit.
3. Do not consolidate `ToolExecutorService` and `ToolDispatcherService` without a dedicated audit.
4. Do not activate the Conversation Engine in the public widget as part of this refactor line.

The next possible technical area is e-mail job idempotency enforcement and migration planning. After DeliveryPayloadBuilder, DeliverySideEffectCommandBuilder, DeliveryExecutionBoundary, EmailDeliveryExecutor Boundary, EmailQueueWriteBoundary, EmailJobPersistenceBoundary, EmailJobProcessingTriggerBoundary, EmailJobWorkerBoundary, EmailJobStatusPolicyBoundary, and EmailJobIdempotencyBoundary extraction, the remaining high-risk side-effect area includes actual `EmailJobsService.processPendingJobs` execution, worker/SMTP behavior, job selection and locking, status transitions, idempotency enforcement and duplicate prevention, retry and failed handling, stale processing recovery, `report_runs` synchronization, provider logging, audit/logging, Orchestrator wiring, database constraints/indexes, backfill strategy, duplicate cleanup, and rollback behavior.

Recommended scope for the next planning step:

- Audit / scope only.
- No queue writes moved.
- No `EmailJobsService.enqueue` refactor.
- No `EmailJobsService.processPendingJobs` refactor.
- No processPendingJobs worker-loop refactor.
- No executor code.
- No Orchestrator wiring.
- No worker or SMTP changes.
- No retry, status, locking, stale processing recovery, DB schema, idempotency key, backfill, or `report_runs` synchronization changes.
- No idempotency enforcement.
- No unique or partial unique index.
- No duplicate cleanup.
- No webhooks.
- No external integrations.
- No ToolExecutor/ToolDispatcher consolidation.
- No Public Widget response change.
- No automatic `deliveryChannels` activation.
- No webhook signing or header movement.

Status: `P1.2B-17` completed the EmailJobIdempotencyBoundary extraction and production validation. The boundary remains pure idempotency, dedupe, schema-plan, backfill-risk, validation, and safe-projection data-object logic only.

Recommended next step: `P1.2B-18A` should audit and scope Email Job Idempotency Enforcement / Migration Plan before any implementation. It should cover the enforcement point, `idempotency_key` schema, unique or partial unique index design, PII hashing strategy, legacy rows without keys, duplicate cleanup, backfill strategy, `EmailJobsService.enqueue` interaction, `processPendingJobs` interaction, `report_runs` interaction, rollback behavior, rollout strategy, and required DB tests. It must not implement code, SQL, DB changes, `email_jobs` reads/writes/updates, idempotency enforcement, `EmailJobsService.enqueue` refactors, `processPendingJobs` refactors, worker/SMTP changes, queue writes, Orchestrator wiring, or production wiring.
