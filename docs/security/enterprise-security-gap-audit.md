# Enterprise Security Gap Audit

Stand: 2026-07-23

## Summary

This document is a documentation-only Enterprise Security Gap Audit for Enterprise Pilot readiness.

Purpose:

- inventory the currently repo-evident security, SRE, backup/restore, dependency, privacy, and deployment baselines
- separate hard pilot blockers from guarded-but-acceptable pilot gaps
- consolidate the current Enterprise Pilot go/no-go criteria into one review document
- identify which follow-up tasks require implementation, explicit human approval, external setup, or legal / processor review

This step is intentionally `DOKU_ONLY`.

This audit does not:

- read any database
- execute SQL
- use a query runner
- read production or staging logs
- generate reports
- generate JSON, CSV, or ZIP export files
- execute DSAR, export, deletion, correction, retention, cleanup, backfill, or enforcement actions
- open backups, dumps, or exports
- change runtime code, workflows, scripts, config, or feature flags
- perform any deploy or production action
- document real customer data, secrets, or connection strings
- grant final compliance approval
- grant unrestricted enterprise readiness

This document is a technical gap audit, not legal advice and not a final enterprise release approval.

## Scope

Scope of analysis:

- read-only review of `docs/operations/*`, `docs/security/*`, and relevant `docs/architecture/*`
- read-only review of relevant security-, tenant-, privacy-, widget-, email-, webhook-, reporting-, and backup-related repository surfaces
- read-only review of migrations, tests, DTOs, route proxies, and documented deploy / health evidence

Out of scope:

- production data analysis
- staging data analysis
- live DB or backup inspection
- live log analysis
- legal sign-off
- processor contract sign-off
- runtime validation beyond already documented evidence

## Enterprise Readiness Classification Model

### Status labels

- `green_ready_for_limited_pilot`
- `yellow_ready_with_guardrails`
- `red_blocks_pilot`
- `not_validated`
- `documented_only`
- `requires_human_approval`
- `requires_implementation`
- `requires_external_setup`
- `requires_legal_or_processor_review`

### Risk levels

- `critical`
- `high`
- `medium`
- `low`
- `unknown`

## Current Security Baseline Summary

| Area | Current Evidence | Status | Pilot Impact | Follow-up |
| --- | --- | --- | --- | --- |
| Review / Security Diff Scan Policy | `docs/operations/codex-review-security-diff-scan-policy.md`, prompt templates, runbook | `green_ready_for_limited_pilot` | Review discipline is documented and repeatable | continue using on risky diffs |
| CI / Main-CI / Docker build / PostgreSQL isolation | `ci.yml`, `scripts/ops/codex-main-ci-gate.sh`, documented green runs on current main line | `green_ready_for_limited_pilot` | Build and isolation gates are strong pre-merge / post-merge controls | keep exact-SHA gate usage mandatory |
| Production security audit | `npm run security:audit:production-contexts` baseline is PASS | `green_ready_for_limited_pilot` | no open High/Critical production-context finding blocks pilot today | keep recheck cadence |
| Authorization Matrix | `npm run security:check-authorization-matrix` baseline PASS | `green_ready_for_limited_pilot` | route/access regression gate exists | expand evidence only if new admin surfaces appear |
| Security Boundary Tests | `npm run test:security-boundaries` baseline PASS | `green_ready_for_limited_pilot` | hard security baseline is automated | keep mandatory for risky changes |
| Dependency Drift Handling | dependency register, audit exceptions, drift deploy status docs | `green_ready_for_limited_pilot` | recent drift handling is disciplined and documented | continue periodic review |
| SRE Monitoring / Incident Docs | `SRE-1A` through `SRE-1F` docs complete | `yellow_ready_with_guardrails` | planning baseline exists, but external setup is not live-proven | `SRE-1G` |
| Backup / Restore Governance | `SRE-2A` through `SRE-2E` docs complete | `yellow_ready_with_guardrails` | governance exists, live verification and ownership remain incomplete | `SRE-2F` |
| DSGVO / Privacy Governance | `DSGVO-1A` through `DSGVO-1G` docs complete | `yellow_ready_with_guardrails` | privacy mapping and decision gates exist, execution remains blocked | `DSGVO-1H` plus owner decisions |
| Dashboard `sharp` mitigation | production-live documented in dependency register and deploy status docs | `green_ready_for_limited_pilot` | former high blocker remains removed | periodic audit recheck |
| `body-parser` fix | production-live documented | `green_ready_for_limited_pilot` | API production context remains clear of that drift | periodic audit recheck |
| Next.js security patch | `next@16.2.11` production-live documented | `green_ready_for_limited_pilot` | former dashboard high blockers remain removed | re-review moderate `postcss` exception before expiry |
| Public Widget Safe Smoke / Boundary | safe smoke and response-shape baseline documented | `yellow_ready_with_guardrails` | customer-facing surface has safe signals, but needs continued pilot discipline | keep smoke before / after pilot-affecting changes |
| Deploy / Rollback Hygiene | post-merge gates, rollback points, deploy docs, Docker fallback design | `yellow_ready_with_guardrails` | disciplined deploy evidence exists, but fallback and recovery still need fuller operational hardening | keep rollback point mandatory |

