# DSGVO DSAR Export Implementation Plan

Stand: 2026-07-23

## 1. Summary

This document is a documentation-only implementation plan for a later DSAR export path.

Purpose:

- translate the prior DSGVO export safety, schema, execution-gate, retention, and enterprise-control documents into an implementation plan candidate
- define candidate implementation components, section collectors, validation steps, redaction rules, and delivery boundaries
- document what would still be required before any real DSAR export implementation or execution can be approved
- keep later implementation work tenant-scoped, subject-scoped, reviewable, and explicitly blocked until the remaining approvals exist

This step is intentionally `DOKU_ONLY`.

This plan does not:

- execute any DSAR request
- generate any export
- generate a JSON, CSV, or ZIP export
- read any database
- execute SQL
- use a query runner
- generate reports
- read production or staging data
- read production or staging logs
- open backups, dumps, or prior exports
- execute deletion, correction, or retention actions
- document real requester data
- document real customer data
- document secrets, tokens, or connection strings
- grant final legal or compliance approval

This document is a technical implementation plan, not legal advice and not a final compliance release.

## 2. Implementation Decision Summary

Current implementation decision status:

- `dsar_export_implementation_approved: no`
- `dsar_export_execution_approved: no`
- `export_file_generation_approved: no`
- `json_export_approved: no`
- `csv_export_approved: no`
- `zip_export_approved: no`
- `DB_READ_ONLY_AUDIT: not_granted`
- `production_db_access: not_granted`
- `query_runner: not_granted`
- `reports_with_data: not_granted`
- `production_data_access: not_granted`
- `production_secret_access: not_granted`
- `export_delivery_approved: no`
- `deletion_or_retention_execution_approved: no`
- `deploy_required_by_this_plan: no`

Reasons:

- no explicit human approval for DSAR export implementation is present in this task
- no real execution approval is present in this task
- no approved `DB_READ_ONLY_AUDIT` exists
- no approved query runner exists
- no approved export delivery model exists
- the identity, tenant, and subject gate is only designed and not validated
- privacy, legal, product, and security review still remain required

## 3. Current Preconditions Review

