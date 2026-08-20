# Knowledge Website Answer Pilot Guided Demo Security Baseline Revalidation Path

## Summary

- Audit date: Thursday, August 20, 2026
- Baseline: `77b721e0895f0a2321270f17bac97a80ae13547f`
- Scope decision: `security_baseline_revalidation_path_documented`
- This task documents only an internal later path for security-baseline revalidation before any possible authorization reconsideration.
- This task performs no real security-baseline revalidation.
- This task approves no security baseline, no authorization reconsideration, no authorization, no guided demo, no customer demo, no public widget, and no production use.
- This task changes no runtime, API, dashboard, widget, workflow, package, lockfile, migration, SQL, config, or deploy surface.
- This task creates no authorization record, no authorization-record draft, no authorization grant, no approval grant, and no security revalidation artefact.
- This task uses no customer data, no production data, no PII, no provider calls, no live LLM answers, no embeddings, no RAG, no DB reads/writes, and no Query Runner.
- Guided customer demo remains `still_blocked`.
- Self-service customer demo remains `blocked`.
- Real pilot remains `blocked`.

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-CUSTOMER-FACING-COPY-FINAL-APPROVAL-PATH-1` was merged on `main` at `77b721e0895f0a2321270f17bac97a80ae13547f` and documented the later customer-facing-copy final-approval dependency without approving copy.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-PROVIDER-NO-LIVE-CONFIRMATION-PATH-1` remains on `main` at `c166f4d3c818eba56e3f931f060fb07767a3ae8a` and documented the no-provider-live dependency.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-DATA-POLICY-SYNTHETIC-ONLY-CONFIRMATION-PATH-1` remains on `main` at `2d89395b5d487ff2795854ae7ea0ebecbe464d49` and documented synthetic-only and no-customer-data boundaries.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-ENVIRONMENT-ACCESS-ISOLATION-CONFIRMATION-PATH-1` remains on `main` at `8ec8cba4bc5eddcfc68f9366f630fce97f77d327` and documented environment, access, and isolation dependencies.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-SCOPE-AUDIENCE-PURPOSE-FINALIZATION-PATH-1` remains on `main` at `7117b8ce5c2fd6bea6e5425ad7a0dcbaba8341d0` and documented scope, audience, and purpose dependencies.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUDIT-LOGGING-RETENTION-DSAR-APPROVAL-PATH-1` remains on `main` at `edad43b8f862d5862795ea44c283f124951692d5` and documented audit, logging, retention, and DSAR dependencies.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-CREDENTIAL-EXPIRY-REVOCATION-APPROVAL-PATH-1` remains on `main` at `3d6cd405231706e2799c0b340971d404d506f1ed` and documented expiry and revocation dependencies.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-DEMO-URL-ACCOUNT-INVITATION-APPROVAL-PATH-1` remains on `main` at `cad32978c18a083e90610fab2372d51c2bd5200a` and documented URL, account, and invitation dependencies.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-DEMO-ACCESS-APPROVAL-PATH-1` remains on `main` at `e67857a9d066a678cdfc300fa8768bf064314ba2` and documented later demo-access approval without granting access.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-EXTERNAL-AUDIENCE-APPROVAL-PATH-1` remains on `main` at `ababb372415a1aaf425c86662ac3863778c01e07` and documented external-audience dependencies without approving audience use.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-LEGAL-PRIVACY-AVV-APPROVAL-PATH-1` remains on `main` at `a41d43e04d6ace16c6c1b929d019632ccbf9a7e7` and documented legal, privacy, and AVV dependencies without approval.
- `SOURCE-GATE-PROVIDER-TESTS-FIX-1` remains on `main` at `905584625c8cec61e509be23c5a1ec79403b074a` and preserved the source-gate provider-test fix basis.
- `KNOWLEDGE-PROVIDER-APPROVAL-POLICY-1` remains on `main` at `02c3b83849baadd07403255e4ee2d643c7d6371b` and preserves the default-deny provider-approval policy.
- `DASHBOARD-P1-TERMINOLOGY-AND-HELP-COPY-1` remains on `main` at `e8a5f02ee619cfd1d5087747a020fa1032721723` and preserves the copy-boundary baseline.
- Before this task, governance, provider, data, environment, access, scope, audience, logging, credential, access, audience, legal/privacy, and copy-boundary paths already existed on `main`, but no dedicated internal path described the exact later security-baseline revalidation sequence before authorization reconsideration.

## Scope Decision

- Variant A selected: `security_baseline_revalidation_path_documented`.
- Existing path documentation on `main` is sufficient to document a later security-baseline revalidation path without executing any real revalidation and without changing code, workflow, config, or package surfaces.
- The output is internal-only, documentation-only, report-only, and non-executing.
- The output does not approve any security baseline, any authorization reconsideration, any authorization, any guided demo, any customer demo, any public widget, any production use, any provider-live use, or any customer-data use.

## Purpose

- Define which later security-baseline checks would be required before any authorization reconsideration could be attempted.
- Define which CI, source-gate, security-audit, Docker-build, PostgreSQL-isolation, authorization-matrix, security-boundary, sensitive-scan, diff, dependency, runtime, widget, dashboard, provider, data, privacy, and deploy boundaries would later need fresh written evidence.
- Define which artefacts a future real security-baseline revalidation would need to produce.
- Define what must never count as security-baseline revalidation.
- Define which missing, stale, red, pending, unavailable, or invalid conditions must stop any later authorization reconsideration attempt.
- Preserve the default-deny posture.
- Do not execute security-baseline revalidation.
- Do not execute authorization reconsideration.
- Do not grant authorization.
- Do not authorize any guided demo, customer demo, public widget, or production use.
- Do not create any authorization record, authorization-record draft, authorization grant, approval grant, or evidence bundle.
- Do not change runtime, API, dashboard, widget, workflow, script, package, migration, SQL, config, or deploy surfaces.
- Do not use customer data, production data, PII, providers, live answers, embeddings, RAG, DB reads/writes, or Query Runner output.

## Customer-Facing Copy Final Approval Path Dependency

- This document depends directly on `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-CUSTOMER-FACING-COPY-FINAL-APPROVAL-PATH-1`.
- A later security-baseline revalidation path is meaningful only if the customer-facing-copy final-approval path remains documented on `main`.
- This task does not replace that path and does not weaken it.
- If the customer-facing-copy final-approval path were absent from `main`, this task would be blocked.

## Security Baseline Revalidation Path Verdict

- Verdict: the internal security-baseline revalidation path can be documented now without executing any real security-baseline revalidation and without granting any authorization.
- `security_baseline_revalidation_path_documented = true`
- `security_baseline_revalidation_path_internal_only = true`
- `security_baseline_revalidation_path_report_only = true`
- `security_baseline_revalidated = false`
- `security_revalidation_executed = false`
- `security_approval_claimed = false`
- `authorization_reconsideration_executed = false`
- `authorization_reconsideration_ready = false`
- `authorization_decision = not_authorized`
- `guided_customer_demo = still_blocked`
- `self_service_customer_demo = blocked`
- `real_pilot = blocked`
- Result: `path documented only, no revalidation executed, no authorization reconsidered, no authorization granted`.

## Revalidation Path Principles

- Revalidation-path documentation is not security-baseline revalidation.
- Revalidation-path documentation is not source-gate revalidation.
- Revalidation-path documentation is not security-audit revalidation.
- Revalidation-path documentation is not Docker-build revalidation.
- Revalidation-path documentation is not PostgreSQL-isolation revalidation.
- Revalidation-path documentation is not authorization-matrix revalidation.
- Revalidation-path documentation is not security-boundary revalidation.
- Revalidation-path documentation is not sensitive-scan revalidation.
- Revalidation-path documentation is not dependency approval.
- Revalidation-path documentation is not runtime approval.
- Revalidation-path documentation is not dashboard approval.
- Revalidation-path documentation is not widget approval.
- Revalidation-path documentation is not authorization reconsideration.
- Revalidation-path documentation is not authorization.
- Task quality checks for this documentation PR are not later guided-demo approval signals.
- Green CI, green local checks, merged docs, screenshots, recordings, and generic team agreement are support signals only and never security-baseline revalidation.
- Any ambiguity remains blocked until a later explicit human authorization statement and a fresh written security revalidation artefact exist.

## Revalidation Path Status Legend

- `path_documented_only`
- `security_baseline_not_revalidated`
- `source_gate_not_revalidated`
- `security_audit_not_revalidated`
- `docker_build_not_revalidated`
- `postgresql_isolation_not_revalidated`
- `authorization_matrix_not_revalidated`
- `security_boundaries_not_revalidated`
- `sensitive_scan_not_revalidated`
- `diff_scope_not_revalidated`
- `doc_only_gate_not_revalidated`
- `runtime_regression_not_revalidated`
- `dashboard_regression_not_revalidated`
- `widget_regression_not_revalidated`
- `dependency_tree_not_approved`
- `package_lock_not_changed`
- `production_context_not_approved`
- `main_ci_not_final_approval`
- `ci_pass_not_authorization`
- `security_pass_not_authorization`
- `authorization_reconsideration_not_executed`
- `guided_demo_not_authorized`
- `public_widget_not_activated`
- `production_not_activated`
- `requires_future_customer_facing_copy_final_approval_path`
- `requires_future_fresh_ci_run`
- `requires_future_fresh_security_audit`
- `requires_future_fresh_sensitive_scan`
- `requires_future_written_revalidation_artefact`
- `must_not_be_treated_as_approval`
- `not_authorized`

## Revalidation Path Structure

The later security-baseline revalidation path would require, at minimum:

1. revalidation purpose / scope inputs
2. commit / branch / PR / main snapshot inputs
3. CI source gate revalidation inputs
4. security audit / production context revalidation inputs
5. Docker build revalidation inputs
6. PostgreSQL isolation revalidation inputs
7. authorization matrix revalidation inputs
8. security boundary test revalidation inputs
9. sensitive scan / secret scan revalidation inputs
10. diff / scope / doc-only gate revalidation inputs
11. runtime / API / dashboard / widget regression inputs
12. data / privacy / provider / copy boundary revalidation inputs
13. dependency / package / lockfile / vulnerability boundary inputs
14. environment / deploy / public widget / production exclusion inputs
15. evidence bundle / traceability / freshness inputs
16. failure / red / pending / unavailable gate stop inputs
17. required future security baseline revalidation artefact
18. handoff to authorization reconsideration path

## Path Step 1: Revalidation Purpose / Scope Inputs

- A later revalidation path would require explicit purpose and scope inputs for the security baseline.
- It would need a later reviewer to confirm which exact guided-demo boundary is under reconsideration and what remains out of scope.
- This task confirms no executable security revalidation scope.

## Path Step 2: Commit / Branch / PR / Main Snapshot Inputs

- A later revalidation path would require an exact main snapshot, exact target SHA, exact PR or merge context, and an unambiguous base reference.
- It would need a later reviewer to confirm that evidence points to the exact commit under review and not to stale or adjacent SHAs.
- This task approves no future commit, no future branch, and no future PR as revalidated.

## Path Step 3: CI Source Gate Revalidation Inputs

- A later revalidation path would require a fresh CI source-gate result for the exact target SHA with a reliable evidence path.
- It would need a later reviewer to confirm that the source gate is green on the exact later baseline and not inferred from an older run.
- This task does not revalidate the source gate.

## Path Step 4: Security Audit / Production Context Revalidation Inputs

- A later revalidation path would require a fresh production-context security audit result on the exact later baseline.
- It would need a later reviewer to confirm that current production-context findings, accepted scoped exceptions, and dependency posture remain valid.
- This task does not revalidate the security audit.

## Path Step 5: Docker Build Revalidation Inputs

- A later revalidation path would require a fresh Docker build result on the exact later baseline.
- It would need a later reviewer to confirm that the later build signal is available, attributable, and not inferred from stale CI.
- This task does not revalidate Docker build status.

## Path Step 6: PostgreSQL Isolation Revalidation Inputs

- A later revalidation path would require a fresh PostgreSQL isolation result on the exact later baseline.
- It would need a later reviewer to confirm that database-isolation security checks remain green and current.
- This task does not revalidate PostgreSQL isolation.

## Path Step 7: Authorization Matrix Revalidation Inputs

- A later revalidation path would require a fresh authorization-matrix result on the exact later baseline.
- It would need a later reviewer to confirm that role and authorization boundaries remain unchanged and green.
- This task does not revalidate the authorization matrix as later approval evidence.

## Path Step 8: Security Boundary Test Revalidation Inputs

- A later revalidation path would require fresh security-boundary test results on the exact later baseline.
- It would need a later reviewer to confirm that boundary protections remain green and current.
- This task does not revalidate security boundaries as later approval evidence.

## Path Step 9: Sensitive Scan / Secret Scan Revalidation Inputs

- A later revalidation path would require a fresh sensitive scan / secret scan result on the exact later baseline.
- It would need a later reviewer to confirm that no newly introduced secret, credential, or sensitive-content issue exists.
- This task does not revalidate the sensitive scan as later approval evidence.

## Path Step 10: Diff / Scope / Doc-only Gate Revalidation Inputs

- A later revalidation path would require a fresh diff, scope, and gate assessment for the exact later baseline.
- It would need a later reviewer to confirm whether the later change set remains within declared scope and whether any fallback basis is legitimate.
- This task does not revalidate diff scope or doc-only status for later authorization.

## Path Step 11: Runtime / API / Dashboard / Widget Regression Inputs

- A later revalidation path would require fresh runtime, API, dashboard, and widget regression evidence for the exact later baseline.
- It would need a later reviewer to confirm that the later security baseline is not contradicted by new regressions or unexpected changes.
- This task performs no runtime, API, dashboard, or widget revalidation.

## Path Step 12: Data / Privacy / Provider / Copy Boundary Revalidation Inputs

- A later revalidation path would require fresh confirmation that data, privacy, provider, and copy boundaries still hold on the later baseline.
- It would need a later reviewer to confirm synthetic-only posture, no-customer-data posture, no-provider-live posture, and no unauthorized copy posture.
- This task revalidates none of those later boundaries.

## Path Step 13: Dependency / Package / Lockfile / Vulnerability Boundary Inputs

- A later revalidation path would require a fresh dependency and vulnerability-boundary review for the exact later baseline.
- It would need a later reviewer to confirm that package and lockfile changes, if any, are intentionally reviewed and safe.
- This task changes no package or lockfile and approves no dependency tree.

## Path Step 14: Environment / Deploy / Public Widget / Production Exclusion Inputs

- A later revalidation path would require fresh confirmation that no unauthorized deploy, public-widget activation, or production activation is being implied.
- It would need a later reviewer to confirm that environment boundaries remain default-deny unless separately approved.
- This task activates neither public widget nor production and executes no deploy.

## Path Step 15: Evidence Bundle / Traceability / Freshness Inputs

- A later revalidation path would require an explicit written evidence bundle with traceability to exact SHAs, runs, timestamps, and gate outcomes.
- It would need a later reviewer to confirm that evidence is fresh, exact, and not mixed with stale or unrelated artifacts.
- This task creates no later revalidation evidence bundle.

## Path Step 16: Failure / Red / Pending / Unavailable Gate Stop Inputs

- A later revalidation path would require explicit stop handling for red, pending, failed, unavailable, stale, contradictory, or fallback-only evidence.
- It would need a later reviewer to confirm that no blocked gate is reinterpreted as approval.
- This task performs no such later stop-decision execution.

## Path Step 17: Required Future Security Baseline Revalidation Artefact

- A later revalidation path would require an explicit written security-baseline revalidation artefact.
- It would need a later reviewer to confirm that the artefact names the exact later baseline, exact gate results, exact blockers, and exact residual limits.
- This task creates no such artefact.

## Path Step 18: Handoff To Authorization Reconsideration Path

- A later revalidation path would hand off only to a separate authorization-reconsideration path.
- It would need a later reviewer to confirm that security-baseline evidence is complete before any reconsideration begins.
- This task does not execute authorization reconsideration and does not grant authorization.

## Revalidation Path Evaluation Matrix

- Missing current `main` snapshot: blocking
- Missing fresh CI source-gate result: blocking
- Missing fresh production-context security audit: blocking
- Missing fresh Docker build result: blocking
- Missing fresh PostgreSQL isolation result: blocking
- Missing fresh authorization-matrix result: blocking
- Missing fresh security-boundary result: blocking
- Missing fresh sensitive scan result: blocking
- Missing diff / scope / gate evidence: blocking
- Missing written revalidation artefact: blocking
- Missing explicit human authorization statement: blocking
- Any stale, mixed, inferred, or fallback-only evidence without exact SHA traceability: blocking

## Required Future Security Baseline Revalidation Artefacts

- explicit written security-baseline revalidation artefact
- exact main snapshot and target SHA reference
- exact CI source-gate evidence
- exact production-context security-audit evidence
- exact Docker-build evidence
- exact PostgreSQL-isolation evidence
- exact authorization-matrix evidence
- exact security-boundary evidence
- exact sensitive-scan evidence
- exact diff / scope / gate evidence
- exact runtime / API / dashboard / widget regression evidence
- explicit dependency and vulnerability boundary note
- explicit stop-condition handling note
- explicit handoff reference to authorization reconsideration

## Non-Accepted Security Baseline Revalidation Signals

- PR merge
- CI PASS alone
- Security PASS alone
- Doku review
- chat message
- Rollenlabel ohne benannte Person
- Customer-Facing-Copy-Final-Approval-Pfad-Doku
- Provider-/No-Live-Pfad-Doku
- Data-Policy-/Synthetic-only-Pfad-Doku
- Environment-/Access-/Isolation-Pfad-Doku
- Scope-/Audience-/Purpose-Finalization-Pfad-Doku
- Audit-/Logging-/Retention-/DSAR-Pfad-Doku
- Credential-Expiry-/Revocation-Pfad-Doku
- Demo-URL-/Account-/Invitation-Pfad-Doku
- Demo-Access-Pfad-Doku
- External-Audience-Pfad-Doku
- Legal-/Privacy-/AVV-Pfad-Doku
- einmaliger alter CI-Run
- alter PR-Run ohne frischen Main-/Target-Snapshot
- gruener lokaler Check bei dirty Worktree
- gruener Check mit stale `origin/main`
- Combined Status leer ohne belastbare Check-Run-/UI-/Connector-Basis
- Fallback-Basis ohne identischen Squash-Diff
- technische Existenz von Tests, Scripts, oder Workflows
- interne technische Validierung
- generische Team-Abstimmung
- implizite Zustimmung
- unreviewed Prompt Output
- Screenshots / Recordings
- Sales Notes

## Invalid Security Baseline Revalidation Conditions

- fehlender aktueller `main` snapshot
- fehlender frischer CI-Run oder fehlende belastbare Check-Run-Basis
- Source gate fail/pending/unavailable ohne zulaessige Fallback-Basis
- Security audit fail/pending/unavailable ohne zulaessige Fallback-Basis
- Docker build fail/pending/unavailable ohne zulaessige Fallback-Basis
- PostgreSQL isolation fail/pending/unavailable ohne zulaessige Fallback-Basis
- Authorization matrix fail
- Security boundaries fail
- Sensitive scan fail
- Diff check fail
- Doc-only gate fail
- unexpected Runtime/API/Dashboard/Widget/Workflow/Package/Config/SQL/Migration/Deploy changes
- Kundendaten / Production-Daten / PII
- Secrets / Credentials / API keys
- Provider Calls / Live LLM / Embeddings / RAG
- DB Reads/Writes / Query Runner
- Copy Publication / External Communication
- Legal/Privacy/AVV claims without separate approval
- Authorization Record / Grant created without separate task
- dirty worktree used as evidence
- stale `origin/main` used as evidence
- unsupported fallback used as evidence
- missing owner / final approver / explicit human authorization statement
- any attempt to treat this path doc as authorization

## No Security Baseline Revalidation In This Task

- No security baseline revalidation
- No source gate revalidation
- No security audit revalidation
- No Docker build revalidation
- No PostgreSQL isolation revalidation
- No authorization matrix revalidation
- No security boundary revalidation
- No sensitive scan revalidation
- No dependency approval
- No runtime approval
- No authorization reconsideration
- No authorization grant
- No guided demo approval

## Not Authorized Until

- customer-facing-copy final-approval path remains on `main`
- provider / no-live path remains on `main`
- data-policy / synthetic-only path remains on `main`
- environment / access / isolation path remains on `main`
- scope / audience / purpose path remains on `main`
- audit / logging / retention / DSAR path remains on `main`
- credential expiry / revocation path remains on `main`
- demo URL / account / invitation path remains on `main`
- demo access path remains on `main`
- external audience path remains on `main`
- legal / privacy / AVV path remains on `main`
- explicit fresh security-baseline revalidation artefact exists
- explicit fresh exact-SHA CI evidence exists
- explicit human authorization statement exists

## Escalation / Decision Boundary

- Any later attempt to convert documentation into authorization requires a separate explicit authorization-reconsideration path.
- Any missing or contradictory security evidence remains blocking.
- Any claim that this task itself revalidated security is invalid.
- Any attempt to treat this task as deploy approval, provider approval, or customer-demo approval is invalid.

## Required Before Reconsideration

- fresh exact-SHA CI source gate
- fresh exact-SHA production-context security audit
- fresh exact-SHA Docker build
- fresh exact-SHA PostgreSQL isolation
- fresh exact-SHA authorization matrix
- fresh exact-SHA security boundaries
- fresh exact-SHA sensitive scan
- fresh exact-SHA diff / scope / gate assessment
- explicit written security-baseline revalidation artefact
- explicit human authorization statement

## Stop Criteria

- any gate red
- any gate pending without permitted waiting outcome
- any gate unavailable without permitted fallback basis
- any stale or mixed evidence basis
- any secret, credential, or sensitive data appearance
- any runtime, workflow, package, migration, SQL, config, or deploy change
- any attempt to skip written revalidation artefacts
- any attempt to infer authorization from CI or documentation alone

## Required Follow-up

- Next gate: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-SECURITY-BASELINE-REVALIDATION-PATH-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECONSIDERATION-PATH-1`

