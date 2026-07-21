# SRE Backup Restore Drill Plan

Stand: 2026-07-21

## 1. Summary

This document defines a documentation-only backup and restore drill plan for Enterprise Pilot readiness.

Purpose:

- define which systems and recovery assets matter for the pilot
- document the current recovery baseline that is already visible in the repository
- define safe drill levels, guardrails, stop criteria, and follow-up work
- prepare later approval-based backup and restore tasks without performing any system action now

This step is intentionally `DOKU_ONLY`.

This plan does not:

- execute any backup
- execute any restore
- read any database
- execute SQL
- run `pg_dump` or `pg_restore`
- change runtime code
- change Production config
- perform a deploy
- expose secrets, contact data, query results, or customer data

## 2. Current Recovery Baseline

The current repository-visible baseline is:

- deploy rollback points are routinely documented in deploy and post-deploy status records
- API, dashboard, and widget commit baselines are documented in deployment/status material
- Production Health and safe Public Widget Smoke gates exist as established validation signals
- the SRE incident response runbook exists
- the SRE pilot health review checklist exists
- the external uptime monitor design exists
- the minimal external monitor setup plan exists
- the remote Docker fallback build gate exists
- local PostgreSQL backup, backup freshness, offsite backup freshness, retention dry-run, and offsite sync scripts exist in `scripts/ops`
- versioned systemd units for local backup and offsite backup automation exist in `scripts/ops/systemd`
- a restore test script exists for an isolated temporary PostgreSQL database
- `DB_READ_ONLY_AUDIT` remains blocked without explicit human approval

Current status boundaries:

- real backup execution: not performed in this task
- real restore execution: not performed in this task
- DB reads: not performed in this task
- SQL: not performed in this task
- Production config changes: not performed in this task

Evidence quality notes:

- backup automation in the repository is clearly documented as scripts plus versioned systemd units
- whether those units are currently enabled on every live host is `unknown / requires follow-up`
- a legacy operations runbook documents a successful isolated restore test from an offsite copy
- this task does not re-verify that restore test and does not claim current periodic restore-drill validation

Working status labels:

- existing backup automation evidence: `documented in repo`
- existing restore-test evidence: `documented in legacy runbook`
- current periodic restore-drill status: `unknown / requires follow-up`
- current backup ownership and access model: `unknown / requires follow-up`

## 3. Recovery Asset Inventory

