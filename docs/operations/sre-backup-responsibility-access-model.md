# SRE Backup Responsibility and Access Model

Stand: 2026-07-21

## 1. Summary

This document defines a documentation-only backup responsibility and access model for Enterprise Pilot readiness.

Purpose:

- define placeholder roles for backup, restore, security, privacy, incident, and approval responsibilities
- classify which backup- and restore-adjacent access types may later be needed
- document which actions remain blocked without explicit approval
- capture current unknowns, guardrails, and follow-up tasks before any later operational work

This step is intentionally `DOKU_ONLY`.

This model does not:

- configure any access
- create any account
- read or document any secret value
- execute any backup
- execute any restore
- read any database
- execute SQL
- run `pg_dump`, `pg_restore`, or `psql`
- change runtime code
- change Production config
- perform a deploy

## 2. Current Responsibility Baseline

Current repo-visible baseline:

- `SRE-2A Backup Restore Drill Plan` exists in `docs/operations/sre-backup-restore-drill-plan.md`
- `SRE-2B Backup Inventory Audit` exists in `docs/operations/sre-backup-inventory-audit.md`
- repo-evident backup, restore, freshness, offsite, and timer artifacts are documented
- live activation of backup and offsite automation is not proven
- `backup_owner` is not confirmed
- `restore_owner` is not confirmed
- `secret_recovery_owner` is not confirmed
- DB `RPO` and `RTO` remain not validated
- the PII / DSGVO restore strategy remains open
- `DB_READ_ONLY_AUDIT` remains blocked without explicit human approval
- Production backup verification remains blocked without explicit human approval

Interpretation:

- the repository shows that backup and restore building blocks exist
- the current gap is governance, ownership, access approval, and safe escalation design
- this document defines those governance boundaries without granting any real access

## 3. Role Model

All roles in this document are placeholders only.
No real people, emails, phone numbers, channels, or account identifiers are documented here.

### `backup_owner`

- Purpose: own the backup policy, expected schedule, and evidence review path
- Responsibilities:
  - define expected backup cadence and success criteria
  - confirm where backup metadata is reviewed
  - ensure backup unknowns and follow-ups are tracked
- Decision authority:
  - may approve documentation-only backup governance updates
  - may request later metadata-only validation tasks
- Allowed:
  - review docs, repo-visible scripts, and sanitized metadata plans
- Not allowed:
  - does not implicitly approve backup-content inspection, DB access, or restore execution
- Human approval needed when:
  - any task moves from governance into live metadata, backup content, or Production access

### `restore_owner`

- Purpose: own restore-drill planning and restore-readiness decision inputs
- Responsibilities:
  - define restore validation expectations
  - maintain restore drill prerequisites and stop criteria
  - ensure rollback from any later drill is preplanned
- Decision authority:
  - may approve documentation-only restore design work
- Allowed:
  - define isolated target-environment requirements and validation concepts
- Not allowed:
  - does not implicitly approve restore execution or Production data handling
- Human approval needed when:
  - any restore command, backup content, or Production-adjacent data is involved

### `platform_owner`

- Purpose: own the host/platform boundary for backup automation, timers, and runtime dependencies
- Responsibilities:
  - track platform prerequisites for backup scheduling
  - document host/service assumptions and gaps
  - coordinate with `deploy_owner` and `backup_owner`
- Decision authority:
  - may approve platform-readiness documentation
- Allowed:
  - review repo-visible systemd and compose artifacts read-only
- Not allowed:
  - no implicit approval for host access, service enablement, or config mutation
- Human approval needed when:
  - host-level validation or configuration changes are proposed

### `database_owner`

- Purpose: own database-recovery scope, safety boundaries, and later DB-specific approvals
- Responsibilities:
  - classify DB recovery criticality and dataset sensitivity
  - validate whether later DB tasks fit the approved scope
  - coordinate with `privacy_owner` and `security_owner`
- Decision authority:
  - may review DB recovery design documents
- Allowed:
  - approve documentation-only DB recovery concepts
- Not allowed:
  - no implicit approval for DB reads, SQL, query runners, or backup-content inspection
- Human approval needed when:
  - any DB metadata, DB content, SQL, or restore execution is requested

