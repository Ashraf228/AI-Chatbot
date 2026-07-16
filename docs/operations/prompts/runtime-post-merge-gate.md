# Runtime Post-Merge Gate Template

Use:
- `docs/operations/prompts/post-merge-check.md`

Specialization:
- `Change-Klasse: PURE_API_BOUNDARY` or `API_RUNTIME_UNWIRED`
- verify exact squash commit
- run `scripts/ops/codex-main-ci-gate.sh --sha <squash>` first
- if the script returns `pass`, Main-CI gate is satisfied
- if the script returns `waiting`, wait for CI
- if the script returns `failed`, block the gate
- if the script returns `unavailable`, use the approved Docker fallback path
- do not try local Docker when the daemon is not available
- no deploy release without exact gate evidence
