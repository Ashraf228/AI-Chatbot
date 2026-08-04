# Knowledge Website Answer Pilot Guided Demo Governance

## Summary

- Audit date: Tuesday, August 4, 2026
- Baseline: `2b73a07a8266903be581af10ec364a9778182e31`
- Scope decision: `guided_demo_governance_documented`
- Added an internal governance baseline for a possible later guided demo of the mock-only website-answer runtime pilot
- This task is governance-only, documentation-only, report-only, non-executing, and internal-only
- Guided demo is not executed and not approved by this task
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1` established the internal mock-only runtime pilot path.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1` established deny-first gating for public, production, unknown, and provider-live contexts.
- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` established provider-free answer evaluation with retrieval and source-attribution verification.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1` established the sanitized internal observability envelope.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-READINESS-1` established the internal readiness verdict for operator review.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-REVIEW-CHECKLIST-1` established the explicit internal review checklist.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-INTERNAL-DEMO-PACK-1` documented the bounded internal demo pack.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-READINESS-1` documented that readiness evidence exists for internal assessment only.
- `SECURITY-NEXT-POSTCSS-ADVISORY-DRIFT-1` remediated the prior Next/PostCSS drift before this task resumed.
- Before this task, guided-demo readiness was documented, but no dedicated governance baseline yet defined who may approve a later guided demo, under which boundaries, and which stop criteria must remain hard-blocking.

## Scope Decision

- Variant A was selected: `guided_demo_governance_documented`.
- Existing readiness, demo-pack, runtime-gate, evaluation, retrieval, source-attribution, observability, operator-readiness, operator-checklist, provider-policy, and security-remediation artifacts provide enough evidence for governance documentation only.
- No runtime code, no API endpoint, no dashboard code, no widget code, no migration, no dependency change, no approval grant, and no test fixture are required.
- The result is an internal governance baseline only.
- It does not enable a guided demo, customer demo, self-service path, public widget, production runtime, provider-live path, or real pilot.

## Governance Purpose

- The purpose of this document is to define governance rules for a possible later guided demo of the existing mock-only website-answer runtime pilot.
- The purpose is not to authorize, execute, activate, or operationalize a guided demo.
- The purpose is not to approve external/customer-facing usage.
- The purpose is not to approve provider-live usage, live LLM answers, live embeddings, external RAG, public widget activation, production activation, or deploy behavior.
- The purpose is to make later approval work explicit, bounded, reviewable, and stop-capable.

## Governance Verdict

- Governance baseline documented: yes
- Guided demo approved: no
- Guided demo executed: no
- Guided customer demo enabled: no
- Self-service demo enabled: no
- Public widget enabled: no
- Production answer runtime enabled: no
- Provider-live enabled: no
- Real pilot enabled: no
- Account creation enabled: no
- Demo access enabled: no
- Viewer/public access enabled: no

Current verdict: `internal governance documented, customer-facing guided demo still blocked`.

## Decision Gates

Any future guided demo preparation must pass separate explicit gates for all of the following:

- demo objective approved
- target audience approved
- demo scope approved
- synthetic-only data scope approved
- no-customer-data confirmation approved
- no-production-data confirmation approved
- environment boundary approved
- access model approved
- operator responsibility approved
- customer-facing copy review approved
- privacy/legal review completed if any external audience or external data exposure is proposed
- security baseline remains green
- runtime/pilot evidence remains green
- no-public-widget confirmation remains in effect unless separately overridden by a different task
- no-production confirmation remains in effect unless separately overridden by a different task
- no-provider-live confirmation remains in effect unless separately overridden by a different task
- explicit guided-demo authorization recorded

No gate above is granted by this task.

## Roles / Responsibilities

Possible internal roles for any later guided demo governance chain:

- Owner
- Technical reviewer
- Security reviewer
- Data/privacy reviewer
- Demo operator
- Final approver
- Internal observer

Required role constraints:

- no viewer/public role
- no external customer role
- no automatic approval role
- no account-creation responsibility in this task
- no password-generation responsibility in this task
- no deploy responsibility in this task

## Demo Scope Rules

Only the following future concept scope is governable under this baseline:

- internal-only guided walkthrough
- synthetic-only inputs
- mock-only answer mode
- explicit scenario list
- visible denial-path explanation
- retrieval/source-attribution explanation
- observability/readiness/checklist walkthrough
- operator-reviewed evidence discussion

The following remain out of scope and blocked without separate approval:

- real customer data
- production data
- real external customer participation
- real websites without separate approval
- live provider calls
- live LLM answers
- live embeddings
- external RAG
- public widget
- production runtime
- real pilot
- deploy
- account creation
- screenshots
- recordings
- fake source attribution

## Data Governance

- Synthetic-only default
- No customer data
- No production data
- No real contacts
- No secrets
- No credentials
- No passwords
- No screenshots
- No recordings
- No raw logs
- No raw website content
- No raw retrieved chunks
- No provider data transfer
- No external telemetry
- No retention/logging activation through this task

If any future guided demo ever proposes external participants or non-synthetic data, privacy/legal review becomes a separate prerequisite rather than an implied allowance.

## Access Governance

- No viewer accounts
- No demo accounts
- No invitations
- No passwords
- No password resets
- No demo URLs
- No public routes
- No viewer routes
- No external access
- No role widening
- Internal operator/reviewer only

This task documents access boundaries only. It creates no access path.

## Stop Criteria

Any future guided-demo preparation must stop immediately if any of the following become true:

- customer data present
- production data present
- external audience proposed without review
- real website use proposed without separate approval
- provider-live requested
- public widget requested
- production activation requested
- deploy requested
- screenshots or recordings requested without separate approval
- security baseline drifts red
- Source gate, Security audit, Docker build, or PostgreSQL isolation is failing for the relevant change
- required privacy/legal review missing where external access is proposed
- access plan missing
- demo data policy missing
- customer-facing copy review missing
- approval chain missing
- unknown actor role or environment
- fake source attribution detected

## Evidence Requirements

Before any later guided demo could even be reconsidered, all of the following evidence categories must exist and remain green:

- green CI/security gates
- internal demo pack
- operator review checklist
- operator readiness
- observability evidence
- runtime gate evidence
- answer evaluation evidence
- retrieval evidence
- source-attribution evidence
- denial-path evidence
- safety-boundary evidence
- customer-facing copy review
- access/data governance evidence
- dependency/security baseline evidence
- explicit approval evidence

## Required Follow-up

Separate follow-up work remains required before any possible guided demo could be reconsidered:

- Guided Demo Access Plan
- Demo Data Policy
- Customer-facing Copy Review
- Demo Environment Decision
- Privacy / Legal / AVV review if external audience or external data ever enters scope
- Explicit Guided Demo Authorization Gate
- Security baseline watch after Next/PostCSS remediation

## Dependency / Security Baseline Boundary

- `SECURITY-NEXT-POSTCSS-ADVISORY-DRIFT-1` completed before this governance task resumed.
- The current baseline after that remediation is `next@16.3.0 -> postcss@8.5.23`.
- `npm run security:audit:production-contexts` is green on this baseline.
- This remediation removes a prior technical blocker for governance continuation.
- This remediation does not approve a guided demo.
- This remediation does not approve deploy, production, public widget, provider-live usage, customer data, or enterprise rollout.

## No Raw Content / No Secret Boundary

- No raw website content
- No raw chunks
- No raw provider output
- No secrets
- No credentials
- No passwords
- No tokens
- No cookies
- No stack traces
- No customer data
- No production data

## Runtime / Completion Boundary

- No runtime readiness change
- No completion-rule change
- No approval API endpoints
- No approval grants
- No delivery side effects
- No tickets
- No emails
- No webhooks
- No runtime activation

## Public Widget / Production Boundary

- Public widget remains blocked
- Production remains blocked
- No public route
- No viewer route
- No deploy path
- No production activation
- No enterprise-ready claim
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`

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
- No governance persistence
- No queue persistence
- No file persistence beyond this documentation/report artifact
- No external telemetry
- No third-party analytics sink

## Known Limitations

- This is governance documentation only.
- This document does not prove customer-safe delivery.
- This document does not prove provider-live readiness.
- This document does not prove production readiness.
- This document does not create a guided-demo runbook by itself.
- This document intentionally excludes accounts, invitations, URLs, screenshots, and recordings.

## Remaining Follow-up Fixes

- Guided demo access remains undefined until a separate access-plan task completes.
- Guided demo data policy remains undefined until a separate data-policy task completes.
- Customer-facing copy remains unapproved until a dedicated review task completes.
- External audience handling remains blocked until privacy/legal review exists where needed.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Safety Boundaries

- Internal only
- Governance only
- Documentation only
- Report only
- No demo execution
- No live provider calls
- No live answers
- No live embeddings
- No external RAG
- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No account creation
- No passwords
- No viewer access
