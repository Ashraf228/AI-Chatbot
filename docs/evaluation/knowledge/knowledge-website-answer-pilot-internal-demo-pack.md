# Knowledge Website Answer Pilot Internal Demo Pack

## Summary

- Audit date: Monday, August 3, 2026
- Baseline: `b6f3b27f1681e4ffb06483ec2ec828955f408b32`
- Scope decision: `internal_demo_pack_added`
- Added an internal demo pack for the mock-only website-answer runtime pilot
- The demo pack is internal-only, synthetic-only, and documentation-only
- No runtime code, dashboard code, widget code, migration, approval grant, persistence path, or deploy path was added
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1` established the internal mock-only runtime pilot path.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1` established a sanitized internal observability envelope.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-READINESS-1` established an internal review-readiness contract.
- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-REVIEW-CHECKLIST-1` established the internal operator review checklist.
- The pilot chain already had bounded evidence for internal mock review, but it did not yet have a single internal demo pack that told operators what can be demonstrated safely and what must remain denied.

## Scope Decision

- Variant A was selected: `internal_demo_pack_added`.
- Existing pilot, observability, readiness, checklist, evaluation, retrieval, attribution, and gate evidence are sufficient.
- No new runtime or service semantics are required.
- No test-only fixture is required because the existing reports and regression tests already cover the positive mock path and the denial families needed for the demo pack.
- The resulting pack remains a bounded internal reference, not a customer-facing demo artifact and not a go-live decision.

## Demo Pack Purpose

- The purpose is to document a safe internal demonstration of the existing website-answer runtime pilot.
- The pack shows:
  - what the internal mock-only pilot can prove
  - which prerequisites must already be satisfied
  - which positive internal scenarios are demonstrable
  - which blocked scenarios must remain visible
  - which safety boundaries still apply
- The pack does not approve customer demo, public widget use, provider-live use, production use, or real pilot use.

## Internal Audience

- Internal operators
- Internal developers
- Internal reviewers
- Internal security/process reviewers

The pack is not for customers, viewers, public users, or external demo recipients.

## Prerequisites

- Existing website-answer runtime pilot available
- Existing runtime gate available
- Existing answer evaluation available
- Existing retrieval verification available
- Existing source-attribution verification available
- Existing observability envelope available
- Existing operator-readiness contract available
- Existing operator-review checklist available
- Synthetic mock query input available
- Synthetic or pre-verified ready/indexed website-source evidence available
- No customer data required
- No production data required

## Synthetic Demo Data Boundary

- The demo pack is synthetic-only.
- It assumes internal mock inputs and existing bounded evidence only.
- No customer content, no production content, no credentials, and no provider secrets are used.
- No raw website page bodies, no raw retrieved chunks, and no copied production transcripts are required.
- No fake source attribution is allowed.
- No new crawling, no full-domain crawling, no sitemap crawling, no authenticated crawling, and no JavaScript-rendered collection are part of this pack.

## Positive Internal Mock Demo Flow

1. Start from the internal runtime-pilot path only.
2. Use `internal_admin_test` context with `answerMode = mock`.
3. Confirm the source is active, ready, indexed, and tenant/site scoped correctly.
4. Confirm retrieval verification is true.
5. Confirm source attribution verification is true.
6. Confirm the runtime gate decision is allow for the internal mock path only.
7. Confirm answer evaluation is answered and not blocked by insufficient evidence.
8. Surface the safe mock answer shape plus the sanitized observability, readiness, and checklist summaries.
9. Stop at internal operator review. No external share, no widget, no deploy, no production activation.

## Denied Demo Flows

- Public widget context denied
- Production/live context denied
- Provider-live mode denied
- Unknown context denied
- Missing runtime gate denied
- Missing answer evaluation denied
- Missing retrieval verification denied
- Missing source attribution denied
- Insufficient evidence denied
- Cross-tenant or cross-site mismatch denied
- Fake source attribution denied
- Non-ready or non-indexed source denied
- Customer demo denied
- Real pilot denied

## Expected Pilot Output

- Sanitized allow / deny decision
- Decision code and sanitized reason
- Mock answer text only for the valid internal allow path
- Verified source summary only
- No raw source payload
- No raw retrieved chunks
- No secrets
- No stack traces

## Expected Observability Output

