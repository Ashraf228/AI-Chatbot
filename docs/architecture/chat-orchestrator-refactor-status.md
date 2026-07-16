# Chat Orchestrator Refactor Status

## Summary

P1.2B-1 through P1.2B-23 are implemented, merged, and production-validated where applicable. P1.2B-20 added `EmailJobDuplicateReadOnlyQueryPlanBoundary` as a pure read-only-query-plan data-object layer, P1.2B-21 added `EmailJobDuplicateReadOnlyDbAuditExecutionBoundary` as a pure read-only audit-execution data-object layer, P1.2B-22 added `EmailJobDuplicateReadOnlyAuditApprovalBoundary` as a pure approval-decision, approval-matrix, environment-sequencing, stop-criteria, output-policy, result, validation, classification, and safe-projection data-object layer, and P1.2B-23 added `EmailJobDuplicateStagingReadOnlyAuditScopeBoundary` plus the staging-read-only audit scope / approval-preconditions line. P1.2B-23 was production-validated with an API-only Docker build + recreate on `577518a29eac8a9553309f4aadaf6ac7e12479bc`. The refactor remains intentionally behavior-neutral: public widget responses, response text, branch ordering, feature flags, and database schema remain unchanged.

`P1.2B-22A` remains the docs-only approval / execution decision gate, `P1.2B-22B` through `P1.2B-22E` completed the pure runtime-unwired approval boundary and deploy validation, and `P1.2B-23A` through `P1.2B-23E-G` completed the staging-read-only scope / preconditions, the pure staging-scope boundary, the API-only deploy validation, the initial yellow Public-Widget smoke diagnosis, and the green safe-smoke revalidation without granting any real staging or Production DB read approval. The line still does not introduce SQL, query runners, reports with data, or runtime wiring.

The Conversation Engine is still not live for the public widget. AssistantProfile production migration has not been executed. Side effects were not hidden inside new helper modules; `ChatAgentOrchestratorService` and the existing services remain the executors for database reads/writes, queue writes, audit writes, lead finalization, ticket finalization, contact request creation, conversation metadata persistence, and public response assembly.

Current production validation baseline:

| Component | Commit / State |
| --- | --- |
| API | `577518a29eac8a9553309f4aadaf6ac7e12479bc` |
| Previous live API baseline before P1.2B-23E | `cfa992b448016545d1fba1bdbaba3af3716991e6` |
| API image | `sha256:90f230e2871f4591ecc1ec0931e1b22b54bf77b25ab23624cef57769f4be7b46` |
| Previous API image | `sha256:ccbbfcaf21cb83746169c2e9407368bec9ba5f6f67120f401dab6de0559c664e` |
| Dashboard | `3a276e7f0ef898bae791638b964087780da80c4d` |
| Widget | `7378ddb53bc3588cf35be3530fcbbf5d72e58b12` |
| Main-CI / Docker gate | Main-CI not visible on squash commit; Docker fallback green on exact `577518a29eac8a9553309f4aadaf6ac7e12479bc` for P1.2B-23 |
| Last migration | `028_generic_webhook_signing_modes.sql` |
| Migration count | `28` |
| Public widget | Legacy pipeline |
| Conversation Engine feature flags | Off |
| Conversation Engine in public widget | No |

Baseline correction note:

- Earlier planning context expected older API / Dashboard baselines before `P1.2B-22E`.
- The actual live basis before the P1.2B-22 API-only deploy was already `3a276e7f0ef898bae791638b964087780da80c4d` for the API runtime and Dashboard commit line.
- `P1.2B-22E` rebuilt and recreated only the `api` service; Dashboard, Widget, Proxy, DB, and Redis remained unchanged.

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

### P1.2B-18 EmailJobIdempotencyMigrationPlanBoundary

File: `apps/api/src/chat/email-job-idempotency-migration-plan.boundary.ts`

Extracted pure enforcement, migration, index, backfill, conflict, rollback, result, validation, and safe-projection plan helpers:

- `EnforcementPointPlan` data objects.
- `IdempotencyMigrationPhase` data objects.
- `UniqueIndexPlan` data objects.
- `BackfillPlan` data objects.
- `DuplicateConflictPolicy` data objects.
- `RollbackPlan` data objects.
- `MigrationPlanResult` data objects.
- Validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Audit/log-safe migration-plan projections.

Productive use:

- No productive runtime usage was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, database, `email_jobs`, worker, SMTP, retry, status, locking, stale-processing recovery, `report_runs`, or production wiring paths.
- EnforcementPointPlans, MigrationPhases, UniqueIndexPlans, BackfillPlans, DuplicateConflictPolicies, RollbackPlans, and MigrationPlanResults are data objects only and are not productively executed.
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

### P1.2B-19 EmailJobDuplicateAuditPlanBoundary

Files:

- `apps/api/src/chat/email-job-duplicate-audit-plan.boundary.ts`
- `apps/api/test/email-job-duplicate-audit-plan-boundary.test.cjs`

Extracted pure duplicate-audit and cleanup-plan data objects, helpers, and projections:

- `DuplicateCandidate` data objects.
- `DuplicateRiskGroup` data objects.
- `CleanupEligibilityPolicy` data objects.
- `DuplicateAuditPlan` data objects.
- `CleanupPlan` data objects.
- `ManualReviewDecision` data objects.
- `DuplicateAuditPlanResult` data objects.
- Validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Classification helpers.
- Audit-/log-safe DuplicateAudit projections.

Productive use:

- No productive runtime use was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, database, `email_jobs`, worker, SMTP, retry, status, locking, stale-processing recovery, `report_runs`, or production wiring paths.
- DuplicateCandidates, DuplicateRiskGroups, CleanupEligibilityPolicies, DuplicateAuditPlans, CleanupPlans, ManualReviewDecisions, and DuplicateAuditPlanResults are data objects only and are not productively executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- Database reads.
- SQL.
- Database writes.
- `email_jobs` reads.
- `email_jobs` writes.
- `email_jobs` updates.
- Duplicate cleanup.
- Backfill.
- Existing duplicate cleanup.
- Hard delete.
- Soft delete or mark duplicate.
- Unique index.
- Constraint.
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

### P1.2B-20 EmailJobDuplicateReadOnlyQueryPlanBoundary

Files:

- `apps/api/src/chat/email-job-duplicate-readonly-query-plan.boundary.ts`
- `apps/api/test/email-job-duplicate-readonly-query-plan-boundary.test.cjs`

Extracted pure read-only query-plan data objects, helpers, and projections:

- `QueryClassPlan` data objects.
- `QuerySafetyGate` data objects.
- `QueryOutputPolicy` data objects.
- `QueryApprovalRequirement` data objects.
- `QueryRiskAssessment` data objects.
- `ReadOnlyQueryPlanResult` data objects.
- Validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Classification helpers.
- Audit-/log-safe ReadOnlyQueryPlan projections.

Productive use:

- No productive runtime use was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, database, `email_jobs`, a query runner, a repository, reports, worker, SMTP, or production wiring paths.
- QueryClassPlans, QuerySafetyGates, QueryOutputPolicies, QueryApprovalRequirements, QueryRiskAssessments, and ReadOnlyQueryPlanResults are data objects only and are not productively executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- Database reads.
- SQL.
- SQL files.
- Database writes.
- Queue writes.
- `email_jobs` reads.
- `email_jobs` writes.
- `email_jobs` updates.
- Query runners.
- Repositories.
- Query results.
- Reports with data.
- CSV or JSON exports.
- Duplicate cleanup.
- Backfill.
- Existing duplicate cleanup.
- Hard delete.
- Soft delete or mark duplicate.
- Unique index.
- Constraint.
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

### P1.2B-21 EmailJobDuplicateReadOnlyDbAuditExecutionBoundary

Files:

- `apps/api/src/chat/email-job-duplicate-readonly-db-audit-execution.boundary.ts`
- `apps/api/test/email-job-duplicate-readonly-db-audit-execution-boundary.test.cjs`

Extracted pure read-only DB-audit execution-boundary data objects, helpers, and projections:

