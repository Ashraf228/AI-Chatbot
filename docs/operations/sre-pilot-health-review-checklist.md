# SRE Pilot Health Review Checklist

## Summary

This document defines a documentation-only pilot health review checklist for Enterprise Pilot readiness.
Its purpose is to standardize daily, deploy-time, incident-triggered, and weekly review routines so pilot operations can determine whether the platform remains safe to continue, pause, or block.

This step is intentionally `DOKU_ONLY`.

This document does not:

- execute production health checks
- create or configure external monitors
- create or configure alerts
- change production config
- change runtime code
- perform a deploy
- query any database
- execute SQL
- include secrets
- include customer data

## Current Pilot Health Baseline

The current pilot baseline is documented as follows:

- `scripts/ops/check-production-health.sh` exists as the central manual and deploy-adjacent health gate.
- API, dashboard, and widget health signals are documented.
- Safe Public Widget Smoke is established as a safe production-adjacent signal.
- remote Docker fallback is implemented and dry-run validated as a build-only gate, not a deploy
- the security diff scan process is documented
- the monitoring and alerting audit exists
- the alert routing design exists
- the incident response runbook exists
- the external uptime monitor design exists
- external uptime monitors are not yet technically configured
- alert delivery is not yet technically configured
- `DB_READ_ONLY_AUDIT` remains blocked without explicit human approval

## Review Types

| Review Type | Purpose | Trigger | Owner Role | Expected Artifacts | Go/No-Go Impact |
| --- | --- | --- | --- | --- | --- |
| Daily Pilot Health Review | Verify that the current pilot baseline is still safe for continued operation | once per pilot day | `<pilot_ops_owner>` | daily review record, current blockers, next review due | can pause or block pilot continuation |
| Deploy-Time Preflight Review | Confirm deploy readiness before any approved production change | before every production deploy decision | `<deploy_owner>` with `<pilot_ops_owner>` | target commit, gate evidence, rollback point, risk summary | can block deploy and pilot exposure |
| Deploy-Time Post-Deploy Review | Confirm that the deployed state is healthy and rollback is not required | immediately after every production deploy | `<deploy_owner>` with `<primary_on_call>` | post-deploy validation summary, rollback decision, incident decision | can trigger rollback or incident |
| Incident-triggered Review | Triage and govern a potential or active incident | any qualifying failure signal or operator escalation | `<incident_commander>` or `<primary_on_call>` | incident log, severity, owner assignment, recovery validation plan | can immediately block pilot operations |
| Weekly Pilot Readiness Review | Evaluate cumulative readiness and unresolved operational risk | once per pilot week | `<pilot_ops_owner>` | weekly readiness summary, open risks, follow-ups, pilot go/no-go state | can block new pilot outreach or expansion |

## Daily Pilot Health Review Checklist

Only safe health, CI, smoke, and review signals may be used.
No DB reads, SQL, query runner, data reports, or customer data are allowed in this review.

