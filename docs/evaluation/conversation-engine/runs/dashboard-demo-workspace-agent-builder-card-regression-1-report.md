# Dashboard Demo Workspace Agent Builder Card Regression 1 Report

## Summary

- run_id: `dashboard-demo-workspace-agent-builder-card-regression-1`
- run_type: `dashboard_test_regression`
- scope_decision: `regression_fix_implemented`
- baseline sha: `1c7bda5a2711cb9559a572adc1722341eb6528d3`
- reproduced on clean `origin/main`: yes
- component/runtime bug proven: no
- test-only fix: yes
- recommended next task: `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1-RESUME`

## Scope Decision

- Implemented.
- The blocking regression was reproduced on clean main and fixed without changing dashboard runtime or API behavior.

## Root Cause

- The failure came from test instability.
- Long `userEvent.type(...)` sequences against controlled inputs plus immediate assertions after async state updates made the suite timing-sensitive.
- No component bug, runtime payload bug, or route-contract bug had to be introduced to explain the failures.

## Files Changed

- `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- `docs/evaluation/dashboard/dashboard-demo-workspace-agent-builder-card-regression.md`
- `docs/evaluation/conversation-engine/runs/dashboard-demo-workspace-agent-builder-card-regression-1-report.json`
- `docs/evaluation/conversation-engine/runs/dashboard-demo-workspace-agent-builder-card-regression-1-report.md`

## Fix Applied

- Added small test helpers for deterministic field updates and button clicks.
- Replaced fragile long typing flows with direct field updates where keyboard semantics are not under test.
- Added explicit async synchronization around config-save/load/reset and runtime-pilot result assertions.
- Preserved the original boundary assertions and regression coverage.

## Safety Confirmation

- no dashboard runtime change
- no API change
- no schema change
- no migration
- no provider calls
- no DB reads or writes
- no deploy
- no customer data
- no production data
- no secrets
- no package or lockfile changes

## Validation

- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`: PASS
- dashboard batch vitest: PASS
- `npm run build:api`: PASS
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm run check:all`: PASS
- API regression node tests: PASS
- `scripts/ops/codex-preflight.sh`: PASS
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `git diff --check`: PASS

## Resume Recommendation

- Resume `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` in a fresh worktree.
