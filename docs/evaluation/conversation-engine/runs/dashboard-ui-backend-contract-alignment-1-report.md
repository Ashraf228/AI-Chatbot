# Dashboard UI Backend Contract Alignment 1 Report

## Summary

- run_id: `dashboard-ui-backend-contract-alignment-1`
- run_type: `dashboard_p0_ui_backend_contract_alignment`
- contract matrix created: yes
- contract findings created: yes
- dashboard code changed: yes
- API code changed: yes
- guided customer demo: still blocked
- self-service customer demo: blocked
- real pilot: blocked

## Contract Matrix Created

- [docs/evaluation/dashboard/dashboard-ui-backend-contract-matrix.md](/private/tmp/AI-Chatbot-dashboard-ui-backend-contract-alignment-1/docs/evaluation/dashboard/dashboard-ui-backend-contract-matrix.md)
- establishes the binding save/reload/status/role contract baseline for dashboard P0 follow-up fixes

## Code Changes

- `apps/api/src/sites/site-status.service.ts`
  - status evaluation now resolves `site_modules[module_key=assistant-profile].config.assistantProfile`
  - universal assistant-profile saves now count for `template` and `behavior`
- `apps/dashboard/components/customer/setup-wizard/setupWizardConstants.ts`
  - wizard `bot` step now maps to backend `template`
  - wizard `flow` step now maps to backend `behavior`

## Tests Added

- `apps/api/test/site-status.service.test.cjs`
  - verifies module-backed assistant-profile data is authoritative for readiness
- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
  - verifies bot and flow status mapping against actual backend keys

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- public widget activation
- deploy / production activation
- knowledge/PDF save-and-continue product contract
- go-live step redesign
- customer create vs setup deduplication
- internal testchat packaging in setup review

## Follow-up Tasks

- `DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1`
- `DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1`
- `DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1`
- `DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
- `DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`
- `CONV-ENGINE-HANDOFF-CLOSURE-1`

## Safety Confirmation

- no widget code changes
- no runtime-code deploy path
- no package or lockfile changes
- no schema migration
- no DB reads or writes in task execution
- no customer data
- no production data
- no credentials
- no screenshots
- no recordings
- no enterprise approval claim
- no deploy approval claim

## Recommended Next Step

- `DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1`
