# PR Review And Merge Template

Use:
- `AGENTS.md`
- `docs/operations/*`
- `docs/operations/codex-review-security-diff-scan-policy.md`

Inputs:
- `Task: <TASK_ID>`
- `PR: #<number>`
- `Head commit: <sha>`
- `Expected files:`
- `Special constraints:`

Instructions:
- determine the change class first
- use the review matrix to decide whether a security diff scan is optional, recommended, or mandatory
- verify base branch, head SHA, and diff scope
- confirm no unexpected files, secrets, SQL, DB surfaces, or runtime drift
- for `DOKU_ONLY`, require a security diff scan only when risk indicators such as workflow, secret, auth, tenant, widget, DB, webhook, or config implications are present
- for `CI_WORKFLOW_ONLY`, require a workflow-safety-oriented security diff scan
- for `AUTH_RBAC`, `TENANT_ISOLATION`, `PUBLIC_WIDGET`, `WEBHOOK_DELIVERY`, and `DELIVERY_EXECUTION`, require a security diff scan before merge
- for `DB_READ_ONLY_AUDIT`, `MIGRATION`, `CLEANUP_BACKFILL`, and `PRODUCTION_CONFIG`, require both security diff scan and explicit Human Approval
- if the matrix requires a security diff scan, run it or verify its result before merge
- if a required security diff scan is missing, stop the merge
- if the security diff scan returns blockers, stop the merge
- if Human Approval is required and missing, stop the merge
- wait for the required CI gates to finish green
- rerun or inspect local mandatory checks if needed
- if clean, post a short validation summary and squash merge
- do not delete the branch unless explicitly requested

Output:
1. status
2. PR status after merge
3. squash commit SHA
4. branch deleted: yes/no
5. CI results
6. local check results
7. diff confirmation
8. security diff scan status
9. human approval status, if required
10. recommendation for the post-merge check
