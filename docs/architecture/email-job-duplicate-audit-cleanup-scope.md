# Email Job Duplicate Audit / Cleanup Scope

## Summary

This audit is intentionally read-only.

Current `email_jobs` behavior has multiple write paths, no durable semantic idempotency key, heterogeneous metadata shapes, and worker-side status transitions that make duplicate cleanup a high-risk runtime concern if done directly in SQL or inside the live worker path.

The main findings are:

- Duplicate creation risk exists before SMTP delivery because lead and report jobs can be queued more than once without a semantic uniqueness boundary.
- Duplicate interpretation risk exists after SMTP delivery because `sent`, `queued`, `processing`, and `failed` rows can represent either true duplicates or partial-failure recovery state.
- Cleanup is materially safer only after duplicate classification is defined as a pure, read-only data model first.
- `P1.2B-19B` through `P1.2B-19E` are now implemented and production-validated as a pure helper and type layer for duplicate classification, cleanup planning, and audit-safe projections only.
- `P1.2B-20B` through `P1.2B-20E` and `P1.2B-21B` through `P1.2B-21E` are now implemented and production-validated as pure read-only query-plan and read-only audit-execution-boundary layers only.
- `P1.2B-22A` through `P1.2B-22E` are now implemented and production-validated as a docs-only approval decision gate plus pure approval-boundary layer only.

This document does not recommend any direct DB cleanup, SQL migration, worker refactor, or production behavior change in the current step.

## P1.2B-19 Status Update

`P1.2B-19B` through `P1.2B-19E` are implemented and production-validated. The safe scope held: `EmailJobDuplicateAuditPlanBoundary` builds only `DuplicateCandidate`, `DuplicateRiskGroup`, `CleanupEligibilityPolicy`, `DuplicateAuditPlan`, `CleanupPlan`, `ManualReviewDecision`, and `DuplicateAuditPlanResult` data objects plus validation helpers, result builders, classification helpers, and safe projections.

No runtime execution, SQL, DB reads, DB writes, `email_jobs` reads/writes/updates, duplicate cleanup, backfill, existing duplicate cleanup, hard delete, soft delete or mark-duplicate path, unique index, constraint, idempotency enforcement, `EmailJobsService.enqueue`, `EmailJobsService.processPendingJobs`, `processPendingJobs`, Orchestrator wiring, worker/SMTP changes, `report_runs` changes, webhooks, ToolExecutor/ToolDispatcher consolidation, IntegrationDispatcher change, production wiring, NOLIS-specific logic, or municipality-specific hardcoding was introduced.

Deferred areas remain deferred:

- Real `DB_READ_ONLY_AUDIT`.
- Read-only DB audit queries.
- SQL.
- `email_jobs` reads, writes, and updates.
- `webhook_jobs` reads, writes, and updates.
- Query runner.
- Query results.
- Reports with data.
- CSV or JSON exports.
- Duplicate cleanup.
- Existing duplicate cleanup.
- Backfill.
- Hard delete.
- Soft delete or mark duplicate.
- Unique index or constraint.
- Idempotency enforcement.
- `EmailJobsService.enqueue`.
- `EmailJobsService.processPendingJobs`.
- `processPendingJobs`.
- Orchestrator wiring.
- Worker and SMTP execution.
- `report_runs` synchronization.
- Webhooks.
- ToolExecutor/ToolDispatcher work.
- IntegrationDispatcher work.
- Production wiring.

## Current Duplicate Risk Sources

