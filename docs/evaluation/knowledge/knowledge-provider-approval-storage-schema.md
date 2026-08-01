# Knowledge Provider Approval Storage Schema

## Summary

- Audit date: Saturday, August 1, 2026
- Baseline: `b916636f5ece86e1690b58bef22b35ec097c9092`
- Scope: add a safe approval-storage schema for future provider/embedding grants and audit tracking
- Scope decision: `approval_storage_schema_added`
- Production migration executed: no
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-DESIGN-1` documented the required durable grant, revocation, and audit model.
- `provider-approval-policy.ts` and `provider-embedding-gate.ts` already enforce a default-deny runtime contract, but only against caller-supplied in-memory objects.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-2` remained blocked because no tenant/site-bound storage existed for active grants, expiry, revocation, or durable audit evidence.
- `DASHBOARD-REGRESSION-DEMO-WORKSPACE-AGENT-BUILDER-CARD-1` is fully green on `main`, so the previously blocked schema resume can proceed again from a clean baseline.

## Scope Decision

- Variant A was safe to implement.
- Existing migration numbering and SQL style are clear.
- Tenant/site/source foreign-key patterns already exist.
- The schema can be added additively without runtime wiring, provider calls, grant creation, or production execution.

## Migration File

- Added: `apps/api/migrations/030_provider_approval_storage_schema.sql`
- The migration is additive only.
- It creates durable storage for future provider approval grants and audit events.
- It does not execute in production in this task.
- It does not seed any approval row.

## Approval Grants Table

- Added table: `provider_approval_grants`
- Durable fields cover:
  - tenant/site/source scope
  - provider/model/environment scope
  - source type / usage context / data category lists
  - explicit customer-data / production / DPA booleans
  - purpose / retention / redaction / logging / deletion / optional reindex policy
  - rate / cost limits
  - validity window
  - revocation state
  - approval actor and evidence reference
- Default approval booleans remain `false`.
- The table stores no API keys, secrets, credentials, raw content, embeddings, or customer payloads.

## Approval Audit Events Table

- Added table: `provider_approval_audit_events`
- Durable fields cover:
  - tenant/site/source scope
  - optional grant linkage
  - actor / role
  - event type / decision code
  - provider / model / usage context
  - sanitized reason
  - request / correlation identifiers
  - created timestamp
- Supported event families include create/update/revoke/expire/check/deny plus provider-call and embedding-job block/start/complete/fail audit markers.
- The audit table stores no raw website content, embeddings, secrets, or credentials.

## Constraints / Indexes

- Grant constraints enforce:
  - non-empty tenant/site/provider/model/purpose/policy/evidence text fields
  - `environment IN ('production', 'non_production')`
  - non-empty JSONB arrays for `source_types`, `usage_contexts`, and `data_categories`
  - positive `embedding_dimension` when present
  - `expires_at > valid_from`
  - revocation metadata required when `revoked_at` is set
- Added grant indexes for:
  - tenant/site lookup
  - tenant/site/source lookup
  - active lookup
  - revoked lookup
  - expiry lookup
  - provider/model lookup
  - approval evidence lookup
- Added audit indexes for:
  - tenant/site/time
  - grant lookup
  - event type
  - request ID
  - correlation ID
  - source lookup
  - provider/model lookup

## Revocation Support

- Revocation fields are durable:
  - `revoked_at`
  - `revoked_by`
  - `revocation_reason`
- A record cannot be marked revoked without actor and reason metadata.
- Revocation remains schema support only in this task; no runtime revocation service or UI action was added.

## Runtime Gate Lookup Support

- The schema now supports a future durable lookup on:
  - tenant
  - site
  - optional source
  - provider
  - model
  - environment
  - validity window
  - revocation status
- Default deny remains preserved.
- Without a later storage lookup and a valid active grant, website embedding remains blocked.
- No `runtime_readiness = ready` transition was added here.

## API / Role Follow-up

- No approval storage runtime service was implemented.
- No approval API endpoints were implemented.
- No role mutation or approval workflow endpoint was added.
- Future follow-up still needs a server-side storage lookup and role-scoped write path.

## Dashboard / UI Follow-up

- No dashboard code changed.
- No widget code changed.
- No public widget activation changed.
- No UI now claims provider approval, customer-data approval, or production approval.

## Provider / Data / Privacy Boundary

- No provider call was made.
- No embedding was generated.
- No RAG/indexing execution was performed.
- No provider approval was granted.
- No customer-data approval was granted.
- No production approval was granted.
- No customer data was used.
- No production data was used.

## Tests Added

- Added: `apps/api/test/provider-approval-storage-schema.test.cjs`
- Static assertions cover:
  - migration file presence
  - grant/audit table presence
  - required fields
  - deny-first defaults
  - expiry/revocation constraints
  - required event names
  - required indexes
  - no destructive SQL
  - no seed insert
  - no secret-like columns

## Known Limitations

- This task does not implement:
  - approval runtime storage lookup
  - approval create/revoke APIs
  - grant creation
  - provider execution
  - embeddings
  - RAG
  - deploy
  - public widget activation
  - guided customer demo enablement
  - self-service demo enablement
  - real pilot enablement
- Overlapping active grants remain deferred to later service-layer validation; this migration does not add an unsafe uniqueness rule that could block legitimate source-scoped grants.

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1-D`
  - review the migration-only PR
- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-LOOKUP-1`
  - load active grants durably
  - revalidate before runtime provider usage
  - keep default deny when no valid grant exists

## Safety Boundaries

- No production migration
- No deploy
- No public widget
- No production activation
- No approval runtime service
- No approval API endpoints
- No approval grants created
- No provider call
- No embeddings
- No RAG
- No customer data
- No production data
- No credentials
- No passwords
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
