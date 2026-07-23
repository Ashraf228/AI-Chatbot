# Enterprise Pilot Go/No-Go Decision

Stand: 2026-07-23

## Summary

This document is a documentation-only Enterprise Pilot go/no-go decision based on the completed `ENT-SEC-1A Enterprise Security Gap Audit`.

Purpose:

- convert the `ENT-SEC-1A` gap inventory into an explicit pilot decision
- separate internal preparation from customer-facing pilot exposure
- distinguish between unrestricted enterprise release, limited pilot allowance, and no-go areas
- document the P0 follow-ups that remain mandatory before active enterprise outreach or real-customer pilot expansion

This step is intentionally `DOKU_ONLY`.

This decision does not:

- read any database
- execute SQL
- use a query runner
- generate reports
- generate JSON, CSV, or ZIP export files
- execute DSAR, export, deletion, correction, retention, cleanup, backfill, or enforcement actions
- open backups, dumps, or exports
- read logs or run production health checks
- change runtime code, workflows, scripts, config, or feature flags
- perform any deploy or other production action
- document real customer data, secrets, or connection strings
- grant final DSGVO compliance approval
- grant unrestricted enterprise readiness

Decision basis:

- `ENT-SEC-1A` squash commit: `d8187214d38d1ac3cf11326bf1dc874a39f1ad2f`
- `origin/main` at decision time: `d8187214d38d1ac3cf11326bf1dc874a39f1ad2f`
- readiness classification inherited from `ENT-SEC-1A`: `yellow_ready_with_guardrails`

## Enterprise Pilot Focus

This decision is about whether the current repository and documented operating model justify:

- internal readiness work
- safe demo and sales preparation without customer data
- a limited pilot with a safe-test or internal tenant
- a real-customer enterprise pilot
- broad enterprise rollout

It is not a legal opinion, not a production deployment instruction, and not an approval for data-sensitive operational execution.

## Decision Summary

- `unrestricted_enterprise_go`: `no`
- `broad_enterprise_rollout`: `no`
- `limited_enterprise_pilot`: `conditional_with_guardrails`
- `internal_preparation`: `yes`
- `active_enterprise_outreach`: `blocked_until_p0_followups_or_explicit_acceptance`
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
- `deploy_required_by_this_decision`: `no`

Why this is the current decision:

- security baseline checks are documented green
- Main-CI / Docker / PostgreSQL isolation evidence is documented green
- no open High/Critical production-context finding is documented
- recent dependency drifts (`body-parser`, `sharp`, `next`) are documented as production-live resolved or mitigated
- SRE, backup/restore, and DSGVO planning baselines now exist
- but real external monitoring and alerting are not yet operationally proven
- backup ownership, restore ownership, and production backup verification remain incomplete
- processor / DPA inventory remains incomplete
- privacy owner, DSAR owner, and production config owner are not proven as finalized owner chains
- real DB, DSAR, export, deletion, retention, query-runner, and report paths remain intentionally blocked

## Decision Inputs

