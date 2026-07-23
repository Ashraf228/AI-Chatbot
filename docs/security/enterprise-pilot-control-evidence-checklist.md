# Enterprise Pilot Control Evidence Checklist

Stand: 2026-07-23

## Summary

This document is a documentation-only evidence checklist for the Enterprise Pilot Control Plan.

Purpose:

- convert the existing enterprise, SRE, backup, and DSGVO decision gates into an operational evidence checklist
- define which evidence is already documented, which evidence is still missing, and which evidence must stay outside the repository
- make P0, P1, and P2 pilot-readiness evidence requirements reviewable before internal preparation, safe demo, safe-test/internal-tenant pilot, active enterprise outreach, or any real-customer pilot
- define owner, approval, storage, expiry, and revalidation placeholders without granting any live execution

Enterprise-pilot focus:

- internal readiness evidence tracking only
- no pilot approval
- no real-customer pilot approval
- no customer-data approval
- no production-data approval
- no monitoring or alert setup execution
- no backup verification execution
- no DSAR or export execution
- no deploy

This step is intentionally `DOKU_ONLY`.

This checklist does not:

- read any database
- execute SQL
- use a query runner
- generate reports
- execute any DSAR request
- execute any export
- generate JSON, CSV, or ZIP files
- execute deletion, correction, or retention actions
- execute backup or restore actions
- set up monitors or alerts
- execute health checks
- query production logs
- change runtime code, workflows, scripts, config, or feature flags
- deploy anything
- document secrets, real customer data, real contact data, or real acceptance records
- grant final security, privacy, compliance, or enterprise-pilot approval

## Evidence Checklist Decision Summary

- `evidence_checklist_created: yes`
- `internal_readiness_evidence_tracking: allowed`
- `safe_demo_evidence_tracking: allowed`
- `real_customer_pilot_evidence_tracking: allowed_as_planning_only`
- `real_customer_pilot_approval: no`
- `active_enterprise_outreach_approval: no`
- `DB_READ_ONLY_AUDIT: not_granted`
- `query_runner: not_granted`
- `reports_with_data: not_granted`
- `DSAR_execution: not_granted`
- `export_execution: not_granted`
- `backup_verification_execution: not_granted`
- `monitor_alert_setup: not_granted`
- `deploy_required_by_this_checklist: no`

## Evidence Classification Model

### Status values

- `present_documented`
- `present_ci_validated`
- `present_production_live_status`
- `documented_only`
- `missing`
- `not_granted`
- `blocked`
- `requires_human_approval`
- `requires_external_system`
- `requires_private_secure_storage`
- `requires_revalidation`

### Risk / evidence levels

- `P0_before_active_outreach`
- `P0_before_real_customer_data`
- `P1_controlled_pilot`
- `P2_hardening`

## Current Evidence Baseline

