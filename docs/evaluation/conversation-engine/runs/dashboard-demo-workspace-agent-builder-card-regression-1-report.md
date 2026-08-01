# Dashboard Demo Workspace Agent Builder Card Regression 1 Report

## Summary

- run_id: `dashboard-demo-workspace-agent-builder-card-regression-1`
- run_type: `dashboard_test_regression`
- scope_decision: `regression_fix_implemented`
- baseline failure reproduced: yes
- test stabilized: yes
- component code changed: no
- test code changed: yes
- dashboard/api/runtime/widget code changed: no
- guided customer demo: `still_blocked`
- self-service customer demo: `blocked`
- real pilot: `blocked`
- recommended next task: `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1-RESUME`

## Scope Decision

- Implemented.
- The blocking regression was reproduced on clean `origin/main` and fixed without changing runtime behavior.

## Root Cause

- The failure came from test instability.
- Long `userEvent.type(...)` sequences against controlled inputs plus immediate assertions after async state updates made the suite timing-sensitive.
- No component bug, runtime payload bug, provider bug, or route-contract bug had to be introduced to explain the failures.

## Files Changed

- `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- `docs/evaluation/dashboard/dashboard-demo-workspace-agent-builder-card-regression.md`
- `docs/evaluation/conversation-engine/runs/dashboard-demo-workspace-agent-builder-card-regression-1-report.json`
- `docs/evaluation/conversation-engine/runs/dashboard-demo-workspace-agent-builder-card-regression-1-report.md`

## Fix Applied

- Added deterministic field-update helpers.
- Kept the change test-only.
- Replaced fragile long typing flows where keyboard semantics are not under test.
- Added explicit async synchronization around config-save/load/reset and runtime-pilot result assertions.
- Kept schema work untouched.

## Safety Confirmation

- no API change
- no runtime change
- no migration
- no provider calls
- no embeddings
- no RAG
- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials

## Validation

- focused DemoWorkspaceAgentBuilderCard test: PASS
- dashboard regression batch: PASS
- `npm run build:api`: PASS
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm run check:all`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`: PASS
- report JSON validation: PASS
- `git diff --check`: PASS

## Resume Recommendation

- Resume `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` only after the D2 and E follow-up gates.