| Input Area | Evidence | Status | Decision Impact |
| --- | --- | --- | --- |
| `ENT-SEC-1A` Enterprise gap audit | `docs/security/enterprise-security-gap-audit.md` | `yellow_ready_with_guardrails` | baseline allows guarded pilot framing, not unrestricted release |
| Production security audit | `npm run security:audit:production-contexts` expected PASS baseline | green | no current High/Critical blocker documented |
| Main-CI / Docker / PostgreSQL isolation | `ci.yml`, `scripts/ops/codex-main-ci-gate.sh`, documented exact-SHA gates | green | supports disciplined change safety, not customer-ops maturity by itself |
| Authorization Matrix | `npm run security:check-authorization-matrix` expected PASS baseline | green | supports guarded pilot, not full enterprise sign-off alone |
| Security Boundary Tests | `npm run test:security-boundaries` expected PASS baseline | green | confirms hard security baseline remains in place |
| Dependency drift closure | drift status docs and risk register | green | prior dependency blockers are not the current no-go reason |
| SRE monitoring and alerting docs | `SRE-1A` through `SRE-1F` docs | `yellow_ready_with_guardrails` | planning exists, live monitor/alert ownership still open |
| Incident response runbook | `docs/operations/sre-incident-response-runbook.md` | documented | severity and role model exist, named owner chain still needs operationalization |
| Backup / restore governance | `SRE-2A` through `SRE-2E` docs | `yellow_ready_with_guardrails` | governance exists, live verification and ownership remain incomplete |
| DSGVO governance | `DSGVO-1A` through `DSGVO-1G` docs | `yellow_ready_with_guardrails` | design baseline exists, live execution approval remains blocked |
| Public widget boundary | safe smoke and response-shape baseline documented | `yellow_ready_with_guardrails` | customer-facing surface may stay in pilot only under guardrails |
| Rollback / deploy hygiene | deploy status docs and post-merge gate discipline | `yellow_ready_with_guardrails` | supports safe rollback practice for approved deploys |
| Known moderate-only exception | `postcss` remains non-blocking | low to medium | does not block this pilot decision |
| `DB_READ_ONLY_AUDIT` status | email-job and DSGVO/SRE decision docs | `not_granted` | blocks production-data audit or subject-oriented discovery work |
| Processor / DPA readiness | DSGVO PII and processing-gap docs | `unknown_requires_follow_up` | blocks unrestricted enterprise claim and real-customer expansion confidence |

## Go/No-Go Criteria Matrix

