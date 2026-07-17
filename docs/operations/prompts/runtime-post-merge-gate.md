# Runtime Post-Merge Gate Template

Use:
- `docs/operations/prompts/post-merge-check.md`

Specialization:
- `Change-Klasse: PURE_API_BOUNDARY` or `API_RUNTIME_UNWIRED`
- verify exact squash commit
- run `scripts/ops/codex-main-ci-gate.sh --sha <squash>` first
- if direct GitHub main-push CI is visible for the exact squash commit, document it before any fallback
- if the script returns `pass`, Main-CI gate is satisfied
- if the script returns `waiting`, wait for CI
- if the script returns `failed`, block the gate
- if the script returns `unavailable`, use the approved Docker fallback path in `.github/workflows/docker-fallback-gate.yml`
- do not try local Docker when the daemon is not available
- the Docker fallback remains build-only, was validated by dry-run run `29590305888`, uses `workflow_dispatch` plus exact `target_sha`, and may use only `.env.example`
- no deploy release without exact gate evidence
