# Knowledge Website Answer Evaluation 1 Report

## Summary

- Run ID: `knowledge-website-answer-evaluation-1`
- Run type: `knowledge_website_answer_evaluation`
- Scope decision: `website_answer_evaluation_added`
- Internal website answer evaluation added: yes
- Mock answer adapter used in tests only: yes
- Live provider calls: no
- Live LLM answers: no
- Live embeddings: no
- External RAG: no

## Scope Decision

- A provider-free answer evaluation path is now available for already ready website sources.
- The path is internal only and requires:
  - explicit tenant/site/source scope
  - explicit mock query embedding
  - explicit mock answer adapter
  - verified retrieval
  - verified source attribution

## Website Answer Evaluation Model

- Internal service: `apps/api/src/knowledge-sources/website-answer-evaluation.service.ts`
- Reads an already ready website source
- Runs tenant-/site-bound retrieval through the existing vector path
- Verifies source attribution against real source id, URL, title, and domain
- Calls a mock-only answer adapter with retrieved context only
- Returns either:
  - answered
  - blocked / insufficient evidence / attribution failure

## Retrieval Requirement

- Retrieval is required before answer generation
- Empty retrieval blocks the answer
- Foreign-source retrieval blocks the answer
- Non-ready sources never enter the answer path

## Source Attribution Requirement

- Source attribution is required before answer generation
- Fake source attribution is blocked
- The adapter cannot switch to a different source id
- Real fixture URL/title/domain are preserved in the verified result

## Mock Answer Adapter

- Mock-only mode
- Test-only
- No credentials
- No network
- No provider runtime
- No live LLM path

## Default Deny / Insufficient Evidence

- Missing source scope: blocked
- Tenant/site mismatch: blocked
- Non-ready source: blocked
- Retrieval empty: blocked
- Missing or unverifiable source attribution: blocked
- Insufficient evidence: blocked
- Fake source attribution: blocked

## Runtime / Completion Boundary

- No runtime readiness change
- No completion rule change
- No public widget activation
- No deploy
- No production runtime activation

## Still Blocked

- Guided customer demo: `still_blocked`
- Self-service customer demo: `blocked`
- Real pilot: `blocked`
- Provider/production/customer-data approval claims: none

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

## Recommended Next Step

- Gate review: `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1`