| Quelle / Pfad | Datei/Funktion | Potenzieller Duplicate-Typ | Ursache | Aktueller Schutz | Fehlender Schutz | Risiko |
| --- | --- | --- | --- | --- | --- | --- |
| Direct internal lead notification insert | `apps/api/src/chat/chat-agent-orchestrator.service.ts` `queueInternalLeadNotification` | Exact lead notification duplicate | Direct `INSERT INTO email_jobs` with random UUID only | Upstream lead completion state reduces some repeated completion flows | No semantic job key, no dedupe check, no shared enqueue policy | Hoch |
| Public widget lead capture enqueue | `apps/api/src/modules/widget/services/widget-leads.service.ts` `capture` -> `EmailJobsService.enqueue` | Exact lead notification duplicate | Lead capture can be replayed after lead persistence or caller retry | SMTP config check; queue error is isolated from lead save | No semantic job key, no enqueue dedupe, no source-specific conflict policy | Hoch |
| Tool-dispatcher lead capture enqueue | `apps/api/src/tools/tool-dispatcher.service.ts` `executeCaptureLead` -> `EmailJobsService.enqueue` | Exact lead notification duplicate | Lead row dedupe happens before queueing, but job creation itself remains non-idempotent | Session/email-based lead dedupe before queueing | No job-level dedupe, no shared idempotency key across paths | Mittel bis hoch |
| Manual report delivery enqueue | `apps/api/src/modules/widget/services/widget-admin-reports.service.ts` `runReport` -> `EmailJobsService.enqueue` | Report delivery duplicate | Repeated manual trigger creates a new `report_runs` row and queues another report mail | `reportRunId` is written into metadata for correlation | No semantic uniqueness rule at queue layer; no decision whether repeat trigger is intended or duplicate | Mittel bis hoch |
| Shared enqueue persistence | `apps/api/src/modules/widget/services/email-jobs.service.ts` `enqueue` | Cross-source semantic duplicate | Random UUID primary key is the only guaranteed unique field | Structural insert path is centralized for some callers | No semantic idempotency key, no unique constraint, no duplicate classification | Hoch |
| Fire-and-forget processing trigger plus cron fallback | `apps/api/src/modules/widget/services/email-jobs.service.ts` `enqueue`, `processPendingJobs` | Status-divergent duplicate or replay duplicate | Persistence and processing are coupled, but trigger success is not durable or observable to caller | `isProcessing` avoids same-process overlap; `FOR UPDATE SKIP LOCKED` limits same-row concurrent picks | No semantic dedupe, no stale-processing recovery, no post-send ambiguity policy | Hoch |
| Post-send status update and retry path | `apps/api/src/modules/widget/services/email-jobs.service.ts` `processJob` | Delivery duplicate after partial failure | SMTP send can succeed before DB status sync or related record sync fails | Retry counters and worker locking exist | No authoritative sent-vs-retry reconciliation key, no cleanup-safe conflict classification | Hoch |
| Heterogeneous metadata-only correlation | `email_jobs.metadata` across lead/report callers | False-positive or false-negative cleanup grouping | Correlation fields differ by source (`leadId`, `sessionId`, `agentRunId`, `reportRunId`, `leadEmail`, `frequency`) | Some callers include useful correlation identifiers | No normalized duplicate audit projection, no guaranteed required parts for all live rows | Hoch |

## Duplicate Categories

