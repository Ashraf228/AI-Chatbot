# Knowledge Website Runtime Indexing

## Summary

- Audit date: Thursday, July 30, 2026
- Baseline: `df665d8b0077bcb3b623250d1229f14795422a6c`
- Scope: determine whether imported website sources can be transferred into a real runtime index without provider calls, embeddings, or RAG
- Scope decision: `blocked_requires_provider_embedding_gate`
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-INGEST-RUNTIME-READINESS-1` deliberately introduced a conservative guard only:
  - `ingest_status = extracted`
  - `index_status = pending`
  - `runtime_readiness = not_ready`
- Imported website content is already persisted provider-free in `documents` and `chunks`.
- Those persisted website chunks still have no embeddings.
- The codebase still treats `runtime_readiness = ready` as the only completion-relevant state.

## Scope Decision

- Variant A was rejected.
  - The productive chat path still creates a query embedding before retrieval.
  - The preview/test retrieval path also still creates a query embedding before retrieval.
  - The only implemented retrieval backend is still vector search over `chunks.embedding IS NOT NULL`.
  - No provider-free full-text/keyword runtime index exists in the current codebase.
  - No provider-free retrieval-backed source-attribution proof exists for website imports.
- Variant B was also rejected.
  - The current `index_status = pending` guard already expresses "runtime indexing still missing".
  - Adding another gate state without a retrieval-capable backend would not increase truthfulness.
- Variant C is the correct outcome.
  - A truthful runtime index for website imports currently requires a separate provider/embedding decision gate.

## Runtime Indexing Model

- A truthful runtime index would require all of the following:
  - a provider-free or explicitly approved retrieval-capable index format
  - a retrieval path that can find website-imported content without fake-ready logic
  - real source attribution from `source_id`, URL, title, or domain metadata
  - a verified transition from `index_status = pending` to `index_status = indexed`
  - a verified transition to `runtime_readiness = ready`
- None of those conditions can currently be proven without changing the retrieval architecture.

## Ready Preconditions

- A website source may only become `runtime_readiness = ready` if all of the following are true:
  - source stays tenant-bound and site-bound
  - source is active
  - extracted text exists and is non-empty
  - the real retrieval path can find the source
  - the real answer path can carry the source through with genuine attribution
  - `index_status = indexed`
  - no provider/embedding/RAG boundary is violated without explicit approval
  - no fake source attribution is introduced

## Retrieval Verification

- The current productive retrieval path in `apps/api/src/ai/chat-pipeline/chat-pipeline.service.ts` does:
  - `this.embedder.embed(input.message)`
  - `this.vector.search(...)`
- The preview retrieval path in `apps/api/src/conversation-engine/knowledge-preview-retrieval.service.ts` does:
  - `this.embedder.embed(query)`
  - `this.vector.search(...)`
- `apps/api/src/vector/vector.service.ts` still requires:
  - `c.embedding IS NOT NULL`
  - `COALESCE(ks.runtime_readiness, 'ready') = 'ready'`
- Website-imported provider-free chunks do not satisfy that runtime path today.
- No provider-free retrieval verification is available.

## Source Attribution

- The current vector path can return real source metadata only after a chunk is found through the existing embedding-backed search.
- Website imports are not retrievable there today.
- A truthful `source_attribution_verified = true` claim would therefore be incorrect.

## Completion Rules

- Only `runtime_readiness = ready` counts as completion-ready.
- `extracted` does not count.
- `index_status = pending` does not count.
- `runtime_readiness = not_ready` does not count.
- `failed` and `blocked` do not count.

## Tenant / Site Boundary

- Existing tenant/site boundaries remain intact.
- No new route was added.
- No permission widening was introduced.
- No authorization-matrix change was required.

## Dashboard Impact

- No dashboard code change was required.
- Existing dashboard language remains correct:
  - imported/extracted website sources are still not answer-ready
  - no crawl, deploy, or public-widget activation is implied

## Authorization Boundary

- No new endpoint was added.
- Existing admin/operator-only boundaries remain unchanged.
- Viewer/public access was not expanded.

## Provider / Embedding / RAG Boundary

- No provider calls were added.
- No embeddings were added.
- No RAG indexing was added.
- No query runner was added.
- No external runtime-indexing service was added.

## Tests Added

- No runtime code was changed because the task is blocked on architecture and approval.
- Existing evidence used for the decision:
  - production-context audit remained green
  - authorization matrix remained green
  - security boundaries remained green
  - the existing retrieval implementation still depends on embeddings and vector search

## Known Limitations

- The codebase currently has no provider-free runtime-index format for website imports.
- The codebase currently has no provider-free retrieval path for website imports.
- The codebase currently has no verified provider-free source-attribution path for website imports.
- Therefore a truthful `runtime_readiness = ready` transition cannot be added in this task.

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-EMBEDDING-GATE-1`
  - explicitly decide whether website knowledge may enter an embedding-backed retrieval path
  - define the approved provider/embedding boundary
  - only after that, design the real runtime-indexing step

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
- No website crawling changes
- No fake source attribution
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
