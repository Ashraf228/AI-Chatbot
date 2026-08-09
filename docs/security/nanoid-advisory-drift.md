# Nanoid Advisory Drift

## Summary

- Audit date: Saturday, August 8, 2026
- Baseline: `00edcbae4b40072e9ecb1114e166a99d29230a74`
- Scope decision: `nanoid_advisory_technical_remediation`
- Investigated and remediated the local production-context audit drift for `nanoid`
- Remediation stayed lockfile-only
- No runtime/API/dashboard/widget feature code changed
- No new audit exception or broad allowlist was added
- `npm run security:audit:production-contexts` moved from `FAIL` to `PASS`

## Baseline Failure

- Blocked task: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-DECISION-1-D`
- Blocking PR: `#215`
- Local required check on Saturday, August 8, 2026:
  - `npm run security:audit:production-contexts`: `FAIL`
- Failure output identified:
  - package: `nanoid`
  - path: `node_modules/nanoid`
  - advisory: `GHSA-2V37-7H3G-55P8`
  - severity: `high`

## Advisory

- Advisory: `GHSA-2V37-7H3G-55P8`
- Title: `nanoid: custom generators can loop indefinitely when size is zero`
- Severity: `high`
- CWE: `CWE-835`
- CVSS: `5.9`
- Patched range from audit: `>= 3.3.17`

## Affected Package / Path / Version

- Package: `nanoid`
- Affected path: `node_modules/nanoid`
- Version before fix: `3.3.16`
- Version after fix: `3.3.18`
- Patched range: `>= 3.3.17`

## Dependency Chain

- Root production-context path:
  - `@ai-chatbot/dashboard@0.1.0`
  - `next@16.3.0`
  - `postcss@8.5.23`
  - `nanoid@3.3.16` before fix, `nanoid@3.3.18` after fix
- Root lockfile was affected.
- `apps/dashboard/package-lock.json` was also affected because the production-context audit script audits that workspace lockfile independently.
- The dependency remained transitive throughout this task.

## Remediation Decision

- Decision: `technical remediation`
- Scope decision: `nanoid_advisory_technical_remediation`
- Fix method: `lockfile_update`
- Reason:
  - the vulnerable package was transitive
  - the parent semver range already allowed a patched `nanoid`
  - a lockfile-only refresh was sufficient
  - no package.json change, override, or broader parent-package upgrade was required

## Remediation Details

- Performed a targeted root lockfile refresh for `nanoid`.
- Verified that the root lockfile moved `node_modules/nanoid` from `3.3.16` to `3.3.18`.
- Re-ran the production-context audit and observed that `apps/dashboard` still failed because its standalone lockfile still pinned `3.3.16`.
- Performed a second targeted lockfile-only refresh inside `apps/dashboard` with workspaces disabled.
- Verified that `apps/dashboard/package-lock.json` also moved `node_modules/nanoid` from `3.3.16` to `3.3.18`.
- Re-ran the full production-context audit across all contexts and confirmed `PASS`.

## Before / After

- Before:
  - `nanoid@3.3.16`
  - root production-context audit: `FAIL`
  - dashboard workspace production-context audit: `FAIL`
- After:
  - `nanoid@3.3.18`
  - root production-context audit: `PASS`
  - dashboard workspace production-context audit: `PASS`
  - full `npm run security:audit:production-contexts`: `PASS`

## Security Audit Result

- `npm run security:audit:production-contexts`: `PASS`
- `GHSA-2V37-7H3G-55P8` is no longer an unaccepted production-context finding.
- No new unaccepted findings were introduced by this remediation.

## Scope Boundaries

- No runtime code changes
- No API code changes
- No dashboard feature changes
- No widget feature changes
- No workflow changes
- No script changes
- No migration changes
- No SQL
- No deploy/config changes
- No branch protection / rulesets / repo settings changes
- PR #215 was not changed

## What This Fix Does Not Do

- Does not deploy anything
- Does not activate the public widget
- Does not activate production
- Does not grant guided demo authorization
- Does not grant customer demo authorization
- Does not grant any authorization record or approval grant
- Does not use customer data
- Does not use production data
- Does not include secrets or credentials
- Does not execute live provider calls
- Does not generate live LLM answers
- Does not generate live embeddings
- Does not run external RAG

## Follow-up

- Next gate task: `SECURITY-NANOID-ADVISORY-DRIFT-1-D`
- After merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-AUTHORIZATION-DECISION-1-D-RESUME`
- PR `#215` remains blocked until this remediation PR is reviewed and merged.

## Remaining Limitations

- This task only remediates the `nanoid` advisory drift.
- It does not widen any allowlist or add any temporary exception.
- It does not change the authorization or demo-readiness status of PR `#215`.
- Guided customer demo remains `still_blocked`.
