# Summary

This fix removes the provider approval timebase dependency on the live runtime clock for deterministic source-gate testing.

# Root Cause

The provider approval policy evaluated `validFrom`, `expiresAt`, and `revokedAt` against `Date.now()`. The source-gate smoke tests expect a controlled fixture timestamp. Once the real date moved past the fixture's `validFrom`, the `not_yet_valid` assertions stopped being true and the source gate failed on `origin/main`.

# Fix Decision

The policy evaluation path now accepts an optional explicit `now` timebase. Runtime callers still use the real clock by default. Tests and audit-style callers can pass a controlled timestamp.

# Scope

- `apps/api/src/knowledge-sources/provider-approval-policy.ts`
- `apps/api/src/knowledge-sources/provider-approval-storage-lookup.service.ts`
- `apps/api/src/knowledge-sources/provider-embedding-gate.ts`
- `apps/api/test/provider-approval-storage-lookup.test.cjs`
- `apps/api/test/provider-embedding-gate.test.cjs`
- this fix report and run report

No workflow, package, lockfile, migration, deploy, widget, or dashboard files were changed.

# Timebase Design

- `evaluateProviderApprovalPolicy()` now accepts optional `now`.
- Supported forms: `Date`, ISO-like `string`, or numeric epoch milliseconds.
- Invalid or missing `now` falls back to `Date.now()`.
- `evaluateStoredProviderApprovalGrant()` forwards the existing lookup `now`.
- `evaluateProviderEmbeddingGate()` accepts optional `now` and forwards it.
- Runtime behavior remains unchanged when no explicit timebase is provided.

# Affected Code Paths

- provider approval policy validation/evaluation
- storage-backed provider approval evaluation
- provider embedding gate evaluation

# Test Coverage

- future `validFrom` remains denied
- `decisionCode === "not_yet_valid"` remains required
- revoked remains denied
- expired remains denied
- tenant/site/source/provider/model mismatches remain denied
- default-deny behavior remains unchanged

# No Provider / No Embedding / No RAG Boundary

- No provider calls were added or executed.
- No embedding generation was added or executed.
- No RAG indexing or retrieval was added or executed.
- No live LLM calls were added or executed.

# No Approval / No Grant Boundary

- No approval grant was created.
- No authorization record was created.
- No authorization was granted.
- No policy rule was weakened.

# Security / Data Boundary

- No customer data used
- No production data used
- No PII introduced
- No secrets or credentials introduced
- No deploy or production activation
- PR #228 remains unchanged and documentation-only

# Validation

- targeted provider approval tests: PASS
- smoke tests: PASS
- production-context security audit: PASS
- authorization matrix: PASS
- security boundaries: PASS
- build:api: PASS
- check:dashboard: PASS
- build:dashboard: PASS
- check:all: PASS
- sensitive scan: PASS
- `git diff --check`: PASS

# Follow-up

Next gate task:

- `SOURCE-GATE-PROVIDER-TESTS-FIX-1-D`

After merge and post-merge check:

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-EXTERNAL-AUDIENCE-APPROVAL-PATH-1-D`
