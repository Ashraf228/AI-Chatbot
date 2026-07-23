# Enterprise Pilot Control Plan

Stand: 2026-07-23

## Summary

This document is a documentation-only Enterprise Pilot Control Plan based on the completed `ENT-SEC-1A Enterprise Security Gap Audit`, `ENT-SEC-1B Enterprise Pilot Go/No-Go Decision`, and `SRE-1G Real External Monitor / Alert Setup Decision Gate`.

Purpose:

- make the current `limited_enterprise_pilot = conditional_with_guardrails` decision operationally readable
- define allowed and blocked pilot-scope classes
- consolidate P0 follow-ups before active enterprise outreach
- define placeholder owner, approval, escalation, pause, rollback, and exit controls
- describe the evidence package required before any later real-customer pilot approval

This step is intentionally `DOKU_ONLY`.

This control plan does not:

- grant broad enterprise pilot approval
- grant real-customer pilot approval
- grant customer-data approval
- grant production-data approval
- read any database
- execute SQL
- use a query runner
- generate reports
- execute DSAR, export, deletion, correction, retention, cleanup, backfill, or enforcement actions
- open backups, dumps, or exports
- create monitors or alerts
- change runtime code, workflows, scripts, config, or feature flags
- execute health checks
- query production logs
- perform any deploy
- document secrets, real customer data, or real contact information
- grant final security, compliance, privacy, or DSGVO approval

## Control Plan Decision Summary

- `internal_readiness_work`: `allowed`
- `safe_demo_without_customer_data`: `allowed_with_guardrails`
- `safe_test_internal_tenant_pilot`: `conditional`
- `real_customer_data_pilot`: `blocked_until_p0_followups_or_explicit_acceptance`
- `active_enterprise_outreach`: `blocked_until_p0_followups_or_explicit_acceptance`
- `broad_enterprise_rollout`: `no`
- `production_data_access`: `no`
- `production_secret_access`: `no`
- `DB_READ_ONLY_AUDIT`: `not_granted`
- `query_runner`: `not_granted`
- `reports_with_data`: `not_granted`
- `DSAR_execution`: `not_granted`
- `export_execution`: `not_granted`
- `deletion_execution`: `not_granted`
- `retention_execution`: `not_granted`
- `backup_restore_execution`: `not_granted`
- `real_monitor_setup`: `not_granted`
- `real_alert_setup`: `not_granted`
- `deploy_required_by_this_plan`: `no`

## Allowed Scope Classes

| Scope Class | Decision | Allowed Conditions | Blocked Boundaries | Required Evidence |
| --- | --- | --- | --- | --- |
| internal readiness work | allowed | docs, audits, design, gated refactors without data execution | no DB, SQL, reports with data, deploy, or secrets | green baseline checks and in-scope diff |
| internal safe demo | allowed_with_guardrails | sanitized demos, synthetic-safe examples, architecture walkthroughs | no customer data, no production data, no secrets | safe inputs only and operator discipline |
| non-customer-data sales preparation | allowed_with_guardrails | presentations, readiness framing, safe synthetic references | no customer data, no production data, no enterprise-ready claim | guardrail language and approved placeholders |
| safe-test/internal tenant pilot | conditional | safe-test or internal tenant only, with documented rollback and review cadence | no customer-data ingestion, no unapproved execution paths | P0 follow-ups strongly preferred and explicit scope review |
| synthetic widget smoke | conditional | safe synthetic data only, bounded public widget response shape only | no customer-site mutation, no delivery side effects | approved safe synthetic boundary and review cadence |
| real-customer pilot | blocked_until_p0_followups_or_explicit_acceptance | none by default | no real-customer pilot without P0 closure or explicit acceptance | P0 closure or approved exception record |
| real-customer data processing | blocked_until_p0_followups_or_explicit_acceptance | none by default | no real customer data, no production data discovery | explicit acceptance and privacy/security owner chain |
| production data audit | blocked | none | `DB_READ_ONLY_AUDIT`, query runner, reports with data | separate explicit approval only |
| DSAR/export execution | blocked | none | no live DSAR, export, or delivery | approved DSAR owner path and execution gate |
| retention/deletion execution | blocked | none | no live deletion, correction, or retention action | separate execution approval only |
| backup/restore execution | blocked | none | no production backup verification, restore commands, or backup-content access | `SRE-2F` and explicit approval |
| external monitor/alert setup | blocked | none in this plan | no real monitor setup, no alert setup, no provider/account setup | `SRE-1G-EXEC` with explicit approval |
| broad enterprise rollout | no | none | unrestricted rollout remains blocked | close open P0 and P1 governance gaps |