| Duplicate-Kategorie | Beschreibung | Moegliche Key-Parts | Beispiele aus Code | Risiko | Cleanup-Relevanz |
| --- | --- | --- | --- | --- | --- |
| Same lead notification | Same lead notification is queued more than once for the same recipient and notification intent | `siteId`, `leadId`, recipient fingerprint, `notificationType` | `queueInternalLeadNotification`, `WidgetLeadsService.capture`, `ToolDispatcherService.executeCaptureLead` | Hoch | Strong future audit candidate, but only after normalized recipient fingerprinting |
| Same contact request notification | Same contact request notification is recreated or queued twice | `siteId`, `contactRequestId`, recipient fingerprint, `notificationType` | Modeled in `email-job-idempotency.boundary.ts`; no dedicated live queue writer confirmed in this audit | Mittel bis hoch | Needs pure planning support before any runtime assumption |
| Same report delivery | Same report mail is queued multiple times for the same report run or semantic report event | `reportRunId`, recipient fingerprint, `deliveryType` | `WidgetAdminReportsService.runReport`, `metadata.reportRunId` | Mittel bis hoch | Best future pilot because `reportRunId` is the strongest existing correlation field |
| Same conversation delivery | Final conversation delivery or summary mail is recreated for the same conversation/session pair | `siteId`, `conversationId`, `sessionId`, recipient fingerprint, `deliveryType` | Modeled in `email-job-idempotency.boundary.ts`; not confirmed as a live queue writer in this audit | Mittel | Planning-only category today; do not infer live duplicates without explicit source |
| Same recipient plus subject/body hash | Content-equivalent mail may appear duplicated even when source IDs differ or are missing | Recipient fingerprint, normalized subject fingerprint, body fingerprint | Possible across generic `EmailJobsService.enqueue` callers | Hoch | Useful as weak audit evidence only, never as sole cleanup key |
| Same `metadata.reportRunId` | Multiple rows reference the same report run metadata | `reportRunId`, recipient fingerprint | Report path via `WidgetAdminReportsService.runReport` and `EmailJobsService.processJob` sync coupling | Mittel bis hoch | Good audit grouping rule, but still needs status-aware review |
| Same `siteId` plus source id plus recipient | Generic semantic duplicate cluster across heterogeneous metadata shapes | `siteId`, one source id (`leadId`, `contactRequestId`, `conversationId`, `reportRunId`), recipient fingerprint | Cross-path comparison between Orchestrator direct insert and service enqueue paths | Hoch | Good normalized cluster rule for future pure helper |
| Retry duplicate vs legitimate retry | A later row may represent an accidental recreate instead of a legitimate retry of the original row | Semantic key plus status timeline | `processJob` retry path versus caller replay or re-enqueue | Hoch | Requires cluster-level status analysis, not row-only logic |
| Failed job recreation | A failed row is followed by a new queued row for the same semantic delivery | Semantic key plus ordering marker | Possible after prior failed delivery attempts | Hoch | Manual review by default until explicit policy exists |
| Queued duplicate | Two queued rows exist for the same intended delivery | Semantic key plus `created_at` ordering | Any enqueue path without semantic dedupe | Mittel bis hoch | Potential future cleanup candidate, but only with strong correlation |
| Processing duplicate | One duplicate row is already in-flight | Semantic key plus `status='processing'` | Worker path after `pickNextJob` | Sehr hoch | Never auto-clean |
| Sent duplicate | At least one duplicate row is already marked sent | Semantic key plus `status='sent'` | Send success followed by replay, recreate, or ambiguous status-sync failure | Kritisch | Do not delete automatically |

## Cleanup Risk by Status

| Status | Cleanup-Risiko | Darf automatisch geloescht werden? | Erforderliche Pruefung | Empfehlung |
| --- | --- | --- | --- | --- |
| `queued` | Mittel | Nein, nicht pauschal | Strong semantic correlation, recipient fingerprint match, source-id match, no conflicting `processing`/`sent` row, clear winner in ordering | Only future manual-review-assisted or policy-backed cleanup consideration |
| `processing` | Sehr hoch | Nein | Worker lock state, stale-processing policy, send-in-flight ambiguity, retry implications | Always block automated cleanup |
| `sent` | Kritisch | Nein | Business decision, audit retention need, resend ambiguity, later failed or queued companions | Keep for audit; only marking strategies could be discussed later |
| `failed` | Hoch | Nein | Distinguish exhausted attempts from legitimate recreate or later successful resend | Preserve by default; manual review only |
| `unknown` or legacy/incomplete | Sehr hoch | Nein | Metadata completeness, source classification, status normalization confidence | Separate manual audit only |

## Future Read-only Duplicate Audit Design

The next safe step is still not DB cleanup.

`P1.2B-19` already delivered the pure duplicate-audit helper layer that classifies potential duplicate clusters without touching SQL, `EmailJobsService`, `processPendingJobs`, or production wiring.

The next safe planning step is a read-only duplicate query plan audit that still excludes SQL execution, production DB reads, `email_jobs` reads, cleanup, backfill, and enforcement.

Implemented `P1.2B-19B` shape:

- Add a pure module such as `apps/api/src/chat/email-job-duplicate-audit.boundary.ts`.
- Define normalized read-only types such as:
  - `EmailJobDuplicateAuditSource`
  - `EmailJobDuplicateAuditRecord`
  - `EmailJobDuplicateCluster`
  - `EmailJobDuplicateCategory`
  - `EmailJobDuplicateCleanupCandidate`
  - `EmailJobDuplicateConflictDecision`
- Accept only already-loaded, already-redacted record-like inputs.
- Normalize correlation fields into an audit projection:
  - source type
  - recipient hash or redacted identity
  - `siteId`
  - `leadId`
  - `contactRequestId`
  - `conversationId`
  - `sessionId`
  - `reportRunId`
  - delivery or notification type
  - status
  - created-at ordering marker
