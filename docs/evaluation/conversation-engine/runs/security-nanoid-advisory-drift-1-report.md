# Security Nanoid Advisory Drift Report

## Summary

- Run ID: `security-nanoid-advisory-drift-1`
- Run type: `security_nanoid_advisory_drift`
- Scope decision: `nanoid_advisory_technical_remediation`
- Remediated the production-context audit drift for `nanoid`
- Used targeted lockfile-only remediation
- `npm run security:audit:production-contexts` moved from `FAIL` to `PASS`

## Scope Decision

- Variant A selected: `nanoid_advisory_technical_remediation`
- Technical remediation preferred over any new exception
- No runtime/API/dashboard/widget feature change
- No workflow/script change
- No deploy
- No change to PR `#215`

## Baseline Failure

- Local required check failed on Saturday, August 8, 2026
- Package: `nanoid`
- Advisory: `GHSA-2V37-7H3G-55P8`
- Path: `node_modules/nanoid`
- Severity: `high`

## Advisory

- `GHSA-2V37-7H3G-55P8`
- `nanoid: custom generators can loop indefinitely when size is zero`
- Patched range: `>= 3.3.17`

## Affected Package / Path / Version

- Package: `nanoid`
- Path: `node_modules/nanoid`
- Before: `3.3.16`
- After: `3.3.18`

## Dependency Chain

- `@ai-chatbot/dashboard@0.1.0 -> next@16.3.0 -> postcss@8.5.23 -> nanoid@3.3.16`
- Root lockfile was affected
- `apps/dashboard/package-lock.json` was also affected and needed the same targeted refresh

## Remediation Decision

- Decision: technical remediation
- Method: `lockfile_update`
- No package.json change
- No override added
- No major parent-package upgrade
- No temporary exception

## Remediation Details

- Root `package-lock.json` refreshed to `nanoid@3.3.18`
- `apps/dashboard/package-lock.json` refreshed to `nanoid@3.3.18`
- Full production-context audit re-run after both lockfile updates

## Before / After

- Before:
  - root audit: `FAIL`
  - dashboard workspace audit: `FAIL`
  - `nanoid@3.3.16`
- After:
  - root audit: `PASS`
  - dashboard workspace audit: `PASS`
  - full production-context audit: `PASS`
  - `nanoid@3.3.18`

## Checks

- `npm run security:audit:production-contexts`: `PASS`
- `npm run security:check-authorization-matrix`: `PASS`
- `npm run test:security-boundaries`: `PASS`
- `npm run build:api`: `PASS`
- `npm run check:dashboard`: `PASS`
- `npm run build:dashboard`: `PASS`
- `npm run check:all`: `PASS`
- report JSON validation: `PASS`
- sensitive scan: `PASS`
- `git diff --check`: `PASS`

## Safety Boundaries

- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No secrets
- No credentials
- No approval grants
- No authorization records
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG

## Follow-up

- Next gate task: `SECURITY-NANOID-ADVISORY-DRIFT-1-D`
- After merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-DECISION-1-D-RESUME`

## Still Blocked

- PR `#215` merge
- guided customer demo
- public widget activation
- production activation
- customer data use
- production data use
- authorization grants