- `Precondition` data objects.
- `QueryStep` data objects.
- `ApprovalGate` data objects.
- `OutputPolicy` data objects.
- `RiskAssessment` data objects.
- `ExecutionPlan` data objects.
- `ExecutionResult` data objects.
- Validation helpers.
- `ready`, `skipped`, `blocked`, and `failed` result builders.
- Result classification helpers.
- Audit-/log-safe ReadOnlyDbAuditExecution projections.

Productive use:

- No productive runtime use was introduced.
- No `ChatAgentOrchestratorService` rewiring was introduced.
- The boundary is prepared but not connected to `EmailJobsService`, `processPendingJobs`, SQL, database reads, `email_jobs`, `webhook_jobs`, a query runner, repositories, reports, worker, SMTP, Orchestrator wiring, or Production wiring paths.
- Preconditions, QuerySteps, ApprovalGates, OutputPolicies, RiskAssessments, ExecutionPlans, and ExecutionResults are data objects only and are not productively executed.
- `ChatAgentOrchestratorService` and existing services remain the executors.
- `EmailJobsService` remains unchanged.
- `processPendingJobs` remains unchanged.

Not introduced or moved:

- A real `DB_READ_ONLY_AUDIT`.
- Database reads.
- SQL.
- SQL files.
- Database writes.
- Queue writes.
- `email_jobs` reads.
- `email_jobs` writes.
- `email_jobs` updates.
- `webhook_jobs` reads.
- `webhook_jobs` writes.
- `webhook_jobs` updates.
- Query runners.
- Repositories.
- Query results.
- Reports with data.
- CSV or JSON exports.
- Duplicate cleanup.
- Backfill.
- Existing duplicate cleanup.
- Hard delete.
- Soft delete or mark duplicate.
- Unique index.
- Constraint.
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

## Remaining Responsibilities