## Enterprise Security Control Matrix

| Control Area | Evidence | Current Status | Risk | Pilot Decision | Required Follow-up |
| --- | --- | --- | --- | --- | --- |
| Authentication | dashboard auth/session helpers and signed session logic in `apps/dashboard/lib/auth-core.ts` and `apps/dashboard/lib/auth.ts` | `yellow_ready_with_guardrails` | `medium` | acceptable for limited pilot | add explicit owner and operational review cadence |
| Authorization / RBAC | dashboard role propagation and API-side checks via `apps/dashboard/lib/dashboard-api.ts`, `AdminScopeService`, matrix tests | `green_ready_for_limited_pilot` | `medium` | go with guardrails | `ENT-SEC-2A` for deeper review |
| Tenant Isolation | tenant/site scoping visible in dashboard proxy routes, admin scope checks, tenant-aware migrations/tests | `yellow_ready_with_guardrails` | `high` | limited pilot only with explicit review discipline | `ENT-SEC-2A` |
| Public Widget Boundary | widget uses `siteKey`, per-site storage keys, safe smoke baseline, no public conversation-engine activation | `yellow_ready_with_guardrails` | `high` | allowed only with smoke discipline | continue smoke and leak-watch controls |
| API Runtime Security | boundary tests, authorization matrix, production-context audit, no open High/Critical findings | `green_ready_for_limited_pilot` | `medium` | go | keep mandatory gates |
| Dashboard Admin Security | auth/session signing, route proxies, role/site access enforcement, production-live dashboard patches | `yellow_ready_with_guardrails` | `high` | limited pilot only | admin-surface review and owner assignment |
| Webhook Security | HMAC signing docs/tests and `apps/api/src/webhooks/webhook-hmac.ts` | `yellow_ready_with_guardrails` | `high` | allowed only with controlled integrations | future execution safety and provider review |
| Email Delivery Security | `nodemailer@9.0.1`, queue/write boundaries documented, worker/write paths known | `yellow_ready_with_guardrails` | `high` | current runtime acceptable for limited pilot, not fully hardened | queue / idempotency / execution follow-ups remain |
| Query Runner / Reports | export/report surfaces exist; query runner / report-with-data use remains blocked by policy | `documented_only` | `high` | blocked for pilot operations without explicit approval | keep blocked |
| Secrets Management | sensitive scan, hard stop rules, secret masking docs | `yellow_ready_with_guardrails` | `high` | acceptable only with process discipline | `ENT-SEC-4A` |
| Production Config Management | production config treated as protected and non-editable without separate scope | `documented_only` | `high` | not fully ready | assign ownership and recovery model |
| CI/CD Permissions | main-CI, diff-scan policy, post-merge gate process, no direct push to `main` | `green_ready_for_limited_pilot` | `medium` | go | periodic review of GitHub permissions |
| Dependency / Supply Chain Security | dependency register, drift response, audit-exception process | `green_ready_for_limited_pilot` | `medium` | go | continue exception expiry tracking |
| Docker / Runtime Image Security | Docker build gate, fallback workflow, production image digests documented | `yellow_ready_with_guardrails` | `medium` | go with fallback caveat | remote fallback runner hardening remains useful |
| DB / Migration Safety | no auto-migration baseline, additive migration discipline, PostgreSQL isolation gate | `yellow_ready_with_guardrails` | `high` | acceptable while DB change discipline remains strict | separate gates for any DB work |
| Backup / Restore Safety | inventory, drill plan, access model, dry-run decision gate docs | `yellow_ready_with_guardrails` | `high` | not enough for unrestricted pilot claims | `SRE-2F` |
| Monitoring / Alerting | monitoring audit, alert routing design, external monitor design, pilot checklist | `yellow_ready_with_guardrails` | `high` | limited pilot only, not broad rollout | `SRE-1G` |
| Incident Response | incident runbook and pilot review checklist exist | `yellow_ready_with_guardrails` | `medium` | acceptable for limited pilot | assign named owner/on-call chain |
| Logging / Audit | audit log service and sanitization evidence, privacy docs note retention/redaction gaps | `yellow_ready_with_guardrails` | `high` | acceptable only with guardrails | admin audit-log scope and log-retention follow-up |
| Privacy / DSGVO | full `DSGVO-1A` through `DSGVO-1G` design baseline exists | `yellow_ready_with_guardrails` | `high` | limited pilot only; no compliance claim | owner / processor / execution follow-ups |
| External Providers / Processors | provider classes are documented, but DPA/ownership state is incomplete | `requires_legal_or_processor_review` | `high` | no full-go | processor inventory / DPA follow-up |
| Data Retention / Deletion | policy/design and gap docs exist; live execution remains blocked | `documented_only` | `high` | no full-go | retention/deletion execution plan and owner |
| DSAR / Export | export schema/safety/decision gate docs exist; execution remains unapproved | `documented_only` | `high` | blocked for live execution | `DSGVO-1H` and later gated execution |
| Feature Flags | feature-flag risk is documented; no new pilot-enabling flag work is part of this baseline | `yellow_ready_with_guardrails` | `medium` | go only with explicit flag discipline | keep production flag changes separately gated |
| Rollback / Recovery | deploy docs record exact commits/images; incident/deploy review process exists | `yellow_ready_with_guardrails` | `medium` | go with process discipline | production backup verification and restore ownership |

