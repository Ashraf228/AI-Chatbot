# Dashboard Go-Live Step Redesign 1 Report

## Summary

- run_id: `dashboard-go-live-step-redesign-1`
- run_type: `dashboard_p0_go_live_step_redesign`
- go-live step redesigned: yes
- primary review flow added: yes
- advanced diagnostics separated: yes
- activation boundary visible: yes
- API code changed: no
- dashboard code changed: yes
- guided customer demo: still blocked
- self-service customer demo: blocked
- real pilot: blocked

## UI Changes

- `apps/dashboard/components/customer/setup-wizard/setupWizardConstants.ts`
- launch step now reads as `Review & Livegang`
- launch explanation now describes setup status, internal tests, embed code, and activation boundaries
- `apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx`
- primary launch view now renders a setup-review structure with grouped readiness items
- `apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx`
- testchat is explicitly labeled as internal-only
- `apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx`
- activation boundary is explicit and no live-action CTA is rendered
- `apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx`
- diagnostics are moved behind a separate `Advanced Diagnostics` section

## Advanced Diagnostics

- advanced diagnostics remain available only for admin/operator users
- technical tools are separated from the primary review flow
- no new execution side effects were introduced

## Activation Boundary

- deploy remains not approved
- public widget remains not activated
- production remains not activated
- customer data remains not approved
- real tickets/emails/webhooks remain disabled
- no go-live approval is implied by this step

## Tests Added

- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- verifies review structure
- verifies hidden live CTA
- verifies admin/operator diagnostics separation
- verifies customer/null role does not see advanced diagnostics

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy / production activation
- public widget activation
- knowledge/PDF/chat-history persistence redesign

## Safety Confirmation

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no credentials
- no screenshots
- no recordings
- no package or lockfile changes
- no DB migration
- no knowledge/PDF/chat-history persistence
- no enterprise approval claim
- no deploy approval claim

## Recommended Next Step

- `DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1`