- Sanitized runtime gate summary
- Sanitized answer-evaluation summary
- Retrieval verification summary
- Source-attribution verification summary
- Boundary summary
- Denial summary
- Safety summary
- No raw content
- No raw answer transcript expansion beyond the bounded mock answer

## Expected Operator Readiness Output

- `allowedFor = ["internal_operator_review"]`
- Internal review ready only when gate, evaluation, retrieval, attribution, and safety checks all pass
- Public widget remains blocked
- Production remains blocked
- Provider-live remains blocked
- Customer demo remains blocked
- Real pilot remains blocked

## Expected Operator Review Checklist Output

- Checklist limited to `internal_operator_review`
- Required checklist items remain explicit
- Customer-demo and production prerequisites remain unmet by design
- Safety boundaries remain explicit
- Missing evidence or scope mismatch keeps the checklist blocked

## Operator Runbook

1. Confirm the operator is reviewing an internal mock-only pilot artifact.
2. Confirm the evidence source is one of the approved pilot/readiness/observability/checklist reports or regression tests.
3. Confirm no provider keys, no live provider mode, and no production context are involved.
4. Confirm the positive path uses verified retrieval and verified source attribution.
5. Confirm blocked scenarios remain visible, especially public widget, production/live, provider-live, insufficient evidence, and cross-tenant denials.
6. Confirm the output remains sanitized and contains no raw content, no secrets, and no stack traces.
7. Record the result as internal review evidence only.
8. Stop. Do not convert this pack into a customer demo, guided demo approval, self-service path, or go-live approval.

## Evidence Matrix

| Evidence area | Existing source |
| --- | --- |
| Runtime pilot positive/negative flow | `docs/evaluation/conversation-engine/runs/knowledge-website-answer-runtime-pilot-1-report.md` |
| Runtime gate behavior | `docs/evaluation/knowledge/knowledge-website-answer-runtime-gate.md` |
| Answer evaluation behavior | `docs/evaluation/knowledge/knowledge-website-answer-evaluation.md` |
| Observability envelope | `docs/evaluation/conversation-engine/runs/knowledge-website-answer-pilot-observability-1-report.md` |
| Operator readiness | `docs/evaluation/conversation-engine/runs/knowledge-website-answer-pilot-operator-readiness-1-report.md` |
| Operator checklist | `docs/evaluation/conversation-engine/runs/knowledge-website-answer-pilot-operator-review-checklist-1-report.md` |
| Retrieval and attribution evidence | `apps/api/test/knowledge-retrieval.service.test.cjs`, `apps/api/test/website-answer-evaluation.service.test.cjs` |
| Dashboard regression guard | `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx` and regression batch |

## No Raw Content / No Secret Boundary

- No raw website content
- No raw retrieved chunks
- No raw provider responses
- No API keys
- No tokens
- No passwords
- No cookies
- No credentials
- No stack traces
- No customer data
- No production data

## Runtime / Completion Boundary

- No runtime readiness change
- No completion rule change
- No approval grant creation
- No approval API endpoint creation
- No side-effect delivery path
- No ticket, email, or webhook delivery

## Public Widget / Production Boundary

- Public widget remains blocked
- Production remains blocked
- No public route
- No viewer route
- No deploy path
- No production activation
- No enterprise-readiness claim

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No provider approval claim
- No customer-data approval claim
- No production approval claim

## Persistence / Telemetry Boundary

- No DB writes
- No demo-pack persistence
- No queue persistence
- No file persistence beyond this documentation/report artifact
- No external telemetry
- No third-party analytics sink

## Known Limitations

- The pack demonstrates internal mock review only.
- The pack does not prove customer-safe delivery.
- The pack does not prove provider-live readiness.
- The pack does not prove production readiness.
- The pack does not replace future guided-demo readiness review.
- The pack intentionally excludes screenshots and recordings.

## Remaining Follow-up Fixes

- Guided-demo readiness is still pending.
- Customer-facing demo enablement is still blocked.
- Provider-live, public-widget, and production activation remain blocked by design.

## Safety Boundaries

- Internal only
- Mock only
- Synthetic only
- Documentation only
- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No real pilot
- No guided customer demo approval
- No self-service demo approval
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No approval grants
- No external telemetry
- No persistence
- No screenshots
- No recordings