## Red / Blocking Gaps

These are the gaps that still block any unrestricted enterprise-ready claim and should be treated as pilot blockers unless explicitly accepted with narrow guardrails.

| Gap | Current State | Risk | Why It Blocks Full Go | Required Follow-up |
| --- | --- | --- | --- | --- |
| Real external monitoring and alerts not yet operationally proven | planning/docs exist, live setup not proven here | `high` | weakens early detection for pilot-impacting failures | `SRE-1G Real External Monitor / Alert Setup Decision Gate` |
| Backup / restore ownership and live verification incomplete | inventory and design exist, current production verification not proven here | `high` | recoverability cannot be claimed as enterprise-ready | `SRE-2F Production Backup Verification Decision Gate` |
| Processor / DPA inventory incomplete | provider classes are documented, contractual ownership is not | `high` | privacy and enterprise procurement cannot treat processor posture as complete | processor / DPA audit |
| Privacy owner and DSAR owner not explicitly fixed | role placeholders remain, no confirmed owner chain in repo evidence | `high` | DSAR/export/deletion governance remains incomplete | ownership decision task |
| Production config ownership and recovery model incomplete | config is protected, but full owner/recovery mapping is not audited | `high` | enterprise operations need accountable config control | config ownership follow-up |
| DSAR / export / deletion execution remains intentionally blocked | design exists, execution approval absent | `high` | no mature end-to-end subject-rights operating model | `DSGVO-1H` plus later gated execution |
| `DB_READ_ONLY_AUDIT` remains blocked | explicit human approval absent | `high` | live DB-backed privacy and duplicate-audit validation remains unavailable | separate explicit human approval task |
| Tenant-isolation / admin-surface deep enterprise review not yet completed | baseline evidence exists, dedicated enterprise review not yet done | `high` | enterprise pilot should not assume final validation from baseline tests alone | `ENT-SEC-2A` |

