# PR Review And Merge Template

Use:
- `AGENTS.md`
- `docs/operations/*`

Inputs:
- `Task: <TASK_ID>`
- `PR: #<number>`
- `Head commit: <sha>`
- `Expected files:`
- `Special constraints:`

Instructions:
- verify base branch, head SHA, and diff scope
- confirm no unexpected files, secrets, SQL, DB surfaces, or runtime drift
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
8. recommendation for the post-merge check