| Evidence Area | Current Evidence | Status | Revalidation Trigger | Notes |
| --- | --- | --- | --- | --- |
| production-context audit | `npm run security:audit:production-contexts` baseline PASS | `present_ci_validated` | any new dependency advisory, production-context audit failure | known `postcss` remains only moderate and non-blocking |
| body-parser fixed production-live | dependency risk register and deploy status evidence | `present_production_live_status` | new API dependency drift, API deploy, audit failure | mitigation documented production-live |
| sharp mitigated production-live | dependency risk register and dashboard deploy evidence | `present_production_live_status` | dashboard dependency drift, dashboard deploy, image pipeline change | high blocker remains removed |
| Next.js fixed production-live | dependency risk register and dashboard deploy evidence | `present_production_live_status` | new dashboard advisory, dashboard deploy, framework change | high blocker remains removed |
| Main-CI / Docker / PostgreSQL isolation | CI docs, post-merge gates, exact-SHA gate script, green CI evidence | `present_ci_validated` | CI workflow change, failing check run, merge-gate drift | check-run evidence is repo-safe |
| Authorization Matrix | `npm run security:check-authorization-matrix` PASS baseline | `present_ci_validated` | route or auth change, failing matrix check | route/access regression gate |
| Security Boundaries | `npm run test:security-boundaries` PASS baseline | `present_ci_validated` | boundary failure, tenant/auth change | hard security baseline |
| Enterprise Security Gap Audit | `ENT-SEC-1A` complete | `present_documented` | enterprise scope shift, new hard blocker | baseline inventory exists |
| Enterprise Go/No-Go Decision | `ENT-SEC-1B` complete | `present_documented` | pilot-scope change, explicit acceptance request | current pilot decision remains guarded |
| Enterprise Pilot Control Plan | `ENT-SEC-1C` complete | `present_documented` | owner-chain change, pilot class change | source control plan exists |
| SRE-1G Monitor/Alert Decision Gate | `SRE-1G` complete | `present_documented` | request for real monitor/alert setup, provider change | real setup remains not granted |
| SRE-2F Backup Verification Decision Gate | `SRE-2F` complete | `present_documented` | backup access change, restore discussion, provider change | real verification remains not granted |
| DSGVO-1H DSAR Export Implementation Plan | `DSGVO-1H` complete | `present_documented` | privacy owner change, DSAR scope change, export design change | execution remains blocked |
| Incident Response Runbook | `SRE-1C` complete | `present_documented` | incident process change, severity model change | runbook exists; owner path still placeholder-based |
| Backup/Restore Governance | `SRE-2A` through `SRE-2E` complete | `present_documented` | backup owner change, restore scope change, provider change | governance exists without live execution proof |
| DSGVO Governance | `DSGVO-1A` through `DSGVO-1H` complete | `present_documented` | privacy or processor scope change, DSAR/export design change | governance exists without live execution approval |
| Public Widget safe-smoke evidence | documented safe smoke / response-shape baseline from prior deploy status and pilot checklist | `documented_only` | widget deploy, public response-shape change, leak signal | safe synthetic policy must remain bounded |

## P0 Evidence Before Active Enterprise Outreach

| Evidence Item | Required Evidence | Current Status | Owner Placeholder | Storage Location | Stop If Missing |
| --- | --- | --- | --- | --- | --- |
| external monitor / alert decision or approved execution evidence | `SRE-1G` decision or later approved execution outcome | `present_documented` | `<SRE_owner>` | repo doc plus external execution record if later approved | yes |
| alert routing owner path | approved route ownership and escalation path | `missing` | `<SRE_owner>` | private secure operations record | yes |
| incident commander / on-call model | named incident path and backup path | `documented_only` | `<incident_commander>` | private secure operations record | yes |
| production backup verification decision evidence | `SRE-2F` outcome and current blocked/not-granted state | `present_documented` | `<backup_owner>` / `<restore_owner>` | repo doc plus private acceptance record if later approved | yes |
| backup owner | named owner evidence | `missing` | `<backup_owner>` | private secure ownership register | yes |
| restore owner | named owner evidence | `missing` | `<restore_owner>` | private secure ownership register | yes |
| privacy owner | named owner evidence | `missing` | `<privacy_owner>` | private secure ownership register | yes |
| DSAR owner | named owner evidence | `missing` | `<DSAR_owner>` | private secure ownership register | yes |
| processor / DPA inventory | provider and DPA evidence package | `missing` | `<processor_DPA_owner>` | private secure legal / processor register | yes |
| production config owner | owner and recovery path evidence | `missing` | `<production_config_owner>` | private secure ownership register | yes |
| pilot daily health review procedure | daily review cadence, artifact shape, and escalation path | `documented_only` | `<pilot_owner>` | repo doc plus private operating cadence record | yes |
| rollback evidence path | target commit/image, rollback point, rollback-decision path | `present_documented` | `<deploy_owner>` | repo-safe status docs plus private change record | yes |
| public widget smoke policy | safe-smoke policy and response-shape boundary evidence | `present_documented` | `<technical_owner>` / `<security_owner>` | repo docs | yes |
| customer communication owner | outbound communication ownership evidence | `missing` | `<communications_owner>` / `<customer_success_owner>` | private secure operating register | yes |
| explicit risk acceptance if P0 gaps remain | signed exception record with scope, expiry, and revalidation | `not_granted` | `<pilot_owner>` + domain owners | private secure acceptance record | yes |

## P0 Evidence Before Real-Customer Data

