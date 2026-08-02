# Knowledge Website Answer Evaluation

## Summary

- Audit date: Sunday, August 2, 2026
- Baseline: `411175973f2854e73893d9ffa546077915603ac2`
- Scope decision: `website_answer_evaluation_added`
- Added an internal website answer evaluation service for ready website knowledge only
- Retrieval remains mandatory before any answer is produced
- Source attribution remains mandatory before any answer is produced
- Mock answer generation is test-only
- No live provider calls were added
- No live LLM answers were added
- No live embeddings were added
- No external RAG was added
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3` made website sources truthfully answer-ready only after storage lookup, provider policy revalidation, gate allow, mock embedding success, retrieval verification, and source attribution verification.
- The current productive answer paths still depend on provider-backed query embeddings and provider-backed answer generation.
- There was no provider-free internal evaluation path that could prove website answer behavior without touching the live provider stack.

## Scope Decision

- Variant A is safe.
- Existing retrieval persistence is sufficient because ready website chunks already exist in the vector path after the gated mock ingest.
- A strict internal evaluation layer can run directly on tenant-/site-bound `VectorService.search(...)` results.
- Query embeddings can be injected explicitly as deterministic mock input.
- Answer generation can be isolated behind an explicit `mode = mock` adapter with no production wiring.
- No controller, no public route, no dashboard toggle, and no deploy path are required.

## Website Answer Evaluation Model

- Added internal service: `apps/api/src/knowledge-sources/website-answer-evaluation.service.ts`
- The service is internal only.
- The service accepts:
  - tenant id
  - site id
  - source id or expected source id
  - question
  - expected answer hints
  - expected source URL/title/domain
  - explicit mock query embedding
  - explicit mock answer adapter
- The service returns:
  - answered / blocked decision
  - decision code
  - sanitized message
  - answer text
  - retrieval verification status
  - source attribution verification status
  - verified source identity fields
  - missing evidence
  - warnings

## Retrieval Requirement

- Retrieval is mandatory before answer generation.
- Retrieval is performed through the existing `VectorService.search(...)`.
- Retrieval remains tenant-bound and site-bound.
- Retrieval uses only chunks with:
  - `embedding IS NOT NULL`
  - active source
  - `runtime_readiness = ready`
- Empty retrieval blocks the answer.
- Retrieval that does not contain the expected ready website source blocks the answer.

## Source Attribution Requirement

- Source attribution is mandatory before answer generation.
- The service verifies:
  - real `sourceId`
  - real `sourceUrl`
  - real `sourceTitle`
  - real `sourceDomain`
- A retrieval hit from another source is rejected.
- A mock adapter that reports a different source id is rejected as fake source attribution.
- No fake source path is accepted.

## Mock Answer Adapter

- Answer generation requires an explicit adapter argument.
- Only `mode = mock` is accepted.
- No default live provider adapter is wired.
- No OpenAI key or other provider credential is needed by this service.
- The adapter receives only:
  - the user question
  - retrieved context slices
  - verified source identity fields
  - expected answer hints
- The adapter can return:
  - `answered`
  - `insufficient_evidence`
- Adapter failures are sanitized.

## Default Deny / Insufficient Evidence

- The evaluation blocks when:
  - source scope is missing or mismatched
  - tenant or site mismatches
  - source type is not `url`
  - source is inactive
  - source is not runtime-ready
  - source is not indexed
  - question is missing
  - query embedding is missing
  - adapter is missing
  - adapter is not mock-only
  - retrieval is empty
  - source attribution is not verified
  - answer evidence is insufficient
  - fake source attribution is detected
- No denied path calls a live provider.
- No denied path widens completion or runtime readiness.

## Runtime / Completion Boundary

- The evaluation does not change runtime readiness.
- The evaluation does not set completion.
- The evaluation does not promote extracted, pending, blocked, or failed sources.
- The evaluation only reads from already ready website sources.
- Existing completion rules remain unchanged.

## Tenant / Site / Source Boundary

- Tenant match is required.
- Site match is required.
- Source scope is exact.
- Cross-tenant answers are denied.
- Cross-site answers are denied.
- Cross-source answers are denied.
- No global source grant or public source scope is introduced.

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No query runner
- No approval API endpoints
- No approval grants
- No deploy
- No public widget activation
- No production activation

## Dashboard Impact

- No dashboard code was required.
- No UI toggle was added.
- No provider settings UI was added.
- No public widget claim was added.
- No production-readiness claim was added.

## Tests Added

- Added: `apps/api/test/website-answer-evaluation.service.test.cjs`
  - blocks missing source scope before retrieval
  - blocks non-ready sources
  - blocks tenant/site mismatches
  - blocks retrieval-empty answers
  - blocks foreign-source retrieval
  - verifies ready website answer evaluation with real source attribution
  - rejects fake source attribution
  - sanitizes adapter failures
- Existing regressions remain in scope after this task:
  - website embedding ingest
  - storage lookup
  - provider gate
  - approval policy
  - retrieval
  - completion rules
  - dashboard regression batch

## Known Limitations

- The evaluation path is internal only.
- The evaluation path still requires explicit mock query embeddings.
- The evaluation path still requires an explicit mock answer adapter.
- No production runtime route uses this service.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1-D`
  - review and merge the internal website answer evaluation
- after merge: `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1`
  - decide if and how a future runtime gate may expose a safe answer path without live rollout claims

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
