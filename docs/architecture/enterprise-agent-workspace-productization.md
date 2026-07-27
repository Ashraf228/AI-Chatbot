# Enterprise Agent Workspace Productization

## Summary

This step productizes the existing admin/operator Demo Workspace into a clearer Enterprise Agent Workspace / Pilot Workspace shell inside the dashboard setup flow.

The scope is intentionally limited:

- admin/operator only
- existing runtime-pilot test path only
- existing demo config persistence only
- no public widget activation
- no deploy
- no customer data
- no production data
- no knowledge, PDF, or chat persistence

## Current Workspace Capabilities

The current workspace bundles these existing capabilities:

- agent configuration
- save/load/reset for demo agent configuration
- in-memory test chat
- text/Markdown/JSON knowledge snippets in browser state
- PDF demo knowledge upload with request-local extraction
- runtime-pilot response, intent, goal, stage, and boundary review
- pilot guide / structured evaluation references

## Productization Goal

The goal of this step is not new runtime power. The goal is a clearer evaluation shell that presents the existing capabilities as one controlled pilot workspace instead of a loose feature collection.

The productized workspace should make these boundaries explicit:

- Agent Config persisted: yes
- Knowledge/PDF/Chat persisted: no
- No public widget activation
- No deploy
- No customer data
- No enterprise approval yet

## Workspace Flow

The productized workspace uses this explicit evaluation flow:

1. Configure agent
2. Save/load config
3. Add demo knowledge
4. Test conversation
5. Review response and boundaries
6. Use pilot guide for structured feedback

## Persisted vs In-Memory Data

### Persisted

- demo agent configuration only
- existing storage path only via `site_modules[conversation-engine-tests].config.demoWorkspaceConfig`

### In-Memory / Request-Local Only

- text snippets
- Markdown snippets
- JSON snippets
- extracted PDF text
- active knowledge snippet list
- test chat transcript
- runtime pilot test turns

No new knowledge persistence, PDF persistence, chat persistence, file storage, embeddings, or RAG indexing is introduced.

## Security Boundaries

- admin/operator dashboard surface only
- existing runtime-pilot endpoint only
- existing demo workspace config endpoints only
- existing PDF extract endpoint only
- no public widget runtime activation
- no production activation
- no deploy path
- no customer data
- no production data
- no provider calls
- no ticket, email, or webhook delivery
- no DB migration
- no new persistence surface

The current dependency-security state remains:

- production-context audit: PASS
- root/dashboard PostCSS technically fixed on `8.5.23`
- Next-internal PostCSS remains accepted temporarily, not fixed until `2026-08-20`

## Not Production Ready Yet

This workspace is still an evaluation shell only. It does not claim:

- production readiness
- enterprise approval
- customer-data approval
- public-widget readiness
- deploy approval

## Required Future Gates

The following future gates remain separate:

- Knowledge Persistence
- Public Widget Activation
- Real Customer Pilot Approval
- Deploy Approval
- Data Protection Review

## Recommended Next Steps

Recommended next steps after this productization:

- `DEMO-WORKSPACE-KNOWLEDGE-PERSISTENCE-1`
- or `ENT-PILOT-READINESS-GATE-1`

Until then, the workspace stays a controlled pilot shell with config-only persistence and in-memory evaluation data.