| Evidence Item | Required Evidence | Current Status | Owner Placeholder | Storage Location | Stop If Missing |
| --- | --- | --- | --- | --- | --- |
| explicit real-customer pilot acceptance | time-bounded signed exception or later full approval | `not_granted` | `<pilot_owner>` + domain owners | private secure acceptance record | yes |
| customer scope | approved customer-scope placeholder only | `missing` | `<customer_success_owner>` | private secure pilot scope record | yes |
| data scope | explicit `synthetic_only` or later explicitly approved real-data scope | `missing` | `<privacy_owner>` / `<security_owner>` | private secure pilot scope record | yes |
| allowed features | approved feature list | `missing` | `<technical_owner>` | private secure pilot scope record | yes |
| blocked features | explicit blocked feature list | `missing` | `<technical_owner>` | private secure pilot scope record | yes |
| identity / tenant / subject boundaries | approved scope-boundary evidence references | `documented_only` | `<security_owner>` / `<privacy_owner>` | repo docs plus private execution record if later needed | yes |
| privacy owner approval | explicit privacy review | `not_granted` | `<privacy_owner>` | private secure approval record | yes |
| security owner approval | explicit security review | `not_granted` | `<security_owner>` | private secure approval record | yes |
| incident contact path | active escalation path | `missing` | `<incident_commander>` | private secure operations record | yes |
| DSAR caveat | explicit blocked DSAR/export execution caveat | `present_documented` | `<DSAR_owner>` | repo docs plus private customer-facing caveat if needed | yes |
| backup/restore caveat | explicit blocked backup/restore caveat | `present_documented` | `<backup_owner>` / `<restore_owner>` | repo docs plus private customer-facing caveat if needed | yes |
| monitoring/alerting caveat | explicit blocked real setup caveat | `present_documented` | `<SRE_owner>` | repo docs plus private customer-facing caveat if needed | yes |
| processor/DPA evidence | provider and contractual evidence | `missing` | `<processor_DPA_owner>` | private secure legal / processor register | yes |
| rollback/pause criteria | approved pause/rollback evidence references | `documented_only` | `<deploy_owner>` / `<incident_commander>` | repo docs plus private pilot runbook | yes |
| expiry date | explicit acceptance expiry | `missing` | `<pilot_owner>` | private secure acceptance record | yes |
| revalidation trigger | explicit revalidation conditions | `documented_only` | `<pilot_owner>` | repo checklist plus private acceptance record | yes |

## Daily / Weekly Operational Evidence

| Evidence | Safe Input | Blocked Input | Owner Placeholder | Evidence Output | Retention Candidate |
| --- | --- | --- | --- | --- | --- |
| daily health review placeholder | metadata-only health summary, safe smoke status, approved gate status | DB reads, raw logs, query results, customer data | `<pilot_owner>` | daily readiness note | `<private_ops_record_retention>` |
| weekly readiness review placeholder | open risks, documented incidents, dependency status, owner gaps | real contact data, customer data, DB discovery | `<pilot_owner>` / `<technical_owner>` | weekly readiness summary | `<private_ops_record_retention>` |
| incident review placeholder | severity summary, rollback path, approved metadata-only evidence | raw customer data, secrets, unsupported DB inspection | `<incident_commander>` | incident review record | `<private_incident_record_retention>` |
| dependency audit review placeholder | production-context audit status, dependency risk register status | unsafe force-fix output, secrets, customer data | `<technical_owner>` / `<security_owner>` | dependency review note | `<private_security_record_retention>` |
| privacy trigger review placeholder | privacy design docs, redacted incident notes, owner status | DSAR execution, export data, customer data publication | `<privacy_owner>` | privacy review note | `<private_privacy_record_retention>` |
| backup/restore trigger review placeholder | backup governance docs, owner status, verification decision state | backup metadata/content, restore commands, DB access | `<backup_owner>` / `<restore_owner>` | backup/restore readiness note | `<private_backup_governance_retention>` |
| deployment review placeholder | target commit, gates, rollback point, safe smoke status | production config secrets, raw logs, DB queries | `<deploy_owner>` | deploy review note | `<private_change_record_retention>` |

## Deployment / Rollback Evidence Checklist

This section defines checklist fields only. It performs no new deploy review.