| Criterion | Required For | Current Status | Decision | Follow-up |
| --- | --- | --- | --- | --- |
| No High/Critical Findings | internal readiness work and limited pilot with guardrails | met | supports internal readiness and limited pilot with guardrails | keep `production-context audit` green before pilot-impacting changes |
| Main-CI / PR-CI green | internal readiness work and limited pilot with guardrails | met | supports internal readiness and limited pilot with guardrails | maintain required gates for every PR and `main` change |
| Production security audit green | conditional pilot readiness | met | supports conditional pilot readiness | continue `production-context audit` before merges and deploy decisions |
| Authorization Matrix green | conditional pilot readiness | met | supports conditional pilot readiness | maintain and expand when roles or scopes change |
| Security Boundary Tests green | conditional pilot readiness | met | supports conditional pilot readiness | keep security-boundary tests mandatory for relevant changes |
| Dependency Drift fixed | conditional pilot readiness | met for known `body-parser`, `sharp`, and Next.js production blockers | supports conditional pilot readiness | keep drift process active; `postcss` remains moderate and non-blocking |
| Incident Response documented | limited pilot readiness with guardrails | documented | supports readiness but does not replace real owner or on-call assignment | name incident owner and on-call path before active outreach |
| No open High/Critical security baseline finding | any pilot | satisfied in documented baseline | go | keep mandatory rechecks |
| Main-CI / Docker / PostgreSQL isolation gate discipline | any production-affecting change | satisfied | go | keep exact-SHA gate process |
| Dashboard / API / Widget baseline known | any limited pilot | documented from deploy, health, and dependency-drift baselines | supports conditional pilot | keep validating before relevant deploys |
| Monitoring / Alerting operational | active enterprise outreach and real-customer pilot | documented baseline exists, not fully operationally proven | blocks broad rollout; P0 before active outreach | `SRE-1G` |
| External Uptime Monitoring operational | active enterprise outreach and real-customer pilot | not operational; setup decision still pending | P0 gap | `SRE-1G` |
| Real external monitoring operational | active enterprise outreach and real-customer pilot | not proven | no-go for unrestricted rollout | `SRE-1G` |
| Real alert routing and owner path operational | active enterprise outreach and real-customer pilot | documented, not proven live | guarded only | `SRE-1G` |
| Incident owner / on-call contact model operationalized | active enterprise outreach and real-customer pilot | role model exists, live owner chain not proven | guarded only | owner assignment follow-up |
| Backup Owner defined | real-customer pilot and recoverability accountability | not confirmed; role placeholder only | blocks real-customer pilot unless explicitly accepted | name owner |
| Restore Owner defined | real-customer pilot and restore accountability | not confirmed; role placeholder only | blocks real-customer pilot unless explicitly accepted | name owner |
| Backup owner named | real-customer pilot confidence | not proven here | no-go for broad rollout | `SRE-2F` and owner assignment |
| Restore owner named | recoverability confidence | not proven here | no-go for broad rollout | `SRE-2F` and owner assignment |
| Production Backup Verification completed | unrestricted enterprise claim and real-customer pilot confidence | not completed | P0 gap | `SRE-2F` |
| Production backup verification completed | enterprise-ready recoverability claim | not completed here | no-go | `SRE-2F` |
| Restore Drill completed | recoverability confidence | design and decision-gate baseline only; no real approved execution completed | limited pilot stays guarded; unrestricted rollout blocked | synthetic/local dry run or separately approved restore path |
| Processor / DPA Inventory completed | real-customer pilot and unrestricted enterprise claim | incomplete; requires follow-up | P0 before customer data | processor / DPA inventory |
| Processor / DPA inventory completed | unrestricted enterprise claim and customer-data confidence | incomplete | no-go | processor/DPA follow-up |
| Privacy Owner defined | real-customer pilot and privacy escalation path | not confirmed | P0 before real customer data | assign privacy owner |
| Privacy owner confirmed | live privacy execution or real-customer escalation path | not proven here | guarded only | privacy owner decision |
| DSAR Owner defined | real-customer pilot and subject-rights execution path | not confirmed | P0 before real customer data | assign DSAR owner |
| DSAR owner confirmed | live subject-rights execution | not proven here | no-go | DSGVO owner follow-up |
| DSAR / Export execution path approved | live DSAR or export execution | not granted; blocked by current decision gates | no-go for execution | explicit decision gate and implementation plan |
| Retention / Deletion execution path approved | live retention or deletion execution | not granted; blocked by current decision gates | no-go for execution | explicit decision gate and implementation plan |
| Query Runner / Reports controlled | customer-data reporting and ad hoc data extraction | blocked and not granted | required guardrail; no customer-data reports or query results are allowed | separate approval and safety design only if needed |
| DB_READ_ONLY_AUDIT approved | production data audit or discovery | not granted | blocked | separate explicit human approval only |
| Production Config Owner defined | real-customer pilot operational accountability | not confirmed; follow-up required | P0 for real-customer pilot | assign owner |
| Production config owner defined | enterprise operational accountability | not proven here | no-go for unrestricted rollout | config owner follow-up |
| Pilot Daily Health Review operationalized | active enterprise outreach and any sustained pilot operation | documented, not proven operational in practice | P0 before active outreach | operationalize daily review |
| `DB_READ_ONLY_AUDIT` approved | production data audit or discovery | no | no-go | separate explicit human approval |
| Rollback point documented | guarded deploy readiness during pilot-impacting changes | documented for relevant deploys | supports guarded deploy readiness | keep rollback point mandatory before pilot-impacting deploys |
| Query runner / data reports controlled and approved | production data analysis | no approval granted | no-go | separate approval path |
| Public widget smoke and rollback discipline maintained | any limited pilot touching public surface | documented baseline exists | go with guardrails | keep required before/after relevant deploys |

## Decision By Pilot Type

