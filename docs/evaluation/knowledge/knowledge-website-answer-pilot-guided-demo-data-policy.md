# Knowledge Website Answer Pilot Guided Demo Data Policy

## Summary

- Audit date: Wednesday, August 5, 2026
- Baseline: `1fc7de5749b39d0510d35b4ebdba5b8a9436fa5d`
- Scope decision: `guided_demo_data_policy_documented`
- Added an internal data-policy baseline for a possible later guided demo of the mock-only website-answer runtime pilot
- This task is internal-only, synthetic-only, documentation-only, report-only, and non-executing
- This task does not execute or approve a guided demo
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1` established the internal mock-only runtime pilot path.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1` established the deny-first runtime boundary for public, production, and provider-live contexts.
- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` established provider-free answer evaluation with retrieval and source-attribution verification.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1` established the sanitized internal observability envelope.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-READINESS-1` established the internal operator-readiness contract.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-REVIEW-CHECKLIST-1` established the explicit internal review checklist.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-INTERNAL-DEMO-PACK-1` documented the bounded internal demo pack.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-READINESS-1` documented internal readiness evidence for a possible later guided demo.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-GOVERNANCE-1` documented the governance baseline and approval-chain prerequisites.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-ACCESS-PLAN-1` documented the later access-planning boundary.
- `SECURITY-NEXT-POSTCSS-ADVISORY-DRIFT-1` remediated the prior Next/PostCSS drift before this task.
- Before this task, governance, readiness, and access planning existed, but there was no dedicated internal data policy defining allowed synthetic data, forbidden data, PII/secret boundaries, source-attribution rules, retention/logging constraints, review requirements, and stop criteria for any future guided demo preparation.

## Scope Decision

- Variant A was selected: `guided_demo_data_policy_documented`.
- Existing governance, readiness, access-plan, runtime-gate, evaluation, retrieval, source-attribution, observability, operator-readiness, operator-checklist, provider-policy, and security-baseline evidence is sufficient for a documentation-only data policy.
- No runtime code, no API endpoint, no dashboard code, no widget code, no migration, no dependency change, and no test fixture are required.
- The result is an internal policy artifact only.
- It does not enable a guided demo, customer demo, self-service path, public widget, production runtime, provider-live path, or real pilot.

## Data Policy Purpose

- The purpose of this document is to define internal data rules for a possible later guided demo of the existing mock-only website-answer runtime pilot.
- The purpose is to document what data classes could later be considered, which data classes remain forbidden, and which reviews and gates must remain blocking until explicitly approved.
- The purpose is not to authorize data use.
- The purpose is not to execute a guided demo.
- The purpose is not to approve a guided demo.
- The purpose is not to create or persist fixtures in production systems.
- The purpose is not to approve customer-facing use, provider-live use, public-widget use, production use, or real-pilot use.

## Data Verdict

- Data policy documented: yes
- Data policy approved for execution: no
- Guided demo approved: no
- Guided demo executed: no
- Customer-facing demo enabled: no
- Public widget enabled: no
- Production/live runtime enabled: no
- Real pilot enabled: no
- Customer data allowed: no
- Production data allowed: no
- Real websites allowed: no
- Real contacts allowed: no
- PII allowed: no
- Secrets or credentials allowed: no

Current verdict: `internal data policy documented, guided customer demo still blocked`.

## Allowed Synthetic Data

Only the following future data concept may be discussed under this document, and only as a later approval candidate:

- fully synthetic website titles
- fully synthetic page summaries
- fully synthetic source domains using synthetic or reserved-example patterns
- fully synthetic URLs mapped to synthetic fixtures only
- fully synthetic user questions
- fully synthetic assistant answers
- fully synthetic source-attribution records
- fully synthetic denial cases
- fully synthetic boundary-verification evidence

This task does not create those fixtures. It documents the allowed class only.

## Explicitly Prohibited Data

The following data remains explicitly prohibited:

- customer data
- production data
- real websites
- real customer domains
- real contacts
- real tickets
- real emails
- real webhook payloads
- logs containing customer or user data
- PII or personal data
- credentials
- secrets
- API keys
- tokens
- cookies
- auth headers
- screenshots
- recordings
- raw provider output
- live embeddings
- raw website content from real sources
- fake source attribution
- any data not explicitly synthetic

## Data Source Rules

- Synthetic-only is the default.
- Any future source must be generated or fixture-only.
- Source title, domain, and URL must remain synthetic or use reserved example-style placeholders.
- No live crawling.
- No authenticated crawling.
- No full-domain crawling.
- No sitemap crawling.
- No JavaScript rendering.
- No customer-provided documents.
- No production exports.
- No external provider transfer.
- No real public website ingestion without a separate approval chain.

## PII / Secret Handling