| Precondition | Status | Decision Impact |
| --- | --- | --- |
| `DSGVO-1A` PII Data Map exists | `yes` | baseline available |
| `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit exists | `yes` | baseline available |
| `DSGVO-1C` DSAR / Privacy Export Safety Design exists | `yes` | safety baseline available |
| `DSGVO-1D` Retention and Deletion Policy Design exists | `yes` | retention boundary available |
| `DSGVO-1E` DSAR Export Schema Design exists | `yes` | schema boundary available |
| `DSGVO-1F` DSAR Execution Decision Gate exists | `yes` | execution approval remains blocked |
| `DSGVO-1G` Retention / Deletion Implementation Decision Gate exists | `yes` | deletion and retention execution remain blocked |
| `ENT-SEC-1C` Enterprise Pilot Control Plan exists | `yes` | enterprise control baseline available |
| identity verification path approved | `no` | implementation cannot proceed to execution |
| tenant/site scope verification approved | `no` | export remains blocked |
| subject matching approach approved | `no` | export remains blocked |
| privacy owner confirmed | `not_proven_here` | approval chain incomplete |
| DSAR owner confirmed | `not_proven_here` | approval chain incomplete |
| legal/product/security review completed | `no` | execution blocked |
| `DB_READ_ONLY_AUDIT` approved | `no` | any real DB discovery blocked |
| query runner approved | `no` | query-based export blocked |
| report generation approved | `no` | report-bearing outputs blocked |
| export delivery method approved | `no` | no real subject-facing output allowed |
| export storage/expiry approved | `no` | artifact lifecycle blocked |
| encryption/key handling approved | `no` | secure delivery not defined |
| redaction review approved | `no` | content-bearing export blocked |
| processor coordination approved | `no` | third-party disclosure path blocked |
| evidence retention approved | `no` | case handling incomplete |

Interpretation:

- documentation prerequisites exist
- implementation and execution prerequisites do not exist
- this task remains planning-only

## 4. Implementation Architecture Candidate

| Component | Purpose | Allowed Future Inputs | Blocked Inputs | Privacy Risk | Required Approval | Test Strategy Candidate |
| --- | --- | --- | --- | --- | --- | --- |
| DSAR request intake adapter | normalize request metadata and request class | approved request metadata, approved operator metadata | real unverified requester payloads, production secrets | authority confusion | privacy owner, DSAR owner | synthetic request-shape tests |
| identity verification gate | confirm requester identity and authority | approved verification result, approved representative proof | ambiguous identity, raw secret-bearing verifier payloads | wrongful disclosure | privacy, legal, security | synthetic identity-pass and identity-fail tests |
| tenant/site scope resolver | constrain export to approved tenant and site scope | approved tenant and site references | wildcard scope, cross-tenant scope | cross-tenant disclosure | product, security, privacy | synthetic tenant-isolation tests |
| subject matching resolver | bind subject identifiers to approved subject scope | approved deterministic subject keys | fuzzy, wildcard, or ambiguous subject matching | overbroad export | privacy, legal, security | subject-match ambiguity tests |
| export planner | decide which sections are candidate include vs omit | approved schema categories and omission rules | real query output, report data | over-inclusion | privacy, product | plan-shape tests |
| data section collectors | gather future section payloads under approval | approved synthetic fixtures or later approved sanitized inputs | live DB results, raw reports, raw logs | direct PII exposure | per-section approvals | section-collector fixture tests |
| redaction / omission engine | remove or summarize blocked content | approved synthetic placeholders, approved redaction rules | raw secrets, tokens, raw logs | secret leakage | privacy, security | no-secrets and redaction tests |
| export bundle builder | assemble approved future export shape | validated section objects | real JSON/CSV/ZIP generation in current phase | data packaging risk | implementation approval | pseudo-schema assembly tests |
| validation engine | enforce scope, omission, and no-secrets rules | synthetic bundle candidates | live production data | validation gaps can leak data | security, privacy | validation matrix tests |
| evidence/audit trail writer | record safe evidence summary for future case handling | synthetic evidence entries, approved references | raw logs, production secrets | sensitive audit leakage | privacy, security, legal | evidence-summary tests |
| delivery/storage adapter | define future output transport and lifecycle boundary | approved delivery metadata only | email attachments, public links, webhook delivery without approval | uncontrolled disclosure | security, legal, privacy | configuration-shape tests only |
| expiration/disposal handler | define future lifecycle of generated artifacts | approved expiry policy metadata | real deletion actions in this phase | artifact retention risk | privacy, legal, SRE | expiry-policy rule tests only |

## 5. Data Section Implementation Plan

| Data Section | Candidate Implementation Plan | Default Status | Safety Notes |
| --- | --- | --- | --- |
| subject metadata | represent approved requester and subject scope metadata only | `candidate_redacted` | no raw identity evidence in repo |
| tenant/site scope | capture approved tenant and site boundaries | `candidate_summary_only` | no wildcard scope |
| public widget conversation/session | treat as future candidate subject to identity and scope validation | `candidate_redacted` | free text remains high-risk |
| messages / parts | future candidate with omission and redaction rules | `candidate_redacted` | no internal debug payloads |
| lead/contact/handoff | future candidate with strict field minimization | `candidate_redacted` | direct contact data is sensitive |
| tickets/support interactions | future candidate only after separate scope review | `candidate_redacted` | may include mixed-party data |
| `email_jobs` | approval-bound or omitted by default | `omitted_by_default` | no raw mail payloads or delivery internals |
| `webhook_jobs` | approval-bound or omitted by default | `omitted_by_default` | no raw payloads, headers, or signatures |
| `report_runs` | omitted or summary-only future candidate | `omitted_by_default` | no reports with data |
| analytics/aggregates | summary-only future candidate | `candidate_summary_only` | avoid re-identification risk |
| logs/audit/incident | summary-only redacted future candidate | `candidate_redacted` | no raw logs |
| backup/offsite references | omitted with caveat only | `omitted_by_default` | backup content remains blocked |
| external processor/recipient summary | category-level future summary only | `candidate_summary_only` | no processor-side raw subject payload |
| omitted data section | always describe excluded classes and reasons | `candidate_summary_only` | required to explain blocked areas |
| evidence/audit trail section | future summary-only evidence metadata | `candidate_summary_only` | no raw internal audit material |

Defaults:

- normal user-facing data stays candidate-only and approval-bound
- `email_jobs`, `webhook_jobs`, and `report_runs` stay approval-bound or omitted by default
- logs, audit, and incident material stay summarized and redacted only
- backup and offsite content stay omitted
- query results and reports with data stay not allowed
- secrets, tokens, and provider credentials stay always omitted

## 6. Identity / Tenant / Subject Matching Plan

Any future implementation must enforce:

- no export without verified requester identity
- tenant and site scoping is mandatory
- subject identifier matching must be deterministic and reviewed
- wildcard subject matching is forbidden
- ambiguous subject matches block execution
- cross-tenant data disclosure is forbidden
- organization contact authority must be verified
- support or operator roles cannot bypass scope controls
- no real requester data may appear in repository files, PRs, or docs

Implementation consequence:

- identity, tenant, and subject resolution must be separate gates, not hidden inside a generic export function
- if those gates are not approved, export collection must remain blocked

## 7. Redaction / Omission Plan

Any future implementation must enforce these defaults:

- secrets are always omitted
- provider tokens are always omitted
- internal IDs are redacted or scoped as needed
- third-party personal data is redacted unless explicitly in scope
- security and audit metadata is summarized
- raw logs are omitted by default
- raw reports are omitted
- backup content is omitted
- email and webhook payloads are omitted or redacted unless explicitly approved
- the omitted-data section must explain excluded categories without exposing data

## 8. Export Format Plan

Future bundle shape candidate:

- metadata section
- request section
- scope section
- data sections
- omitted data section
- processor and recipient summary
- evidence and caveat section
- validation result section

Pseudo-schema only:

```text
export_bundle
  metadata
  request
  subject_scope
  tenant_site_scope
  included_sections
  omitted_sections
  redactions
  data
  processors_and_recipients
  evidence_and_caveats
  validation_result