Current High/Critical dependency findings:

- open High/Critical production-context findings: `no`
- blocking moderate exception only: `postcss` via `next`, temporary and non-blocking under current documented conditions

Interpretation:

- security dependency drift is not the current enterprise pilot blocker
- operational ownership, monitoring, privacy execution, and processor governance are the main blockers for unrestricted pilot expansion

## Yellow / Guardrail Gaps

These areas do not automatically block a narrow, controlled pilot, but they require explicit guardrails, bounded scope, and close operational review.

- external uptime monitoring is designed but not yet proven live
- alert routing is documented, not yet shown as fully operational
- restore drill process is designed, not yet re-validated as recurring evidence
- production backup verification is planned, not yet completed
- DSAR export safety and schema are designed, not implemented for live use
- retention windows are partly defined, not fully enforced/proven across all surfaces
- log redaction and log retention follow-up remains open
- provider / processor inventory is incomplete
- admin-surface and tenant-isolation deep review remains open
- queue / worker / email / webhook operational hardening remains partly documented rather than fully reworked

## Green / Existing Strengths

- Main-CI, PR-CI, Docker build, and PostgreSQL isolation gates are in place and already used as required evidence
- production-context audit, authorization matrix, and security boundary tests are baseline PASS gates
- recent dependency drifts for `body-parser`, `sharp`, and `next` were resolved or mitigated production-live without unsafe force-fix behavior
- security diff scan policy and process gate tooling are documented and reusable
- incident-response, monitoring, alert-routing, and pilot health review baselines are documented
- backup / restore governance artifacts exist and already separate documentation from live proof
- DSGVO governance artifacts from `DSGVO-1A` through `DSGVO-1G` are present
- public widget safe smoke and production health are established as safe non-customer signals
- repo hygiene, worktree isolation, and gated merge / deploy documentation are mature compared with earlier project phases

## Privacy / DSGVO Enterprise Readiness

Current repo-evident privacy baseline:

- `DSGVO-1A` PII data map exists
- `DSGVO-1B-R` purpose / retention / DSAR gap audit exists
- `DSGVO-1C` DSAR / privacy export safety design exists
- `DSGVO-1D` retention / deletion policy design exists
- `DSGVO-1E` DSAR export schema design exists
- `DSGVO-1F` DSAR execution decision gate exists
- `DSGVO-1G` retention / deletion implementation decision gate exists

Current readiness interpretation:

- privacy governance is substantially documented
- live privacy execution is still intentionally blocked
- no final DSGVO compliance claim is justified from repo evidence alone
- processor / DPA review is still required
- privacy owner and DSAR owner still need explicit confirmation
- any real export, deletion, correction, retention action, or DB discovery remains approval-bound

Privacy status:

- classification: `yellow_ready_with_guardrails`
- full live execution maturity: `red_blocks_pilot` for unapproved DSAR/export/delete execution

## SRE / Operational Readiness

Current repo-evident SRE baseline:

- monitoring alerting audit exists
- alert routing design exists
- incident response runbook exists
- external uptime monitor design exists
- pilot health review checklist exists
- minimal external monitor setup plan exists

Still open for enterprise pilot operations:

- real external monitoring integration
- real alert destinations and escalation routing
- explicit incident owner / on-call mapping
- repeatable daily or weekly operational review routine in practice

SRE status:

- classification: `yellow_ready_with_guardrails`

## Backup / Restore Readiness

Current repo-evident backup baseline:

- backup restore drill plan exists
- backup inventory audit exists
- backup responsibility / access model exists
- non-production restore drill design exists
- local staging restore dry-run decision gate exists

Still open:

- no backup or restore execution was performed in this audit
- production backup verification is not completed here
- restore owner / backup owner finalization remains necessary
- privacy / PII guardrails remain binding for any future restore proof

Backup / restore status:

- classification: `yellow_ready_with_guardrails`

## Dependency / Supply Chain Readiness

Current repo-evident dependency baseline:

- `npm run security:audit:production-contexts` PASS is the expected baseline
- `body-parser` production drift is fixed and documented live
- `sharp` dashboard blocker is mitigated and documented live
- `next` dashboard high advisories are fixed and documented live
- no High/Critical production-context findings are expected in the current baseline
- the known `postcss` issue remains at most moderate and is tracked in `docs/security/audit-exceptions.md`

Dependency status:

- classification: `green_ready_for_limited_pilot`

## Public Widget / Customer-Facing Surface Readiness

Current repo-evident widget baseline:

- `siteKey`-based remote widget loading is visible in `packages/widget-sdk`
- per-site client storage keys exist in `apps/widget/src/services/sessionService.ts`
- public widget safe smoke is documented
- production-health synthetic is documented as a safe config-level signal
- no public widget response change is part of this task
- conversation engine is still not live in the public widget baseline

Known customer-facing risks:

- free-text chat and lead/contact surfaces remain inherently privacy-sensitive
- public widget still depends on continued smoke validation and response-shape discipline
- any future customer-site mutation remains out of scope and separately gated

Widget status:

- classification: `yellow_ready_with_guardrails`

## API / Dashboard / Admin Readiness

Repo-evident strengths:

- dashboard session signing and verification exist in `apps/dashboard/lib/auth-core.ts`
- dashboard backend proxying carries scoped role/tenant headers in `apps/dashboard/lib/dashboard-api.ts`
- site-access checks exist on sensitive dashboard routes such as privacy export/delete and audit-log routes
- API-side admin scope enforcement is visible in billing/admin controllers and related tests
- tenant-aware migrations and tests exist
- production dashboard dependency blockers have been closed

Open review areas:

- explicit enterprise review of all privileged admin and tenant-management flows
- final ownership for admin audit visibility and retention
- broader tenant-isolation evidence summary for enterprise audiences

API / dashboard / admin status:

- classification: `yellow_ready_with_guardrails`

## Query Runner / Reports / Data Export Risk

The following boundaries remain intentionally closed:

- query runner remains blocked
- reports with data remain blocked as an operational tool
- query results remain blocked
- DSAR export is designed but not approved for live execution
- cross-tenant export risk remains a hard stop
- no reports or exports were created in this task

Status:

- classification: `red_blocks_pilot` for any live execution request
- classification: `documented_only` for design/governance readiness

## Secrets / Config / Environment Risk

This audit confirms process boundaries, not live secret correctness.

Explicitly confirmed for this task:

- no secrets were added to the diff
- no `.env` file was read
- no production config was changed
- no monitor URLs or tokens were documented
- no provider credentials were documented

Still open:

- production config ownership and recovery model
- secrets inventory / rotation / break-glass review
- provider and alert-destination ownership mapping

Status:

- classification: `yellow_ready_with_guardrails`

## Enterprise Pilot Go / No-Go Summary