| Asset | Purpose | Current Backup Evidence | Restore Evidence | Pilot Criticality | Risk | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| Git repository / source code | canonical application and operations source | remote Git repository plus local clone model are implicit repo controls | clone/fetch restore path is conceptually clear, not drill-validated here | high | remote access or branch hygiene failure can slow recovery | verify source ownership and release-tag discipline |
| API Docker image | API runtime rollback artifact | deploy/status docs track API image digests and commit baselines | API-only rollback process is documented, but not as a formal restore drill | high | image provenance or retention may be incomplete across time | document image retention and registry recovery expectations |
| Dashboard Docker image | dashboard runtime rollback artifact | image and commit baselines are documented in deploy/status material | rollback concept exists, restore drill not validated here | medium to high | dashboard asset drift can block admin operations | confirm image retention and rollback owner |
| Widget Docker image | widget runtime rollback artifact | image and commit baselines are documented in deploy/status material | rollback concept exists, restore drill not validated here | high | widget outage is customer-facing | confirm retention and fast rollback path |
| Postgres database | primary system of record | local backup, offsite sync, backup freshness, offsite freshness, and restore-test scripts exist | legacy runbook documents isolated restore-test evidence; periodic drill status unknown | critical | incomplete backup ownership or unvalidated production restore path | run `SRE-2B` inventory audit and validate ownership/access |
| Redis state | cache, rate limits, queue-adjacent ephemeral state | no dedicated Redis backup evidence in current repo baseline | no restore evidence in current repo baseline | medium | accepted data loss may be tolerable for some keys but not yet formally decided | define whether Redis is ephemeral or needs explicit backup policy |
| Production environment configuration | runtime env and service connectivity configuration | documented only as external to Git and separately required | no restore evidence in current repo baseline | critical | config loss can block all runtime recovery | define secure config backup and recovery ownership |
| Domain / DNS configuration | public routing for API, dashboard, and widget | no direct backup evidence in repo | no restore evidence in repo | high | domain or DNS loss blocks public access | document provider owner, exportability, and recovery path |
| TLS certificates | public HTTPS availability | documented as external operational data outside Git | no restore evidence in repo | high | expiry or loss breaks availability and trust | define certificate inventory and recovery owner |
| Public widget static assets | customer-facing loader, bundle, metadata | build artifacts can be recreated from source; deployed assets tracked by commit/version docs | rebuild/rollback concept exists, not formal drill-validated | high | customer-facing regression if asset path is broken | document CDN/proxy/static asset recovery path |
| Customer / tenant configuration | tenant/site/module/domain settings | likely included in PostgreSQL backup scope per legacy runbook tables | no current restore drill validation specific to tenant config | critical | partial restore can break tenant isolation or customer routing | define validation steps for tenant/site config after restore |
| Conversation / session data | operational chat history and widget session continuity | documented as PostgreSQL-backed data classes | no current restore drill validation specific to these datasets | high | data loss harms pilot trust and supportability | define approved non-production validation data concept |
| `email_jobs` / `webhook_jobs` state | delivery and integration state | legacy runbook lists both in DB restore-test scope | no separate recovery validation evidence | high | replay, duplication, or incomplete restore can create side effects | define side-effect-safe validation approach before real drills |
| `report_runs` / analytics / usage state | reporting, usage, and audit context | partial evidence via PostgreSQL table inventory and docs | no direct restore validation evidence | medium | reporting integrity may drift unnoticed | clarify which analytics state is pilot-critical |
| External provider configuration | SMTP, AI/API, proxy, monitoring, and similar provider settings | documented only as categories and external operational data | no restore evidence in repo | high | provider outage or config loss can block functionality | create provider inventory and ownership model |
| Deployment host / compose files | server runtime composition and operational entrypoint | compose files and repo scripts exist; host setup itself is only partially documented | no host rebuild drill evidence in current repo baseline | high | host rebuild may stall without tested instructions | document host rebuild prerequisites and ownership |
| Secrets / credentials | required for runtime, backup, offsite sync, TLS, and providers | documented only as secret categories outside Git | no restore evidence in repo | critical | missing or stale secrets can block recovery entirely | define secret backup, rotation, and break-glass recovery plan |

## 4. Pilot Recovery Objectives

The following are proposed pilot targets, not validated guarantees.

| Recovery Objective | Proposed Pilot Target | Validation State | Notes |
| --- | --- | --- | --- |
| API runtime rollback RTO | 30 to 60 minutes | not validated | assumes last known good image/commit and clear operator ownership |
| Dashboard runtime rollback RTO | 30 to 60 minutes | not validated | depends on image retention and deploy path clarity |
| Widget runtime rollback RTO | 30 to 60 minutes | not validated | customer-facing surface; should stay fast |
| Postgres restore RTO | target not yet approved | not validated | current repo evidence is insufficient for a truthful numeric promise |
| Postgres backup RPO | target not yet approved | not validated | freshness checks exist, but end-to-end backup policy is not fully audited |
| Redis recovery objective | accepted loss or fast rebuild must be defined | not validated | current repo suggests Redis is secondary, but this is not yet formally approved |
| Config / secrets recovery | must be recoverable before pilot go | not validated | needs separate secure inventory and access model |
| DNS / TLS recovery | must be recoverable before pilot go | not validated | depends on external provider process and ownership |

Implications:

- runtime rollback targets can be proposed because commit/image rollback evidence already exists
- database, secret, DNS, and TLS recovery targets remain `not validated`
- no pilot should claim full disaster-recovery readiness until those targets are owned and tested

## 5. Backup Categories

