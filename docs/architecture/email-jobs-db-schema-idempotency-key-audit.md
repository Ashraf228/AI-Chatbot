# Email Jobs DB Schema / Idempotency Key Audit

## Summary

P1.2B-17A is a read-only audit for `email_jobs` schema and idempotency-key boundaries. It documents the current schema, index and constraint state, report-run coupling, duplicate risks, privacy constraints, migration/backfill risks, and the safest next implementation scope.

No runtime code, SQL, migration, database read/write, queue write, `email_jobs` read/write/update, `processPendingJobs` call, `EmailJobsService.enqueue` behavior, worker/SMTP behavior, Public Widget response, feature flag, Production config, NOLIS-specific logic, or municipality-specific hardcoding is changed by this document.

Current baseline:

- P1.2B-16 is complete and production-validated.
- `EmailJobStatusPolicyBoundary` exists as pure data-object/policy logic only.
- Productive `EmailJobsService` persistence, status transitions, retry, locking, processing, SMTP, and `report_runs` sync remain deferred.
- `email_jobs` has no semantic idempotency key today.

## Current email_jobs Schema

Source: `apps/api/migrations/002_email_jobs.sql`

| Field | Type | Nullable | Default | Index/Constraint | Code Usage | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `id` | `TEXT` | no | none | Primary key | Generated with `randomUUID()` in `EmailJobsService.enqueue`; used for updates | Technical identity only; does not prevent semantic duplicates. |
| `kind` | `TEXT` | no | none | `email_jobs_kind_created_idx` with `created_at` | Current values are `lead_notification` and `report` in service types | No DB enum/check constraint; invalid values are possible at DB level. |
| `status` | `TEXT` | no | `queued` | `email_jobs_status_available_idx` with `available_at` | Worker selects `queued`, sets `processing`, `sent`, `queued`, or `failed` | No DB check constraint; status matrix is code-only. |
| `recipient_email` | `TEXT` | no | none | none | Mail recipient for `ReportMailerService.send` | PII; should not become a raw idempotency key or generic log field. |
| `subject` | `TEXT` | no | none | none | Mail subject | May contain site/user context; should not be raw key material. |
| `html` | `TEXT` | yes | none | none | HTML mail body | Can contain PII; must not be used raw in keys/logs. |
| `text` | `TEXT` | yes | none | none | Text mail body | Can contain PII; must not be used raw in keys/logs. |
| `metadata` | `JSONB` | no | `{}` | none | Carries correlation such as lead/report/site/session when callers include it | No DB-level shape validation; correlation is optional and convention-based. |
| `retry_count` | `INTEGER` | no | `0` | none | Incremented on send failure | No DB non-negative constraint. |
| `max_attempts` | `INTEGER` | no | `5` | none | Compared during retry/final-failure decision | No DB positive constraint. |
| `available_at` | `TIMESTAMPTZ` | no | `now()` | `email_jobs_status_available_idx` | Worker selects jobs where `available_at <= now()` | Delay policy is code-only. |
| `locked_at` | `TIMESTAMPTZ` | yes | none | none | Set on pick; cleared on success/retry/failure | No stale-processing recovery currently enforced by schema. |
| `sent_at` | `TIMESTAMPTZ` | yes | none | none | Set on successful send | No matching `failed_at` field. |
| `last_error` | `TEXT` | yes | none | none | Set on send failure; cleared on success | Provider errors may contain sensitive details; logs/projections must sanitize. |
| `created_at` | `TIMESTAMPTZ` | no | `now()` | `email_jobs_kind_created_idx` | Secondary ordering and admin context | Low. |
| `updated_at` | `TIMESTAMPTZ` | no | `now()` | none | Updated on pick, success, retry, and failure | Low. |

Not present as first-class columns:

- `tenant_id`
- `site_id`
- `session_id`
- `conversation_id`
- `lead_id`
- `contact_request_id`
- `report_run_id`
- `idempotency_key`
- `job_type` beyond free-form `kind`
- `failed_at`

Correlation currently lives in `metadata` when the caller supplies it.

## Current Indexes and Constraints

