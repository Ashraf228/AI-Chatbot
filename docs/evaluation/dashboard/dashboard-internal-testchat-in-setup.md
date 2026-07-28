# Dashboard Internal Testchat In Setup

## Summary

- Audit date: Tuesday, July 28, 2026
- Baseline: `14bbaf67df1c74a8821b976afa340400cae377e7`
- Scope: internal admin/operator testchat integration into the setup review flow
- The internal testchat is now available in `Review & Livegang` as a product-facing internal test tool.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Previous Problem

- the setup flow exposed a simple test surface, but it was not clearly framed as an internal pre-live validation tool
- the review step did not explain which setup state was actually being tested
- knowledge readiness was not surfaced clearly enough in the test area
- the transcript model looked closer to a persistent product surface than to a local admin-only test utility
- the boundary against real deliveries, public widget activation, and deploy actions was not explicit enough

## New Internal Testchat Flow

- `Review & Livegang` now includes an explicit `Interner Testchat`
- the chat is labeled as internal and test-only
- admin and operator can send test questions through the existing runtime-pilot proxy
- viewer/customer-facing setup users do not get an actionable internal test tool
- the transcript stays local in browser state and can be cleared explicitly
- the panel stays in the review gate and does not expose any go-live, deploy, or public widget action

## Used Setup State

- the testchat uses the current saved setup context exposed through the existing admin/operator runtime-pilot path
- it uses the current assistant / conversation-engine configuration
- it uses the local transcript history for follow-up turns inside the same browser session
- it surfaces current knowledge-source readiness from setup status:
- active ready sources
- processing sources
- failed sources
- it does not claim to inject persisted raw knowledge content when the runtime-pilot path only has readiness awareness and safe preview context

## Knowledge Awareness

- when active ready sources exist, the UI states that usable knowledge is available for the internal test
- when no active ready source exists, the UI states that no usable knowledge is currently ready
- when processing or failed sources exist, the UI surfaces that status and does not claim full readiness
- in-memory transcript data is not treated as backend knowledge persistence
- the UI is explicit that persisted knowledge-source status is visible, while raw persisted content is not silently claimed as loaded unless the runtime-pilot path actually supplies it

## Side Effects Boundary

- the internal testchat uses the existing runtime-pilot test path only
- no public widget is involved
- no deploy is involved
- no go-live activation is involved
- no production activation is involved
- no real tickets are sent
- no real emails are sent
- no real webhooks are triggered
- no Query Runner is introduced
- no new provider-call path is introduced outside the existing safe runtime-pilot boundary

## Role Boundary

- admin and operator can use the internal testchat as part of setup review
- viewer-style roles do not get an actionable internal test UI
- the panel still explains the boundary instead of silently disappearing

## Transcript Persistence Boundary

- the transcript is local only
- no chat-history persistence is introduced
- no database-backed test transcript is introduced
- no export, file storage, or report payload with test messages is introduced
- `Lokalen Transcript leeren` clears the in-memory test state

## Tests Added

- `apps/dashboard/test/CustomerSetupWizard.test.tsx`
- admin uses the runtime-pilot-backed internal testchat in `Review & Livegang`
- transcript remains local and is not persisted through setup settings
- ready knowledge awareness is visible when an active ready source exists
- viewer/customer-facing review flow does not expose internal test actions
- existing setup and review regressions stay covered through the broader dashboard test suite

## Remaining Follow-up Fixes

- no persisted raw knowledge retrieval is added in this task
- no public or customer-facing demo surface is released in this task
- if runtime-pilot result wording needs further product polish, follow-up can use:
- `DASHBOARD-P1-TESTCHAT-RESULT-CLARITY-1`
- current recommended next platform step remains:
- `DASHBOARD-P0-NAVIGATION-AND-WORKSPACE-SHELL-1`

## Safety Boundaries

- internal testchat is test-only
- no public widget
- no deploy
- no go-live activation
- no production activation
- no chat-history persistence
- no customer-data test
- no production data
- no production secrets
- no real tickets, emails, or webhooks
- no new knowledge persistence
- no new PDF persistence
- no website crawling
- guided customer demo remains blocked
- self-service customer demo remains blocked
- real pilot remains blocked
