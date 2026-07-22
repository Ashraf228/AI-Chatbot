# DSGVO Processing Purpose / Retention / DSAR Gap Audit

Stand: 2026-07-22

## 1. Summary

This document is a documentation-only processing purpose, retention, and DSAR gap audit for Enterprise Pilot readiness.

This retry continues after the former `sharp` High security blocker was resolved, production-live documented, and the production-context audit returned to PASS on `main`.

Purpose:

- inventory repository-visible processing purposes and candidate purpose categories
- map repository-visible data categories from `DSGVO-1A` to likely processing surfaces
- document repository-visible retention, deletion, anonymization, export, and DSAR-adjacent surfaces
- identify which governance, product, security, and implementation gaps remain before an Enterprise Pilot should be treated as privacy-ready

This step is intentionally `DOKU_ONLY`.

This audit does not:

- read any database
- execute SQL
- use a query runner
- read production or staging logs
- generate reports
- execute a DSAR request
- execute an export
- execute deletion or anonymization
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This document is a technical gap analysis, not legal advice and not a final compliance release.

## 2. Scope

Scope of analysis:

- read-only review of repository documentation under `docs/operations`, `docs/security`, and `docs/architecture`
- read-only review of relevant API, dashboard, widget, package, DTO, entity, controller, and migration files
- read-only review of retention, privacy export, deletion, anonymization, audit-log, billing-feature, widget-consent, and restore-governance code paths
- repository-visible field names, route shapes, feature flags, plan features, and storage classes only

Out of scope:

- production data analysis
- staging data analysis
- raw logs
- legal basis validation
- processor contract review
- DSAR execution
- export execution
- deletion execution
- implementation changes

## 3. Gap Classification Model

### Gap status labels

- `covered_by_repo_evidence`
  - the repository shows a concrete technical surface or control
- `documented_only`
  - documentation states a process or rule, but runtime evidence is not fully validated here
- `partially_documented`
  - some technical evidence exists, but scope or completeness is unclear
- `not_evident`
  - no meaningful repository-visible evidence was found for the required control
- `unknown_requires_follow_up`
  - the question cannot be answered safely from repository evidence alone
- `blocked_without_approval`
  - a live verification path exists in theory but is intentionally blocked in the current governance model
- `requires_legal_review`
  - a legal or contractual decision is needed before the area can be treated as acceptable
- `requires_product_decision`
  - product behavior, UX, or ownership must be decided explicitly
- `requires_implementation`
  - technical controls are not complete without further engineering work

## 4. Processing Purpose Inventory

