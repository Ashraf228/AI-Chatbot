# Knowledge Website Answer Pilot Guided Demo Data Policy Report

## Summary

- Run ID: `knowledge-website-answer-pilot-guided-demo-data-policy-1`
- Run type: `knowledge_website_answer_pilot_guided_demo_data_policy`
- Scope decision: `guided_demo_data_policy_documented`
- Added internal data-policy documentation for a possible future guided demo of the mock-only website-answer runtime pilot
- This task does not execute or approve a guided demo
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Scope Decision

- Variant A selected: `guided_demo_data_policy_documented`
- Doku-/Report-only
- No runtime, API, dashboard, widget, migration, dependency, or fixture change
- No accounts, passwords, invitations, or demo URLs created

## Data Policy Purpose

- Document internal data-policy purpose and later approval boundaries
- Document allowed synthetic-only data classes
- Document prohibited customer, production, real-website, PII, and secret classes
- Keep customer-facing, provider-live, public-widget, and production paths blocked

## Data Verdict

- Data policy documented: yes
- Guided demo approved: no
- Guided demo executed: no
- Customer-facing demo enabled: no
- Public widget enabled: no
- Production/live runtime enabled: no
- Real pilot enabled: no
- Customer data allowed: no
- Production data allowed: no

## Allowed Synthetic Data

- Synthetic website titles and summaries
- Synthetic domains and URLs
- Synthetic questions
- Synthetic answers
- Synthetic source-attribution records
- Synthetic denial-path examples

## Explicitly Prohibited Data

- Customer data
- Production data
- Real websites and domains
- Real contacts, tickets, emails, or webhook payloads
- PII
- Credentials, secrets, tokens, cookies, or auth headers
- Screenshots and recordings
- Raw provider output
- Live embeddings
- Fake source attribution

## Data Source Rules

- Synthetic-only default
- Fixture-only or generated-only source references
- No live crawling
- No authenticated crawling
- No full-domain crawling
- No sitemap crawling
- No JavaScript rendering
- No production exports
- No external provider transfer

## PII / Secret Handling

- No PII
- No secrets
- No credentials
- No contact data
- No raw logs
- Sanitized evidence only
- Stop immediately if PII, secrets, customer data, or production data appears

## Source Attribution Policy

- Attribution remains required even in synthetic demo context
- Source ID/title/domain/URL must stay internally consistent
- Fake source attribution remains blocked
- Real source attribution remains blocked without separate approval chain

## Retention / Logging / Audit Boundary

- No logging enabled by this task
- No DB writes
- No telemetry
- No audit events generated
- Future path would still require retention, logging-scope, and privacy review decisions

## Data Review Workflow

- Data owner review required
- Technical review required
- Security review required
- Privacy/legal review required for any external audience
- Synthetic-only verification required
- No-customer-data verification required
- No-production-data verification required
- Source-attribution review required
- Denial-path review required
- Final authorization gate required

## Stop Criteria

- Customer or production data appears
- Real website or real domain requested
- Real contact, email, ticket, log, or webhook present
- PII, secret, token, or credential present
- Provider-live requested
- Public widget or deploy requested
- Screenshot or recording requested without approval
- Source attribution cannot be verified
- Fake source attribution detected
- Security baseline red
- Missing privacy/legal review, data-policy approval, access approval, environment decision, or approval chain
- Unknown role/context or cross-tenant request

## Evidence Requirements

- Governance documentation
- Access plan
- Data policy
- Internal demo pack
- Operator review checklist
- Operator readiness
- Observability evidence
- Runtime gate evidence
- Answer evaluation evidence
- Retrieval and source-attribution evidence
- Denial-path evidence
- Synthetic-only / no-customer-data / no-production-data proof
- Dependency/security baseline evidence

## Dependency / Security Baseline

- Next/PostCSS advisory drift was remediated before this task
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- Remediation does not imply guided-demo, deploy, customer-data, or production approval

## Still Blocked

- Guided customer demo: `still_blocked`
- Self-service customer demo: `blocked`
- Real pilot: `blocked`
- Public widget: `blocked`
- Production runtime: `blocked`
- Provider-live: `blocked`
- Demo accounts, viewer accounts, invitations, demo URLs, and passwords: `blocked`

## Recommended Next Step

- Immediate next task: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-DATA-POLICY-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-ENVIRONMENT-DECISION-1`