### `security_owner`

- Purpose: own secret handling, backup credential governance, and security approval boundaries
- Responsibilities:
  - define allowed and forbidden secret-handling paths
  - review secret-recovery assumptions and audit requirements
  - block unsafe documentation or unsafe later execution plans
- Decision authority:
  - required for security-sensitive metadata, secret-recovery planning, and exception review
- Allowed:
  - approve documentation-only security guardrails and secret-handling models
- Not allowed:
  - no implicit approval for exposing secret values or bypassing secure secret-management systems
- Human approval needed when:
  - any secret recovery, secret rotation, or privileged credential access is proposed

### `privacy_owner`

- Purpose: own PII / DSGVO boundaries for backup and restore decisions
- Responsibilities:
  - define whether a later task may involve PII-bearing data classes
  - approve or block any later Production-data restore concept
  - require sanitized outputs and no-data-report boundaries
- Decision authority:
  - required for any future restore involving real customer or tenant data
- Allowed:
  - review documentation-only PII guardrails and approval models
- Not allowed:
  - no implicit approval for Production-data restore or PII-bearing reports
- Human approval needed when:
  - any later task could expose PII, tenant data, session data, `email_jobs`, or `webhook_jobs`

### `incident_commander`

- Purpose: coordinate incident-time decision flow during `SEV0` / `SEV1`
- Responsibilities:
  - coordinate severity, ownership, and recovery decisions
  - ensure incident logs and communication flow exist
  - confirm that restore or rollback paths are explicitly decided
- Decision authority:
  - may coordinate incident response
- Allowed:
  - trigger incident-time governance and owner assignment
- Not allowed:
  - does not automatically override DB, PII, or secret approvals
- Human approval needed when:
  - an incident response would require restore execution, backup content access, or Production DB access

### `deploy_owner`

- Purpose: own runtime rollback and deploy-adjacent recovery decisions
- Responsibilities:
  - maintain exact rollback points and deploy evidence
  - coordinate with `incident_commander` during runtime incidents
  - separate runtime rollback from DB restore decisions
- Decision authority:
  - may approve deploy-time documentation-only checks and rollback-readiness reviews
- Allowed:
  - review commit/image/rollback metadata
- Not allowed:
  - no implicit approval for backup or restore execution
- Human approval needed when:
  - deploy recovery intersects with DB/PII/secret recovery

### `customer_success_owner`

- Purpose: represent pilot customer impact and readiness concerns
- Responsibilities:
  - surface customer-facing risk from missing backup or restore readiness
  - coordinate with `communications_owner` on safe customer impact framing
- Decision authority:
  - may contribute pilot go/no-go input
- Allowed:
  - consume sanitized risk summaries
- Not allowed:
  - no access to secrets, DB content, or raw incident data
- Human approval needed when:
  - any customer-data-bearing artifact would otherwise be shown

### `communications_owner`

- Purpose: own external and pilot-customer communication for incidents and recovery posture
- Responsibilities:
  - coordinate safe customer/status messaging
  - ensure no secrets, PII, or raw technical payloads leave controlled channels
- Decision authority:
  - required for customer-facing communication decisions
- Allowed:
  - use sanitized impact summaries only
- Not allowed:
  - no direct access to raw backup contents, DB outputs, or secret material
- Human approval needed when:
  - a later task would publish or transmit recovery-sensitive information

### `access_approver`

- Purpose: explicitly approve or reject later access requests
- Responsibilities:
  - verify that requested scope, environment, command list, and stop criteria are complete
  - confirm timebox, owner assignment, and rollback path
  - record that approval is explicit, scoped, and temporary
- Decision authority:
  - required before any later non-doc-only access activity
- Allowed:
  - approve or deny later access tasks
- Not allowed:
  - no standing blanket approval through this document
- Human approval needed when:
  - backup content, restore execution, Production DB access, or secret recovery is requested

### `audit_reviewer`

- Purpose: review evidence quality, scope correctness, and follow-up completeness
- Responsibilities:
  - verify that sanitized outputs meet policy
  - confirm that blocked areas stay blocked until separately approved
  - review audit exceptions and evidence gaps