| Pilot Type | Decision | Allowed Scope | Blocked Scope | Required Before Start |
| --- | --- | --- | --- | --- |
| internal readiness work | allowed | docs, audits, design, safe planning, gated refactors without customer-data execution | no DB/SQL/query/report/deploy/secret actions unless separately approved | continue normal gates |
| sales/demo preparation without customer data | allowed_with_guardrails | sanitized demos, architecture discussion, synthetic safe-test prep | no real customer data, no production-data audit, no secret sharing | keep guardrails and safe demo discipline |
| controlled enterprise pilot with safe-test/internal tenant only | conditional | limited internal or safe-test pilot with documented rollback and daily review | no customer-data ingestion without separate approval, no data-sensitive ops | P0 monitoring/alerting and owner clarity strongly preferred |
| controlled enterprise pilot with real customer | no_go_until_p0_or_explicit_acceptance | none by default | real customer data, real-customer pilot expansion, data-sensitive operations | complete P0 follow-ups or obtain explicit human acceptance |
| broad enterprise rollout | no | none | unrestricted customer rollout and enterprise-ready claim | complete open P0/P1 governance and ownership gaps |
| production data audit | no | none | `DB_READ_ONLY_AUDIT`, query-runner, report generation, real data discovery | separate explicit approval |
| DSAR/export execution | no | none | live DSAR, export generation, delivery, or evidence handling | DSGVO execution approvals and owner chain |
| retention/deletion execution | no | none | live deletion, correction, retention enforcement, cleanup, backfill | separate retention/deletion execution approval |
| backup/restore execution | no | none | production backup verification, restore drill, restore commands, backup-content access | `SRE-2F` and explicit approval |

## P0 Before Active Enterprise Outreach

The following items should be treated as P0 before active enterprise outreach or any real-customer pilot start:

- External Monitoring / Alert Setup decision or implementation
- real alert routing and owner path
- incident owner / on-call contact model
- Production Backup Verification Decision Gate
- named `backup_owner`
- named `restore_owner`
- processor / DPA inventory
- named `privacy_owner`
- named `DSAR_owner`
- named production config owner
- Pilot Daily Health Review operationalization
- Enterprise Pilot risk acceptance / go-no-go signoff if a real customer should start before the P0 gap set is closed

## Required Guardrails For Any Limited Pilot

Any limited pilot remains conditional on these guardrails:

- no customer data unless explicitly approved
- no `DB_READ_ONLY_AUDIT`
- no query runner
- no reports with data
- no DSAR execution
- no export execution
- no deletion or retention execution
- no production backup or restore execution
- no production secrets
- no production config changes
- no feature flags without separate approval
- Public Widget smoke before and after relevant deployments
- Daily Health Review
- documented rollback point for any deploy
- incident logging
- no customer-site mutation without explicit approval
- no NOLIS-specific hardcoding

## Explicit Acceptance Required For Exceptions

If a real enterprise pilot should start before the full P0 set is closed, explicit human acceptance is required.

That acceptance must at minimum include:

- accepted gaps
- owner
- duration
- customer scope
- data scope
- rollback or pause criteria
- incident contact
- privacy contact
- monitoring expectation
- backup/restore caveat
- DSAR/export/deletion caveat

This document does not grant such acceptance.

## Blocked Actions

The following remain explicitly blocked by this decision:

- `DB_READ_ONLY_AUDIT`
- DB reads or writes
- SQL
- query runner
- reports with data
- DSAR execution
- export execution
- JSON/CSV/ZIP export generation
- deletion / correction / retention execution
- cleanup / backfill / enforcement
- production backup / restore
- production data use
- production secret use
- production config change
- feature flags
- deploy
- customer site mutation
- public widget code change

## Pilot Launch Checklist

