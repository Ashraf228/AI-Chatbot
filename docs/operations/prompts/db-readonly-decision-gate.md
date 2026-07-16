# DB Read-only Decision Gate Template

Use:
- `AGENTS.md`
- `docs/operations/*`

Inputs:
- `Task: <TASK_ID>`
- `Change-Klasse: DOKU_ONLY / AUDIT_ONLY / DECISION_GATE`
- `Scope: <goal>`
- `Decision questions:`

Instructions:
- document only the approval state, preconditions, allowed future query classes, output policy, and stop criteria
- do not execute SQL
- do not run DB reads or writes
- do not add query runners, reports with data, cleanup, backfill, or enforcement
- explicitly state what remains not granted

Output:
1. status
2. decision summary
3. approval matrix
4. forbidden areas
5. checks
6. next recommended step
