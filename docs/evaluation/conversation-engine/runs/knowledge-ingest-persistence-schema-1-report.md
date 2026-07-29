# Knowledge Ingest Persistence Schema 1 Report

## Summary

- run_id: `knowledge-ingest-persistence-schema-1`
- run_type: `knowledge_ingest_persistence_schema`
- scope_decision: `schema_implemented`
- provider-free ingest schema added: yes
- runtime readiness separated: yes
- completion rules preserved: yes
- tenant/site bound: yes
- migration added: yes
- guided customer demo: `still_blocked`
- self-service customer demo: `blocked`
- real pilot: `blocked`

## Scope Decision

- Implemented.
- The codebase could safely add a provider-free persistence/status layer without activating crawl, provider, embedding, or answer-ready behavior.

## Schema / Existing / Blocked

- Implemented in this task:
  - migration extending `knowledge_sources`
  - lifecycle helper for ingest/index/runtime states
  - conservative legacy status derivation
  - completion/readiness query updates
  - regression tests for readiness separation
- Still blocked in this task:
  - website crawling
  - provider-backed ingest
  - embedding generation
  - RAG indexing
  - any public/customer activation

## Status Model

- `ingest_status`:
  - `created`
  - `processing`
  - `extracted`
  - `failed`
  - `blocked`
- `index_status`:
  - `not_requested`
  - `pending`
  - `indexed`
  - `failed`
  - `blocked`
- `runtime_readiness`:
  - `not_ready`
  - `ready`
  - `failed`
  - `blocked`

## Runtime Readiness

- `extracted` is not `ready`.
- `indexed` is not automatically `ready`.
- Only `runtime_readiness = ready` counts as answer-ready backend knowledge.

## Completion Rules

- Setup completion and retrieval paths now depend on active ready sources only.
- Extracted-only, index-pending, failed, blocked, or inactive sources do not count.

## Tenant/Site Boundary

- Existing tenant/site binding remains intact.
- No global source, public route, or viewer capability was added.

## Migration Notes

- Added: `apps/api/migrations/029_knowledge_ingest_persistence_schema.sql`
- Production execution: no
- Backfill is conservative and preserves existing real ready sources while avoiding false readiness for partial ingest states.

## Safety Confirmation

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no passwords
- no provider calls
- no embeddings / no RAG
- no website crawling
- no fake source attribution
- no screenshots or recordings

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-2`