| Check | Source | Expected Result | Owner Role | Failure Severity | Incident Trigger | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Production Health status | latest approved production health evidence or safe manual summary | green / pass | `<pilot_ops_owner>` | `SEV1` if red | yes if red or inconsistent | documentation-only review of known safe signal |
| API health | approved API health signal | green / healthy | `<primary_on_call>` | `SEV1` | yes if unavailable or unhealthy | no direct API call is performed by this checklist |
| Dashboard health | approved dashboard health signal | green / healthy | `<primary_on_call>` | `SEV1` or `SEV2` | yes if unavailable during active pilot usage | severity depends on current pilot use |
| Widget version / loader / config | approved widget metadata and reachability signal | green / reachable | `<pilot_ops_owner>` | `SEV1` or `SEV2` | yes if config or loader breaks customer-facing widget | use safe metadata and config signals only |
| Production health synthetic | approved safe synthetic config signal | green / pass | `<pilot_ops_owner>` | `SEV1` or `SEV2` | yes if failed without explanation | safe config-level signal, not a customer-site action |
| Safe Public Widget Smoke status | safe smoke evidence, if scheduled for the day | green or intentionally not scheduled | `<pilot_ops_owner>` | `SEV1` or `SEV2` | yes if failed without explanation | no customer site execution |
| Production-context audit status | last approved security audit result | pass | `<security_owner>` | `SEV1` if high/critical finding open | yes if unresolved | gate signal, not runtime telemetry |
| Authorization Matrix status | latest matrix check result | pass | `<security_owner>` | `SEV1` if mismatch with production-relevant implication | yes if unresolved | policy and route protection baseline |
| Security Boundaries status | latest boundary test result | pass | `<security_owner>` | `SEV1` if failing | yes if unresolved | hard security baseline |
| Main-CI / recent deployment status | latest main CI or recent deploy gate evidence | pass / success | `<deploy_owner>` | `SEV2` | incident candidate if recent deploy state is unclear | use exact commit evidence when applicable |
| Docker fallback gate availability | documented availability, only if relevant | available or not needed | `<deploy_owner>` | `SEV3` | no by itself | build-only fallback, not deploy approval |
| Known warnings / audit exceptions | current approved warnings and exceptions | reviewed and unchanged | `<pilot_ops_owner>` | `SEV3` or `SEV2` | incident only if risk grows or scope changes | moderate-only exceptions may remain documented |
| Open `SEV0` / `SEV1` / `SEV2` incidents | incident review summary | no open `SEV0`; no unexplained `SEV1`; `SEV2` understood | `<incident_commander>` or `<pilot_ops_owner>` | by existing severity | yes | open critical incidents block pilot go |
| Pending rollback decisions | deploy / incident status | none unresolved | `<deploy_owner>` | `SEV1` if current runtime state is unclear | yes if unresolved after deploy | unresolved rollback state is a pilot blocker |
| Secret-like log signal | safe summarized log review output only | no unresolved secret-like hit | `<security_owner>` | `SEV0` or `SEV1` | yes | never include raw sensitive logs in the checklist |
| Queue / job warning summary | safe non-DB operational summary only | no unresolved pilot-impacting warning | `<engineering_owner>` | `SEV2` or `SEV3` | yes if customer impact or repeated failure pattern | no DB query or report output allowed |
| Public widget leak watch | safe smoke / response-shape / security review evidence | no leak signal open | `<security_owner>` | `SEV0` or `SEV1` | yes | block pilot immediately if leak suspected |
| Auth / RBAC / tenant isolation open issues | current security review and issue state | no unresolved pilot-blocking gap | `<security_owner>` | `SEV1` | yes | unresolved isolation gap is pilot no-go |

## Deploy-Time Preflight Review Checklist

This review applies before any separately approved production deploy.

| Check | Expected Result | No-Go Condition | Notes |
| --- | --- | --- | --- |
| Target commit known | exact commit SHA documented | target commit unknown | must match reviewed change scope |
| Main-CI or Docker fallback gate | green / success | no green gate evidence | Docker fallback is build-only and only if applicable |
| Diff scope confirmed | exact intended scope documented | unexpected files or unclear scope | use PR and merge evidence |
| Security diff scan, if required by change class | completed and acceptable | missing or blocking findings | for `DOKU_ONLY`, only if risk indicators exist |
| Production Health before deploy | green | red or unknown | use latest approved safe evidence |
| Rollback point documented | yes | rollback point missing | required for pilot safety |
| Migration safety checked | yes / not applicable | migration risk unclear | no implicit migration tolerance |
| Production DB target sanitized check | documented and sanitized | target unclear or drift suspected | no secrets, no direct DB read |
| Public widget risk reviewed | yes | response-shape or leak risk unclear | customer-facing surface |
| Feature flags status | unchanged or explicitly approved | unknown or unapproved flag change | pilot no-go if unclear |
| High / Critical security findings | none open | any open unresolved finding | hard blocker |
| Production config clarity | clear and approved | config unclear | hard blocker |

## Deploy-Time Post-Deploy Review Checklist

This review applies immediately after any separately approved production deploy.

| Check | Expected Result | Failure Meaning | Rollback / Incident Decision |
| --- | --- | --- | --- |
| API health | green | API runtime degraded or unavailable | incident candidate; rollback may be required |
| API commit correctness | expected commit visible | wrong or unknown runtime commit | block further pilot actions until clarified |
| Dashboard health | green | dashboard degraded or unavailable | severity depends on pilot usage |
| Dashboard commit unchanged if not deployed | unchanged | unexpected drift | investigate before pilot go |
| Widget health / version | green | widget asset or metadata issue | customer-facing risk |
| Widget commit unchanged if not deployed | unchanged | unexpected drift | investigate before pilot go |
| DB / Redis health | green | platform degradation | incident candidate |
| Migration count / latest migration unchanged if no migration expected | unchanged | unexpected schema movement | immediate blocker |
| Auto-migration skip confirmed if relevant | confirmed | unexpected migration path | immediate blocker |
| Public Widget Smoke | green | customer-facing regression possible | incident or rollback candidate |
| Logs without critical current errors | yes | active critical pattern detected | incident candidate |
| Secret leaks | none | secret-like signal unresolved | immediate blocker |
| Unexpected side effects | none | unexplained side effect present | incident candidate |
| Rollback needed | yes / no explicitly decided | unresolved | no unresolved rollback decisions allowed |
| Incident needed | yes / no explicitly decided | unresolved | must be classified immediately |

## Incident-triggered Review Checklist