| Category | Purpose | Needed Evidence | Restore Method Concept | Risks | Stop Criteria |
| --- | --- | --- | --- | --- | --- |
| Source / Git backup | recover source, docs, scripts, and release metadata | remote repository ownership, branch protection, tagged release or exact commit history | clone or fetch exact commit, rebuild images, re-run safe gates | missing release metadata or accidental branch drift | stop if source-of-truth repository or release reference is unclear |
| Container image rollback | recover API/dashboard/widget runtime quickly | image digest/commit linkage and retention evidence | redeploy last known good image or rebuild from exact commit | image retention unknown, registry drift, wrong image tag | stop if exact digest-to-commit mapping is unclear |
| Database backup | recover primary persistent data | backup script, health evidence, retention evidence, access ownership, restore procedure | restore to isolated environment first, then later production only with explicit approval | data loss, stale backups, PII handling, side effects after restore | stop if backup ownership, recency, or restore target is unclear |
| Redis/state backup or accepted loss | decide whether Redis must be backed up or can be rebuilt | explicit policy and runtime dependency review | restore if backed up, or flush/rebuild if ephemeral and approved | hidden runtime reliance can make accepted-loss unsafe | stop if Redis criticality is not formally decided |
| Configuration backup | recover env/config/runtime wiring | secure config inventory, backup location, owner, and recovery steps | restore secret-managed config into approved target environment | leaked or incomplete config blocks recovery | stop if config owner or secure storage is unknown |
| Secrets backup / rotation recovery | regain access to providers, DB, offsite storage, TLS, and runtime | secure secret inventory, storage, rotation owner, break-glass path | restore or rotate through approved secret-management process | secret loss or exposure can compound an incident | stop if secret source-of-truth is unclear |
| DNS/TLS recovery | recover public reachability and certificates | provider inventory, zone owner, cert owner, renewal process | restore DNS records or certificates through provider-side controls | public outage and trust breakage | stop if provider ownership or recovery access is unclear |
| External provider settings recovery | recover SMTP, AI/API, monitoring, proxy, or similar settings | provider inventory and config ownership | reapply documented provider config in secure admin context | undocumented provider drift blocks partial recovery | stop if provider scope or owner is unclear |
| Operational documentation backup | preserve runbooks, plans, and validation checklists | docs committed to source and reviewed | restore from Git and pair with approved runtime metadata | stale docs can mislead operators | stop if docs disagree with live recovery assumptions |

## 6. Restore Drill Levels

### Level 0: Documentation Review

- documentation only
- no systems touched
- no DB reads
- no backups
- no restores
- current task is Level 0

### Level 1: Local / Non-production Restore Dry Run

- no Production data
- no customer data
- no Production secrets
- no Production DB
- restore target must be isolated and disposable
- safe validation outputs only

### Level 2: Staging Restore Drill

- explicit approval required
- no Production data without approved PII strategy
- no query runner
- no reports with data
- staging target and validation steps must be predefined

### Level 3: Production Backup Verification

- explicit human approval required
- no DB reads without approval
- no SQL without approval
- only minimally invasive verification allowed
- goal is backup evidence, not restore mutation

### Level 4: Production Restore / Disaster Recovery

- allowed only during an incident or an explicitly approved DR drill
- separate runbook task required
- owner assignment, rollback path, and communications plan required
- strongest stop boundaries and governance apply

## 7. Drill Preconditions

No later real drill should start unless all applicable preconditions are true:

- owner roles are defined
- the backup responsibility and access model is documented
- incident runbook is available
- rollback points are known
- backup target is known
- backup encryption and access controls are known
- secrets handling is known
- PII / DSGVO strategy is known
- recovery target environment is defined
- no-go criteria are accepted by the operator path
- no Production DB action occurs without explicit human approval
- no restore uses customer data without explicit PII approval
- no reports with data are generated
- validation steps are defined in advance
- sanitized output rules are agreed

## 8. Proposed Pilot Backup/Restore Drill Sequence

### A. `SRE-2B Backup Inventory Audit`

- `DOKU_ONLY`
- inventory existing backup mechanisms, ownership, storage classes, and evidence
- no DB reads

### B. `SRE-2C Backup Responsibility / Access Model`

