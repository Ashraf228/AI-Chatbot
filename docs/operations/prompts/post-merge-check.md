# Post-Merge Check Template

Use:
- `AGENTS.md`
- `docs/operations/*`

Inputs:
- `Task: <TASK_ID>`
- `PR: #<number>`
- `Squash or merge commit: <sha>`
- `Expected files:`
- `Required gates:`

Instructions:
- confirm the PR is merged and `origin/main` contains the exact target commit
- verify scope, safety constraints, and merge-commit diff
- verify required CI or Docker gates on the exact target commit
- if the change is documentation-only, confirm no runtime or deploy implication; if Main-CI is not visible, a documented `gruen mit Hinweis` path may still be valid
- if the change is runtime-related, run `scripts/ops/codex-main-ci-gate.sh --sha <target>` first and block deploy release until the exact gate is green

Output:
1. status
2. PR merged: yes/no
3. target commit SHA
4. gate summary
5. working tree and main summary
6. security status
7. deploy or next-step recommendation
