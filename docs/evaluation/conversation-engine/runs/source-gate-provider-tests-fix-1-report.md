# Summary

This run fixes the provider approval source-gate failure by making policy time evaluation deterministic when a controlled timestamp is supplied.

# Root Cause

The provider approval policy compared `validFrom` against the live runtime clock. The smoke tests use fixed fixture dates and expect future `validFrom` values to stay denied relative to a controlled test timestamp.

# Fix Scope

- added optional `now` support to provider approval policy evaluation
- forwarded `now` through storage-backed approval evaluation
- added optional `now` support to provider embedding gate evaluation
- kept the fix scoped to the affected API source and test files
- added this security/report documentation

# Timebase Fix

- explicit `now` is accepted as `Date`, `string`, or epoch `number`
- runtime default remains `Date.now()` when `now` is omitted
- tests now exercise the deterministic timebase intentionally
- `not_yet_valid` behavior for future `validFrom` remains unchanged

# Test Results

- provider approval storage lookup test: PASS
- provider embedding gate test: PASS
- smoke tests: PASS
- security audit: PASS
- authorization matrix: PASS
- security boundaries: PASS
- build:api: PASS
- check:dashboard: PASS
- build:dashboard: PASS
- check:all: PASS
- sensitive scan: PASS
- `git diff --check`: PASS

# Safety Boundaries

- no provider calls
- no live LLM calls
- no embeddings
- no RAG
- no approval grants
- no authorization records
- no customer data
- no production data
- no secrets or credentials
- no deploy
- no public widget activation
- PR #228 unchanged

# Follow-up

- next gate task: `SOURCE-GATE-PROVIDER-TESTS-FIX-1-D`
- after merge and post-merge check: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-EXTERNAL-AUDIENCE-APPROVAL-PATH-1-D`
