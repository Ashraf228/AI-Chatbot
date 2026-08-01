# Knowledge Provider Approval Storage Schema 1 Report

## Summary

- run_id: `knowledge-provider-approval-storage-schema-1`
- run_type: `knowledge_provider_approval_storage_schema`
- scope_decision: `approval_storage_schema_added`
- approval storage schema added: yes
- approval audit table added: yes
- revocation schema added: yes
- runtime gate lookup schema support added: yes
- guided customer demo: `still_blocked`
- self-service customer demo: `blocked`
- real pilot: `blocked`

## Scope Decision

- Implemented as additive schema only.
- The repo already had a clear migration pattern and a stable approval-policy contract to anchor the field set.
- No runtime wiring, no provider call, and no production DB execution were required.

## Migration File

- Added: `apps/api/migrations/030_provider_approval_storage_schema.sql`
- Production execution: no
- Destructive SQL: no
- Seeded approval rows: no

## Approval Grants Table

- Added durable `provider_approval_grants`
- Tenant/site/source scoped
- Provider/model/environment scoped
- Deny-first booleans remain `false`
- Validity window and revocation fields present
- No secrets, credentials, raw content, or embeddings

## Approval Audit Events Table

- Added durable `provider_approval_audit_events`
- Audit covers create/update/revoke/expire/check/deny and provider/embedding block-start-complete-fail events
- Tenant/site scoped
- Request/correlation IDs included
- No raw content, embeddings, or credentials

## Revocation Support

- `revoked_at`, `revoked_by`, and `revocation_reason` are durable
- Revocation metadata is required when a grant is marked revoked
- No runtime revoke action was added here

## Runtime Gate Lookup Support

- Future lookup can filter on tenant/site/source/provider/model/environment
- Active lookup and expiry/revocation indexes were added
- Default deny remains preserved
- Website embedding remains blocked without later storage lookup plus a valid active grant

## Still Blocked

- no approval runtime service
- no approval API endpoints
- no approval grants created
- no provider call
- no embeddings
- no RAG
- no deploy
- no public widget activation
- no guided customer demo enablement
- no self-service demo enablement
- no real pilot enablement

## Safety Confirmation

- no production migration
- no customer data
- no production data
- no credentials
- no passwords
- no fake source attribution
- no screenshots or recordings

## Recommended Next Step

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1-D`
- Follow-up after merge: `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-LOOKUP-1`
