# SRE Non-production Restore Drill Design

Stand: 2026-07-21

## 1. Summary

This document defines a documentation-only non-production restore drill design for Enterprise Pilot readiness.

Purpose:

- define a safe future restore-drill scope for local or non-production targets
- prefer schema-only, synthetic, and fixture-based inputs over any real customer-bearing data
- document allowed data classes, validation signals, stop criteria, and approval requirements
- prepare a later explicit decision gate for a real dry run without granting execution now

This step is intentionally `DOKU_ONLY`.

This design does not:

- execute any backup
- execute any restore
- read any database
- execute SQL
- run `pg_dump`, `pg_restore`, or `psql`
- use Production data
- use Production secrets
- perform a deploy
- change Production config
- change runtime code
- create dumps, exports, query results, or reports with data

## 2. Current Restore Readiness Baseline

Current repo-visible baseline:

- `SRE-2A Backup Restore Drill Plan` exists in [docs/operations/sre-backup-restore-drill-plan.md](/Users/ash/Documents/New%20project/AI-Chatbot/docs/operations/sre-backup-restore-drill-plan.md)
- `SRE-2B Backup Inventory Audit` exists in [docs/operations/sre-backup-inventory-audit.md](/Users/ash/Documents/New%20project/AI-Chatbot/docs/operations/sre-backup-inventory-audit.md)
- `SRE-2C Backup Responsibility / Access Model` exists in [docs/operations/sre-backup-responsibility-access-model.md](/Users/ash/Documents/New%20project/AI-Chatbot/docs/operations/sre-backup-responsibility-access-model.md)
- backup, freshness, offsite, restore-test, and timer artifacts are repo-evident
- restore-test artifacts are repo-evident, but no current validated recurring restore drill is proven here
- `backup_owner`, `restore_owner`, and `secret_recovery_owner` remain unconfirmed
- DB `RPO` and `RTO` remain not validated
- the PII / DSGVO restore strategy remains open
- `DB_READ_ONLY_AUDIT` remains blocked without explicit human approval
- real Production-backup verification remains blocked

Interpretation:

- the repository contains restore-adjacent building blocks
- governance and isolation boundaries now exist at plan, inventory, and access-model level
- the next safe gap is a non-production restore design that avoids Production data, Production secrets, and customer-bearing outputs

## 3. Drill Scope

Goal of this step:

- design a future non-production restore drill
- document which target environments and data classes could be considered later
- define safe validation signals and stop boundaries before any future execution task

Allowed future target-environment categories:

- local isolated environment
- disposable non-production environment
- staging only after explicit approval

Not allowed by this design:

- Production restore
- Production DB read
- Production backup-content inspection
- Production secrets
- customer data
- query results
- reports with data

## 4. Data Classification for Restore Drill

| Data Class | Allowed for SRE-2D Design | Allowed for Future Dry Run | Approval Needed | Notes |
| --- | --- | --- | --- | --- |
| synthetic dummy data | yes | yes, preferred | none beyond dry-run task approval | safest preferred baseline |
| schema-only data | yes | yes, preferred | none beyond dry-run task approval | validates restore shape without customer content |
| generated fixture data | yes | yes, preferred | none beyond dry-run task approval | should remain deterministic and non-sensitive |
| sanitized non-production data | yes | conditionally | documented origin plus privacy review if needed | only if provenance and sanitization are documented |
| staging data | yes as a blocked design category | blocked by default | explicit human approval plus any applicable privacy approval | staging comes after local/disposable scope |
| production backup data | yes as a forbidden category | no by default | human approval plus privacy / DSGVO approval | remains blocked in this design |
| customer / tenant data | yes as a forbidden category | no by default | privacy approval plus human approval | not acceptable for default dry run |
| conversation / session data | yes as a forbidden category | no by default | privacy approval plus human approval | high PII and confidentiality risk |
| `email_jobs` | yes as a blocked category | no by default | human approval plus side-effect review | no reads, writes, or exports without explicit approval |
| `webhook_jobs` | yes as a blocked category | no by default | human approval plus side-effect review | no reads, writes, or exports without explicit approval |
| `report_runs` | yes as a blocked category | no by default | human approval plus privacy review if data-bearing | no reads, writes, or exports without explicit approval |
| secrets / credentials | yes as a forbidden category | no | separate security task required | never allowed in repo or drill outputs |

