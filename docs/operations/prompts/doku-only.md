# DOKU_ONLY Template

Use:
- `AGENTS.md`
- `docs/operations/*`

Inputs:
- `Task: <TASK_ID>`
- `Change-Klasse: DOKU_ONLY`
- `Ziel: <goal>`
- `Expected files:`
- `Special constraints:`

Instructions:
- change only documentation files in the declared scope
- do not modify runtime code, scripts, migrations, SQL, config, or secrets
- confirm non-goals explicitly
- run `scripts/ops/codex-doc-only-gate.sh`
- if the task is PR-based, verify the diff contains only expected files
- if the task is post-merge, verify the exact merge or squash commit

Output:
1. status
2. changed files
3. documented state
4. checks
5. secrets found: yes/no
6. security status
7. next recommended step
