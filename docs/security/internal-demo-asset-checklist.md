# Internal Demo Asset Checklist

Stand: 2026-07-25

## Summary

This document defines a documentation-only Internal Demo Asset Checklist for the current enterprise-pilot preparation baseline.

Purpose:

- define which internal demo assets may be prepared later
- define which asset types remain forbidden or approval-bound
- define rules for synthetic demo data, slides, talk-track excerpts, FAQ excerpts, screenshots, recordings, and asset storage assumptions
- define review, approval, expiry, and revalidation rules for future demo assets
- keep the current dependency and exception posture visible without treating it as fully fixed

Enterprise-pilot focus:

- enterprise-pilot preparation only
- no asset creation
- no slide creation
- no screenshot creation
- no recording creation
- no dry-run execution
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

This checklist does not:

- create any asset
- create any slide
- create any screenshot
- create any recording
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
- document secrets, customer data, production data, real contacts, real screenshots, real recordings, or real slide assets
- grant final security, compliance, DSGVO, enterprise, or pilot approval
- mark Next-internal PostCSS as fixed

Current dependency posture:

- root/dashboard PostCSS is technically fixed on `8.5.23`
- standalone/root Dashboard PostCSS is safe at `8.5.23` and therefore also satisfies `>= 8.5.18`
- Next-internal PostCSS remains `8.4.31`
- Next-internal PostCSS is exact-scoped accepted
- Next-internal PostCSS is accepted temporarily, not fixed
- the stable Next upgrade remains required

## Asset Checklist Decision Summary

- `internal_demo_asset_checklist_created: yes`
- `asset_creation_approved: no`
- `slide_creation_approved: no`
- `screenshot_creation_approved: no`
- `recording_creation_approved: no`
- `internal_asset_planning: allowed`
- `synthetic_asset_candidate: conditional_requires_explicit_approval`
- `customer_facing_asset_candidate: blocked_without_explicit_acceptance`
- `real_customer_asset: blocked`
- `production_data_asset: blocked`
- `broad_rollout_asset: blocked`
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
- `deploy_required_by_this_checklist: no`

## Asset Type Matrix

| Asset Type | Current Status | Allowed Inputs | Required Approval | Blocked Content |
| --- | --- | --- | --- | --- |
| internal demo outline | `planning_allowed` | existing DOKU_ONLY docs, status labels, caveats, owner placeholders | none for planning only | no real data, no customer-facing promise, no execution proof |
| internal slide outline | `planning_allowed` | generic section titles, synthetic-only narrative, documented status labels | none for planning only | no real slides, no screenshots, no real domains, no real contacts |
| internal talk-track excerpt | `planning_allowed` | approved talk-track language, generic personas, caveat wording | none for planning only | no customer-specific claims, no execution claim |
| FAQ / objection-handling excerpt | `planning_allowed` | FAQ safe answers, caveat language, blocked-scope answers | none for planning only | no rollout claim, no customer-data approval claim |
| synthetic persona list | `conditional_requires_explicit_approval` | generic persona labels, obvious placeholders, non-customer descriptors | explicit asset-creation approval plus synthetic-data confirmation | no real names, no real organizations, no copied contacts |
| synthetic data dictionary | `conditional_requires_explicit_approval` | placeholder fields, synthetic-only sample categories, non-real identifiers | explicit asset-creation approval plus privacy review | no real customer identifiers, no logs, no exports |
| synthetic widget-flow storyboard | `conditional_requires_explicit_approval` | synthetic widget narrative, generic site labels, safe feature descriptions | explicit asset-creation approval plus demo/security/privacy review | no live customer widget interaction, no delivery evidence |
| synthetic dashboard-flow storyboard | `conditional_requires_explicit_approval` | synthetic admin narrative, generic tenant/site labels, documented dependency status | explicit asset-creation approval plus demo/security/privacy review | no production tenant data, no query results, no reports with data |
| architecture diagram candidate | `planning_allowed` | generic component categories, conceptual boundaries, synthetic labels | none for planning only | no real endpoints, no tokens, no private hostnames, no DB schema dump |
| security posture one-pager candidate | `conditional_requires_explicit_approval` | documented audit status, caveat wording, approval-bound status labels | explicit asset-creation approval plus security review | no “fully enterprise ready”, no “PostCSS fully fixed”, no “no residual risk” |
| customer-facing slide deck candidate | `blocked_without_explicit_acceptance` | none by default | explicit customer-facing acceptance plus asset-creation approval | no customer-ready claim, no production-data claim, no deploy-ready claim |
| screenshot asset | `blocked_without_separate_explicit_approval` | none by default | separate screenshot capture, storage, and retention approval | no customer data, no logs, no tokens, no real domains by default |
| recording asset | `blocked_without_separate_explicit_approval` | none by default | separate recording, storage, retention, and sharing approval | no customer voice/video, no contacts, no secrets, no logs |
| customer-data asset | `blocked` | none | separate explicit approval outside this checklist | no customer data |
| production-data asset | `blocked` | none | separate explicit approval outside this checklist | no production data, no logs, no reports, no exports |
| broad rollout asset | `blocked` | none | separate unrestricted enterprise approval outside this checklist | no rollout proof, no pilot-ready claim, no deploy claim |

