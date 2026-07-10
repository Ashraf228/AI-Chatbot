# Email Job Idempotency Enforcement / Migration Plan Audit

## Summary

P1.2B-18A is a read-only audit for a possible future `email_jobs` idempotency enforcement and migration plan. It does not implement enforcement, schema changes, SQL, DB access, queue writes, worker changes, or production wiring.

The safe conclusion is that enforcement should not be introduced directly. The current code has multiple write paths, no durable semantic idempotency key, no unique idempotency constraint, and live retry/status/report-run coupling. A future rollout needs separate phases for key design, privacy-safe recipient hashing, nullable schema planning, shadow writes, duplicate audit, cleanup, service-level conflict handling, DB-level enforcement, and rollback.

## Current Idempotency State

| Bereich | Aktueller Zustand | Beleg im Code/Schema | Risiko | Relevanz fuer Enforcement |
| --- | --- | --- | --- | --- |
| `email_jobs` schema | Has technical `id`, `kind`, `status`, `recipient_email`, `subject`, `html`, `text`, `metadata`, retry/status timestamps and error fields. | `apps/api/migrations/002_email_jobs.sql` | No semantic duplicate prevention; recipient and payload fields contain sensitive values. | Future idempotency needs a separate non-PII key and rollout plan. |
| `email_jobs` indexes | Indexes exist for `(status, available_at)` and `(kind, created_at)`. | `apps/api/migrations/002_email_jobs.sql` | No key lookup or uniqueness support for duplicates. | Future duplicate checks would need a new lookup/index design. |
| `email_jobs` constraints | Primary key only on random `id`; no `idempotency_key` column or unique semantic constraint. | `apps/api/migrations/002_email_jobs.sql` | Caller retries can persist distinct rows. | DB-level enforcement cannot happen without migration and cleanup. |
| `report_runs` coupling | `report_runs` stores run status and recipient; `EmailJobsService.processPendingJobs` updates it based on report job status. | `apps/api/migrations/001_initial_schema.sql`, `apps/api/src/modules/widget/services/email-jobs.service.ts` | Duplicate report jobs can desync or repeat status transitions. | Report delivery is the clearest pilot scope, but only after run/job policy is defined. |
| `EmailJobsService.enqueue` | Generates random UUID, inserts a queued job, then fire-and-forget calls `processPendingJobs`. | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Central for service callers but not the only write path; immediate processing complicates conflict handling. | Strong candidate for future service-level handling, not sufficient alone. |
| `queueInternalLeadNotification` | Directly inserts `email_jobs` from `ChatAgentOrchestratorService`. | `apps/api/src/chat/chat-agent-orchestrator.service.ts` | Bypasses `EmailJobsService.enqueue`; any service-only enforcement can be bypassed. | Must be removed, wrapped, or separately guarded before hard enforcement. |
| `processPendingJobs` | Picks queued rows with `FOR UPDATE SKIP LOCKED`, sends mail, updates status and optional `report_runs`. | `apps/api/src/modules/widget/services/email-jobs.service.ts` | Duplicate has already been persisted by the time processing sees it. | Not the primary enforcement point. Must remain retry/status focused. |
| Report delivery path | Creates `report_runs`, then enqueues a report job with metadata containing `reportRunId`, `siteId`, and `frequency`. | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` | Repeated user/action retries may create multiple runs/jobs unless upstream dedupe exists. | Strong key candidate: `reportRunId + recipientHash + deliveryType`. |
| Public lead notification path | Creates `widget_leads`, then uses `EmailJobsService.enqueue` with metadata containing `siteId`, `sessionId`, `leadId`, and `leadEmail`. | `apps/api/src/modules/widget/services/widget-leads.service.ts` | Lead write and notification write are separate; duplicate job policy must not create duplicate leads. | Key candidate: `siteId + leadId + recipientHash + notificationType`. |
| Agent lead notification path | ToolDispatcher creates lead and uses `EmailJobsService.enqueue` with `agentRunId`, `leadId`, and `leadEmail`. | `apps/api/src/tools/tool-dispatcher.service.ts` | Some lead dedupe exists before lead insert, but not on job-level semantics. | Enforcement should use lead identity, not payload body. |
| Contact request path | Contact-request concepts exist in existing boundaries and site export, but the observed email job schema has no first-class contact request column. | Code-only inference from boundary types and export queries. | Source identifiers may live only in metadata or not exist for older rows. | Needs field availability audit before enforcement. |
| Dedupe before lead creation | Tool path prevents duplicate lead creation in its own flow; email job dedupe is separate. | `apps/api/src/tools/tool-dispatcher.service.ts` | Lead dedupe does not prevent duplicate notification jobs in all paths. | Do not assume lead dedupe equals email-job idempotency. |
| IdempotencyBoundary data objects | Candidate, policy, dedupe decision, schema plan, and backfill risk types exist and are pure. | `apps/api/src/chat/email-job-idempotency.boundary.ts` | Safe planning layer only; no DB access or enforcement. | Useful basis for future plan boundaries. |
| StatusPolicyBoundary data objects | Status, retry, locking, and stale-processing policies exist as pure data objects. | `apps/api/src/chat/email-job-status-policy.boundary.ts` | No live SQL or worker behavior is moved. | Future idempotency must be compatible with retry/status rules. |

Unclear items are intentionally marked as code-derived only. No Production DB reads were performed.

## Enforcement Point Analysis

| Enforcement Point | Datei/Funktion | Vorteil | Risiko | Benoetigte Daten | Rollback-Faehigkeit | Empfehlung |
| --- | --- | --- | --- | --- | --- | --- |
| Before `EmailJobsService.enqueue` | Individual callers | Earliest possible no-op; caller can know source context. | Many callers; direct insert path can bypass it; inconsistent policies. | Source ID, recipient hash, delivery type, duplicate policy. | Easy app rollback, weak enforcement. | Use only as shadow/pre-validation, not hard enforcement. |
| Inside `EmailJobsService.enqueue` | `EmailJobsService.enqueue` | Central for service callers; can standardize conflict result. | Direct Orchestrator insert bypasses it; unique violations still possible under race. | Key candidate, policy, repository lookup, unique violation mapping. | API rollback possible if DB remains backward compatible. | Primary service-level handling after write paths are unified. |
| Before `queueInternalLeadNotification` insert | `ChatAgentOrchestratorService.queueInternalLeadNotification` | Covers known direct lead-notification bypass. | Special-case path; keeps duplicate persistence logic split. | Lead ID, site ID, recipient hash, notification type. | API rollback possible. | Short-term guard only; better future path is to remove direct insert. |
| DB unique / partial unique enforcement | Future schema/index migration | Hard concurrency-safe protection. | Requires migration, duplicate audit, cleanup, nullable rollout, rollback plan. | Durable idempotency key, status/kind policy, existing-row strategy. | Harder; DB rollback separate from API rollback. | Do only after shadow writes and duplicate cleanup. |
| In `processPendingJobs` | Worker processor | Single processing location. | Too late; duplicate already persisted and may affect admin/report state. | Existing job row and possible duplicate lookup. | API rollback possible, but state may already drift. | Not a primary enforcement point. Keep for retry/status processing. |
| Report delivery specific | `WidgetAdminReportsService.runReport` and report metadata | Clear source identifier; lower ambiguity than generic email. | Only solves report path; repeated legitimate report runs need policy clarity. | `reportRunId`, recipient hash, delivery type, frequency semantics. | API rollback possible before DB enforcement. | Good pilot for shadow policy, not full general enforcement. |

Recommended later architecture is service-level handling plus DB-level enforcement only after direct write paths are unified and migration/backfill risk is resolved.

## Idempotency Key Design

| Use Case | Key Parts | Pflichtfelder | PII-Risiko | Stabilitaet | Backfill-Faehigkeit | Collision-Risiko | Empfehlung |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lead Notification | `siteId + leadId + recipientHash + notificationType` | `siteId`, `leadId`, recipient hash, notification type | Medium if raw recipient is used; low with hash only. | Stable if lead ID is durable. | Medium; newer metadata has lead IDs, older/direct rows may vary. | Low if lead ID is unique and recipient hash is scoped. | Preferred lead notification key after recipient hashing policy. |
| Contact Request | `siteId + contactRequestId + recipientHash + notificationType` | `siteId`, contact request ID, recipient hash, notification type | Medium if recipient is raw. | Stable only when contact request ID is guaranteed. | Unclear; may depend on metadata availability. | Low if source ID exists. | Defer until contact request data availability is audited. |
| Conversation Delivery | `siteId + conversationId + deliveryType + recipientHash` | `siteId`, conversation ID, delivery type, recipient hash | Medium if recipient is raw. | Medium; conversations can produce multiple legitimate deliveries. | Unclear. | Medium if delivery type is too broad. | Use only with a specific source event or delivery attempt concept. |
| Report Delivery | `reportRunId + recipientHash + deliveryType` | report run ID, recipient hash, delivery type | Medium if recipient is raw. | High for a single report run. | High for rows with `metadata.reportRunId`; lower for legacy rows without it. | Low. | Best pilot candidate. |
| Generic Email Delivery | `siteId + sourceType + sourceId + recipientHash + deliveryType` | site ID, source type, source ID, recipient hash, delivery type | Medium if recipient is raw. | Depends on each source. | Mixed. | Medium if source ID is missing or reused. | Useful abstraction, but block if source ID is missing. |
| Payload Hash | `siteId + recipientHash + subjectHash + bodyHash` | site ID, recipient hash, subject/body hash | High if subject/body contain PII before hashing. | Low to medium; templates and timestamps can change. | Poor; requires reading sensitive body fields. | Medium; small changes break dedupe. | Avoid as primary key; maybe diagnostic-only after privacy review. |

Fields that exist today are inconsistent across paths. `reportRunId`, `leadId`, `siteId`, and `sessionId` often live in metadata. The schema has no first-class `idempotency_key`, `site_id`, `lead_id`, `report_run_id`, or `recipient_hash` columns on `email_jobs`.

## Privacy and PII Hashing Strategy

Raw `recipient_email` must not be stored in a cleartext idempotency key. A future key should use a recipient fingerprint such as `recipientHash`, but the hashing policy is a separate security design.

Open policy decisions:

- Normalize e-mail before hashing, including trim and case-folding for the local policy.
- Decide between plain hash and HMAC. HMAC is safer against dictionary attacks but needs key management.
- Define salt/secret storage, rotation, and historic-key compatibility before backfill.
- Define how recipient-hash rotation affects old rows and duplicate detection.
- Treat subject, body, HTML, text, and payload as sensitive. Do not use cleartext body fields in keys or logs.
- If body hashing is ever considered, audit stability and privacy separately because rendered payloads can contain user data.
- Safe logs should include reason codes, source type, status, and redacted/fingerprinted identity only.

No hashing implementation, secret, real value, or PII processing is introduced by this audit.

## Migration Strategy

| Phase | Ziel | Aenderung | Risiko | Tests | Rollback |
| --- | --- | --- | --- | --- | --- |
| Phase 0: Audit / Plan | Current step | Documentation only | None to runtime | Doku-only checks | No runtime rollback needed |
| Phase 1: Nullable Column Plan | Plan a possible key column | Future nullable field only, not now | Migration ordering and null semantics | Migration dry-run plan, schema diff review | Drop/ignore nullable field if unused |
| Phase 2: Write New Keys | Shadow key generation for new rows | Future app writes key but does not enforce | Key quality, missing fields, PII mistakes | Shadow validation, safe logs, no-op path tests | Disable key writing while keeping nullable column |
| Phase 3: Backfill / Duplicate Audit | Understand legacy rows | Future read-only duplicate audit and optional cleanup plan | Existing duplicates, incomplete metadata, privacy hashing | Read-only duplicate report, manual review | No mutation in audit; cleanup requires separate rollback |
| Phase 4: Partial Unique Index / Constraint | DB-level protection | Future proposed unique/partial index only after cleanup | Locking, conflicts, rollback complexity | Migration rehearsal, duplicate-free proof, constraint tests | Dedicated DB rollback plan |
| Phase 5: Enforcement Handling | Service no-op/conflict handling | Future duplicate skip and unique-violation mapping | Broken caller expectations, report-run drift | Conflict policy tests, API behavior tests | App rollback if DB supports old path |
| Phase 6: Rollback / Disable | Controlled rollback | Future flags or disable plan for app enforcement | DB constraint cannot be disabled by app flag | Rollback drills | DB migration rollback or compatibility mode |

This document intentionally avoids executable SQL. Any examples in later docs must be clearly labeled as pseudocode until a migration PR is approved.

## Unique / Partial Index Options

| Option | Vorteil | Risiko | Bewertung |
| --- | --- | --- | --- |
| Unique over `idempotency_key` | Simple, hard guarantee. | Every row/use case needs a good key; null/legacy semantics must be defined. | Not safe before duplicate audit and nullable rollout. |
| Partial unique for selected `kind` | Allows staged rollout by job type. | Uneven enforcement, kind naming must be stable. | Good later pilot option, especially report-only or lead-only. |
| Unique over `(kind, idempotency_key)` | Namespaces keys and reduces cross-kind collision. | Key design must consistently include source semantics. | Likely safer than key-only if multiple sources share key vocabulary. |
| Report-only unique | Clear pilot around `reportRunId`. | Does not solve lead notifications. | Best candidate for first DB enforcement pilot after report duplicate audit. |
| App dedupe only | Avoids migration. | Race conditions and bypass paths remain. | Not enough for hard idempotency; useful only as shadow/no-op phase. |

Recommendation: no unique index without duplicate audit, cleanup decisions, service-level conflict handling, rollback plan, and tests.

## Existing Duplicate Cleanup and Backfill

Legacy rows can lack a deterministic key because `email_jobs` stores random IDs and metadata is caller-dependent. Rows may have incomplete metadata, raw recipient values, provider error text, or no source identifier.

Backfill questions for a later plan:

- Which rows have enough metadata for a source-specific key?
- Which rows would produce the same candidate key?
- Should queued and processing rows be treated differently from sent and failed rows?
- Should a failed historical job block a future resend, or should the key include retry/recreate policy?
- How should `report_runs` map to existing report jobs if multiple jobs reference the same run?
- Does duplicate cleanup require manual business decisions before any unique constraint?
- Can a read-only duplicate audit be run safely before any migration?
- What is the rollback plan if backfill creates wrong or overbroad keys?

No DB read, backfill script, cleanup script, or migration is created here.

## Error Handling and Conflict Policy

Future conflict policies should be explicit data decisions:

| Scenario | Later policy question | Initial recommendation |
| --- | --- | --- |
| Existing key is `queued` | Should caller skip or join existing queued job? | Skip/no-op with audit reason. |
| Existing key is `processing` | Should caller wait, skip, or create another job? | Skip/no-op; avoid duplicate in-flight send. |
| Existing key is `sent` | Should resend be blocked? | Usually skip; allow explicit resend only with a separate source event. |
| Existing key is `failed` | Should retry/recreate be allowed? | Policy-driven; do not globally block without retry semantics. |
| Unique violation after app check | Race condition or stale read. | Map to safe duplicate result; no raw SQL/error leak. |
| Key cannot be built | Missing source field or recipient hash. | Block enforcement path and allow legacy only in shadow phase. |
| Missing recipient hash | Privacy-safe key unavailable. | Block key generation; do not fallback to raw recipient. |
| Incomplete metadata | Legacy/unknown row. | Treat as audit finding, not automatic mutation. |

User-visible chat responses must not change because of duplicate handling. Logs and audit results must use reason codes and safe projections only.

## Status / Retry / Locking Interaction

- Retries of the same persisted row should keep the same future idempotency key.
- Retry must not be blocked as a duplicate of itself.
- `sent` should normally block a repeated same-source delivery.
- `queued` and `processing` should normally skip duplicate enqueue attempts.
- `failed` needs a distinct policy: allow retry, allow recreate, or block depending on source and age.
- Stale-processing recovery must not be made impossible by a unique key.
- `processPendingJobs` should continue to own status, locking, retry, and SMTP execution rather than become the primary duplicate-enforcement point.
- A DB unique index must be compatible with retry/status behavior and report-run synchronization.

## Rollout and Rollback Strategy

Potential future rollout stages:

1. Shadow key generation in app data objects only.
2. Log-only duplicate detection with safe projections.
3. Nullable key write for new jobs, no hard enforcement.
4. Read-only duplicate audit and manual cleanup plan.
5. No-op duplicate handling in service-level code.
6. DB unique or partial unique enforcement after duplicate-free proof.
7. Observability and rollback drill.

Feature flags can govern key writing and service-level duplicate skip behavior. A DB unique index or constraint cannot be fully controlled by an app flag, so DB rollback must be planned separately. Any real migration should require backups/snapshots and a rollback runbook before execution.

## Existing Builders and Boundaries

| Boundary | Current role | Enforcement boundary |
| --- | --- | --- |
| `NotificationSafetyGuard` | Sanitizing, no-op checks, public/admin safety. | No queue writes or DB enforcement. |
| `DeliveryPayloadBuilder` | Email payload data objects. | No queue writes. |
| `DeliverySideEffectCommandBuilder` | Queue/no-op command data objects. | No executor or DB writes. |
| `DeliveryExecutionBoundary` | Execution-plan data objects. | No runtime execution. |
| `EmailDeliveryExecutorBoundary` | Ready/skipped/blocked/failed result data objects. | No queue writes. |
| `EmailQueueWriteBoundary` | Enqueue request/result data objects. | No `email_jobs` writes. |
| `EmailJobPersistenceBoundary` | Persistence request/result data objects. | No DB writes. |
| `EmailJobProcessingTriggerBoundary` | Processing trigger request/result data objects. | No `processPendingJobs`. |
| `EmailJobWorkerBoundary` | Worker selection/status/retry result data objects. | No SQL or SMTP. |
| `EmailJobStatusPolicyBoundary` | Status, retry, locking, stale-processing policy data objects. | No DB access. |
| `EmailJobIdempotencyBoundary` | Idempotency candidate/policy/dedupe/schema/backfill data objects. | No SQL, DB access, or enforcement. |
| `EmailJobsService` / DB | Real persistence, status, retry, worker, report sync. | Future enforcement must remain deferred until migration plan is approved. |

## Safe / Unsafe Scope

Safe for P1.2B-18B if code is approved later:

- Pure `EmailJobIdempotencyMigrationPlanBoundary` types.
- `EnforcementPointPlan` data objects.
- `IdempotencyMigrationPhase` data objects.
- `UniqueIndexPlan` data objects.
- `BackfillPlan` data objects.
- `DuplicateConflictPolicy` data objects.
- `RollbackPlan` data objects.
- Validation helpers.
- Safe projection helpers.
- No productive usage.
- No SQL.
- No DB or queue reads.
- No DB or queue writes.
- No `email_jobs` reads, writes, or updates.
- No `EmailJobsService.enqueue` or `processPendingJobs` change.

Unsafe or deferred for P1.2B-18B:

- DB migration.
- New DB column.
- Unique index or constraint.
- SQL.
- Backfill.
- Existing duplicate cleanup.
- Idempotency enforcement.
- `EmailJobsService.enqueue` changes.
- `processPendingJobs` changes.
- `report_runs` synchronization changes.
- Orchestrator wiring.
- Production wiring.

Separately audit:

- Actual DB migration implementation plan.
- Duplicate cleanup runbook.
- PII hashing / HMAC secret management.
- Partial unique index rollout.
- Enqueue enforcement implementation.
- Idempotency conflict observability.

## Proposed Boundary Services

| Proposed boundary | Responsibility | Explicit non-responsibility |
| --- | --- | --- |
| `EmailJobIdempotencyMigrationPlanBoundary` | Migration phase, index plan, backfill plan, rollback plan data. | No SQL or migration files. |
| `EmailJobIdempotencyEnforcementPlanBoundary` | Enforcement point and duplicate conflict policy data. | No DB lookup or duplicate query. |
| `EmailJobIdempotencyPrivacyPlanBoundary` | Recipient hash and PII redaction policy data. | No hashing implementation or secret handling. |
| `EmailJobIdempotencyRepository` | Future actual DB lookup and unique violation handling. | Not safe before migration and duplicate-audit approval. |

## Recommended P1.2B-18B Scope

P1.2B-18B should still avoid migration, SQL, DB reads/writes, `email_jobs` reads/writes/updates, and real enforcement.

Recommended safe scope:

- Add pure `EmailJobIdempotencyMigrationPlanBoundary` interface/types.
- Add `EnforcementPointPlan` data objects.
- Add `IdempotencyMigrationPhase` data objects.
- Add `UniqueIndexPlan` data objects.
- Add `BackfillPlan` data objects.
- Add `DuplicateConflictPolicy` data objects.
- Add `RollbackPlan` data objects.
- Add validation/no-op/blocked/failed helpers.
- Add log-/audit-safe migration-plan projections.
- Keep all usage test-only or documentation-only.

Explicitly not allowed in P1.2B-18B:

- DB migration or SQL.
- `email_jobs` reads/writes/updates.
- Unique index or constraint.
- Backfill.
- Existing duplicate cleanup.
- Idempotency enforcement.
- `EmailJobsService.enqueue` changes.
- `processPendingJobs` changes.
- `report_runs` synchronization changes.
- Orchestrator wiring.
- Production wiring.

## Required Tests

Later P1.2B-18B tests should prove:

- Migration phase order is valid.
- Enforcement cannot be enabled before key-writing phase.
- Unique-index plan cannot be marked ready before duplicate cleanup and rollback plan.
- All index plans are `proposed_only` data and generate no SQL.
- Direct insert path is flagged as a bypass risk.
- `processPendingJobs` is not marked as primary enforcement point.
- Missing source fields block enforcement plans.
- Backfill plans require legacy-row audit and PII hashing policy.
- Conflict policies define queued, processing, sent, failed, missing-source, and missing-recipient-hash outcomes.
- Safe projections contain no raw recipient, body, HTML, text, provider error, SQL, token, or secret values.
- No DB access, SQL, migration file, queue write, `EmailJobsService.enqueue`, `processPendingJobs`, `report_runs`, or Orchestrator wiring is introduced.

## Non-goals

P1.2B-18 is not:

- Conversation Engine Live activation.
- AssistantProfile migration.
- Feature-flag activation.
- Public Widget response change.
- DB migration.
- Queue schema change.
- `email_jobs` reads, writes, or updates.
- SQL.
- New DB column.
- Unique index or constraint.
- Backfill.
- Existing duplicate cleanup.
- Idempotency enforcement.
- `EmailJobsService.enqueue` refactor.
- `EmailJobsService.processPendingJobs` refactor.
- `processPendingJobs` call change.
- Worker or SMTP change.
- `report_runs` sync change.
- Retry, status, or locking behavior change.
- `webhook_jobs` writes.
- ToolExecutor, ToolDispatcher, or IntegrationDispatcher consolidation.
- Automatic `deliveryChannels` activation.
- Direct external integration.
- Answer-text modernization.
- Orchestrator wiring.
- Production wiring without a separate deploy plan.
- NOLIS-specific logic.
- Municipality-specific hardcoding.

## Recommended Next Step

Proceed to P1.2B-18B only as a pure `EmailJobIdempotencyMigrationPlanBoundary` extraction. Keep it limited to data objects, validation helpers, and safe projections. Do not add SQL, migrations, DB access, queue access, `email_jobs` enforcement, `EmailJobsService` changes, worker changes, or production wiring.