- PII is not allowed.
- Secrets are not allowed.
- Credentials are not allowed.
- Tokens, cookies, and auth headers are not allowed.
- Contact data is not allowed.
- Raw logs are not allowed.
- Stack traces with sensitive data are not allowed.
- Evidence and reports must remain sanitized.
- Any future preparation step must stop immediately if PII, secrets, customer data, or production data appears.

## Source Attribution Policy

- Source attribution is required even for a synthetic demo concept.
- Source attribution must remain internally consistent.
- Source ID, title, domain, and URL must map to the same synthetic fixture.
- Fake source attribution remains blocked.
- Real source attribution remains blocked until data policy, governance, access, and environment approvals all exist.

## Retention / Logging / Audit Boundary

In this task:

- no logging was enabled
- no DB writes were added
- no telemetry was added
- no audit events were generated
- no retention rule was activated

For any later data-preparation path, the following remain separate prerequisites:

- retention decision
- sanitized logs only
- no raw content logging
- no PII
- no secrets
- DSAR/privacy review if any external access is proposed
- audit scope defined before access creation

## Data Review Workflow

Before any later guided-demo data preparation could be reconsidered, the following remain required:

- data owner review
- technical review
- security review
- privacy/legal review if any external audience is proposed
- synthetic-only verification
- no-customer-data verification
- no-production-data verification
- source-attribution review
- denial-path review
- final authorization gate

No review step above is granted by this task.

## Stop Criteria

Any future data-preparation task must stop immediately if any of the following occur:

- customer data present
- production data present
- real website requested
- real domain requested
- real contact, ticket, email, log, or webhook present
- PII present
- secret, token, or credential present
- provider-live requested
- public widget requested
- deploy requested
- screenshot or recording requested without separate approval
- source attribution cannot be verified
- fake source attribution detected
- dependency or security drift turns red
- missing privacy/legal review for external access
- missing data-policy approval
- missing access approval
- missing demo environment decision
- missing approval chain
- unknown role or unknown context
- cross-tenant request

## Evidence Requirements

Before any later data use could be reconsidered, all of the following evidence categories must exist and remain green:

- green CI/security gates
- guided-demo governance documentation
- guided-demo access plan
- guided-demo data policy
- internal demo pack
- operator review checklist
- operator readiness
- observability evidence
- runtime gate evidence
- answer evaluation evidence
- retrieval evidence
- source-attribution evidence
- denial-path evidence
- synthetic-only proof
- no-customer-data proof
- no-production-data proof
- data approval evidence
- dependency/security baseline evidence

## Required Follow-up

Separate follow-up work remains required before any possible later data usage could be reconsidered:

- Guided Demo Environment Decision
- Customer-facing Copy Review
- Privacy / Legal / AVV review if any external audience or external data is ever proposed
- Explicit Guided Demo Authorization Gate
- Demo Data Fixture Design only after policy approval
- Security baseline watch after Next/PostCSS remediation

## Dependency / Security Baseline Boundary

- `SECURITY-NEXT-POSTCSS-ADVISORY-DRIFT-1` completed before this data-policy task.
- The current baseline after that remediation is `next@16.3.0 -> postcss@8.5.23`.
- `npm run security:audit:production-contexts` is green on this baseline.
- This remediation removes a prior technical blocker for continuing documentation work.
- This remediation does not approve a guided demo.
- This remediation does not approve deploy, production, public widget, provider-live usage, customer data, or enterprise rollout.

## No Raw Content / No Secret Boundary

- No raw website content
- No raw retrieved chunks
- No raw provider output
- No secrets
- No credentials
- No passwords
- No tokens
- No cookies
- No customer data
- No production data
- No real contact data

## Runtime / Completion Boundary

- No runtime readiness change
- No completion-rule change
- No approval API endpoint
- No approval grant
- No ticket, email, or webhook delivery path
- No runtime activation

## Public Widget / Production Boundary

- Public widget remains blocked
- Production remains blocked
- No public route
- No viewer route
- No deploy path
- No production activation
- No enterprise-ready claim

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
- No data-policy persistence
- No queue persistence
- No external telemetry
- No third-party analytics sink

## Known Limitations

- This document defines internal policy only.
- It does not prove customer-safe execution.
- It does not prove provider-live readiness.
- It does not prove production readiness.
- It does not create synthetic fixtures.
- It intentionally excludes screenshots, recordings, demo URLs, accounts, and passwords.

## Remaining Follow-up Fixes

- Guided customer demo remains `still_blocked`.
- Self-service customer demo remains `blocked`.
- Real pilot remains `blocked`.
- Public widget, production, provider-live, and deploy paths remain blocked by design.
- Environment approval, customer-facing copy review, privacy review, and explicit authorization remain open prerequisites.

## Safety Boundaries

- Internal only
- Synthetic only
- Documentation only
- Report only
- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No real websites
- No real contacts
- No PII
- No secrets
- No credentials
- No passwords
- No demo accounts
- No viewer accounts
- No invitations
- No demo URLs
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No approval grants
- No external telemetry
- No persistence
- No screenshots
- No recordings
