# SRE Local/Staging Restore Dry Run Decision Gate

Stand: 2026-07-21

## 1. Summary

This document defines a documentation-only decision gate for a later local or staging restore dry run for Enterprise Pilot readiness.

Purpose:

- decide whether a later restore dry run may be prepared at all
- define which future execution shapes remain blocked
- document the current approval status, preconditions, and stop boundaries
- constrain any future execution candidate to non-production, non-customer, and non-secret-bearing scope

This step is intentionally `DOKU_ONLY`.

This gate does not:

- execute any backup
- execute any restore
- read any database
- execute SQL
- run `pg_dump`, `pg_restore`, or `psql`
- run `docker exec` or `docker compose`
- use Production data
- use Production secrets
- perform a deploy
- change Production config
- change runtime code
- create dumps, exports, query results, or reports with data

## 2. Decision

Current decision:

```text
Restore dry run execution approved: no
Local synthetic/schema-only future dry run preparation: conditionally allowed as design-only follow-up
Staging restore dry run approved: no
Production backup data approved: no
Production secrets approved: no
DB_READ_ONLY_AUDIT approved: no
```

Reasoning:

- no explicit human approval for restore execution exists
- `restore_execution_access` remains separately approval-bound according to `SRE-2C`
- Production data is not approved
- Production secrets are not approved
- the PII / DSGVO strategy remains open
- `backup_owner`, `restore_owner`, and `secret_recovery_owner` remain unconfirmed
- DB `RPO` and `RTO` remain not validated

Result:

- a later local synthetic or schema-only execution candidate can be described as a future approval-bound scope
- no later execution may start from this document alone
- staging, Production-adjacent, PII-bearing, or secret-bearing variants remain blocked

## 3. Current Preconditions Review

| Precondition | Required | Current Status | Decision Impact |
| --- | --- | --- | --- |
| `SRE-2A` exists | yes | yes | baseline planning exists |
| `SRE-2B` exists | yes | yes | inventory baseline exists |
| `SRE-2C` exists | yes | yes | access and approval model exists |
| `SRE-2D` exists | yes | yes | non-production restore design exists |
| `restore_owner` confirmed | yes for execution | no | execution remains blocked |
| `backup_owner` confirmed | yes for execution | no | execution remains blocked |
| `privacy_owner` confirmed | yes for real-data scope | no | any real-data scope remains blocked |
| `security_owner` confirmed | yes for secret-bearing scope | no | any secret-bearing scope remains blocked |
| `access_approver` confirmed | yes for execution | no | execution remains blocked |
| data class approved | yes | partially | only synthetic/schema-only/fixture is plausibly safe by default |
| target environment approved | yes | partially | local/disposable concept is plausible; staging is not approved |
| Production data excluded | yes | yes | Production-bearing variants remain blocked |
| Production secrets excluded | yes | yes | Production-bearing variants remain blocked |
| PII strategy approved | yes for real-data scope | no | real-data scope remains blocked |
| allowed command envelope approved | yes | no | future execution remains blocked |
| cleanup / disposal plan approved | yes | no | future execution remains blocked |
| evidence template approved | yes | no | future execution remains blocked |

Interpretation:

- the planning stack from `SRE-2A` through `SRE-2D` exists
- the missing elements are not design artifacts but execution approvals, owner confirmations, and data-governance approvals
- future execution therefore remains blocked by governance, not by missing conceptual structure

## 4. Data Class Decision

| Data Class | Decision | Reason |
| --- | --- | --- |
| synthetic dummy data | allowed for future design / preferred | safest non-sensitive default |
| schema-only baseline | allowed for future design / preferred | validates restore shape without customer content |
| generated fixture data | allowed for future design / preferred | deterministic and non-sensitive when controlled |
| sanitized non-production data | conditional, requires documented source | provenance and sanitization must be explicit |
| staging data | blocked pending explicit approval | not safe by default and not yet approved |
| production backup data | blocked | no Production data approval exists |
| customer / tenant data | blocked | PII / DSGVO strategy remains open |
| conversation / session data | blocked | high confidentiality and PII risk |
| `email_jobs` | blocked | side-effect-bearing data class, no approval |
| `webhook_jobs` | blocked | side-effect-bearing data class, no approval |
| `report_runs` | blocked | may create data-bearing outputs, no approval |
| secrets / credentials | blocked | no secret-bearing scope is allowed |

Default decision:

- synthetic, schema-only, and fixture-based inputs are the only plausible safe default for any future execution proposal
- staging, Production-derived, and customer-bearing inputs remain blocked

## 5. Target Environment Decision

| Environment | Decision | Reason |
| --- | --- | --- |
| local isolated environment | conditionally acceptable for future execution gate | can be disposable and non-production if explicitly scoped |
| disposable non-production environment | conditionally acceptable for future execution gate | can isolate the drill from Production surfaces |
| staging | blocked until explicit approval | staging is not approved by this gate |
| production | blocked | Production restore or Production-adjacent execution is out of scope |
| customer site | blocked | customer mutation is forbidden |
| public widget customer domain | blocked | no customer-facing surface may be used for restore execution |

Constraints:

- this document does not claim that any of these environments already exists or is configured
- this document only classifies which environment classes may later be proposed

## 6. Command Envelope Decision

Allowed only in a future explicitly approved execution task:

- local disposable environment setup
- schema-only restore into a disposable DB
- synthetic fixture load
- local health check against a disposable target
- cleanup of a disposable environment

Still forbidden:

- Production `pg_dump`
- Production `pg_restore`
- Production `psql`
- Production `docker exec`
- Production `docker compose`
- Production DB reads
- Production `.env` access
- backup-content access
- query runner usage
- query results
- reports with data
- cleanup, backfill, or enforcement actions
- external delivery execution
- SMTP or email execution
- webhook delivery execution
- customer-site mutation

