# Knowledge Website Embedding Ingest State Fix 1

## Summary

- Audit date: Friday, August 28, 2026
- Baseline: `6127caa27d59e405c15f7294096fd548b1bf7624`
- Scope: fix denied/failed website embedding ingest so partially persisted embedding state is rolled back before a blocked or failed result is stored
- Scope decision: `website_embedding_ingest_denied_state_cleanup_fixed`
- No live provider call was added
- No live embeddings were added
- No RAG activation was added
- No public widget or production activation was added

## Previous Risk

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3` added a mock-only internal ingest path for already extracted website sources.
- The path rechecked approval lookup and provider gate before each chunk update.
- A mid-run failure or later denial could still leave earlier chunk metadata and embeddings persisted.
- That state drift was not acceptable because `blocked` or `failed` ingest outcomes must not leave reusable indexed state behind.

## Fix Decision

- The fix stays inside the existing API ingest service.
- No schema change was needed.
- No new dependency was needed.
- The service now snapshots the original state of each chunk immediately before persistence.
- On later denial, verification failure, dimension failure, or thrown ingest error, the service restores only the chunks that were already updated in the current run.
- Restore scope is limited to the current source's already-updated chunk ids.
- Unrelated chunks from other sources remain untouched.

## State Safety Rules

- Missing or invalid grant before any write: no restore needed, no persisted change
- Adapter failure before any write: no restore needed, no persisted change
- Failure after one or more writes: persisted chunk state is restored before `markFailed(...)`
- Gate denial after one or more writes: persisted chunk state is restored before `markBlocked(...)`
- Retrieval/source-attribution verification failure: persisted chunk state is restored before the source stays not-ready

## What Was Not Changed

- No controller or dashboard trigger was added
- No live provider adapter was added
- No provider approval grant creation was added
- No production approval path was added
- No deploy path was added
- No dashboard/widget/workflow/script/package change was added

## P2 Boundary Review

- The mock-adapter boundary was reviewed.
- This task does not claim that every caller-supplied mock adapter is structurally incapable of external side effects.
- The current protection remains:
  - explicit adapter injection
  - `mode = mock` requirement
  - no default live adapter wiring in this service
  - no controller route that exposes the service
- A separate follow-up is still required if the repo wants stronger adapter-side-effect constraints beyond current scope.

## Test Intent

- The updated tests now prove:
  - no persisted state remains after denial before any write
  - no persisted state remains after adapter failure before any write
  - no persisted state remains after mid-run failure
  - no persisted state remains after later gate denial
  - unrelated source chunks are preserved
  - ready transition is still blocked on retrieval/source-attribution failure

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-STATE-FIX-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-STATE-FIX-1-E`
- Optional hardening follow-up: `KNOWLEDGE-WEBSITE-EMBEDDING-MOCK-ADAPTER-HARDENING-1`
