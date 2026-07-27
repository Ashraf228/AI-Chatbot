# Dashboard Setup Completion State Fix

## Summary

- Audit date: Monday, July 27, 2026
- Baseline: `bada770dec4c553c40e4b7466e2a46d74f552c15`
- Scope: setup completion-state correction for persisted backend setup data
- This task does not redesign Go-Live.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.
- Deploy and public widget activation remain blocked.

## Fixed Completion Areas

### Gesprächslogik / Behavior

- backend completion no longer depends on legacy CTA or greeting fields to treat saved conversation logic as persisted
- persisted assistant-profile module data now counts as authoritative conversation-logic state when it contains:
- goal/role context
- enabled tasks
- required fields
- partially saved conversation logic is now surfaced as incomplete instead of looking untouched

### Design & Datenschutz

- design completion now follows the fields the setup step actually persists
- persisted `brandColor` and `widgetPosition` now count as design configuration
- persisted `privacyUrl` remains required for full completion
- partially saved design/privacy state is now surfaced as incomplete instead of untouched

### Test & Livegang Review State

- pre-live-ready but not yet activated now stays a review state, not a silent open state
- blocked launch states remain blocked
- no deploy, public widget activation, or production approval is inferred

## Unchanged / Still Blocked Areas

- knowledge completion still depends on active ready knowledge sources
- no knowledge persistence redesign
- no PDF persistence redesign
- no chat-history persistence
- no Go-Live redesign
- no customer create vs setup deduplication
- no runtime-pilot productization
- guided customer demo remains blocked
- self-service demo remains blocked
- real pilot remains blocked

## Backend Storage Keys / Status Keys

### Behavior

- universal persisted source:
- `site_modules[module_key=assistant-profile].config.assistantProfile`
- legacy persisted sources:
- `sites.config.enabledTasks`
- `sites.config.conversationFlow.requiredFields`
- backend status key:
- `behavior`

### Design / Privacy

- persisted design/privacy keys:
- `sites.config.brandColor`
- `sites.config.accentColor`
- `sites.config.logoUrl`
- `sites.config.placeholderText`
- `sites.config.widgetPosition`
- `sites.config.launcherLabel`
- `sites.config.privacyUrl`
- `sites.config.privacyNoticeText`
- `sites.config.consentRequired`
- backend status key:
- `design`

### Launch / Review

- persisted review keys:
- `sites.config.lastTestedAt`
- `sites.config.goLiveAt`
- backend status keys:
- `embed`
- `test`
- `live`

## Tests Added

- `apps/api/test/site-status.service.test.cjs`
- saved conversation logic via assistant-profile counts as complete without legacy CTA/greeting dependence
- partially saved conversation logic is warning/incomplete
- saved design defaults plus privacy URL count as complete
- saved design without privacy URL is warning/incomplete
- pre-live-ready launch remains review-only
- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- warning flow state renders as `Unvollständig`
- blocked launch state renders as `Blockiert`
- PR-170 bot/template and flow/behavior mapping regression remains covered

## Remaining Follow-up Fixes

- `DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1`
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
- no package or lockfile change
- no knowledge/PDF/chat-history persistence introduced
- no Query Runner
- no real tickets, emails, or webhooks
