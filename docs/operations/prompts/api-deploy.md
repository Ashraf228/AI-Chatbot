# API Deploy Template

Use:
- `AGENTS.md`
- `docs/operations/*`

Inputs:
- `Task: <TASK_ID>`
- `Change-Klasse: DEPLOY_ONLY`
- `Target commit: <sha>`
- `Pre-approved gate evidence:`
- `Rollback point:`

Instructions:
- do not deploy unless the exact target commit has already passed the required gate
- document the pre-deploy baseline
- perform only the approved deploy scope
- verify post-deploy health, synthetic checks, and drift guards
- document side effects, rollback need, and next status task

Output:
1. status
2. target commit
3. deploy action summary
4. post-deploy health
5. side effects
6. rollback needed: yes/no
7. next recommended step
