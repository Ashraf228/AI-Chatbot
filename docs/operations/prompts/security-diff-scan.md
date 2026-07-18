# Security Diff Scan Template

## Purpose

Security Diff Scan ist ein read-only Review-Gate fuer Sicherheits- und Freigaberisiken im Diff.

Der Scan:

- modifiziert den Checkout nicht
- ersetzt keine Tests
- ersetzt keine CI
- ersetzt kein Main-CI- oder Docker-Gate
- ersetzt kein Deploy-Gate
- erteilt keine automatische Approval

## Use

- `$codex-security:security-diff-scan`
- `docs/operations/codex-review-security-diff-scan-policy.md`
- compare `<base>..<head>`, standardmaessig `origin/main..HEAD`

## Required Inputs

- `Change class: <change_class>`
- `Base ref: <base>`
- `Head ref: <head>`
- `PR: #<number>`, falls vorhanden
- `Expected scope: <expected_scope>`
- `Forbidden areas: <forbidden_areas>`

## Before Running

- determine the change class
- use the policy matrix to decide whether the scan is optional, recommended, or mandatory
- confirm whether the declared scope is `DOKU_ONLY`, `PROCESS_TOOLING`, `CI_WORKFLOW_ONLY`, Runtime-, Widget-, Auth-, DB-, Migration-, Cleanup- oder Config-bezogen
- treat the scan as review only; no checkout mutation, no merge action, no deploy action

## Core Review Scope

Always review the diff for:

- authentication
- authorization
- tenant and site isolation
- public widget response leaks
- DB or SQL surfaces
- secrets
- webhooks, HMAC, and replay protection
- filesystem access
- network access
- unsafe logging
- PII exposure
- feature flags
- Production config
- migrations
- cleanup, backfill, and enforcement
- report and query-result outputs
- workflow permissions
- GitHub environments
- OIDC and cloud credentials
- `pull_request_target` usage

## Change-Class-Specific Focus

- `DOKU_ONLY`: keep the scan lightweight; focus on false implementation claims, hidden workflow/config implications, unsafe examples, and accidental approval drift
- `PROCESS_TOOLING`: focus on shell risk, secret handling, filesystem scope, networked automation, and dangerous defaults
- `CI_WORKFLOW_ONLY`: focus on `pull_request_target`, `id-token: write`, secrets usage, deployments, environments, OIDC, and workflow permission drift
- `PURE_API_BOUNDARY`: focus on auth, tenant isolation, DB/SQL surfaces, public outputs, and whether the diff stays boundary-only
- `API_RUNTIME_UNWIRED`: focus on hidden runtime coupling, auth, secrets, DB/SQL surfaces, side effects, and output leaks
- `API_RUNTIME_WIRED`: focus on runtime activation, side effects, auth, tenant isolation, public outputs, deploy coupling, and rollback risk
- `PUBLIC_WIDGET`: focus on public response shape, secret leaks, PII exposure, origin/rate-limit regressions, and hidden runtime activation
- `AUTH_RBAC`: focus on missing server-side authorization, role drift, privilege escalation, and unclear access matrices
- `TENANT_ISOLATION`: focus on tenant/site scoping, cross-tenant data access, unsafe resource lookup, and implicit shared-state assumptions
- `WEBHOOK_DELIVERY`: focus on HMAC, replay protection, secret usage, logging, callback handling, and untrusted payload flow
- `DELIVERY_EXECUTION`: focus on side effects, retries, idempotency, failure handling, and unintended execution paths
- `DB_READ_ONLY_AUDIT`: focus on hidden DB reads, SQL introduction, query-result outputs, reports with data, and missing Human Approval
- `MIGRATION`: focus on rollback/backup absence, unsafe migration scope, data loss risk, and undeclared runtime coupling
- `CLEANUP_BACKFILL`: focus on missing staged execution, rollback, approval, dry-run, and data mutation risk
- `PRODUCTION_CONFIG`: focus on secrets, environment drift, deployment permissions, config rollout risk, and missing Human Approval
- `DEPLOY_ONLY`: focus on undeclared scope drift, missing gate evidence, rollback weakness, and accidental runtime/config changes

## Mandatory Blockers

Treat the following as blockers:

- real secrets
- unplanned DB or SQL surface
- public widget leak
- unclear authentication, authorization, or tenant isolation
- unchecked Production config
- migration without rollback or backup
- cleanup or backfill without approval
- report with data
- query results committed into the repo
- missing Human Approval for `DB_READ_ONLY_AUDIT`, `MIGRATION`, `CLEANUP_BACKFILL`, or `PRODUCTION_CONFIG`
- workflow uses `pull_request_target`
- workflow uses `id-token: write` without documented approval
- workflow uses deployments or environments without documented approval
- workflow uses secrets without documented approval
- runtime wiring outside the declared scope
- Production wiring without explicit deploy or approval gate

## Instructions

- do not modify the checkout
- return prioritized findings only
- separate blockers from lower-severity observations
- classify findings as `blocker`, `high`, `medium`, `low`, or `informational`
- explicitly confirm whether the observed diff matches the declared change class
- if there are no findings, state that explicitly

## Standard Prompt Block

```text
Use security-diff-scan to review changes from <base> to <head> for security regressions.
Change class: <change_class>.
Expected scope: <expected_scope>.
Focus on authentication, authorization, tenant isolation, public widget leaks, DB/SQL surfaces, secrets, webhooks, filesystem/network access, unsafe logging, PII exposure, feature flags, Production config, migrations, cleanup/backfill/enforcement, report/query-result outputs, workflow permissions, GitHub environments, OIDC/cloud credentials, and pull_request_target usage.
Do not modify the checkout.
Return prioritized findings only.
Classify findings as blocker, high, medium, low, or informational.
If no findings, state explicitly that no findings were found.
Confirm whether the observed diff matches the declared change class.
```

## Output

1. summary
2. scope confirmation
3. findings
4. blockers
5. required follow-ups
6. no-finding statement, if there are no findings
7. security status
8. decision (`approve-like`, `hold`, or `block`)

## Non-goals

- no technical enforcement
- no GitHub settings changes
- no workflow changes
- no deploy
- no DB or SQL execution
- no automatic approval grant
