# SRE Backup Inventory Audit

Stand: 2026-07-21

## 1. Summary

This document inventories the backup-, restore-, freshness-, offsite-, and rollback-related artifacts that are visible in the repository and existing documentation for Enterprise Pilot readiness.

Purpose:

- identify which backup and restore building blocks are repo-evident today
- separate visible artifacts from live operational proof
- capture unknowns, blocked areas, and follow-up decisions
- prepare later approval-based backup and restore work without performing any system action now

This step is intentionally `DOKU_ONLY`.

This audit does not:

- execute any backup
- execute any restore
- read any database
- execute SQL
- run `pg_dump`, `pg_restore`, or `psql`
- change runtime code
- change Production config
- perform a deploy
- document secrets, connection strings, or customer data

## 2. Audit Scope

This audit examined only repository-visible and documentation-visible artifacts in read-only form.

Included sources:

- existing operations documentation
- existing architecture and security documentation
- `scripts/ops/*` backup-, restore-, freshness-, and health-related scripts
- `scripts/ops/systemd/*` service and timer units
- repository-visible deploy and compose file paths

Explicit limits:

- no Production queries
- no staging queries
- no DB reads or writes
- no script execution for backup, restore, freshness, offsite sync, Docker, or Production health
- no validation that a visible script is live-enabled unless existing documentation explicitly states so

## 3. Inventory Classification Model

The following labels are used throughout this audit:

- `repo_evident`: the file or artifact is directly visible in the repository
- `documented_only`: the behavior or evidence is described in documentation, but the underlying operational state is not directly verified here
- `configured_evidence_unknown`: a script or unit exists, but live enablement or effective runtime configuration is not proven
- `validated`: an explicit prior documentation record claims a completed validation step
- `not_validated`: visible or documented, but no current validation evidence is established
- `unknown_requires_follow_up`: the current owner, schedule, target, or proof is unclear
- `blocked_without_approval`: further verification would require explicit human approval, DB/PII approval, or Production access
- `not_found`: expected concept was not found as a repo-visible artifact in this audit

Rule:

- `validated` is used only for evidence that existing documentation already states as completed.
- This audit itself does not convert any artifact into validated operational proof.

## 4. Backup / Restore Artifact Inventory

