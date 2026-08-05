# Knowledge Website Answer Pilot Guided Demo Customer-Facing Copy Review Report

## Summary

- Run ID: `knowledge-website-answer-pilot-guided-demo-customer-facing-copy-review-1`
- Run type: `knowledge_website_answer_pilot_guided_demo_customer_facing_copy_review`
- Scope decision: `guided_demo_customer_facing_copy_review_documented`
- Added internal customer-facing copy review documentation for a possible later guided demo of the mock-only website-answer runtime pilot
- No customer-facing copy was approved, published, sent, or activated
- No website, dashboard, or widget copy was changed
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Scope Decision

- Variant A selected: `guided_demo_customer_facing_copy_review_documented`
- Existing governance, access-plan, data-policy, environment-decision, readiness, demo-pack, checklist, observability, runtime-gate, evaluation, retrieval, source-attribution, and security-baseline evidence was sufficient for a DOKU/REPORT-only copy review
- No runtime, API, dashboard, widget, migration, dependency, config, deploy, account, password, or approval change was required

## Copy Review Purpose

- Defines only which later customer-facing wording classes could be discussed safely
- Defines only which claims remain forbidden
- Defines only which disclaimers and approval steps would still be required
- Does not approve copy
- Does not publish copy
- Does not send external communication

## Copy Verdict

- Customer-facing copy review documented: yes
- Customer-facing copy approved: no
- Customer-facing copy published: no
- Customer-facing copy sent: no
- Email sent: no
- Website/dashboard/widget copy changed: no
- Guided demo executed or enabled: no
- Public widget or production enabled: no
- Customer-facing guided demo remains blocked

## Allowed Future Copy Principles

- Future copy must stay guided, supervised, synthetic-only, and mock-only unless separately approved
- Future copy must state no production, no public widget, no customer data, no production data, and no live provider usage
- Future copy must avoid guarantees and must preserve review/approval language
- Future copy must describe source-attribution and denial-path boundaries honestly

## Explicitly Prohibited Copy Claims

- No production-ready claim
- No public-widget-enabled claim
- No customer-demo-available claim
- No real-pilot-ready claim
- No live-provider-enabled claim
- No customer-data-used claim
- No production-data-approved claim
- No legal/privacy approval overclaim
- No credential, password, or demo-URL claim
- No guaranteed-correctness or guaranteed-attribution claim

## Required Safety Copy Elements

- Guided / supervised framing
- Synthetic-only and mock-only framing unless separately approved
- No production
- No public widget
- No customer data
- No production data
- No live provider
- No live embeddings
- No external RAG
- No access or demo URL created by this task
- Explicit privacy/legal/security review dependency
- Explicit authorization-gate dependency

## Audience / Channel Boundary

- No external audience in this task
- No email
- No website text
- No dashboard/widget release copy
- No sales mail
- No customer communication
- Future channels only after separate approval

## Terminology Boundary

- Compatible with existing wording boundaries from `DASHBOARD-P1-TERMINOLOGY-AND-HELP-COPY-1`
- `Interner Test` remains internal only
- `Review & Livegang` remains review-only, not release approval
- `oeffentliches Chatfenster` remains a blocked boundary
- `Technische Diagnose` remains diagnosis-only wording
- No wording that implies deploy, production, public widget, or provider-live

## Approval / Review Workflow

- Owner review required
- Technical review required
- Security review required
- Data/privacy review required
- Legal/AVV review required if any external audience is proposed
- Customer-facing copy approval required
- Environment decision, access plan, data policy, and explicit guided-demo authorization remain required

## Stop Criteria

- Stop on deploy/public-widget/production claims
- Stop on customer-demo-availability claims
- Stop on provider-live, customer-data, or production-data claims
- Stop on missing privacy/legal review
- Stop on missing approval chain
- Stop on fake source attribution
- Stop on red CI/security baseline

## Evidence Requirements

- Green CI/security gates
- Governance, access-plan, data-policy, environment-decision docs
- Internal demo pack
- Operator review checklist
- Operator readiness
- Observability evidence
- Runtime gate evidence
- Answer evaluation evidence
- Retrieval and source-attribution evidence
- Denial-path evidence
- No-customer-data and no-production-data proof
- Copy-approval and privacy/legal evidence before any external use

## Dependency / Security Baseline

- `SECURITY-NEXT-POSTCSS-ADVISORY-DRIFT-1` already remediated the prior Next/PostCSS drift
- Current baseline remains green
- This remediation does not grant demo, deploy, customer, or production approval
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS

## Still Blocked

- Guided customer demo
- Self-service customer demo
- Real pilot
- Public widget
- Production runtime
- Provider-live path
- Customer data
- Production data
- Real websites
- Real contacts
- PII
- Credentials and secrets
- Demo access, demo accounts, viewer accounts, invitations, passwords, demo URLs

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-CUSTOMER-FACING-COPY-REVIEW-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-PRIVACY-LEGAL-REVIEW-1`
