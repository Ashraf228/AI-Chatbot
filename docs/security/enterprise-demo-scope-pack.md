# Enterprise Demo Scope Pack

Stand: 2026-07-23

## Summary

This document is a documentation-only Enterprise Demo Scope Pack for the current post-`ENT-SEC-1E` baseline.

Purpose:

- define which enterprise demo forms are currently allowed, allowed with guardrails, conditional, or blocked
- define allowed and blocked demo content
- define data, screenshot, recording, claim, and customer-site boundaries
- keep the scoped Next/PostCSS exception visible without treating it as fixed
- provide reusable caveat language for internal and customer-facing demo preparation
- document approval-bound areas before any live execution

Enterprise-pilot focus:

- enterprise-pilot preparation only
- no demo execution
- no pilot approval
- no real-customer pilot approval
- no active enterprise outreach approval
- no enterprise-rollout approval
- no customer-data approval
- no production-data approval
- no monitor or alert setup approval
- no backup verification approval
- no DSAR or export execution approval
- no deploy approval

This step is intentionally `DOKU_ONLY`.

This scope pack does not:

- read any database
- execute SQL
- use a query runner
- generate reports
- execute any DSAR request
- execute any export
- generate JSON, CSV, or ZIP files
- execute deletion, correction, or retention actions
- execute backup or restore actions
- open backups, dumps, or exports
- execute health checks
- query production logs
- change runtime code, workflows, scripts, config, or feature flags
- change production config
- deploy anything
- document secrets, customer data, production data, real contact data, or real acceptance records
- grant final security, compliance, DSGVO, enterprise, or pilot approval
- mark Next/PostCSS as fixed

## Demo Scope Decision Summary

- `enterprise_demo_scope_pack_created: yes`
- `internal_product_walkthrough: allowed`
- `safe_demo_without_customer_data: allowed_with_guardrails`
- `synthetic_only_feature_preview: allowed_with_guardrails`
- `safe_test_internal_tenant_demo: conditional`
- `customer_facing_enterprise_demo: conditional_with_caveats`
- `real_customer_pilot_demo: blocked`
- `broad_enterprise_rollout_demo: blocked`
- `customer_data_use: no`
- `production_data_use: no`
- `production_secret_use: no`
- `DB_READ_ONLY_AUDIT: not_granted`
- `query_runner: not_granted`
- `reports_with_data: not_granted`
- `DSAR_execution: not_granted`
- `export_execution: not_granted`
- `backup_verification_execution: not_granted`
- `monitor_alert_setup: not_granted`
- `deploy_required_by_this_scope_pack: no`

## Demo Type Classification

| Demo Type | Current Status | Allowed Audience | Allowed Data | Required Caveat | Blocked Actions |
| --- | --- | --- | --- | --- | --- |
| internal product walkthrough | `allowed` | internal product, engineering, operations | synthetic or generic only | not a pilot or enterprise approval | no customer data, no production data, no execution |
| internal technical architecture walkthrough | `allowed` | internal engineering, security, architecture reviewers | synthetic or generic only | architecture-only, no live proof claim | no production API calls, no deploy, no secret disclosure |
| safe demo without customer data | `allowed_with_guardrails` | internal stakeholders, controlled pre-sales preparation | synthetic or generic only | not customer-data approval, not deploy approval | no customer data, no production data, no customer-site mutation |
| synthetic-only feature preview | `allowed_with_guardrails` | internal or tightly controlled external reviewers | synthetic fixtures only | current audit includes scoped temporary Next/PostCSS exception | no DB discovery, no query outputs, no real logs |
| safe-test/internal tenant demo | `conditional` | internal operators or explicitly approved internal test audience | approved safe-test or internal-tenant synthetic scope only | separate safe environment approval required | no customer data, no unapproved execution, no reports with data |
| customer-facing enterprise demo | `conditional_with_caveats` | external prospects, procurement, security reviewers | synthetic or generic only | mandatory customer-facing caveat set must be included | no enterprise-ready claim, no production-data claim, no deploy claim |
| procurement/security review walkthrough | `conditional_with_caveats` | external procurement or security reviewers | documentation-safe, synthetic, generic only | security baseline is green with a scoped temporary exception, not a legal or rollout approval | no secret sharing, no customer data, no live production proof |
| real-customer pilot demo | `blocked` | none by default | none | explicit acceptance would be required outside this scope pack | no customer data, no real-customer pilot expansion |
| production-data demo | `blocked` | none | none | production-data use is not approved | no production DB access, no logs, no exports, no reports |
| broad enterprise rollout demo | `blocked` | none | none | no unrestricted enterprise approval exists | no broad rollout claim, no production execution, no customer-site mutation |

## Allowed Demo Content

- high-level product walkthrough
- architecture overview
- security and readiness documentation walkthrough
- synthetic widget flow
- synthetic dashboard flow
- synthetic tenant or site example
- non-customer demo copy
- documented CI and security status labels
- documented dependency status labels
- documented SRE and DSGVO governance status labels
- known caveats and blockers
- future roadmap and approval-bound execution candidates

Allowed content conditions:

