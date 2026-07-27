# Demo Workspace Config Persistence 1

## Summary
Adds admin/operator-only Demo Workspace agent config persistence for the existing setup-wizard builder.

## Scope
- Admin/operator demo workspace only.
- Site-bound config persistence only.
- No customer data.
- No production data.
- No deploy.

## Storage Path / Existing Config Mechanism
- Existing storage mechanism: `site_modules`
- Existing module key reused: `conversation-engine-tests`
- Existing site-scoped config path extended with a dedicated namespace:
  - `site_modules[conversation-engine-tests].config.demoWorkspaceConfig`
- No new table.
- No schema migration.
- No package or lockfile changes.

## Persisted Fields
- `assistantName`
- `companyContext`
- `assistantRole`
- `targetAudience`
- `tone`
- `allowedTasks`
- `blockedTasks`
- `handoffAllowed`
- `ticketAllowed`
- `requiredFields`
- metadata:
  - `source`
  - `updatedAt`
  - `updatedByRole`
  - explicit false-boundary flags for customer data, knowledge persistence, chat history persistence, public widget activation, and production activation

## Explicitly Not Persisted
- Knowledge snippets
- Uploaded text files
- Uploaded markdown files
- Uploaded JSON files
- Uploaded PDF files
- Extracted PDF text
- Chat transcript
- Test message
- Runtime pilot response
- Response draft
- Engine state
- Customer data
- Production data
- Secrets or tokens

## API Endpoints
- `GET /admin/sites/:siteId/conversation-engine/demo-workspace/config`
- `PUT /admin/sites/:siteId/conversation-engine/demo-workspace/config`
- `DELETE /admin/sites/:siteId/conversation-engine/demo-workspace/config`

## Dashboard Integration
- Dashboard proxy route:
  - `GET /api/sites/:siteId/conversation-engine/demo-workspace/config`
  - `PUT /api/sites/:siteId/conversation-engine/demo-workspace/config`
  - `DELETE /api/sites/:siteId/conversation-engine/demo-workspace/config`
- `DemoWorkspaceAgentBuilderCard` now exposes:
  - `Save demo config`
  - `Load saved config`
  - `Reset saved config`
- UI caveats remain explicit:
  - only config is saved
  - knowledge, PDFs, and chat are not saved
  - no deploy
  - no public widget activation

## Authorization Boundary
- Admin/operator only.
- Site-bound via existing dashboard-session and admin-scope checks.
- No viewer access.
- No public access.

## Activation Boundary
- No public widget activation.
- No production activation.
- No deploy.
- No feature-flag activation.

## Side Effects Boundary
- Limited DB write scope:
  - demo agent config only
- No SQL query runner.
- No provider calls.
- No ticket delivery.
- No email delivery.
- No webhook delivery.

## Privacy / Data Boundary
- No customer data.
- No production data.
- No knowledge persistence.
- No PDF content persistence.
- No extracted text persistence.
- No chat history persistence.
- No file storage.
- No embeddings.
- No RAG indexing.

## Known Limitations
- Persistence is limited to the synthetic demo builder config.
- Knowledge, PDF, and chat data remain request-local or browser-local only.
- This MVP does not activate or publish any runtime path.
- This MVP is not an enterprise or production approval.

## Relationship to Agent Builder / Testchat / Knowledge Upload
- Builds on `DEMO-WORKSPACE-AGENT-BUILDER-1`
- Preserves the in-memory-only boundaries from:
  - `DEMO-WORKSPACE-TESTCHAT-1`
  - `DEMO-WORKSPACE-KNOWLEDGE-UPLOAD-1`
  - `DEMO-WORKSPACE-PDF-KNOWLEDGE-UPLOAD-1`
- Reuses the existing admin test storage surface instead of introducing a new schema

## Recommended Next Step
- `DEMO-WORKSPACE-KNOWLEDGE-PERSISTENCE-1`
- or `DEMO-WORKSPACE-PILOT-GUIDE-1`
- or `CONV-ENGINE-SYNTHETIC-EVAL-FIX-2`
