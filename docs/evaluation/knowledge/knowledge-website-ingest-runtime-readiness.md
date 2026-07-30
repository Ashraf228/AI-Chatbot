# Knowledge Website Ingest Runtime Readiness

## Summary

- Audit date: Thursday, July 30, 2026
- Baseline: `675c960126fb0e078383c056c4a1e10d6f598ab3`
- Scope: add an explicit runtime-readiness guard for imported website sources
- Scope decision: `backend_gate_only_no_ready`
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- Single-URL website import already persisted provider-free extracted text.
- Extracted website chunks were stored without embeddings.
- Runtime readiness stayed `not_ready`.
- The stored website source still reported `index_status = not_requested`, which did not distinguish "not indexed yet" from "no runtime path required".

## Scope Decision

- Variant A was rejected.
  - The actual retrieval and answer path still requires query embeddings plus vector search over `chunks.embedding IS NOT NULL`.
  - Website-ingest chunks remain provider-free and therefore have no embeddings.
  - A truthful `runtime_readiness = ready` transition cannot be proven without introducing a new runtime indexing path.
- Variant B is safe and implementable.
  - Imported website sources now transition to an explicit backend gate state:
    - `ingest_status = extracted`
    - `index_status = pending`
    - `runtime_readiness = not_ready`
  - This makes the missing runtime materialization step explicit without faking answer-readiness.

## Runtime Readiness Model

- `extracted` is not `ready`.
- `index_status = pending` means runtime indexing/materialization is still required.
- `runtime_readiness = ready` remains reserved for sources that are actually usable in the retrieval/answer path.
- Website-imported sources never auto-promote to `ready` in this task.

## Ready Preconditions

- All of the following would be required before a website source could become `ready`:
  - tenant/site-bound source remains active
  - extracted content exists
  - actual retrieval can find the source in the real answer path
  - source attribution returns real source ID / URL / title
  - no fake source attribution
  - no provider/embedding/RAG rule is violated without separate approval

## Completion Rules

- Only `runtime_readiness = ready` counts as completion-ready.
- `extracted` does not count.
- `index_status = pending` does not count.
- `not_ready`, `failed`, and `blocked` do not count.

## Retrieval / Source Attribution

- The current answer path calls:
  - query embedding generation
  - vector search
- The current vector query requires:
  - `chunks.embedding IS NOT NULL`
  - `knowledge_sources.runtime_readiness = 'ready'`
- Imported website text does not satisfy that path today.
- No fake retrieval proof or fake source attribution was added.

## Tenant / Site Boundary

- The ingest remains tenant-bound and site-bound.
- No new public/viewer route was added.
- No permission widening was introduced.

## Dashboard Impact

- No dashboard code change was required.
- Existing setup/status UI already states:
  - imported/extracted is not answer-ready
  - website import is single-page only
- The backend now exposes a clearer `index_status = pending` state for website imports.

## Authorization Boundary

- No new endpoint was added.
- No authorization matrix change was required.
- Existing admin/operator-only ingest boundary remains in place.

## Provider / Embedding / RAG Boundary

- No provider calls were added.
- No embedding generation was added for website-imported content.
- No RAG indexing/materialization was added.
- No external retrieval service was added.

## Tests Added

- Updated:
  - `apps/api/test/ingest.service.test.cjs`
  - `apps/api/test/knowledge-source-readiness.test.cjs`
- Revalidated:
  - website import remains provider-free
  - extracted website sources stay `not_ready`
  - pending runtime-index gate does not count as completion-ready

## Known Limitations

- This task does not implement:
  - provider-free answer-ready retrieval for website imports
  - embeddings
  - RAG
  - public widget activation
  - deploy
  - customer/self-service readiness
- Website-imported content remains persisted but not answer-usable.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-RUNTIME-INDEXING-1`
  - design and implement the truthful runtime materialization/indexing step
  - prove retrieval and real source attribution before any `ready` transition

## Safety Boundaries

- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No credentials
- No passwords
- No provider calls
- No embeddings
- No RAG
- No fake source attribution
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
