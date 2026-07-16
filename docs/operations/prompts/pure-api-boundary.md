# PURE_API_BOUNDARY Template

Use:
- `AGENTS.md`
- `docs/operations/*`

Inputs:
- `Task: <TASK_ID>`
- `Change-Klasse: PURE_API_BOUNDARY`
- `Ziel: <goal>`
- `Expected files:`
- `Focused test command: <command>`
- `Adjacent regression commands:`
- `Special constraints:`

Instructions:
- keep the change runtime-unwired unless the task explicitly allows more
- do not add SQL, DB reads or writes, query runners, reports with live data, or production wiring
- run `scripts/ops/codex-pure-api-boundary-gate.sh --focused-test "<command>" --regression-test "<command>"`
- verify the diff stays inside the declared boundary files and tests
- confirm no secrets, no unexpected runtime surfaces, and no PR-foreign changes

Output:
1. status
2. implemented boundary
3. files changed
4. checks
5. security status
6. remaining deferred areas
7. next recommended step