This review defers to `SRE-1C` for process and severity governance.

Checklist:

1. Verify severity using the documented `SEV0` / `SEV1` / `SEV2` / `SEV3` model.
2. Activate `<incident_commander>` immediately for `SEV0` or `SEV1`.
3. Create an incident log entry.
4. Assign an owner and backup owner.
5. Use the rollback decision checklist when the incident is deploy- or runtime-adjacent.
6. Evaluate customer impact before any pilot communication.
7. Activate `<security_owner>` and `<privacy_owner>` if secrets, auth, data exposure, or PII are involved.
8. Define recovery validation before closing the incident.
9. Record follow-up tasks and pilot go/no-go impact.

## Weekly Pilot Readiness Review

The weekly review is broader than the daily health review and decides whether the pilot remains ready for continuation or expansion.

| Review Area | Expected Weekly State | Blocking Condition |
| --- | --- | --- |
| Open `SEV0` / `SEV1` incidents | none | any open `SEV0` or unresolved `SEV1` |
| Open `SEV2` with pilot impact | reviewed and owned | no owner or unresolved customer impact |
| Recurring `SEV3` warnings | reviewed for trend | repeated warnings ignored without plan |
| External monitoring planning | current status known | status unknown or stalled without decision |
| Alert routing design | documented and current | missing or outdated |
| Incident runbook | documented and current | missing or outdated |
| Backup / restore drill | status known | no known plan or no follow-up owner |
| Security gap audit | status known | critical gap ignored |
| DSGVO / PII map | status known | no plan where pilot requires it |
| Pilot go / no-go | explicitly updated | no weekly decision |

## Health Review Output Template

Use a metadata-only output shape.
No real customer data, secrets, raw logs, query results, or report payloads may be included.

```text
review_id:
timestamp:
review_type:
owner_role:
checked_surfaces:
health_status:
security_status:
widget_smoke_status:
monitoring_status:
incident_status:
rollback_status:
pilot_go_no_go:
blockers:
follow_ups:
next_review_due:
```

## Pilot Go/No-Go Rules

Pilot Go only when:

- Production Health is green
- Public Widget Smoke is green, or clearly not scheduled for this review
- no open `SEV0`
- no unresolved `SEV1`
- no high or critical security findings
- no secret leaks
- no public widget leaks
- no unclear production config
- rollback path for the latest runtime change is documented
- the incident response runbook exists
- the alert routing design exists
- the external uptime monitor design exists
- the PII / DSGVO baseline is at least planned or in progress if still incomplete

Pilot No-Go when:

- health is red
- safe smoke is red and unexplained
- secret-like log hit is unresolved
- auth / RBAC / tenant-isolation gap remains open
- a public widget leak is suspected or confirmed
- DB / SQL / report approval state is unclear
- no incident owner is assigned where needed
- no rollback path exists for the current runtime version
- production config is unclear

## Safe Signal Rules

Only safe health, smoke, CI, and summarized log signals may be used.

Explicitly not allowed in this checklist:

- DB reads
- SQL
- query runner usage
- query results
- reports with data
- customer site mutation
- delivery or integration execution
- secrets in output
- customer data in review notes

## Relationship To Existing Gates

- `SRE-1A` = monitoring and alerting audit
- `SRE-1B` = alert routing design
- `SRE-1C` = incident response runbook
- `SRE-1D` = external uptime monitor design
- `SRE-1E` = pilot health review checklist
- Docker fallback gate is a build gate, not a deploy
- security diff scan is a review gate, not a substitute for tests
- deploy gates remain separate from this checklist
- `DB_READ_ONLY_AUDIT` remains blocked without human approval

## Implementation Roadmap

### Phase 1

- `SRE-1F Minimal External Monitor Setup Plan`
- `SRE-1G Minimal Alert Integration Plan`

### Phase 2

- `SRE-2A Backup Restore Drill Plan`
- `ENT-SEC-1A Enterprise Security Gap Audit`

### Phase 3

- `DSGVO-1A PII Data Map`
- `PILOT-1A Enterprise Pilot Go-live Checklist`

## Stop Boundaries

This checklist:

- does not execute health checks
- does not configure external monitors
- does not configure alerts
- does not change production config
- does not create external accounts
- does not store secrets
- does not deploy anything
- does not read any DB
- does not execute SQL
- does not generate reports with data
- does not change public widget responses
- does not mutate any customer site

## Recommended Next Step

Recommended next step:

- `SRE-1F Minimal External Monitor Setup Plan`

Alternative:

- `SRE-2A Backup Restore Drill Plan`

## Non-goals

- no implementation
- no external monitoring accounts
- no secret creation
- no deploy
- no DB access
- no SQL
- no runtime changes
- no customer data
