# Security Diff Scan Template

Use:
- `$codex-security:security-diff-scan`
- compare `origin/main..HEAD`

Focus:
- authentication
- authorization
- tenant and site isolation
- public widget data leaks
- DB or SQL surfaces
- secrets
- network access
- filesystem access

Instructions:
- do not modify the checkout
- return prioritized findings only
- if there are no findings, state that explicitly

Output:
1. findings by severity
2. residual risks
3. recommendation
