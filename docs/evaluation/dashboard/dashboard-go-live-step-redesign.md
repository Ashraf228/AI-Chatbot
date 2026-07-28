# Dashboard Go-Live Step Redesign

## Summary

- Audit date: Tuesday, July 28, 2026
- Baseline: `3edf9e843825c01a980102a24234861d5965eaf6`
- Scope: redesign the last dashboard setup step from an overloaded launch/debug area into a review/readiness gate
- No deploy was enabled.
- No public widget was activated.
- No production go-live was approved.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Previous Problem

- the final setup step mixed product review, test chat, embed code, live activation language, and admin diagnostics in one primary view
- operator/admin users had to parse technical tooling before they could understand whether the setup was actually complete
- the primary flow did not separate internal-only diagnostics from customer-safe setup review
- the step could imply that testing and live activation belong to one action path even though deploy and public widget activation are still blocked

## New Review Flow

- the step label is now `Review & Livegang`
- the primary step header explains that this stage reviews setup status and internal test readiness only
- the first panel is now `Setup-Review`
- the review view groups the setup state into:
- Agent / Template
- Gesprächslogik / Verhalten
- Design
- Datenschutz
- Wissen / Demo-Wissen
- Interner Test
- Livegang / Aktivierung
- status labels are rendered consistently as `Bereit`, `Unvollständig`, or `Blockiert`
- the success path no longer implies live activation; it confirms internal review only

## Primary View

- the primary operator flow now focuses on:
- setup review/status
- internal test area
- embed code review
- explicit activation boundary
- the test area is clearly labeled as internal only
- the primary flow no longer presents technical diagnostics as mandatory go-live tasks

## Advanced Diagnostics Boundary

- technical diagnostics remain available only in a separate `Advanced Diagnostics` area
- that area stays limited to admin/operator roles
- existing diagnostics remain internal/test-only:
- assistant profile diagnostics
- conversation engine test cases
- conversation engine preview
- conversation engine compare
- conversation engine response preview
- demo workspace agent builder
- these diagnostics are no longer the dominant primary setup surface

## Activation Boundary

- the step now explicitly shows:
- Deploy: nicht freigegeben
- Public Widget: nicht aktiviert
- Production: nicht aktiviert
- Kundendaten: nicht freigegeben
- Echte Tickets / E-Mails / Webhooks: nein
- the previous live-action implication was removed
- no real go-live button is exposed in the primary step
- internal readiness does not imply deploy approval or production activation

## What Remains Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- production activation
- customer data use
- knowledge persistence redesign
- PDF persistence redesign
- chat-history persistence

## Tests Added

- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- verifies the review/readiness structure is visible
- verifies `Advanced Diagnostics` is separated from the primary flow
- verifies activation-boundary language is visible
- verifies `Live schalten` is not rendered
- keeps prior status-mapping/completion regressions covered

## Remaining Follow-up Fixes

- `DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1`
- `DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
- `DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`
- `CONV-ENGINE-HANDOFF-CLOSURE-1`

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
- no knowledge/PDF/chat-history persistence introduced
- no Query Runner
- no real tickets, emails, or webhooks