| Processing Surface | Possible Purpose | Possible Data Categories | Evidence Level | Purpose Status | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Public widget session/chat | operate customer-facing chat, maintain conversation continuity, answer user questions | session identifiers, visitor identifiers, free-text message content, source URL, user-agent | `covered_by_repo_evidence` via `apps/widget/src/bootstrap/initSession.ts`, `apps/widget/src/services/sessionService.ts`, `apps/api/src/ai/chat-pipeline/chat-pipeline.service.ts` | `partially_documented` | legal basis and notice model still need legal review |
| lead/contact capture | collect contact requests and sales leads | name, email, phone, message, session ID | `covered_by_repo_evidence` via `apps/widget/src/services/leadService.ts`, `widget_leads`, `agent_contact_requests` | `partially_documented` | purpose wording and retention ownership need confirmation |
| handoff/contact request | enable follow-up contact or scheduling | name, email, phone, preferred channel, note, conversation references | `covered_by_repo_evidence` via `agent_contact_requests` schema and tool/chat orchestration paths | `partially_documented` | ownership and lawful basis for handoff storage need review |
| conversation continuity | preserve prior chat context for ongoing assistance | conversation content, metadata, session IDs | `covered_by_repo_evidence` via `conversations`, `messages`, `conversation metadata` | `partially_documented` | retention and minimization rules need stronger definition |
| dashboard admin/auth | authenticate dashboard users and scope admin access | session cookie, actor ID, tenant ID, tenant user ID, role, session expiry | `covered_by_repo_evidence` via `apps/dashboard/lib/auth.ts`, `apps/dashboard/lib/dashboard-api.ts` | `covered_by_repo_evidence` | retention and notice for admin-session metadata need follow-up |
| tenant/site administration | configure customer sites, widget behavior, privacy URL, consent requirement, lead delivery | tenant/site IDs, company/site metadata, privacy URL, lead notification email | `covered_by_repo_evidence` via `widget-config.service.ts`, site config fields | `partially_documented` | customer-vs-platform responsibility split needs documentation |
| evaluation/testing workspace | run internal evaluation and testing flows | evaluation chat IDs, synthetic/demo signals, possible support-ticket references | `partially_documented` via architecture docs and evaluation migrations | `partially_documented` | synthetic-vs-real boundary should stay explicit |
| email delivery | send report mail or lead-related notifications | recipient email, subject, body, metadata, error strings | `covered_by_repo_evidence` via `email_jobs` schema and export/PII docs | `partially_documented` | purpose and retention for delivery history need review |
| webhook delivery | deliver configured external integration payloads | payload metadata, headers, endpoint URL, status, errors | `covered_by_repo_evidence` via `webhook_jobs`, integration config | `partially_documented` | processor ownership and purpose boundaries require review |
| analytics/reporting | usage analytics, reporting, conversions, admin visibility | session IDs, usage counts, report recipient email, report subject, message-derived metadata | `covered_by_repo_evidence` via `usage_daily`, `usage_events`, `report_runs`, `report_subscriptions` | `partially_documented` | analytics minimization and export scope need review |
| audit/security logging | trace admin actions and security-relevant activity | actor IDs, roles, resource IDs, sanitized metadata | `covered_by_repo_evidence` via `AuditLogService`, `sanitizeForAuditLog` | `covered_by_repo_evidence` | exact retention enforcement for audit logs is not fully evident |
| incident/support operations | support post-incident review and technical operations | metadata-only review artifacts, possible identifiers if insufficiently redacted | `documented_only` via `docs/operations/*` and SRE docs | `partially_documented` | privacy-safe incident evidence rules need continued enforcement |
| backup/restore | preserve recoverability and continuity | all DB-backed PII classes in backups | `documented_only` via `SRE-2A` through `SRE-2E` docs | `blocked_without_approval` | retention, deletion, and DSAR conflict handling need definition |
| synthetic smoke/testing | validate production-adjacent health using safe test inputs | synthetic sessions, safe smoke metadata | `documented_only` via SRE docs | `covered_by_repo_evidence` | keep synthetic-only rule explicit |
| external provider/API processing | call LLM, SMTP, webhook, monitoring, hosting, backup, and customer-owned endpoints | prompts, delivery payloads, logs, emails, tokens, endpoint metadata | `covered_by_repo_evidence` / `documented_only` | `unknown_requires_follow_up` | processor mapping and DPA status need explicit review |

## 5. Legal Basis Candidate Gap Matrix

Legal basis categories below are candidate placeholders only. They are not final legal validation and not legal advice.

| Processing Surface | Candidate Legal Basis / Basis Category | Evidence | Status | Required Follow-up |
| --- | --- | --- | --- | --- |
| Public widget session/chat | `contract / pre-contractual`, `legitimate interest`, possibly `consent` where chat start is consent-gated | chat, session, and consent-related code paths exist | `requires_legal_review` | clarify whether session bootstrap and analytics rely on consent, contract, or legitimate interest per tenant use case |
| lead/contact capture | `contract / pre-contractual`, possibly `consent` | lead forms and contact request storage are repo-evident | `requires_legal_review` | align notice text, intake wording, and downstream notification purpose |
| handoff/contact request | `contract / pre-contractual`, `legitimate interest` | schedule/contact surfaces are repo-evident | `requires_legal_review` | define when handoff is optional marketing vs. requested service follow-up |
| dashboard admin/auth | `security / operational necessity`, `legitimate interest` | auth/session and scoped headers are repo-evident | `requires_legal_review` | define retention and operational necessity boundaries |
| tenant/site administration | `contract`, `legitimate interest` | customer configuration and site ownership are repo-evident | `requires_legal_review` | clarify controller/processor split for tenant-managed content |
| analytics/reporting | `legitimate interest`, possibly `contract` | reporting and analytics tables and endpoints are repo-evident | `requires_legal_review` | define whether all analytics are necessary or optional |
| email delivery | `contract / pre-contractual`, `legitimate interest` | queue-based delivery is repo-evident | `requires_legal_review` | separate transactional vs. optional notification categories |
| webhook delivery | `contract`, `legitimate interest`, `unknown_requires_legal_review` | integration and webhook surfaces are repo-evident | `requires_legal_review` | purpose per provider type and tenant configuration must be documented |
| audit/security logging | `security / operational necessity`, possibly `legal obligation` | audit-log surfaces are repo-evident | `partially_documented` | document retention, access, and event classes |
| backup/restore | `security / operational necessity`, `legal obligation`, `unknown_requires_legal_review` | restore-governance docs exist | `requires_legal_review` | define backup retention, deletion handling, and restoration boundaries |
| DSAR/export/delete tooling | `legal obligation`, `security / operational necessity` | privacy export/delete endpoints and plan feature exist | `partially_documented` | confirm who may invoke, under what verification and evidence rules |