| Criterion | Status | Go/No-Go Impact | Required Follow-up |
| --- | --- | --- | --- |
| No High/Critical Findings | `pass` | positive go signal | maintain audit cadence |
| Production health | `documented green baseline` | positive go signal | continue operational review |
| CI / Main-CI | `pass baseline` | positive go signal | keep exact-SHA gating |
| Docker build | `pass baseline` | positive go signal | keep fallback process ready |
| PostgreSQL isolation | `pass baseline` | positive go signal | maintain in CI |
| Authorization Matrix | `pass baseline` | positive go signal | maintain in CI |
| Security Boundaries | `pass baseline` | positive go signal | maintain in CI |
| Incident Response | `documented_only` | guarded go only | assign named owner chain |
| Monitoring / Alerting | `documented_only` / `requires_external_setup` | blocks unrestricted go; guarded pilot only | `SRE-1G` |
| Backup / Restore | `documented_only` / `not_validated` | blocks unrestricted go; guarded pilot only | `SRE-2F` |
| Privacy / DSGVO | `documented governance` | guarded go only | owner, processor, execution follow-ups |
| DSAR / Export | `not approved` | blocks live privacy execution | `DSGVO-1H` and later gated execution |
| Retention / Deletion | `design only` | blocks live execution claims | later implementation/approval track |
| Query Runner / Reports | `blocked` | hard no-go for live use | keep blocked |
| Public Widget Boundary | `guarded positive` | pilot can proceed only with smoke discipline | keep smoke and leak-watch rules |
| Processor / DPA | `requires_legal_or_processor_review` | blocks unrestricted enterprise claims | processor inventory |
| Owners / Approvals | `incomplete` | blocks unrestricted go | assign privacy, backup, incident, config owners |
| Rollback / Recovery | `partially documented` | guarded go only | production backup verification and restore ownership |

Overall result:

- unrestricted enterprise-ready release claim: `no`
- limited enterprise pilot with explicit guardrails: `yes`, if the documented red boundaries stay closed and the remaining owner / monitoring / backup / privacy follow-ups are treated as pre-pilot or tightly time-boxed pilot prerequisites
- overall classification: `yellow_ready_with_guardrails`

## Prioritized Follow-up Roadmap

### P0 / Before pilot outreach or pilot launch

- `ENT-SEC-1B Enterprise Pilot Go/No-Go Decision`
- `SRE-1G Real External Monitor / Alert Setup Decision Gate`
- `SRE-2F Production Backup Verification Decision Gate`
- processor / DPA inventory and review
- privacy owner and DSAR owner assignment
- production config ownership and recovery ownership assignment
- operationalize pilot daily/weekly health review ownership

### P1 / During a tightly controlled pilot

- `ENT-SEC-2A Tenant Isolation / RBAC Review`
- `ENT-SEC-3A Admin Audit Log Scope`
- `ENT-SEC-4A Secrets Inventory / Rotation Plan`
- `DSGVO-1H DSAR Export Implementation Plan`
- retention / deletion implementation planning
- log redaction / retention hardening
- incident exercise
- external monitor tuning

### P2 / Hardening after initial pilot stabilization

- periodic restore drill with sanitized or explicitly approved data strategy
- deeper access and admin-surface reviews
- processor automation / evidence packaging
- advanced audit trails and enterprise reporting package
- queue / worker / delivery reliability hardening where still deferred

## Stop Boundaries

This audit does not change any existing hard boundaries.

Explicitly still blocked:

- no DB reads
- no DB writes
- no SQL
- no query runner
- no query results
- no reports with data
- no DSAR execution
- no export execution
- no deletion execution
- no correction execution
- no retention action
- no cleanup, backfill, or enforcement
- no backup or restore execution
- no opening of dumps, exports, or backups
- no production-data access
- no production-secret access
- no production config mutation
- no deploy
- no public widget response change
- no customer-site mutation
- no unrestricted enterprise-ready claim
- no final DSGVO-compliance claim

## Recommended Next Step

Recommended next task:

- `ENT-SEC-1B Enterprise Pilot Go/No-Go Decision`

Reason:

- the enterprise pilot baseline is now consolidated into one security gap audit
- the next missing step is not more baseline inventory, but an explicit decision that says which gaps are mandatory before active pilot outreach and which remain acceptable only under narrow guardrails

Useful alternatives:

- `SRE-1G Real External Monitor / Alert Setup Decision Gate`
- `SRE-2F Production Backup Verification Decision Gate`
- `DSGVO-1H DSAR Export Implementation Plan`

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
- no backup / restore action
- no runtime change
- no workflow change
- no script change
- no customer data
- no secrets
- no final compliance approval
- no unrestricted enterprise release approval
