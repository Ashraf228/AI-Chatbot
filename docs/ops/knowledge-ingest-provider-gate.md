# Knowledge ingestion provider gate

Task: `KNOWLEDGE_INGEST_PROVIDER_GATE_1`.
Base: `6dc89ef024a47e4f564b243e1cf83d0e6f1efe61`, parent
`15fd2dbb176b11796f83882587bd42b85fd26cbc`. This development line includes
both the Poweruser/template package and the reviewed LLM generation contract.
Local implementation only; no grants, provider calls, migration or activation.

## Confirmed baseline and path matrix

Line numbers in the baseline column refer to the immutable base above.
All admin ingestion writes retain `AdminKeyGuard` and server-side
`AdminScopeService` checks permitting admin/operator; viewer permissions and
Poweruser capabilities do not replace a provider grant.

| Entry → role check | Tenant/site/source → baseline | Final grant → transport → lifecycle |
| --- | --- | --- |
| POST admin/ingest/faq → site access | site tenant resolved; new FAQ source; `ingest.service.ts:137` called raw embed: actual gap | `knowledge_ingest`; source ownership checked per HTTP attempt; prepare all FAQ vectors; atomically persist document/chunks/ready |
| POST admin/ingest/manual → site access | new manual source, or FAQ if a question is supplied; shared text helper `:461`: actual gap | `knowledge_ingest`; actual stored source type; prepare vectors before transactional replacement |
| POST admin/ingest/pdf → site access | new PDF source; parser → chunks → raw embed `:398`: actual gap | `knowledge_ingest`; gate for every PDF chunk; parser/empty-text/provider failure cannot mark ready |
| PATCH admin/ingest/faq/:chunkId → FAQ chunk access | document/chunk lookup then raw embed `:938`: actual gap | join chunk/document tenant+site; resolve source; `knowledge_reindex`; only replace chunk after authorized successful embedding |
| POST admin/ingest/sources/:sourceId/resync → source site access | FAQ/manual/template reused text helper; old documents deleted before provider success: actual gap | `knowledge_reindex`; stored source type, including `it_support_template`; preserve prior ready knowledge on rejection/failure; transactional replacement |
| Internal ingestTextIntoExistingSource → trusted service caller | caller context forwarded unchecked to text helper: actual gap | ownership/type checked before lifecycle writes and again at each HTTP boundary; `knowledge_reindex`; no endpoint added |
| PDF resync → source site access | requires re-upload, no embedding in this branch | HTTP 400 requirement retained; uploaded replacement goes through PDF ingestion |
| Website import/resync → site access | provider-free extraction and text persistence: no external embedding gap | unchanged, remains non-ready pending separate indexing |
| WebsiteEmbeddingIngestService → internal mock workflow | persisted grant and safe-adapter WeakSet; only internally created frozen deterministic mocks permitted | unchanged; `website_ingest_runtime_indexing`, URL source, no external provider transport enabled |
| IT template import → existing tenant/site/capability checks | transactional provider-free inactive draft import | unchanged; importing does not authorize subsequent reindex or add answer-ready state |
| Public query → RuntimeQueryEmbeddingService | existing exact site-runtime query grant | unchanged `query_embedding`; shared EmbeddingService/query transport unchanged |
| Admin/test preview query → KnowledgePreviewRetrievalService | direct shared embedder; outside public query-grant contract | outside this ingestion scope; separate preview review remains necessary |
| LLM generation → LlmService | reviewed exact site-runtime generation grant | unchanged `llm_generation` and transport controls |

## Contract decision

The baseline gate knew only `website_ingest_runtime_indexing`,
`knowledge_reindex`, and `query_embedding`. Source/source-type `purpose` was
nonempty descriptive text, not a bound ingestion purpose. The user explicitly
authorized a separate first-ingestion context/purpose rather than silently
extending reindex grants.

- Initial FAQ/manual/PDF ingestion: purpose `knowledge_ingest`, usage contexts
  exactly `["knowledge_ingest"]`.
- Existing-source reindex and FAQ chunk edits: purpose `knowledge_reindex`,
  usage contexts exactly `["knowledge_reindex"]`.
- Scope: `source` with exact source ID, or `source_type` with null source ID
  and matching actual stored source type. Existing lookup priority is preserved:
  source first, then source_type, newest validity/creation first. No wildcard.
