# Knowledge Website Embedding Ingest 3

## Summary

- Audit date: Saturday, August 1, 2026
- Baseline: `90f805b187491e0de0fb194d05294c0312031181`
- Scope: add a gated website embedding ingest path that can index already extracted website chunks only behind approval storage lookup, provider policy revalidation, and provider embedding gate
- Scope decision: `gated_mock_embedding_ingest_implemented`
- No live provider call was added
- No live embedding generation was added
- No customer data was used
- No production data was used
- No deploy was executed
- No public widget was activated
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-2` persisted single-page website text provider-free into `documents` and `chunks` with `embedding = NULL`.
- `KNOWLEDGE-WEBSITE-INGEST-RUNTIME-READINESS-1` kept imported website sources at:
  - `ingest_status = extracted`
  - `index_status = pending`
  - `runtime_readiness = not_ready`
- `KNOWLEDGE-PROVIDER-EMBEDDING-GATE-1` introduced a hard default-deny gate ahead of any provider-backed website runtime indexing.
- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-LOOKUP-1` added a read-only persisted approval lookup with provider policy revalidation.
- There was still no executable website embedding ingest path and therefore no truthful `runtime_readiness = ready` transition for website sources.

## Scope Decision

- Variant A is now safe.
- The persisted approval lookup exists and is read-only.
- The provider policy contract is reusable for every later ingest decision.
- Existing website chunks can be updated in place without a migration.
- Retrieval and source attribution can be verified deterministically with a mock embedding adapter before `runtime_readiness = ready` is granted.
- No controller route, dashboard toggle, provider settings UI, deploy path, or public widget activation was added.

## Website Embedding Ingest Model

- Added internal service: `apps/api/src/knowledge-sources/website-embedding-ingest.service.ts`
- The service operates only on already extracted website sources.
- The service reads the existing website source plus its persisted chunks.
- The service updates existing chunk embeddings in place.
- The service does not create approval grants.
- The service does not add approval API endpoints.
- The service does not run website crawling.
- The service does not widen any public or dashboard runtime surface.

## Storage Lookup Enforcement

- Approval storage lookup remains mandatory.
- Every indexing attempt loads a persisted provider approval grant through the read-only lookup service.
- Missing grants remain denied.
- Expired grants remain denied.
- Revoked grants remain denied.
- Future grants remain denied.
- Cross-tenant and cross-site grants remain denied.
- Cross-source grants remain denied when a source-specific approval is required.

## Provider Policy Revalidation

- Loaded grants are revalidated through the existing provider approval policy contract.
- Validation still enforces:
  - tenant id
  - site id
  - optional source id
  - source type
  - usage context
  - environment
  - provider
  - model
  - customer-data approval
  - provider DPA approval
  - production approval in production
  - retention
  - redaction
  - logging
  - deletion
  - rate limit
  - cost limit
- A stored grant is not enough by itself; policy denial remains denial.

## Provider Gate Enforcement

- Provider embedding gate remains mandatory ahead of every embedding batch.
- Gate evaluation is repeated before each chunk embedding call.
- Denied path behavior:
  - no adapter call
  - no vector update
  - no ready transition
  - source is marked blocked only because this is an explicit ingest attempt, not a pure gate probe
- Allowed path behavior:
  - only after storage lookup plus policy revalidation plus gate allow
  - only for `sourceType = url`
  - only for tenant-/site-bound extracted website sources

## Mock Embedding Adapter

- The new service requires an explicit adapter argument.
- Only `mode = mock` is accepted in this scope.
- No default live provider adapter is wired into the service.
- No controller endpoint calls this service.
- No production auto-wiring exists.
- Tests use a deterministic mock adapter with a fixed vector dimension.
- Adapter failures are sanitized and do not leak raw provider-like error output.

## Chunking / Embedding Persistence