- synthetic or generic content only
- no real customer data
- no real contacts
- no real reports
- no real logs

## Blocked Demo Content

- real customer data
- production data
- production secrets
- real DSAR request
- real export
- JSON, CSV, or ZIP export files
- reports with data
- query runner output
- production logs
- backup metadata or backup content
- offsite provider metadata or content
- customer-site mutation
- live customer widget interaction without approval
- delivery side effects
- `email_jobs`, `webhook_jobs`, or `report_runs` content
- real alert destinations
- real contacts
- real credentials
- NOLIS-specific hardcoding or claims

## Demo Data Rules

- synthetic-only by default
- no customer identifiers
- no real names
- no real emails
- no real phone numbers
- no real addresses
- no real organization-specific sensitive data
- no copied customer transcripts
- no production exports
- no backup-derived data
- no query-result-derived data
- no screenshots containing real data
- no logs containing real data
- placeholders are allowed
- generic company and persona labels are allowed

## Demo Environment Boundary

- no deploy required by this scope pack
- no production config change
- no feature flag change
- no customer-site mutation
- no production DB access
- no `DB_READ_ONLY_AUDIT`
- no query runner
- no reports with data
- a safe demo environment must be approved before execution
- safe-test or internal-tenant use requires approval before execution
- any customer-facing demo requires explicit caveats
- any live production use requires separate approval

## Public Widget Demo Boundary

- synthetic-only widget demo is a future candidate
- no real customer-site mutation
- no live customer widget interaction without approval
- no lead creation unless explicitly approved
- no ticket creation unless explicitly approved
- no email or webhook delivery side effects
- no debug, preview, knowledge, delivery, or secret field exposure
- `siteKey` or safe-smoke evidence is only reusable if already documented elsewhere
- no new smoke test is executed by this document

## Dashboard / Admin Demo Boundary

- synthetic dashboard walkthrough is a future candidate
- no production tenant data
- no real user or customer details
- no query runner
- no reports with data
- no admin action that mutates production
- no feature flags
- no production config changes
- no screenshots with real data
- no live admin login demo unless separately approved

## API / Integration Demo Boundary

- architecture-level API explanation is allowed
- synthetic request and response examples are allowed if they contain no real values
- no live production API calls
- no webhook delivery
- no SMTP or email send
- no provider tokens
- no integration credentials
- no customer-specific integration claims
- no NOLIS-specific hardcoding claims

## Security / Compliance Claim Boundary

Allowed claims:

- security baseline currently PASS
- `production-context audit` currently PASS with a scoped temporary exception
- authorization matrix PASS
- security boundaries PASS
- SRE, DSGVO, and enterprise governance docs exist
- internal readiness and safe demo preparation are allowed with guardrails

Forbidden claims:

- fully enterprise ready
- broad rollout approved
- real-customer pilot approved
- DSGVO compliant
- legally approved
- PostCSS fixed
- backup or restore verified
- real monitoring or alerting operational
- DSAR, export, deletion, or retention execution operational
- `DB_READ_ONLY_AUDIT` approved
- customer data approved
- deploy approved

## Temporary Exception Demo Caveat

The current dependency caveat must be carried forward exactly as a caveat, not as a fix:

- Next/PostCSS is accepted temporarily, not fixed
- expiry: `2026-08-06`
- no deploy approval from the exception
- no enterprise rollout approval from the exception
- no customer-data approval from the exception
- stable Next upgrade remains required
- demo materials must not say the dependency issue is fixed
- customer-facing demos must include the caveat if the security baseline is discussed

## Required Caveats for Any Customer-Facing Demo

- this demo is not enterprise rollout approval
- this demo is not real-customer pilot approval
- this demo does not approve customer data
- this demo does not approve production data
- this demo does not approve deploy
- the current audit includes a scoped temporary Next/PostCSS exception
- Next/PostCSS is not fixed
- no `DB_READ_ONLY_AUDIT`
- no query runner
- no reports with data
- no DSAR, export, deletion, or retention execution
- no backup or restore execution
- no real monitoring or alerting setup
- no legal or DSGVO compliance approval

## Demo Script Outline

1. Intro and scope caveat
2. Architecture overview
3. Synthetic widget flow
4. Synthetic dashboard flow
5. Security and readiness posture overview
6. Governance docs overview
7. Blocked and not-granted areas
8. Next steps and required approvals

Outline constraints:

- outline only
- no screenshots
- no live execution
- no data values
- no customer specifics

## Demo Approval Checklist