The following responsibilities deliberately remain in `ChatAgentOrchestratorService` or the existing runtime services:

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
- `email_jobs` reads, writes, and updates.
- `queueInternalLeadNotification`.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs` execution.
- Worker and SMTP execution.
- Retry, status, and locking behavior.
- Stale-processing recovery.
- `report_runs` synchronization.
- `email_jobs` schema management.
- Idempotency key enforcement.
- Dedupe enforcement.
- Duplicate audit execution.
- Duplicate cleanup execution.
- Manual review execution.
- Backfill and migration execution.
- Unique index and constraint management.
- Migration rollout and rollback execution.
- Webhook signing / webhook headers.
- WebhookJobsService execution.
- EmailJobsService execution.
- ToolExecutor/ToolDispatcher separation.
- IntegrationDispatcher.
- Final decision ordering.
- Conversation metadata persistence.
- Public response assembly.
- Delivery command execution.
- Email queue write execution.
- Email job persistence execution.
- Email processing trigger execution.
- Email worker execution wiring.
- Email status, retry, locking, and stale-processing policy execution.
- Email idempotency enforcement.
- Email idempotency migration execution.
- Email duplicate audit execution.
- Email duplicate audit approval / execution decision gating.
- Email duplicate cleanup execution.
- Read-only role and environment selection for any future duplicate audit.
- Allowed query-class and output-policy approval for any future duplicate audit.
- IT-/ticket-side-effect execution.

This is intentional. The extracted modules are pure helpers/builders only; they prepare values and decisions but do not execute side effects.

## Safety Boundaries

The P1.2B-1 through P1.2B-20 refactor keeps these boundaries:

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
- `EmailJobIdempotencyMigrationPlanBoundary` is pure validation, enforcement-plan, migration-phase, index-plan, backfill-plan, conflict-policy, rollback-plan, result-data, and safe-projection data-object logic only.
- `EmailJobDuplicateAuditPlanBoundary` is pure validation, duplicate-audit-plan, cleanup-plan, manual-review-decision, result-data, classification, and safe-projection data-object logic only.
- `EmailJobDuplicateReadOnlyQueryPlanBoundary` is pure query-class-plan, query-safety-gate, query-output-policy, query-approval-requirement, query-risk-assessment, result-data, validation, classification, and safe-projection data-object logic only.
- No real EmailDeliveryExecutor with execution introduced.
- No productive DeliverySideEffectCommand runtime execution introduced.
- No productive EmailDeliveryExecutor runtime execution introduced.
- No productive EmailQueueWriteBoundary runtime execution introduced.
- No productive EmailJobPersistenceBoundary runtime execution introduced.
- No productive EmailJobProcessingTriggerBoundary runtime execution introduced.
- No productive EmailJobWorkerBoundary runtime execution introduced.
- No productive EmailJobStatusPolicyBoundary runtime execution introduced.
- No productive EmailJobIdempotencyBoundary runtime execution introduced.
- No productive EmailJobIdempotencyMigrationPlanBoundary runtime execution introduced.
- No productive EmailJobDuplicateAuditPlanBoundary runtime execution introduced.
- No productive EmailJobDuplicateReadOnlyQueryPlanBoundary runtime execution introduced.
- No EmailJobPersistenceBoundary Orchestrator wiring introduced.
- No EmailJobProcessingTriggerBoundary Orchestrator wiring introduced.
- No EmailJobWorkerBoundary Orchestrator wiring introduced.
- No EmailJobStatusPolicyBoundary Orchestrator wiring introduced.
- No EmailJobIdempotencyBoundary Orchestrator wiring introduced.
- No EmailJobIdempotencyMigrationPlanBoundary Orchestrator wiring introduced.
- No EmailJobDuplicateAuditPlanBoundary Orchestrator wiring introduced.
- No EmailJobDuplicateReadOnlyQueryPlanBoundary Orchestrator wiring introduced.
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
- No migration-plan SQL, DB read, DB write, queue write, `email_jobs` read, `email_jobs` write, or `email_jobs` update introduced by `EmailJobIdempotencyMigrationPlanBoundary`.
- No duplicate-audit-plan SQL, DB read, DB write, queue write, `email_jobs` read, `email_jobs` write, or `email_jobs` update introduced by `EmailJobDuplicateAuditPlanBoundary`.
- No read-only-query-plan SQL, DB read, DB write, queue write, `email_jobs` read, `email_jobs` write, `email_jobs` update, query runner, repository, query result, or report execution introduced by `EmailJobDuplicateReadOnlyQueryPlanBoundary`.
- No `idempotency_key` column, unique index, constraint, backfill, duplicate cleanup, or idempotency enforcement introduced.
- No existing duplicate cleanup, hard delete, soft delete or mark-duplicate path introduced.
- No status transition execution, retry update execution, locking query execution, or stale-processing recovery execution introduced.
- No worker or SMTP behavior changed.
- No retry, status, or locking behavior changed.
- No stale-processing recovery behavior changed.
- No `report_runs` synchronization changed.
- No automatic `deliveryChannels` activation.
- No `EmailJobsService.enqueue` or `processPendingJobs` change introduced by the duplicate-audit boundary.
- No delivery, integration, processing, migration, idempotency-enforcement, or duplicate-cleanup execution occurred during P1.2B-19 validation.
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
- API-only deploy to `b3e0c8e6718aa4985594b422ea8d645e82abbd62` completed successfully with a yellow operational note for P1.2B-18.
- API-only deploy to `98de7282b1fa81f30b5ec273c5a381ab1ae8d4ee` completed successfully for P1.2B-19.
- API-only deploy to `9b6f1141995caff52784c222b359363bf55a7d4f` completed successfully for P1.2B-20.
- API-only deploy to `cf696042b68f463923e6f026a75658c563c51985` completed successfully for P1.2B-21.
- Main-CI and Docker gate were green on run `29409008824` for P1.2B-21.
- P1.2B-20 exact-commit fallback was green before the P1.2B-20 deploy.
- P1.2B-18 and P1.2B-20 deploy gates used a local equivalent API Docker build because Main-CI contexts for the Squash Commit were not visible.
- The Docker fallback command was `docker compose --env-file .env.example build api`.
- P1.2B-20 fallback validation confirmed a clean worktree on the exact target commit, green local full checks, green `docker compose config`, and a green exact-commit API image build before deploy.
- Local full checks were green before the API-only deploy.
- API `/healthz` green with the target API commit.
- API `/healthz` green with `b3e0c8e6718aa4985594b422ea8d645e82abbd62` after P1.2B-18E.
- API `/healthz` green with `98de7282b1fa81f30b5ec273c5a381ab1ae8d4ee` after P1.2B-19E.
- API `/healthz` green with `9b6f1141995caff52784c222b359363bf55a7d4f` after P1.2B-20E.
- API `/healthz` green with `cf696042b68f463923e6f026a75658c563c51985` after P1.2B-21E.
- Database and Redis health green.
- Migration remained `028_generic_webhook_signing_modes.sql` with 28 applied migrations.
- Database auto-migrations skipped on API startup.
- `db:migrate` was not executed.
- The production DB target was sanitized before and after deploy and remained `chatbot`.
- The previous `soule_demo` config drift did not recur.
- `scripts/ops/check-production-health.sh` returned exit code 0 during P1.2B-20E.
- `production-health-synthetic` widget config returned HTTP 200 during P1.2B-20E.
- `production-health-synthetic` siteKey matched the expected value during P1.2B-20E.
- `scripts/ops/check-production-health.sh` returned exit code 0 during P1.2B-21E.
- `production-health-synthetic` widget config returned HTTP 200 during P1.2B-21E.
- `production-health-synthetic` siteKey matched the expected value during P1.2B-21E.
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
- No unexpected `email_jobs` reads, writes, or updates occurred during P1.2B-20 validation.
- No unexpected `email_jobs` reads, writes, or updates occurred during P1.2B-21 validation.
- No query runner, query result, or report-with-data execution occurred during P1.2B-20 validation.
- No query runner, query result, or report-with-data execution occurred during P1.2B-21 validation.
- No duplicate cleanup, backfill, or idempotency-enforcement execution occurred during P1.2B-20 validation.
- No duplicate cleanup, backfill, or idempotency-enforcement execution occurred during P1.2B-21 validation.
- No delivery, integration, or processing execution occurred during P1.2B-20 validation.
- No delivery, integration, or processing execution occurred during P1.2B-21 validation.
- No boundary, delivery, notification, migration, or runtime error remained in the final P1.2B-20 log scan.
- No boundary, delivery, notification, migration, or runtime error remained in the final P1.2B-21 log scan.
- Previous API runtime commit before P1.2B-20 deploy was `98de7282b1fa81f30b5ec273c5a381ab1ae8d4ee`.
- Previous API image before P1.2B-20 deploy was `sha256:df24d062415606f783127a627022e0da95cffb5a84c8aed43b4f0a8a026ea4a7`.
- Current API image after P1.2B-20 deploy is `sha256:16fb3368f2b17d898b907044678fceb800d1a9eaad586c2d042bb8dd19ca46d1`.
- Previous API runtime commit before P1.2B-21 deploy was `9b6f1141995caff52784c222b359363bf55a7d4f`.
- Previous API image before P1.2B-21 deploy was `sha256:16fb3368f2b17d898b907044678fceb800d1a9eaad586c2d042bb8dd19ca46d1`.
- Current API image after P1.2B-21 deploy is `sha256:e57bfa7cb7c20b1acb1a79579bac62be1c05b1c31b39589e6d7c6cb3ab579ed9`.
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
- EmailJobIdempotencyMigrationPlanBoundary compatibility validated.
- EnforcementPointPlan data objects validated.
- IdempotencyMigrationPhase data objects validated.
- UniqueIndexPlan data objects validated.
- BackfillPlan data objects validated.
- DuplicateConflictPolicy data objects validated.
- RollbackPlan data objects validated.
- MigrationPlanResult data objects validated.
- Migration-plan validation helpers validated.
- `ready`, `skipped`, `blocked`, and `failed` MigrationPlanResult builders validated.
- Audit/log-safe migration-plan projections validated.
- No productive EmailJobIdempotencyMigrationPlanBoundary runtime usage introduced.
- No EmailJobIdempotencyMigrationPlanBoundary Orchestrator wiring introduced.
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
- EmailJobDuplicateAuditPlanBoundary compatibility validated.
- DuplicateCandidate data objects validated.
- DuplicateRiskGroup data objects validated.
- CleanupEligibilityPolicy data objects validated.
- DuplicateAuditPlan data objects validated.
- CleanupPlan data objects validated.
- ManualReviewDecision data objects validated.
- DuplicateAuditPlanResult data objects validated.
- Duplicate-audit validation helpers validated.
- `ready`, `skipped`, `blocked`, and `failed` DuplicateAuditPlanResult builders validated.
- Duplicate classification helpers validated.
- Audit/log-safe duplicate-audit projections validated.
- No productive EmailJobDuplicateAuditPlanBoundary runtime usage introduced.
- No EmailJobDuplicateAuditPlanBoundary Orchestrator wiring introduced.
- No SQL introduced or executed by the boundary.
- No DB reads or writes introduced by the boundary.
- No queue writes introduced by the boundary.
- No `email_jobs` reads, writes, or updates introduced by the boundary.
- No duplicate cleanup introduced.
- No backfill introduced.
- No existing duplicate cleanup introduced.
- No hard delete introduced.
- No soft delete or mark-duplicate path introduced.
- No unique index or constraint introduced.
- No idempotency enforcement introduced.
- No `EmailJobsService.enqueue` usage introduced or changed.
- No `EmailJobsService.processPendingJobs` usage introduced or changed.
- No `processPendingJobs` call introduced.
- No worker, SMTP, retry, status, locking, stale-processing recovery, or `report_runs` synchronization behavior changed.
- No delivery, integration, processing, migration, idempotency-enforcement, or duplicate-cleanup execution occurred during P1.2B-19 validation.
- No unexpected `email_jobs` reads, writes, or updates occurred during validation.
- No unexpected duplicate cleanup, backfill, or enforcement occurred during validation.
- No DB reads or SQL were performed by the boundary during validation.
- No `report_runs` changes occurred during validation.
- One technical smoke conversation was documented for the P1.2B-19 validation pass.
- No Delivery, Integration, Processing, Migration, Idempotency-Enforcement, or Production-Wiring execution occurred during P1.2B-18 validation.
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
- P1.2B-18 validation documented one technical smoke conversation increasing `conversations` from 25 to 26 after the API-only deploy; `widget_leads`, `email_jobs`, `webhook_jobs`, `agent_tickets`, documents, and chunks remained unchanged at zero in the inspected production smoke scope.
- P1.2B-19 validation documented one technical smoke conversation with green public widget loader/config/chat checks and no unexpected leads, `email_jobs`, `webhook_jobs`, `agent_tickets`, documents, or chunks in the inspected smoke scope.
- P1.2B-20 validation documented one technical smoke conversation with green public widget loader/config/chat checks, neutral response wording, no forbidden public fields, and no unexpected leads, `email_jobs`, `webhook_jobs`, `agent_tickets`, documents, or chunks in the inspected smoke scope.
- The earlier P1.2B-18E yellow synthetic-monitoring note was resolved before P1.2B-19E and stayed resolved through P1.2B-20E; the current production-health script baseline is green.
- Manual internal testsite widget loader, bundle, config, and chat smokes were green.
- API, DB, Redis, Dashboard, Widget, Proxy, and container health were green.
- No API rollback was required for P1.2B-18E, P1.2B-19E, or P1.2B-20E.
- The synthetic site-key/config stabilization follow-up is complete for the current baseline; the remaining follow-up is routine drift observation, not a blocker for the duplicate-audit planning line.
- Dashboard logs still show Next.js `Failed to find Server Action` messages; Dashboard health and login remain OK, Dashboard was not redeployed, no relationship to the API-only deploy is established, and this remains a separate observation item with no rollback required.

## Remaining Risks

- `ChatAgentOrchestratorService` is still large.
- Side-effect execution is still concentrated in the orchestrator.
- `LeadCaptureFlowService` is not yet a real service; P1.2B-4 only extracted pure builders.
- `ToolExecutorService` and `ToolDispatcherService` still have separate lead-capture-related paths.
- `ItSupportTicketFlowService` is not yet a real service; P1.2B-5 only extracted pure helpers and builders.
- Handoff policy, NotificationSafetyGuard, DeliveryPayloadBuilder, DeliverySideEffectCommandBuilder, DeliveryExecutionBoundary, EmailDeliveryExecutor Boundary, EmailQueueWriteBoundary, EmailJobPersistenceBoundary, EmailJobProcessingTriggerBoundary, EmailJobWorkerBoundary, EmailJobStatusPolicyBoundary, EmailJobIdempotencyBoundary, and EmailJobIdempotencyMigrationPlanBoundary are extracted as pure helpers/builders, but Delivery execution, e-mail job persistence execution, e-mail processing execution, e-mail worker execution, e-mail status/retry/locking execution, DB schema changes, e-mail idempotency enforcement, and e-mail idempotency migration execution are not wired into a real executor.
- Production DB config drift was corrected during P1.2B-17E and did not recur during P1.2B-18E, P1.2B-19E, P1.2B-20E, P1.2B-21E, or P1.2B-22E; the production DB target stayed sanitized to `chatbot`, and the deploy checklist should continue to verify that value explicitly.
- Duplicate read-only query planning, duplicate read-only execution planning, and duplicate audit approval planning are now extracted and production-validated as pure boundary logic, but actual live DB duplicate audit approval, SQL approval, staging / Production query execution, and cleanup decisions are still deferred; the current boundaries do not execute audit queries, query runners, repositories, cleanup, backfill, or enforcement, and they keep approval status `not_granted`.
- Dashboard Server Action mismatch logs should be observed separately; they are not a P1.2B-18 blocker because Dashboard health stayed green and Dashboard was not redeployed.
- Contact, lead, ticket, and handoff logic still overlap in state and metadata.
- Several regression tests are text-sensitive, so future wording changes need explicit review.

## Recommended Next Steps

1. `P1.2B-23B` should define pure staging-audit-scope, staging-environment-requirement, staging-query-class-allowance, staging-output-policy, and staging-stop-criteria data objects only.
2. `P1.2B-23B` must keep `DB_READ_ONLY_AUDIT`, staging DB read, and Production DB read approval out of runtime execution.
3. `P1.2B-23B` must not run real DB reads, SQL, query runners, reports, cleanup, or backfill.
4. Do not consolidate `ToolExecutorService` and `ToolDispatcherService` without a dedicated audit.
5. Do not activate the Conversation Engine in the public widget as part of this refactor line.

`P1.2B-21A` through `P1.2B-21E` are complete:

- `docs/architecture/email-job-duplicate-readonly-db-audit-execution-plan-audit.md`
- `apps/api/src/chat/email-job-duplicate-readonly-db-audit-execution.boundary.ts`
- `apps/api/test/email-job-duplicate-readonly-db-audit-execution-boundary.test.cjs`
- merge to `main`
- production-safe API deploy validation on squash commit `cf696042b68f463923e6f026a75658c563c51985`

`P1.2B-22A` is complete as a docs-only decision gate:

- `docs/architecture/email-job-duplicate-readonly-audit-approval-decision-gate.md`
- no DB-read approval granted
- no SQL, query runner, or report generation introduced
- no runtime or Production wiring introduced

`P1.2B-22B` through `P1.2B-22E` are complete:

- `docs/architecture/email-job-duplicate-readonly-audit-approval-decision-gate.md`
- `apps/api/src/chat/email-job-duplicate-readonly-audit-approval.boundary.ts`
- `apps/api/test/email-job-duplicate-readonly-audit-approval-boundary.test.cjs`
- merge to `main`
- Main-CI / Docker gate green on run `29446620828`
- production-safe API-only Docker build + recreate on `cfa992b448016545d1fba1bdbaba3af3716991e6`
- live API baseline correction documented to `3a276e7f0ef898bae791638b964087780da80c4d`
- Production DB drift guard remained green with sanitized target `chatbot`
- `production-health-synthetic` stayed green with HTTP `200` and matching `siteKey`

`P1.2B-23A` is complete as a docs-only staging-read-only scope / preconditions step:

- `docs/architecture/email-job-duplicate-staging-readonly-audit-scope-preconditions.md`
- no staging DB read approval granted
- no Production DB read approval granted
- no SQL, query runner, or report generation introduced
- no runtime or Production wiring introduced

`P1.2B-23B` through `P1.2B-23E-G` are complete:

- `docs/architecture/email-job-duplicate-staging-readonly-audit-scope-preconditions.md`
- `apps/api/src/chat/email-job-duplicate-staging-readonly-audit-scope.boundary.ts`
- `apps/api/test/email-job-duplicate-staging-readonly-audit-scope-boundary.test.cjs`
- production-safe API-only Docker build + recreate on `577518a29eac8a9553309f4aadaf6ac7e12479bc`
- Main-CI on the squash commit was not visible; the Docker fallback gate passed on the exact commit
- Production DB drift guard remained green with sanitized target `chatbot`
- `P1.2B-23E` initially stayed yellow because the safe Public-Widget smoke used the wrong Origin
- `P1.2B-23E-F` documented the Origin-Guard follow-up and safe fix options
- `P1.2B-23E-G` resolved the yellow status by using the existing internal safe-site Origin `https://p04-internal-test-20260702102313.internal.test`
- no Site-Config mutation, DB write, wildcard, or customer-site change was needed
- green safe-smoke validation confirmed:
  - Loader `200`
  - Bundle `200`
  - Config `200`
  - Session `201`
  - Chat `201`
  - neutral response
  - unchanged public response shape
  - no delivery/secret fields