## Required Guardrails For Allowed Preparation

Any currently allowed preparation remains subject to these guardrails:

- no customer data unless explicitly approved
- no production data
- no production secrets
- no `DB_READ_ONLY_AUDIT`
- no SQL
- no query runner
- no reports with data
- no DSAR, export, deletion, or retention execution
- no backup or restore execution
- no production config changes
- no feature flags without separate approval
- no deploy unless a separate deploy gate exists
- no customer-site mutation
- no NOLIS-specific hardcoding
- safe synthetic data only
- documented rollback point for any later approved deploy
- daily health review if a pilot is active
- incident logging if any pilot-affecting signal appears

## P0 Prerequisites Before Active Enterprise Outreach

| Prerequisite | Current Status | Required Owner | Required Evidence | Blocking Level |
| --- | --- | --- | --- | --- |
| real external monitor / alert setup decision or execution | decision gate exists, real setup not approved | `SRE_owner` | `SRE-1G` status and any later `SRE-1G-EXEC` evidence | P0 |
| alert routing owner path | role model exists, live owner path not proven | `SRE_owner` | approved route ownership and escalation path | P0 |
| incident commander / on-call model | documented as role model, not operationally proven | `incident_commander` | named path and review routine | P0 |
| production backup verification decision gate | not completed | `backup_owner` + `restore_owner` | `SRE-2F` outcome | P0 |
| backup owner | not confirmed | `backup_owner` | named owner placeholder resolved outside repo-safe docs | P0 |
| restore owner | not confirmed | `restore_owner` | named owner placeholder resolved outside repo-safe docs | P0 |
| processor / DPA inventory | incomplete | `processor_DPA_owner` | provider inventory and DPA status | P0 |
| privacy owner | not confirmed | `privacy_owner` | named owner and escalation path | P0 |
| DSAR owner | not confirmed | `DSAR_owner` | named workflow owner | P0 |
| production config owner | not confirmed | `production_config_owner` | ownership and recovery path | P0 |
| pilot daily health review operationalization | checklist exists, live routine not proven | `pilot_owner` | review cadence, record format, and owner path | P0 |
| public widget safe smoke policy | baseline exists, ongoing discipline required | `technical_owner` + `deploy_owner` | safe-smoke routine and response-shape control | P0 |
| rollback evidence path | documented baseline exists | `deploy_owner` | exact commit or image rollback evidence | P0 |
| customer communication owner | role exists, owner path not proven | `communications_owner` | approved communications path | P0 |
| explicit acceptance if real-customer pilot starts before P0 closure | not granted | `pilot_owner` + required domain owners | signed exception record with expiry and scope | P0 |

## Pilot Owner / Role Model

All roles below are placeholders only.
No real people, emails, phone numbers, channels, or contact paths are documented here.

| Role | Required Before | Current Status | Responsibility | Notes |
| --- | --- | --- | --- | --- |
| `pilot_owner` | any active limited pilot | `not_confirmed` | overall pilot continuation, pause, and guardrail discipline | placeholder only |
| `technical_owner` | pilot-impacting technical scope | `not_confirmed` | technical readiness, follow-up tracking, and surface review | placeholder only |
| `security_owner` | security-significant or real-customer pilot scope | `not_confirmed` | security classification, exception review, and exposure response | placeholder only |
| `privacy_owner` | any real-customer data or privacy-sensitive scope | `not_confirmed` | privacy escalation path and PII guardrails | placeholder only |
| `SRE_owner` | monitoring, alerting, and health-review scope | `not_confirmed` | operational review cadence and monitoring follow-ups | placeholder only |
| `incident_commander` | incident-capable pilot operation | `not_confirmed` | incident ownership and severity coordination | placeholder only |
| `deploy_owner` | any pilot-impacting deploy | `not_confirmed` | rollback point, deploy evidence, and recovery coordination | placeholder only |
| `backup_owner` | backup governance and verification | `not_confirmed` | backup evidence, cadence, and follow-up ownership | placeholder only |
| `restore_owner` | restore governance and decision inputs | `not_confirmed` | restore-readiness, drill prerequisites, and stop criteria | placeholder only |
| `customer_success_owner` | any customer-facing pilot communication | `not_confirmed` | customer impact framing and readiness input | placeholder only |
| `communications_owner` | external or customer communication | `not_confirmed` | safe outbound status communication | placeholder only |
| `processor_DPA_owner` | processor inventory or DPA follow-up | `not_confirmed` | provider and processor governance | placeholder only |
| `production_config_owner` | any later production config scope | `not_confirmed` | config control, ownership, and recovery path | placeholder only |
| `DSAR_owner` | any later subject-rights execution scope | `not_confirmed` | DSAR workflow ownership and evidence expectations | placeholder only |

