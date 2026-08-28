# Knowledge Website Embedding Ingest State Fix 1 Report

## Summary

- Run ID: `knowledge-website-embedding-ingest-state-fix-1`
- Baseline: `6127caa27d59e405c15f7294096fd548b1bf7624`
- Scope decision: `website_embedding_ingest_denied_state_cleanup_fixed`
- API state fix added: yes
- Denied ingest leaves embeddings: no
- Failed ingest leaves embeddings: no
- Restore scope: current run, current source, updated chunks only
- Unrelated sources preserved: yes
- P2 mock-adapter hardening completed: no
- P2 follow-up required: yes

## Root Cause

- The website embedding ingest path could update one or more chunks before a later deny or failure result.
- That made it possible to keep persisted embeddings or metadata drift even though the source ended blocked or failed.

## Fix Summary

- The service now snapshots each chunk immediately before persistence.
- On later deny/fail outcomes it restores the original chunk content, metadata, content hash, and embedding.
- The rollback happens before `markBlocked(...)` or `markFailed(...)` completes.
- No schema, package, workflow, dashboard, or widget change was needed.

## Verified Behaviors

- Missing grant before writes: blocked, no persisted state drift
- Adapter failure before writes: failed, no persisted state drift
- Mid-run failure after earlier write: restored
- Later gate denial after earlier write: restored
- Retrieval/source-attribution verification failure after write: restored
- Foreign source chunk state: preserved

## Remaining Boundary Note

- This task reviewed the mock-adapter boundary but did not add a stronger structural no-side-effect guarantee for arbitrary caller-provided adapters.
- The service still relies on explicit injection, `mode = mock`, and lack of external wiring.
- Stronger adapter hardening remains a separate follow-up task.

## Checks

- `scripts/ops/codex-preflight.sh`: PASS
- `npm run build:api`: PASS
- `node apps/api/test/provider-approval-policy.test.cjs`: PASS
- `node apps/api/test/provider-embedding-gate.test.cjs`: PASS
- `node apps/api/test/provider-approval-storage-lookup.test.cjs`: PASS
- `node apps/api/test/ingest.service.test.cjs`: PASS
- `node apps/api/test/website-embedding-ingest.service.test.cjs`: PASS
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `npm run check:all`: PASS
- `git diff --check`: PASS

## Safety Status

- No live provider calls
- No live embeddings
- No RAG activation
- No public widget activation
- No production activation
- No customer data
- No production data
- No secrets

## Next Step

- Recommended next task: `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-STATE-FIX-1-D`
- Post-merge follow-up: `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-STATE-FIX-1-E`
- Optional hardening follow-up: `KNOWLEDGE-WEBSITE-EMBEDDING-MOCK-ADAPTER-HARDENING-1`