Rules:

- synthetic, dummy, schema-only, and fixture-based inputs are preferred for any future non-production dry run
- sanitized non-production data is not automatically approved and requires documented provenance
- Production backup data remains blocked without explicit human approval and PII / DSGVO review
- secrets and credentials remain forbidden in repository docs and in drill output
- `email_jobs`, `webhook_jobs`, and `report_runs` remain blocked for reads, writes, and exports without separate approval

## 5. Non-production Restore Drill Design Principles

Any later real dry run must preserve all of the following principles:

- isolated environment only
- no Production secrets
- no Production data
- no customer data
- no delivery or integration execution
- no external webhooks
- no email or SMTP execution
- no reports with data
- no query results
- no Public Widget customer-site mutation
- validation through safe health, schema, and smoke signals only
- restore-drill success does not imply Production go-live or Production backup verification
- restore-drill evidence must remain sanitized and metadata-only

## 6. Proposed Drill Environment

Preferred future target model:

- local or otherwise disposable containerized environment
- isolated network boundary
- no Production credentials
- no external delivery integrations
- no public customer domain
- dummy `siteKey` or synthetic tenant only
- disposable DB volume
- disposable Redis only if technically required
- no persistent customer data

Current status:

- this document does not claim that such an environment already exists
- this document does not configure or validate that environment
- this document only defines the safe target shape for a later approval-based dry run

## 7. Restore Source Options

| Source | Status | Allowed | Risk | Required Approval | Notes |
| --- | --- | --- | --- | --- | --- |
| schema-only migration baseline | preferred | yes for future dry run | low | future dry-run task approval | safest default input |
| synthetic seed / fixture data | preferred | yes for future dry run | low | future dry-run task approval | should remain non-sensitive and disposable |
| sanitized non-production backup | conditional | not approved by default | medium | documented provenance plus applicable privacy approval | only after sanitization evidence exists |
| staging backup | blocked by default | no by default | high | explicit human approval | staging should follow local/disposable validation first |
| production backup | blocked | no | very high | human approval plus privacy / DSGVO approval | out of scope for this design |
| manual SQL snippets | blocked in this task | no | medium to high | separate SQL-focused approval | not part of this design |
| query runner output | blocked | no | high | separate approval, still discouraged | forbidden in this design |
| reports with data | blocked | no | high | separate approval, still discouraged | forbidden in this design |

## 8. Drill Phases

### Phase 0: Design Review

- current task
- `DOKU_ONLY`
- no execution

### Phase 1: Environment Preparation Design

- define the target environment shape
- confirm disposal and isolation requirements
- no environment setup in this task

### Phase 2: Restore Input Selection

- prefer schema-only or synthetic inputs
- document the data class and origin before any later execution

### Phase 3: Restore Execution Plan

- belongs to a later separately approved task
- no commands are executed in this design

### Phase 4: Safe Validation

- use health, schema, and smoke-oriented signals only
- no customer data, query results, or data-bearing reports

### Phase 5: Cleanup / Disposal

- future target environment must be disposable
- no Production surface may be touched during cleanup

### Phase 6: Evidence / Review

- record only sanitized metadata and approval evidence
- no dumps, exports, or reports with data

## 9. Future Dry Run Command Envelope

This section defines only future command classes, not executable instructions for this task.

Potentially allowed future command classes in a separately approved dry run:

- local container start in a disposable environment
- restore into a disposable DB
- health checks against a local or separately approved isolated target

Forbidden command classes:

- Production `pg_dump`
- Production `pg_restore`
- Production `psql`
- Production `docker exec`
- Production DB reads
- Production `.env` access
- query runner usage
- cleanup, backfill, or enforcement actions
- external delivery execution

Clarifications:

- this document does not provide real connection strings
- this document does not approve any Production command
- this document does not execute any restore path

## 10. Validation Signals

Safe validation signals for any later non-production dry run:

