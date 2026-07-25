# Enterprise Demo Dry-Run Decision Gate

Stand: 2026-07-25

## Summary

This document defines a documentation-only Enterprise Demo Dry-Run Decision Gate for the current enterprise-pilot preparation baseline.

Purpose:

- decide that no real dry-run execution is approved now
- classify possible future dry-run types
- define allowed and blocked inputs for future dry runs
- define an explicit human-approval format for any later dry-run execution
- define stop criteria for each dry-run type
- keep the current dependency and exception posture visible without treating it as fully fixed

Enterprise-pilot focus:

- enterprise-pilot preparation only
- no dry-run execution
- no demo execution
- no screenshots
- no recordings
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

This decision gate does not:

- read any database
- execute SQL
- use a query runner
- generate reports
- generate exports
- generate JSON, CSV, or ZIP files
- execute any DSAR request
- execute any deletion, correction, or retention action
- open backups, dumps, or exports
- execute health checks
- query production logs
- change runtime code, workflows, scripts, config, or feature flags
- change production config
- deploy anything
- document secrets, customer data, production data, real contacts, screenshots, or recordings
- grant final security, compliance, DSGVO, enterprise, or pilot approval
- mark Next-internal PostCSS as fixed

Current dependency posture:

- root/dashboard PostCSS is technically fixed on `8.5.23`
- standalone/root Dashboard PostCSS is safe at `8.5.23` and therefore also satisfies `>= 8.5.18`
- Next-internal PostCSS remains `8.4.31`
- Next-internal PostCSS is exact-scoped accepted
- Next-internal PostCSS is accepted temporarily, not fixed
- the stable Next upgrade remains required

## Dry-Run Decision Summary

- `enterprise_demo_dry_run_decision_gate_created: yes`
- `dry_run_execution_approved: no`
- `internal_tabletop_dry_run_planning: allowed`
- `internal_talk_track_dry_run_planning: allowed`
- `synthetic_demo_dry_run_candidate: conditional_requires_explicit_approval`
- `customer_facing_dry_run_candidate: blocked_without_explicit_acceptance`
- `real_customer_pilot_dry_run: blocked`
- `production_data_dry_run: blocked`
- `broad_rollout_dry_run: blocked`
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
- `deploy_required_by_this_gate: no`

## Dry-Run Type Matrix

| Dry-Run Type | Current Status | Allowed Inputs | Required Approval | Blocked Actions |
| --- | --- | --- | --- | --- |
| internal tabletop dry run | `planning_allowed` | existing DOKU_ONLY docs, status labels, known caveats, owner placeholders | none for planning only | no execution, no screenshots, no recordings, no live-system usage |
| internal talk-track rehearsal | `planning_allowed` | talk-track docs, FAQ docs, generic personas, caveat language | none for planning only | no live demo, no customer-specific claims, no recordings |
| synthetic-only product dry run | `conditional_requires_explicit_approval` | synthetic-only script outline, generic tenant/site labels, documented status labels | explicit human approval plus demo/security/privacy review | no customer data, no production data, no deploy, no DB, no SQL |
| synthetic widget-flow dry run | `conditional_requires_explicit_approval` | synthetic widget narrative, documented safe boundaries, generic site labels | explicit human approval plus safe-environment approval | no live customer widget interaction, no deliveries, no screenshots unless separately approved |
| synthetic dashboard-flow dry run | `conditional_requires_explicit_approval` | synthetic dashboard narrative, synthetic role examples, documented dependency status | explicit human approval plus safe-environment approval | no live admin login, no production tenant data, no query runner, no reports with data |
| customer-facing narrative dry run | `conditional_with_caveats_and_approval` | approved caveat language, synthetic-only narrative, documented governance status | explicit acceptance plus demo_owner, security_owner_review, privacy_owner_review | no enterprise-ready claim, no customer-data claim, no production-data claim |
| customer-facing live dry run | `blocked_without_separate_explicit_approval` | none by default | separate explicit approval outside this gate | no live systems, no live customer traffic, no screenshots or recordings by default |
| real-customer pilot dry run | `blocked` | none | separate real-customer pilot acceptance outside this gate | no customer data, no pilot execution, no rollout preparation by implication |
| production-data dry run | `blocked` | none | separate production-data approval outside this gate | no production DB, no logs, no exports, no reports |
| broad rollout dry run | `blocked` | none | separate unrestricted enterprise approval outside this gate | no rollout claim, no deploy, no customer-site mutation |

## Allowed Planning Inputs

Allowed planning inputs for this decision gate and any future planning-only dry-run work:

- existing DOKU_ONLY docs
- status labels
- synthetic-only script outline
- generic personas
- generic tenant/site labels
- known caveats
- documented approval placeholders
- documented CI/security status labels
- documented dependency status labels
- root/dashboard PostCSS technical-fix status
- documented Next-internal PostCSS temporary exception status
- no-customer-data notes

Conditions:

- planning inputs must remain synthetic, generic, or documentation-derived
- planning inputs must not imply execution approval
- planning inputs must not include screenshots, recordings, query outputs, or reports

## Blocked Inputs

Blocked inputs for this decision gate and any future dry run unless separately approved:

- real customer data
- production data
- production secrets
- real customer contacts
- real customer transcripts
- real DSAR requests
- real exports
- query runner output
- reports with data
- production logs
- backup metadata or backup content
- offsite provider metadata or content
- screenshots or recordings
- live customer widget interaction
- live production API calls
- email, webhook, or SMTP delivery
- feature flags
- production config changes
- customer-site mutation
- NOLIS-specific hardcoding or claims without explicit approval

## Future Execution Candidate

Candidate future task:

- `ENT-SEC-1I-EXEC Internal Synthetic Demo Dry Run`

Current status:

- `not_approved`

This candidate is allowed only if explicit approval is granted later.

Maximum candidate scope:

- internal only
- synthetic-only
- no customer data
- no production data
- no deploy
- no DB
- no SQL
- no query runner
- no reports
- no DSAR or export execution
- no screenshots or recordings unless separately approved
- no production logs
- no monitor or alert setup

Important:

- this document does not approve `ENT-SEC-1I-EXEC`
- this document defines only a future candidate and approval envelope
- if future scope expands beyond the envelope above, execution remains blocked

## Explicit Approval Format

Example format only. This is not granted approval.

```text
dry_run_execution_decision: approved
task: ENT-SEC-1I-EXEC Internal Synthetic Demo Dry Run
approved_scope:
  audience: internal_only
  data: synthetic_only
  environment: approved_safe_environment_only
  allowed_segments:
    - opening caveat
    - architecture narrative
    - synthetic widget narrative
    - synthetic dashboard narrative
    - governance posture narrative
    - Q&A rehearsal
blocked_segments:
  - customer data
  - production data
  - DB_READ_ONLY_AUDIT
  - Query Runner
  - reports with data
  - DSAR/export execution
  - backup verification
  - monitor/alert setup
  - deploy
screenshots_allowed: no
recordings_allowed: no
customer_facing_allowed: no
owner_role: demo_owner
security_owner_review: required
privacy_owner_review: required
expiry_date: YYYY-MM-DD
revalidation_triggers:
  - production-context audit failure
  - scoped exception expiry
  - new non-excepted High/Critical finding
  - demo scope change
  - customer-facing request
  - customer data request
  - production data request
```

Approval rules:

- the template above is an example format only
- example approval is not granted
- missing fields mean execution remains blocked
- customer-facing, screenshot, or recording permission must be explicit and separate

## Approval Status Matrix

| Approval Area | Current Status | Required Before Execution | Notes |
| --- | --- | --- | --- |
| dry_run_execution | `not_approved` | explicit human approval | default remains blocked |
| demo_owner | `placeholder_only` | named accountable owner | owner must exist before execution |
| security_owner | `review_required` | explicit review for execution scope | needed for caveats and dependency posture |
| privacy_owner | `review_required` | explicit review for data and recording boundaries | needed even for synthetic-only execution approval |
| safe_environment | `not_approved` | approved safe environment | internal dry run cannot improvise environment use |
| synthetic_data | `required_but_not_yet_approved_for_execution` | proof that data is synthetic and sanitized | planning only is allowed; execution is not |
| screenshot | `not_approved` | separate explicit approval | default remains no |
| recording | `not_approved` | separate explicit approval | default remains no |
| customer_facing | `not_approved` | separate explicit acceptance | conditional narrative planning does not equal execution approval |
| production_data | `not_approved` | separate explicit approval | blocked by default |
| customer_data | `not_approved` | separate explicit approval | blocked by default |
| deploy | `not_approved` | separate deploy task and approval | not part of this gate |
| DB_READ_ONLY_AUDIT | `not_granted` | separate explicit human approval | remains blocked |
| Query Runner | `not_granted` | separate explicit approval | remains blocked |
| Reports with data | `not_granted` | separate explicit approval | remains blocked |

## Dry-Run Script Boundary

Allowed planning behavior:

- may rehearse wording
- may review docs
- may rehearse caveats
- may rehearse Q&A
- may identify missing approvals

Blocked behavior:

- must not execute a demo
- must not create screenshots or recordings
- must not use live systems
- must not use real customer data
- must not call APIs
- must not mutate data
- must not trigger deliveries