- Tenant, site, provider, normalized model and resolved deployment environment
  must match. Source must join the same site's tenant. Invalid/missing context,
  malformed/expired/future/revoked policy, DB error, wrong purpose or mixed usage
  all deny. Query/LLM runtime grants never authorize ingestion.
- Existing required data, DPA, retention, redaction, logging, cost/rate and
  production-approval policy fields continue to be validated. This is technical
  authorization enforcement, not provisioning or an assertion of legal approval.

The optional purpose predicate in the source lookup is parameterized. Website
lookups omit it and retain their contract. Query and LLM lookup queries remain
unchanged. Purpose/usage pairs are also checked again after storage mapping.

## Actual transport and retry semantics

`IngestionEmbeddingService` reuses existing embedding provider/model resolution
and deployment-environment resolution. It owns a small ingestion-only OpenAI
client to avoid changing public-query/preview transport semantics.

Each text chunk creates one SDK request with explicit `maxRetries: 0`,
`logLevel: 'off'`, fixed `https://api.openai.com/v1`, and normalized model.
Only HTTPS `/v1/embeddings` without credentials/query/fragment is accepted;
`redirect: 'error'` is forced after request options. A conflicting configured
base URL or unsupported provider/model configuration denies before egress.

Source ownership and the persisted grant are read inside the SDK fetch wrapper
immediately before `globalThis.fetch`. There is no cached batch allow, no hidden
SDK retry, and no internal retry loop. Each caller retry and each next chunk
performs a new ownership/validity lookup. Revocation blocks subsequent attempts;
an already-started HTTP request cannot be retroactively revoked.

The SDK option overrides `OPENAI_LOG=debug`; all provider/lookup errors become
one fixed HTTP 502 message. No SDK error, prompt, embedding payload or grant
metadata is logged or returned. Existing validation errors remain HTTP 400.

## Persistence and rollback

All embeddings are prepared before any replacement document/chunk write. A
source-ownership/type lock, deletion of old documents, insertion of replacements,
chunk upserts and the ready transition use the same existing database transaction.
`VectorService.upsertChunk` and `KnowledgeSourcesService.markReady` accept an
optional Queryable; old callers retain their original DB default.

Existing ready sources remain ready with their previous documents on provider
or transaction failure. New/not-ready sources record a sanitized failure and
never transition to ready on a failed batch. FAQ updates retain the old chunk
until the embedding succeeds. Validation failures do not rewrite a foreign
source's lifecycle. The existing provider-free website replacement behavior is
outside this change and is not claimed to gain transaction protection.

No schema migration is required: migrations 030/031 already represent these
source/source-type strings and contexts. The exact site-runtime constraints
from 031–033 are unchanged. No historical grant is reinterpreted or created.
Rolling back to old ingestion code reopens ungated egress; grant revocation alone
cannot protect that old code. Before any such rollback, independently disable
provider credentials, egress or ingestion execution. No rollback is performed here.

## Verification and remaining gates

Synthetic regression tests exercise actual installed OpenAI SDK with mocked
HTTP transport and assert zero requests on denial, including PDF/parser and FAQ
update entrypoints. Tests cover chunk revocation, fresh ownership, caller retries,
production binding, redirects and all four SDK console methods/arguments.
PDF extraction is mocked locally; no uploaded customer document is used.

Transaction failure tests run the real DatabaseService transaction wrapper,
VectorService upsert and KnowledgeSourcesService ready method over a synthetic
PoolClient. They observe BEGIN/ROLLBACK and retained old knowledge for chunk or
ready-write failure. This is not a real PostgreSQL run; unchanged database
transaction regressions provide the separate wrapper baseline.

One independent-review P2 (validation HTTP 400 accidentally converted to 502)
was fixed with a regression for empty FAQ/manual/template content and PDF reupload.
Final gate counts and content hashes are recorded in the task completion report.
No production CI/Docker/deploy gate is claimed for this uncommitted local package.

Remaining pilot blockers include explicit ingestion/reindex grant provisioning,
the separately scoped preview-query review, provider-free website live-indexing
activation, and `EXTERNAL_IPV6_PROBE_REQUIRED`. Server, guard and network
configuration remain unchanged. Streaming token accounting and cost-model work
remain separate tasks.
