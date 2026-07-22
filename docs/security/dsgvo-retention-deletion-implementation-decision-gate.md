# DSGVO Retention / Deletion Implementation Decision Gate

Stand: 2026-07-22

## 1. Summary

This document is a documentation-only retention / deletion implementation decision gate for Enterprise Pilot readiness.

Purpose:

- decide whether any real retention, deletion, erasure, anonymization, redaction, suppression, cleanup, backfill, or enforcement implementation is approved now
- document which preconditions are already covered by `DSGVO-1A` through `DSGVO-1F`
- document which approvals, owner roles, safety controls, and follow-up decisions are still missing
- define which future implementation paths may later become candidates and which areas remain blocked
- provide an explicit approval format for any later retention / deletion implementation task

This step is intentionally `DOKU_ONLY`.

This gate does not:

- implement any retention logic
- implement any deletion logic
- implement any anonymization logic
- implement any redaction execution path
- implement any suppression execution path
- execute any cleanup, backfill, or enforcement
- read any database
- execute SQL
- use a query runner
- generate any report with data
- execute any DSAR request
- generate any export
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This document is a technical implementation decision gate, not legal advice and not a final compliance release.

## 2. Decision Summary

Current implementation decision:

- retention implementation approved: `no`
- deletion implementation approved: `no`
- hard delete approved: `no`
- soft delete approved: `no`
- anonymization approved: `no`
- redaction execution approved: `no`
- suppression execution approved: `no`
- cleanup approved: `no`
- backfill approved: `no`
- enforcement approved: `no`
- `DB_READ_ONLY_AUDIT` approved: `no`
- query runner approved: `no`
- reports with data approved: `no`
- production data approved: `no`
- production secrets approved: `no`
- human approval granted: `no`

Decision rationale:

- no explicit human approval for retention or deletion implementation exists in this task
- no final legally reviewed retention windows are documented
- no confirmed identity-, tenant-, and subject-discovery pipeline is documented for safe real execution
- no confirmed deletion owner, privacy owner, legal owner, or product owner chain is fully documented for live implementation
- no approved `DB_READ_ONLY_AUDIT` exists for discovery of real data placement
- no approved query runner exists
- no approved reports with data exist
- no final legal review is documented
- no final product review is documented
- no final security review is documented
- no approved implementation plan exists with dry-run preview, rollback, irreversibility, and evidence controls
- backups, logs, jobs, and report-linked data remain high-risk

## 3. Current Baseline And Repo-Evident Inputs

The following documentation building blocks exist and are treated as completed inputs to this gate:

- `DSGVO-1A` PII Data Map
- `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit
- `DSGVO-1C` DSAR / Privacy Export Safety Design
- `DSGVO-1D` Retention and Deletion Policy Design
- `DSGVO-1E` DSAR Export Schema Design
- `DSGVO-1F` DSAR Execution Decision Gate

Current baseline from prior steps:

- `origin/main` baseline for this gate is `809457bc752f4bf4fe6609c62c80dc6d47101c63`
- `production-context audit`: `PASS`
- the former `sharp` High blocker remains resolved
- the known `postcss` finding remains at most moderate and non-blocking
- no real production-data, production-secret, query-runner, report, export, deletion, or retention execution approval has been granted
- `DB_READ_ONLY_AUDIT` remains blocked without explicit human approval

Repo-visible technical and documentation surfaces that matter for future retention / deletion planning, but are not approved for use by this gate:

- retention logic in `apps/api/src/retention/retention.service.ts`
- site export and delete logic in `apps/api/src/site-data/site-data-export.service.ts`
- conversation export and deletion surfaces in `apps/api/src/conversations/conversations.controller.ts`
- site-level delete logic in `apps/api/src/sites/sites.service.ts`
- widget lead export surfaces in `apps/api/src/modules/widget/controllers/widget-admin.controller.ts`
- dashboard proxy export surfaces in:
  - `apps/dashboard/app/api/conversations/export/route.ts`
  - `apps/dashboard/app/api/widget/leads/export/route.ts`
- repo-visible data classes in migrations such as:
  - `conversations`
  - `messages`
  - `widget_sessions`
  - `widget_events`
  - `widget_leads`
  - `agent_contact_requests`
  - `tenant_users`
  - `email_jobs`
  - `webhook_jobs`
  - `report_runs`
  - `usage_events`
  - `usage_daily`
  - `audit_logs`

These surfaces are evidence that implementation-relevant data and delete/export/retention-adjacent paths exist in the codebase.
They are not treated as approved implementation or execution paths by this document.

## 4. Current Preconditions Review

| Precondition | Required For Implementation | Current Status | Decision Impact |
| --- | --- | --- | --- |
| `DSGVO-1A` PII Data Map exists | data-class scoping | `yes` | baseline exists |
| `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit exists | purpose and gap framing | `yes` | baseline exists |
| `DSGVO-1C` DSAR / Privacy Export Safety Design exists | export and privacy safety boundaries | `yes` | baseline exists |
| `DSGVO-1D` Retention and Deletion Policy Design exists | retention/deletion policy framing | `yes` | baseline exists |
| `DSGVO-1E` DSAR Export Schema Design exists | export-shape and omission boundaries | `yes` | baseline exists |
| `DSGVO-1F` DSAR Execution Decision Gate exists | execution gate baseline | `yes` | baseline exists |
| final retention windows approved | live retention implementation | `no` | implementation blocked |
| legal review completed | lawful implementation decision | `no` | implementation blocked |
| product review completed | product behavior and operator UX safety | `no` | implementation blocked |
| security review completed | scope, log, secret, and abuse safety | `no` | implementation blocked |
| privacy owner confirmed | privacy approval chain | `not_proven_here` | implementation blocked until explicit confirmation |
| deletion owner confirmed | deletion workflow ownership | `not_proven_here` | implementation blocked until explicit confirmation |
| data discovery method approved | subject/tenant/site discovery before action | `no` | implementation blocked |
| `DB_READ_ONLY_AUDIT` approved | any real data discovery in DB | `no` | implementation blocked |
| query runner approved | any query-based discovery or preview | `no` | implementation blocked |
| reports with data approved | any evidence/report output from real data | `no` | implementation blocked |
| dry-run preview design approved | safe preview before destructive action | `no` | implementation blocked |
| rollback / irreversibility model approved | safe handling of hard-to-reverse actions | `no` | implementation blocked |
| evidence logging approved | accountable and sanitized execution evidence | `no` | implementation blocked |
| backup retention exception model approved | backups and erasure conflict handling | `no` | implementation blocked |
| legal hold model approved | legal-hold override behavior | `no` | implementation blocked |
| external processor deletion coordination approved | downstream processor handling | `no` | implementation blocked |

Interpretation:

- documentation prerequisites are largely in place
- implementation prerequisites are not in place
- real implementation remains blocked

## 5. Implementation Decision Matrix

| Implementation Area | Decision | Reason | Required Before Approval |
| --- | --- | --- | --- |
| final retention window enforcement | `no` / `blocked` | no final legally reviewed windows exist | legally reviewed window set plus owner approval chain |
| hard delete | `no` / `blocked` | irreversibility and scope controls are not approved | irreversibility review, owner approvals, and preview path |
| soft delete | `no` / `blocked` | behavior, restore semantics, and downstream effects are undefined | product and security review plus lifecycle definition |
| anonymization | `no` / `blocked` | no approved anonymization model or reversibility assessment | approved field model and evidence strategy |
| redaction | `no` / `blocked` | no approved redaction model for real payload-bearing data | approved content classes and redaction rules |
| suppression | `no` / `blocked` | no approved processing-stop workflow | policy and owner approval for restriction/objection handling |
| delivery restriction | `no` / `blocked` | live delivery-state interaction is not approved | delivery owner review and downstream safety design |
| `email_jobs` cleanup | `no` / `blocked` | delivery state, retries, and idempotency risk remain high | separate queue-data and delivery-state decision |
| `webhook_jobs` cleanup | `no` / `blocked` | external payload, replay, and signing risk remain high | integration/security/privacy review and processor model |
| `report_runs` cleanup | `no` / `blocked` | derived-PII and reporting evidence handling unclear | report-data boundary and retention policy approval |
| logs redaction/deletion | `no` / `blocked` | audit/security evidence and hold risk unresolved | legal-hold and security-log policy approval |
| backup deletion/expiration | `no` / `blocked` | backup-content handling remains separately approval-bound | backup exception model and SRE/privacy/legal alignment |
| external processor deletion coordination | `no` / `blocked` | no approved provider-specific coordination path exists | processor inventory, DPA review, and owner chain |
| legal hold / incident hold workflow | `future design only` | hold logic is recognized but not finalized | explicit hold taxonomy and decision owner model |
| evidence logging | `future design only` | execution evidence shape exists only conceptually | approved sanitized evidence schema and retention policy |
| dry-run preview | `future design only` | preview is required but not yet approved or implemented | preview design, safe outputs, and approval gate |