- Decision authority:
  - may reject incomplete or overscoped evidence packages
- Allowed:
  - review docs, role definitions, and sanitized evidence templates
- Not allowed:
  - no implicit approval for privileged access
- Human approval needed when:
  - a later audit would move beyond metadata-only or docs-only scope

## 4. Responsibility Matrix

| Responsibility | Primary Role | Backup Role | Approval Required | Evidence Required | Pilot Criticality | Current Status |
| --- | --- | --- | --- | --- | --- | --- |
| Backup schedule ownership | `backup_owner` | `platform_owner` | `no_approval_needed` for docs only | documented cadence owner and review path | critical | unknown |
| Backup target ownership | `backup_owner` | `platform_owner` | `ops_owner_approval` for later metadata validation | storage class, target category, retention owner | critical | unknown |
| Offsite sync ownership | `backup_owner` | `platform_owner` | `ops_owner_approval` for later metadata validation | offsite path category, owner, and alert path | critical | unknown |
| Backup freshness review | `backup_owner` | `platform_owner` | `ops_owner_approval` for later metadata validation | review channel, threshold owner, escalation path | high | unknown |
| Restore test ownership | `restore_owner` | `database_owner` | `human_operator_approval` for later execution | isolated environment, validation model, stop criteria | critical | unknown |
| DB backup ownership | `database_owner` | `backup_owner` | `human_operator_approval` for later DB-sensitive work | data class scope, DB recovery category, approval scope | critical | unknown |
| Secret recovery ownership | `security_owner` | `platform_owner` | `security_owner_approval` | secure source of truth, rotation/recovery path | critical | unknown |
| PII / DSGVO restore ownership | `privacy_owner` | `database_owner` | `privacy_owner_approval` + `human_operator_approval` | approved data-class scope and sanitized output rules | critical | unknown |
| Incident restore decision | `incident_commander` | `restore_owner` | `incident_commander_approval` + required domain approvals | incident severity, rollback path, owner assignment | critical | unknown |
| Runtime rollback decision | `deploy_owner` | `incident_commander` | `incident_commander_approval` during incident, otherwise documented deploy approval path | exact rollback point and validation plan | high | partially documented |
| Customer communication | `communications_owner` | `customer_success_owner` | `no_approval_needed` for templates; explicit coordination for live communication | sanitized impact summary and next update | high | partially documented |
| Access review | `access_approver` | `security_owner` | `human_operator_approval` for privileged scopes | scope, environment, commands, forbidden commands, timebox | critical | not established |
| Audit exception / dependency risk review | `audit_reviewer` | `security_owner` | `security_owner_approval` when security-relevant | issue/risk record, exception record, follow-up owner | high | partially documented |

## 5. Access Classification Model

### A. `public_doc_access`

- may read public or generally shareable documentation and governance notes
- no secrets
- no Production data
- no DB outputs

### B. `repo_read_access`

- may read repository docs and repo-visible scripts in read-only form
- no script execution
- no host access
- no credential exposure

### C. `ops_metadata_access`

- may read sanitized operational metadata such as safe health summaries or safe gate outcomes
- no DB contents
- no customer data
- no secrets

### D. `backup_metadata_access`

- may later inspect whether backups exist, whether freshness is green, and whether status metadata is available
- does not include backup content
- does not include dumps
- does not include DB rows

### E. `backup_content_access`

- would allow access to backup contents or restorable payloads
- blocked for pilot unless separately approved
- PII / DSGVO review required
- not granted by this document

### F. `restore_execution_access`

- would allow running restore commands or restore workflows
- blocked without a separate restore task and explicit approval
- never granted by this document

### G. `production_db_access`

- would allow reading or validating the Production DB
- blocked without explicit human approval
- `DB_READ_ONLY_AUDIT` remains not approved

### H. `secret_recovery_access`

- would allow secret backup, rotation, or recovery actions
- only through approved secret-management processes
- never through repo documentation
- not granted by this document

## 6. Access Matrix