| Field | Required Shape | Default Status |
| --- | --- | --- |
| target commit | `<commit_sha>` | `documented_only` |
| live commit before | `<commit_sha>` | `documented_only` |
| live commit after | `<commit_sha>` | `documented_only` |
| image before | `<image_digest>` | `documented_only` |
| image after | `<image_digest>` | `documented_only` |
| health result | `<green | degraded | blocked>` | `documented_only` |
| rollback point | `<commit_or_image_reference>` | `documented_only` |
| rollback decision | `<not_needed | prepared | executed>` | `documented_only` |
| migration status | `<not_applicable | approved | blocked>` | `documented_only` |
| DB / SQL status | `<not_used | separately_approved | blocked>` | `documented_only` |
| public widget impact | `<none | reviewed | blocked>` | `documented_only` |
| customer-site mutation status | `<none | approved | blocked>` | `documented_only` |
| secrets status | `<none_in_repo | blocked | external_only>` | `documented_only` |

## Monitoring / Alerting Evidence Checklist

| Evidence Item | Required Evidence | Current Status | Notes |
| --- | --- | --- | --- |
| `SRE-1G` Decision Gate present | decision gate document exists | `present_documented` | baseline exists |
| real monitor setup approval | explicit setup approval | `not_granted` | default blocked |
| real alert setup approval | explicit setup approval | `not_granted` | default blocked |
| provider/account approval | provider and account approval | `not_granted` | external-system dependency |
| route owner | approved owner path | `missing` | private secure ownership required |
| alert destination approval | approved route mapping | `not_granted` | no real route in repo |
| secret/token handling approval | explicit approval for provider secrets | `not_granted` | secrets stay outside repo |
| false positive handling | runbook/reference for false-positive review | `documented_only` | ties to incident and health review docs |
| incident mapping | route-to-incident path evidence | `documented_only` | owner path still incomplete |
| disable/pause plan | approved rollback/disable evidence | `documented_only` | no auto-rollback approved |
| no real contact info in repo | hard handling rule | `present_documented` | remains mandatory |

## Backup / Restore Evidence Checklist

| Evidence Item | Required Evidence | Current Status | Notes |
| --- | --- | --- | --- |
| `SRE-2F` Decision Gate present | decision gate document exists | `present_documented` | baseline exists |
| backup metadata access approval | explicit metadata-only approval | `not_granted` | execution blocked |
| backup content access approval | explicit content-access approval | `not_granted` | execution blocked |
| offsite provider access approval | explicit provider approval | `not_granted` | external-system dependency |
| backup owner | named owner evidence | `missing` | private secure ownership required |
| restore owner | named owner evidence | `missing` | private secure ownership required |
| restore execution approval | explicit restore approval | `not_granted` | execution blocked |
| `pg_dump` / `pg_restore` / `psql` approval | explicit command-scope approval | `not_granted` | remains blocked |
| `DB_READ_ONLY_AUDIT` approval | separate explicit approval | `not_granted` | remains blocked |
| privacy/security review | explicit review evidence | `not_granted` | required before content access |
| legal/incident hold review | explicit hold review evidence | `blocked` | can block verification assumptions |
| no backup data in repo | hard handling rule | `present_documented` | remains mandatory |

## DSAR / Export Evidence Checklist

| Evidence Item | Required Evidence | Current Status | Notes |
| --- | --- | --- | --- |
| `DSGVO-1H` Implementation Plan present | plan document exists | `present_documented` | baseline exists |
| DSAR owner | named owner evidence | `missing` | private secure ownership required |
| privacy owner | named owner evidence | `missing` | private secure ownership required |
| identity verification design | approved design evidence | `documented_only` | still not approved for execution |
| tenant/site scope design | approved design evidence | `documented_only` | still not approved for execution |
| subject matching design | approved design evidence | `documented_only` | still not approved for execution |
| redaction review | explicit redaction approval | `not_granted` | execution blocked |
| export generation approval | explicit implementation/execution approval | `not_granted` | execution blocked |
| delivery/storage/expiry approval | explicit artifact lifecycle approval | `not_granted` | execution blocked |
| no `DB_READ_ONLY_AUDIT` | blocked status retained | `present_documented` | hard stop remains |
| no Query Runner | blocked status retained | `present_documented` | hard stop remains |
| no reports with data | blocked status retained | `present_documented` | hard stop remains |
| no JSON/CSV/ZIP generated | hard handling rule | `present_documented` | current phase is planning-only |
| no export data in repo | hard handling rule | `present_documented` | remains mandatory |

