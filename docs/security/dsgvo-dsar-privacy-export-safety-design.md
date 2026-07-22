# DSGVO DSAR / Privacy Export Safety Design

Stand: 2026-07-22

## 1. Summary

This document is a documentation-only DSAR and Privacy Export Safety Design for Enterprise Pilot readiness.

Purpose:

- define the technical safety boundaries for future DSAR, privacy export, correction, deletion, restriction, and processor-coordination work
- constrain later execution candidates before any request, export, deletion, correction, or backup-derived lookup can happen
- document which approval, scoping, redaction, audit-trail, and abuse-prevention controls are required before any real subject-rights workflow is allowed

This step is intentionally `DOKU_ONLY`.

This design does not:

- read any database
- execute SQL
- use a query runner
- read production or staging logs
- generate reports
- execute a DSAR request
- generate an export
- execute deletion, correction, restriction, or objection handling
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This document is a technical safety design, not legal advice and not a final compliance release.

## 2. Scope

Scope of analysis:

- read-only review of repository documentation under `docs/operations`, `docs/security`, and `docs/architecture`
- read-only review of relevant API, dashboard, widget, package, DTO, controller, migration, and retention/privacy code paths
- build on `DSGVO-1A` PII Data Map and `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit
- document only technical categories, boundaries, risk classes, approval dependencies, and future follow-up tasks

Out of scope:

- production data analysis
- staging data analysis
- raw logs
- processor-portal access
- query results
- data exports
- deletion execution
- correction execution
- restriction execution
- implementation changes

## 3. DSAR Request Type Model

This model is technical only and not a final legal taxonomy.

| Request Type | Possible Technical Data Sources | Required Evidence | Risk | Approval Needs | Non-goals | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| `access / data discovery` | site-scoped export surfaces, conversations, leads, tickets/contact requests, knowledge, analytics metadata, audit summaries | verified requester identity, subject identifiers, tenant/site scope, allowed data-class list | High | privacy owner, operator ownership, tenant/site scope approval | no request execution now | define subject-oriented discovery inventory |
| `export / portability` | privacy export, site export, conversation CSV, report-related metadata, knowledge metadata | verified identity, export scope definition, redaction policy, storage/expiry plan, audit trail | Critical | privacy owner, security review, tenant/site scope approval | no export generation now | design export schema and redaction rules |
| `rectification / correction` | lead/contact/admin/tenant-facing mutable records | verified identity, field-level authority, audit-trail requirement, cross-tenant guard | High | product owner plus privacy/process approval | no correction now | design field-level correction workflow |
| `erasure / deletion` | privacy delete, site delete, anonymization flows, retention surfaces | verified identity, deletion scope, retention/legal-hold review, backup/log exception model | Critical | privacy owner, legal/process review, operator approval | no deletion now | design deletion policy by data area |
| `restriction / objection` | future suppression flags, delivery controls, reporting exclusions | verified identity, affected processing purpose, downstream system impact review | High | product/legal review, future implementation approval | no restriction action now | design suppression/hold model |
| `processing-purpose clarification` | privacy docs, processing-purpose audit, role model, config and feature inventory | verified request context, controller/processor role clarification, purpose mapping | Medium | privacy/legal review | no legal determination now | map controller/processor and purpose ownership |
| `processor / recipient information` | integration inventory, provider classes, webhook/email/LLM/backup/monitoring docs | verified scope, provider inventory, transfer categories, record of processing references | High | privacy owner, ops/security input | no provider outreach now | build processor inventory and DPA status map |
| `incident / privacy escalation` | audit summary surfaces, incident docs, security runbooks | verified incident relevance, redaction policy, least-data disclosure rule | High | security owner, privacy owner | no incident data pull now | define privacy-safe incident evidence format |

## 4. Request Intake And Identity Verification Design

Current repo-visible status:

- no dedicated DSAR intake workflow is clearly implemented
- no subject-identity verification flow is clearly implemented
- admin and operator authorization exists for site-scoped export/delete endpoints, but this is not equivalent to subject verification

Future handling must treat identity verification as a hard gate before any disclosure, deletion, correction, or restriction action.

| Step | Purpose | Required Evidence | Risk | Current Status | Follow-up |
| --- | --- | --- | --- | --- | --- |
| intake receipt | capture that a request exists | request type, intake timestamp, future request tracking ID | Medium | `unknown_requires_follow_up` | define intake channel and owner |
| request classification | decide whether access/export/delete/correction/restriction is requested | request category, affected tenant/site, claimed subject relation | High | `unknown_requires_follow_up` | define classification checklist |
| requester identity verification | prove who the requester is | verified identity proof or approved organization-contact path | Critical | `unknown_requires_follow_up` | define verification method and evidence format |
| tenant/site scope verification | prove the request targets the right tenant/site | tenant/site identifiers, operator scoping, subject relationship | Critical | `partially_documented` | define allowed scoping combinations |
| authority verification | prove requester may act for the organization or subject | role/authority proof for organization contacts | Critical | `unknown_requires_follow_up` | define authority matrix |
| request-risk review | detect suspicious, over-broad, or spoofed requests | abuse signals, unusual scope, cross-tenant risk | High | `unknown_requires_follow_up` | define security review trigger |
| execution approval | approve any later action | privacy/process approval, scope approval, action type approval | Critical | `not_granted_by_default` | define approval chain |
| response-safe storage | retain case metadata without sensitive spillover | request ID, sanitized comments, no real requester data in repo | High | `design_only` | define external case system or approved storage |

Mandatory design rules:

- no export before identity verification
- no deletion before identity verification and retention/legal-hold review
- no correction before identity verification and field ownership review
- no sensitive requester data in repository docs, PRs, or comments
- no actual requester case evidence is created by this task

## 5. Data Discovery Scope Design

This table documents technical discovery areas only. It does not approve any live lookup.

| Data Area | Possible Identifiers | Discovery Risk | Export Candidate | Deletion Candidate | Approval Required | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| public widget sessions | `siteId`, `siteKey`, `session_id`, `visitor_id` | Medium to High | conditional | conditional | yes | tied to chat/session linkage and consent state |
| conversations/messages | `siteId`, `conversation_id`, `session_id` | High | conditional | conditional | yes | free-text content can contain arbitrary PII |
| leads/contact requests | `siteId`, name/email/phone fields, request IDs | High | conditional | conditional | yes | direct contact data and notes |
| tenant/site config | `tenantId`, `siteId`, config field names | Medium | limited | limited | yes | may contain organization-facing settings, not always subject data |
| dashboard/admin users | `tenant_user_id`, admin/session/account identifiers | High | restricted | restricted | yes | employee/operator account data needs strict ownership review |
| auth/session metadata | cookie/session IDs, actor/session expiry fields | High | restricted | restricted | yes | security-sensitive operational metadata |
| `email_jobs` | recipient email, subject/body metadata, job IDs | Critical | blocked_without_explicit_approval | blocked_without_explicit_approval | yes | delivery internals and message bodies are high-risk |
| `webhook_jobs` | endpoint URL, payload metadata, job IDs | Critical | blocked_without_explicit_approval | blocked_without_explicit_approval | yes | outbound payloads and recipient metadata are high-risk |
| `report_runs` / analytics | report recipient fields, usage/event metadata, report IDs | High | restricted | restricted | yes | analytics and reporting can leak PII or internal metadata |
| audit/security logs | actor/resource metadata, sanitized metadata, action IDs | High | restricted | restricted | yes | separate redaction/summarization process required |
| incident docs | internal case notes, summaries, ops evidence | High | restricted | restricted | yes | must stay metadata-only and sanitized |
| backups/offsite backups | backup file lineage, restore scope metadata | Critical | blocked | blocked | yes | backup content remains approval-bound and blocked |
| CI artifacts/logs | workflow/job artifacts, build logs, scan output | High | blocked | blocked | yes | may contain operationally sensitive data |
| external providers | provider-specific recipient or processing records | Critical | blocked_without_processor_plan | blocked_without_processor_plan | yes | processor coordination is incomplete |

Design interpretation:

- `email_jobs`, `webhook_jobs`, `report_runs`, logs, artifacts, and backups remain approval-bound high-risk areas
- subject-oriented discovery must not default to raw technical tables or queue internals
- no live DB discovery is approved by this document

## 6. Export Safety Boundary

Any future DSAR or privacy export must stay inside these safety boundaries.

Forbidden by default:

- query runner usage
- raw SQL exports
- reports with data
- cross-tenant data
- secrets
- internal debug fields
- delivery internals
- webhook secrets or signatures
- provider tokens
- unredacted logs
- backup-content export
- CI secrets or environment data
- third-party recipient secrets
- export without identity, tenant, and scope verification

Future exports may only:

- contain explicitly scoped data classes
- be tenant-, site-, and subject-bounded
- be redacted or sanitized where required
- be reviewable before release
- be auditable after release
- have explicit storage and expiry boundaries

Design implications:

- site-scoped export endpoints are not enough as-is for subject-rights safety
- conversation CSV and broad privacy export surfaces require a narrower subject-scope and safe bundle design
- analytics, report, log, and queue-derived data must never be auto-included by convenience

## 7. Export Format Design

This section is conceptual only. No export file is produced.

Future machine-readable export bundle should contain:

- `metadata`
- `source_scope`
- `data_sections`
- `redaction_summary`
- `omitted_data_summary`
- `processor_recipient_summary`
- `retention_deletion_caveats`

Future human-readable summary should contain:

- request scope summary
- included data classes
- omitted data classes and why
- redaction explanation
- processor/recipient explanation
- retention/backup caveats

Safe design constraints:

- no example JSON, CSV, or export payload with real values
- only placeholder-level schema concepts
- no internal-only secret-bearing fields
- no debug-only data sections
- no queue payload dumps

## 8. Deletion / Erasure Safety Design

This task does not execute deletion.

Future deletion design must require:

- identity verification
- tenant/site/scope review
- retention and legal-hold review
- backup/offsite exception handling
- log-retention exception handling
- cross-tenant isolation review
- rollback and undo limitation disclosure before execution

High-risk areas remain:

- `email_jobs`
- `webhook_jobs`
- `report_runs`
- backups/offsite copies
- logs and incident evidence

| Data Area | Deletion Candidate | Risk | Blocking Condition | Required Follow-up |
| --- | --- | --- | --- | --- |
| conversations/messages | conditional | High | no subject-oriented scoping proof | deletion policy and scoping design |
| public widget sessions | conditional | Medium to High | no subject-link proof and retention review | session retention/deletion design |
| leads/contact requests | conditional | High | no verified requester identity | deletion ownership and evidence design |
| tenant/site config | restricted | Medium | config may reflect organization configuration, not only subject data | controller/processor and ownership review |
| dashboard/admin users | restricted | High | workforce/admin identity and platform-account constraints | admin-account governance design |
| auth/session metadata | restricted | High | security and abuse-review needed | session/log retention design |
| `email_jobs` | blocked_by_default | Critical | queue payload and delivery-history risk | explicit queue-data deletion policy |
| `webhook_jobs` | blocked_by_default | Critical | downstream payload and recipient risk | explicit webhook deletion policy |
| `report_runs` / analytics | restricted | High | export/report leakage and auditability concerns | analytics/report retention design |
| audit/security logs | restricted | High | evidence retention and security obligations | audit-log summary/redaction policy |
| backups/offsite backups | blocked | Critical | backup policy unresolved | backup deletion/retention decision gate |
| external providers | blocked_without_processor_plan | Critical | processor coordination incomplete | provider coordination procedure |

## 9. Correction / Rectification Safety Design

This task does not execute correction.

Future correction design assumptions:

- contact, lead, admin, and tenant-facing records may require future correction handling
- conversation/message correction is likely restricted and may require a product decision instead of content rewriting
- corrections need audit trail
- corrections must not cross tenant boundaries
- corrections require ownership and approval definition

Current safety position:

- no repo-visible end-to-end correction workflow is confirmed
- no field-level approval matrix exists in reviewed scope
- no direct correction path is approved from this document

## 10. Restriction / Objection Handling Design

This task performs no restriction or objection handling.

Future design concerns:

- processing restriction can affect delivery, webhooks, `email_jobs`, reporting, and analytics
- suppression lists or restriction flags need future implementation design
- no feature flags are set in this task
- no delivery pause is executed in this task
- restriction handling requires product and legal review before implementation

Minimum future design expectations:

- define affected processing surfaces
- define safe suppression semantics
- define ownership for unblocking/reversal
- define audit and abuse controls

## 11. Logs / Reports / Query Result Safety

Safety constraints:

- logs may contain PII
- production logs were not queried
- reports or query results with data are forbidden in this task
- future DSAR export must not include raw internal logs without redaction
- audit logs may require a separate summary or redaction process
- incident logs must avoid customer data
- query runner remains blocked

Technical implications:

- export paths must not reuse report or analytics outputs blindly
- operational logs are not equivalent to user-facing privacy exports
- audit evidence should be summarized, not dumped

## 12. Backup / Restore / Offsite Safety

Based on `SRE-2A` through `SRE-2E`:

- backups may contain PII
- production backup content remains blocked
- offsite backups may affect retention and deletion obligations
- DSAR export must not pull from backup content without explicit approval
- production restore data remains blocked
- `SRE-2E-EXEC` is not approved
- backup deletion and retention conflicts require legal and product decision

Current design status:

- backup content access: not granted
- production data access: not granted
- production secret access: not granted
- restore execution access: not granted

## 13. External Processor / Recipient Coordination Design

Current state:

- external recipient inventory remains incomplete in repository-visible form
- processor coordination is needed for future DSAR, export, deletion, and correction handling
- no third-party requests were sent
- no provider portals were accessed
- no tokens or secrets were used

Future coordination needs:

- webhook and customer-owned endpoints require tenant/customer scoping
- LLM/AI provider processing needs follow-up
- SMTP/email provider records need follow-up
- monitoring/logging provider records need follow-up
- backup/offsite provider records need follow-up

Design boundary:

- no provider outreach or downstream erasure/export action is approved from this document

## 14. DSAR Evidence / Audit Trail Design

Future DSAR handling must record:

- request ID
- date/time
- requester verification status
- scope
- tenant/site
- data-subject identifiers used
- owner roles
- approvals
- data sources searched
- data sources omitted and why
- export/deletion/correction decision
- redactions
- response status
- retention of DSAR evidence

Current design boundaries:

- no real requester data in repo
- no actual DSAR evidence created now
- no case comments with sensitive values

## 15. Abuse / Security Controls

Future DSAR/privacy-export handling must address:

- identity spoofing risk
- account takeover risk
- cross-tenant export risk
- over-broad export risk
- social engineering risk
- secret leakage risk
- report/query leakage risk
- internal debug leakage risk
- rate limiting and approval workflow needs
- security owner review for suspicious requests

Minimum control assumptions:

- identity proof before disclosure
- second-person or owner review for high-risk export classes
- tenant isolation review for any broad scope
- no raw queue/log/report reuse

## 16. DSAR / Export Risk Register

| Risk | Surface | Impact | Current Evidence | Severity | Pilot Impact | Required Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| identity verification incomplete | DSAR intake and disclosure | wrong-person disclosure or deletion | `not_evident` | Critical | High | define verification process |
| export scope unknown | privacy export surfaces | over-broad disclosure | `partially_documented` | Critical | High | define subject-scoped export boundary |
| cross-tenant leakage risk | site/admin export surfaces | unauthorized data disclosure | `partially_documented` | Critical | High | tenant-isolation export review |
| raw logs may contain PII | logs, incident notes, audit summaries | privacy leakage | `documented_only` / `repo_evident` | High | High | redaction and summary design |
| query/report export leakage | reports, analytics, query-style outputs | internal-data leakage | `partially_documented` | High | High | keep reports/query results outside DSAR exports |
| `email_jobs` / `webhook_jobs` payload risk | queue/delivery internals | direct PII and recipient leakage | `repo_evident` | Critical | High | explicit queue-data policy |
| backups/offsite retention conflict | backup/restore | incomplete erasure or overreach | `documented_only` | Critical | High | backup retention/deletion decision gate |
| deletion not fully designed | delete/anonymize surfaces | incomplete or unsafe erasure | `partially_documented` | High | High | deletion policy design |
| correction path unclear | mutable customer/admin records | incorrect or unsafe mutation | `not_evident` | High | Medium to High | correction workflow design |
| external processor coordination incomplete | outbound providers and customer endpoints | incomplete downstream compliance handling | `unknown_requires_follow_up` | High | High | processor inventory and coordination plan |
| no final legal basis validation | all request categories | privacy decisions made without legal closure | `requires_legal_review` | High | High | legal/privacy review |
| no live DB discovery without approval | all subject-rights discovery | blind spots or unsafe escalation | `blocked_without_approval` | High | High | later explicit decision gate if ever needed |

## 17. Pilot Go / No-Go Criteria

Pilot Go only when:

- `DSGVO-1A` PII Data Map exists
- `DSGVO-1B-R` Processing / Retention / DSAR Gap Audit exists
- this `DSGVO-1C` DSAR / Export Safety Design exists
- no high or critical security findings remain open
- public widget boundary is documented
- tenant-isolation risk is addressed or explicitly planned
- DSAR/export follow-up is planned
- privacy owner path is planned
- processor/DPA follow-up is planned
- no known public PII leak is open

Pilot No-Go when:

- a DSAR/export path would require direct query runner or SQL execution
- public widget surfaces leak internal, debug, secret, or delivery data
- cross-tenant export risk is still unknown and unaddressed
- `DB_READ_ONLY_AUDIT` is treated as granted
- reports or query results with data are exposed
- production backup or restore with PII is executed without approval
- no privacy owner or no DSAR owner path exists
- high or critical security findings remain open

## 18. Required Follow-ups

Recommended follow-ups:

- `DSGVO-1D Retention and Deletion Policy Design`
- `DSGVO-1E DSAR Export Schema Design`
- `DSGVO-1F DSAR Execution Decision Gate`
- `ENT-SEC-1A Enterprise Security Gap Audit`
- `SRE-2F Production Backup Verification Decision Gate`

Recommended immediate next step:

- `DSGVO-1D Retention and Deletion Policy Design`

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
- open backups, dumps, or exports
- read secrets
- run production or staging queries
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
- no backup or restore
- no deploy
- no runtime changes
- no customer data
- no secrets