## 6. Retention Inventory

| Data Category / Surface | Current Retention Evidence | Deletion Evidence | Risk | Pilot Impact | Follow-up |
| --- | --- | --- | --- | --- | --- |
| conversations/messages | `RetentionService` defaults chat retention to `90` days via site config and can delete expired conversations when `RETENTION_CLEANUP_ENABLED=true` | conversations can be deleted or anonymized via privacy/site-data services | `retention_partially_defined` | High | runtime retention exists, but live enablement and governance are not validated |
| sessions | widget session identifiers persist client-side until cleanup; no explicit server-side retention policy evident for `widget_sessions` | site-data delete scope removes `widget_sessions`; client cleanup helper removes stored identifiers | `retention_partially_defined` | Medium to High | server-side retention not clearly documented |
| leads/contact requests | `RetentionService` defaults lead retention to `365` days for `widget_leads`; contact-request retention not evident | leads can be deleted or anonymized; contact requests can be deleted or anonymized in privacy delete path | `retention_partially_defined` | High | `agent_contact_requests` retention policy is not evident |
| tenant/site config | config surfaces exist; no explicit retention target evident | site deletion paths exist elsewhere, but purpose-specific retention is not evident | `retention_not_evident` | Medium | define customer lifecycle, archival, and deletion rules |
| dashboard/admin users | session expiry metadata exists; broader retention policy for admin-account metadata is not evident | no dedicated deletion/retention process evident in reviewed scope | `retention_not_evident` | Medium | document account/session retention and offboarding |
| auth/session/cookie metadata | dashboard cookie and widget consent/session storage are repo-evident; no unified retention schedule found | widget consent/session cleanup exists; dashboard cookie expiry is per token/session | `retention_partially_defined` | Medium | align client-side and server-side session rules |
| `email_jobs` | no explicit retention schedule found | no deletion/anonymization path evident in reviewed privacy surfaces | `retention_not_evident` | High | define delivery-history retention and deletion constraints |
| `webhook_jobs` | no explicit retention schedule found | site-data delete scope removes `webhook_jobs`; no anonymization flow evident | `retention_partially_defined` | High | define retention, payload minimization, and DSAR treatment |
| `report_runs` / analytics | `RetentionService` defaults report retention to `365` days; usage tables show no explicit retention evidence | report runs can be deleted via site-data delete scope | `retention_partially_defined` | High | define retention for `usage_events`, `usage_daily`, and exported report artifacts |
| audit/security logs | docs mention a `180` day target; code-level cleanup was not found in reviewed scope | audit logs are intentionally retained by privacy delete endpoint as evidence | `retention_partially_defined` | High | define enforcement, exceptions, and access model |
| incident docs | SRE docs require metadata-only handling; explicit retention schedule not evident | deletion policy not evident | `unknown_requires_follow_up` | Medium | define review-note retention and privacy-safe evidence disposal |
| backups/offsite backups | SRE docs explicitly treat them as privacy-relevant; no approved real-data access | deletion handling from backups is not implemented in this audit line | `unknown_requires_follow_up` | High | backup retention and DSAR conflict need governance |
| CI artifacts/logs | docs recognize them as a possible privacy surface; no retention schedule found in repo | no deletion policy evident in reviewed scope | `unknown_requires_follow_up` | Medium | clarify CI artifact retention and redaction rules |
| smoke/test data | synthetic-only expectation is documented | cleanup and disposal are mostly procedural, not fully codified | `partially_documented` | Low to Medium | keep synthetic-only rule explicit and review fixture hygiene |
| external provider logs/records | provider classes are documented, but external retention is not | deletion/export coordination is not evident | `unknown_requires_follow_up` | High | processor-specific retention and deletion coordination need documentation |

Retention status legend used here:

- `retention_defined`
- `retention_partially_defined`
- `retention_not_evident`
- `deletion_not_evident`
- `unknown_requires_follow_up`