| Artifact | Path | Category | Purpose | Classification | Execution Allowed Now | Live Activation Evidence | Restore Evidence | Risk | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL backup script | `scripts/ops/backup-postgres.sh` | local backup | create compressed PostgreSQL backups and prune older local files by retention window | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | systemd service/timer exist, but live enablement is not proven in this audit | none in this file | backup may exist in code but not necessarily in regular production operation | confirm owner, host enablement, retention ownership, and storage guarantees |
| Backup freshness check | `scripts/ops/check-last-backup.sh` | freshness | confirm latest local PostgreSQL backup exists, is large enough, and is not older than a configured threshold | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | referenced by the production health script, but not executed here | n/a | visible check logic does not prove live scheduling or recent success | document who reviews failures and where evidence is retained |
| Offsite freshness check | `scripts/ops/check-offsite-backup.sh` | offsite freshness | inspect offsite snapshot recency and file presence through restic metadata | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | referenced by the production health script, but dependent on external offsite config | n/a | offsite path exists in code, but live repo, credentials, and schedule are not proven | document repository owner, snapshot policy, and alert path |
| Offsite sync script | `scripts/ops/sync-backups-offsite.sh` | offsite backup | push local PostgreSQL backup files to an offsite restic repository | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | offsite service/timer exist, but enablement and last successful run are unknown | none in this file | offsite sync may be designed but not actively proven | document ownership, offsite schedule, and restore dependency on offsite storage |
| Restore test script | `scripts/ops/restore-postgres-test.sh` | restore test | restore a backup into a temporary test database and run hardcoded validation queries | `repo_evident`, `not_validated` | no | no live activation concept; manual script | script exists; prior docs mention legacy isolated restore-test evidence, but this audit does not re-validate it | script contains real table checks and a site-specific validation query, which increases future review sensitivity | review and sanitize future restore validation strategy before any approved execution |
| Local retention dry run | `scripts/ops/retention-dry-run.sh` | retention review | dry-run reporting for retention candidates across DB-backed datasets and local backup files | `repo_evident`, `blocked_without_approval` | no | none | not a restore artifact | script includes DB queries and would exceed this task's no-DB scope | treat as follow-up input for retention governance only |
| Offsite retention dry run | `scripts/ops/restic-retention-dry-run.sh` | offsite retention review | dry-run reporting for restic snapshot retention without deletion | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | none proven in this audit | not a restore artifact | offsite retention policy exists as a concept, not as validated operating evidence | document approval model before any future retention action |
| Backup systemd service | `scripts/ops/systemd/ai-chatbot-backup.service` | scheduling | invoke the PostgreSQL backup script with local backup directory and retention parameters | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | unit file exists; no proof it is installed or enabled on the live host | none | repo-visible unit does not prove runtime installation | confirm installation, enablement, and owner |
| Backup systemd timer | `scripts/ops/systemd/ai-chatbot-backup.timer` | scheduling | define a daily local backup schedule | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | timer exists with UTC schedule, but host enablement is unproven | none | documented schedule may drift from live host state | verify live timer status and run history in a separate approved task |
| Offsite systemd service | `scripts/ops/systemd/ai-chatbot-backup-offsite.service` | scheduling | invoke the offsite sync script after local backup | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | unit exists; host installation unknown | none | offsite dependency chain may be incomplete or unowned | document owner and failure handling |
| Offsite systemd timer | `scripts/ops/systemd/ai-chatbot-backup-offsite.timer` | scheduling | define a daily offsite sync schedule | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | timer exists with UTC schedule, but host enablement is unproven | none | schedule may be documented without runtime proof | verify live timer state separately |
| Backup failure notification unit | `scripts/ops/systemd/ai-chatbot-backup-failed.service` | failure handling | emit a backup failure notice via logger and alert wrapper | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | repo-visible only | none | failure path exists, but routing and delivery ownership remain unclear | audit alert ownership and routing |
| Offsite backup failure notification unit | `scripts/ops/systemd/ai-chatbot-backup-offsite-failed.service` | failure handling | emit an offsite backup failure notice via logger and alert wrapper | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | repo-visible only | none | notification path exists, but escalation model remains incomplete | align with alert routing design |
| Production health script | `scripts/ops/check-production-health.sh` | health/freshness gate | central deploy-adjacent health gate that references backup freshness and offsite freshness checks | `repo_evident`, `documented_only`, `validated` | no in this task | existing SRE docs treat this as a current manual and deploy-adjacent health gate | n/a | production health can expose backup-warning dependencies, but this audit does not execute it | keep as supporting evidence, not as direct backup proof |
| Production health alert wrapper | `scripts/ops/run-production-health-with-alert.sh` | alert wrapper | wrap production health with alerting behavior | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | mentioned in monitoring docs, not proven live | n/a | alerting path may exist without final ownership and routing proof | validate routing and ownership separately |
| Docker fallback build gate | `docs/operations/remote-docker-fallback-dry-run-status.md` and `.github/workflows/docker-fallback-gate.yml` | build-only fallback | provide build-only fallback gate when Main-CI is unavailable | `documented_only`, `validated` | no | dry-run validation is explicitly documented; operational use is constrained to gate scenarios | n/a | not a backup itself, but part of recovery/build continuity evidence | keep as governance and recovery-support artifact |
| Deploy rollback documentation | `docs/operations/security-audit-drift-body-parser-deploy-status.md` and deploy/status docs | rollback evidence | document exact commits, image digests, unchanged surfaces, and rollback need/no-need decisions | `documented_only`, `validated` | no | explicit production validation docs exist for prior deploy tasks | rollback evidence exists; restore evidence does not | runtime rollback is better documented than DB restore | continue documenting exact image-to-commit rollback points |
| Incident response runbook | `docs/operations/sre-incident-response-runbook.md` | process recovery | define severity, ownership, escalation, and rollback decision flow | `repo_evident`, `documented_only`, `not_validated` | no | docs exist; no technical implementation claim | n/a | process exists, but does not itself prove backup/restore readiness | align ownership and backup escalation follow-ups |
| Pilot health review checklist | `docs/operations/sre-pilot-health-review-checklist.md` | governance | include backup/restore drill status as a weekly pilot readiness review area | `repo_evident`, `documented_only`, `not_validated` | no | checklist exists; does not prove live routine usage | n/a | governance reference exists, but inventory ownership remains incomplete | add inventory-driven follow-up decisions after this audit |
| Backup/restore drill plan | `docs/operations/sre-backup-restore-drill-plan.md` | governance baseline | define recovery assets, drill levels, guardrails, and prior next-step expectations | `repo_evident`, `documented_only`, `not_validated` | no | existing documentation only | explicitly notes that periodic drill status is unknown and restore execution was not re-verified | strong planning baseline, weak live proof | use this inventory to move to ownership/access design |
| Enterprise SRE security readiness audit | `docs/operations/enterprise-sre-security-readiness-audit.md` | enterprise baseline | identify formal backup/restore readiness as an enterprise gap | `repo_evident`, `documented_only`, `not_validated` | no | docs exist | n/a | confirms backup/restore remains a high-priority SRE gap | use as enterprise risk context, not as operational proof |
| Compose and deployment files | `docker-compose.yml`, `docker-compose.staging.yml`, `docker-compose.nolis-demo.yml`, `docs/architecture/docker-deployment.md` | host/deploy recovery | represent host/runtime composition and environment layout | `repo_evident`, `configured_evidence_unknown`, `not_validated` | no | file presence only | n/a | host rebuild and config recovery remain partially documented | define host rebuild prerequisites and owner model |