- application starts in an isolated environment
- API health is green on the local or separately approved target
- expected schema is present where verifiable without customer data
- migration status matches the expected local/non-production baseline
- no unexpected Production migration is involved
- no secret leakage appears in logs or outputs
- no delivery side effects occur
- no external webhook or email execution occurs
- no reports with data are generated
- no query results are generated
- synthetic widget or config smoke is used only if fully isolated
- logs remain sanitized

## 11. Stop Criteria

Any later drill must stop immediately if any of the following becomes true:

- Production credential is required
- Production backup content is required
- customer data is required
- PII status is unclear
- restore target is not isolated
- an external integration would become active
- delivery execution is possible
- `DB_READ_ONLY_AUDIT` would be required but is not approved
- SQL, `pg_dump`, `pg_restore`, or `psql` against Production would be required
- query results or reports with data would be produced
- secrets would appear in output
- owner or approval path is unclear

## 12. Approval Requirements

Relevant SRE-2C access classes and approvals:

- `repo_read_access`: sufficient for this documentation task
- `restore_execution_access`: required separately for any later dry run
- `backup_content_access`: remains blocked without explicit approval
- `production_db_access`: remains blocked without explicit human approval
- `secret_recovery_access`: remains blocked without a separate security task
- `privacy_owner_approval`: required if any future scope could involve PII or real data
- `human_operator_approval`: required if any future scope could involve Production data or Production-adjacent access

Current approval state:

- restore execution: not granted
- backup content inspection: not granted
- Production DB access: not granted
- secret recovery: not granted
- PII-bearing restore scope: not granted

## 13. Evidence Requirements for Future SRE-2E

Any future real dry-run task should not proceed without an evidence package containing:

- task ID
- target environment
- data class
- data source
- proof of non-production data status
- owner roles
- allowed commands
- forbidden commands
- stop criteria
- expected validation signals
- cleanup or disposal plan
- sanitized logs only
- explicit confirmation that no reports with data are produced
- explicit confirmation that no secrets are present

## 14. Relationship to Existing SRE Docs

- `SRE-2A`: backup restore drill plan
- `SRE-2B`: backup inventory audit
- `SRE-2C`: backup responsibility / access model
- `SRE-2D`: non-production restore drill design
- `SRE-2E`: local or staging restore dry run, only after explicit approval
- `SRE-2F`: Production backup verification decision gate
- `DSGVO-1A`: PII data map as required parallel or follow-up work

This document depends on the planning and governance baseline from `SRE-2A` through `SRE-2C` and narrows the first execution-capable restore follow-up toward a non-production-only model.

## 15. Pilot Go/No-Go Impact

Pilot readiness is improved because:

- a non-production restore design now exists
- allowed and forbidden data classes are defined
- stop criteria are defined
- access and approval boundaries are defined

Pilot readiness remains blocked or yellow while any of the following remain true:

- no real restore drill has been successfully validated
- `backup_owner` and `restore_owner` are still not confirmed
- DB `RPO` and `RTO` remain not validated
- the PII / DSGVO restore strategy remains open
- secret-recovery ownership remains open
- Production backup verification remains blocked or unvalidated

## 16. Required Follow-ups

Recommended follow-ups:

- `SRE-2E Local/Staging Restore Dry Run`
- `DSGVO-1A PII Data Map`
- `SRE-2F Production Backup Verification Decision Gate`
- `ENT-SEC-1A Enterprise Security Gap Audit`

Recommended immediate next step:

- `SRE-2E Local/Staging Restore Dry Run Decision Gate`

Constraint for that next step:

- it may only start with explicit approval
- it may not use Production data by default

## 17. Stop Boundaries

Explicit boundaries of this design:

- this design executes no backup
- this design executes no restore
- this design reads no DB
- this design executes no SQL
- this design runs no `pg_dump`, `pg_restore`, or `psql`
- this design uses no Production data
- this design uses no Production secrets
- this design creates no dump, export, or report artifact
- this design changes no Production config
- this design performs no deploy
- this design changes no Public Widget response
- this design mutates no customer site

## 18. Non-goals

- no implementation
- no backup
- no restore
- no DB access
- no SQL
- no deploy
- no runtime change
- no customer data handling
- no secrets handling
- no Production verification
