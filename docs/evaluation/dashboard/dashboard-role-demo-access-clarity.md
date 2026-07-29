# Dashboard Role Demo Access Clarity

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `e3ead37513866cc7fff102c59b799e3dc80f5328`
- Scope: clarify trusted dashboard role display, capability boundaries, and demo access wording
- Goal was role/demo access clarity only, not a permission expansion
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No password was created
- No password was changed
- No credential was committed
- Guided customer demo remains blocked
- Self-service customer demo remains blocked
- Real pilot remains blocked

## Previous Problem

- role labels were visible in parts of the dashboard, but the operational meaning was not explicit enough
- external evaluation users could still read the page without strong enough wording that they are read-only
- internal admin/operator access and external demo access were not contrasted clearly enough
- blocked actions such as deploy, public widget activation, production activation, and customer data use were not summarized in one consistent access layer
- owner/admin verification expectations were not documented clearly enough without referring to credentials

## Role Source of Truth

- the trusted role source is the signed dashboard session
- the UI does not derive roles from e-mail address, display name, demo label, or browser state
- trusted source roles remain:
  - `admin`
  - `operator`
  - `viewer`
  - `customer`
- if no trusted internal role is available, the UI falls back to a conservative `Nicht eindeutig` state
- no new DB field, session source, or RBAC backend surface was introduced

## Role Capabilities

- `Admin`
  - internal setup/configuration: yes
  - internal testchat: yes
  - knowledge changes: yes
  - review visibility: yes
  - deploy/public widget/production: no
  - customer data use: no
- `Operator`
  - internal setup/configuration: yes
  - internal testchat: yes
  - knowledge changes: yes
  - review visibility: yes
  - deploy/public widget/production: no
  - customer data use: no
- `Viewer`
  - evaluation/read-only: yes
  - configuration: no
  - internal testchat: no
  - knowledge upload/save: no
  - review workspace: no
  - deploy/public widget/production: no
  - customer data use: no
- `Kunde`
  - site-bound access may exist, but this task does not grant internal setup/test status
  - internal testchat: no
  - deploy/public widget/production: no
  - customer data use: no
- `Nicht eindeutig`
  - no internal capability is assumed
  - no role is guessed
  - conservative deny-style UI wording is shown

## Viewer Boundary

- viewer remains evaluation/read-only
- viewer does not receive internal setup or internal test wording as an approval signal
- viewer does not receive configuration capability in the new access summary
- viewer demo copy now states:
  - no agent configuration
  - no knowledge upload
  - no production systems
  - no real NOLIS access
  - no customer data
  - no credentials in the demo flow

## Admin / Operator Boundary

- admin and operator remain the only trusted internal setup/test roles in this dashboard layer
- internal setup, knowledge preparation, and internal testchat remain visible for those roles
- the dashboard now states more explicitly that even for admin/operator:
  - no deploy is granted
  - no public widget activation is granted
  - no production activation is granted
  - no customer data use is granted
- this task does not expand backend permissions

## Demo Access Rules

- external demo remains guided/evaluation only
- no customer data
- no production data
- no production secrets
- no confidential documents
- no public widget activation
- no deploy
- no production claim
- no enterprise approval claim
- no real NOLIS system access

## Owner/Admin Access Verification Notes

- the dashboard must show the current trusted role when available from the signed session
- to verify that an internal setup/test account exists, confirm that the active session shows `Admin` or `Operator`
- if the role is not internal or not clearly available, the UI must stay conservative
- no password reset, no account creation, and no credential exchange is part of this task
- no credentials belong in code, reports, screenshots, or repository history

## Credential Handling Rules

- no password was created
- no password was changed
- no credential was stored in the repository
- no credential placeholder was replaced with a real value
- no login URL, username, or password is documented as an operational secret in this audit

## Tests Added

- `apps/dashboard/test/DashboardRoleAccess.test.ts`
  - verifies trusted role mapping for admin/operator/viewer/unknown
- `apps/dashboard/test/CustomerStatusBar.test.tsx`
  - verifies conservative unknown-role messaging and no guessed capability
- `apps/dashboard/test/EvaluationWorkspace.test.tsx`
  - verifies explicit read-only/demo boundary wording in the viewer workspace

## Remaining Follow-up Fixes

- terminology and microcopy can still be unified further across setup, review, and demo surfaces
- an operational runbook is still the right place if owner/admin access verification needs a non-code procedure
- no guided customer demo or self-service customer demo is unblocked by this task

## Safety Boundaries

- no deploy
- no public widget activation
- no production activation
- no enterprise approval
- no customer data
- no production data
- no production secrets
- no credentials
- no password creation
- no password change
- no DB migration
- no package or lockfile change
- no new persistence
- no provider calls
- no query runner
- no screenshots
- no recordings

## Next Step

- Recommended next task: `DASHBOARD-P1-TERMINOLOGY-AND-HELP-COPY-1`
