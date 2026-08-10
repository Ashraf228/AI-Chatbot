# Knowledge Website Answer Pilot Guided Demo Named Owner Candidate Criteria

## Summary

- Audit date: Monday, August 10, 2026
- Baseline: `a8b607765d1b1fe3b369fec785d8440622891bac`
- Scope decision: `named_owner_candidate_criteria_documented`
- This task documents only internal criteria for a possible future named owner in the guided-demo authorization chain.
- This task names no real person.
- This task assigns no owner.
- This task assigns no final approver.
- This task closes no gap.
- This task executes no remediation.
- This task collects no new real evidence.
- This task creates no authorization record.
- This task validates no authorization record.
- This task creates no authorization audit event.
- This task creates no authorization grant.
- This task creates no approval grant.
- `named_owner_assigned = false`
- `named_owner_candidate_selected = false`
- `named_owner_assignment_executed = false`
- `named_approver_present = false`
- `final_approver_assigned = false`
- `authorization_record_created = false`
- `authorization_record_validation_executed = false`
- `authorization_record_valid = false`
- `authorization_granted = false`
- `authorization_decision = not_authorized`
- `evidence_complete = false`
- `evidence_gaps_closed = false`
- `gap_closure_executed = false`
- `remediation_executed = false`
- Guided customer demo remains `still_blocked`.
- Self-service customer demo remains `blocked`.
- Real pilot remains `blocked`.

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECORD-EVIDENCE-GAP-REMEDIATION-PLAN-1` documented the ordered gap-remediation workstreams while keeping every blocker open.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECORD-EVIDENCE-GAP-REVIEW-1` documented the critical blocker classes and confirmed that owner evidence is still missing.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECORD-EVIDENCE-MATRIX-1` documented which evidence classes exist and which are still absent.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECORD-VALIDATION-RULES-1` documented that no later authorization record can be valid without explicit owner and approver evidence.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECORD-DESIGN-1` documented the future authorization-record shape while keeping `authorization_record_status = not_created`.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-REMEDIATION-OWNER-ASSIGNMENT-1` documented role categories only and confirmed `named_owner_assigned = false`, `named_approver_present = false`, and `final_approver_assigned = false`.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-DECISION-1` documented `authorization_decision = not_authorized`.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-FINAL-READINESS-REVIEW-1` documented `final_readiness = not_ready_for_guided_customer_demo`.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-GATE-1` documented the deny-first gate and explicit blockers.
- Privacy/legal, customer-facing copy, environment, access, data-policy, governance, operator, observability, runtime, provider-approval, retrieval, source-attribution, Nanoid remediation, Next/PostCSS remediation, and CI workflow trigger fix artifacts already exist on `main`.
- Before this task, the chain documented owner-role categories and open owner-related blockers, but it did not yet define the explicit candidate criteria a later named owner would have to satisfy before any separate assignment task could even be considered.

## Scope Decision

- Variant A selected: `named_owner_candidate_criteria_documented`.
- The evidence-gap remediation plan, evidence-gap review, evidence matrix, validation rules, record design, authorization decision, final-readiness review, authorization gate, remediation owner-assignment matrix, and supporting governance/data/access/privacy/provider/security artifacts are present on `main`.
- Existing internal-only documentation is sufficient to document candidate criteria without selecting a candidate and without assigning a named owner.
- The output is documentation-only, report-only, internal-only, and non-executing.
- The output does not create approval, deploy, public-widget, production, provider-live, account, URL, password, invitation, or data-use paths.

## Purpose

- Define what a later named owner would have to be able to own, deny, coordinate, and escalate.
- Define which disqualifying conditions must block a later owner assignment.
- Define the minimum evidence that must exist before a real named owner could be assigned in a separate task.
- Define the boundary between a future named owner and a future final approver.
- Preserve the current default-deny posture while making the candidate criteria explicit.
- Do not assign a real person.
- Do not assign a real owner.
- Do not assign a final approver.
- Do not create or validate an authorization record.
- Do not authorize guided demo, customer demo, public widget, production, provider-live, customer data, or production data use.

## Evidence Gap Remediation Plan Dependency

- This document depends directly on `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-RECORD-EVIDENCE-GAP-REMEDIATION-PLAN-1`.
- Workstream 1 in that plan identified the named-owner gap as still open and explicitly separate from final-approver work.
- This document documents candidate criteria only. It does not close Workstream 1.
- This document does not replace the remediation plan, the evidence-gap review, or the owner-assignment matrix.
- If the remediation plan were absent from `main`, this task would be blocked.

## Named Owner Candidate Criteria Verdict

- Verdict: internal candidate criteria can be documented now without naming a person and without assigning an owner.
- `named_owner_candidate_criteria_documented = true`
- `named_owner_candidate_criteria_internal_only = true`
- `named_owner_candidate_criteria_report_only = true`
- `named_owner_assigned = false`
- `named_owner_candidate_selected = false`
- `named_owner_assignment_executed = false`
- `named_approver_present = false`
- `final_approver_assigned = false`
- `real_person_names_included = false`
- `contact_data_included = false`
- `authorization_record_created = false`
- `authorization_record_persisted = false`
- `authorization_record_validation_executed = false`
- `authorization_record_valid = false`
- `authorization_audit_event_created = false`
- `authorization_grant_created = false`
- `authorization_granted = false`
- `authorization_decision = not_authorized`
- `evidence_complete = false`
- `evidence_gaps_closed = false`
- `gap_closure_executed = false`
- `remediation_executed = false`
- Result: `criteria documented, no named owner assigned, authorization remains denied`.

## Candidate Criteria Principles

- Criteria documentation is not owner assignment.
- Owner readiness is not approval.
- Role labels are not acceptable substitutes for named-human accountability.
- Candidate suitability must remain explicit, reviewable, and bounded.
- Separation of duties remains required between named owner and final approver.
- Default-deny remains mandatory until a later explicit human authorization record exists.
- The owner role must preserve synthetic-only, internal-only, no-provider-live, no-public-widget, no-production, and no-customer-data boundaries.
- The owner role must be able to stop scope drift, not merely coordinate implementation.

## Candidate Status Legend

- `criteria_documented_only`: criteria are documented, but no assignment action exists.
- `candidate_not_selected`: no real person has been selected.
- `named_owner_not_assigned`: no real person has been assigned to the named-owner role.
- `requires_future_named_person`: any real assignment requires a later named human.
- `requires_explicit_acceptance`: a later candidate must explicitly accept role scope and accountability.
- `requires_separate_assignment_task`: the real assignment must occur in a later bounded task.
- `requires_conflict_review`: conflict and separation checks must be completed before assignment.
- `requires_final_approver_separation`: the owner role must stay distinct from the final-approver role unless a later explicit exception is separately approved.
- `must_not_be_treated_as_approval`: neither this document nor any internal review signal counts as approval.
- `not_authorized`: current guided-demo authorization state remains denied.

## Candidate Criteria Structure

Each criterion in this document contains:

- the boundary the future named owner must understand or control
- why the criterion matters to the authorization chain
- what later assignment evidence would have to exist
- what does not count as satisfying the criterion

Each criterion is evaluable in a later assignment task, but no real candidate is evaluated here.

## Criterion 1: Responsibility Scope

- A future named owner must be able to own the bounded guided-demo authorization scope end to end.
- The role must cover scope tracking, blocker tracking, evidence dependency tracking, and stop-boundary enforcement.
- A candidate who can only provide implementation labor without scope accountability is insufficient.

## Criterion 2: Decision Accountability Boundary

- A future named owner must accept explicit accountability for the owner side of the authorization chain.
- The role must be able to say "not ready", "not approved", and "stop" when required evidence is missing.
- A candidate who can only advise but cannot hold accountability for the owner side of the chain is insufficient.

## Criterion 3: Authority to Coordinate Remediation

- A future named owner must be able to coordinate later remediation workstreams across evidence, access, data, privacy/legal, provider, and environment dependencies.
- The role must be able to demand missing evidence and block incomplete closure attempts.
- A candidate who cannot coordinate cross-workstream remediation is insufficient.

## Criterion 4: Independence From Implementation-Only Role

- A future named owner must not be treated as "whoever built the feature".
- The role must remain broader than engineering execution and must be able to challenge implementation proposals.
- An implementation-only candidate without decision-boundary authority is disqualified.

## Criterion 5: Security Boundary Awareness

- A future named owner must understand the current deny-first gate and the security baseline.
- The role must be able to preserve Nanoid remediation, Next/PostCSS remediation, CI-gate health, and explicit default-deny boundaries.
- A candidate who interprets green CI or security checks as approval is disqualified.

## Criterion 6: Privacy / Legal / AVV Awareness

- A future named owner must understand that no legal/privacy/AVV approval exists today.
- The role must be able to require separate responsible-party privacy/legal review before any external audience path.
- A candidate who treats internal documentation as legal approval is disqualified.

## Criterion 7: Data Policy / Synthetic-Only Awareness

- A future named owner must preserve synthetic-only scope and reject customer data, production data, and PII without separate later approval.
- The role must understand that no customer-data or production-data approval exists.
- A candidate who would allow mixed, real, or unclear data without a separate approval chain is disqualified.

## Criterion 8: Provider / No-Live Boundary Awareness

- A future named owner must preserve the no-provider-live, no-live-LLM-answer, no-live-embedding, and no-external-RAG boundary.
- The role must understand that provider approval policy and embedding-gate boundaries remain default-deny.
- A candidate who assumes provider-live may be enabled by analogy or by technical availability is disqualified.

## Criterion 9: Access / Demo URL / Account Boundary Awareness

- A future named owner must preserve the "no access created" state until a separate later approval exists.
- The role must understand that no demo access, no demo URL, no viewer account, no demo account, no invitation, and no password flow is approved.
- A candidate who would allow access artifacts before explicit approval is disqualified.

## Criterion 10: Evidence / Audit / Retention Awareness

- A future named owner must understand that no explicit human authorization record exists and that evidence remains incomplete.
- The role must be able to distinguish documentation from closure evidence and must require explicit auditability, retention scope, expiry, and revocation evidence later.
- A candidate who accepts partial or implied evidence as closure is disqualified.

## Criterion 11: Ability to Maintain Default-Deny Posture

- A future named owner must be able to preserve `authorization_decision = not_authorized` until a valid later chain exists.
- The role must reject scope drift from "documented" or "reviewed" to "approved".
- A candidate who cannot maintain default-deny under time pressure is disqualified.

## Criterion 12: Escalation Responsibility

- A future named owner must know when to escalate to privacy/legal, security, access, environment, data-policy, provider, and final-approver roles.
- The role must be able to stop and escalate instead of making implicit approval calls.
- A candidate who acts outside escalation boundaries is disqualified.

## Criterion 13: Conflict / Disqualification Conditions

- A future named owner must pass conflict review and role-separation review.
- The role must not be merged silently with the final-approver role where separation is required.
- A candidate with unresolved conflict, self-approval pressure, or role overlap that weakens the gate is disqualified.

## Criterion 14: Required Acceptance Evidence For Future Assignment

- A future named owner must provide explicit acceptance of the bounded role in a later task.
- That later task must show named-human accountability, role acceptance, scope acknowledgment, boundary acknowledgment, and revocation/escalation awareness.
- A candidate without explicit acceptance evidence is not assignable.

## Criterion 15: Handoff To Final Approver Boundary

- A future named owner must understand that the role does not itself grant final approval.
- The owner role prepares or coordinates bounded evidence; the final approver grants or denies in a separate later chain.
- A candidate who blurs preparation with final approval is disqualified.

## Candidate Evaluation Matrix

| Criterion | Later evaluation question | Acceptable later evidence class | Current task status |
| --- | --- | --- | --- |
| Responsibility Scope | Can the candidate own the bounded guided-demo authorization scope? | explicit scope acceptance in a later assignment artifact | `criteria_documented_only` |
| Decision Accountability Boundary | Can the candidate hold owner-side accountability and deny when required? | explicit accountability statement | `candidate_not_selected` |
| Authority to Coordinate Remediation | Can the candidate coordinate cross-workstream remediation? | later remediation-coordination acceptance | `requires_future_named_person` |
| Independence From Implementation-Only Role | Is the candidate more than an implementation-only contributor? | later conflict and role review | `requires_conflict_review` |
| Security Boundary Awareness | Can the candidate preserve the security baseline and deny-first gate? | later security-boundary acceptance | `must_not_be_treated_as_approval` |
| Privacy / Legal / AVV Awareness | Can the candidate preserve the non-approved privacy/legal state? | later boundary acknowledgment | `not_authorized` |
| Data Policy / Synthetic-Only Awareness | Can the candidate reject real data without separate approval? | later synthetic-only acknowledgment | `requires_explicit_acceptance` |
| Provider / No-Live Boundary Awareness | Can the candidate preserve no-live-provider boundaries? | later provider-boundary acknowledgment | `not_authorized` |
| Access / Demo URL / Account Boundary Awareness | Can the candidate preserve no-access-created status? | later access-boundary acknowledgment | `requires_separate_assignment_task` |
| Evidence / Audit / Retention Awareness | Can the candidate distinguish documents from closure evidence? | later evidence and audit acknowledgment | `must_not_be_treated_as_approval` |
| Ability to Maintain Default-Deny Posture | Can the candidate keep the gate closed until explicit approval exists? | later default-deny acknowledgment | `not_authorized` |
| Escalation Responsibility | Can the candidate stop and escalate rather than infer approval? | later escalation-duty acceptance | `requires_explicit_acceptance` |
| Conflict / Disqualification Conditions | Is the candidate free of disqualifying conflict or role overlap? | later conflict review result | `requires_conflict_review` |
| Required Acceptance Evidence For Future Assignment | Is explicit role acceptance present? | later signed or explicitly recorded acceptance artifact | `requires_future_named_person` |
| Handoff To Final Approver Boundary | Can the candidate stay separate from final approval? | later handoff and separation acknowledgment | `requires_final_approver_separation` |

This matrix makes the criteria reviewable in a later task without evaluating any real candidate here.

## Disqualification Conditions

- Candidate is only an implementer without decision accountability.
- Candidate has no security-, privacy/legal-, or data-boundary responsibility awareness.
- Candidate cannot preserve synthetic-only, no-customer-data, no-production-data, or no-PII boundaries.
- Candidate cannot preserve no-provider-live, no-live-answer, and no-external-RAG boundaries.
- Candidate cannot preserve no-access-created, no-demo-URL, no-account, no-invitation, and no-password boundaries.
- Candidate cannot preserve no-public-widget, no-production, and no-deploy boundaries.
- Candidate cannot enforce default-deny until explicit later approval exists.
- Candidate would treat green docs, tests, security checks, or CI checks as approval.
- Candidate would merge named-owner and final-approver roles without a separate explicit separation decision.
- Candidate would allow customer data, production data, or PII without separate explicit approval.

## Required Future Assignment Artefact

Any real future owner assignment would require a separate explicit assignment artifact containing at least:

- named human identity
- explicit role label: named owner
- explicit role acceptance
- responsibility scope acknowledgment
- default-deny acknowledgment
- security-boundary acknowledgment
- privacy/legal/AVV non-approval acknowledgment
- data-policy synthetic-only acknowledgment
- provider no-live acknowledgment
- access / URL / account boundary acknowledgment
- evidence / audit / retention acknowledgment
- escalation boundary acknowledgment
- conflict declaration
- separation from final approver declaration
- assignment date and bounded audience/scope

This task creates none of those fields and no such artifact.

## Non-Accepted Owner Assignment Signals

The following do not count as owner assignment:

- role label without a real person
- internal documentation review
- test PASS
- security PASS
- team alignment without explicitly named human accountability
- chat message without formal assignment artifact
- PR merge
- draft copy
- UI status
- generic responsibility language without explicit acceptance

## No Owner Assignment In This Task

This is only an internal criteria document.

- No real owner is named.
- No real owner is assigned.
- No final approver is named.
- No real person is invented.
- No contact data is included.
- No gaps are closed.
- No remediation is executed.
- No new real evidence is collected.
- No customer data, no production data, and no PII are used.
- No raw logs, no screenshots, and no recordings are used.
- No authorization record is created.
- No authorization record is validated.
- No authorization audit event is created.
- No authorization grant is created.
- No approval grant is created.
- `named_owner_assigned = false`
- `named_owner_candidate_selected = false`
- `named_owner_assignment_executed = false`
- `named_approver_present = false`
- `final_approver_assigned = false`
- `real_person_names_included = false`
- `contact_data_included = false`
- `authorization_record_created = false`
- `authorization_record_persisted = false`
- `authorization_record_validation_executed = false`
- `authorization_record_valid = false`
- `authorization_audit_event_created = false`
- `authorization_grant_created = false`
- `authorization_granted = false`
- `authorization_decision = not_authorized`
- `evidence_complete = false`
- `evidence_gaps_closed = false`
- `gap_closure_executed = false`
- `remediation_executed = false`

## Not An Authorization Record / Not Authorized Until

This document is not an authorization record.

This document is not authorization.

The following remain not authorized until a later explicit chain exists:

- guided customer demo
- customer demo
- public widget
- production
- real pilot
- provider-live
- customer data
- production data
- demo access
- demo URL
- viewer accounts
- demo accounts
- invitations
- passwords

## Escalation / Decision Boundary

- No future owner assignment may be interpreted as final approval.
- No later authorization decision may advance without a separately named final approver.
- No privacy/legal path may advance without the responsible privacy/legal role.
- No customer-data, production-data, or PII path may advance without separate explicit approval.
- No provider-live path may advance without preserving the existing provider approval policy and embedding gate.
- No access, URL, account, invitation, or password path may advance without separate explicit approval.
- No public-widget, production, or deploy path may advance through this task at all.

## Required Before Reconsideration

Before any later reconsideration could even be reviewed, the following still remain required:

- named owner candidate criteria documented on `main`
- named final approver candidate criteria documented on `main`
- explicit human authorization record requirements
- explicit final audience and purpose definition
- explicit environment and isolation confirmation
- explicit access approval path
- explicit data-policy confirmation
- explicit privacy/legal/AVV review by the responsible party
- explicit customer-facing copy approval path
- explicit expiry, revocation, audit, and retention path
- green CI and security baseline
- no-customer-data proof
- no-production-data proof
- no-PII proof
- no-provider-live proof

## Stop Criteria

Any later follow-up must stop immediately if:

- a named owner is claimed without a separate assignment artifact
- a final approver is claimed without a separate assignment artifact
- approval is claimed from documentation, tests, CI, or security checks alone
- customer data, production data, or PII appears
- provider-live, public widget, production, deploy, or real pilot is proposed without separate approval
- demo access, demo URL, accounts, invitations, or passwords are proposed without separate approval
- legal/privacy/AVV approval is claimed without responsible-party evidence
- evidence closure is claimed without explicit closure evidence

## Required Follow-up

- Immediate next gate task after publish: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-NAMED-OWNER-CANDIDATE-CRITERIA-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-FINAL-APPROVER-CANDIDATE-CRITERIA-1`