| Role | public_doc | repo_read | ops_metadata | backup_metadata | backup_content | restore_execution | production_db | secret_recovery | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `backup_owner` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | governance role only in this document |
| `restore_owner` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | defines restore plan, does not run it here |
| `platform_owner` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | requires separate approval | may document host assumptions only |
| `database_owner` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | DB-sensitive scopes remain blocked |
| `security_owner` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | requires separate approval | may approve security path, not expose secrets |
| `privacy_owner` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | required for PII-bearing future scopes |
| `incident_commander` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | coordinates, does not override data/security approvals |
| `deploy_owner` | allowed | allowed | allowed | not_needed_by_default | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | runtime rollback governance only |
| `customer_success_owner` | allowed | blocked | allowed | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | sanitized summaries only |
| `communications_owner` | allowed | blocked | allowed | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | no raw technical or sensitive outputs |
| `access_approver` | allowed | allowed | allowed | requires separate approval | requires separate approval | requires separate approval | requires separate approval | requires separate approval | explicit scoped approval role only |
| `audit_reviewer` | allowed | allowed | allowed | requires separate approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | blocked_without_explicit_approval | evidence review, no privileged access granted |

## 7. Approval Model

Approval classes used by this model:

- `no_approval_needed`: documentation-only and read-only repo analysis
- `ops_owner_approval`: non-invasive operational metadata review
- `security_owner_approval`: security-, auth-, or secret-adjacent scope
- `privacy_owner_approval`: PII / DSGVO-adjacent scope
- `human_operator_approval`: DB, Production, backup-content, or restore scope
- `incident_commander_approval`: incident or DR activation context
- `change_approval`: deploy, Production config, runtime change, or other mutating scope

Approval rules:

- documentation-only work uses `no_approval_needed`
- sanitized operational metadata later requires at least `ops_owner_approval`
- secret-recovery planning or secret-adjacent execution later requires `security_owner_approval`
- PII-bearing restore or Production-data handling later requires `privacy_owner_approval`
- Production DB access, backup-content access, and restore execution later require `human_operator_approval`
- incident context may add `incident_commander_approval`, but incident status alone does not waive security, privacy, or human-operator approval
- any runtime/config/deploy change would require `change_approval`

No approval is implicitly granted by documentation.

## 8. Backup / Restore Action Permission Table

| Action | Default Status | Required Approval | Allowed In Current Process | Notes |
| --- | --- | --- | --- | --- |
| read backup docs | allowed | `no_approval_needed` | yes | docs only |
| read backup scripts | allowed read-only | `no_approval_needed` | yes | no execution |
| run backup script | blocked | `human_operator_approval` + `change_approval` | no | never in this task |
| run freshness check | blocked | `ops_owner_approval` at minimum, possibly `human_operator_approval` depending on target | no | live execution not allowed here |
| inspect backup metadata | blocked_by_default | `ops_owner_approval` | no | must stay sanitized |
| inspect backup content | blocked_without_explicit_approval | `privacy_owner_approval` + `security_owner_approval` + `human_operator_approval` | no | pilot-sensitive |
| run restore test with dummy data | blocked_without_separate_task | `human_operator_approval` | no | belongs to later `SRE-2E` |
| run staging restore drill | blocked_without_separate_task | `privacy_owner_approval` if data-sensitive, plus `human_operator_approval` | no | later follow-up only |
| verify production backup | blocked_without_explicit_approval | `human_operator_approval` + applicable domain approvals | no | later `SRE-2F` |
| perform production restore | blocked_without_explicit_approval | `incident_commander_approval` + `human_operator_approval` + applicable security/privacy approvals | no | never in this task |
| read production DB | blocked_without_explicit_approval | `human_operator_approval` | no | `DB_READ_ONLY_AUDIT` remains blocked |
| run `pg_dump` | blocked | `human_operator_approval` + `change_approval` | no | forbidden here |
| run `pg_restore` | blocked | `human_operator_approval` + `change_approval` | no | forbidden here |
| run `psql` | blocked | `human_operator_approval` | no | forbidden here |
| rotate backup secrets | blocked_without_separate_security_task | `security_owner_approval` + `change_approval` | no | not in repo |
| restore secrets | blocked_without_separate_security_task | `security_owner_approval` + `human_operator_approval` | no | secret-management only |
| change retention policy | blocked_without_separate_change | `backup_owner` + `platform_owner` + `change_approval` | no | no policy mutation here |
| delete backup | blocked_without_explicit_approval | `human_operator_approval` + `change_approval` | no | destructive |
| cleanup / backfill / enforcement | blocked | `change_approval` + scope-specific approvals | no | outside this model |

