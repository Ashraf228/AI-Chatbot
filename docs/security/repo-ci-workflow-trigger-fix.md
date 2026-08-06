# Repo CI Workflow Trigger Fix

## Summary

- Date: Thursday, August 6, 2026
- Scope: workflow-trigger-only hardening for `.github/workflows/ci.yml`
- Decision: `ci_pull_request_trigger_hardened`
- Purpose: make pull request CI triggering more explicit and add a controlled manual trigger path for future diagnosis
- No runtime, API, dashboard, widget, package, lockfile, deploy, or settings change is included

## Previous State

- PR #213 (`Add website answer pilot guided demo final readiness review`) was open, ready for review, mergeable, and based on `main`.
- GitHub UI showed `There are no checks for this commit`.
- Actions branch filtering for `docs/knowledge-website-answer-pilot-guided-demo-final-readiness-review-1` returned `0 workflow run results`.
- `ci.yml` already had `pull_request` and `push` on `main`, but no explicit `pull_request.types` and no `workflow_dispatch`.
- No `paths`, `paths-ignore`, draft guard, or skip-CI markers were present.

## Root Cause Context

- The repository showed a gap between expected pull-request workflow triggering and observed GitHub Actions behavior for PR #213.
- The workflow file had no obvious semantic blocker, but the trigger surface was still implicit.
- This fix does not prove the root cause was only workflow YAML, but it removes ambiguity around which pull-request events should start CI and provides a manual CI entrypoint for future controlled diagnosis.

## Scope Decision

- Selected variant: `ci_pull_request_trigger_hardened`
- Reason:
  - `ci.yml` could be hardened without changing job semantics.
  - The required job names could remain unchanged.
  - No repo settings, rulesets, or runtime scope changes were required for this minimal fix.

## Workflow Trigger Change

The `on:` block in `.github/workflows/ci.yml` is hardened to:

```yaml
on:
  pull_request:
    types:
      - opened
      - synchronize
      - reopened
      - ready_for_review
  push:
    branches:
      - main
  workflow_dispatch:
```

## Required Check Names Boundary

The fix preserves the existing CI check names exactly:

- `Source gate`
- `Security audit`
- `Security PostgreSQL isolation`
- `Docker build`

No job IDs, job names, steps, or job semantics are widened or renamed.

## What This Fix Does

- Makes pull request trigger types explicit.
- Explicitly includes `ready_for_review`.
- Preserves `push` on `main`.
- Adds `workflow_dispatch` to `ci.yml` for later controlled manual triggering if needed.
- Keeps CI job names unchanged.
- Keeps CI job behavior unchanged.

## What This Fix Does Not Do

- Does not change runtime code.
- Does not change API code.
- Does not change dashboard code.
- Does not change widget code.
- Does not change packages or lockfiles.
- Does not change scripts or deploy config.
- Does not change branch protection, rulesets, repo settings, or required checks.
- Does not merge PR #213.
- Does not retrigger PR #213 inside this task.
- Does not deploy.
- Does not enable public widget, production, guided demo, provider-live, or customer data usage.
- Does not grant authorization.

## Safety Boundaries

- No runtime code
- No API code
- No dashboard code
- No widget code
- No deploy
- No public-widget activation
- No production activation
- No guided-demo approval
- No authorization approval
- No customer data
- No production data
- No secrets
- No credentials

## Validation Commands

The following validations are required for this task:

- `scripts/ops/codex-preflight.sh`
- `git diff --check`
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `npm run build:api`
- `npm run check:dashboard`
- `npm run build:dashboard`
- `npm run check:all`
- workflow text validation via `grep`
- report JSON validation via `python3 -m json.tool`

## Follow-up

- Next gate task after PR creation:
  - `REPO-CI-WORKFLOW-TRIGGER-FIX-1-D`
- Follow-up after merge:
  - `KNOWLEDGE-WEBSITE-ANSWER-PILOT-GUIDED-DEMO-FINAL-READINESS-REVIEW-1-CI-RETRIGGER-AFTER-WORKFLOW-FIX-1`

## Remaining Limitations

- This fix does not by itself prove that GitHub Actions will create runs for PR #213.
- This fix does not configure branch protection or required checks.
- This fix does not modify GitHub Actions repository settings.
- PR #213 remains unmerged in this task and must be handled separately after this workflow fix lands on `main`.