## 5. Asset Coverage Matrix

| Asset | Backup Evidence | Restore Evidence | Freshness Evidence | Owner Evidence | Pilot Criticality | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Git/source | remote Git plus local clone model documented | conceptual clone/fetch recovery only | n/a | source ownership not explicitly audited here | high | `repo_evident`, `not_validated` |
| API image | deploy/status docs track commit and image baselines | rollback documented in prior deploy status docs | n/a | deploy ownership exists by role, not by dedicated retention owner | high | `documented_only`, `validated` for prior deploy proof |
| Dashboard image | deploy/status docs track commit/image baseline concept | rollback concept documented | n/a | retention owner not documented here | medium to high | `documented_only`, `not_validated` |
| Widget image | deploy/status docs track commit/image baseline concept | rollback concept documented | n/a | retention owner not documented here | high | `documented_only`, `not_validated` |
| Postgres DB | local backup, offsite sync, restore-test, and retention dry-run artifacts visible | restore-test script exists; legacy isolated restore-test success is referenced in docs | local and offsite freshness check scripts visible | backup owner and access model remain unknown | critical | `repo_evident`, `not_validated`, partially `documented_only` |
| Redis state | no dedicated Redis backup artifact found | no Redis restore artifact found | no Redis-specific freshness artifact found | no explicit owner or policy | medium | `unknown_requires_follow_up` |
| Production config | documented only as external operational data | no restore evidence found | no freshness concept | secure owner model not documented here | critical | `documented_only`, `unknown_requires_follow_up` |
| Secrets/credentials | documented only as categories outside Git | no secret recovery evidence found | no freshness concept | break-glass/rotation owner not documented here | critical | `documented_only`, `unknown_requires_follow_up` |
| DNS/domain | no repo-visible backup artifact | no repo-visible restore artifact | no freshness concept | provider owner not documented here | high | `unknown_requires_follow_up` |
| TLS certificates | no repo-visible backup artifact | no repo-visible restore artifact | no freshness concept | cert owner not documented here | high | `unknown_requires_follow_up` |
| Public widget assets | source and build/deploy docs visible | rebuild/rollback concept documented | health and smoke gates exist | asset/CDN owner not documented here | high | `documented_only`, `not_validated` |
| Tenant/customer config | implied DB-backed scope in prior docs | no dedicated restore validation evidence | no dedicated freshness evidence | owner model not documented here | critical | `documented_only`, `unknown_requires_follow_up` |
| Conversation/session data | implied DB-backed scope in prior docs | no dedicated restore validation evidence | no dedicated freshness evidence | owner model not documented here | high | `documented_only`, `unknown_requires_follow_up` |
| `email_jobs` | included in restore-test script validation scope | no approved live audit or restore validation | no dedicated freshness evidence | no recovery owner documented here | high | `repo_evident`, `blocked_without_approval` for deeper review |
| `webhook_jobs` | included in restore-test script validation scope | no approved live audit or restore validation | no dedicated freshness evidence | no recovery owner documented here | high | `repo_evident`, `blocked_without_approval` for deeper review |
| `report_runs` | mentioned in retention dry-run scope and drill plan | no dedicated restore validation evidence | no dedicated freshness evidence | no recovery owner documented here | medium | `repo_evident`, `blocked_without_approval` for deeper review |
| External provider config | documented only as category | no restore evidence found | no freshness concept | provider ownership not documented here | high | `documented_only`, `unknown_requires_follow_up` |
| Deployment host / compose files | compose files and deployment docs visible | no host rebuild drill proof | no host freshness concept | host ownership only partial | high | `repo_evident`, `not_validated` |
| Operational docs | multiple runbooks and audit docs exist | Git restore path conceptually clear | n/a | docs ownership not formally audited here | medium | `repo_evident`, `not_validated` |

