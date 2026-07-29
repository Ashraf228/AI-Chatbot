# Dashboard Navigation And Workspace Shell

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `5b55989506de34e140ad2b61fefb0621251ecdd4`
- Scope: improve dashboard navigation, workspace shell, setup focus, and boundary clarity without adding new product features
- No deploy was enabled.
- No public widget was activated.
- No production activation was approved.
- Guided customer demo remains blocked.
- Self-service customer demo remains blocked.
- Real pilot remains blocked.

## Previous Problem

- the customer workspace looked like a loose collection of tabs and isolated areas
- the active customer/site context was visible, but not strong enough to guide the operator through the next meaningful action
- setup focus links could jump to anchors without actually selecting the intended wizard step
- setup progress, review state, and internal-only boundaries were present in pieces, but not integrated into one clearer shell
- the workspace did not clearly separate setup source-of-truth areas from operational or reporting areas

## New Workspace Shell

- the customer header now shows:
- active workspace
- current site/customer
- current area
- current dashboard role when available
- next meaningful action
- boundary badges for internal test, public widget, production state, and review gating
- the workspace shell no longer relies on a flat tab impression
- the shell explicitly frames setup as the source of truth before any review or live activation

## Navigation Structure

- customer/site navigation is regrouped into four clearer main areas:
- `Übersicht`
- `Einrichtung`
- `Betrieb`
- `Einstellungen`
- `Einrichtung` now acts as the main setup workspace and contains focused shortcuts for:
- `KI-Mitarbeiter`
- `Wissen`
- `Interner Test`
- `Review & Livegang`
- `Betrieb` now groups inbox and analytics instead of scattering them across unrelated areas
- `Einstellungen` remains limited to internal roles and does not imply any new public/customer-facing access

## Setup Stepper / Progress

- setup focus links now use explicit `?step=` query parameters plus existing anchors
- the wizard reads the URL and opens the intended step instead of leaving the active wizard state ambiguous
- sidebar step changes now keep the URL in sync with the active wizard step
- readiness/checklist links now point to:
- specific wizard step
- specific anchor within that step
- status presentation remains aligned to the existing mappings:
- `Bereit`
- `Unvollständig`
- `Blockiert`
- `Nicht begonnen`

## Role / Boundary Notes

- role visibility is surfaced only where the role is already safely available from the dashboard session
- no artificial or guessed role data was introduced
- internal-test messaging remains explicit
- no new viewer/operator/admin permissions were added
- the shell continues to show that:
- interner Test bleibt internal/test-only
- public widget is not activated from this flow
- production is not activated from this flow
- go-live remains a review gate, not a deploy action
- self-service and guided customer demo remain blocked

## Backend Alignment

- no new API endpoint was added
- no new role endpoint was added
- no new completion logic was invented in the UI
- setup focus state is derived from existing route, query, hash, and existing wizard/backend status
- existing setup/readiness mappings from prior dashboard fixes remain in place:
- setup remains source of truth
- customer create remains metadata-only
- knowledge save-and-continue remains intact
- internal testchat remains in review/livegang
- launch/live remains blocked/review-oriented

## Tests Added

- `apps/dashboard/test/CustomerNavGroups.test.tsx`
- verifies grouped main areas
- verifies review focus is marked active
- verifies internal-test hash activates the internal-test shortcut
- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- verifies launch step opens from explicit query/hash deep link
- verifies checklist links target explicit setup-step URLs
- existing wizard regressions remain covered for:
- status mapping
- knowledge continue gating
- review & livegang structure
- internal runtime-pilot testchat

## Remaining Follow-up Fixes

- `DASHBOARD-P0-LAYOUT-CSS-STABILITY-1`
- review spacing and compact/mobile behavior for the denser workspace shell
- optional follow-up only if role/access copy needs further tightening:
- `DASHBOARD-P0-ROLE-AND-DEMO-ACCESS-CLARITY-1`

## Safety Boundaries

- no deploy
- no public widget activation
- no production activation
- no enterprise approval
- no customer data
- no production data
- no production secrets
- no DB migration
- no package or lockfile changes
- no new persistence for knowledge, PDF content, or chat history
- no Query Runner
- no provider calls
- no real tickets, emails, or webhooks
- no new product capability exposed through the shell
