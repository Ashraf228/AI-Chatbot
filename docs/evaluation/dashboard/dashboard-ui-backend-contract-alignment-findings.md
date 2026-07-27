# Dashboard UI Backend Contract Alignment Findings

## Summary

- Audit date: Monday, July 27, 2026
- Baseline: `25d5c1c6adcb6c3e01bcf1f6033d78c77610f569`
- Scope: initial dashboard UI/backend contract alignment baseline with only small safe fixes
- Guided customer demo remains blocked.
- Self-service customer demo remains blocked.
- Real pilot remains blocked.

## Concrete Findings

### 1. Universal assistant-profile saves were not authoritative for status evaluation

Observed state:

- the universal setup path saves role/task semantics into `site_modules[module_key=assistant-profile].config.assistantProfile`
- the status service evaluated readiness from root config only

Effect:

- setup UI could save a valid universal assistant profile
- reload could show the saved values
- backend status still reported the step as incomplete

Action in this task:

- fixed in `apps/api/src/sites/site-status.service.ts`
- status evaluation now resolves the stored assistant-profile module before computing `template` and `behavior`

### 2. Wizard flow step mapped to nonexistent backend status keys

Observed state:

- dashboard wizard flow step used `flow`, `conversation_flow`, and `conversation_logic`
- backend status emitted `behavior`

Effect:

- the flow step could remain open even when the backend already considered the conversation logic contract complete

Action in this task:

- fixed in `apps/dashboard/components/customer/setup-wizard/setupWizardConstants.ts`
- `bot` now maps to `template`
- `flow` now maps to `behavior`

### 3. Customer create vs setup still duplicates role/task semantics

Observed state:

- site creation seeds assistant/profile/task semantics in root config
- setup later writes assistant semantics again through the assistant-profile module

Effect:

- prefill and authoritative edit semantics are still not fully separated

Action in this task:

- not changed
- kept as a follow-up because the fix is larger than a safe contract patch

### 4. Knowledge / PDF step still lacks one explicit save-and-continue handshake

Observed state:

- manual knowledge, URL import, and PDF upload execute immediately
- completion still depends on downstream readiness and activation state

Effect:

- persisted is not the same as processed
- processed is not the same as active
- active is not the same as usable in a trusted review step

Action in this task:

- not changed
- kept as a follow-up

### 5. Go-live step remains overloaded

Observed state:

- launch step still combines readiness, embed, testchat, go-live, runtime pilot, and diagnostics/admin cards

Effect:

- the product surface still mixes operator debug semantics with product review semantics

Action in this task:

- not changed
- kept as a follow-up

### 6. Internal testchat and runtime pilot remain separate from a customer-safe review contract

Observed state:

- testchat writes last-test metadata
- runtime pilot is admin/operator-only and intentionally non-persistent

Effect:

- both tools are useful internally
- neither currently functions as a clean customer-safe completion artifact

Action in this task:

- not changed
- kept as a follow-up

## P0 Fix Recommendations

- `DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1`
  - continue hardening readiness truth across setup steps
  - decide whether `behavior` remains the shared conversation-logic key or a dedicated backend flow key is introduced
- `DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1`
  - separate product review from internal diagnostics/admin tooling
- `DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1`
  - remove or strictly define duplicated role/task semantics
- `DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
  - define one explicit persisted / processed / active / sufficient contract
- `DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`
  - convert internal testing into a structured review artifact instead of a loose admin tool
- `CONV-ENGINE-HANDOFF-CLOSURE-1`
  - keep handoff/runtime closure work separate from the dashboard contract baseline

## Fixed In This Task

- status evaluation now respects the stored assistant-profile module for the universal setup path
- wizard bot/flow status mapping now targets the actual backend status keys
- regression tests were added for both fixes

## Intentionally Left As Follow-up

- dedicated backend flow readiness key
- customer create vs setup deduplication
- knowledge/PDF save-and-continue redesign
- go-live step redesign
- internal testchat integration into setup review
- engine-side handoff closure work

## Why No Customer Demo Approval Follows

- this task establishes contract discipline but does not redesign the launch surface
- deploy and public-widget activation remain blocked
- customer create duplication remains unresolved
- knowledge/PDF completion semantics remain incomplete
- internal testchat/runtime pilot are still not packaged as customer-safe review artifacts

## Recommended Next Task

- `DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1`