## Explicit Acceptance Format

If a real-customer pilot should begin before the full P0 set is closed, an explicit human acceptance record is required.

Minimum example format:

```text
I approve a time-bounded real-customer pilot exception under ENT-SEC-1C with the following accepted gaps:
- accepted gaps:
- pilot duration:
- customer scope:
- data scope:
- allowed features:
- blocked features:
- owners:
- incident contact path:
- privacy contact path:
- monitoring expectation:
- backup/restore caveat:
- DSAR/export/deletion caveat:
- rollback/pause criteria:
- review cadence:
- expiry date:
- revalidation trigger:
```

This is only an example.
It is not a granted acceptance.
It does not authorize any real customer data, production data, deploy, monitor setup, alert setup, DB access, or privacy execution by itself.

## Operational Control Cadence

| Cadence | Purpose | Safe Inputs | Blocked Inputs | Owner Placeholder | Output / Evidence |
| --- | --- | --- | --- | --- | --- |
| daily health review | confirm active pilot health and open blockers | documented health summaries, safe smoke status, approved metadata-only signals | no DB reads, no raw logs, no query results, no customer data | `pilot_owner` | daily readiness record and follow-up list |
| weekly readiness review | decide whether pilot continuation or expansion remains justified | open risks, documented incidents, dependency status, owner gaps | no raw customer data, no DB discovery, no exports | `pilot_owner` + `technical_owner` | weekly readiness summary and decision log |
| pre-deploy review | confirm readiness before any approved pilot-impacting deploy | exact target commit, gate evidence, rollback point, risk summary | no unapproved production config changes, no hidden scope drift | `deploy_owner` | pre-deploy approval note and rollback evidence |
| post-deploy review | confirm health and whether rollback is required | post-deploy validation summary, safe smoke status, incident decision | no raw logs with customer data, no DB discovery | `deploy_owner` + `incident_commander` | post-deploy validation note and rollback decision |
| incident-triggered review | classify and control any pilot-affecting incident | severity summary, affected surfaces, rollback path, approved metadata-only evidence | no unsupported DB inspection, no secrets, no unapproved restore actions | `incident_commander` | incident record, owner assignment, containment path |
| privacy-triggered review | assess privacy-sensitive signals or scope changes | redacted incident notes, privacy design docs, owner path status | no DSAR execution, no exports, no customer data publication | `privacy_owner` | privacy risk summary and stop/go recommendation |
| dependency-audit-triggered review | react to new dependency drift | production-context audit, dependency register, current exception status | no unsafe force-fix or hidden runtime change | `technical_owner` + `security_owner` | drift review note and pause decision if needed |
| backup/restore-triggered review | evaluate backup or restore readiness gaps | drill-plan docs, inventory status, owner model, verification status | no backup-content access, no restore commands, no DB access | `backup_owner` + `restore_owner` | backup/restore readiness note and blocking status |

## Pilot Pause Criteria

Pause the pilot or block continuation when any of the following occurs:

- High or Critical security finding appears
- `production-context audit` fails
- authorization matrix or security boundary checks fail
- public widget leak appears
- unexpected customer-site mutation is detected
- unapproved `DB_READ_ONLY_AUDIT` is attempted
- query runner or reports with data become part of the scope
- production secret exposure is suspected
- monitoring or alerting critical gap appears during an active pilot
- backup or restore risk becomes blocking
- DSAR or privacy incident appears
- required owner is unavailable
- rollback path is unclear

## Pilot Stop / No-Go Criteria

Do not start or continue a real-customer pilot when any of the following is true:

- unresolved High or Critical finding exists
- cross-tenant data exposure is suspected or confirmed
- secrets are exposed
- production DB data was accessed without approval
- customer data was used outside approved scope
- DSAR, export, deletion, or retention execution was attempted without approval
- backup or restore was executed without approval
- incident owner is absent during an incident
- legal or privacy owner blocks continuation
- repeated production health failure remains unresolved
- rollback of a pilot-impacting deploy cannot be performed with confidence

