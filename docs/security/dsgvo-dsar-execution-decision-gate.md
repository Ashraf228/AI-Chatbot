# DSGVO DSAR Execution Decision Gate

Stand: 2026-07-22

## 1. Summary

This document is a documentation-only DSAR execution decision gate for Enterprise Pilot readiness.

Purpose:

- decide whether any real DSAR, privacy export, deletion, correction, restriction, objection, or retention execution is approved now
- document which preconditions are already covered by `DSGVO-1A` through `DSGVO-1E`
- document which approvals, owner roles, scoping proofs, and safety controls are still missing
- define which future execution paths may later become candidates and which areas remain blocked
- provide an explicit approval format for any later execution task

This step is intentionally `DOKU_ONLY`.

This gate does not:

- execute any DSAR request
- generate any export
- generate any JSON, CSV, or ZIP export file
- read any database
- execute SQL
- use a query runner
- generate reports
- execute deletion, correction, restriction, objection, or retention actions
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This document is a technical execution decision gate, not legal advice and not a final compliance release.

## 2. Decision Summary

Current execution decision:

- DSAR execution approved: `no`
- privacy export execution approved: `no`
- `DB_READ_ONLY_AUDIT` approved: `no`
- query runner approved: `no`
- reports with data approved: `no`
- production data approved: `no`
- production secrets approved: `no`
- deletion execution approved: `no`
- correction execution approved: `no`
- retention action approved: `no`
- human approval granted: `no`

Decision rationale:

- no explicit human approval for DSAR execution exists in this task
- no confirmed identity-verification pipeline is documented
- no confirmed tenant/site/subject discovery pipeline is documented
- no approved `DB_READ_ONLY_AUDIT` exists
- no approved query runner or report generation path exists
- no final legal review, product review, or security review is documented for execution
- no execution owner chain is fully confirmed for a live DSAR workflow
- no approved export delivery, storage, expiry, or processor-coordination model exists

## 3. Current Baseline And Repo-Evident Inputs

The following documentation building blocks exist and are treated as completed inputs to this gate:

- `DSGVO-1A` PII Data Map
- `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit
- `DSGVO-1C` DSAR / Privacy Export Safety Design
- `DSGVO-1D` Retention and Deletion Policy Design
- `DSGVO-1E` DSAR Export Schema Design

Current baseline from prior steps:

- `origin/main` baseline for the latest DSAR design track is `69111b3fd2003416921fe456e8df250f15a7667a`
- `production-context audit`: `PASS`
- the former `sharp` High blocker remains resolved
- the known `postcss` finding remains at most moderate and non-blocking
- no real production-data, production-secret, query-runner, report, export, deletion, or retention execution approval has been granted

Repo-visible technical surfaces that matter for future DSAR execution planning, but are not approved for use by this gate:

- site export and delete logic in `apps/api/src/site-data/site-data-export.service.ts`
- conversation export and deletion surfaces in `apps/api/src/conversations/conversations.controller.ts`
- widget lead export surfaces in `apps/api/src/modules/widget/controllers/widget-admin.controller.ts` and `apps/dashboard/app/api/widget/leads/export/route.ts`
- conversation export proxy surface in `apps/dashboard/app/api/conversations/export/route.ts`
- retention logic in `apps/api/src/retention/retention.service.ts`
- site-level delete logic in `apps/api/src/sites/sites.service.ts`
- repo-visible data classes in migrations such as:
  - `conversations`
  - `messages`
  - `widget_sessions`
  - `widget_events`
  - `report_runs`
  - `usage_events`
  - `usage_daily`
  - `email_jobs`
  - `webhook_jobs`
  - `agent_contact_requests`
  - `tenant_users`
  - `audit_logs`

These surfaces are evidence that execution-relevant data and commands exist in the codebase.
They are not treated as approved execution paths by this document.

## 4. Current Preconditions Review

| Precondition | Required For Execution | Current Status | Decision Impact |
| --- | --- | --- | --- |
| `DSGVO-1A` PII Data Map exists | data-class scoping | `yes` | baseline exists |
| `DSGVO-1B-R` Processing Purpose / Retention / DSAR Gap Audit exists | purpose and gap framing | `yes` | baseline exists |
| `DSGVO-1C` DSAR / Privacy Export Safety Design exists | safety boundaries | `yes` | baseline exists |
| `DSGVO-1D` Retention and Deletion Policy Design exists | deletion/retention boundary | `yes` | baseline exists |
| `DSGVO-1E` DSAR Export Schema Design exists | export-shape boundary | `yes` | baseline exists |
| identity verification pipeline confirmed | any disclosure or mutation | `no` | execution blocked |
| tenant/site scope verification confirmed | no cross-tenant exposure | `no` | execution blocked |
| subject matching approach confirmed | subject-bound discovery/export | `no` | execution blocked |
| privacy owner confirmed | privacy approval chain | `not_proven_here` | execution blocked until explicit confirmation |
| DSAR owner confirmed | workflow ownership | `not_proven_here` | execution blocked until explicit confirmation |
| legal review completed | lawful execution decision | `no` | execution blocked |
| product review completed | product-surface and UX safety | `no` | execution blocked |
| security review completed | secret, log, scope, and abuse safety | `no` | execution blocked |
| `DB_READ_ONLY_AUDIT` approved | any real DB discovery | `no` | execution blocked |
| query runner approved | any query-based execution | `no` | execution blocked |
| report generation approved | any report with data | `no` | execution blocked |
| export storage approved | any export artifact lifecycle | `no` | execution blocked |
| export delivery method approved | any subject-facing or customer-facing output | `no` | execution blocked |
| redaction review approved | any content-bearing export | `no` | execution blocked |
| processor coordination path approved | third-party or downstream systems | `no` | execution blocked |
| evidence retention policy approved | DSAR case evidence handling | `no` | execution blocked |

Interpretation:

- documentation prerequisites are largely in place
- execution prerequisites are not in place
- real execution remains blocked

## 5. Execution Decision Matrix

| Execution Area | Decision | Reason | Required Before Approval |
| --- | --- | --- | --- |
| identity verification | `no` / `blocked` | no verified DSAR identity path | approved verification design and owner |
| subject discovery | `no` / `blocked` | no approved subject matching strategy | subject match rules and ambiguity handling |
| tenant/site scoping | `no` / `blocked` | no approved DSAR scoping workflow | explicit tenant/site scope gate |
| DB discovery | `no` / `blocked` | `DB_READ_ONLY_AUDIT` not granted | separate explicit DB approval |
| query runner | `no` / `blocked` | query execution not approved | explicit runner approval and safe query classes |
| reports with data | `no` / `blocked` | reports can leak PII and internals | separate report approval and safe output policy |
| export bundle generation | `no` / `blocked` | schema exists, execution does not | implementation plan and safe generation path |
| export delivery | `no` / `blocked` | no approved delivery channel | delivery design, storage, expiry, encryption |
| deletion / erasure | `no` / `blocked` | no approved deletion execution path | separate deletion gate |
| correction / rectification | `no` / `blocked` | no approved correction ownership and audit path | separate correction design |
| restriction / objection | `no` / `blocked` | no suppression or policy workflow | separate restriction design |
| retention action | `no` / `blocked` | retention logic exists, execution not approved | separate retention/deletion gate |
| backup content lookup | `no` / `blocked` | backups remain high-risk and approval-bound | backup-content and privacy approvals |
| external processor coordination | `no` / `blocked` | no approved processor execution path | processor inventory and DPA review |
| evidence logging | `future design only` | evidence shape not finalized | approved evidence-retention and sanitization policy |

## 6. Approval Status Matrix

| Approval Area | Status | Required Before Execution | Notes |
| --- | --- | --- | --- |
| `privacy_owner_approval` | `not_granted` | explicit approval from privacy owner | not proven by current repo state |
| `dsar_owner_approval` | `not_granted` | explicit DSAR workflow ownership | not proven by current repo state |
| `legal_review` | `not_granted` | explicit legal review completion | this document is not legal advice |
| `product_review` | `not_granted` | product review of subject-facing behavior | required before execution |
| `security_review` | `not_granted` | security review of scope, logs, outputs, and delivery | required before execution |
| `human_operator_approval` | `not_granted` | explicit human approval text | absent in this task |
| `DB_READ_ONLY_AUDIT` | `not_granted` | separate explicit approval | still blocked |
| `query_runner_approval` | `not_granted` | separate explicit approval | still blocked |
| `report_generation_approval` | `not_granted` | separate explicit approval | still blocked |
| `export_generation_approval` | `not_granted` | implementation and safety approval | schema alone is insufficient |
| `export_delivery_approval` | `not_granted` | approved delivery/storage model | no channel approved |
| `redaction_review` | `not_granted` | approved redaction model for real content | no live-content approval |
| `processor_coordination_approval` | `not_granted` | approved provider coordination path | follow-up only |
| `backup_content_access` | `blocked` | explicit privacy/security/operator approval | no backup access here |
| `production_data_access` | `blocked` | explicit approval plus execution scope | production data remains blocked |
| `production_secret_access` | `blocked` | explicit security approval | secrets remain blocked |

## 7. Data Class Decision

| Data Class | Decision | Reason | Future Path |
| --- | --- | --- | --- |
| synthetic dummy data | `future candidate only` | safe for non-production planning | local synthetic dry run only |
| schema-only data | `future candidate only` | no real values | local schema validation only |
| generated fixture data | `future candidate only` | safe if isolated and disposable | local dry run only |
| sanitized non-production data | `conditional` | still requires approval and proof of sanitization | separate approval task |
| staging data | `blocked_without_approval` | staging may still contain sensitive real-like data | separate staging gate |
| production data | `blocked` | no production-data approval | not allowed |
| customer/tenant data | `blocked` | no real customer-data handling approved | not allowed |
| conversation/session data | `blocked` | free text and session linkage can expose PII | only after subject-scope approval |
| leads/contact data | `blocked` | direct identifiers and free text | only after identity and scope approval |
| `email_jobs` | `blocked` | delivery internals and content risk | separate queue-data decision |
| `webhook_jobs` | `blocked` | payload, recipient, and signature risk | separate webhook-data decision |
| `report_runs` | `blocked` | report metadata and derived-PII risk | separate reporting decision |
| logs/audit | `blocked` | operational and security sensitivity | only summarized/redacted future path |
| backups/offsite | `blocked` | backup content remains high-risk | separate backup gate |
| secrets/credentials | `blocked` | never valid export material | no export path |

## 8. Command / Tool Envelope Decision

Allowed only in a future explicitly approved local synthetic dry run:

- local fixture loading
- local schema-only mock export generation
- local validation of pseudo-schema structures
- local redaction-rule validation on synthetic placeholders
- local export-bundle shape checks without real data

Still forbidden:

- production DB reads
- staging or production SQL
- query runner usage
- reports with data
- production logs
- backup content access
- `email_jobs` / `webhook_jobs` / `report_runs` reads, writes, or updates
- `pg_dump`
- `pg_restore`
- `psql`
- `docker exec` against production
- `docker compose` against production
- external delivery
- SMTP or email send
- webhook delivery
- deletion, correction, restriction, objection, or retention action
- deploy

## 9. Allowed Future Execution Candidate

Potential future task name:

`DSGVO-1F-EXEC Local Synthetic DSAR Export Dry Run`

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
- no external delivery
- no email or SMTP
- no webhooks
- no customer site mutation
- no actual data-subject response
- no real requester data
- no legal final compliance claim

This gate does not approve that task.
This gate only documents it as a future candidate.

## 10. Explicit Approval Format For Future Execution

Example approval wording for a future execution task:

> Ich gebe DSGVO-1F-EXEC Local Synthetic DSAR Export Dry Run frei,
> ausschliesslich in einer lokalen/disposable Non-production-Umgebung,
> ausschliesslich mit synthetic/schema-only/fixture Daten,
> ohne Production-Daten,
> ohne Production-Secrets,
> ohne Staging-Daten,
> ohne DB_READ_ONLY_AUDIT,
> ohne Production-DB-Zugriff,
> ohne Query Runner,
> ohne Reports mit Daten,
> ohne `email_jobs`/`webhook_jobs`/`report_runs` Reads/Writes,
> ohne Backup-Content,
> ohne externe Delivery-/SMTP-/Webhook-Ausfuehrung,
> ohne Loeschung,
> ohne Korrektur,
> ohne Retention-Aktion,
> ohne Deploy.

Important:

- this example is not an approval
- human approval status in this task remains `not_granted`

## 11. Required Evidence Before Any Future Execution

Any future execution task must document at least:

- task ID
- explicit approval text
- target environment
- data class
- proof of non-production data
- owner roles
- identity verification design
- tenant/site scoping design
- allowed command classes
- forbidden command classes
- expected validation signals
- cleanup and disposal plan
- log sanitization plan
- proof that no reports with data are produced
- proof that no secrets are exposed
- proof that no cross-tenant data can appear
- abort criteria
- evidence-retention candidate

## 12. Identity / Tenant / Subject Gate

Hard rules before any future execution:

- no export without identity verification
- no export without tenant/site scoping
- no wildcard subject matching
- ambiguous identifiers block execution
- organization-contact authority must be verified
- support or operator roles cannot bypass scope
- cross-tenant data is forbidden
- no real requester data may enter repo files, PR text, or documentation

## 13. Export Delivery Gate

Current state:

- no export delivery approved
- no email attachment approved
- no external link approved
- no customer portal upload approved
- no webhook delivery approved

Separate design still required for:

- delivery channel
- storage location
- retention or expiry
- encryption, password, or key handling
- operator release workflow

No real export file is created by this gate.

## 14. Deletion / Correction / Retention Gate

Current state:

- no deletion execution approved
- no correction execution approved
- no retention action approved
- no cleanup, backfill, or enforcement approved

Future requirements:

- deletion or correction requires a separate decision gate
- legal hold and incident hold must be checked before deletion
- backup and log deletion require a separate policy path

## 15. External Processor Gate

Current state:

- no provider requests are sent
- no provider portal is accessed
- no processor export or deletion coordination is executed
- no customer-owned endpoint is contacted

Follow-up remains required for:

- processor inventory
- DPA status
- third-party retention behavior
- provider-specific export/deletion responsibilities

## 16. Stop Criteria For Future Execution

Any future execution must stop immediately if:

- identity verification is missing
- tenant/site scope is missing
- subject identity is ambiguous
- production data would be required
- a production secret would be required
- `DB_READ_ONLY_AUDIT` would be required but is not approved
- a query runner would be required
- reports with data would be required
- raw logs would be required
- backup content would be required
- raw email or webhook payloads would be required
- cross-tenant risk is unresolved
- legal, product, or security review is missing
- an execution owner is missing
- export delivery is not approved
- real requester data would enter the repo, docs, or PR
- any secret appears in output
- any High or Critical security finding is open

## 17. Pilot Go / No-Go Impact

This decision gate improves readiness because:

- DSAR execution boundaries are now explicit
- missing approvals are named instead of implied
- future safe-scope candidates are narrower and easier to review

This decision gate does not approve execution.

Pilot remains blocked or yellow for real DSAR execution until:

- a DSAR execution owner path exists
- an identity-verification path exists
- a tenant/site scoping path exists
- an export-delivery path is designed
- legal, product, and security reviews are completed or scheduled
- processor and DPA follow-up exists
- no High or Critical security findings are open
- `DB_READ_ONLY_AUDIT` is not falsely treated as granted

## 18. Relationship To Existing DSGVO Docs

- `DSGVO-1A` = PII Data Map
- `DSGVO-1B-R` = Processing Purpose / Retention / DSAR Gap Audit
- `DSGVO-1C` = DSAR / Privacy Export Safety Design
- `DSGVO-1D` = Retention and Deletion Policy Design
- `DSGVO-1E` = DSAR Export Schema Design
- `DSGVO-1F` = DSAR Execution Decision Gate
- future `DSGVO-1F-EXEC` = separate explicit execution task only
- `DSGVO-1G` = Retention / Deletion Implementation Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## 19. Recommended Next Step

If no real execution is desired now:

- `ENT-SEC-1A Enterprise Security Gap Audit`

If technical planning should continue before any execution:

- `DSGVO-1H DSAR Export Implementation Plan`

If deletion or retention execution should be prioritized:

- `DSGVO-1G Retention / Deletion Implementation Decision Gate`

Recommended immediate next step:

- `ENT-SEC-1A Enterprise Security Gap Audit`

No execution recommendation is made without explicit approval.

## 20. Stop Boundaries

This gate explicitly:

- does not read any database
- does not execute SQL
- does not use a query runner
- does not generate reports
- does not execute any DSAR request
- does not generate any export
- does not generate any JSON, CSV, or ZIP export file
- does not execute deletion
- does not execute correction
- does not execute retention action
- does not open backups, dumps, or exports
- does not read secrets
- does not query production
- does not change production config
- does not deploy
- does not change the public widget response
- does not mutate any customer site
- does not grant GDPR / DSGVO compliance

## 21. Non-goals

- no legal advice
- no final GDPR / DSGVO compliance assessment
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
- no runtime change
- no customer data
- no secrets