## 7. Deletion / Erasure Gap Audit

Repository-visible deletion or anonymization surfaces:

- `POST /admin/sites/:siteId/delete-data`
- `POST /admin/sites/:siteId/privacy/delete-data`
- conversation export/list/detail/delete surfaces in `apps/api/src/conversations/conversations.controller.ts`
- retention cleanup logic in `apps/api/src/retention/retention.service.ts`
- widget-side identifier cleanup in `apps/widget/src/services/sessionService.ts`

Repository-visible deletion strengths:

- site-scoped delete and privacy-delete surfaces exist
- anonymization paths exist for conversations, leads, contact requests, and tickets
- retention cleanup logic exists for conversations, leads, and report runs
- deletes and privacy deletes are audit-logged

Deletion gaps:

- no repository-visible evidence that `email_jobs` has a privacy deletion or anonymization path
- no repository-visible evidence that audit logs are deletable through the privacy delete path
- no repository-visible evidence that external processor copies are coordinated during deletion
- no repository-visible evidence that backup copies are reconciled with deletion/erasure requests
- no repository-visible evidence for cross-surface deletion orchestration beyond site-scoped admin endpoints
- no repository-visible evidence for tenant-wide or subject-identity-driven deletion discovery

Important blockers:

- no DB validation was performed in this audit
- no live deletion was executed
- cleanup, backfill, and enforcement remain outside scope
- areas such as `email_jobs`, `webhook_jobs`, `report_runs`, backups, and logs remain high-risk because real-world deletion completeness is not verified here

Current status:

- deletion tooling is `covered_by_repo_evidence` for some site-scoped surfaces
- deletion completeness is `partially_documented`
- subject-based erasure completeness is `unknown_requires_follow_up`

## 8. DSAR / Data Subject Request Gap Audit

This section inventories technical DSAR-adjacent capability only. No DSAR was executed.

| DSAR Capability | Current Technical Signal | Status | Follow-up |
| --- | --- | --- | --- |
| intake channel | no dedicated DSAR intake workflow was identified in reviewed docs/code | `unknown` | define intake owner, channel, and evidence expectations |
| identity verification | admin/site access checks exist for export/delete endpoints, but no subject identity verification flow was found | `unknown` | define data-subject verification process |
| data discovery | site-scoped export surfaces exist for conversations, leads, tickets/contact requests, knowledge, reports, logs, agent runs, tool invocations, and webhook jobs | `partially_documented` | subject-based discovery across surfaces remains unclear |
| export format | JSON-like payload and CSV export surfaces are repo-evident | `known` | define approved export envelope and tenant/subject scoping rules |
| correction path | no dedicated subject correction workflow was found | `unknown` | define correction ownership and auditability |
| deletion path | site-scoped delete/anonymize surfaces exist | `partially_documented` | subject-specific deletion path remains unclear |
| objection/restriction path | no dedicated workflow found | `unknown` | define handling or document out-of-band process |
| response tracking | audit logs record export/delete actions, but not a complete DSAR case workflow | `partially_documented` | define case tracking and deadlines |
| evidence logging | audit logging exists for export/delete actions | `known` | define what evidence is retained and for how long |
| processor coordination | no dedicated processor coordination workflow was found | `unknown` | define DPA/process steps for downstream deletion/export |

DSAR gap conclusion:

- there is repo-visible privacy tooling
- there is not yet repo-visible proof of an end-to-end subject-rights operating model
- Enterprise Pilot readiness therefore requires owner, verification, discovery, export-safety, and processor-coordination follow-up before treating DSAR handling as mature

## 9. Data Export / Portability Gap Audit

Repository-visible export surfaces:

- `GET /admin/sites/:siteId/export`
- `GET /admin/sites/:siteId/privacy/export`
- `GET /admin/conversations/export`

Known technical signals:

- privacy export capability is plan-gated via `privacyExport`
- site-data export includes leads, conversations, messages, reports, integrations, audit logs, agent runs, tool invocations, tickets, and webhook jobs
- integrations are sanitized to avoid exposing configured secrets directly
- conversation export returns CSV with message content

Export gaps and risks:

- export scope is site-scoped, not clearly data-subject-scoped
- conversation export includes raw message content and therefore carries direct PII risk
- no repository-visible evidence of a dedicated tenant-safe, subject-safe export approval workflow
- no repository-visible evidence of a formal cross-tenant leakage review for every export surface
- no repository-visible evidence of per-processor downstream portability handling
- no repository-visible evidence that report payloads or analytics exports are minimized consistently

