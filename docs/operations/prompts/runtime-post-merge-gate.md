# Runtime Post-Merge Gate Template

Use:
- `docs/operations/prompts/post-merge-check.md`

Specialization:
- `Change-Klasse: PURE_API_BOUNDARY` or `API_RUNTIME_UNWIRED`
- verify exact squash commit
- if Main-CI is not visible, use the approved Docker fallback path
- do not try local Docker when the daemon is not available
- no deploy release without exact gate evidence