## Rollback / Recovery Control

- rollback point is required for any pilot-impacting deploy
- `deploy_owner` is required for any pilot-impacting deploy path
- no auto-rollback is approved from monitors or alerts
- `incident_commander` must decide rollback during an incident
- production config changes require separate approval
- backup restore is not a rollback substitute without privacy and SRE approval
- rollback evidence must be documented before and after any approved pilot-impacting deploy
- no deploy is executed by this plan

## Data / Privacy Control

- no customer data by default
- no production data by default
- no PII-bearing reports
- no DSAR or export execution
- no deletion, correction, or retention execution
- no `DB_READ_ONLY_AUDIT`
- no query runner
- DSAR and privacy paths remain design-only in the current baseline
- processor and DPA inventory is required before any real-customer data scope
- `privacy_owner` is required before any real-customer data scope

## Monitoring / Alerting Control

- `SRE-1G` is completed as a decision gate
- real monitor setup is not approved
- real alert setup is not approved
- `SRE-1G-EXEC` is allowed only with explicit approval
- monitoring and alerting remains `P0` before active enterprise outreach
- no real contact information or alert URLs belong in the repository
- false positives require review
- no auto-rollback is approved
- no auto customer communication is approved

## Backup / Restore Control

- `SRE-2A` through `SRE-2E` are completed as documentation and decision baselines
- production backup verification is not completed
- backup or restore execution is not approved
- `SRE-2F` is required before relying on production restore readiness
- `backup_owner` and `restore_owner` are required
- production backup content remains blocked
- no `pg_dump`, `pg_restore`, or `psql` is used by this plan

## Dependency / Supply Chain Control

- `production-context audit` baseline is `PASS`
- `body-parser` is fixed and production-live documented
- `sharp` is mitigated and production-live documented
- Next.js security drift is fixed and production-live documented
- `postcss` remains known, moderate, and non-blocking under the current baseline
- no open High or Critical finding is documented
- any new High or Critical dependency drift may pause the pilot

## Evidence Package For Future Pilot Approval

Any later request for a real-customer pilot should provide or reference:

- `ENT-SEC-1A` status
- `ENT-SEC-1B` status
- `ENT-SEC-1C` status
- `SRE-1G` status
- `SRE-2F` status, when available
- processor and DPA inventory
- owner list
- monitoring or alert setup evidence, or an explicit acceptance caveat
- backup verification evidence, or an explicit caveat
- daily health review procedure
- rollback evidence
- privacy and DSAR caveats
- accepted risk record, if any

## Relationship To Existing Docs

- `ENT-SEC-1A` = Enterprise Security Gap Audit
- `ENT-SEC-1B` = Enterprise Pilot Go/No-Go Decision
- `ENT-SEC-1C` = Enterprise Pilot Control Plan
- `SRE-1G` = Real External Monitor / Alert Setup Decision Gate
- `SRE-1G-EXEC` = separate setup task only with explicit approval
- `SRE-2F` = Production Backup Verification Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## Stop Boundaries

This plan does not cross any execution boundary.

- this plan reads no DB
- this plan executes no SQL
- this plan uses no query runner
- this plan generates no reports
- this plan executes no DSAR request
- this plan executes no export
- this plan generates no JSON, CSV, or ZIP export file
- this plan executes no deletion
- this plan executes no correction
- this plan executes no retention action
- this plan executes no cleanup, backfill, or enforcement
- this plan opens no backups, dumps, or exports
- this plan reads no secrets
- this plan executes no production queries
- this plan executes no health checks
- this plan queries no production logs
- this plan changes no production config
- this plan deploys nothing
- this plan sets up no monitors or alerts
- this plan changes no public widget response
- this plan mutates no customer site
- this plan grants no DSGVO compliance approval
- this plan grants no unrestricted enterprise approval
- this plan grants no real-customer pilot approval

## Non-goals

- no implementation
- no deploy
- no monitoring setup
- no alert setup
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
- no runtime change
- no customer data
- no secrets
- no final DSGVO compliance approval
- no unrestricted enterprise approval

## Recommended Next Step

Recommended next step:

- `SRE-2F Production Backup Verification Decision Gate`

Alternatives:

- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`, only with explicit approval
- `DSGVO-1H DSAR Export Implementation Plan`

Why:

- `SRE-1G` is done, but real monitor setup remains not approved
- backup and restore verification remains a P0 gap before real-customer pilot reliance
- `SRE-2F` remains a non-execution decision gate unless separately approved
