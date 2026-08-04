# Next Internal PostCSS Advisory Drift

## Summary

The red `npm run security:audit:production-contexts` gate was caused by an unaccepted high finding on the exact Next-internal dependency path `node_modules/next/node_modules/postcss`.

This task resolved the drift through technical remediation, not through a refreshed exception.

## Previous State

- Dashboard Next dependency: `16.2.11`
- Root Next override: `16.2.11`
- Affected nested dependency path: `node_modules/next/node_modules/postcss`
- Affected nested version: `8.4.31`
- Previous exact-scoped exception no longer matched the current advisory set

## Security Baseline Failure

The reproduced failure before the fix was:

- `FAIL unaccepted high finding postcss at node_modules/next/node_modules/postcss`

Reviewed advisory set:

- `GHSA-6g55-p6wh-862q`
- `GHSA-fxqj-rqcc-2cmp`
- `GHSA-qx2v-qp2m-jg93`
- `GHSA-r28c-9q8g-f849`

## Affected Advisories

- package: `postcss`
- severity: `high`
- affected path: `node_modules/next/node_modules/postcss`
- previous parent dependency: `next@16.2.11`
- previous nested version: `postcss@8.4.31`

## Affected Path

The drift was limited to the Next-bundled internal dependency path only.

It did not require a new exception for:

- root `postcss`
- widget `postcss`
- application runtime code

## Dependency Analysis

- Root and application-level PostCSS had already been raised to `8.5.23`.
- The failing path was only the nested Next-internal bundle.
- Stable registry analysis showed:
  - `next@16.2.12` still depended on internal `postcss@8.4.31`
  - `next@16.3.0` depends on internal `postcss@8.5.23`
- Installed dependency verification after the update:
  - `@ai-chatbot/dashboard -> next@16.3.0 -> postcss@8.5.23`

## Remediation Decision

- scope decision: `next_internal_postcss_remediated`
- remediation type: targeted dependency and lockfile update
- temporary exception used: `no`

## Package / Lockfile Change

Changed files for the remediation:

- `package.json`
- `package-lock.json`
- `apps/dashboard/package.json`
- `apps/dashboard/package-lock.json`

Exact dependency changes:

- `apps/dashboard/package.json`: `next` from `16.2.11` to `16.3.0`
- `package.json` root override: `next` from `16.2.11` to `16.3.0`

Resolved nested dependency result:

- `next@16.3.0`
- internal `postcss@8.5.23`

## Runtime Exposure Boundary

This task changed dependency metadata and lockfiles only.

It did not change:

- API runtime feature code
- Dashboard product behavior
- Widget runtime behavior
- provider approval logic
- DB access behavior
- workflow behavior

## Audit Result Before / After

- `security:audit:production-contexts` before: `FAIL`
- `security:audit:production-contexts` after: `PASS`

## Not a Deploy Approval

This task is not a deploy approval.

## Not a Customer Data Approval

This task does not approve customer-data use.

## Not a Production Approval

This task does not approve production-data use, production activation, public widget activation, or guided demo activation.

## Remaining Follow-up

- Governance work may resume only because the security baseline is green again.
- This remediation does not change the blocked state for:
  - guided customer demo
  - self-service customer demo
  - real pilot

## Safety Boundaries

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no passwords
- no DB reads or writes
- no SQL
- no query runner
- no live provider calls
- no live embeddings
- no live RAG
- no workflow change
- no runtime approval grants