## Dependency / Security Baseline Boundary

- Dependency-path documentation is not dependency approval.
- Security-baseline-path documentation is not vulnerability approval.
- Security-baseline-path documentation is not a waiver for stale or failing future checks.

## No Raw Content / No Secret Boundary

- No raw logs
- No secrets
- No credentials
- No passwords
- No tokens
- No API keys
- No authorization records

## Runtime / Completion Boundary

- No runtime completion claim
- No API completion claim
- No dashboard completion claim
- No widget completion claim
- No guided-demo readiness claim

## Public Widget / Production Boundary

- No public-widget activation
- No production activation
- No deploy
- No live environment approval

## No Provider / No Live Answer Boundary

- No provider calls
- No live provider use
- No live LLM answers
- No embeddings
- No RAG
- No retrieval

## Persistence / Telemetry Boundary

- No DB reads
- No DB writes
- No Query Runner
- No persistence changes
- No telemetry changes
- No external telemetry use

## Known Limitations

- This path document is planning-only and cannot prove later security freshness.
- This path document does not replace a future exact-SHA security evidence bundle.
- This path document does not assign a named owner or final approver.

## Remaining Follow-up Fixes

- none in this task; later work is procedural, not implemented here

## Safety Boundaries

- internal-only
- documentation-only
- report-only
- no security revalidation executed
- no authorization reconsideration
- no authorization grant
- no customer demo approval
- no guided demo approval
- no public widget
- no production
- no provider-live
- no customer data
- no production data
- no PII
- no provider calls
- no DB reads
- no DB writes
- no Query Runner
- no secrets
- no passwords
- no credentials