## Public Widget / Customer-Facing Evidence Checklist

| Evidence Item | Required Evidence | Current Status | Notes |
| --- | --- | --- | --- |
| safe smoke policy | approved safe-smoke boundary | `present_documented` | synthetic-only bounded signal |
| siteKey match policy | approved config-integrity rule | `documented_only` | deploy/health evidence reference only |
| no debug/preview/knowledge/delivery/secret fields policy | response-shape boundary evidence | `present_documented` | public leak watch remains mandatory |
| synthetic-only smoke rule | explicit synthetic-only rule | `present_documented` | no customer-site mutation |
| no customer-site mutation without approval | hard stop rule | `present_documented` | remains mandatory |
| no lead/ticket/delivery side effects unless approved | hard stop rule | `present_documented` | execution paths stay blocked |
| widget commit/version tracking | exact version/commit evidence | `documented_only` | status-doc evidence |
| API commit tracking | exact commit evidence | `documented_only` | status-doc evidence |
| rollback impact review | pre/post deploy rollback evidence | `documented_only` | deploy owner path still placeholder-based |

## Owner / Approval Evidence Checklist

| Role | Current Status | Evidence Required | Storage Location | Revalidation Trigger |
| --- | --- | --- | --- | --- |
| `pilot_owner` | `missing` | named owner evidence | private secure ownership register | owner change, pilot scope change |
| `technical_owner` | `missing` | named owner evidence | private secure ownership register | platform-scope change, deploy model change |
| `security_owner` | `missing` | named owner evidence | private secure ownership register | security baseline change, incident |
| `privacy_owner` | `missing` | named owner evidence | private secure ownership register | privacy scope change, DSAR event |
| `SRE_owner` | `missing` | named owner evidence | private secure ownership register | monitor/alert/health cadence change |
| `incident_commander` | `missing` | named owner evidence | private secure operations register | incident model change, owner change |
| `deploy_owner` | `missing` | named owner evidence | private secure operations register | deploy model change, rollback path change |
| `backup_owner` | `missing` | named owner evidence | private secure operations register | backup provider or policy change |
| `restore_owner` | `missing` | named owner evidence | private secure operations register | restore scope or drill model change |
| `DSAR_owner` | `missing` | named owner evidence | private secure privacy register | DSAR scope change, privacy escalation |
| `processor_DPA_owner` | `missing` | named owner evidence | private secure legal / processor register | processor inventory change |
| `production_config_owner` | `missing` | named owner evidence | private secure operations register | config model change, infra change |
| `customer_success_owner` | `missing` | named owner evidence | private secure customer-ops register | customer scope change |
| `communications_owner` | `missing` | named owner evidence | private secure communications register | outreach model change, incident communication |

Only placeholders are allowed here.
No real names, emails, phone numbers, or chat handles belong in the repository.

## Evidence Storage / Handling Rules

- no secrets in repo
- no real contacts in public docs
- no customer data in PRs
- no query results in docs
- no reports with data
- no backup metadata or backup content in repo unless separately approved and sanitized
- private acceptance records are stored outside the public repository
- monitor provider secrets stay outside the repository
- audit evidence must be sanitized
- commit hashes and image hashes are allowed
- status labels are allowed

## Revalidation Triggers

- new High or Critical dependency finding
- `production-context audit` failure
- authorization-matrix failure
- security-boundary failure
- public widget change
- API deploy
- dashboard deploy
- widget deploy
- production config change
- feature-flag change
- incident
- privacy request or DSAR event
- backup or restore status change
- monitoring or alerting setup change
- processor or DPA change
- owner change
- customer scope change

## Pilot Pause / Stop Evidence Requirements

