# Summary

This run fixes the doc-only gate wrapper so committed PR diffs can be evaluated with an explicit base/head context instead of silently falling back to an empty clean-worktree diff.

# Root Cause

`scripts/ops/codex-doc-only-gate.sh` previously collected only worktree, staged, and untracked changes, then invoked `scripts/ops/codex-sensitive-scan.sh` without `--base/--head`. On a clean committed PR branch this produced `no changed files to scan` although the PR diff against `origin/main` was non-empty.

# Fix Summary

- Added `--base` and `--head` support to `scripts/ops/codex-doc-only-gate.sh`.
- Added `CODEX_DIFF_BASE` and `CODEX_DIFF_HEAD` support.
- Added automatic `origin/main` to `HEAD` merge-base diff detection when that committed diff is non-empty.
- Forwarded the resolved merge-base/head context to `scripts/ops/codex-sensitive-scan.sh`.
- Preserved the existing worktree, staged, and untracked fallback path.
- Preserved the existing doc-only policy and sensitive-scan policy.

# Base / Head Contract

Resolution priority is:

1. CLI `--base/--head`
2. Env `CODEX_DIFF_BASE/CODEX_DIFF_HEAD`
3. Automatic `origin/main` merge-base diff when available and non-empty
4. Worktree, staged, and untracked fallback

When a ref-based context is active, the gate uses the merge-base to compute changed paths and forwards that same merge-base/head pair into the sensitive scan.

# Backward Compatibility

- Clean committed PR branches can now be scanned with a real committed diff context.
- Local uncommitted doc-only worktree changes still work without args.
- Staged and untracked fallback remains intact.
- Non-doc paths still block the gate.
- Truly empty diffs still allow `no changed files to scan`.

# Test Scenarios

- Scenario A: committed doc-only branch with explicit `--base origin/main --head HEAD` -> PASS
- Scenario B: committed doc-only branch with automatic `origin/main` detection -> PASS
- Scenario C: uncommitted local doc-only change without args -> PASS
- Scenario D: non-doc local change without args -> FAIL as expected
- Scenario E: clean no-diff baseline without args -> PASS with `no changed files to scan`

Scenarios B-E were validated in an isolated local clone whose `origin/main` was advanced to the fix baseline to simulate the post-merge environment without changing the real repository state.

# PR #249 Isolation

- PR #249 content was not changed.
- PR #249 was not merged.
- No approval, authorization, record creation, or validation artifact was created.
- No runtime, API, dashboard, widget, workflow, package, config, or deploy scope was added.

# Safety Boundaries

- No customer data
- No production data
- No PII
- No secrets
- No credentials
- No deploy
- No public widget activation
- No production activation
- No provider calls
- No embeddings
- No RAG
- No DB reads or writes

# Follow-up

Next gate task after PR review:

- `DOC-ONLY-GATE-SENSITIVE-SCAN-BASE-HEAD-FIX-1-D`

Follow-up after merge and post-merge check:

- `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-APPROVAL-GRANT-CREATION-PATH-1-D2`