## 6. Findings

### A. Confirmed repo-evident artifacts

- `scripts/ops/backup-postgres.sh`
- `scripts/ops/check-last-backup.sh`
- `scripts/ops/check-offsite-backup.sh`
- `scripts/ops/sync-backups-offsite.sh`
- `scripts/ops/restore-postgres-test.sh`
- `scripts/ops/retention-dry-run.sh`
- `scripts/ops/restic-retention-dry-run.sh`
- `scripts/ops/systemd/ai-chatbot-backup.service`
- `scripts/ops/systemd/ai-chatbot-backup.timer`
- `scripts/ops/systemd/ai-chatbot-backup-offsite.service`
- `scripts/ops/systemd/ai-chatbot-backup-offsite.timer`
- `scripts/ops/systemd/ai-chatbot-backup-failed.service`
- `scripts/ops/systemd/ai-chatbot-backup-offsite-failed.service`
- `scripts/ops/check-production-health.sh`
- `docker-compose.yml`
- `docker-compose.staging.yml`
- `docs/operations/sre-backup-restore-drill-plan.md`
- `docs/operations/sre-pilot-health-review-checklist.md`
- `docs/operations/sre-incident-response-runbook.md`
- `docs/operations/enterprise-sre-security-readiness-audit.md`

### B. Not validated

- visible local backup creation logic does not prove current production scheduling
- visible offsite sync and restic verification logic does not prove current repository reachability, successful snapshot creation, or current retention enforcement
- visible systemd service and timer units do not prove installation or enablement on the live host
- visible restore-test logic does not prove that periodic restore drills currently run
- runtime rollback evidence for API/image-based deploys is better documented than database restore evidence, but retention guarantees for those images are still not fully inventoried

### C. Unknowns

- who owns local backup success review
- who owns offsite repository access and rotation
- whether backup and offsite systemd timers are currently enabled on every relevant live host
- where backup success/failure history is retained operationally
- what the last successful local backup timestamp was
- what the last successful offsite backup timestamp was
- what the last successful restore test timestamp was
- whether restore-test inputs use sanitized, dummy, or production-derived data in practice
- whether Redis is intentionally ephemeral or requires explicit backup policy
- how Production config and secret recovery are stored and governed
- which provider accounts own DNS, TLS, SMTP, AI/API, and monitoring recovery
- whether DB RPO/RTO targets are acceptable to the pilot

### D. Blocked areas

- production backup verification
- production restore test
- DB backup content verification
- any restore involving PII-bearing production data
- any `DB_READ_ONLY_AUDIT`
- any deeper review of `email_jobs`, `webhook_jobs`, `report_runs`, or other DB-backed operational datasets

## 7. Backup Freshness Evidence Review

Repo-visible freshness evidence:

- `scripts/ops/check-last-backup.sh`
- `scripts/ops/check-offsite-backup.sh`
- `scripts/ops/check-production-health.sh` references both freshness checks
- `scripts/ops/retention-dry-run.sh` contains a local backup-file age view
- `scripts/ops/restic-retention-dry-run.sh` contains an offsite snapshot age view

What these artifacts conceptually check:

- local backup file presence
- local backup file age and minimum size
- offsite snapshot presence, age, and expected PostgreSQL backup-file shape
- dry-run retention scope for local and offsite artifacts

What this audit does not claim:

- no freshness script was executed
- no current backup age was measured
- no current offsite snapshot was inspected
- no live warning or failure state was checked

Data still needed for later follow-ups:

- current owner for each freshness signal
- expected review channel or escalation route
- current thresholds that are considered acceptable for pilot RPO expectations
- evidence of live timer enablement and recent successful runs

## 8. Restore Evidence Review

Visible restore-related artifacts:

- `scripts/ops/restore-postgres-test.sh`
- `docs/operations/sre-backup-restore-drill-plan.md`
- `docs/operations/enterprise-sre-security-readiness-audit.md`

Observed restore evidence shape:

- a dedicated restore-test script exists for a temporary test database
- the restore-test script includes concrete table-count validation logic
- the drill-plan document states that a legacy operations runbook documents a successful isolated restore test from an offsite copy
- this audit did not identify a current recurring restore-drill schedule with live proof

Interpretation:

- restore mechanics are more than theoretical because a repo-visible test script exists
- recurring restore validation remains `not_validated`
- the restore-test script should not be treated as automatically safe for future use without explicit review because it contains concrete validation queries, including a site-specific check