| Finding / Event | Required Evidence | Owner Placeholder | Decision Status | Revalidation Needed | Restart Condition |
| --- | --- | --- | --- | --- | --- |
| High or Critical finding | audit evidence and remediation decision | `<security_owner>` | `blocked` until resolved or explicitly accepted | yes | green audit baseline restored |
| `DB_READ_ONLY_AUDIT` without approval | approval evidence or explicit stop record | `<security_owner>` / `<privacy_owner>` | `blocked` | yes | explicit approval granted or scope removed |
| Query Runner used | scope review and exception record | `<security_owner>` | `blocked` | yes | scope removed and root cause addressed |
| report with data produced | sanitized incident/evidence record | `<security_owner>` / `<privacy_owner>` | `blocked` | yes | output removed and guardrail corrected |
| DSAR/export execution attempted | incident/evidence record | `<DSAR_owner>` / `<privacy_owner>` | `blocked` | yes | explicit later approval path completed |
| customer data outside approved scope | incident/evidence record | `<privacy_owner>` / `<incident_commander>` | `blocked` | yes | scope reset and controls revalidated |
| secret exposure | incident/evidence record | `<security_owner>` / `<incident_commander>` | `blocked` | yes | exposure contained and rotation complete |
| cross-tenant risk | incident/evidence record | `<security_owner>` | `blocked` | yes | isolation review completed |
| backup/restore failure | readiness or incident record | `<backup_owner>` / `<restore_owner>` | `blocked` | yes | follow-up completed and status re-reviewed |
| monitoring failure during active pilot | incident/evidence record | `<SRE_owner>` / `<incident_commander>` | `blocked` | yes | monitoring path restored or accepted |
| rollback path unclear | deploy/incident record | `<deploy_owner>` | `blocked` | yes | rollback evidence documented |
| owner unavailable | owner gap record | `<pilot_owner>` | `paused` or `blocked` depending on scope | yes | owner path restored |

## Evidence Package Template

Pseudo-template only, no real values:

```text
pilot_id: <placeholder>
scope: <internal_readiness | safe_demo | safe_test_internal | real_customer>
customer_scope: <none | placeholder>
data_scope: <synthetic_only | explicitly_approved>
allowed_features: <placeholder>
blocked_features: <placeholder>
owners: <role_placeholders>
approvals: <approval_references_not_values>
security_baseline: <status_labels>
sre_baseline: <status_labels>
privacy_baseline: <status_labels>
backup_restore_baseline: <status_labels>
monitoring_alerting_baseline: <status_labels>
rollback_evidence: <status_labels>
pause_criteria: <status_labels>
expiry: <placeholder>
revalidation_trigger: <placeholder>
```

## Relationship To Existing Docs

- `ENT-SEC-1A` = Enterprise Security Gap Audit
- `ENT-SEC-1B` = Enterprise Pilot Go/No-Go Decision
- `ENT-SEC-1C` = Enterprise Pilot Control Plan
- `ENT-SEC-1C-HARDENING` = Evidence Checklist
- `SRE-1G` = Monitor / Alert Setup Decision Gate
- `SRE-2F` = Production Backup Verification Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## Recommended Next Step

Recommended next step:

- `ENT-SEC-1C-HARDENING-D` for PR review and merge

After this, the next fachlich valid options are:

- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`, only with explicit approval
- `SRE-2F-EXEC Production Backup Metadata Verification`, only with explicit approval
- `DSGVO-1H-EXEC Local Synthetic DSAR Export Dry Run`, only with explicit approval

If no execution is desired:

- `ENT-SEC-1D Enterprise Pilot Evidence Review Cadence`

## Stop Boundaries

This checklist reads no DB.
This checklist executes no SQL.
This checklist uses no query runner.
This checklist generates no reports.
This checklist executes no DSAR request.
This checklist executes no export.
This checklist generates no JSON, CSV, or ZIP export file.
This checklist executes no deletion.
This checklist executes no correction.
This checklist executes no retention action.
This checklist opens no backups, dumps, or exports.
This checklist reads no secrets.
This checklist executes no production queries.
This checklist executes no health checks.
This checklist queries no production logs.
This checklist changes no production config.
This checklist deploys nothing.
This checklist sets up no monitors or alerts.
This checklist documents no customer data.
This checklist documents no real contacts.
This checklist grants no DSGVO compliance.
This checklist grants no real pilot approval.

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
- no deletion, correction, or retention execution
- no backup or restore
- no runtime change
- no customer data
- no secrets
- no final DSGVO compliance
- no pilot approval
