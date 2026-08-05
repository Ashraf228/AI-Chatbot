# Knowledge Website Answer Pilot Guided Demo Access Plan

## Summary

- Audit date: Tuesday, August 4, 2026
- Baseline: `458e0ca00ca6290726af7f3819df693f38e8ff20`
- Scope decision: `guided_demo_access_plan_documented`
- Added an internal access-planning baseline for a possible later guided demo of the mock-only website-answer runtime pilot
- This task is internal-only, documentation-only, report-only, non-executing, and non-persistent
- This task does not execute or approve a guided demo
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1` established the internal mock-only runtime pilot path.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1` established default-deny runtime gating for public, production, provider-live, and unknown contexts.
- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` established provider-free answer evaluation with retrieval and source-attribution verification requirements.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1` established a sanitized internal observability envelope.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-READINESS-1` established the internal readiness contract for operator review.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-REVIEW-CHECKLIST-1` established the explicit internal review checklist.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-INTERNAL-DEMO-PACK-1` documented the bounded internal demo pack.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-READINESS-1` documented internal readiness evidence for a possible later guided demo.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-GOVERNANCE-1` documented the governance baseline and approval chain prerequisites.
- `SECURITY-NEXT-POSTCSS-ADVISORY-DRIFT-1` remediated the previous Next/PostCSS security drift before this access-plan task.
- Before this task, governance and readiness were documented, but there was no dedicated access-planning baseline describing later access control, expiry, revocation, session boundaries, and account-creation prohibitions.

## Scope Decision

- Variant A was selected: `guided_demo_access_plan_documented`.
- Existing governance, readiness, runtime-gate, evaluation, retrieval, source-attribution, observability, operator-readiness, operator-checklist, provider-policy, and security-baseline evidence is sufficient for a documentation-only access plan.
- No runtime code, no API endpoint, no dashboard code, no widget code, no migration, no dependency change, no test fixture, and no approval grant are required.
- The result is an internal planning artifact only.
- It does not enable a guided demo, customer demo, self-service path, public widget, production runtime, provider-live path, or real pilot.

## Access Plan Purpose

- The purpose of this document is to define access-control requirements for a possible later guided demo of the existing mock-only website-answer runtime pilot.
- The purpose is to document who could later participate, under which constraints, and which gates must remain blocking until explicitly approved.
- The purpose is not to create access.
- The purpose is not to execute a guided demo.
- The purpose is not to approve a guided demo.
- The purpose is not to create viewer accounts, demo accounts, invitations, passwords, or demo URLs.
- The purpose is not to authorize customer-facing use, provider-live use, public-widget use, production use, or real-pilot use.

## Access Verdict

- Access plan documented: yes
- Guided demo approved: no
- Guided demo executed: no
- Customer-facing demo enabled: no
- Public widget enabled: no
- Production/live runtime enabled: no
- Real pilot enabled: no
- Viewer/public access enabled: no
- Demo access created: no
- Viewer accounts created: no
- Demo accounts created: no
- Invitations created: no
- Passwords created or changed: no
- Demo URLs published: no

Current verdict: `internal access planning documented, guided customer demo still blocked`.

## Allowed Future Access Concept

Only the following future access concept may be discussed under this document, and only as a later approval candidate:

- supervised internal operator session
- synthetic-only demo data
- mock-only answer mode
- explicit runtime gate still active
- retrieval and source-attribution verification still required
- read-only observation of bounded pilot output
- time-boxed access if ever approved
- revocable access if ever approved
- no public route
- no persistent external user
- no password sharing
- no side-effect delivery
- no provider-live mode

This is a future concept only. Nothing in this task creates or grants that access.

## Explicitly Blocked Access

The following access forms remain explicitly blocked:

- public viewer access
- customer self-service access
- external anonymous access
- public demo URL
- long-lived demo account
- viewer account creation
- demo account creation
- invitation creation
- shared password
- password reset or password change
- production access
- public widget access
- provider-live access
- access to customer data
- access to production data
- cross-tenant access
- cross-site access
- real pilot access

## Role / Permission Model

Possible later approval participants, if a separate execution track is ever opened:

- internal owner
- internal technical reviewer
- internal security reviewer
- internal data/privacy reviewer
- demo operator
- observer
- approver

This task does not assign or create those roles. It documents the future model only.

The following remain blocked:

- viewer/public role activation
- external customer role activation
- permission widening
- cross-tenant access
- account creation by this task
- password creation by this task
- invitation creation by this task

## Access Preconditions

Before any later access creation could even be reconsidered, all of the following remain required:

- guided demo governance approved
- guided demo access plan approved
- guided demo data policy approved
- guided demo environment decision approved
- customer-facing copy review completed
- privacy/legal review completed if any external audience is proposed
- security baseline remains green
- explicit guided-demo authorization gate passed
- access expiry defined
- revocation path defined
- audit/logging scope defined
- no customer data confirmed
- no production data confirmed
- no provider-live usage confirmed

No precondition above is satisfied by this task except documentation of the access-planning requirement itself.

## Session Boundary

If access were ever approved later, the session would still need to remain:

- time-boxed
- supervised
- revocable
- operator-controlled
- internal by default
- synthetic-only by default
- mock-only
- non-persistent unless separately approved
- no screenshots or recordings unless separately approved
- no exports
- no tickets, emails, or webhooks
- no provider-live mode
- no public widget path

This task does not create such a session.

## Audit / Logging Boundary

In this task:

- no logging was enabled
- no DB writes were added
- no telemetry was added
- no audit events were generated

For any later access path, the following would still be required as separate approval prerequisites:

- minimal audit scope
- sanitized logs only
- no raw content
- no secrets
- retention decision
- privacy/DSAR implications reviewed if external access is proposed

## Stop Criteria

Any later access-preparation task must stop immediately if any of the following occur:

- request to create viewer or demo access without approved access plan
- password creation requested
- demo URL requested
- invitation requested
- customer data present
- production data present
- real website use proposed without separate approval
- provider-live requested
- public widget requested
- production activation requested
- deploy requested
- screenshot or recording requested without approval
- dependency or security drift turns red
- Source gate, Security audit, Docker build, or PostgreSQL isolation is failing for the relevant change
- missing privacy/legal review where external access is proposed
- missing access-plan approval
- missing demo data policy
- missing customer-facing copy review
- missing approval chain
- unknown role or unknown context
- cross-tenant request
- fake source attribution

## Evidence Requirements

Before any later access creation could be reconsidered, all of the following evidence categories must exist and remain green:

- governance documentation
- internal demo pack
- operator review checklist
- operator readiness
- observability evidence
- runtime gate evidence
- answer evaluation evidence
- retrieval evidence
- source-attribution evidence
- denial-path evidence
- demo data policy
- access approval evidence
- expiry and revocation evidence
- dependency and security baseline evidence

## Required Follow-up

Separate follow-up work remains required before access creation could be considered:

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-DATA-POLICY-1`
- guided demo environment decision
- customer-facing copy review
- privacy/legal review if external audience or external data is ever proposed
- explicit guided-demo authorization gate
- access implementation design only after explicit approval
- continued security-baseline monitoring after Next/PostCSS remediation