- `DOKU_ONLY`
- define roles, access paths, break-glass model, and secret handling

### C. `SRE-2D Non-production Restore Drill Design`

- `DOKU_ONLY`
- define target environment, dummy data policy, validation model, and stop criteria

### D. `SRE-2E Local/Staging Restore Dry Run`

- only after explicit approval
- no Production data
- no Production secrets

### E. `SRE-2F Production Backup Verification Decision Gate`

- explicit human approval required
- remains blocked without DB/SQL approval

## 9. Backup Verification Checklist

| Check | Status |
| --- | --- |
| Backup exists | yes / no / unknown |
| Backup schedule known | yes / no / unknown |
| Backup target known | yes / no / unknown |
| Encryption known | yes / no / unknown |
| Access owner known | yes / no / unknown |
| Restore procedure known | yes / no / unknown |
| Last restore test known | yes / no / unknown |
| RPO validated | yes / no / unknown |
| RTO validated | yes / no / unknown |
| PII handling known | yes / no / unknown |
| Secrets handling known | yes / no / unknown |
| Incident linkage known | yes / no / unknown |

## 10. Restore Drill Checklist

| Check | Required State |
| --- | --- |
| target environment selected | required |
| data class approved | required |
| no customer data unless explicitly approved | required |
| no Production secrets | required |
| restore commands reviewed | required |
| rollback from restore drill planned | required |
| validation steps defined | required |
| logs sanitized | required |
| no reports with data | required |
| results documented | required |

## 11. DB / PII Guardrails

The following boundaries remain mandatory:

- no `DB_READ_ONLY_AUDIT` without explicit human approval
- no SQL without separate approval
- no `pg_dump` without separate approval
- no restore with Production data without PII / DSGVO approval
- no query results in the repository
- no reports with data
- no customer or tenant data in chat, PRs, or logs
- no `email_jobs` or `webhook_jobs` reads, writes, or updates without explicit approval
- no cleanup, backfill, or enforcement action

## 12. Restore Validation Signals

Future safe validation signals should prefer metadata-only checks such as:

- app starts
- API `/healthz`
- dashboard `/healthz`
- widget `/version.json`
- safe synthetic config response
- no migrations unexpectedly run
- no secret leakage
- no unexpected delivery side effects
- no report or query output
- data validation only with an approved data-validation concept

## 13. Incident / Rollback Integration

This plan integrates with `SRE-1C` as follows:

- backup and restore drill work should strengthen incident readiness, not bypass it
- Production restore is inherently `SEV0` or `SEV1` relevant
- rollback decisions remain manual
- customer communication is handled by `communications_owner`
- security and privacy owners must be involved when PII or secrets may be affected

## 14. Pilot Go/No-Go Criteria for Backup/Restore

Pilot Go for backup/restore readiness requires:

- backup ownership documented
- recovery categories documented
- DB/PII guardrails documented
- restore drill plan documented
- deploy rollback points documented
- incident response runbook exists
- open unknowns captured as follow-up tasks

Pilot No-Go for backup/restore readiness if any of the following remain true:

- no known backup owner
- no DB backup strategy
- no secret recovery strategy
- no restore path
- no PII / DSGVO strategy for restore
- no incident or communication process
- open high or critical security findings

## 15. Stop Boundaries

This plan explicitly does not:

- execute a backup
- execute a restore
- read a database
- execute SQL
- run `pg_dump`
- generate dumps, exports, or reports
- change Production config
- deploy anything
- change the Public Widget response
- mutate any customer site

## 16. Recommended Next Step

Recommended next step:

- `SRE-2D Non-production Restore Drill Design`

Alternative:

- `DSGVO-1A PII Data Map`

`SRE-2D` is preferred because the repository now has both the backup inventory baseline and the responsibility/access model, but the next safe gap is the non-production restore target, dummy-data policy, validation model, and stop criteria.

## 17. Non-goals

This plan intentionally does not include:

- implementation
- backup execution
- restore execution
- DB access
- SQL
- deploy
- runtime changes
- customer data
- secrets
