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

## Previous Failure

- The earlier required dashboard regression gate was red.
- The failing symptoms matched the blocked schema-task context:
- multiple `Test timed out in 5000ms`
- `fetchMock` was observed more often than expected
- expected UI texts such as `Erste Demo-Antwort` and `Demo FAQ` were not found
- the regression correctly blocked `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1`

## Reproduction

- The focused Vitest file reproduced red on clean `origin/main`.
- Reproduction happened before any schema-task continuation.
- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` remained stopped throughout this regression-fix task.
- The clean-main reproduction was sufficient to classify the issue as a real regression in test stability rather than a transient local worktree issue.

## Root Cause

- The regression was test-side, not component-side.
- Several cases used long `userEvent.type(...)` sequences against controlled inputs with default values.
- The same cases asserted immediately after async state transitions, which made the suite timing-sensitive.
- No evidence was found for:
- a component/runtime bug
- duplicate runtime side effects
- incorrect API payload construction
- broken PDF-extract/runtime-pilot wiring
- provider execution
- deploy/public-widget/production behavior changes

## Fix Applied

- Changed test file only:
- `apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- Replaced long `userEvent.type(...)` sequences with direct field updates where keyboard semantics are not under test.
- Kept `userEvent` where upload or interaction semantics still matter.
- Added deterministic button-click helpers.
- Added `waitFor(...)` / `findBy...` synchronization around async config/runtime result assertions.
- Preserved the existing boundary assertions and regression coverage:
- config-save payload boundaries
- config-load/reset boundaries
- snippet add/upload flow
- runtime-pilot request/response rendering
- multi-turn in-memory transcript behavior

## Test Coverage

- `DemoWorkspaceAgentBuilderCard` focused regression test remains covered.
- The broader dashboard regression batch remains covered.
- Existing safety/boundary assertions remain covered for:
- no persistence of knowledge/PDF/chat
- no public widget activation
- no deploy
- no production activation
- no real ticket/email/webhook execution
- no customer-data path
- API regression coverage stayed green after the test-only fix.

## Unchanged Boundaries

- no API code change
- no runtime code change
- no migration
- no schema change
- no widget code change
- no provider call
- no embeddings
- no RAG
- no website crawling
- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no package or lockfile change

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` was not resumed in this PR.
- The next step after merge/post-merge remains:
- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1-RESUME`
- Still blocked after this PR:
- no deploy
- no public widget activation
- no enterprise approval
- no customer data
- no production data
- no production secrets
- no provider/embedding/RAG execution scope

## Safety Boundaries

- no provider calls
- no embeddings
- no RAG
- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no password creation/change
- no DB_READ_ONLY_AUDIT
- no Query Runner
- no website crawling
- no screenshots or recordings
