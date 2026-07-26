# Demo Workspace Agent Builder 1 Report

## Summary

- run_id: `demo-workspace-agent-builder-1`
- run_type: `admin_demo_workspace_builder_mvp`
- dashboard agent builder added: yes
- runtime pilot endpoint: `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`
- public widget activation: no
- production activation: no
- deploy: no
- persistence: no
- customer data: no
- production data: no
- DB / SQL / Query Runner: no
- provider calls: no
- ticket / email / webhook delivery: no

## Scope

This step adds an admin/operator-only Demo Workspace Agent Builder MVP inside the dashboard setup flow.

The MVP:

- captures structured demo-agent context in the dashboard only
- builds an in-memory runtime-pilot request
- uses the existing admin conversation-engine runtime-pilot endpoint
- shows engine state, selected agent, next action, missing fields, response draft, activation boundary, and side-effect boundary

The MVP does not:

- persist agent configuration
- touch the public widget runtime
- activate production runtime
- write to the database
- execute SQL
- call a query runner
- call external providers
- deliver tickets, emails, or webhooks
- upload PDFs or knowledge sources
- deploy anything

## Files Added Or Changed

- `apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx`
- `apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts`
- `apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx`
- `apps/dashboard/components/customer/setup-wizard/index.ts`
- `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- `apps/dashboard/test/ConversationEngineRuntimePilotRoute.test.tsx`
- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- `apps/api/src/conversation-engine/conversation-engine.controller.ts`
- `apps/api/test/conversation-engine-runtime-pilot.test.cjs`

## Runtime Pilot Endpoint Usage

The existing safe runtime-pilot endpoint remains the only execution path:

- `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`
- admin/operator scoped only
- synthetic/in-memory request payload only
- test mode only
- no public activation
- no production activation

The API change is limited to an in-memory demo-workspace profile override for the preview request body. No database schema, no persistence, and no public runtime wiring were added.

## Dashboard Behavior

The new card lives in the admin test area of the setup wizard launch step alongside the existing assistant-profile and conversation-engine preview tools.

The request captures:

- assistantName
- companyContext
- assistantRole
- targetAudience
- tone
- allowedTasks
- blockedTasks
- handoffAllowed
- ticketAllowed
- requiredFields
- syntheticKnowledgeSnippets
- testMessage

The response shows:

- intent
- goal
- stage
- selectedAgentKey
- nextAction
- shouldHandoff
- missingFields
- responseDraft
- activationBoundary
- sideEffects

## Activation Boundary

- `public_widget_activation: false`
- `production_activation: false`
- `deploy_used: false`
- `persistence_enabled: false`
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

## Safety Confirmation

- no persistence
- no customer data
- no production data
- no DB writes
- no SQL
- no Query Runner
- no provider calls
- no ticket / email / webhook delivery
- no public widget activation
- no production activation
- no deploy

## Known Limitations

- MVP only
- in-memory / not persisted
- no PDF upload
- no Knowledge upload
- no public widget activation
- no production activation
- no customer data
- not Enterprise-ready
- not Production-ready
- `PASS_WITH_PARTIALS` remains a caveat

## Relationship to Runtime Pilot

- Builds on `CONV-ENGINE-RUNTIME-PILOT-1`
- Uses the existing runtime-pilot endpoint
- Does not expand runtime activation
- Does not deploy
- Does not publish to widget

## Required Follow-up

Validated locally:

- `npm run build:api`: PASS
- `node --test apps/api/test/conversation-engine-runtime-pilot.test.cjs`: PASS
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx apps/dashboard/test/ConversationEngineRuntimePilotRoute.test.tsx apps/dashboard/test/CustomerSetupWizard.test.tsx`: PASS
- `npm run check:all`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`: PASS
- `git diff --check`: PASS

## Recommended Next Step

Recommended next step:

- `DEMO-WORKSPACE-TESTCHAT-1`

Alternatives:

- `DEMO-WORKSPACE-KNOWLEDGE-UPLOAD-1`
- `CONV-ENGINE-SYNTHETIC-EVAL-FIX-2`
