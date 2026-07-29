# Knowledge Ingest Persistence Schema

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `98e6c4114f5276ac146b598b6f11c514dd470508`
- Scope: add a provider-free persistence and status foundation for future website / URL knowledge ingest
- Scope decision: `schema_implemented`
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous Blocker

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-1` was blocked because the existing URL ingest path is coupled to embeddings and vector-backed retrieval.
- Without a separate persistence/status layer, a future website import could only become visible by incorrectly inheriting the legacy `ready` semantics.
- That would create a false completion signal and a fake answer-ready source.

## Scope Decision

- Variant A was safe to implement.
- The existing migration pattern is clear.
- Tenant/site binding already exists on `knowledge_sources`.
- Existing completion logic could be updated conservatively from legacy `sync_status = 'ready'` to explicit `runtime_readiness = 'ready'`.
- No production DB execution, provider call, crawling step, or embedding generation was required.

## Schema / Persistence Model

- The existing `knowledge_sources` table was extended.
- Added provider-free persistence fields:
  - `ingest_status`
  - `index_status`
  - `runtime_readiness`
  - `ingest_error_code`
  - `ingest_error_message_sanitized`
  - `last_ingest_at`
  - `normalized_source_url`
  - `source_domain`
- The migration backfills existing rows conservatively from legacy `sync_status` and `last_synced_at`.
- Existing active ready sources remain answer-ready after backfill.
- Existing pending / processing / failed sources do not become answer-ready.

## Status Model

- Ingest lifecycle:
  - `created`
  - `processing`
  - `extracted`
  - `failed`
  - `blocked`
- Index/runtime lifecycle:
  - `not_requested`
  - `pending`
  - `indexed`
  - `failed`
  - `blocked`
- Runtime readiness:
  - `not_ready`
  - `ready`
  - `failed`
  - `blocked`
- Legacy `sync_status` is now derived conservatively from the new state instead of driving readiness by itself.

## Runtime Readiness Separation

- `ingest_status = extracted` does not imply answer readiness.
- `index_status = indexed` does not imply answer readiness by itself.
- Only `runtime_readiness = ready` is counted as usable backend knowledge.
- A helper layer was added to:
  - normalize status values
  - backfill legacy lifecycle states
  - derive conservative legacy status values
  - compute completion relevance
  - sanitize ingest error output
  - normalize URL metadata without enabling crawling

## Completion Rules

- Setup completion and retrieval paths now count only active sources with `runtime_readiness = 'ready'`.
- `created`, `processing`, `extracted`, `not_requested`, `pending`, `failed`, and `blocked` are not treated as ready.
- Unknown values remain conservative through normalization defaults.
- No extracted-only or index-pending source can appear answer-ready.

## Tenant / Site Boundary

- All state remains tenant-bound and site-bound through the existing `knowledge_sources` model.
- No global source was introduced.
- No cross-tenant read or write path was added.
- No viewer/public route was added.

## Dashboard Impact

- No dashboard runtime code was changed.
- No new website-ingest CTA was added.
- No UI now claims that website crawling is available.
- No UI now claims that extracted content is answer-ready.

## Migration Notes

- Migration added: `029_knowledge_ingest_persistence_schema.sql`
- Production execution: not performed
- Backfill behavior:
  - legacy `ready` -> `extracted` / `indexed` / `ready`
  - legacy `processing` -> `processing` / `pending` / `not_ready`
  - legacy `failed` -> `failed` / `failed` / `failed`
  - legacy `disabled` with prior sync -> `extracted` / `indexed` / `ready`
  - legacy `disabled` without prior sync -> `created` / `not_requested` / `not_ready`
- Backfill also sanitizes legacy failure text and captures ingest timestamps conservatively.

## Tests Added

- Added:
  - `apps/api/test/knowledge-source-readiness.test.cjs`
- Updated:
  - `apps/api/test/knowledge-retrieval.service.test.cjs`
- Revalidated:
  - knowledge readiness lifecycle mapping
  - extracted-only sources stay not ready
  - blocked/failed sources stay not ready
  - completion logic still requires active ready sources
  - vector retrieval only uses ready sources
  - API build, dashboard build, dashboard typecheck, monorepo typecheck, production-context audit, authorization matrix, and security boundary tests

## Known Limitations

- This task does not implement:
  - website crawling
  - full-domain crawl
  - authenticated crawl
  - JavaScript rendering
  - provider calls
  - embeddings
  - RAG
  - file import of real customer content
  - public widget activation
  - production activation
- `markExtracted()` exists only as a provider-free persistence step for future follow-up work.
- A future website ingest task must still decide how extracted text is persisted and when indexing/runtime readiness is granted.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-2`
  - implement a real website/URL ingest flow against the new persistence model
  - keep SSRF/fetch constraints explicit
  - persist extracted content without fabricating answer readiness
  - grant `runtime_readiness = ready` only after the real retrieval-backed path is complete

## Safety Boundaries

- No website crawling
- No provider call
- No embeddings / no RAG
- No deploy
- No public widget
- No production activation
- No customer data
- No production data
- No passwords
- No credentials
- No fake sources
- No fake source attribution
- No screenshots or recordings
- Extracted is not ready
- Index pending is not ready
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`
