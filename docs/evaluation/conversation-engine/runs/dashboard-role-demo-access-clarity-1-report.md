# Dashboard Role Demo Access Clarity 1 Report

## Summary

- run_id: `dashboard-role-demo-access-clarity-1`
- run_type: `dashboard_p0_role_demo_access_clarity`
- role/demo access clarity improved: yes
- role indicator visible when safely available: yes
- viewer boundary visible: yes
- admin/operator boundary visible: yes
- demo access rules visible: yes
- credential handling documented: yes
- dashboard code changed: yes
- API code changed: no
- guided customer demo: still blocked
- self-service customer demo: blocked
- real pilot: blocked

## UI Changes

- `apps/dashboard/lib/dashboard-role-access.ts`
  - centralizes trusted role labels, conservative fallback handling, and capability summaries
- `apps/dashboard/components/customer/CustomerStatusBar.tsx`
  - adds a role/access segment and explicit internal-vs-demo boundary copy
- `apps/dashboard/components/customer/setup-wizard/SetupWizardSidebar.tsx`
  - adds role/capability badges and conservative boundary wording in setup
- `apps/dashboard/app/evaluation/EvaluationWorkspace.tsx`
  - makes read-only/demo restrictions explicit in the viewer-facing evaluation workspace
- `apps/dashboard/app/globals.css`
  - adds lightweight badge layout support for the new capability summaries

## Role Source

- trusted source remains the signed dashboard session
- no role is derived from e-mail address, display name, or browser state
- trusted source roles remain `admin`, `operator`, `viewer`, and `customer`
- if no trusted internal role is available, the UI falls back to `Nicht eindeutig`

## Access Boundaries

- `Admin` and `Operator`
  - internal setup/test: allowed
  - deploy/public widget/production: not allowed
  - customer data use: not allowed
- `Viewer`
  - evaluation/read-only: yes
  - configuration/internal test/knowledge change: no
  - deploy/public widget/production: no
- `Kunde`
  - not treated as an internal setup/test approval
  - deploy/public widget/production: no
- `Nicht eindeutig`
  - conservative deny-style UI
  - no guessed internal capability

## Demo Access Rules

- external demo remains guided/evaluation only
- no customer data
- no production data
- no production secrets
- no real NOLIS access
- no public widget activation
- no deploy
- no production-ready claim

## Credential Handling

- no password created
- no password changed
- no credential committed
- no credential rendered in UI copy
- no credential documented in repo reports

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- production activation
- customer data usage

## Safety Confirmation

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no password creation
- no password change
- no DB migration
- no package or lockfile changes
- no provider calls
- no query runner
- no screenshots
- no recordings

## Recommended Next Step

- `DASHBOARD-P1-TERMINOLOGY-AND-HELP-COPY-1`
