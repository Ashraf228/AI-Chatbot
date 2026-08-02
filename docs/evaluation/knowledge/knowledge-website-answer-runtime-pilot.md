# Knowledge Website Answer Runtime Pilot

## Summary

- Audit date: Sunday, August 2, 2026
- Baseline: `6db1d2421b2929fa0ec06e067cd5ce973cd45576`
- Scope decision: `website_answer_runtime_pilot_added`
- Added an internal website answer runtime pilot for verified mock-only answer execution
- Runtime gate remains mandatory before any pilot answer is surfaced
- Answer evaluation remains mandatory before any pilot answer is surfaced
- Retrieval remains mandatory before any pilot answer is surfaced
- Source attribution remains mandatory before any pilot answer is surfaced
- Default deny remains active for public, production, live, unknown, insufficient-evidence, and scope-mismatch paths
- No live provider calls were added
- No live LLM answers were added
- No live embeddings were added
- No external RAG was added
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` added a provider-free internal answer evaluation path for ready website sources with verified retrieval and source attribution.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1` added an internal-only runtime gate with strict default-deny behavior.
- The conversation-engine runtime pilot could surface a gate decision, but it still lacked a dedicated website-answer runtime pilot orchestration path that combined evaluation, retrieval, source attribution, and gate enforcement into one internal mock-only result.

## Scope Decision

- Variant A is safe.
- The existing internal runtime pilot already provides an admin-test-only path.
- The existing website answer evaluation and runtime gate can be orchestrated without adding a public route, migration, dependency, provider call, or deployment path.
- The new pilot remains mock-only and internal-only.
- No provider approval, customer-data approval, or production approval is implied.

## Website Answer Runtime Pilot Model

- Added internal service: `apps/api/src/knowledge-sources/website-answer-runtime-pilot.service.ts`
- Extended the existing conversation-engine runtime pilot response with a structured website-answer runtime pilot result.
- The pilot orchestrates:
  - website answer evaluation
  - retrieval verification
  - source attribution verification
  - website answer runtime gate enforcement
  - final internal mock-only answer shaping
- The pilot returns:
  - allow / deny decision
  - decision code
  - sanitized message
  - answer text only for the allowed internal mock path
  - runtime gate decision
  - answer evaluation result
  - verified source attribution fields
  - source summary list
  - warnings
  - fixed no-provider / no-LLM / no-embedding / no-RAG flags

## Pilot Inputs

- Tenant id
- Site id
- Optional source id
- Question
- Optional expected source id
- Optional expected URL
- Optional expected title
- Optional expected domain
- Optional expected answer hints
- Explicit mock query embedding
- Runtime context
- Environment
- Actor role
- Answer mode
- Optional request id
- Optional correlation id

## Pilot Denials

- Missing source scope: denied
- Missing question: denied
- Missing query embedding: denied
- Unsupported source type: denied
- Inactive source: denied
- Non-ready source: denied
- Non-indexed source: denied
- Tenant mismatch: denied
- Site mismatch: denied
- Source mismatch: denied
- Missing retrieval verification: denied
- Missing source attribution verification: denied
- Fake source attribution: denied
- Insufficient evidence: denied
- Public widget context: denied
- Production/live answer context: denied
- Unknown context: denied
- Unknown role: denied
- Provider-live mode: denied
- Runtime gate denial: denied
- Runtime errors: denied with sanitized output

## Internal Mock Pilot Allow Path

- The only allow path is `allowed_internal_mock_runtime_pilot`.
- The allow path requires:
  - internal admin-test runtime context
  - non-production environment
  - operator or admin role
  - `answerMode = mock`
  - ready and indexed website source
  - successful website answer evaluation
  - verified retrieval
  - verified source attribution
  - runtime gate allow decision
- The allow path returns an internal mock answer only.
- The allow path does not surface the standard engine preview answer.
- The allow path does not call a provider.

## Runtime Gate Requirement