```

Constraints:

- no actual JSON is generated in this task
- no actual CSV is generated in this task
- no actual ZIP is generated in this task
- no real values are documented in this task

## 9. Validation Plan

Future implementation validation areas:

- schema validation
- tenant and site scope validation
- subject scope validation
- redaction validation
- no-secrets validation
- no-cross-tenant validation
- no-query-results validation
- no-raw-reports validation
- no-backup-content validation
- evidence completeness validation
- export size and pagination candidate review
- expiry and disposal validation

Current status:

- validation is planned only
- no implementation is approved
- no test code is introduced in this task

## 10. Security / Abuse Controls

Future control candidates:

- rate limiting candidate
- admin approval workflow candidate
- dual review candidate
- audit logging candidate
- replay protection candidate
- export expiry candidate
- encryption and key-handling as a separate design
- delivery channel as a separate design

Defaults:

- no email attachment by default
- no public link by default
- no webhook delivery by default
- no support-bypass path by default

## 11. Delivery / Storage / Expiry Boundary

Current decision state:

- export delivery: not approved
- export storage: not approved
- email attachment: not approved
- public download link: not approved
- customer portal upload: not approved
- webhook delivery: not approved
- encryption and key handling: not approved
- expiry and disposal policy: required before any real execution

Interpretation:

- delivery is a separate approval path
- storage is a separate approval path
- no real export artifact may be produced before both are approved

## 12. Implementation Phases

| Phase | Description | Status |
| --- | --- | --- |
| Phase 0 | `DOKU_ONLY` implementation plan | `current_step` |
| Phase 1 | local pseudo-schema and synthetic fixture design | `future_candidate_only` |
| Phase 2 | local synthetic export dry run | `future_candidate_only` |
| Phase 3 | non-production sanitized-data evaluation | `future_candidate_only` |
| Phase 4 | production implementation | `blocked_without_explicit_approval` |
| Phase 5 | real DSAR execution | `blocked_without_explicit_approval` |

Only Phase 0 is covered now.
All later phases require explicit approval.

## 13. Test Strategy Candidate

Future implementation tests may include:

- unit tests with synthetic data
- redaction tests with placeholder values
- tenant isolation tests
- subject matching tests
- omitted-section tests
- no-secrets tests
- no-query-runner tests
- export-shape tests
- evidence audit-trail tests
- no-real-data tests
- no-production-DB tests

No tests are implemented in this task.

## 14. Approval Status Matrix

| Approval Area | Status |
| --- | --- |
| DSAR owner approval | `not_granted` |
| privacy owner approval | `not_granted` |
| legal review | `not_granted` |
| product review | `not_granted` |
| security review | `not_granted` |
| implementation approval | `not_granted` |
| execution approval | `not_granted` |
| `DB_READ_ONLY_AUDIT` | `not_granted` |
| production DB access | `not_granted` |
| query runner approval | `not_granted` |
| report generation approval | `not_granted` |
| export generation approval | `not_granted` |
| export delivery approval | `not_granted` |
| storage and expiry approval | `not_granted` |
| encryption and key-handling approval | `not_granted` |
| processor coordination approval | `not_granted` |

## 15. Command / Tool Envelope

Allowed now:

- read-only repo, documentation, and code analysis
- pseudo-schema documentation
- implementation planning
- test strategy documentation

Still forbidden:

- DB reads
- SQL
- query runner usage
- reports with data
- export generation
- JSON, CSV, or ZIP generation
- production logs
- backup content access
- `email_jobs`, `webhook_jobs`, or `report_runs` reads, writes, or updates
- DSAR execution
- deletion, correction, or retention execution
- external delivery
- SMTP or email send
- webhook delivery
- deploy

## 16. Stop Criteria For Future Implementation

Stop any future implementation or execution if:

- identity verification design is missing
- tenant or site scope proof is missing
- subject matching is ambiguous
- production data would be required without explicit approval
- production secrets would be required
- `DB_READ_ONLY_AUDIT` would be required but is not approved
- query runner usage would be required
- reports with data would be required
- raw logs would be required
- backup content would be required
- raw email or webhook payloads would be required
- cross-tenant risk remains unresolved
- legal, product, or security review is missing
- DSAR owner is missing
- export delivery method is not approved
- real requester data would enter repo, PR, or docs
- secrets appear in output
- High or Critical security findings remain open

## 17. Relationship To Existing Docs

- `DSGVO-1A`: PII Data Map
- `DSGVO-1B-R`: Processing Purpose / Retention / DSAR Gap Audit
- `DSGVO-1C`: DSAR / Privacy Export Safety Design
- `DSGVO-1D`: Retention and Deletion Policy Design
- `DSGVO-1E`: DSAR Export Schema Design
- `DSGVO-1F`: DSAR Execution Decision Gate
- `DSGVO-1G`: Retention / Deletion Implementation Decision Gate
- `DSGVO-1H`: DSAR Export Implementation Plan
- `ENT-SEC-1C`: Enterprise Pilot Control Plan
- `SRE-2F`: Production Backup Verification Decision Gate

## 18. Recommended Next Step

Recommended next step:

- `DSGVO-1H-EXEC Local Synthetic DSAR Export Dry Run`, only with explicit approval

Alternatives without execution:

- `ENT-SEC-1C-HARDENING Enterprise Pilot Control Evidence Checklist`
- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`, only with explicit approval
- `SRE-2F-EXEC Production Backup Metadata Verification`, only with explicit approval

## 19. Stop Boundaries

This plan:

- reads no DB
- executes no SQL
- uses no query runner
- generates no reports
- executes no DSAR request
- executes no export
- generates no JSON, CSV, or ZIP
- executes no deletion, correction, or retention action
- opens no backups, dumps, or exports
- reads no secrets
- performs no production queries, health checks, or log access
- changes no production config
- performs no deploy
- documents no customer data
- grants no DSGVO compliance
- grants no real DSAR execution

## 20. Non-goals

Non-goals of this step:

- implement DSAR export code
- approve DSAR export code
- execute DSAR export code
- read staging or production databases
- generate query results
- generate reports with data
- generate JSON, CSV, or ZIP output
- implement delivery or storage logic
- approve delivery or storage logic
- execute deletion or retention actions
- inspect backups or exports
- use real requester or customer data
- claim final compliance readiness