## 6. Allowed Future Implementation Candidate

Potential future task name:

`DSGVO-1G-EXEC Local Synthetic Retention / Deletion Dry Run`

Maximum allowed scope for that future task:

- local or disposable environment only
- synthetic, schema-only, or fixture-only data only
- no production data
- no production secrets
- no staging data unless separately approved
- no `DB_READ_ONLY_AUDIT`
- no production DB access
- no production backup content
- no query runner
- no reports with data
- no `email_jobs`, `webhook_jobs`, or `report_runs` real data
- no external delivery
- no SMTP
- no webhooks
- no customer site mutation
- no actual data-subject response
- no real requester data
- no irreversible deletion
- no legal final compliance claim

This gate does not approve that task.
This gate only documents it as a future candidate.

## 7. Explicit Approval Format For Future Implementation

Example approval text for a later synthetic-only implementation task:

> Ich gebe DSGVO-1G-EXEC Local Synthetic Retention / Deletion Dry Run frei, ausschließlich in einer lokalen/disposable Non-production-Umgebung, ausschließlich mit synthetic/schema-only/fixture Daten, ohne Production-Daten, ohne Production-Secrets, ohne Staging-Daten, ohne DB_READ_ONLY_AUDIT, ohne Production-DB-Zugriff, ohne Query Runner, ohne Reports mit Daten, ohne email_jobs/webhook_jobs/report_runs Reads/Writes auf echten Daten, ohne Backup-Content, ohne externe Delivery-/SMTP-/Webhook-Ausführung, ohne irreversible Löschung, ohne Deploy.

Important:

- this example is not an approval granted by the current task
- human approval status remains `not_granted`
- any future approval must still be checked against the exact requested scope and environment

## 8. Approval Status Matrix

| Approval Area | Status | Required Before Implementation | Notes |
| --- | --- | --- | --- |
| `privacy_owner_approval` | `not_granted` | explicit privacy owner approval | not proven by current repo state |
| `deletion_owner_approval` | `not_granted` | explicit deletion workflow owner approval | not proven by current repo state |
| `legal_review` | `not_granted` | explicit legal review completion | this document is not legal advice |
| `product_review` | `not_granted` | explicit product review of operator and subject-facing behavior | required before implementation |
| `security_review` | `not_granted` | explicit security review of scope, logs, secrets, and side effects | required before implementation |
| `human_operator_approval` | `not_granted` | exact human approval text for the candidate scope | absent in this task |
| `DB_READ_ONLY_AUDIT` | `not_granted` | separate explicit approval | still blocked |
| `query_runner_approval` | `not_granted` | separate explicit approval | still blocked |
| `report_generation_approval` | `not_granted` | separate explicit approval | still blocked |
| `production_data_access` | `blocked` | explicit approval plus approved execution scope | production data remains blocked |
| `production_secret_access` | `blocked` | explicit security approval | secrets remain blocked |
| `backup_content_access` | `blocked` | explicit privacy, security, and operator approval | backup content remains blocked |
| `legal_hold_review` | `not_granted` | approved hold taxonomy and decision owners | missing |
| `dry_run_preview_approval` | `not_granted` | approved preview model and safe output policy | missing |
| `rollback_irreversibility_review` | `not_granted` | explicit rollback and irreversibility review | missing |
| `evidence_logging_approval` | `not_granted` | approved evidence schema and retention model | missing |
| `external_processor_coordination_approval` | `not_granted` | approved provider-coordination path | follow-up only |

## 9. Data Class Decision