- The runtime pilot calls the website-answer runtime gate before any pilot answer is returned.
- Runtime gate denial stops the pilot answer.
- Runtime gate denial returns a sanitized reason.
- No direct bypass around the gate was added.
- Public widget, production/live, and unknown context remain blocked at the gate layer.

## Answer Evaluation Requirement

- The runtime pilot calls the existing website answer evaluation before final answer output.
- The runtime pilot does not replace answer evaluation with a weaker path.
- Evaluation failure blocks the pilot answer.
- Insufficient evidence blocks the pilot answer.
- Fake source attribution blocks the pilot answer.
- No live answer adapter was added.

## Retrieval Requirement

- Retrieval remains mandatory before any pilot answer is returned.
- Retrieval verification must remain true in the evaluation result.
- Retrieval-empty outcomes remain blocked.
- The runtime pilot does not relax any retrieval boundary.

## Source Attribution Requirement

- Source attribution remains mandatory before any pilot answer is returned.
- Verified source id, URL, title, and domain remain required.
- Fake or mismatched source attribution remains blocked.
- Cross-source scope remains blocked.

## Default Deny Behavior

- Unknown or incomplete state remains denied.
- Public widget remains denied.
- Production/live remains denied.
- Provider-live mode remains denied.
- Non-ready and non-indexed website sources remain denied.
- Cross-tenant, cross-site, and cross-source outcomes remain denied.
- No denied path calls a provider or creates a side effect.

## Runtime / Completion Boundary

- The runtime pilot does not change `runtime_readiness`.
- The runtime pilot does not change completion rules.
- The runtime pilot does not create approval grants.
- The runtime pilot does not create tickets, emails, or webhooks.
- The runtime pilot does not change go-live status.

## Tenant / Site / Source Boundary

- Tenant scope remains mandatory.
- Site scope remains mandatory.
- Exact source scope remains mandatory when provided.
- The runtime pilot does not widen tenant, site, or source access.
- Cross-tenant, cross-site, and cross-source answers remain blocked.

## Public Widget / Production Boundary

- Public widget answer runtime remains blocked.
- Production answer runtime remains blocked.
- No public route was added.
- No viewer route was added.
- No deploy path was added.
- No enterprise-ready or go-live claim was added.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No approval API endpoints
- No approval grants
- No deploy
- No public widget activation
- No production activation

## Dashboard Impact

- No dashboard code was required.
- No UI toggle was added.
- No provider settings UI was added.
- No public-widget activation hint was added.
- No production-readiness claim was added.

## Tests Added

- Added: `apps/api/test/website-answer-runtime-pilot.test.cjs`
  - verified internal mock pilot answer allowed
  - public-widget context denied
  - evaluation / retrieval / source-attribution failure denied
- Extended: `apps/api/test/conversation-engine-runtime-pilot.test.cjs`
  - internal mock website-answer pilot result returned through runtime pilot
  - insufficient-evidence pilot denial returns no answer
  - engine response preview remains suppressed when website-answer pilot output is used
- Existing regressions kept green:
  - website answer runtime gate
  - website answer evaluation
  - website embedding ingest
  - storage lookup
  - provider gate
  - approval policy
  - retrieval
  - completion rules
  - dashboard regression batch

## Known Limitations

- The pilot is internal only.
- The pilot is mock only.
- The pilot still depends on explicit mock query embeddings.
- The pilot still depends on precomputed ready website chunks.
- The pilot does not approve provider usage.
- The pilot does not activate any customer-facing runtime path.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1-D`
  - review and merge the internal website answer runtime pilot
- after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-EVALUATION-REPORT-1`
  - evaluate the internal pilot behavior and summarize readiness for a later explicitly gated follow-up

## Safety Boundaries

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No customer data
- No production data
- No production secrets
- No credentials
- No passwords
- No approval API endpoints
- No approval grants
- No provider approval claimed
- No customer-data approval claimed
- No production approval claimed
- No enterprise approval claimed
- No deploy
- No public widget activation
- No fake source attribution
