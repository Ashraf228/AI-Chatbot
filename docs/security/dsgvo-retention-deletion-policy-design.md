# DSGVO Retention and Deletion Policy Design

Stand: 2026-07-22

## 1. Summary

This document is a documentation-only retention and deletion policy design for Enterprise Pilot readiness.

Purpose:

- define which repository-visible data classes need retention rules
- define which deletion, erasure, anonymization, redaction, suppression, and hold patterns are likely needed later
- document which surfaces must not be deleted blindly
- document which data classes require legal, product, security, privacy, or implementation follow-up before any real retention or deletion action is allowed
- constrain later implementation and approval tasks before any real deletion, retention cleanup, DSAR execution, export generation, correction, or backup-derived handling can happen

This step is intentionally `DOKU_ONLY`.

This design does not:

- read any database
- execute SQL
- use a query runner
- read production or staging logs
- generate reports
- execute a DSAR request
- generate an export
- execute deletion, correction, or retention actions
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This document is a technical policy design, not legal advice and not a final compliance release.

## 2. Scope

Scope of analysis:

- read-only review of repository documentation under `docs/security`, `docs/operations`, `docs/architecture`, `docs/legal`, and `docs/ops`
- read-only review of relevant API, dashboard, widget, reporter, package, DTO, controller, migration, retention, export, delete, audit, and backup-related code paths
- build on `DSGVO-1A` PII Data Map
- build on `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit
- build on `DSGVO-1C` DSAR / Privacy Export Safety Design
- document only technical categories, policy directions, risks, blocking conditions, and required follow-up work

Out of scope:

- production data analysis
- staging data analysis
- raw logs
- processor-portal access
- query results
- reports with data
- exports
- deletion execution
- correction execution
- retention execution
- implementation changes

## 3. Retention Classification Model

### Policy direction labels

- `retain_until_purpose_complete`
  - retain while the repository-visible business or operational purpose is still active
- `retain_for_security_audit_window`
  - retain for a candidate operational or evidentiary security window
- `retain_for_delivery_window`
  - retain for a candidate delivery, retry, reconciliation, or failure-analysis window
- `retain_for_support_window`
  - retain for a candidate support, troubleshooting, or incident follow-up window
- `retain_for_legal_or_contract_review`
  - retain only after legal, contractual, or governance review defines the window
- `delete_or_anonymize_after_window`
  - likely eligible for deletion or anonymization after a candidate window, but not yet approved
- `blocked_until_policy_defined`
  - real retention or deletion behavior must remain blocked until a narrower policy exists
- `blocked_without_approval`
  - live handling remains blocked even if the data class is known
- `unknown_requires_follow_up`
  - repository evidence is insufficient to define a safe policy direction

### Deletion action types

- `no_action_now`
  - no deletion or retention action is executed in this task
- `soft_delete_candidate`
  - a future reversible delete state may be safer than hard delete
- `hard_delete_candidate`
  - a future hard delete may be acceptable only where safety and approvals are clear
- `anonymization_candidate`
  - a future identity-removal path may be safer than deletion for some surfaces
- `redaction_candidate`
  - a future partial field-removal or content-redaction path may be safer than row deletion
- `suppression_candidate`
  - a future processing stop or downstream-delivery stop may be more appropriate than deletion
- `legal_hold_sensitive`
  - deletion can be overridden by security, incident, contractual, or legal hold needs
- `backup_retention_exception_needed`
  - backup or offsite handling requires its own exception path
- `requires_product_decision`
  - product behavior must be defined before safe retention/deletion design exists
- `requires_legal_review`
  - legal, contractual, or privacy review is required before a real rule can be treated as approved
- `requires_implementation`
  - current repository evidence is not enough without new engineering work

## 4. Retention Inventory By Data Area

| Data Area | Possible Data | Current Evidence | Proposed Retention Policy Direction | Deletion Action Type | Risk | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| public widget sessions | `visitor_id`, `session_id`, `source_url`, `user_agent`, consent and browser-side identifiers | repo-visible via `widget_sessions`, widget storage helpers, widget bootstrap/session code | `retain_until_purpose_complete` then `delete_or_anonymize_after_window` | `hard_delete_candidate`, `anonymization_candidate` | Medium to High | define server-side session window, client cleanup expectations, and consent-linked handling |
| conversations/messages | free-text message content, conversation metadata, session linkage | repo-visible via `conversations`, `messages`, `RetentionService`, export/delete surfaces | `retain_until_purpose_complete` then `delete_or_anonymize_after_window` | `hard_delete_candidate`, `anonymization_candidate`, `redaction_candidate` | High | define conversation-scoping, DSAR subject matching, and post-window handling |
| leads/contact requests | `name`, `email`, `phone`, `message`, `note`, `preferred_channel` | repo-visible via `widget_leads`, `agent_contact_requests`, privacy delete/anonymize paths | `retain_until_purpose_complete` then `delete_or_anonymize_after_window` | `hard_delete_candidate`, `anonymization_candidate` | High | define separate policy for `widget_leads` vs `agent_contact_requests` and downstream-delivery dependencies |
| tenant/site config | site config, allowed domains, privacy URL, module config, integration metadata | repo-visible via `sites.config`, `site_modules`, `integration_connections` | `retain_for_legal_or_contract_review` | `soft_delete_candidate`, `requires_legal_review` | Medium | define contract-end, archive, recovery, and controller/processor boundaries |
| dashboard/admin users | tenant user accounts, roles, display name, account metadata | repo-visible via `tenant_users`, dashboard auth/session code | `retain_for_legal_or_contract_review` | `soft_delete_candidate`, `suppression_candidate`, `requires_legal_review` | Medium to High | define offboarding, access revocation, account-history retention, and admin audit needs |
| auth/session/cookie metadata | dashboard sessions, cookie metadata, client-side widget session/consent storage | repo-visible via dashboard auth/session helpers and widget storage code | `retain_for_security_audit_window` | `hard_delete_candidate`, `redaction_candidate`, `legal_hold_sensitive` | Medium to High | define server-side and client-side retention alignment and security exception handling |
| `email_jobs` | recipient email, subject, body, metadata, retry state, errors | repo-visible via `email_jobs` migration, `EmailJobsService`, DSAR docs | `retain_for_delivery_window` | `blocked_until_policy_defined`, `backup_retention_exception_needed`, `requires_implementation` | Critical | define delivery-history window, side-effect-safe deletion behavior, report-run dependencies, and idempotency guardrails |
| `webhook_jobs` | endpoint URL, payload, headers, signing metadata, retry state, errors | repo-visible via `webhook_jobs` migrations and `WebhookJobsService` | `retain_for_delivery_window` | `blocked_until_policy_defined`, `backup_retention_exception_needed`, `requires_implementation` | Critical | define payload minimization, recipient ownership, replay safety, and processor coordination |
| `report_runs` / analytics | recipient email, report subject, error text, usage metrics, session-linked analytics | repo-visible via `report_runs`, `usage_events`, `usage_daily`, report export/reporter code | `retain_for_support_window` and partly `retain_for_legal_or_contract_review` | `anonymization_candidate`, `redaction_candidate`, `blocked_until_policy_defined` | High | separate identifying report data from aggregate-safe analytics and derived-data retention |
| audit/security logs | actor IDs, roles, resource metadata, sanitized metadata, security events | repo-visible via `audit_logs`, `sanitizeForAuditLog`, SRE/privacy docs | `retain_for_security_audit_window` | `redaction_candidate`, `legal_hold_sensitive`, `requires_legal_review` | High | define final audit/log window, exception classes, and hold behavior |
| incident docs | metadata-only incident notes, operator summaries, incident evidence references | documented in SRE runbooks and checklists | `retain_for_support_window` or `retain_for_legal_or_contract_review` | `redaction_candidate`, `legal_hold_sensitive`, `requires_legal_review` | Medium to High | define retention, redaction, and escalation ownership |
| backups/offsite backups | backup-contained DB data, retention artifacts, restore scope metadata | documented in SRE backup/restore material | `blocked_without_approval` and `retain_for_legal_or_contract_review` | `backup_retention_exception_needed`, `legal_hold_sensitive`, `requires_legal_review` | Critical | define backup/offsite retention, erasure exceptions, and approved expiration behavior |
| CI artifacts/logs | workflow logs, audit output, build/test logs, security output | documented-only in SRE/privacy docs | `retain_for_support_window` | `redaction_candidate`, `requires_legal_review` | Medium | define CI artifact retention and no-customer-data hygiene |
| smoke/test data | synthetic sessions, safe smoke metadata, fixtures, deterministic test content | documented-only and repo-evident via smoke/test helpers | `delete_or_anonymize_after_window` | `hard_delete_candidate`, `requires_product_decision` | Low to Medium | keep synthetic-only rule explicit and define retention/cleanup owner |
| external provider logs/records | SMTP/provider history, webhook recipient copies, LLM/provider traces, monitoring metadata | mostly documented-only or inferred from provider classes | `unknown_requires_follow_up` | `blocked_without_approval`, `requires_legal_review` | High | processor-specific retention and deletion commitments need separate inventory |
| DSAR evidence records | request IDs, verification state, scope, approvals, redaction/deletion evidence | currently design-only in `DSGVO-1C`; no case system evident | `retain_for_legal_or_contract_review` | `legal_hold_sensitive`, `requires_implementation` | High | define evidence model, safe storage, retention window, and ownership |

## 5. Candidate Retention Windows

All windows below are candidate placeholders only. They are not final legal policy and not an approval to execute any retention action.

| Candidate Area | Candidate Window | Rationale | Data Risk | Required Approval | Implementation Status | Open Questions |
| --- | --- | --- | --- | --- | --- | --- |
| short-lived technical session data | candidate: short-lived, purpose-bound, likely days not months | session continuity, consent linkage, short operational need | session IDs, visitor IDs, source metadata can still be personal | legal review, privacy owner, product review | partial evidence for cleanup on client side; no final server-side window documented | how long must widget sessions persist server-side for support and DSAR needs |
| operational delivery/job retry data | candidate: short operational retry/reconciliation window | support retry handling, failure analysis, delivery integrity | `email_jobs` / `webhook_jobs` can contain direct or derived PII and side-effect state | legal review, security owner, delivery owner | no explicit runtime retention policy evident | how to retain enough state for idempotency without preserving risky payloads too long |
| support/incident data | candidate: support-window plus documented hold exceptions | troubleshooting, service recovery, customer support follow-up | notes, errors, message-derived snippets, operator identifiers | legal review, product owner, incident owner | partially documented only | what metadata is essential vs. removable after closure |
| audit/security logs | candidate: bounded security-audit window | security review, authorization evidence, incident reconstruction | logs may contain masked but still sensitive metadata | legal review, security owner, privacy owner | partial evidence, no reviewed cleanup enforcement | which events require longer holds and which can expire sooner |
| analytics/reporting aggregates | candidate: longer if truly non-identifying, shorter if recipient- or message-linked | trend analysis, reporting, operational insight | derived PII risk if linked to site, session, recipient, or message text | legal review, product owner, analytics owner | partial evidence only | which aggregates can be preserved after identity removal |
| backup/offsite retention | candidate: separate backup retention class, not same as primary-data delete window | recoverability and disaster readiness | backups can preserve data after primary deletion | legal review, security owner, SRE owner, privacy owner | documented as blocked/no approval | what erasure exceptions are acceptable and how are they disclosed |
| DSAR evidence records | candidate: retain only as long as response accountability and audit need remain | prove verification, scope, approvals, and outcome | evidence may itself contain sensitive procedural data | legal review, privacy owner, security owner | design-only, not implemented | what minimum evidence is required without duplicating personal data |
| synthetic/smoke data | candidate: short and operationally disposable | keep test/smoke signals useful without long-lived clutter | low if synthetic remains synthetic | product/ops review | partially documented | where is the authoritative cleanup owner for synthetic artifacts |

## 6. Deletion / Erasure Policy Design

This task performs no deletion.

Future deletion handling must require:

- identity verification before subject-related disclosure or deletion
- tenant/site scoping before any deletion candidate is selected
- a data discovery plan before action
- retention and legal-hold review before action
- dependency and side-effect analysis before action
- rollback and irreversibility warning before action
- audit and evidence record before and after action
- classification of whether the right pattern is hard delete, soft delete, anonymization, redaction, or suppression
- no cross-tenant deletion
- no cleanup, backfill, or enforcement in this task

| Data Area | Preferred Deletion Pattern | Blocking Condition | Required Approval | Implementation Status |
| --- | --- | --- | --- | --- |
| public widget sessions | hard delete candidate after purpose window; anonymization possible if linkage is still needed briefly | no approved session-retention policy | product, privacy, legal | partial repo evidence only |
| conversations/messages | anonymization candidate before hard delete where evidence or analytics needs remain | no subject-scoping model, no final retention policy | privacy, product, legal | site-scoped delete/anonymize surfaces exist, subject-scoped model does not |
| leads/contact requests | anonymization or hard delete depending on follow-up and evidence needs | no final retention policy, no processor coordination completion | privacy, legal, product | partial repo evidence via privacy delete path |
| tenant/site config | soft delete or archive review more likely than blind hard delete | customer-lifecycle and contractual ownership unclear | legal, product, security | not fully evident |
| dashboard/admin users | soft delete / disable / suppression candidate | workforce identity, account history, and audit needs | legal, security, product | not fully evident |
| auth/session/cookie metadata | hard delete or redaction candidate after security window | no final security-log/session policy | security, legal | partial evidence only |
| `email_jobs` | blocked until policy defined | delivery side effects, retries, report-run dependencies, idempotency | security, privacy, legal, delivery owner | no explicit privacy-delete path evident |
| `webhook_jobs` | blocked until policy defined | downstream replay, external recipients, signing/delivery state | security, privacy, legal, integration owner | site delete technical scope exists, subject-safe design does not |
| `report_runs` / analytics | redaction or anonymization candidate for identifying parts; keep only non-identifying aggregates if justified | derived-PII handling unclear | legal, product, privacy | partial evidence only |
| audit/security logs | redaction candidate with legal/security hold exceptions | evidence retention may override deletion | security, legal, privacy | delete path intentionally not evident |
| incident docs | redaction candidate with hold sensitivity | incident/legal/security hold unclear | security, legal | documented-only |
| backups/offsite backups | blocked pending separate backup policy | backup-content access blocked and erasure exception unresolved | SRE, security, privacy, legal | blocked |
| external provider records | blocked pending processor coordination | provider-specific retention unknown | privacy, legal, processor owner | not evident |
| DSAR evidence records | redaction or constrained deletion candidate after final evidence window | evidence model not yet designed | privacy, legal, security | not implemented |

## 7. Hard Delete vs Soft Delete vs Anonymization Decision Model

Future decision logic should follow these principles:

- hard delete should be considered only where the repository-visible surface can be removed safely and where legal, product, privacy, and operational constraints allow it
- soft delete should be considered where recoverability, audit trace, abuse review, or operator accountability still matters
- anonymization should be considered where non-identifying operational or aggregate value remains but identity should no longer persist
- redaction should be considered for logs, incidents, reports, and mixed-content records where complete removal is either unsafe or unnecessary
- suppression should be considered for restriction, objection, or delivery-stop use cases where the safer control is to stop processing rather than erase the evidence immediately
- legal hold, incident hold, contractual hold, and security hold can override ordinary deletion candidates
- backups require separate retention handling and cannot be treated as equivalent to primary-row deletion

## 8. Jobs / Queues Deletion Safety

High-risk position:

- `email_jobs` deletion is high-risk
- `webhook_jobs` deletion is high-risk
- retry state, delivery state, idempotency, downstream side effects, and report synchronization must be considered before any deletion design is approved

This task:

- performs no reads, writes, or updates on live job tables
- performs no cleanup, backfill, or enforcement

Future job-deletion design must:

- avoid re-triggering delivery
- avoid breaking retry logic assumptions
- avoid undermining idempotency or duplicate-audit lines
- apply tenant/site scoping before any action
- decide which fields can be redacted or anonymized before full row removal is considered
- define whether report-linked `email_jobs` and integration-linked `webhook_jobs` require different policy classes

## 9. Reports / Analytics Deletion Safety

Repository-visible risk:

- `report_runs` may contain PII or derived PII
- reports with data are forbidden in this task
- analytics can become identifying if linked to site, session, recipient, or message content

Future handling must consider:

- source data and derived data separately
- whether report recipients, subjects, and error texts require deletion or redaction sooner than aggregate metrics
- whether aggregates may be retained only if they are demonstrably non-identifying
- that `Query Runner` remains blocked
- that export leakage risks from `DSGVO-1C` still apply

## 10. Logs / Audit / Incident Retention Policy Design

Policy constraints:

- logs may contain PII
- no Production logs were queried
- incident docs must avoid customer data
- security logs may need retention for security purposes, but only after legal/product/privacy review
- a redaction policy is needed
- any log-retention window remains candidate-only and not final
- secret-like log hits remain security incidents
- no log deletion is executed in this task

Repository-visible signals:

- `sanitizeForAuditLog` masks emails, phones, and sensitive keys
- audit actions are logged for export/delete surfaces
- incident material is intended to stay metadata-only

## 11. Backup / Offsite Retention Policy Design

Policy constraints:

- backups may contain PII
- backup retention may conflict with erasure
- offsite retention must be defined separately
- production backup data remains blocked
- backup content access remains blocked
- backup deletion or expiration needs a separate decision
- restore with production data requires privacy approval
- `SRE-2E-EXEC` remains not approved
- `SRE-2F` should only follow after privacy guardrails

Implication:

- primary-row deletion and backup expiration are not interchangeable
- this design does not approve any backup-content inspection or backup-content deletion

## 12. External Processor Retention Coordination

External processors may retain data independently from the primary application.

Current unknowns that require follow-up:

- SMTP/email provider retention
- webhook recipient or customer-owned endpoint retention
- LLM/AI provider retention
- hosting/logging/monitoring provider retention
- backup/offsite provider retention

This task:

- accesses no provider portals
- sends no third-party requests

Future governance must define:

- provider-specific retention and deletion commitments
- controller/processor and customer-endpoint responsibility boundaries
- whether downstream deletion or redaction requests are required for any provider class

## 13. Legal Hold / Incident Hold Design

Some data may need to be held for:

- security reasons
- legal reasons
- contractual reasons
- incident investigation reasons

Future deletion must stop immediately if a relevant legal, contractual, privacy, or incident hold exists.

Current status:

- legal hold process is not implemented here
- owner and approval model remain required
- no final legal assessment is made here

## 14. Retention / Deletion Evidence Design

Any future deletion or retention-exception handling should record:

- task or request ID
- requester verification status
- scope
- tenant/site
- data class
- owner roles
- approvals
- deletion pattern selected
- data sources included
- data sources excluded and why
- backup/log exceptions
- execution timestamp
- validation result
- redaction or anonymization result
- evidence retention period

This task:

- creates no real evidence file
- stores no real requester data in the repository

## 15. Abuse / Safety Controls

Future implementation must prevent:

- malicious deletion requests
- cross-tenant deletion
- broad wildcard deletion without review
- report or query leakage
- delivery re-triggering
- accidental backup deletion

Future implementation should require:

- dry-run preview before action, but no actual dry run is executed here
- rate limits for sensitive deletion requests
- approval workflow
- dual control for high-risk deletion classes
- explicit owner review for backup-, job-, log-, and processor-linked paths

## 16. Retention / Deletion Risk Register

| Risk | Surface | Impact | Current Evidence | Severity | Pilot Impact | Required Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| retention windows not legally validated | all privacy-relevant data classes | false confidence and inconsistent deletion behavior | `documented_only` / `partially_documented` | Critical | High | legal/privacy review of candidate windows |
| deletion path incomplete | cross-surface privacy delete coverage | incomplete erasure and inconsistent operator behavior | `partially_documented` | Critical | High | deletion orchestration and coverage audit |
| backup retention conflict | backups/offsite copies | deleted primary data may remain in backup scope | `documented_only` | Critical | High | backup retention/erasure exception policy |
| logs may contain PII | audit/app/incident/CI logs | privacy leakage or over-retention | `repo_evident` / `documented_only` | High | High | log redaction and retention policy finalization |
| `email_jobs` / `webhook_jobs` deletion side effects | delivery and integration queues | replay, duplicate side effects, broken idempotency | `repo_evident` | Critical | High | dedicated queue/job deletion safety design |
| `report_runs` derived PII | reports/analytics | retained outputs may still identify people | `repo_evident` | High | High | derived-data retention and anonymization policy |
| external processor retention unknown | provider classes and customer-owned endpoints | incomplete downstream deletion/export handling | `unknown_requires_follow_up` | High | High | processor inventory and retention commitments |
| legal hold not designed | deletion governance | accidental deletion during incident/legal review | `not_evident` | High | High | hold model and owner mapping |
| DSAR evidence retention unknown | future DSAR records | procedural evidence may be over-retained or under-retained | `design_only` | Medium to High | Medium to High | DSAR evidence storage and retention design |
| cross-tenant deletion risk | admin/site deletion surfaces | unauthorized deletion across customer boundaries | `partially_documented` | Critical | High | tenant-isolation deletion review |
| `DB_READ_ONLY_AUDIT` not granted | live verification path | unsafe policy assumptions without live evidence | `blocked_without_approval` | High | High | keep blocked until explicit approval |
| no live DB discovery without approval | deletion completeness validation | unknown live variance between code and production data | `blocked_without_approval` | High | High | separate approval-bound audit gate if ever needed |

## 17. Pilot Go / No-Go Criteria

Pilot Go only when:

- `DSGVO-1A` PII Data Map exists
- `DSGVO-1B-R` Processing / Retention / DSAR Gap Audit exists
- `DSGVO-1C` DSAR / Export Safety Design exists
- this `DSGVO-1D` Retention / Deletion Policy Design exists
- no High/Critical security findings remain open
- public widget boundary is documented
- no known public PII leak exists
- tenant-isolation risk is addressed or explicitly planned
- retention/deletion follow-up is planned
- DSAR/export follow-up is planned
- processor/DPA follow-up is planned
- privacy owner path is planned

Pilot No-Go when:

- deletion would require direct query runner or SQL
- public widget leaks internal, debug, secret, or delivery data
- cross-tenant deletion risk remains unknown without follow-up
- `DB_READ_ONLY_AUDIT` is treated as granted
- reports or query results with data are exposed
- production backup or restore with PII is executed without approval
- no privacy owner or no deletion owner path exists
- High/Critical security findings remain open

## 18. Required Follow-ups

Recommended follow-ups:

- `DSGVO-1E DSAR Export Schema Design`
- `DSGVO-1F DSAR Execution Decision Gate`
- `DSGVO-1G Retention / Deletion Implementation Decision Gate`
- `ENT-SEC-1A Enterprise Security Gap Audit`
- `SRE-2F Production Backup Verification Decision Gate`, only after privacy guardrails

Recommended immediate next step:

- `DSGVO-1E DSAR Export Schema Design`

Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

## 19. Stop Boundaries

This design explicitly does not:

- read a database
- execute SQL
- use a query runner
- generate reports
- execute a DSAR request
- execute an export
- execute deletion
- execute correction
- execute a retention action
- open backups, dumps, or exports
- read secrets
- run production queries
- change production config
- deploy anything
- change public widget response shape
- mutate a customer site
- grant DSGVO compliance

## 20. Non-goals

- no legal advice
- no final GDPR / DSGVO compliance rating
- no implementation
- no DB access
- no SQL
- no query runner
- no reports
- no export
- no DSAR execution
- no deletion
- no correction
- no retention action
- no backup or restore
- no deploy
- no runtime changes
- no customer data
- no secrets
