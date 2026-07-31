# Knowledge Provider Embedding Gate

## Summary

- Audit date: Thursday, July 30, 2026
- Baseline: `59e3812261c021122dbad517784b302b8677e62d`
- Scope: add a hard provider/embedding approval gate for later website runtime indexing without calling a provider
- Scope decision: `embedding_gate_implemented`
- This task does not call a provider
- This task does not generate embeddings
- This task does not run RAG
- This task does not grant customer-data approval
- This task does not grant production approval
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous Blocker

- `KNOWLEDGE-WEBSITE-RUNTIME-INDEXING-1` documented that imported website content stays provider-free and therefore outside the real retrieval path.
- The productive chat path still creates query embeddings before vector retrieval.
- The preview retrieval path still creates query embeddings before vector retrieval.
- Website imports therefore need an explicit provider/embedding decision before any truthful runtime indexing can happen.

## Scope Decision

- Variant A is implementable.
  - Provider-backed embedding usage already has identifiable callsites.
  - Website runtime indexing is not executed today, so a future website-specific execution path can be forced through a dedicated gate now.
  - No migration is required.
  - No new dependency is required.
- The implemented boundary is intentionally default-deny.
  - Without explicit scoped approval, website runtime indexing is blocked before any future provider/embedding work can begin.
  - The gate can acknowledge a fully scoped mock approval in tests without executing any provider call.

## Provider / Embedding Risk Model

- Provider calls are external data egress.
- Embeddings can transmit customer-maintained website content to an external model provider.
- A real approval therefore needs at least:
  - provider and model
  - tenant and site scope
  - usage context
  - production vs non-production boundary
  - customer-data approval
  - retention/logging/redaction expectations
- This task models those requirements technically but does not grant them.

## Gate Model

- New pure gate utility:
  - `apps/api/src/knowledge-sources/provider-embedding-gate.ts`
- Supported usage contexts:
  - `website_ingest_runtime_indexing`
  - `knowledge_reindex`
  - `query_embedding`
- Current enforced integration point:
  - `IngestService.evaluateWebsiteRuntimeIndexingGate(...)`
- Gate inputs:
  - tenant id
  - site id
  - source id
  - source type
  - usage context
  - actor role
  - environment
  - explicit approval payload
- Gate outputs:
  - `allowed`
  - `reason`
  - `decisionCode`
  - `sanitizedMessage`

## Default Deny Behavior

- Default remains `not_granted`.
- Unknown usage contexts are denied.
- Website runtime indexing for non-URL sources is denied.
- Missing tenant/site scope is denied.
- Production usage without explicit production approval is denied.
- Usage without customer-data approval is denied.
- Usage without an explicit provider/model selection is denied.

## Website Runtime Indexing Boundary

- Website imports remain provider-free after fetch and extraction.
- Website imports still do not become `runtime_readiness = ready`.
- Website imports still do not become retrieval-ready automatically.
- The new `IngestService.evaluateWebsiteRuntimeIndexingGate(...)` boundary blocks a website runtime-indexing attempt by default and marks the source blocked for that attempt.
- No provider call is executed during that boundary evaluation.
- No embedding is generated during that boundary evaluation.
- No vector write is executed during that boundary evaluation.
- No completion rule is widened.

## Tenant / Site Boundary

- The gate requires tenant and site scope.
- Approval may be narrowed to a specific tenant and site.
- A mismatched tenant or site keeps the decision denied.
- No cross-tenant or cross-site widening is introduced.

## Data / Privacy Boundary

- This task does not claim legal approval.
- This task does not approve customer data for provider usage.
- This task does not approve production provider usage.
- This task does not approve retention, logging, or deletion policies.
- It only prevents silent provider/embedding usage from being treated as implicitly allowed.

## Dashboard Impact

- No dashboard code was required.
- No operator toggle was added.
- No provider settings UI was added.
- No product claim about automatic website indexing was added.

## Authorization Boundary

- No new endpoint was introduced.
- No authorization-matrix expansion was required.
- Existing admin/operator boundaries remain unchanged.

## Tests Added

- `apps/api/test/provider-embedding-gate.test.cjs`
  - default deny
  - unknown context deny
  - unsupported source-type deny
  - production approval deny
  - customer-data approval deny
  - fully scoped mock approval allow
- `apps/api/test/ingest.service.test.cjs`
  - website runtime-indexing gate denies by default without provider calls
  - website runtime-indexing gate can acknowledge explicit approval without executing provider work

## Known Limitations

- The gate does not itself execute website embeddings.
- The gate does not itself index website chunks into the retrieval path.
- Existing non-website embedding callsites were not globally rewritten in this task.
- A later website runtime-indexing execution task still has to call this gate before any provider-backed embedding work.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-1`
  - implement the future website embedding/indexing execution path
  - require this gate before any provider call
  - keep `runtime_readiness` non-ready until the real indexing step succeeds

## Safety Boundaries

- No deploy
- No public widget activation
- No production activation
- No enterprise approval
- No customer data
- No production data
- No credentials
- No passwords
- No provider calls
- No embeddings
- No RAG
- No query runner
- No website crawling changes
- No fake source attribution
- No automatic `ready` transition
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