## Dependency / Security Baseline Boundary

- This document depends on the existing authorization-record, final-readiness, authorization-gate, privacy/legal, copy, environment, access, data-policy, governance, operator, runtime, provider, Nanoid, Next/PostCSS, and CI workflow trigger artifacts already on `main`.
- This document does not modify the security baseline.
- This document does not widen any security exception or approval scope.

## No Raw Content / No Secret Boundary

- No raw logs
- No screenshots
- No recordings
- No secrets
- No credentials
- No real contact details
- No real names
- No customer content

## Runtime / Completion Boundary

- No runtime code changes
- No API changes
- No dashboard changes
- No widget changes
- No workflow changes
- No package or lockfile changes
- No migration or SQL changes
- No config or deploy changes

## Public Widget / Production Boundary

- Public widget remains blocked.
- Production remains blocked.
- No deploy is allowed by this document.
- No go-live claim is introduced.

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No provider-live approval claim

## Persistence / Telemetry Boundary

- No authorization record persistence
- No audit-event persistence
- No grant persistence
- No external telemetry
- No raw-content retention

## Known Limitations

- This document cannot identify a real named owner.
- This document cannot prove candidate suitability for any real person.
- This document cannot close the owner gap.
- This document cannot create a valid authorization chain.

## Remaining Follow-up Fixes

- Final approver candidate criteria remain undocumented in this task and are the next intended follow-up.
- No explicit named-owner assignment artifact exists.
- No explicit final-approver assignment artifact exists.
- No explicit human authorization record exists.
- No privacy/legal/AVV responsible-party approval exists.
- No external audience, access, URL, account, invitation, password, public-widget, production, provider-live, customer-data, or production-data approval exists.

## Safety Boundaries

- No deploy
- No public widget activation
- No production activation
- No enterprise approval
- No customer data
- No production data
- No PII
- No secrets
- No credentials
- No real names
- No real contacts
- No screenshots
- No recordings
- No raw logs
- No authorization record creation
- No authorization record validation
- No authorization audit event creation
- No authorization grant creation
- No approval grant creation
- No owner assignment
- No final approver assignment
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