| Checklist Item | Required Before | Current Status | Owner Needed | Evidence Needed |
| --- | --- | --- | --- | --- |
| external uptime monitor | active enterprise outreach | not operationally proven | `pilot_ops_owner` / `engineering_owner` | approved monitor setup or equivalent decision gate |
| alert routing | active enterprise outreach | documented, not proven live | `pilot_ops_owner` | configured route and escalation proof |
| incident commander / on-call | real-customer pilot | role model exists, named ops path not proven | `incident_commander` / `primary_on_call` | owner assignment and contact path |
| rollback point | every approved deploy | process exists | `deploy_owner` | exact commit/image rollback evidence |
| daily health review | any active limited pilot | checklist exists, live routine not proven | `pilot_ops_owner` | review cadence and record format |
| backup owner | real-customer pilot | not proven | `backup_owner` | named owner and review path |
| restore owner | real-customer pilot | not proven | `restore_owner` | named owner and drill path |
| production backup verification decision | real-customer pilot confidence | open | `backup_owner` / `restore_owner` / `human_operator_approval` | `SRE-2F` outcome |
| processor / DPA inventory | active enterprise outreach | incomplete | privacy/legal/ops owner chain | provider inventory and contract status |
| privacy owner | DSAR/privacy escalation path | not proven | `privacy_owner` | named owner and escalation path |
| DSAR owner | subject-rights execution maturity | not proven | `DSAR_owner` | named workflow owner |
| public widget boundary check | any public-surface pilot | documented baseline exists | `security_owner` | smoke and response-shape evidence |
| security audit | any pilot | green baseline expected | `security_owner` | latest PASS evidence |
| authorization matrix | any pilot | green baseline expected | `security_owner` | latest PASS evidence |
| security boundaries | any pilot | green baseline expected | `security_owner` | latest PASS evidence |
| production config owner | real-customer pilot | not proven | config owner | ownership and recovery path |
| customer communication path | real-customer pilot | role placeholders exist | `communications_owner` / `customer_success_owner` | approved communication path |
| go/no-go signoff | real-customer pilot or expansion | this document only, not final signoff | pilot decision owner | explicit signoff or acceptance record |

## Decision Output

Enterprise Pilot Decision:

- Internal readiness work: `GO`
- Safe demo / non-customer-data preparation: `GO_WITH_GUARDRAILS`
- Controlled pilot with safe-test or internal tenant only: `CONDITIONAL`
- Controlled pilot with real customer data: `NO_GO_UNTIL_P0_OR_EXPLICIT_ACCEPTANCE`
- Broad enterprise rollout: `NO_GO`
- Production data audit: `NO_GO`
- DSAR/export/deletion execution: `NO_GO`
- Backup/restore execution: `NO_GO`

## Relationship To ENT-SEC-1A

- `ENT-SEC-1A` = gap audit and readiness assessment
- `ENT-SEC-1B` = explicit pilot go/no-go decision
- `ENT-SEC-1C` = possible follow-up for risk acceptance or pilot control plan
- `SRE-1G` = monitoring / alert setup decision gate
- `SRE-2F` = production backup verification decision gate
- `DSGVO-1H` = DSAR export implementation plan

## Recommended Next Step

Recommended next step:

- `SRE-1G Real External Monitor / Alert Setup Decision Gate`

Reason:

- monitoring and alerting remains the clearest P0 operational gap before active enterprise outreach
- it is the most direct blocker between current guarded readiness and a safer real-customer pilot posture
- backup verification, processor inventory, and privacy ownership remain critical too, but monitoring/alerting is the fastest operational hardening step

Valid alternatives:

- `SRE-2F Production Backup Verification Decision Gate`
- `ENT-SEC-1C Enterprise Pilot Control Plan`
- `DSGVO-1H DSAR Export Implementation Plan`

## Stop Boundaries

This decision:

- reads no DB
- executes no SQL
- uses no query runner
- generates no reports
- executes no DSAR request
- executes no export
- generates no JSON/CSV/ZIP export file
- executes no deletion
- executes no correction
- executes no retention action
- executes no cleanup, backfill, or enforcement
- opens no backups, dumps, or exports
- reads no secrets
- performs no production query
- changes no production config
- deploys nothing
- changes no Public Widget response
- mutates no customer site
- grants no final DSGVO compliance
- grants no unrestricted enterprise release

## Non-goals

- no implementation
- no deploy
- no DB access
- no SQL
- no query runner
- no reports
- no export
- no DSAR execution
- no deletion
- no correction
- no retention action
- no cleanup, backfill, or enforcement
- no backup or restore
- no runtime change
- no workflow change
- no customer data handling
- no secrets handling
- no final compliance signoff