| Data Class | Decision | Reason | Future Path |
| --- | --- | --- | --- |
| synthetic dummy data | `future candidate only` | safe for non-production shape checks | local synthetic dry run only |
| schema-only data | `future candidate only` | no real values | local schema validation only |
| generated fixture data | `future candidate only` | safe if isolated and disposable | local dry run only |
| sanitized non-production data | `conditional` | still requires approval and proof of sanitization | separate approval task |
| staging data | `blocked_without_approval` | staging may still contain sensitive real-like data | separate staging gate |
| production data | `blocked` | no production-data approval | not allowed |
| customer/tenant data | `blocked` | no real customer-data handling approved | not allowed |
| conversation/session data | `blocked` | free text and session linkage can expose PII | only after subject-scope approval |
| leads/contact data | `blocked` | direct identifiers and free text are high-risk | only after identity and scope approval |
| `email_jobs` | `blocked` | delivery internals and payload risk | separate queue-data decision |
| `webhook_jobs` | `blocked` | payload, recipient, and signing risk | separate webhook-data decision |
| `report_runs` | `blocked` | report metadata and derived-PII risk | separate reporting decision |
| logs/audit | `blocked` | operational and security sensitivity | only summarized/redacted future path after approval |
| backups/offsite | `blocked` | backup content remains high-risk | separate backup gate |
| incident docs | `blocked` | may carry operational and legal-hold-sensitive details | separate legal/security decision |
| DSAR evidence records | `conditional` | evidence is needed later but no approved schema or window exists | separate evidence design approval |
| secrets/credentials | `blocked` | never valid implementation input or output in this scope | no allowed path |

## 10. Operation Envelope Decision

Allowed only in a future explicitly approved local synthetic dry run:

- local fixture loading
- local schema-only mock deletion preview
- local validation of retention rule shape
- local validation of redaction or anonymization rule shape
- local validation of suppression-flag behavior on placeholders
- local evidence-record shape checks without real data

Still forbidden:

- production DB reads
- staging or production SQL
- query runner usage
- reports with data
- production logs
- backup content access
- `email_jobs`, `webhook_jobs`, or `report_runs` reads, writes, or updates on real data
- `pg_dump`
- `pg_restore`
- `psql`
- `docker exec` against production
- `docker compose` against production
- external delivery
- SMTP or email send
- webhook delivery
- irreversible deletion
- cleanup, backfill, or enforcement
- deploy

## 11. Required Evidence Before Any Future Implementation

Any future implementation request must document at least:

- task identifier
- explicit human approval text
- target environment
- data class involved
- proof that only approved non-production data is in scope
- responsible owner roles
- final or candidate retention rule being evaluated
- identity / tenant / site / subject discovery model
- allowed operation classes
- forbidden operation classes
- dry-run preview expectations
- rollback / irreversibility assessment
- expected validation signals
- cleanup and disposal plan
- log-sanitization plan
- confirmation that no reports with data will be produced unless separately approved
- confirmation that no secrets will be opened
- confirmation that no cross-tenant handling is possible
- abort criteria
- candidate evidence-retention model

## 12. Identity / Tenant / Scope Gate

Real deletion, anonymization, redaction, or suppression must remain blocked until:

- identity and subject-matching rules are explicitly defined
- tenant and site scoping rules are explicitly defined
- wildcard subject matching is forbidden
- ambiguous identifiers block execution
- support and operator roles cannot bypass scope requirements
- cross-tenant operations remain forbidden
- no real requester data is stored in repository documentation or PR artifacts

## 13. Dry-Run Preview Gate

Any future implementation path must support a preview before destructive action:

- the preview must not expose query results with data
- the preview must not place customer data into PRs, docs, logs, or issue comments
- the preview must identify included and excluded data areas by category, not by customer value
- the preview must include explicit stop conditions
- the preview must require owner approval before execution continues

No preview is executed in this task.

## 14. Irreversibility / Rollback Gate

Future implementation must explicitly classify reversibility:

- hard delete may be irreversible
- anonymization may be irreversible
- redaction may be irreversible
- soft delete may be reversible only if that behavior is intentionally implemented and reviewed
- backup restore is not a valid deletion rollback strategy without privacy, legal, and security approval
- rollback and undo limitations must be documented before any future execution

No rollback path is tested in this task.

## 15. Jobs / Delivery Gate

High-risk delivery areas remain blocked:

- no `email_jobs` cleanup is approved
- no `webhook_jobs` cleanup is approved
- deletion must not re-trigger delivery
- deletion must not break retry assumptions
- deletion must not break idempotency
- delivery-state and retry-state handling require product and security review
- no SMTP or webhook execution is approved

## 16. Reports / Analytics Gate

Report and analytics handling remains blocked by default:

- no `report_runs` cleanup is approved
- no reports with data are approved
- derived PII handling requires separate design and approval
- aggregates are only future candidates if they are provably non-identifying and separately approved
- query runner remains blocked

## 17. Logs / Audit / Incident Gate

Operational evidence remains restricted:

- no production logs are queried in this task
- no log deletion is approved
- no log redaction execution is approved
- a dedicated redaction policy is required before future implementation
- security and audit retention may require longer windows than ordinary business data
- legal hold and incident hold can override ordinary deletion candidates

## 18. Backup / Offsite Gate

Backup and offsite areas remain separately blocked:

- no backup content access is approved
- no backup deletion is approved
- backup retention may conflict with primary-data erasure timing
- offsite retention requires a separate decision
- production backup data remains blocked
- future backup-verification or restore-related work must stay behind separate SRE and privacy gates

## 19. External Processor Gate

No processor-side actions are approved:

- no provider requests are sent
- no provider portal is accessed
- no processor deletion or export coordination is executed
- no customer-owned endpoint is contacted
- processor and DPA status remain follow-up work
- third-party retention remains follow-up work

## 20. Stop Criteria For Future Implementation

Any future implementation task must stop immediately if:

- identity or scope design is missing
- the responsible owner chain is missing
- legal, product, or security review is missing
- production data would be required
- production secrets would be required
- `DB_READ_ONLY_AUDIT` would be required but is not approved
- query runner usage would be required
- reports with data would be required
- raw logs would be required
- backup content would be required
- `email_jobs`, `webhook_jobs`, or `report_runs` raw payload handling would be required
- cross-tenant risk is unresolved
- legal-hold status is unknown
- rollback or irreversibility is unknown
- DSAR or export dependency is unclear
- real requester data would enter the repo, PR, or docs
- secrets would enter output
- new High or Critical security findings are open

## 21. Pilot Go / No-Go Impact

This gate improves Enterprise Pilot readiness because it:

- makes the current non-approval state explicit
- prevents accidental escalation from policy design into real implementation
- records which preconditions are already documented
- records which controls are still missing before any live deletion or retention implementation could start

This gate does not approve implementation.

Current pilot implication:

- privacy readiness improves through clearer boundaries
- implementation remains blocked
- pilot privacy posture remains yellow or blocked for any deletion/retention execution claim until:
  - owner chain is confirmed
  - retention windows are legally reviewed
  - identity and scope design are approved
  - dry-run preview design is approved
  - rollback and irreversibility model is approved
  - backup, log, job, report, and processor handling are approved
  - no High or Critical security blockers are open
  - `DB_READ_ONLY_AUDIT` remains explicitly not granted unless separately approved

## 22. Relationship To Existing And Future Steps

- `DSGVO-1A` = PII Data Map baseline
- `DSGVO-1B-R` = processing purpose / retention / DSAR gap baseline
- `DSGVO-1C` = DSAR / privacy export safety boundary
- `DSGVO-1D` = retention / deletion policy design
- `DSGVO-1E` = DSAR export schema design
- `DSGVO-1F` = DSAR execution decision gate
- `DSGVO-1G` = retention / deletion implementation decision gate
- `DSGVO-1G-EXEC` = future synthetic-only candidate, not approved here
- `DSGVO-1H` = possible next DSAR-export implementation planning step

## 23. Recommended Next Step

Recommended next step depends on intent:

- if the goal is broader pilot risk reduction:
  - `ENT-SEC-1A Enterprise Security Gap Audit`
- if the goal is DSAR/export planning:
  - `DSGVO-1H DSAR Export Implementation Plan`
- if the goal is limited retention/deletion design validation without real data:
  - `DSGVO-1G-EXEC Local Synthetic Retention / Deletion Dry Run`
  - only after explicit human approval in the exact approved wording style

No automatic implementation recommendation is granted by this gate.

## 24. Hard Non-Goals

This gate does not:

- provide legal advice
- provide a final compliance assessment
- implement retention
- implement deletion
- implement erasure
- implement anonymization
- implement redaction
- implement suppression
- execute cleanup, backfill, or enforcement
- read any database
- execute SQL
- use a query runner
- generate any report with data
- generate any DSAR or privacy export artifact
- open backups
- inspect production logs
- access production data
- access production secrets
- change runtime code
- change production config
- deploy anything
- mutate the public widget
- mutate any customer site