## Dependency / Exception Gate

Current dependency gate summary:

- `production-context audit` currently PASS
- root/dashboard PostCSS technically fixed
- standalone/root PostCSS version: `8.5.23`
- standalone/root PostCSS safe target satisfied: `>= 8.5.18`
- Next-internal PostCSS exact-scoped accepted
- Next-internal PostCSS accepted temporarily, not fixed
- accepted advisories:
  - `GHSA-qx2v-qp2m-jg93`
  - `GHSA-6g55-p6wh-862q`
  - `GHSA-r28c-9q8g-f849`
- exception expiry: `2026-08-06`
- stable Next upgrade remains required

Execution implications:

- if the exception expires before dry-run execution approval, execution remains blocked
- if a new stable Next release exists, upgrade and revalidation are required before any customer-facing dry run
- the exception grants no deploy approval
- the exception grants no enterprise approval
- the exception grants no customer-data approval

## Customer-Facing Dry-Run Gate

Current gate:

- currently blocked unless explicit acceptance is granted

Mandatory conditions for any future customer-facing dry-run request:

- mandatory caveat required
- no customer data
- no production data
- no screenshots or recordings unless separately approved
- no security baseline discussion without the Next/PostCSS caveat
- no enterprise-ready claim
- no legal or DSGVO approval claim

## Dry-Run Stop Criteria

Future dry-run execution must stop immediately if any of the following becomes true:

- `production-context audit` FAIL
- scoped exception expired
- new non-excepted High or Critical finding appears
- root/dashboard PostCSS drift regresses
- customer data requested
- production data requested
- `DB_READ_ONLY_AUDIT` requested
- `Query Runner` requested
- reports with data requested
- DSAR or export requested
- backup verification requested
- monitor or alert setup requested
- deploy requested
- screenshots or recordings requested without approval
- customer-facing use requested without approval
- caveat rejected
- owner approval missing

## Evidence Produced By Future Dry Run

Allowed future evidence, if a future execution is explicitly approved:

- dry-run completion status
- list of caveats rehearsed
- list of questions encountered
- list of missing approvals
- list of blocked requests
- follow-up tasks

Blocked evidence:

- screenshots
- recordings
- customer data
- production data
- logs
- reports
- query results
- exports
- secrets

## Relationship To Existing Docs

- `ENT-SEC-1H` = Enterprise Demo FAQ / Objection Handling
- `ENT-SEC-1G` = Enterprise Demo Talk Track
- `ENT-SEC-1F` = Enterprise Demo Scope Pack
- `ENT-SEC-1E` = Enterprise Pilot Readiness Summary Refresh
- `ENT-SEC-1D` = Enterprise Pilot Evidence Review Cadence
- `P0-Security-Audit-Drift-4G` = Dashboard PostCSS `GHSA-r28c-9q8g-f849` package fix and scoped Next exception update
- `P0-Security-Audit-Drift-4E-POLICY` = scoped temporary Next/PostCSS exception
- `SRE-1G` = Monitor / Alert Setup Decision Gate
- `SRE-2F` = Production Backup Verification Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## Recommended Next Step

Recommended immediate next step:

- `ENT-SEC-1I-D` for PR review and merge

Useful documentation-only follow-up after merge:

- `ENT-SEC-1J Internal Demo Asset Checklist`

Execution-sensitive follow-ups only with explicit approval:

- `ENT-SEC-1I-EXEC Internal Synthetic Demo Dry Run`
- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`
- `SRE-2F-EXEC Production Backup Metadata Verification`
- `DSGVO-1H-EXEC Local Synthetic DSAR Export Dry Run`

## Stop Boundaries

This decision gate:

- executes no dry run
- executes no demo
- creates no screenshots
- creates no recordings
- reads no DB
- executes no SQL
- uses no query runner
- generates no reports
- executes no DSAR request
- executes no export
- generates no JSON, CSV, or ZIP export file
- executes no deletion
- executes no correction
- executes no retention action
- opens no backups, dumps, or exports
- reads no secrets
- executes no production queries
- executes no health checks
- queries no production logs
- changes no production config
- deploys nothing
- sets up no monitors or alerts
- documents no customer data
- documents no real contacts
- grants no DSGVO compliance approval
- grants no real pilot approval
- grants no enterprise approval
- grants no deploy approval
- does not mark Next-internal PostCSS as fixed
- does not approve `ENT-SEC-1I-EXEC`

## Non-goals

- no implementation
- no demo execution
- no dry run
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
- no final DSGVO conformity claim
- no pilot approval
- no enterprise approval
- no scoped Next/PostCSS exception change
