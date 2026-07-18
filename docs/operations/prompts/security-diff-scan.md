# Security Diff Scan Template

Use:
- `$codex-security:security-diff-scan`
- `docs/operations/codex-review-security-diff-scan-policy.md`
- compare `origin/main..HEAD`

Before running:
- determine the change class
- use the policy matrix to decide whether the scan is optional, recommended, or mandatory

Focus:
- authentication
- authorization
- tenant and site isolation
- public widget data leaks
- DB or SQL surfaces
- secrets
- network access
- filesystem access
- webhooks, HMAC, and replay protection
- unsafe logging and PII exposure
- feature flags and Production config
- migrations, cleanup, backfill, and enforcement
- workflow permissions, environments, OIDC, and `pull_request_target`

Instructions:
- do not modify the checkout
- return prioritized findings only
- classify findings as blocker, high, medium, low, or informational
- if there are no findings, state that explicitly

Output:
1. summary
2. findings
3. blockers
4. required follow-ups
5. scope confirmation
6. security status
7. decision