## Dependency / Security Baseline Boundary

- The prior Next/PostCSS advisory drift was remediated before this task resumed.
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- That remediation does not imply guided-demo approval, deploy approval, customer-data approval, or production approval.
- The security baseline must remain green before any future access-creation work can proceed.

## No Raw Content / No Secret Boundary

- No raw website content
- No raw retrieved chunks
- No raw provider output
- No secrets
- No credentials
- No passwords
- No tokens
- No cookies
- No stack traces
- No customer data
- No production data
- No screenshots
- No recordings

## Runtime / Completion Boundary

- No runtime readiness was changed.
- No completion rules were changed.
- No approval grant was created.
- No approval API endpoint was added.
- No ticket, email, or webhook path was triggered.
- No go-live or customer-ready claim was added.

## Public Widget / Production Boundary

- Public widget remains blocked.
- Production answer runtime remains blocked.
- No public route was added.
- No viewer route was added.
- No deploy path was added.
- No production activation was added.
- No enterprise-readiness claim was added.
- Guided customer demo remains `still_blocked`.
- Self-service demo remains `blocked`.
- Real pilot remains `blocked`.

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No provider approval claim
- No customer-data approval claim
- No production approval claim
- No enterprise approval claim

## Persistence / Telemetry Boundary

- No DB writes
- No access-plan persistence
- No queue persistence
- No new file persistence beyond this documentation/report artifact
- No external telemetry
- No third-party analytics sink

## Known Limitations

- There is still no guided-demo execution path.
- There is still no viewer or demo account model.
- There is still no approved demo URL model.
- There is still no approved password or invitation model.
- There is still no customer-facing demo authorization.
- There is still no provider-live path.
- There is still no real-pilot path.
- This document is planning-only and does not prove external readiness.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-DATA-POLICY-1`
- guided demo environment decision
- customer-facing copy review
- privacy/legal review if external access is proposed
- explicit guided-demo authorization gate
- later access implementation design only after approval

## Safety Boundaries

- Documentation only
- Internal only
- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No credentials
- No password creation or change
- No viewer or demo account creation
- No invitation creation
- No demo URL creation
- No DB_READ_ONLY_AUDIT
- No query runner
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No screenshots or recordings
- No external telemetry
- No access-plan persistence
- No provider approval claimed
- No customer-data approval claimed
- No production approval claimed
- No enterprise approval claimed