- No new migration was needed.
- No new dependency was needed.
- Existing website chunks are reused.
- Existing chunk content and content hashes are preserved.
- The service updates chunk embeddings through the existing `VectorService.updateChunk(...)`.
- Metadata is patched to record:
  - `websiteEmbeddingIndexed`
  - `websiteEmbeddingAdapterMode`
  - `websiteEmbeddingProviderKey`
  - `websiteEmbeddingModel`
  - `websiteEmbeddingSynthetic`
- No approval writes or audit writes are introduced in this task.

## Retrieval / Source Attribution

- Variant A requires proof before `ready`.
- Retrieval is verified with mock embeddings after chunk indexing.
- Verification stays tenant-bound and site-bound.
- Verification checks that at least one retrieved row maps back to the expected website source.
- Source attribution checks the real source id plus the real title/URL metadata from the persisted test fixture.
- No fake source attribution was used.
- Cross-tenant retrieval remains forbidden.

## Runtime Readiness Rules

- `runtime_readiness = ready` is now allowed only inside the new internal mock-only ingest path after all of the following are true:
  - storage lookup allow
  - provider policy allow
  - provider gate allow
  - mock embedding success
  - retrieval verification success
  - source-attribution verification success
- `runtime_readiness` is not auto-promoted by extraction alone.
- `runtime_readiness` is not promoted by a pure gate decision alone.

## Completion Rules

- `extracted` does not count as ready.
- `index_pending` does not count as ready.
- `blocked` does not count as ready.
- `failed` does not count as ready.
- Existing ready source semantics remain unchanged.
- Only sources that pass the fully verified ingest path become answer-ready.

## Tenant / Site Boundary

- Tenant/site scoping remains unchanged.
- The new service requires tenant-bound and site-bound sources.
- Retrieval verification is tenant-/site-scoped.
- No new route or auth widening was added.

## Source Scope Boundary

- The new ingest path is restricted to `sourceType = url`.
- Existing FAQ/PDF/manual paths were not widened by this task.
- Existing non-website ready sources remain valid under the existing lifecycle rules.

## Revocation / Expiry / Production Boundary

- Revoked grants remain blocked.
- Expired grants remain blocked.
- Future grants remain blocked.
- Production remains blocked without `production_approved = true`.
- No production activation is claimed in this task.

## No Provider / No Live Embedding Boundary

- No live provider calls
- No live embeddings
- No external RAG provider execution
- No website crawling expansion
- No full-domain crawling
- No sitemap crawling
- No authenticated crawling
- No JavaScript rendering

## Dashboard Impact

- No dashboard code change was required.
- No provider settings UI was added.
- No approval toggle was added.
- No public widget claim was added.
- No deployment claim was added.

## Tests Added

- Added: `apps/api/test/website-embedding-ingest.service.test.cjs`
  - deny without storage grant and no adapter call
  - deny expired/revoked/future/mismatched grants and no adapter call
  - reject non-mock adapters
  - sanitize adapter failures
  - index website chunks with deterministic mock embeddings
  - verify retrieval and source attribution before ready transition
  - keep `ready` blocked when retrieval/attribution cannot be proved
- Existing regressions kept green:
  - storage lookup
  - provider gate
  - approval policy
  - approval storage schema
  - ingest service
  - knowledge retrieval
  - knowledge source readiness
  - dashboard regression batch

## Known Limitations

- No controller or dashboard surface triggers the new service yet.
- The current path is mock-only by design.
- No live provider adapter is accepted in this scope.
- Guided customer demo remains blocked.
- Self-service customer demo remains blocked.
- Real pilot remains blocked.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3-D`
  - review and merge the mock-only gated ingest path
- after merge: `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1`
  - evaluate answer behavior once website sources can become answer-ready through the verified path

## Safety Boundaries

- No live provider calls
- No live embeddings
- No RAG
- No customer data
- No production data
- No approval API endpoints
- No approval write service
- No approval grants
- No provider approval claimed
- No customer-data approval claimed
- No production approval claimed
- Storage lookup remains mandatory
- Provider policy revalidation remains mandatory
- Provider gate remains mandatory
- Default deny remains mandatory
- No deploy
- No public widget
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