Deferred runtime areas still include:

- Actual read-only duplicate audit queries against live rows.
- Actual DB-read-only audit execution against Production data.
- Actual `EmailJobsService.processPendingJobs` execution changes.
- Worker and SMTP behavior.
- Job selection and locking.
- Status transitions.
- Idempotency enforcement and duplicate prevention.
- Duplicate cleanup execution.
- Retry and failed handling.
- Stale processing recovery.
- `report_runs` synchronization.
- Provider logging.
- Audit/logging.
- Orchestrator wiring.
- Database constraints/indexes.
- Backfill strategy.
- Duplicate cleanup.
- Rollback execution.
- Queue writes.
- Real `DB_READ_ONLY_AUDIT` execution.
- Query runner implementation.
- Query-result handling.
- Report generation from live duplicate-audit data.
- `EmailJobsService.enqueue` refactor.
- `EmailJobsService.processPendingJobs` refactor.
- ProcessPendingJobs worker-loop refactor.
- Executor code.
- No ToolExecutor/ToolDispatcher consolidation.
- No Public Widget response change.
- No automatic `deliveryChannels` activation.
- No webhook signing or header movement.

Status: `P1.2B-21` completed the EmailJobDuplicateReadOnlyDbAuditExecutionBoundary extraction and production validation on `cf696042b68f463923e6f026a75658c563c51985`. `P1.2B-22` completed the docs-only approval / execution decision gate plus the pure `EmailJobDuplicateReadOnlyAuditApprovalBoundary` extraction and production validation on `cfa992b448016545d1fba1bdbaba3af3716991e6`. `P1.2B-23` completed the staging-read-only scope / approval preconditions, the pure `EmailJobDuplicateStagingReadOnlyAuditScopeBoundary`, the API-only production-safe deploy on `577518a29eac8a9553309f4aadaf6ac7e12479bc`, and the green safe Public-Widget smoke revalidation using the existing internal testsite Origin. Approval remains explicitly `not_granted` for real `DB_READ_ONLY_AUDIT`, staging DB reads, and Production DB reads. The boundary and decision line remain pure approval-decision, approval-matrix, environment-sequencing, stop-criteria, output-policy, execution-result, validation, classification, safe-projection, and staging-scope/preconditions data-object logic only.

Recommended next step: continue with `P1.2B-24A Email Job Duplicate Staging Read-only Audit Operator Approval Decision` as a docs-only approval step. The production-health baseline is green, the safe Public-Widget smoke is green, the Production DB drift guard remains green with sanitized target `chatbot`, and the remaining work is still approval and execution policy rather than live DB querying.