Key risks:

- too-broad exports
- query results with data being mistaken for privacy-safe exports
- report payloads containing PII
- cross-tenant leakage
- secret leakage through insufficiently sanitized metadata

No export was executed in this task.

## 10. Processor / External Recipient Gap Audit

| Provider Class | Possible Data | Purpose | DPA / Processor Status | Evidence Level | Follow-up |
| --- | --- | --- | --- | --- | --- |
| email provider / SMTP | recipient email, subject, body text, delivery metadata | transactional or configured notifications | `unknown_requires_follow_up` | `covered_by_repo_evidence` | define provider inventory, DPA status, retention, and optional-vs-required categories |
| webhook recipient | payload metadata, ticket/contact/lead fields, headers, endpoint URL | customer-configured integrations and forwarding | `unknown_requires_follow_up` | `covered_by_repo_evidence` | define ownership, DPA/recipient classification, and payload minimization |
| LLM / AI provider | prompts, messages, model usage metadata | answer generation and knowledge retrieval support | `unknown_requires_follow_up` | `covered_by_repo_evidence` | define transfer basis, retention, and processor/controller role split |
| hosting / infrastructure provider | logs, runtime metadata, platform config | operate application infrastructure | `unknown_requires_follow_up` | `documented_only` | inventory provider class and clarify retention and support access |
| monitoring / logging provider | uptime metadata, alert summaries, operational identifiers | monitoring and incident response | `unknown_requires_follow_up` | `documented_only` | define provider list and redaction rules |
| backup/offsite storage provider | backup archives and retention metadata | recoverability and disaster readiness | `unknown_requires_follow_up` | `documented_only` | define retention, encryption, location, and deletion handling |
| analytics/reporting provider | metrics, report recipients, export outputs | analytics and reporting | `unknown_requires_follow_up` | `partially_documented` | distinguish internal-only analytics from third-party delivery |
| customer-owned endpoints | webhook URLs, customer systems, CRM/ticketing receivers | customer-requested downstream processing | `unknown_requires_follow_up` | `covered_by_repo_evidence` | define contractual and responsibility boundaries |

No real provider secrets, no tokenized URLs, and no live credentials are documented here.

## 11. Backup / Restore Retention and DSAR Impact

Based on `SRE-2A` through `SRE-2E` and `DSGVO-1A`:

- backups can contain PII because DB-backed tables contain conversation, lead, contact, ticket, report, audit, and delivery data classes
- backup retention is privacy-relevant
- offsite retention is privacy-relevant
- DSAR and deletion handling against backup copies is not yet resolved in repository-visible governance
- production backup data remains blocked
- production secrets remain blocked
- restore with production data requires explicit PII / DSGVO approval
- `DB_READ_ONLY_AUDIT` remains `not_granted`
- `SRE-2E-EXEC` remains blocked without explicit approval

Gap conclusion:

- backup governance is `documented_only` as a risk
- DSAR compatibility for backups is `unknown_requires_follow_up`
- Enterprise Pilot readiness should not assume backup/delete/restore compatibility is solved

## 12. Logs / Audit / Incident Retention Impact

Repository-visible signals:

- audit logs sanitize emails, phones, and sensitive key names
- export/delete actions themselves are audit-logged
- SRE docs require metadata-only incident artifacts
- the privacy notes document an audit-log retention target of `180` days, but code-level enforcement is not evident in the reviewed scope

Gaps:

- no repository-visible global log retention enforcement for all app/runtime logs
- no repository-visible incident-note retention schedule
- no repository-visible processor coordination for third-party logging providers

Conclusion:

- log redaction is `covered_by_repo_evidence`
- log retention is `partially_documented`
- incident/privacy review remains an operational follow-up

No production logs were queried in this task.

## 13. Public Widget / Website Consent and Notice Gaps

Repository-visible signals:

- widget config contains `consentRequired`, `leadCaptureEnabled`, and `privacyUrl`
- widget stores consent, session ID, and visitor ID under site-scoped browser keys
- before consent, the privacy notes document a stricter no-session/no-analytics path when `consentRequired=true`
- site-status logic treats privacy URL as part of design/live readiness

Gaps:

