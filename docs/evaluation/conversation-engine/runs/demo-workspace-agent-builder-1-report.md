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

## API Boundary

The existing safe runtime-pilot endpoint remains the only execution path:

- `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`
- admin/operator scoped only
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

- `DEMO-WORKSPACE-AGENT-BUILDER-1-D`
