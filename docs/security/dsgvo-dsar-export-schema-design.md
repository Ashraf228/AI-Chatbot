# DSGVO DSAR Export Schema Design

Stand: 2026-07-22

## 1. Summary

This document is a documentation-only DSAR export schema design for Enterprise Pilot readiness.

Purpose:

- define a safe technical schema for a later DSAR or privacy export bundle
- define which export sections may exist only as candidate sections
- define which data classes remain excluded, redacted, omitted, or blocked by default
- define required scope, evidence, approval, and validation metadata before any real export can be generated
- constrain later implementation and approval tasks before any real DSAR request handling, export generation, deletion, correction, retention action, or backup-derived lookup can happen

This step is intentionally `DOKU_ONLY`.

This design does not:

- read any database
- execute SQL
- use a query runner
- read production or staging logs
- generate reports
- execute a DSAR request
- generate an export
- generate a JSON, CSV, or ZIP export file
- execute deletion, correction, or retention actions
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This document is a technical export schema design, not legal advice and not a final compliance release.

## 2. Scope

Scope of analysis:

- read-only review of repository documentation under `docs/security`, `docs/operations`, `docs/architecture`, `docs/legal`, and `docs/ops`
- read-only review of relevant API, dashboard, widget, package, DTO, controller, migration, retention, export, delete, audit, and backup-related code paths
- build on `DSGVO-1A` PII Data Map
- build on `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit
- build on `DSGVO-1C` DSAR / Privacy Export Safety Design
- build on `DSGVO-1D` Retention / Deletion Policy Design
- document only technical schema sections, placeholder fields, safety defaults, blocked areas, risks, and required follow-up work

Out of scope:

- production data analysis
- staging data analysis
- raw logs
- query results
- reports with data
- exports
- deletion execution
- correction execution
- retention execution
- implementation changes
- processor-portal access
- backups or dump inspection

No production queries were executed.
No database queries were executed.
No query results were produced.
No reports with data were produced.
No backups, dumps, or exports were opened.
No secrets were opened.
This document is a technical export schema design, not an implementation, not legal advice, and not a final compliance release.

## 3. Export Schema Design Principles

Any future DSAR export schema must remain:

- subject-scoped
- tenant/site-scoped
- minimal-necessary by default
- no cross-tenant data
- no secrets
- no internal debug data
- no raw query results
- no raw reports with data
- no raw logs without review and redaction
- no backup content
- no delivery internals that expose secrets
- no webhook signatures or signing secrets
- no provider tokens
- redaction-by-default for sensitive operational metadata
- explicit about omitted data classes
- explicit about scope and source metadata
- explicit about processor and recipient summaries
- approval-bound before implementation or execution

## 4. Export Bundle Structure

This section defines schema only, not a file and not a generated export artifact.

Future export bundles may use these top-level sections:

- `metadata`
- `request`
- `subject_scope`
- `tenant_scope`
- `included_sections`
- `omitted_sections`
- `redactions`
- `data`
- `processors_and_recipients`
- `retention_and_deletion_caveats`
- `evidence_summary`
- `export_generation_notes`

No real export bundle is generated in this task.
No JSON file is generated in this task.
No CSV file is generated in this task.
No ZIP file is generated in this task.
No real values are used in this task.

## 5. Metadata Section Design

| Field | Purpose | Example Placeholder | Required | Safety Notes |
| --- | --- | --- | --- | --- |
| `export_schema_version` | identify the schema revision used | `<schema_version>` | yes | schema metadata only |
| `generated_at` | record generation timestamp for a future approved export | `<timestamp>` | yes | timestamp only; not generated now |
| `request_id` | correlate export to request and internal evidence | `<request_id>` | yes | placeholder only |
| `export_scope` | high-level scope descriptor | `<approved_export_scope>` | yes | must not imply wildcard scope |
| `tenant_scope` | identify tenant scoping anchor | `<tenant_id>` | yes | placeholder only; no live tenant IDs |
| `site_scope` | identify site scoping anchor | `<site_id>` | yes | placeholder only; no live site IDs |
| `subject_identifier_type` | define approved subject matching method | `<subject_identifier_type>` | yes | no real identifier value |
| `included_data_areas` | list included schema areas | `<included_area_list>` | yes | categories only |
| `omitted_data_areas` | list omitted or blocked schema areas | `<omitted_area_list>` | yes | categories only |
| `redaction_policy_version` | identify redaction model revision | `<redaction_policy_version>` | yes | schema metadata only |
| `generated_by_role` | identify operator role allowed to run a future export | `<approved_operator_role>` | yes | role class only |
| `approval_reference` | reference the execution approval gate | `<approval_reference>` | yes | placeholder only |
| `retention_caveat_reference` | link export to retention/deletion caveats | `<retention_caveat_reference>` | yes | schema metadata only |

Placeholders allowed here:

- `<request_id>`
- `<tenant_id>`
- `<site_id>`
- `<subject_identifier_type>`

No real values are allowed in this document.

## 6. Request Section Design

This section captures process state for a future approved export request.

Required fields:

- `request_type`
- `intake_channel`
- `verification_status`
- `requester_authority_status`
- `requested_scope`
- `approved_scope`
- `rejected_or_deferred_scope`
- `legal_review_status`
- `product_review_status`
- `security_review_status`

No real requester data is documented here.

## 7. Subject / Tenant / Site Scope Design

Future export execution must enforce:

- subject matching must be approved before export
- tenant/site scoping is required
- organization or contact authority must be verified
- cross-tenant export is forbidden
- ambiguous identifiers must stop the export
- broad wildcard subject queries are forbidden

| Scope Field | Purpose | Risk | Required Before Export |
| --- | --- | --- | --- |
| `subject_identifier_type` | document the approved matching strategy | ambiguous subject match can leak another person's data | verified identity and approved matching rule |
| `subject_identifier_reference` | correlate to approved internal evidence | weak or missing linkage can produce overbroad export | approved evidence reference |
| `tenant_scope` | constrain data to one tenant | cross-tenant exposure | tenant ownership and authorization verified |
| `site_scope` | constrain data to one site or approved site list | overbroad site inclusion | site access and scope approved |
| `requester_authority_status` | confirm subject or authorized representative | impersonation | identity and authority verified |
| `scope_ambiguity_status` | record whether identifiers are unresolved | accidental disclosure | export blocked if ambiguous |

## 8. Data Section Candidate Model

| Data Section | Candidate Data Categories | Default Status | Export Safety | Required Review |
| --- | --- | --- | --- | --- |
| `public_widget_sessions` | session identifiers, site scope, timestamps, source URL class, consent metadata | `candidate_summary_only` | no raw browser secrets, no debug fields | privacy, product |
| `conversations_messages` | message timestamps, roles, message content candidate, answer content candidate, source-reference candidate | `candidate_redacted` | free text may contain PII; no internal knowledge/debug payload by default | privacy, legal, product |
| `leads_contact_requests` | contact identifiers, contact channels, submitted fields candidate, request context candidate | `candidate_redacted` | direct contact data; no downstream secrets | privacy, legal |
| `tenant_site_config` | site metadata, privacy URL, allowed-domain classes, module flags | `candidate_summary_only` | org config may expose internal state | product, legal |
| `dashboard_admin_users` | admin-role summary, actor classes, account-state metadata | `omitted_by_default` | workforce/admin data is not automatically subject-exportable | legal, security |
| `auth_session_metadata` | session and cookie metadata classes | `omitted_by_default` | security-sensitive and often not useful for subject-facing export | security, privacy |
| `email_jobs` | job status summaries, retry classes, recipient class, redacted payload summary | `omitted_by_default` | raw mail payload and delivery internals are high-risk | privacy, legal, security |
| `webhook_jobs` | job status summaries, delivery type, external recipient class, redacted payload summary | `omitted_by_default` | raw payloads, headers, signatures, and tokens are high-risk | privacy, legal, security |
| `report_runs_analytics` | report metadata classes, aggregate summaries, omission indicators | `candidate_summary_only` | no raw report rows, no query output, derived-PII risk | privacy, product, legal |
| `audit_security_logs` | event classes, timestamps, severity, redacted context | `candidate_redacted` | no raw production logs, no secrets, no unredacted snippets | security, privacy, legal |
| `incident_docs` | incident reference candidates, redacted operational notes | `omitted_by_default` | incident material must avoid customer data | security, legal |
| `backup_offsite_references` | policy references, retention caveats, processor class only | `blocked_without_approval` | backup content is never directly exported by default | SRE, privacy, legal |
| `external_provider_references` | provider classes, purpose categories, retention status, coordination status | `candidate_summary_only` | provider inventory may be incomplete | privacy, legal, product |
| `dsar_evidence_records` | request and approval summary, omission summary, redaction summary | `candidate_summary_only` | internal evidence must be separated from export-visible summary | privacy, security, legal |

Default status meanings:

- `candidate_include`
- `candidate_summary_only`
- `candidate_redacted`
- `omitted_by_default`
- `blocked_without_approval`

High-risk sections remain at least approval-bound or omitted by default:

- `email_jobs`
- `webhook_jobs`
- `report_runs_analytics`
- `audit_security_logs`
- `backup_offsite_references`

Backups are not directly exportable.
Query results are not exportable.
Reports with data are not exportable.

## 9. Public Widget / Conversation Section Schema

Candidate field categories only:

- `session_id`
- `site_scope`
- `message_timestamps`
- `message_roles`
- `message_content_candidate`
- `answer_content_candidate`
- `source_references_candidate`
- `redaction_notes`
- `omitted_internal_fields`

Safety constraints:

- no debug fields
- no internal knowledge chunks unless legally and product-approved
- no secret or provider data
- no delivery internals
- free-text may contain PII
- subject matching remains unresolved without an approved discovery method

## 10. Lead / Contact / Handoff Section Schema

Candidate field categories only:

- `contact_identifier_candidate`
- `contact_channel_candidate`
- `submitted_fields_candidate`
- `request_context_candidate`
- `timestamps`
- `tenant_site_scope`
- `delivery_status_summary`
- `omitted_delivery_internals`
- `redaction_notes`

Safety constraints:

- no SMTP secrets
- no webhook secrets
- no raw delivery payload without review
- no cross-tenant data

## 11. Email Jobs / Webhook Jobs Section Schema

These sections must default to `summary_only` or `omitted_by_default`.

Candidate field categories:

- `job_id_candidate`
- `delivery_type`
- `status`
- `timestamps`
- `retry_count`
- `tenant_site_scope`
- `payload_summary_redacted`
- `external_recipient_class`
- `omitted_payload_fields`
- `redaction_notes`

Safety constraints:

- no raw payload by default
- no webhook signatures or signing secrets
- no provider tokens
- no delivery re-triggering
- no reads, writes, or updates in this task
- explicit approval required before any future export implementation

## 12. Reports / Analytics Section Schema

These sections must default to `summary_only` or `omitted_by_default`.

Candidate field categories:

- `report_id_candidate`
- `report_type`
- `generated_at`
- `tenant_site_scope`
- `aggregate_summary_candidate`
- `omitted_raw_rows`
- `redaction_notes`

Safety constraints:

- no raw reports with data
- no query runner
- no cross-tenant analytics
- derived PII risk remains
- aggregates are allowed only if non-identifying and explicitly approved

## 13. Logs / Audit / Incident Section Schema

These sections must default to redacted or summary-only.

Candidate field categories:

- `event_type`
- `timestamp`
- `severity`
- `actor_type_candidate`
- `subject_scope_candidate`
- `redacted_context`
- `omitted_raw_log_fields`
- `secret_like_hit_indicator`
- `incident_reference_candidate`

Safety constraints:

- no raw production logs
- no secrets
- no unredacted message snippets
- security logs may require retention and legal review
- incident docs must avoid customer data

## 14. Backup / Offsite Section Schema

This section must document that backup content is not directly exportable.

Required statements:

- backup content is not exported
- only backup-retention caveat or reference may be included
- offsite storage may be referenced only as processor class
- deletion and erasure caveats must be documented
- production backup content remains blocked
- restore-derived data remains blocked

Candidate field categories:

- `backup_policy_reference`
- `retention_caveat`
- `offsite_processor_class`
- `omitted_backup_content_reason`

## 15. External Processor / Recipient Section Schema

Candidate field categories:

- `provider_class`
- `processing_purpose_candidate`
- `possible_data_categories`
- `DPA_status`
- `retention_status`
- `deletion_coordination_status`
- `evidence_level`
- `follow_up`

Safety constraints:

- no provider secrets
- no URLs with tokens
- customer-owned endpoints require explicit scoping
- processor inventory may be incomplete

## 16. Omitted Data Section Design

Required fields:

- `omitted_area`
- `reason`
- `risk`
- `required_approval_for_future_inclusion`
- `legal_product_security_review_status`
- `follow_up`

Typical omitted areas:

- raw SQL results
- query runner output
- raw reports with data
- raw logs
- backup content
- webhook signatures or signing secrets
- provider tokens
- internal debug data
- cross-tenant data
- production backup data

## 17. Redaction Model

Required fields:

- `redaction_type`
- `affected_section`
- `reason`
- `irreversible` (`yes` or `no` as future field)
- `reviewer_role`
- `notes`

Redaction types:

- `secret_redaction`
- `token_redaction`
- `internal_debug_redaction`
- `cross_tenant_redaction`
- `third_party_secret_redaction`
- `log_context_redaction`
- `delivery_internal_redaction`

## 18. Validation Rules

Future export generation must fail closed when any of these rules is violated:

- export cannot be generated without verified identity
- export cannot be generated without tenant/site scope
- export cannot include cross-tenant data
- export cannot include secrets
- export cannot include raw query results
- export cannot include reports with data
- export cannot include backup content
- export cannot include raw logs without approval and redaction
- export cannot include raw email or webhook payload by default
- export cannot run without explicit DSAR execution approval
- `DB_READ_ONLY_AUDIT` remains not granted

## 19. Evidence / Audit Trail Design

This design must separate:

- internal evidence only
- export-visible summary

Internal evidence fields:

- `request_id`
- `approver_roles`
- `data_sources_checked`
- `data_sources_omitted`
- `redaction_decisions`
- `validation_checks`
- `response_timestamp`
- `evidence_retention_candidate`

Export-visible fields:

- `request_id`
- `scope`
- `included_sections`
- `omitted_sections`
- `redaction_summary`
- `processor_recipient_summary`
- `retention_caveats`

No real DSAR evidence is created in this task.

## 20. Abuse / Security Controls

Future implementation must:

- prevent impersonation
- prevent cross-tenant export
- prevent overbroad wildcard export
- prevent support or operator overreach
- prevent query or report leakage
- prevent secrets in export
- require dual control for high-risk exports
- require security-owner review for suspicious requests
- require rate limits and approval workflow

## 21. Schema Example Policy

Examples in this design may use placeholders only.

Allowed:

- pseudo-schema field names
- placeholder identifiers
- role placeholders
- status placeholders

Forbidden:

- realistic personal data examples
- real emails, names, phone numbers, or addresses
- realistic customer texts
- live tenant IDs
- real tokens or URLs with secrets
- committed JSON or CSV files

This document uses inline pseudo-schema only.

## 22. Export Schema Risk Register

| Risk | Section | Impact | Default Control | Severity | Pilot Impact | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| cross-tenant export | subject, tenant, and site scope | unauthorized disclosure across customers | tenant/site scope required, wildcard forbidden | Critical | High | scope and authority decision gate |
| raw query or report leakage | reports/analytics | direct or derived PII exposure | omitted by default, no query runner | Critical | High | export implementation plan with blocked raw rows |
| raw log leakage | logs/audit/incident | sensitive snippets or operational metadata exposure | redacted or summary-only | High | High | redaction and legal review model |
| secret leakage | metadata, integrations, logs, queue payloads | credential disclosure | secret redaction and omitted sections | Critical | High | secret-safe export validator |
| webhook signature or token leakage | email/webhook jobs, provider references | downstream compromise | omitted by default, token redaction | Critical | High | delivery-internal safety policy |
| raw email or webhook payload leakage | email and webhook job sections | direct contact and delivery data exposure | summary-only or omitted by default | Critical | High | queue/export execution decision gate |
| backup content leakage | backup/offsite section | hidden historical PII exposure | backup content blocked | Critical | High | backup verification decision gate |
| unverified requester | request and scope sections | export to wrong person | verified identity required | Critical | High | DSAR execution decision gate |
| overbroad subject matching | subject scope | incomplete or excessive export | ambiguous identifiers stop export | High | High | approved matching/discovery plan |
| incomplete processor inventory | processor section | missing downstream data categories | summary-only with follow-up required | High | High | processor inventory and DPA follow-up |
| deletion or retention caveat missing | caveats/evidence | misleading export about data lifecycle | retention caveat reference required | Medium to High | High | retention/deletion alignment review |
| DSAR evidence overexposure | evidence summary | operational data leakage in subject-facing export | internal vs external evidence split | High | Medium to High | evidence model hardening |

## 23. Pilot Go / No-Go Criteria

Pilot Go only when:

- `DSGVO-1A` PII Data Map exists
- `DSGVO-1B-R` Processing / Retention / DSAR Gap Audit exists
- `DSGVO-1C` DSAR / Privacy Export Safety Design exists
- `DSGVO-1D` Retention / Deletion Policy Design exists
- this `DSGVO-1E` DSAR Export Schema Design exists
- no High/Critical security findings remain open
- public widget boundary is documented
- tenant-isolation risk is addressed or explicitly planned
- export schema excludes query results, reports with data, secrets, and backup content by default
- DSAR execution remains approval-bound
- privacy owner path is planned
- processor/DPA follow-up is planned

Pilot No-Go when:

- export path requires direct query runner or SQL
- report or query data would be exposed
- cross-tenant scope is unclear
- `DB_READ_ONLY_AUDIT` is treated as granted
- raw backup, log, email-job, or webhook-job payloads are included by default
- no privacy owner or no DSAR owner path exists
- High/Critical security findings remain open

## 24. Required Follow-ups

Recommended follow-ups:

- `DSGVO-1F DSAR Execution Decision Gate`
- `DSGVO-1G Retention / Deletion Implementation Decision Gate`
- `DSGVO-1H DSAR Export Implementation Plan`
- `ENT-SEC-1A Enterprise Security Gap Audit`
- `SRE-2F Production Backup Verification Decision Gate`, only after privacy guardrails

Recommended immediate next step:

- `DSGVO-1F DSAR Execution Decision Gate`

Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

## 25. Stop Boundaries

This design explicitly does not:

- read a database
- execute SQL
- use a query runner
- generate reports
- execute a DSAR request
- execute an export
- generate a JSON, CSV, or ZIP export file
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

## 26. Non-goals

- no legal advice
- no final GDPR / DSGVO compliance rating
- no implementation
- no DB access
- no SQL
- no query runner
- no reports
- no export
- no JSON/CSV/ZIP export file
- no DSAR execution
- no deletion
- no correction
- no retention action
- no backup or restore
- no deploy
- no runtime changes
- no customer data
- no secrets
