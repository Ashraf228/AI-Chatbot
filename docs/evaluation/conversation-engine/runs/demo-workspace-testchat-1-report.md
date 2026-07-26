# Demo Workspace Testchat 1 Report

## Summary

- run_id: `demo-workspace-testchat-1`
- run_type: `admin_demo_workspace_in_memory_testchat_mvp`
- dashboard testchat added: yes
- runtime pilot endpoint: `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`
- dashboard proxy: `POST /api/sites/:siteId/conversation-engine/runtime-pilot`
- public widget activation: no
- production activation: no
- deploy: no
- persistence: no
- chat history persistence: no
- agent config persistence: no
- customer data: no
- production data: no
- DB / SQL / Query Runner: no
- provider calls: no
- ticket / email / webhook delivery: no

## Scope

This step extends the existing Demo Workspace Agent Builder with a controlled in-memory test chat for admin/operator use inside the dashboard setup flow.

The MVP:

- keeps the agent configuration synthetic and in-memory only
- keeps the chat transcript in browser state only
- sends each user turn through the existing runtime-pilot dashboard proxy
- renders the response draft, engine state, next action, missing fields, activation boundary, and side-effect boundary for every turn
- allows clearing the transcript by deleting local browser state only

The MVP does not:

- persist agent configuration
- persist chat history
- touch the public widget runtime
- activate production runtime
- write to the database
- execute SQL
- call a query runner
- call external providers
- deliver tickets, emails, or webhooks
- upload PDFs or knowledge sources
- deploy anything

## Dashboard Testchat Integration Point

The feature is implemented as an extension of:

- `apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx`

The card now contains:

- safety banner for the testchat scope
- transcript list for prior local turns
- message input
- send button
- clear in-memory chat button
- latest engine-state / response-draft / boundary panels

The launch-step integration point stays unchanged and remains admin/operator only.

## Runtime Pilot Endpoint Usage

The testchat continues to use the existing safe runtime-pilot flow:

- Dashboard proxy: `POST /api/sites/:siteId/conversation-engine/runtime-pilot`
- Backend endpoint: `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`

No API contract extension was required for this step because the existing request already supports:

- `message`
- `history`
- `demoWorkspace`
- `existingConversationState`
- `knowledgeSnippets`

## In-Memory Chat State Boundary

- chat transcript is held only in React browser state
- prior turns are passed back as in-memory `history`
- clearing the chat deletes only local UI state
- no server-side session or DB storage is introduced

## Activation Boundary

- `public_widget_activation: false`
- `production_activation: false`
- `deploy_used: false`
- `agent_config_persistence_enabled: false`
- `chat_history_persistence_enabled: false`
- `pdf_upload_enabled: false`
- `knowledge_upload_enabled: false`

## Side Effects Boundary

- `ticket_delivery_used: false`
- `email_delivery_used: false`
- `webhook_delivery_used: false`
- `provider_calls_used: false`
- `db_write_used: false`
- `sql_used: false`
- `query_runner_used: false`

## Test Scenarios

Validated locally:

- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`: PASS
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/ConversationEngineRuntimePilotRoute.test.tsx apps/dashboard/test/CustomerSetupWizard.test.tsx`: PASS
- `npm run build:api`: PASS
- `node --test apps/api/test/tool-executor.service.test.cjs`: PASS
- `node --test apps/api/test/conversation-engine-runtime-pilot.test.cjs apps/api/test/conversation-engine-preview.test.cjs apps/api/test/conversation-engine-synthetic-routing-fix.test.cjs`: PASS
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm run check:all`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`: PASS
- `git diff --check`: PASS

## Known Limitations

- MVP only
- in-memory only
- no persistence
- no public widget activation
- no production activation
- no PDF upload
- no knowledge upload
- no customer data
- not enterprise approved
- not production ready

## Relationship to Agent Builder

- builds directly on `DEMO-WORKSPACE-AGENT-BUILDER-1`
- reuses the same runtime-pilot request path
- keeps the same admin/operator-only boundary
- does not expand runtime activation
- does not add persistence
- does not add deployment capability

## Recommended Next Step

Recommended next step:

- `DEMO-WORKSPACE-KNOWLEDGE-UPLOAD-1`

Still blocked without separate approval:

- public widget activation
- production activation
- persistence
- customer data
- production data
- real tickets / emails / webhooks
- PDF / knowledge uploads