| Name | Type | Definition | Purpose | Gap |
| --- | --- | --- | --- | --- |
| `email_jobs_pkey` | Primary key | `id` | Technical row identity | Does not prevent semantic duplicates. |
| `email_jobs_status_available_idx` | B-tree index | `(status, available_at ASC)` | Worker selection for queued jobs | Not unique; no tenant/site/report/lead correlation. |
| `email_jobs_kind_created_idx` | B-tree index | `(kind, created_at DESC)` | Listing/inspection by kind and time | Not unique; no dedupe. |

No current schema evidence was found for:

- Unique idempotency constraint.
- Partial unique idempotency index.
- Check constraint for allowed `status`.
- Check constraint for allowed `kind`.
- Check constraint for non-negative `retry_count`.
- Check constraint for positive `max_attempts`.
- Foreign key from `email_jobs.metadata.reportRunId` to `report_runs.id`.
- Expression index on metadata keys such as `metadata->>'reportRunId'`, `metadata->>'leadId'`, `metadata->>'siteId'`, or `metadata->>'sessionId'`.

## Current report_runs Interaction

Source: `apps/api/migrations/001_initial_schema.sql`, `WidgetAdminReportsService.runReport`, and `EmailJobsService.syncRelatedRecords`.

| Table/Field | Relationship to email_jobs | Hard/Soft Coupling | Code Usage | Risk |
| --- | --- | --- | --- | --- |
| `report_runs.id` | Stored as `email_jobs.metadata.reportRunId` for report jobs | Soft | `EmailJobsService.syncRelatedRecords` reads `metadata.reportRunId` when `kind === 'report'` | No FK or expression index; missing/wrong metadata silently skips sync. |
| `report_runs.site_id` | Also included in report job metadata as `siteId` | Soft | Report admin listing and report generation | `email_jobs` has no first-class `site_id`; cross-table correlation is metadata-only. |
| `report_runs.status` | Updated after email job status changes | Soft | `sent`, `failed`, or `queued` based on email job outcome | Can diverge if sync fails after `email_jobs` update. |
| `report_runs.recipient_email` | Same semantic recipient as email job | Soft | Stored in report run and passed into enqueue | PII appears in two places; dedupe/privacy design must cover both. |
| `report_runs.error_message` | Updated from email job failure/retry path | Soft | Stores failure/retry context | Provider errors need sanitizing before display/log use. |
| `report_runs.completed_at` | Set on `sent`/`failed` | Soft | Report status display | Retry-to-queued can leave previous completion state semantics unclear if future paths change. |

Current report flow:

1. `WidgetAdminReportsService.runReport` inserts a `report_runs` row with `status='queued'`.
2. It builds a report payload.
3. It calls `EmailJobsService.enqueue` with `kind='report'` and metadata containing `reportRunId`, `siteId`, and `frequency`.
4. `EmailJobsService.processPendingJobs` later sends the mail.
5. `syncRelatedRecords` updates `report_runs` based on email job result.

Important gaps:

- `report_runs` is inserted before the email job, so enqueue failure leaves a report run that must be marked failed by the caller.
- There is no DB-level relationship between `email_jobs` and `report_runs`.
- There is no unique report-delivery key such as `reportRunId + recipientEmail + deliveryType`.
- A successful provider send followed by a failed DB update can create duplicate-send risk during later recovery.

## Current Duplicate / Idempotency Behavior

| Question | Current Answer | Risk |
| --- | --- | --- |
| Is there an `idempotency_key` column? | No. | No durable semantic dedupe key exists. |
| Is there a unique constraint against duplicate jobs? | No. | Duplicate jobs can be inserted for the same semantic event. |
| Is dedupe performed in `EmailJobsService.enqueue`? | No evidence found. The service generates a new UUID every enqueue. | Caller retries can create multiple queued jobs. |
| Is dedupe performed by `processPendingJobs`? | No. It processes queued rows in order. | Existing duplicates can be delivered. |
| Is report delivery deduped? | No generic dedupe. `reportRunId` is metadata-only. | Same report run could enqueue multiple jobs if caller retries. |
| Is lead notification deduped? | No generic job-level dedupe. Lead admin read correlates jobs to leads after the fact. | Same lead/contact event could produce multiple notifications if capture/enqueue is retried. |
| Is contact request deduped? | No first-class email job key was found for contact requests. | Future contact-request delivery needs explicit key design. |
| Is failed-job recreation controlled? | No idempotency policy exists. | Failed duplicates could be either legitimate retry or unwanted duplicate depending on future rules. |
| Is stale-processing recovery safe today? | No recovery path found. | Idempotency must be designed before adding recovery to avoid duplicate sends. |

