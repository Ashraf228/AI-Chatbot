# Site-Runtime LLM Generation Grant Contract

Migration `033_site_runtime_llm_generation_grant_contract.sql` extends the
database contract for `provider_approval_grants`. The separate runtime package
wires that contract to the existing OpenAI generation boundary. Migration 033
permits a second exact `site_runtime` pair:

- `purpose = query_embedding` with `usage_contexts = ["query_embedding"]`;
- `purpose = llm_generation` with `usage_contexts = ["llm_generation"]`.

The existing source-scope constraint still requires `source_id IS NULL` and an
empty `source_types` array for both pairs. Query embedding and LLM generation are
separate permissions: a row for one purpose does not authorize the other.

## Runtime Enforcement

Every normal or streamed generation attempt requires one active persisted grant
with the server-derived tenant, an existing site owned by that tenant, and these
exact bindings:

- `scope_kind = site_runtime`, no source ID, and an empty source-types array;
- `purpose = llm_generation` with `usage_contexts = ["llm_generation"]`;
- provider `openai`, the normalized request model, and the resolved deployment
  environment;
- current validity, no revocation, customer-data and provider-DPA approval, and
  production approval when the environment is production.

Query-embedding, ingestion, source, source-type, role, feature, and operator
permissions do not authorize LLM generation. There is no wildcard, approval
cache, legacy fallback, automatic grant creation, renewal, or activation.

`LlmService` validates one runtime configuration and performs a fresh ownership
and grant lookup before every logical call reaches the SDK. The exact normalized
model is used by both lookup and request. The only allowed endpoint is
`https://api.openai.com/v1`; another configured endpoint fails closed, request
targets are checked, redirects are rejected, SDK retries are disabled with
`maxRetries: 0`, and SDK logging stays disabled with `logLevel: 'off'` even when
`OPENAI_LOG` requests debug output.

Denials use a fixed public message. Widget streaming also projects thrown and
pipeline errors to a fixed message, while internal logging records only the site
and whether a response chunk had already been written.

## Runtime Path Matrix

| Entry | Server-side context | Grant check | SDK transport | Failure/stream behavior |
| --- | --- | --- | --- | --- |
| `ChatService` | Site lookup supplies tenant and site | Fresh LLM grant in `LlmService.answer` | One fixed-endpoint normal request | Denial occurs before transport |
| `WidgetChatService.sendMessage` | Site key resolves tenant and site | Fresh LLM grant in `LlmService.answer` | One fixed-endpoint normal request | Fixed public denial |
| `WidgetChatService.streamMessage` | Site key resolves tenant and site | Fresh LLM grant in `LlmService.streamAnswer` | One fixed-endpoint streamed request | Stream errors are projected and the stream ends once |
| `EvaluationService` | Persisted evaluation access supplies tenant and site | Fresh LLM grant in `LlmService.answer` | One fixed-endpoint normal request | Evaluation mode is not an authorization bypass |

All entries converge on `ChatPipelineService`; it passes only its normalized,
server-derived tenant and site into the shared provider boundary. A future retry,
fallback, model, provider, or client path must re-enter the same fresh gate before
each outgoing attempt.

## Migration Audit

Migration 033 performs no `INSERT`, `UPDATE`, or `DELETE`. It validates existing
site-runtime purpose/usage pairs and overlapping active LLM-generation windows
before replacing the query-only purpose and usage checks. It preserves the
query-embedding exclusion constraint from migration 032 and adds a second
partial exclusion constraint for active LLM-generation rows.

Both exclusion constraints bind `tenant_id`, `site_id`, `provider_key`, `model`,
and `environment`. They use half-open validity ranges, so adjacent windows are
allowed and overlapping windows for the same purpose are rejected. A query grant
and an LLM grant may coexist for the same binding because their purposes differ.

The production migration runner executes the migration SQL and its
`schema_migrations` entry in one transaction. A failed validation or constraint
creation therefore leaves no migration-033 tracking row or partial 033
constraint. `ALTER TABLE` requires an appropriate maintenance window and can
wait for concurrent table users.

## Preflight and Migration Plan

Operational use requires a separate database-change approval. Before that
change, run `scripts/ops/site-runtime-grant-preflight.sql` in a read-only
transaction and require every count to be zero. The preflight reports only
technical counts; it does not select tenant, site, grant, or evidence values.

The approved migration procedure must:

1. confirm the intended database, backup/restore point, migration runner build,
   and required `ALTER TABLE` privileges;
2. stop or fence grant writers for the migration window;
3. run the read-only preflight and resolve any non-zero count under a separate
   data-change authorization;
4. apply the immutable migration through the production migration runner;
5. verify migration tracking and all query/LLM purpose, usage, and overlap
   constraints before any later runtime phase is considered.

This repository package does not perform those operational steps.

## Backfill

No backfill is required. Migration 032 admits only query-embedding
`site_runtime` rows, and migration 033 neither creates LLM grants nor
reinterprets an existing row. Existing valid query grants remain unchanged.
Any incompatible historical row blocks the migration rather than being repaired
or coerced automatically.

## Rollback and Forward Recovery

The migration runner has no down-migration path. Do not edit or delete the
historical `schema_migrations` entry and do not rewrite migration 033 after it has
been applied.

Schema rollback requires a separately reviewed forward-recovery migration. It
must first stop LLM-grant writers and prove that no `llm_generation` row remains,
including revoked rows. Removal or retention decisions for such rows require a
separate data-change and restore plan; rows must never be converted into query
grants. The forward-recovery migration can then atomically drop the LLM overlap
constraint and restore the query-only purpose and usage checks under its own new
migration number.

Application/runtime rollback is a separate concern. Code from before this
runtime boundary does not enforce the LLM-generation grant, so grant revocation
alone cannot make a rollback to that code safe. Before such a rollback, provider
traffic must be blocked independently of this application gate and the block
must be verified from every affected runtime. A separately authorized operator
must use a tested credential revocation, a tested egress block to the provider,
or stop and keep stopped all generation-capable runtime instances. A configuration
change without verified effect is not a traffic-blocking proof.

Provider traffic may resume only after gate-enforcing application code is
restored, its exact build and configuration are verified, the independent block
remains effective during startup, and a separately authorized check confirms the
intended grant before that block is removed. Migration 033 itself adds no grant writer or activation. The separate fixed-purpose
administration routes are documented in [the operator transport contract](site-runtime-grant-operator-transport.md).
Deploying those routes does not create grants or provision operator capabilities.

This migration and its tests are not a staging, production, provider,
public-widget, enterprise, pilot, or runtime activation approval.