## 9. Evidence Requirements

Any later approval package should define at least:

- task ID
- approver role
- requested scope
- target environment
- data class
- allowed commands
- forbidden commands
- rollback plan
- incident owner
- privacy/security review status
- expected output
- stop criteria
- expiration or timebox

No later access should proceed without a scoped evidence package.

## 10. Secret Handling Model

Secret-handling rules:

- no secrets in the repository
- no `.env` contents in docs, chat, PRs, or commits
- no connection strings
- no backup credentials
- no offsite credentials
- no provider tokens
- no host credentials
- secret recovery only through approved secret-management paths
- secret rotation requires a separate security task
- secret access logging is required if later technically implemented

This document does not identify any real secret store, real secret value, or real break-glass target.

## 11. PII / DSGVO Access Boundaries

PII / DSGVO guardrails:

- backups may contain PII
- restore with Production data requires explicit PII / DSGVO approval
- no customer data in chat, PRs, logs, or reports
- no query results
- no reports with data
- no export of tenant, conversation, `email_jobs`, `webhook_jobs`, or similar datasets
- `DSGVO-1A PII Data Map` remains a necessary follow-up before any PII-bearing restore path

## 12. Incident / DR Access Boundaries

This model aligns with `SRE-1C`:

- `SEV0` / `SEV1` may trigger restore-decision governance
- `incident_commander` coordinates but does not automatically waive DB, PII, or secret approvals
- `security_owner` and `privacy_owner` must be involved when secrets, auth, data exposure, or PII may be affected
- customer communication flows only through `communications_owner`
- restore execution remains a separate documented task

## 13. Pilot Minimum Responsibility Requirements

Pilot Go from a backup responsibility perspective requires:

- `backup_owner` named
- `restore_owner` named
- `security_owner` named
- `privacy_owner` named
- `access_approver` named
- backup metadata review pathway documented
- secret recovery pathway documented
- DB / PII access boundaries documented
- incident restore decision path documented
- no-go criteria accepted by the operator path

Pilot No-Go if any of the following remain true:

- no `backup_owner`
- no `restore_owner`
- no secret-recovery owner
- unclear DB or PII guardrails
- unclear restore approval path
- no `incident_commander`
- no `communications_owner`
- open high or critical security findings

## 14. Current Unknowns / Follow-up

Current unknowns:

- live backup activation owner unknown
- restore owner unknown
- backup schedule owner unknown
- offsite sync owner unknown
- backup metadata access path unknown
- secret recovery owner unknown
- PII restore approval path unknown
- production backup verification approval path unknown
- `RPO` / `RTO` ownership unknown

## 15. Required Follow-ups

Recommended follow-ups:

- `SRE-2D Non-production Restore Drill Design`
- `SRE-2E Local/Staging Restore Dry Run`
- `SRE-2F Production Backup Verification Decision Gate`
- `DSGVO-1A PII Data Map`
- `ENT-SEC-1A Enterprise Security Gap Audit`

Recommended immediate next step:

- `SRE-2D Non-production Restore Drill Design`

Alternative:

- `DSGVO-1A PII Data Map`

Reason:

- the inventory and the responsibility/access baseline are now documented, but the next missing safe design element is the non-production restore drill scope, validation model, and dummy-data policy

## 16. Stop Boundaries

This model explicitly does not:

- configure any access
- create any account
- read any secret
- execute any backup
- execute any restore
- read any database
- execute SQL
- run `pg_dump`, `pg_restore`, or `psql`
- generate dumps, exports, or reports
- change Production config
- deploy anything
- change the Public Widget response
- mutate any customer site

## 17. Non-goals

This model intentionally does not include:

- implementation
- access setup
- account creation
- backup execution
- restore execution
- DB access
- SQL
- deploy
- runtime changes
- customer data
- secrets