Observed correlation candidates:

- Lead notifications currently include `metadata.siteId`, `metadata.sessionId`, `metadata.leadId`, and `metadata.leadEmail`.
- Report deliveries currently include `metadata.reportRunId`, `metadata.siteId`, and `metadata.frequency`.
- Existing pure queue/persistence boundaries model `siteId`, `sessionId`, `conversationId`, `leadId`, and `contactRequestId` as optional correlation data objects.

## Idempotency Key Candidate Matrix

| Candidate | Example Composition | Strengths | Weaknesses | Backfill Possible | Unique Index Possible | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lead Notification Key | `siteId + leadId + recipientHash + notificationType` | Strong when `leadId` exists; maps to persisted lead event | Older metadata may miss `leadId`; recipient must not be raw | Partially, if metadata has `leadId` and recipient | Yes, after duplicate audit and key column | Blocks accidental duplicate lead notifications; may block intentional re-send without override | Preferred for lead jobs once privacy/hash policy and duplicate cleanup are defined. |
| Contact Request Key | `siteId + contactRequestId + recipientHash + notificationType` | Strong for contact-request flows | `contactRequestId` is not present in current `email_jobs` schema and may be absent from legacy metadata | Only for rows with correlation metadata | Yes, later | Not useful until contact-request delivery writes consistent metadata | Good future key, not sufficient alone. |
| Conversation Key | `siteId + conversationId + deliveryType + recipientHash` | Useful before lead/contact IDs exist | Conversation may create multiple legitimate notifications over time | Weak unless reason/type/time window is included | Risky as a global unique key | Could block legitimate multiple deliveries from same conversation | Use only as fallback with explicit reason code or event ID. |
| Report Delivery Key | `reportRunId + recipientHash + deliveryType` | Strong semantic key for one report run to one recipient | Requires `reportRunId` in metadata; report run insert happens before enqueue | Good for report jobs with metadata | Yes, after duplicate audit | Needs soft-coupled metadata backfill and report-run cleanup plan | Preferred for report jobs after schema plan. |
| Payload Hash Key | `siteId + recipientHash + subjectHash + bodyHash` | Works when no semantic source ID exists | Body/subject can change legitimately; body may contain PII; hash stability depends on rendering | Possible but expensive and privacy-sensitive | Possible but brittle | Can hide bad semantics behind content hashes; body changes break dedupe | Do not use as primary key; reserve as diagnostic candidate only. |
| Generic Metadata Key | `metadata.idempotencyKey` | Flexible; avoids adding many source-specific columns | No current writer; JSONB key is harder to constrain reliably; privacy depends on caller | Only for new rows unless backfilled | Expression index possible later | Caller inconsistency can weaken dedupe | Good transitional field only if paired with validation and a real column plan. |

Privacy requirements for all candidates:

- Do not store raw `recipientEmail` in an idempotency key.
- Do not store raw subject, body, provider error, or full metadata in a key.
- Use deterministic non-secret hashes only after a dedicated privacy/key-design step decides whether the hash is acceptable.
- If a keyed hash/HMAC is required, key management must be separately audited; do not introduce it in P1.2B-17B.

## Privacy and PII Considerations

PII/high-risk fields:

- `recipient_email`
- `metadata.leadEmail`
- report recipient email
- lead name, phone, email, message
- mail `subject`
- mail `html`
- mail `text`
- `last_error` if provider/SMTP messages include recipient, host, account, or provider detail

Logging and key constraints:

- Raw recipient email should not appear in idempotency keys or generic safe projections.
- Raw `subject`, `html`, `text`, and full `metadata` should not appear in safe logs.
- Collision logs should use reason codes and redacted/hash-only identifiers.
- Hashing policy must define whether hashes are plain deterministic hashes or keyed hashes; the latter requires a separate secret-management plan.
- Existing `NotificationSafetyGuard` and email boundary safe projections already establish a redaction pattern that future idempotency helpers should reuse.

## Migration and Backfill Risks

