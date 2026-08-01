# Knowledge Provider Approval Storage Lookup

## Summary

- Audit date: Saturday, August 1, 2026
- Baseline: `f66919a9b151ae95b259913858a6697aab01b0d4`
- Scope: add a read-only provider approval storage lookup and connect it to the existing website runtime indexing gate
- Scope decision: `approval_storage_lookup_implemented`
- Production migration executed: no
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `provider-approval-policy.ts` already modeled the technical approval contract.
- `provider-embedding-gate.ts` already enforced default deny against caller-supplied in-memory approvals only.
- `030_provider_approval_storage_schema.sql` added durable storage for grants and audit events, but no runtime lookup existed.
- `IngestService.evaluateWebsiteRuntimeIndexingGate(...)` could acknowledge only synthetic caller-supplied approvals and otherwise remained blocked.

## Scope Decision

- Variant A was safe to implement.
- The storage schema already exists on `main`.
- Existing DB access patterns are clear and parameterized.
- No new dependency, migration, API endpoint, provider call, embedding execution, or deploy step is needed for a read-only lookup.

## Lookup Model

- Added read-only service: `apps/api/src/knowledge-sources/provider-approval-storage-lookup.service.ts`
- The service reads from `provider_approval_grants` only.
- It does not write grants.
- It does not write audit events.
- It does not call providers.
- It does not generate embeddings.
- It does not run RAG.

## Lookup Query Rules

- Hard scope required:
  - `tenant_id`
  - `site_id`
  - `provider_key`
  - `model`
  - `environment`
  - `source_type`
  - `usage_context`
- Additional rules:
  - `revoked_at IS NULL`
  - `valid_from <= now`
  - `expires_at > now`
  - `customer_data_approved = true`
  - `provider_dpa_approved = true`
  - in production: `production_approved = true`
- Source matching:
  - source-specific grant preferred first
  - site-wide grant with `source_id IS NULL` allowed as fallback
- Deterministic ordering:
  - source-specific before site-wide
  - newer `valid_from` before older entries
  - newer `created_at` before older entries
- SQL remains parameterized.
- No untrusted value is interpolated into SQL text.

## Storage Grant Mapping

- DB row fields are normalized into the existing `ProviderApprovalPolicy` contract:
  - `id -> approvalId`
  - `tenant_id -> tenantId`
  - `site_id -> siteId`
  - `source_id -> sourceId`
  - `source_types -> sourceTypes`
  - `usage_contexts -> usageContexts`
  - `provider_key -> provider`
  - `embedding_dimension -> embeddingDimension`
  - `provider_region -> providerRegion`
  - `customer_data_approved -> customerDataApproved`
  - `production_approved -> productionApproved`
  - `provider_dpa_approved -> providerDpaApproved`
  - `retention_policy -> retentionPolicy`
  - `redaction_policy -> redactionPolicy`
  - `logging_policy -> loggingPolicy`
  - `deletion_policy -> deletionPolicy`
  - `reindex_policy -> reindexPolicy`
  - `rate_limit -> rateLimit`
  - `cost_limit -> costLimit`
  - `valid_from -> validFrom`
  - `expires_at -> expiresAt`
  - `revoked_at -> revokedAt`
  - `approved_by -> approvedBy`
  - `approval_evidence_ref -> approvalEvidenceRef`
- Malformed JSON arrays or invalid timestamps are rejected and treated as non-allowing grants.

## Provider Approval Policy Revalidation

- The read-only lookup does not bypass the existing policy contract.
- Loaded grants are normalized and then revalidated through `provider-approval-policy.ts`.
- Allow requires:
  - storage lookup match
  - policy contract validation pass
- Missing or malformed storage data remains denied.

## Default Deny Behavior

- No storage lookup service available: denied unless an explicit synthetic approval is injected by tests.
- No matching grant: denied.
- Expired grant: denied.
- Revoked grant: denied.
- Future `valid_from`: denied.
- Tenant/site/source/provider/model/environment mismatch: denied.
- Missing customer-data / DPA / production approvals: denied.
- Malformed policy payload: denied.
- DB error: denied with sanitized message.

## Gate Integration

- `IngestService.evaluateWebsiteRuntimeIndexingGate(...)` now optionally loads a stored approval before calling the existing embedding gate.
- The integration is read-only.
- A valid stored grant can allow a gate decision only.
- The allow decision still does not:
  - call any provider
  - generate embeddings
  - run RAG
  - change completion state
  - set `runtime_readiness = ready`
- The deny path still blocks website embedding when no valid active grant exists.

## Tenant / Site Boundary

- Lookup is always tenant-bound and site-bound.
- No tenantless or siteless approval can match.
- No cross-tenant wildcard exists.
- No cross-site wildcard exists.

## Source Scope Boundary

- Source-specific grants are preferred when available.
- Site-wide grants remain source-safe only within the same tenant/site scope.
- No source from another tenant/site can satisfy the lookup.

## Revocation / Expiry Boundary

- Revoked grants are excluded by query and denied by contract if encountered.
- Expired grants are excluded by query and denied by contract if encountered.
- Future grants are excluded by query and denied by contract if encountered.
- No stale allow path was added.

## Production Approval Boundary

- Production still requires explicit `production_approved = true`.
- A non-production grant cannot silently allow production.
- This task does not grant production approval.

## No Provider / No Embedding Boundary

- No provider call was made.
- No embedding was generated.
- No RAG execution was added.
- No website embedding ingest was executed live.
- No `runtime_readiness = ready` transition was added.

## Tests Added

- Added: `apps/api/test/provider-approval-storage-lookup.test.cjs`
  - parameterized SQL assertion
  - no grant denied
  - malformed grant denied
  - revoked / expired / future denied
  - cross-tenant / cross-site / source mismatch denied
  - usage / provider / model / environment mismatch denied
  - customer-data / DPA / production approval missing denied
  - valid synthetic grant allowed
  - DB error sanitized and denied
  - deterministic source-specific ordering encoded in query
- Extended: `apps/api/test/provider-embedding-gate.test.cjs`
  - site-wide policy without `sourceId` can still satisfy the existing contract for the same tenant/site
- Extended: `apps/api/test/ingest.service.test.cjs`
  - valid stored grant can allow the gate decision without provider work

## Known Limitations

- No approval create/revoke API exists yet.
- No approval write service exists yet.
- No audit-write path exists yet.
- No live provider execution path exists yet.
- No embedding runtime job exists yet.
- Website embedding still stays blocked without a valid active storage grant.

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-LOOKUP-1-D`
  - review the read-only lookup PR
- after merge: `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3`
  - wire a later execution path that still revalidates before any live provider work

## Safety Boundaries

- Read-only lookup implemented: yes
- No production migration executed
- No approval grants created
- No approval API endpoints implemented
- No approval write service implemented
- No provider call
- No embeddings
- No RAG
- No provider approval claimed
- No customer-data approval claimed
- No production approval claimed
- Default remains denied
- Without a valid active storage grant, website embedding remains blocked
- Valid storage grant allows gate decision only, not live execution
- No `runtime_readiness = ready`
- No deploy
- No public widget
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