- Reuse existing idempotency boundary concepts for required parts instead of inventing a second correlation model.
- Produce only classification and plan outputs:
  - `exact_duplicate_candidate`
  - `manual_review_required`
  - `safe_to_keep_only`
  - `cleanup_blocked`
  - `insufficient_correlation`
- Expose only log-safe and audit-safe projections.

This keeps `P1.2B-19B` aligned with the existing P1.2B pattern: pure types, validation helpers, projections, and tests only.

## Cleanup Plan Options

| Option | Vorteil | Risiko | DB-Auswirkung | Rollback | Empfehlung |
| --- | --- | --- | --- | --- | --- |
| No Cleanup, only idempotency forward fix | Lowest immediate runtime risk | Existing duplicates remain unresolved and can block later backfill planning | None in this step | Trivial because nothing is changed | Safe baseline if no audit helper is approved |
| Manual Review Cleanup | Safest real cleanup conceptually because humans decide edge cases | Operationally expensive and slow | Would require later read-only query/export support | Rollback depends on what later cleanup action is chosen | Better than automation once a sanitized audit exists |
| Queued-only safe cleanup | Could reduce future duplicate sends before delivery | False correlation can remove the only valid pending row | Would require future DB read and later write/delete decision | Weak unless backup and explicit selection log exist | Not for `P1.2B-19B`; later only with strong semantic key |
| Failed-only cleanup | Can reduce noise from exhausted duplicate failures | Can destroy failure history and hide recreate intent | Would require future DB read and later delete/mark action | Poor unless audit snapshot exists | Not recommended as an early cleanup phase |
| Sent duplicate marking, no deletion | Preserves history while flagging risk clusters | Still needs schema or side-channel representation and clear review semantics | Requires future schema or audit output layer, but not necessarily deletion | Better than hard delete if such a model exists later | Potential later option, not current scope |
| Soft-delete or mark duplicate | Lower blast radius than hard delete if schema exists | Current schema has no such state; can still confuse worker/report logic | Requires schema change or companion table | Needs migration rollback plan | Deferred until schema work is explicitly approved |
| Hard-delete | Operationally simple after a decision is made | Highest chance of irreversible data loss or duplicate resend ambiguity | Requires direct DB mutation | Not meaningfully rollbackable without prior backup/export | Not recommended |

## Proposed Boundary Services

Recommended future modules, all pure and non-runtime in their first iteration:

| Boundary-Service | Zweck | Zulaessig in `P1.2B-19B` | Anmerkung |
| --- | --- | --- | --- |
| `EmailJobDuplicateAuditPlanBoundary` | Defines duplicate candidate, risk group, cleanup eligibility, and audit plan data objects | Ja | Best fit for the next step |
| `EmailJobDuplicateCleanupPlanBoundary` | Defines cleanup plan, manual review decision, and rollback requirement data objects | Ja | Still pure, no DB writes |
| `EmailJobDuplicateAuditRepository` | Would later encapsulate actual read-only DB queries | Nein | Separate DB-read approval required |
| `EmailJobDuplicateCleanupRunner` | Would later perform actual cleanup actions | Nein | Separate runbook, backup, and approval required |

## Implemented P1.2B-19B Scope

Implemented safe scope:

- `EmailJobDuplicateAuditPlanBoundary` interface and types
- `DuplicateCandidate` data objects
- `DuplicateRiskGroup` data objects
- `CleanupEligibilityPolicy` data objects
- `DuplicateAuditPlan` data objects
- `CleanupPlan` data objects
- `ManualReviewDecision` data objects
- Validation helpers
- no-op, blocked, and failed helper builders
- log-safe and audit-safe duplicate audit projections
- focused unit tests only

Still not allowed in `P1.2B-19B`:

- DB reads
- SQL
- any `email_jobs` reads, writes, or updates
- cleanup
- backfill
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService.enqueue` changes
- `processPendingJobs` changes
- orchestrator wiring
- production wiring

## Required Tests

Future `P1.2B-19B` tests should cover at least:

- Duplicate candidate validation:
  - lead duplicate candidate valid
  - report duplicate candidate valid
  - contact duplicate candidate valid
  - missing source id blocked
  - missing recipient fingerprint blocked
  - raw recipient email not safe
- Risk group classification:
  - queued risk group
  - processing risk group
  - sent risk group
  - failed risk group
  - unknown status forces manual review or blocked result
- Cleanup eligibility:
  - sent not auto-cleanable
  - processing not auto-cleanable
  - queued requires strong semantic key
  - failed requires manual review
  - unknown remains blocked
- Audit plan safety:
  - aggregate-only output
  - PII-safe output
  - no SQL generated
  - no DB dependency
- No side effects:
  - no DB client import
  - no SQL strings
  - no `email_jobs`
  - no cleanup execution
  - no logger output with raw PII
  - no `process.env`
  - no `EmailJobsService`
  - no `processPendingJobs`

## Non-goals

Non-goals for `P1.2B-19` at this stage:

- no DB reads
- no DB writes
- no SQL execution
- no production DB query
- no `email_jobs` reads, writes, or updates
- no duplicate cleanup
- no backfill
- no hard delete
- no soft delete or mark duplicate
- no unique index
- no constraint
- no idempotency enforcement
- no `EmailJobsService.enqueue` refactor
- no `processPendingJobs` refactor
- no orchestrator wiring
- no production wiring
- no migration
- no feature flags
- no public widget response change
- no live conversation-engine activation
- no customer-site mutation
- no NOLIS-specific logic

## Recommended Next Step

`P1.2B-20A` through `P1.2B-20E`, `P1.2B-21B` through `P1.2B-21E`, and `P1.2B-22A` through `P1.2B-22E` are complete and production-validated.

The next safe step is `P1.2B-23A` as a docs-only staging-read scope / approval-preconditions task.

That next step should decide only:

- whether a real `DB_READ_ONLY_AUDIT` is approved
- which environment is allowed first
- which read-only role is required
- which query classes are allowed
- which outputs are allowed
- which stop criteria are mandatory

`P1.2B-23A` should still exclude:

- code changes
- DB reads
- SQL
- query runner
- `email_jobs` reads, writes, or updates
- query results
- reports with live row data
- cleanup
- backfill
- unique index or constraint work
- idempotency enforcement
- `EmailJobsService.enqueue` refactor
- `processPendingJobs` refactor
- orchestrator wiring
- production wiring

## Idempotency Enforcement Interaction

Duplicate cleanup and idempotency enforcement are related but not interchangeable.

Current interaction model:

- `apps/api/src/chat/email-job-idempotency.boundary.ts` already defines the semantic parts that a future key candidate should use.
- `apps/api/src/chat/email-job-idempotency-migration-plan.boundary.ts` already models migration phases, enforcement points, and duplicate conflict policies.
- Live `email_jobs` rows do not yet persist a durable semantic key.
- Cleanup without the future key model risks grouping rows incorrectly.

Implications:

- `P1.2B-19B` should align duplicate categories with the existing idempotency source model:
  - `lead_notification`
  - `contact_request`
  - `conversation_delivery`
  - `report_delivery`
  - `generic_email_delivery`
- Future duplicate audit helpers should reuse the same required-parts expectations where possible.
- Cleanup decisions should remain projections only until the idempotency roadmap decides whether the effective enforcement point is:
  - caller-side
  - `EmailJobsService.enqueue`
  - direct internal lead notification insert
  - report delivery enqueue
  - worker path
  - database constraint

In short: duplicate audit should prepare the classification vocabulary for the idempotency roadmap, not preempt it with runtime cleanup.

## Privacy and PII Boundaries

Any duplicate audit or cleanup planning must treat email job data as sensitive.

Sensitive fields in live paths include:

- `recipient_email`
- rendered `html`
- rendered `text`
- `metadata.leadEmail`
- error text in `last_error`
- recipient fields currently present in some logs

Required boundaries for future read-only helpers:

- No raw HTML or text body in audit outputs.
- No raw recipient email in audit outputs.
- Prefer recipient hash or redacted recipient identity only.
- No copying of provider error strings beyond safe classification labels.
- No SQL snippets, live samples, or ad hoc exports in docs/tests that expose PII.
- Reuse existing safe projection patterns from:
  - `email-job-idempotency.boundary.ts`
  - `email-delivery-executor.boundary.ts`
  - `email-job-persistence.boundary.ts`
  - `email-job-processing-trigger.boundary.ts`

The privacy requirement is not optional. Any future duplicate audit helper that outputs raw recipient or message content would fail the existing P1.2B boundary standard.

## Rollout and Rollback Considerations

For the current audit step, rollout is documentation only and rollback is trivial.

For the recommended `P1.2B-19B` pure helper step:

- Rollout should be code-plus-tests only.
- No production wiring.
- No feature flags needed because no runtime behavior changes.
- No DB reads or writes added.
- No admin UI, public widget, or worker integration.
- Rollback is simple file removal or revert of pure helper/test files.

For any later runtime or DB phase, a separate scope would still be required for:

- duplicate discovery against real rows
- manual review workflow
- cleanup execution
- idempotency key persistence
- backfill
- unique index strategy
- rollback of DB enforcement

## Existing Builders and Boundaries

The current repo already contains the right kind of pure building blocks. The missing part is duplicate classification, not another runtime execution path.

| Baustein | Datei | Relevanz fuer Duplicate Audit | Laufzeit-Side-Effects |
| --- | --- | --- | --- |
| `EmailQueueWriteBoundary` | `apps/api/src/chat/email-queue-write.boundary.ts` | Defines normalized queue-write request/result shape before persistence | Keine |
| `EmailJobPersistenceBoundary` | `apps/api/src/chat/email-job-persistence.boundary.ts` | Defines persistence request/result shape and safe projections | Keine |
| `EmailJobProcessingTriggerBoundary` | `apps/api/src/chat/email-job-processing-trigger.boundary.ts` | Separates processing-trigger request/result planning from execution | Keine |
| `EmailJobStatusPolicyBoundary` | `apps/api/src/chat/email-job-status-policy.boundary.ts` | Documents lifecycle and retry semantics needed for cleanup risk classification | Keine |
| `EmailJobWorkerBoundary` | `apps/api/src/chat/email-job-worker.boundary.ts` | Models worker selection and transition plans without executing them | Keine |
| `EmailJobIdempotencyBoundary` | `apps/api/src/chat/email-job-idempotency.boundary.ts` | Best existing source for semantic correlation parts and redaction strategy | Keine |
| `EmailJobIdempotencyMigrationPlanBoundary` | `apps/api/src/chat/email-job-idempotency-migration-plan.boundary.ts` | Best existing source for future enforcement points and conflict vocabulary | Keine |
| `DeliveryPayloadBuilder` and related delivery boundaries | `apps/api/src/chat/lead-capture.builders.ts`, `apps/api/src/chat/email-delivery-executor.boundary.ts` | Helpful precedent for pure data-model layering | Keine |

Recommended boundary rule:

- Duplicate audit should extend this pure-layer family.
- Duplicate audit should not jump ahead into service wiring, worker changes, SQL cleanup, or production enforcement.

## Safe / Unsafe Scope

Safe scope for `P1.2B-19B`:

- Add a pure duplicate-audit boundary or helper module.
- Add pure types for duplicate records, clusters, conflict states, and cleanup candidates.
- Add normalization helpers that consume already-provided record-like input only.
- Add classification helpers for duplicate categories and cleanup risk.
- Add safe projection helpers for logs, docs, and tests.
- Add unit tests proving:
  - no DB access
  - no SQL strings
  - no `EmailJobsService.enqueue`
  - no `processPendingJobs`
  - no SMTP or worker dependency
  - no raw PII in projections
- Optionally add a companion audit doc update if needed.

Unsafe or deferred scope:

- Any direct read or write of `email_jobs`
- Any SQL query, report, migration, or cleanup script
- Any deletion, merge, rewrite, or status update of duplicate rows
- Any `EmailJobsService.enqueue` refactor
- Any `processPendingJobs` change
- Any worker, retry, locking, or SMTP behavior change
- Any `report_runs` synchronization change
- Any backfill, unique constraint, partial index, or schema migration
- Any orchestrator/runtime wiring
- Any production config, deploy, or feature flag work