| Area | Risk | Required Planning |
| --- | --- | --- |
| New `idempotency_key` column | Adds schema surface and rollout ordering | Needs nullable-first migration, writer rollout, verification, then constraint/index phase. |
| Unique index | Can fail if existing duplicate semantic jobs exist | Requires duplicate audit and cleanup plan before enforcement. |
| Partial unique index | Safer than global unique index if scoped by `kind` and active statuses | Needs exact status policy: include `queued`, `processing`, `sent`, maybe exclude or include `failed` by policy. |
| Backfill | Legacy metadata may be incomplete or inconsistent | Must be deterministic and should not require reading/writing Production without separate approval. |
| Existing duplicates | Unknown without DB audit; cannot be assumed absent | Needs read-only duplicate-count audit before any constraint. |
| PII hashing | Raw email/body must not become visible key material | Needs privacy policy and tests before implementation. |
| Report-run coupling | `metadata.reportRunId` is soft and not indexed | Needs expression-index or first-class column decision. |
| Rollback | Dropping a unique index/column can be safe, but app behavior may depend on it after rollout | Needs feature/order plan: deploy compatible code before enforcing DB constraints. |
| Locking/downtime | Index creation can lock or slow large tables if not planned | Needs `CONCURRENTLY`/maintenance-window decision in a later migration plan. |

No migration, SQL, DB read, DB write, index, constraint, or backfill is part of P1.2B-17A.

## Status / Retry / Locking Interaction

| Scenario | Idempotency Consideration | Risk |
| --- | --- | --- |
| Duplicate before insert | Best place to prevent duplicate jobs once enforcement exists | Requires DB lookup/unique constraint, which is deferred. |
| Duplicate queued job | Should usually no-op/block if same semantic key exists | Without key, duplicate queued jobs can both send. |
| Duplicate processing job | Should usually no-op/block and wait for existing job outcome | Requires stale-processing policy to avoid indefinite blocks. |
| Duplicate sent job | Should usually no-op/block because delivery already happened | Needs audit trail for intentional resend override. |
| Duplicate failed job | Policy decision needed: block, allow new, or retry existing | Incorrect choice can either lose notifications or duplicate them. |
| Retry of same job | Must retain same idempotency key | Retry must not be blocked by its own key. |
| Stale processing recovery | Must not send twice after provider success but DB update failure | Requires idempotency/recovery design before implementing recovery. |
| Status transition failure | Key alone does not make send+DB update atomic | Needs future transactional/compensation design. |
| Report sync divergence | `email_jobs` and `report_runs` can disagree | Idempotency should not assume report status is authoritative. |

Potential partial unique index design is deferred. A future plan should decide whether uniqueness applies to:

- Active statuses only: `queued`, `processing`.
- Terminal statuses too: `sent`.
- Failed statuses conditionally, depending on retry/recreate policy.
- A normalized `job_type`/`semantic_event_type` field rather than free-form `kind`.

## Error Handling and No-op Behavior

Future idempotency decisions should return data objects first:

- `allow_insert`
- `duplicate_noop`
- `duplicate_blocked`
- `retry_existing`
- `manual_review_required`
- `invalid_candidate`
- `privacy_blocked`

No-op output must be log-safe:

- Do not include raw recipient email.
- Do not include body or subject.
- Do not include full metadata.
- Include only reason code, key type, hashed/safe key fingerprint if approved, and non-sensitive source identifiers.

## Secret and Logging Boundaries

No secrets were found in the audited schema/code paths, but the following fields must be treated as sensitive:

- `recipient_email`
- `leadEmail`
- `html`
- `text`
- `subject`
- `last_error`
- provider/SMTP errors
- webhook/signing/header fields in adjacent delivery code

Allowed technical terms in docs/tests are not secrets by themselves:

- `token`
- `apiKey`
- `signingSecret`
- `recipientEmail`
- `webhookUrl`
- `email_jobs`
- `webhook_jobs`
- `processPendingJobs`
- `EmailJobsService.enqueue`
- `FOR UPDATE SKIP LOCKED`
- `metadata.reportRunId`

## Existing Builders and Boundaries