Clarifications:

- none of the future-allowed command classes are executed in this task
- no concrete Production commands are provided here
- no real connection strings are provided here
- no secrets are provided here

## 7. Approval Status Matrix

| Approval Area | Status | Required Before Execution |
| --- | --- | --- |
| `restore_execution_access` | not_granted | explicit human approval |
| `backup_content_access` | not_granted | explicit human approval plus scope review |
| `production_db_access` | not_granted | explicit human approval |
| `secret_recovery_access` | not_granted | separate security task and approval |
| `privacy_owner_approval` | not_granted | any real-data or PII-bearing scope |
| `security_owner_approval` | not_granted | any secret-bearing or privileged scope |
| `human_operator_approval` | not_granted | any real execution task |
| `staging_environment_approval` | not_granted | any staging execution candidate |
| `synthetic_data_approval` | blocked_pending_future_task | explicit execution scope confirmation |
| `cleanup_disposal_approval` | not_granted | execution-safe disposal plan |

Interpretation:

- every execution-relevant approval area remains either `not_granted` or still blocked pending a future task
- this document does not itself grant any of them

## 8. Future `SRE-2E-EXEC` Minimum Scope

Possible future execution-task name:

- `SRE-2E-EXEC Local Synthetic Restore Dry Run`

Maximum safe scope for such a future task:

- local or disposable environment only
- synthetic, schema-only, or fixture data only
- no Production data
- no Production secrets
- no staging data unless separately approved
- no external delivery
- no email or SMTP
- no webhooks
- no query runner
- no reports with data
- no `DB_READ_ONLY_AUDIT`
- no Production DB
- no Production backup content

This future scope remains blocked until explicitly approved.

## 9. Required Explicit Approval Format

Required example wording for any later execution request:

```text
Ich gebe SRE-2E-EXEC Local Synthetic Restore Dry Run frei,
ausschließlich in einer lokalen/disposable Non-production-Umgebung,
ausschließlich mit synthetic/schema-only/fixture Daten,
ohne Production-Daten,
ohne Production-Secrets,
ohne Staging-Daten,
ohne DB_READ_ONLY_AUDIT,
ohne Production-DB-Zugriff,
ohne pg_dump/pg_restore/psql gegen Production,
ohne Query Runner,
ohne Reports mit Daten,
ohne email_jobs/webhook_jobs/report_runs Reads/Writes,
ohne Cleanup/Backfill/Enforcement,
ohne Deploy,
ohne externe Delivery-/SMTP-/Webhook-Ausführung.
```

Important:

- this is an approval example only
- this document does not claim that such approval was actually given
- human approval status remains `not_granted`

## 10. Stop Criteria For Future Execution

Any future execution task must stop immediately if any of the following becomes true:

- wrong environment
- Production credential required
- Production data required
- staging data required without approval
- customer data required
- PII status unclear
- owner not assigned
- `DB_READ_ONLY_AUDIT` required
- SQL against Production required
- `pg_dump`, `pg_restore`, or `psql` against Production required
- `docker exec` or `docker compose` against Production required
- query results or reports with data would be produced
- secrets would appear in output
- external delivery would become possible
- cleanup, backfill, or enforcement would be required

## 11. Evidence Requirements For Future Execution

Any future execution candidate must define:

- task ID
- explicit approval text
- target environment
- data class
- proof of non-production data
- owner roles
- allowed command classes
- forbidden command classes
- expected validation signals
- cleanup or disposal plan
- log sanitization plan
- explicit confirmation that no reports with data are produced
- explicit confirmation that no secrets are included
- rollback or abort criteria

## 12. Relationship To Existing SRE Docs

- `SRE-2A` = plan
- `SRE-2B` = inventory
- `SRE-2C` = responsibility / access
- `SRE-2D` = design
- `SRE-2E` = decision gate
- `SRE-2E-EXEC` = separate future execution task only after explicit approval
- `SRE-2F` = Production backup verification decision gate
- `DSGVO-1A` remains necessary before any real PII-bearing restore

## 13. Pilot Go/No-Go Impact

This gate improves governance because:

- the next execution decision is now separated from restore design itself
- the blocked approvals and missing owner confirmations are made explicit
- the future allowed scope is narrowed to synthetic, schema-only, and fixture-driven non-production candidates

Pilot readiness remains yellow or blocked because:

- no real restore dry run has been executed
- owner confirmations remain missing
- the PII / DSGVO strategy remains open
- secret-recovery readiness remains open
- DB `RPO` and `RTO` remain not validated
- Production backup verification remains blocked or unvalidated

This gate alone does not produce pilot go.

## 14. Recommended Next Step

If actual execution is desired:

- `SRE-2E-EXEC Local Synthetic Restore Dry Run`, but only with explicit approval

If execution is not desired yet:

- `DSGVO-1A PII Data Map`

Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

## 15. Stop Boundaries

Explicitly:

- this gate executes no backup
- this gate executes no restore
- this gate reads no DB
- this gate executes no SQL
- this gate runs no `pg_dump`, `pg_restore`, or `psql`
- this gate runs no `docker exec` or `docker compose`
- this gate uses no Production data
- this gate uses no Production secrets
- this gate creates no dump, export, or report artifact
- this gate changes no Production config
- this gate performs no deploy
- this gate changes no Public Widget response
- this gate mutates no customer site

## 16. Non-goals

- no execution
- no backup
- no restore
- no DB access
- no SQL
- no deploy
- no runtime change
- no customer data handling
- no secrets handling
- no Production verification
