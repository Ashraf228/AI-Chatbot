# Knowledge Provider Approval Storage Lookup Report

## Summary

- Scope decision: `approval_storage_lookup_implemented`
- Read-only provider approval storage lookup added: yes
- Provider gate integrated with storage lookup: yes
- Production migration executed: no
- Approval grants created: no
- Guided customer demo: `still_blocked`
- Self-service customer demo: `blocked`
- Real pilot: `blocked`

## Scope Decision

- Variant A was implemented.
- The storage schema already existed on `main`.
- A read-only runtime lookup was safe without adding a migration, dependency, API, or provider execution path.

## Lookup Model

- Reads from `provider_approval_grants` only.
- Matches on tenant, site, source type, usage context, environment, provider, and model.
- Excludes revoked, expired, and future-invalid grants.
- Prefers source-specific grants over site-wide grants.
- Uses deterministic ordering.

## Provider Policy Revalidation

- A loaded grant is normalized into the existing provider approval policy contract.
- The existing contract remains the technical authority for allow vs deny.
- No silent allow path was added.

## Default Deny

- No storage grant: denied
- Invalid or malformed grant: denied
- Expired or revoked grant: denied
- Production without explicit production approval: denied
- DB lookup failure: denied with sanitized reason

## Gate Integration

- `IngestService.evaluateWebsiteRuntimeIndexingGate(...)` can now load a stored grant before evaluating the existing gate.
- A valid stored grant can allow the gate decision only.
- The allow path still does not call any provider, generate embeddings, or add a ready transition.

## Tenant / Site Boundary

- Lookup remains hard tenant-bound and site-bound.
- Cross-tenant and cross-site grants remain blocked.

## Revocation / Expiry Boundary

- Revoked grants remain blocked.
- Expired grants remain blocked.
- Future grants remain blocked.

## Still Blocked

- No approval write path
- No approval API
- No provider calls
- No embeddings
- No RAG
- No `runtime_readiness = ready`
- No deploy
- No public widget activation
- No customer-data or production approval claim

## Safety Confirmation

- No production migration
- No approval grant creation
- No approval audit writes
- No provider calls
- No embeddings
- No RAG
- No customer data
- No production data
- No credentials

## Recommended Next Step

- immediate review step: `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-LOOKUP-1-D`
- after merge: `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3`
