# Conversation Engine Runtime Pilot Report

## Summary

- run_id: `conv-engine-runtime-pilot-1`
- run_type: `local_runtime_pilot_no_side_effects`
- runtime integration: admin-only test/demo path
- public widget activation: no
- production activation: no
- deploy: no
- customer data: no
- production data: no
- DB / SQL / Query Runner: no
- provider calls: no
- tickets / emails / webhooks: no

## Scope

This run prepares a controlled Conversation Engine runtime path under the existing admin-only API surface:

- `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`
- admin/operator scoped only
- test mode only
- no public widget activation
- no production activation
- no runtime deploy

The runtime pilot uses:

- assistant profile resolution from the existing admin preview/test path
- in-memory conversation-engine preview
- in-memory response draft generation
- optional synthetic knowledge snippets from the request body only

The runtime pilot does not use:

- knowledge DB retrieval
- SQL
- Query Runner
- external providers
- ticket creation
- email delivery
- webhook delivery

## Runtime Integration Point

The safe integration point is the existing NestJS admin conversation-engine controller in `apps/api/src/conversation-engine/conversation-engine.controller.ts`.

The new route stays inside the already guarded `AdminKeyGuard` and `admin/operator` scope. It does not touch the public widget runtime, the legacy chat pipeline, dashboard widget APIs, or any deploy path.

## Feature Flag / Activation Boundary

- activation mode: `admin_test_only`
- required boundary: existing conversation-engine admin test mode
- public widget activation: `false`
- production activation: `false`
- deploy required: `false`

The route is intentionally blocked unless response preview and admin-test-only mode are active in the existing conversation-engine test configuration.

## Side Effects Boundary

All side effects remain hard-disabled:

- no ticket delivery
- no email delivery
- no webhook delivery
- no provider calls
- no DB access for new logic
- no SQL
- no Query Runner
- no customer-site mutation

The runtime result explicitly reports these boundaries as `false`.

## Test Scenarios

Validated locally:

1. dashboard support problem
2. explicit human request
3. complaint route
4. blocked query-runner / production-data / deploy request
5. identity question (`Bist du ein Mensch?`)
6. vague unknown request
7. simulated ticket field collection

Local test results:

- `npm run build:api`: PASS
- `node --test apps/api/test/conversation-engine-runtime-pilot.test.cjs`: PASS
- `node --test apps/api/test/conversation-engine-preview.test.cjs`: PASS
- `node --test apps/api/test/conversation-engine-synthetic-routing-fix.test.cjs`: PASS

## Safety Confirmation

- no public widget activation
- no production activation
- no deploy
- no customer data
- no production data
- no DB access for new logic
- no SQL
- no Query Runner
- no tickets / emails / webhooks
- no external provider calls
- no real reports with customer data

## Known Limitations

- this is not a deploy approval
- this is not a production activation
- this is not a public widget activation
- this is not enterprise readiness
- this is not customer-data approval
- this does not reduce the remaining `PASS_WITH_PARTIALS` follow-up set from the synthetic evaluation stream
- response wording still follows the current draft service behavior; this task only prepares the safe runtime path

## Relationship to Synthetic Eval Fix

The previous synthetic evaluation fix remains:

- outcome: `PASS_WITH_PARTIALS`
- total: `50`
- pass: `26`
- partial: `24`
- fail: `0`
- critical: `0`

This runtime pilot does not claim that the remaining partial cases are solved. It only makes the improved engine available in a tightly controlled admin/test runtime path with no side effects.

## Recommended Next Step

Recommended next step:

- `DEMO-WORKSPACE-AGENT-BUILDER-1`

Alternative quality-first next step:

- `CONV-ENGINE-SYNTHETIC-EVAL-FIX-2`

Still blocked after this step:

- deploy
- public widget activation
- enterprise approval
- customer-data use
- production-data use
- DB_READ_ONLY_AUDIT
- real execution jobs with side effects
