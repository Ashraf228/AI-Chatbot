# Dashboard Demo Workspace Agent Builder Card Regression

## Summary

- Audit date: Saturday, August 1, 2026
- Baseline: `1c7bda5a2711cb9559a572adc1722341eb6528d3`
- Scope: isolate and fix the blocking dashboard regression around `DemoWorkspaceAgentBuilderCard`
- Reproduced on clean `origin/main`: yes
- Scope decision: `regression_fix_implemented`
- Runtime/component bug proven: no
- Test-only fix: yes
- Dashboard/API/schema/provider/deploy scope expanded: no

## Reproduced Failure

- The focused Vitest file reproduced red on clean `origin/main`.
- The failing symptoms matched the earlier blocked schema task:
- 5-second test timeouts in config-save and runtime-pilot cases
- unstable textarea/input values during load/reset checks
- missing expected result texts such as `Erste Demo-Antwort`
- exact-call-count assertions becoming brittle around async UI state

## Root Cause

- The regression was test-side, not component-side.
- Several cases used long `userEvent.type(...)` sequences against controlled inputs with default values.
- The same cases asserted immediately after async state transitions, which made the suite sensitive to render timing.
- No evidence was found for:
- duplicate runtime side effects
- incorrect API payload construction
- broken PDF-extract/runtime-pilot wiring
- dashboard runtime behavior regression in the component itself

## Implemented Fix

- Changed only:
- `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- Added deterministic helpers for direct field updates and button clicks.
- Replaced fragile long typing flows with direct `fireEvent.change(...)` where the test intent is field-state setup, not keyboard behavior.
- Added `waitFor(...)` / `findBy...` synchronization around async config/runtime result assertions.
- Preserved the existing behavioral coverage:
- config-save payload boundaries
- config-load/reset boundaries
- snippet add/upload flow
- runtime-pilot request/response rendering
- multi-turn in-memory transcript behavior

## Safety Boundary

- no API code change
- no component runtime change
- no schema change
- no migration
- no provider calls added
- no DB reads/writes added
- no deploy
- no customer data
- no production data
- no secrets
- no package or lockfile change

## Validation

- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`: PASS
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx apps/dashboard/test/ConversationEngineDemoWorkspaceConfigRoute.test.tsx apps/dashboard/test/ConversationEnginePdfExtractRoute.test.tsx apps/dashboard/test/ConversationEngineRuntimePilotRoute.test.tsx apps/dashboard/test/CustomerSetupWizard.test.tsx`: PASS
- `npm run build:api`: PASS
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm run check:all`: PASS
- `node --test apps/api/test/provider-approval-policy.test.cjs`: PASS
- `node --test apps/api/test/provider-embedding-gate.test.cjs`: PASS
- `node --test apps/api/test/ingest.service.test.cjs`: PASS
- `node --test apps/api/test/website-ingest.test.cjs`: PASS
- `node --test apps/api/test/knowledge-source-readiness.test.cjs`: PASS
- `node --test apps/api/test/knowledge-retrieval.service.test.cjs`: PASS
- `node --test apps/api/test/conversation-engine-runtime-pilot.test.cjs`: PASS
- `node --test apps/api/test/site-status.service.test.cjs`: PASS
- `scripts/ops/codex-preflight.sh`: PASS
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `git diff --check`: PASS

## Resume Decision

- The regression blocker is cleared.
- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` should resume in a fresh worktree.

## Recommended Next Step

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1-RESUME`