| Boundary | Current Responsibility | Explicitly Not Responsible For |
| --- | --- | --- |
| `NotificationSafetyGuard` | Sanitizing, target/no-op checks, public/admin/log safety | Queue writes, DB reads/writes, idempotency enforcement. |
| `DeliveryPayloadBuilder` | Lead/email payload data objects and audit-safe projections | Queue writes, DB reads/writes, delivery execution. |
| `DeliverySideEffectCommandBuilder` | `queue_email_job` and no-op command data objects | Executing commands or writing queues. |
| `DeliveryExecutionBoundary` | ExecutionPlan and result data objects | Executing delivery or persistence. |
| `EmailDeliveryExecutor` Boundary | Ready/skipped/blocked/failed result data objects | Sending mail or writing jobs. |
| `EmailQueueWriteBoundary` | EnqueueRequest/EnqueueResult data objects | Writing `email_jobs`. |
| `EmailJobPersistenceBoundary` | PersistenceRequest/PersistenceResult data objects | DB persistence. |
| `EmailJobProcessingTriggerBoundary` | ProcessingTriggerRequest/ProcessingTriggerResult data objects | Calling `processPendingJobs`. |
| `EmailJobWorkerBoundary` | WorkerSelectionPlan, StatusTransitionPlan, RetryDecision, WorkerResult data objects | SQL, SMTP, DB reads/writes, status updates. |
| `EmailJobStatusPolicyBoundary` | Status/retry/locking/stale-processing policy data objects | SQL, DB reads/writes, `email_jobs` updates, recovery execution. |
| `EmailJobsService` | Current real persistence, worker selection, send, retry/status update, `report_runs` sync | This remains the productive implementation until separately refactored. |

## Safe / Unsafe Scope

### Safe for P1.2B-17B

Only if code is explicitly allowed later:

- Pure `EmailJobIdempotencyBoundary` types.
- `IdempotencyKeyCandidate` data objects.
- `IdempotencyKeyPolicy` data objects.
- `DedupeDecision` data objects.
- `SchemaMigrationPlan` data objects.
- `BackfillRisk` data objects.
- Validation helpers.
- No-op/blocked/failed result helpers.
- Audit/log-safe idempotency projections.
- Static test fixtures with placeholder values only.

Constraints:

- No productive runtime use.
- No SQL.
- No DB/queue reads.
- No DB/queue writes.
- No `email_jobs` reads/writes/updates.
- No `processPendingJobs`.
- No `EmailJobsService.enqueue` change.
- No Orchestrator wiring.
- No migration.

### Unsafe / Deferred Scope

Not safe for P1.2B-17B:

- New DB column.
- Unique constraint.
- New index.
- Partial unique index.
- Migration file.
- Backfill.
- Existing duplicate cleanup.
- `email_jobs` reads/writes/updates.
- Idempotency enforcement in `EmailJobsService.enqueue`.
- Dedupe before insert.
- `processPendingJobs` changes.
- Retry/status/locking behavior changes.
- Stale-processing recovery.
- `report_runs` sync changes.
- Orchestrator wiring.
- Production wiring.

### Separately Audit

- Email Jobs DB Migration Plan.
- Idempotency Key Backfill Plan.
- Existing Duplicate Cleanup Audit.
- PII Hashing / Key Privacy Audit.
- Partial Unique Index Design.
- Rollback Strategy for Constraints.
- Stale Processing Recovery Design.

## Proposed Boundary Services

### EmailJobIdempotencyBoundary

Pure data-object boundary:

- `IdempotencyKeyCandidate`.
- `IdempotencyKeyPolicy`.
- `DedupeDecision`.
- Validation helpers.
- Safe projections.
- No SQL.

### EmailJobIdempotencyPrivacyGuard

Pure privacy policy boundary:

- Recipient hashing policy data object.
- Redaction policy data object.
- No raw email in safe output.
- No subject/body in safe output.
- No secret-based hashing until a separate key-management plan exists.

### EmailJobSchemaPlanBoundary

Pure planning boundary:

- `SchemaChangePlan`.
- `IndexPlan`.
- `BackfillPlan`.
- `RollbackPlan`.
- No migration code.

### EmailJobIdempotencyRepository

Deferred implementation boundary:

- Actual DB lookups.
- Actual insert/unique-constraint handling.
- Existing duplicate checks.
- Only after DB/migration/privacy/rollback plans are approved.

## Recommended P1.2B-17B Scope

P1.2B-17B should still avoid migration, SQL, DB reads/writes, `email_jobs` reads/writes/updates, and productive wiring.

Recommended safe scope:

- Add `EmailJobIdempotencyBoundary` only as pure types/helpers.
- Define `IdempotencyKeyCandidate` data objects.
- Define `IdempotencyKeyPolicy` data objects.
- Define `DedupeDecision` data objects.
- Define `SchemaPlan` and `BackfillRisk` data objects.
- Add validation helpers.
- Add no-op/blocked/failed helpers.
- Add log-/audit-safe idempotency projections.
- Add focused unit tests.

Explicitly not allowed in P1.2B-17B:

- DB migration.
- SQL.
- DB reads/writes.
- `email_jobs` reads/writes/updates.
- Unique index/constraint.
- Backfill.
- Idempotency enforcement.
- `EmailJobsService.enqueue` change.
- `processPendingJobs` change.
- `report_runs` sync change.
- Orchestrator wiring.
- Production wiring.

## Required Tests

### Idempotency Candidate Validation

- Lead notification candidate is valid with site, lead, recipient policy, and notification type.
- Contact request candidate is valid with site, contact request, recipient policy, and notification type.
- Report delivery candidate is valid with report run, recipient policy, and delivery type.
- Missing `siteId` is blocked.
- Missing source ID is blocked.
- Missing recipient policy is blocked.
- Invalid type is blocked.

### Privacy / Hashing Policy

- Raw `recipientEmail` does not appear in safe output.
- Raw body does not appear in key output.
- Subject is excluded or represented only by an approved hash/fingerprint.
- Provider error text is not exposed in safe output.
- Placeholder/test values do not resemble real credentials.

### Dedupe Decision

- No existing key -> allow.
- Existing queued -> duplicate no-op/block.
- Existing processing -> duplicate no-op/block.
- Existing sent -> duplicate no-op/block.
- Existing failed -> policy-driven allow/block/retry-existing.
- Current job retry keeps its own key and is not blocked by itself.

All should be data-object tests only, with no DB.

### Schema Plan

- Proposed idempotency column plan validates as data only.
- Proposed unique-index plan validates as data only.
- Backfill is marked required when legacy rows exist.
- Duplicate cleanup is marked required if conflicts are possible.
- No SQL is generated or executed.

### No Side Effects

- No DB dependency.
- No queue dependency.
- No `process.env`.
- No logger.
- No `EmailJobsService.enqueue`.
- No `EmailJobsService.processPendingJobs`.
- No `processPendingJobs`.
- No SQL strings.

### Regression

- `NotificationSafetyGuard` tests stay green.
- `DeliveryPayloadBuilder` tests stay green.
- `DeliverySideEffectCommandBuilder` tests stay green.
- `DeliveryExecutionBoundary` tests stay green.
- `EmailDeliveryExecutor` Boundary tests stay green.
- `EmailQueueWriteBoundary` tests stay green.
- `EmailJobPersistenceBoundary` tests stay green.
- `EmailJobProcessingTriggerBoundary` tests stay green.
- `EmailJobWorkerBoundary` tests stay green.
- `EmailJobStatusPolicyBoundary` tests stay green.
- Public Widget response shape remains unchanged.

## Non-goals

P1.2B-17 is not:

- Conversation Engine live activation.
- AssistantProfile migration.
- Feature-flag work.
- Public Widget response work.
- DB migration.
- Queue schema change.
- `email_jobs` read/write/update work.
- SQL work.
- New DB column.
- Unique index.
- Backfill.
- Existing duplicate cleanup.
- Idempotency enforcement.
- `EmailJobsService.enqueue` refactor.
- `EmailJobsService.processPendingJobs` refactor.
- `processPendingJobs` call change.
- Worker/SMTP change.
- `report_runs` sync change.
- Retry/status/locking change.
- Stale-processing recovery change.
- `webhook_jobs` write.
- ToolExecutor/ToolDispatcher consolidation.
- IntegrationDispatcher change.
- Automatic `deliveryChannels` activation.
- External integration execution.
- Response text modernization.
- Orchestrator wiring.
- Production wiring.
- NOLIS-specific logic.
- Municipality-specific hardcoding.

## Recommended Next Step

Proceed to P1.2B-17B only as a pure `EmailJobIdempotencyBoundary` extraction:

- Types and data objects only.
- Validation and safe projection helpers only.
- No DB, SQL, migration, reads, writes, queue writes, enforcement, or productive wiring.

After P1.2B-17B, the next separate audits should cover DB migration design, existing duplicate cleanup, privacy/hash policy, partial unique index design, and rollback strategy before any real enforcement is introduced.