| Approval Area | Required For | Current Status | Required Evidence | Notes |
| --- | --- | --- | --- | --- |
| `demo_owner` | any demo execution | `placeholder_only` | repo-safe owner placeholder outside this doc | required before execution |
| `technical_owner` | architecture, widget, dashboard, API explanation | `placeholder_only` | owner assignment outside repo-safe docs | required before execution |
| `security_owner` | customer-facing security claims and exception caveats | `placeholder_only` | security review path and exception awareness | caveat owner, not a blanket approval |
| `privacy_owner` | any privacy or DSGVO discussion beyond documentation baseline | `placeholder_only` | privacy escalation path | no live privacy execution approved |
| `customer_success_owner` | customer-facing scheduling or audience handling | `placeholder_only` | owner assignment outside repo | no customer communications auto-approved |
| `communications_owner` | external messaging consistency | `placeholder_only` | approved narrative path | required before public claims |
| `safe_demo_data_approval` | any synthetic or generic demo dataset | `conditional` | proof that data is synthetic and sanitized | no customer-derived content |
| `safe_environment_approval` | safe-test or internal-tenant demo | `not_granted` | approved environment boundary and rollback path | required before any live use |
| `customer_facing_demo_approval` | customer-facing enterprise demo | `conditional` | required caveat set and owner chain | still no customer data approval |
| `real_customer_data_approval` | any real customer content | `not_granted` | explicit separate approval | blocked by default |
| `production_data_approval` | any production-data use | `not_granted` | explicit separate approval | blocked by default |
| `deploy_approval` | any demo coupled to deploy or config change | `not_granted` | separate deploy decision | not granted by this pack |
| `recording_approval` | recording any demo artifact | `not_granted` | asset storage and retention plan | separate approval required |
| `screenshot_approval` | screenshots for reuse or distribution | `not_granted` | proof of synthetic-only, no secrets, no customer domains unless approved | separate approval required |
| `public_widget_demo_approval` | any live widget interaction | `not_granted` | widget-safe boundary and side-effect review | no live customer widget interaction by default |

Defaults:

- internal product walkthrough: allowed
- customer-facing demo: conditional
- real-customer-data approvals: not granted
- deploy approval: not granted

## Recording / Screenshot Rules

- no screenshots are generated by this document
- no recordings are generated by this document
- screenshots are only acceptable if they are synthetic and contain no customer data
- no secrets
- no real contacts
- no production logs
- no query results
- no reports with data
- no URLs with tokens
- no customer domains unless explicitly approved
- storage or retention of demo assets requires separate approval

## Stop Criteria Before Demo

- `production-context audit` FAIL
- scoped exception expired
- new non-excepted High or Critical finding
- a stable Next fix becomes available but is not evaluated before expiry
- the demo requires customer data
- the demo requires production data
- the demo requires `DB_READ_ONLY_AUDIT`
- the demo requires a query runner
- the demo requires reports with data
- the demo requires production logs
- the demo requires a real DSAR or export
- the demo requires backup or restore verification
- the demo requires monitor or alert setup
- owner approval is missing
- the required caveat cannot be included in a customer-facing demo

## Relationship to Existing Docs

- `ENT-SEC-1E` = Enterprise Pilot Readiness Summary Refresh
- `ENT-SEC-1F` = Enterprise Demo Scope Pack
- `ENT-SEC-1D` = Evidence Review Cadence
- `ENT-SEC-1C-HARDENING` = Evidence Checklist
- `ENT-SEC-1C` = Control Plan
- `ENT-SEC-1B` = Go/No-Go Decision
- `P0-Security-Audit-Drift-4E-POLICY` = scoped temporary Next/PostCSS exception
- `SRE-1G` = Monitor / Alert Setup Decision Gate
- `SRE-2F` = Production Backup Verification Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## Recommended Next Step

- `ENT-SEC-1F-D` for PR review and merge

After completion without execution:

- `ENT-SEC-1G Enterprise Demo Narrative / Talk Track` as `DOKU_ONLY`

Only with explicit approval:

- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`
- `SRE-2F-EXEC Production Backup Metadata Verification`
- `DSGVO-1H-EXEC Local Synthetic DSAR Export Dry Run`

## Stop Boundaries

- This scope pack executes no demo.
- This scope pack reads no database.
- This scope pack executes no SQL.
- This scope pack uses no query runner.
- This scope pack generates no reports.
- This scope pack executes no DSAR request.
- This scope pack executes no export.
- This scope pack generates no JSON, CSV, or ZIP export file.
- This scope pack executes no deletion.
- This scope pack executes no correction.
- This scope pack executes no retention action.
- This scope pack opens no backups, dumps, or exports.
- This scope pack reads no secrets.
- This scope pack performs no production queries.
- This scope pack executes no health checks.
- This scope pack queries no production logs.
- This scope pack changes no production config.
- This scope pack deploys nothing.
- This scope pack sets up no monitors or alerts.
- This scope pack documents no customer data.
- This scope pack documents no real contacts.
- This scope pack generates no screenshots or recordings.
- This scope pack grants no DSGVO compliance approval.
- This scope pack grants no real pilot approval.
- This scope pack grants no enterprise approval.
- This scope pack grants no deploy approval.
- This scope pack does not mark Next/PostCSS as fixed.

## Non-goals

- no implementation
- no demo execution
- no screenshots
- no recordings
- no deploy
- no monitoring setup
- no alert setup
- no DB access
- no SQL
- no query runner
- no reports
- no export
- no DSAR execution
- no deletion, correction, or retention execution
- no backup or restore
- no backup verification
- no runtime change
- no customer data
- no secrets
- no final DSGVO compliance approval
- no pilot approval
- no enterprise approval
- no change to the scoped Next/PostCSS exception