## Allowed Planning Inputs

Allowed planning inputs for this checklist and future planning-only asset work:

- existing DOKU_ONLY docs
- status labels
- synthetic-only script outline
- generic personas
- generic tenant/site labels
- known caveats
- documented approval placeholders
- documented CI and security status labels
- documented dependency status labels
- root/dashboard PostCSS technical-fix status
- documented Next-internal PostCSS temporary exception status
- no-customer-data notes
- generic feature descriptions
- generic architecture categories

Conditions:

- planning inputs must remain synthetic, generic, or documentation-derived
- planning inputs must not imply asset-creation approval
- planning inputs must not include screenshots, recordings, slide files, query outputs, logs, or reports

## Blocked Inputs

Blocked inputs for this checklist and any future asset work unless separately approved:

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
- screenshots
- recordings
- live customer widget interaction
- live production API calls
- email, webhook, or SMTP delivery evidence
- feature flags
- production config values
- customer-site mutation evidence
- NOLIS-specific hardcoding or claims without explicit approval
- real customer logos or domains unless explicitly approved
- URLs containing tokens
- credentials or masked credentials that imply real systems

## Synthetic Data Rules

- synthetic-only by default
- generic company and persona labels are allowed
- no real names
- no real emails
- no real phone numbers
- no real addresses
- no real organization-specific sensitive data
- no copied customer transcripts
- no production exports
- no backup-derived data
- no query-result-derived data
- no report-derived data
- no logs
- no source-map or security-advisory evidence screenshots
- placeholder values must be obvious placeholders
- examples must not resemble real customer identifiers

## Asset Caveat Requirements

Every future internal asset must include or inherit these caveats:

- planning-only if not explicitly approved for creation
- customer-facing assets require explicit acceptance
- no enterprise rollout approval
- no real-customer pilot approval
- no customer-data approval
- no production-data approval
- no deploy approval
- no final DSGVO or legal approval
- no backup verification claim
- no real monitoring or alerting claim
- no `DB_READ_ONLY_AUDIT` approval
- no `Query Runner` approval
- no `reports_with_data` approval
- root/dashboard PostCSS technically fixed
- Next-internal PostCSS accepted temporarily, not fixed
- expiry `2026-08-06`
- stable Next upgrade remains required

## Dependency / Exception Asset Boundary

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
- expiry `2026-08-06`
- stable Next upgrade remains required

Asset implications:

- asset materials must not claim Next-internal PostCSS is fixed
- customer-facing security slides must include the caveat if the security baseline is discussed
- the exception grants no deploy approval
- the exception grants no enterprise approval
- the exception grants no customer-data approval

## Slide Asset Checklist

Template fields for any future slide candidate:

- slide title placeholder
- intended audience
- internal or customer-facing status
- data source status
- synthetic-only confirmation
- caveats included
- forbidden claims checked
- owner placeholder
- approval status
- expiry date
- revalidation trigger

Important:

- this section is checklist/template only
- this document creates no slides

## Screenshot Asset Checklist

- screenshot asset creation currently not approved
- only synthetic and no-customer-data screenshots could be considered later
- no screenshots are generated by this checklist
- no real customer data
- no secrets
- no logs
- no reports
- no query results
- no production URLs with tokens
- no customer domains unless separately approved
- separate approval is required for capture, storage, and retention

## Recording Asset Checklist

- recording asset creation currently not approved
- no recordings are generated by this checklist
- synthetic-only future candidate only
- no real customer data
- no customer voice or video
- no real contacts
- no secrets
- no logs
- no reports
- no query results
- separate approval is required for recording, storage, retention, and sharing

## Architecture Diagram Checklist

- architecture diagram candidate allowed as planning only
- generic architecture components only
- no real endpoints
- no secrets
- no provider tokens
- no internal IPs or private hostnames
- no customer-specific integrations
- no live system claims
- tenant and site isolation may be described conceptually
- no DB schema dump
- no infrastructure secret paths

## Security Posture One-Pager Checklist

- allowed only with caveats
- `production-context audit` PASS with caveat
- root/dashboard PostCSS technically fixed
- Next-internal PostCSS accepted temporarily, not fixed
- Authorization Matrix PASS
- Security Boundaries PASS
- governance docs exist

Forbidden claims:

- fully enterprise ready
- final compliance approved
- PostCSS fully fixed
- no residual risk
- backup verified
- monitoring operational
- deploy approved

## Asset Review Workflow

Workflow steps for any future asset request:

1. draft planning-only outline
2. classify audience
3. classify data
4. confirm synthetic-only
5. add caveats
6. check forbidden claims
7. security owner review
8. privacy owner review
9. demo owner review
10. expiry and revalidation assignment
11. storage and retention approval if an asset is actually created later

Important:

- this workflow is documentation only
- this workflow performs no asset creation

## Approval Status Matrix

| Approval Area | Current Status | Required Before Asset Creation | Notes |
| --- | --- | --- | --- |
| asset_creation | `not_approved` | explicit human approval | default remains blocked |
| slide_creation | `not_approved` | separate explicit approval | checklist does not approve slide creation |
| screenshot_creation | `not_approved` | separate explicit approval | capture, storage, and retention remain separate |
| recording_creation | `not_approved` | separate explicit approval | recording, storage, retention, and sharing remain separate |
| customer_facing_asset | `not_approved` | explicit acceptance plus caveat approval | blocked by default |
| synthetic_data | `required_but_not_yet_approved_for_creation` | proof of synthetic-only and sanitized content | planning only is allowed |
| demo_owner | `placeholder_only` | named accountable owner | owner must exist before creation |
| security_owner | `review_required` | explicit review | required for caveats and security posture |
| privacy_owner | `review_required` | explicit review | required for data, storage, and sharing constraints |
| storage_location | `not_approved` | explicit storage approval | no asset storage defined here |
| retention_period | `not_approved` | explicit retention approval | no retention decision granted here |
| sharing_scope | `not_approved` | explicit sharing approval | internal vs customer-facing sharing stays blocked |
| customer_data | `not_approved` | separate explicit approval | blocked by default |
| production_data | `not_approved` | separate explicit approval | blocked by default |
| deploy | `not_approved` | separate deploy task and approval | not part of this checklist |
| DB_READ_ONLY_AUDIT | `not_granted` | separate explicit human approval | remains blocked |
| Query Runner | `not_granted` | separate explicit approval | remains blocked |
| Reports with data | `not_granted` | separate explicit approval | remains blocked |

## Asset Stop Criteria

Future asset creation must stop immediately if any of the following becomes true:

- `production-context audit` FAIL
- scoped exception expired
- new non-excepted High or Critical finding appears
- root/dashboard PostCSS drift regresses
- asset needs customer data
- asset needs production data
- asset needs `DB_READ_ONLY_AUDIT`
- asset needs `Query Runner`
- asset needs `Reports with data`
- asset needs production logs
- asset needs DSAR or export
- asset needs backup metadata
- asset needs monitor or alert proof
- asset needs deploy proof
- asset needs screenshot or recording without approval
- customer-facing caveat rejected
- owner approval missing
- storage or retention unclear

## Future Asset Evidence Model

Allowed future evidence, if a future asset is explicitly approved:

- asset checklist completion status
- list of caveats included
- list of forbidden claims checked
- list of missing approvals
- list of blocked content requests
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
- real customer contact data

## Relationship To Existing Docs

- `ENT-SEC-1J` = Internal Demo Asset Checklist
- `ENT-SEC-1I` = Enterprise Demo Dry-Run Decision Gate
- `ENT-SEC-1H` = Enterprise Demo FAQ / Objection Handling
- `ENT-SEC-1G` = Enterprise Demo Talk Track
- `ENT-SEC-1F` = Enterprise Demo Scope Pack
- `ENT-SEC-1E` = Enterprise Pilot Readiness Summary Refresh
- `P0-Security-Audit-Drift-4G` = Dashboard PostCSS `GHSA-r28c-9q8g-f849` package fix and scoped Next exception update
- `SRE-1G` = Monitor / Alert Setup Decision Gate
- `SRE-2F` = Production Backup Verification Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## Recommended Next Step

Recommended immediate next step:

- `ENT-SEC-1J-D` for PR review and merge

Useful documentation-only follow-up after merge:

- `ENT-SEC-1K Demo Internal Readiness Closure Summary`

Execution-sensitive follow-ups only with explicit approval:

- `ENT-SEC-1I-EXEC Internal Synthetic Demo Dry Run`
- `ENT-SEC-1J-EXEC Internal Synthetic Demo Asset Creation`
- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`
- `SRE-2F-EXEC Production Backup Metadata Verification`
- `DSGVO-1H-EXEC Local Synthetic DSAR Export Dry Run`

## Stop Boundaries

Diese Checklist erstellt keine Assets.

Diese Checklist erstellt keine Slides.

Diese Checklist erzeugt keine Screenshots.

Diese Checklist erzeugt keine Recordings.

Diese Checklist führt keinen Dry Run aus.

Diese Checklist führt keine Demo aus.

Diese Checklist liest keine DB.

Diese Checklist führt kein SQL aus.

Diese Checklist nutzt keinen Query Runner.

Diese Checklist erzeugt keine Reports.

Diese Checklist führt keine DSAR-Anfrage aus.

Diese Checklist führt keinen Export aus.

Diese Checklist erzeugt keine JSON-, CSV- oder ZIP-Exportdatei.

Diese Checklist führt keine Löschung aus.

Diese Checklist führt keine Korrektur aus.

Diese Checklist führt keine Retention-Aktion aus.

Diese Checklist öffnet keine Backups, Dumps oder Exporte.

Diese Checklist liest keine Secrets.

Diese Checklist führt keine Production-Abfragen aus.

Diese Checklist führt keine Healthchecks aus.

Diese Checklist fragt keine Production Logs ab.

Diese Checklist ändert keine Production Config.

Diese Checklist deployt nichts.

Diese Checklist richtet keine Monitore oder Alerts ein.

Diese Checklist dokumentiert keine Kundendaten.

Diese Checklist dokumentiert keine echten Kontakte.

Diese Checklist gibt keine DSGVO-Konformität frei.

Diese Checklist gibt keine reale Pilotfreigabe frei.

Diese Checklist gibt keine Enterprise-Freigabe frei.

Diese Checklist gibt keine Deploy-Freigabe frei.

Diese Checklist markiert Next-internal PostCSS nicht als gefixt.

Diese Checklist gibt `ENT-SEC-1I-EXEC` nicht frei.

Diese Checklist gibt `ENT-SEC-1J-EXEC` nicht frei.

## Non-goals

- no implementation
- no asset creation
- no slide creation
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