- legal notice / consent text content is not validated here
- customer-site responsibility for surrounding privacy notice text is not fully defined in reviewed code/docs
- cookie/session disclosures are only partially documented
- whether all public widget use cases need consent vs. another legal basis remains a legal review topic

Important boundaries:

- no customer site mutation was performed
- no public widget code was changed

## 14. DSAR Risk Register

| Risk | Surface | Impact | Evidence | Severity | Pilot Impact | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| no confirmed DSAR intake path | privacy operations | requests may not enter a controlled workflow | `not_evident` | High | High | define owner, channel, and SLA |
| no confirmed identity verification process | export/delete rights handling | wrong-person disclosure or deletion risk | `not_evident` | High | High | define verification controls |
| incomplete data discovery path | exports, deletes, downstream processors | incomplete subject response | `partially_documented` | High | High | build subject-oriented discovery inventory |
| export scope unknown | site export, conversation CSV, privacy export | over-broad PII exposure | `covered_by_repo_evidence` | High | High | define safe export policy and review gate |
| deletion path unknown for some surfaces | `email_jobs`, logs, backups, processors | incomplete erasure handling | `partially_documented` | High | High | define deletion policy by surface |
| backup retention conflict unknown | backups/offsite copies | subject deletion may not reconcile with restore needs | `documented_only` | High | High | define retention, exceptions, and notices |
| external processor coordination unknown | webhook, SMTP, LLM, hosting, monitoring | incomplete downstream compliance handling | `unknown_requires_follow_up` | High | High | create processor coordination model |
| report/analytics export leakage risk | report runs, usage analytics, conversation CSV | excess disclosure and cross-scope leakage | `covered_by_repo_evidence` | High | High | review export minimization and access rules |
| tenant isolation in exports must be validated | site exports and admin exports | cross-tenant disclosure risk | `partially_documented` | Critical | High | explicit security review of export paths |
| logs may contain PII | audit logs, runtime logs, incident notes | privacy and security leakage | `covered_by_repo_evidence` / `documented_only` | High | High | retention and redaction follow-up |
| retention not fully documented | multiple storage surfaces | indefinite or inconsistent storage | `partially_documented` | High | High | formal retention policy design |
| no legal basis final review | all customer-facing processing | pilot could launch without completed privacy basis review | `requires_legal_review` | High | High | legal review before privacy-ready claim |

## 15. Pilot Privacy Go/No-Go Criteria

Pilot Go from a `DSGVO-1B` perspective only when:

- the `DSGVO-1A` PII Data Map exists
- purpose / retention / DSAR gaps are documented
- no high or critical security findings are open
- the public widget boundary is documented
- incident privacy rules are documented
- no known public widget leak is open
- no unresolved auth / RBAC / tenant-isolation issue is open
- retention / deletion follow-up is planned
- DSAR / export follow-up is planned
- processor / DPA follow-up is planned
- a privacy owner path is documented or explicitly planned

Pilot No-Go when:

- unknown public-facing PII processing exists without follow-up
- `DB_READ_ONLY_AUDIT` is treated as granted
- query results or reports with data are exposed without governance
- production backup/restore with PII is executed without approval
- no privacy owner or no DSAR owner path exists
- high or critical security findings remain open
- unresolved tenant isolation or public widget leak remains open

## 16. Required Follow-ups

Recommended follow-ups:

- `DSGVO-1C DSAR / Privacy Export Safety Design`
- `DSGVO-1D Retention and Deletion Policy Design`
- `ENT-SEC-1A Enterprise Security Gap Audit`
- `SRE-2F Production Backup Verification Decision Gate`

Recommended immediate next step:

- `DSGVO-1C DSAR / Privacy Export Safety Design`

Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

## 17. Stop Boundaries

This audit explicitly does not:

- read a database
- execute SQL
- use a query runner
- generate reports
- execute a DSAR request
- execute an export
- execute deletion or anonymization
- open backups, dumps, or exports
- read secrets
- run production or staging queries
- change production config
- deploy anything

## 18. Recommended Next Step

Recommended next step:

- `DSGVO-1C DSAR / Privacy Export Safety Design`

Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

## 19. Non-goals

- no legal advice
- no final GDPR / DSGVO compliance rating
- no implementation
- no DB access
- no SQL
- no query runner
- no reports
- no DSAR execution
- no privacy export execution
- no deletion or anonymization execution
- no backup or restore execution
- no production log review
- no customer data review
- no secrets or connection strings
#+#+#+#+assistant to=functions.apply_patch code