Required future approvals before any operational use:

- explicit human approval
- clear target-environment approval
- PII / DSGVO strategy approval if any real data could be involved
- secret/config recovery approval if Production-adjacent settings are needed

## 9. Backup / Restore Risk Register

| Risk | Impact | Current Evidence | Severity | Pilot Impact | Required Follow-up |
| --- | --- | --- | --- | --- | --- |
| Backup owner unknown | failures may go unnoticed or unactioned | scripts and timers exist, owner model not documented | high | weak operational accountability | `SRE-2C` |
| Backup schedule unknown in live operation | expected cadence may differ from repo timers | timer files exist, enablement unknown | high | backup confidence gap | `SRE-2C` |
| Offsite status unknown | disaster recovery may depend on an unverified external path | offsite scripts exist, no live proof in this audit | high | DR gap | `SRE-2C` |
| Last restore test unknown | recovery confidence remains low | restore-test script exists; recurring validation not proven | high | pilot recovery trust gap | `SRE-2D` and `SRE-2E` |
| DB RPO/RTO not validated | no truthful recovery promise can be made | drill plan explicitly labels DB targets not validated | critical | enterprise pilot blocker | `SRE-2C` then `SRE-2D` |
| Secret recovery unknown | recovery may stall even when backups exist | docs only mention secrets as categories | critical | hard blocker in incident recovery | `SRE-2C` plus security follow-up |
| PII restore strategy unknown | restore work could violate policy or create exposure | guardrails are documented, strategy is not | critical | blocks any real restore exercise | `SRE-2D` plus DSGVO follow-up |
| Redis recovery unclear | hidden state expectations could break runtime recovery | no dedicated Redis backup artifact found | medium | partial recovery ambiguity | `SRE-2C` |
| External provider recovery unclear | SMTP/AI/API/monitoring outages may be slow to recover | only category-level documentation exists | high | operational continuity gap | `SRE-2C` |
| systemd live activation unknown | repo timers may not match host reality | unit files exist, activation not proven | high | scheduling confidence gap | `SRE-2C` |
| backup logs not reviewed | false positives or silent failures may be missed | failure services and health references exist, logs not audited | high | alerting blind spot | `SRE-2C` |
| restore command safety not validated | future restore execution could be unsafe or overscoped | restore script exists but was not approved or executed here | high | restore exercise blocker | `SRE-2D` |

## 10. Pilot Readiness Assessment

### Green

- repo-evident local backup, offsite, freshness, retention, and restore-test scripts exist
- repo-evident backup and offsite systemd unit files exist
- deploy rollback documentation exists in prior status docs
- health and smoke gate documentation exists
- incident and pilot review governance docs exist

### Yellow

- backup inventory is now documented as a distinct artifact
- multiple backup and restore building blocks are visible, but live activation remains unproven
- offsite and restore logic exist, but current successful operation is not confirmed in this audit

### Red / blocking before a serious enterprise pilot claim

- no confirmed current backup owner
- no confirmed current restore owner
- no validated DB RPO/RTO
- no validated PII / DSGVO restore strategy
- no validated secret recovery model
- no confirmed recurring restore drill

## 11. Required Follow-ups

Recommended follow-ups:

- `SRE-2C Backup Responsibility / Access Model`
- `SRE-2D Non-production Restore Drill Design`
- `SRE-2E Local/Staging Restore Dry Run`
- `SRE-2F Production Backup Verification Decision Gate`

Optional adjacent follow-ups:

- `DSGVO-1A PII Data Map`
- `ENT-SEC-1A Enterprise Security Gap Audit`

## 12. Stop Boundaries

This audit explicitly does not:

- execute a backup
- execute a restore
- read a database
- execute SQL
- run `pg_dump`
- run `pg_restore`
- run `psql`
- generate dumps, exports, or reports
- change Production config
- deploy anything
- change the Public Widget response
- mutate any customer site

## 13. Recommended Next Step

Recommended next step:

- `SRE-2C Backup Responsibility / Access Model`

Alternative:

- `SRE-2D Non-production Restore Drill Design`

Reason:

- the repository now has a documented artifact inventory, but ownership, access, live enablement, and break-glass recovery are still the main missing links before any safe restore design can be finalized

## 14. Non-goals

This audit intentionally does not include:

- implementation
- backup execution
- restore execution
- DB access
- SQL
- deploy
- runtime changes
- customer data
- secrets
