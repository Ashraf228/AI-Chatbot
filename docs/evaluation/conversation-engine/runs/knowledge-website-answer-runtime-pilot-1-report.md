# Knowledge Website Answer Runtime Pilot 1 Report

## Summary

- Run ID: `knowledge-website-answer-runtime-pilot-1`
- Run type: `knowledge_website_answer_runtime_pilot`
- Scope decision: `website_answer_runtime_pilot_added`
- Internal website answer runtime pilot added: yes
- Internal mock runtime pilot added: yes
- Runtime gate enforced: yes
- Answer evaluation required for pilot: yes
- Retrieval required before pilot answer: yes
- Source attribution required before pilot answer: yes
- Public widget answer enabled: no
- Production answer runtime enabled: no
- Live provider calls: no
- Live LLM answers: no
- Live embeddings: no
- External RAG: no

## Scope Decision

- A safe internal mock-only website-answer runtime pilot is now available.
- The pilot integrates existing website answer evaluation with the runtime gate inside the admin-test-only runtime pilot path.
- The pilot does not create a public route and does not claim customer-facing readiness.

## Website Answer Runtime Pilot Model

- Internal service: `apps/api/src/knowledge-sources/website-answer-runtime-pilot.service.ts`
- Integrated into the existing conversation-engine runtime pilot path only
- Requires:
  - verified answer evaluation
  - verified retrieval
  - verified source attribution
  - runtime gate allow
  - internal admin-test context
  - mock-only answer mode
- Returns a structured pilot result with:
  - allow / deny decision
  - sanitized reason
  - internal mock answer text only on allow
  - runtime gate decision
  - answer evaluation result
  - verified source summary

## Pilot Inputs

- Tenant id
- Site id
- Optional source id
- Question
- Optional expected source identity fields
- Optional expected answer hints
- Explicit mock query embedding
- Runtime context
- Environment
- Actor role
- Answer mode

## Pilot Denials

- Missing or mismatched source scope: blocked
- Retrieval not verified: blocked
- Source attribution not verified: blocked
- Insufficient evidence: blocked
- Non-ready or non-indexed source: blocked
- Cross-tenant / cross-site / cross-source mismatch: blocked
- Public widget context: blocked
- Production/live context: blocked
- Unknown context or role: blocked
- Provider-live mode: blocked

## Internal Mock Pilot Allow Path

- Internal admin-test only
- Mock-only
- Verified answer evaluation required
- Verified retrieval required
- Verified source attribution required
- Runtime gate allow required
- No live provider path

## Runtime Gate Requirement

- The pilot calls the runtime gate before returning any answer.
- Gate denial suppresses the pilot answer.
- No direct answer bypass was added.

## Answer Evaluation Requirement

- The pilot calls the website answer evaluation before final answer output.
- Evaluation failure blocks the pilot answer.
- Insufficient evidence blocks the pilot answer.

## Retrieval Requirement

- Retrieval remains mandatory.
- Retrieval-empty or unverified outcomes remain blocked.
- No alternative retrieval path was added.

## Source Attribution Requirement

- Source attribution remains mandatory.
- Verified source id, URL, title, and domain remain required.
- Fake source attribution remains blocked.

## Runtime / Completion Boundary

- No runtime readiness change
- No completion rule change
- No approval grant creation
- No DB / SQL / query-runner side effects
- No ticket, email, or webhook delivery

## Public Widget / Production Boundary

- Public widget remains blocked
- Production runtime remains blocked
- No deploy path added
- No public route added
- No enterprise-ready claim added

## Still Blocked

- Guided customer demo: `still_blocked`
- Self-service customer demo: `blocked`
- Real pilot: `blocked`
- Provider/customer-data/production approval claims: none

## Safety Confirmation

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No approval API endpoints
- No approval grants
- No customer data
- No production data
- No credentials
- No passwords

## Checks

- build:api: PASS
- check:dashboard: PASS
- build:dashboard: PASS
- check:all: PASS
- website answer runtime pilot tests: PASS
- website answer runtime gate tests: PASS
- website answer evaluation tests: PASS
- website embedding ingest tests: PASS
- storage lookup tests: PASS
- provider gate regressions: PASS
- approval policy regressions: PASS
- retrieval tests: PASS
- source attribution tests: PASS
- completion rule tests: PASS
- provider no-call tests: PASS
- cross-tenant denial tests: PASS
- public widget denial tests: PASS
- DemoWorkspaceAgentBuilderCard focused test: PASS
- dashboard regression batch: PASS
- report JSON validation: PASS
- production-context audit: PASS
- authorization matrix: PASS
- security boundaries: PASS
- sensitive scan: PASS
- git diff --check: PASS

## Recommended Next Step

- Gate review: `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-EVALUATION-REPORT-1`
