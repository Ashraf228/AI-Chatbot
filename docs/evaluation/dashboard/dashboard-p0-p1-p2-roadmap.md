# Dashboard P0 P1 P2 Roadmap

## Scope

- Audit baseline: `ed77c27c115094d23194a6f8316606d11adf87ad`
- Audit date: Monday, July 27, 2026
- Change class: `DOKU_ONLY`

This roadmap prioritizes dashboard fixes required for product readiness. It does not authorize deploy, customer-data usage, or enterprise release.

## P0

### DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1

- Problem: The setup flow saves through multiple endpoints while presenting a single unified product model.
- Impact: Users can save a field yet still see stale, mismatched, or incomplete readiness state.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/components/customer/CustomerSetupWizard.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/CustomerSetupWizard.tsx)
  - [apps/dashboard/lib/setup-wizard-api.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/lib/setup-wizard-api.ts)
  - [apps/dashboard/app/api/widget/config/[siteId]/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/widget/config/[siteId]/route.ts)
  - [apps/dashboard/app/api/sites/[siteId]/assistant-profile/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/assistant-profile/route.ts)
  - [apps/dashboard/app/api/sites/[siteId]/status/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/status/route.ts)
- Backend-/Contract-Relevanz: maximal; this is the contract root.
- Empfohlener Fix-Task: produce a field-by-field contract matrix, align save/load/status rules, add save-reload-completion tests.
- Prioritaet: P0
- Risiko: very high
- Aufwand: L

### DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1

- Problem: Completion logic is derived separately from save behavior.
- Impact: Step state can remain open after valid save or can appear complete without durable state.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/components/customer/setup-wizard/setupWizardValidation.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/setupWizardValidation.ts)
  - [apps/dashboard/components/customer/setup-wizard/SetupWizardSidebar.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/SetupWizardSidebar.tsx)
  - [apps/dashboard/components/sites/SetupReadinessChecklist.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/sites/SetupReadinessChecklist.tsx)
  - [apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx)
- Backend-/Contract-Relevanz: high; depends on backend status-key correctness.
- Empfohlener Fix-Task: map each readiness key to the exact saved fields and assert round-trip behavior.
- Prioritaet: P0
- Risiko: high
- Aufwand: M

### DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1

- Problem: The final step mixes readiness review with internal diagnostics and debug tooling.
- Impact: Customer and operator comprehension breaks at the point where trust must be highest.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx)
  - [apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx)
  - [apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx)
- Backend-/Contract-Relevanz: medium to high; review UI must reflect backend truth.
- Empfohlener Fix-Task: split customer-safe review from admin-only diagnostics and move internal tooling out of the final review pane.
- Prioritaet: P0
- Risiko: high
- Aufwand: M

### DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1

- Problem: Customer creation captures role/task data that setup later asks again.
- Impact: Configuration drift and user confusion begin at record creation.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/components/sites/SiteForm.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/sites/SiteForm.tsx)
  - [apps/dashboard/app/sites/page.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/sites/page.tsx)
  - [apps/dashboard/components/customer/setup-wizard/UseCaseStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/UseCaseStep.tsx)
  - [apps/dashboard/components/customer/setup-wizard/ConversationFlowStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/ConversationFlowStep.tsx)
  - [apps/dashboard/lib/site-create-config.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/lib/site-create-config.ts)
- Backend-/Contract-Relevanz: high; duplicate inputs create divergent storage paths.
- Empfohlener Fix-Task: reduce create flow to master data only, or clearly mark prefill semantics and enforce synchronization.
- Prioritaet: P0
- Risiko: high
- Aufwand: M

### DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1

- Problem: Knowledge flow has add actions, but not a clear step-finalization contract.
- Impact: Users cannot tell when knowledge is stored, processed, active, and sufficient for completion.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/components/customer/setup-wizard/KnowledgeStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/KnowledgeStep.tsx)
  - [apps/dashboard/components/customer/setup-wizard/KnowledgeAddSourcePanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/KnowledgeAddSourcePanel.tsx)
  - [apps/dashboard/components/customer/setup-wizard/KnowledgeSourceList.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/KnowledgeSourceList.tsx)
  - [apps/dashboard/lib/setup-wizard-api.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/lib/setup-wizard-api.ts)
- Backend-/Contract-Relevanz: high; readiness depends on ingest status and activation state.
- Empfohlener Fix-Task: add explicit completion criteria, explicit continue behavior, and clear source-state labeling.
- Prioritaet: P0
- Risiko: high
- Aufwand: M

### DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1

- Problem: Testchat is useful, but currently embedded inside an overloaded launch step.
- Impact: Internal validation exists, but does not guide a product-safe pre-live review.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx)
  - [apps/dashboard/components/customer/CustomerTestChatPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/CustomerTestChatPanel.tsx)
  - [apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx)
- Backend-/Contract-Relevanz: medium; test state also writes last-test fields.
- Empfohlener Fix-Task: define a dedicated internal validation pattern with customer-safe output and admin-only diagnostics separation.
- Prioritaet: P0
- Risiko: high
- Aufwand: M

### DASHBOARD-P0-NAVIGATION-AND-WORKSPACE-SHELL-1

- Problem: Overview, setup, site tabs, command center, and workspace controls form a loose shell.
- Impact: Users need too much interpretation to understand where to continue.
- Betroffene Dateien / Komponenten:
  - [apps/dashboard/lib/dashboard-config.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/lib/dashboard-config.ts)
  - [apps/dashboard/components/layout/SiteTabs.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/layout/SiteTabs.tsx)
  - [apps/dashboard/components/customer/CustomerNavGroups.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/CustomerNavGroups.tsx)
  - [apps/dashboard/components/customer/setup-wizard/SetupWizardShell.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/SetupWizardShell.tsx)
  - [apps/dashboard/components/sites/CustomerCommandCenter.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/sites/CustomerCommandCenter.tsx)
- Backend-/Contract-Relevanz: medium.
- Empfohlener Fix-Task: define one primary site workspace shell with explicit primary action, progress, and internal-vs-customer-safe zones.
- Prioritaet: P0
- Risiko: high
- Aufwand: L

### DASHBOARD-P0-LAYOUT-CSS-STABILITY-1

- Problem: The current UI is too long and too fragmented for reliable customer/operator workflows.
- Impact: Even correct backend behavior will feel unfinished if the screen hierarchy remains unstable.
- Betroffene Datei / Komponente:
  - [apps/dashboard/app/globals.css](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/globals.css)
  - setup wizard and command-center card composition across the dashboard component tree
- Backend-/Contract-Relevanz: low directly, high indirectly because trust depends on usability.
- Empfohlener Fix-Task: compact key forms, reduce vertical sprawl, stabilize card hierarchy, and remove overpacked final-step surfaces.
- Prioritaet: P0
- Risiko: medium to high
- Aufwand: M

### CONV-ENGINE-HANDOFF-CLOSURE-1

- Problem: After collecting mandatory contact details, the bot reportedly returns to normal advisory mode instead of closing the handoff cleanly.
- Impact: Internal dashboard testing cannot certify escalation behavior.
- Betroffene Bereiche:
  - conversation-engine runtime and testchat validation path
  - dashboard launch/testchat review expectations
- Backend-/Contract-Relevanz: high
- Empfohlener Fix-Task: add explicit handoff closure state and summary completion behavior.
- Prioritaet: P0 follow-up outside pure dashboard scope
- Risiko: high
- Aufwand: M

## P1

### KNOWLEDGE-WEBSITE-CRAWL-INGEST-1

- Problem: Product maturity will require website-crawl ingestion beyond manual, URL-page, and PDF flows.
- Impact: Knowledge onboarding remains manual-heavy.
- Betroffene Bereiche:
  - knowledge ingest routes
  - source-state UI
  - crawling safety and status reporting
- Backend-/Contract-Relevanz: high
- Empfohlener Fix-Task: add controlled crawl ingestion with SSRF-safe rules, processing state, and clear source provenance.
- Prioritaet: P1
- Risiko: medium
- Aufwand: L

### DASHBOARD-P1-TERMINOLOGY-AND-HELP-COPY-1

- Problem: Internal and technical terms leak into customer-adjacent surfaces.
- Impact: Guided demos require too much narration from an expert operator.
- Betroffene Bereiche:
  - setup wizard
  - launch review
  - workspace cards
  - navigation labels
- Backend-/Contract-Relevanz: low
- Empfohlener Fix-Task: simplify customer-facing labels, move technical labels behind admin-only copy, add concise help text.
- Prioritaet: P1
- Risiko: medium
- Aufwand: S

### DASHBOARD-P1-TESTCHAT-RESULT-CLARITY-1

- Problem: Testchat response quality, source usage, and pass/fail semantics are not explicit enough.
- Impact: Operators cannot quickly judge if a pre-live test is good enough.
- Betroffene Bereiche:
  - [apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx)
  - [apps/dashboard/components/customer/CustomerTestChatPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/CustomerTestChatPanel.tsx)
- Backend-/Contract-Relevanz: medium
- Empfohlener Fix-Task: make source usage, missing data, and handoff/test outcome clearer.
- Prioritaet: P1
- Risiko: medium
- Aufwand: M

### DASHBOARD-P1-KNOWLEDGE-SOURCES-AND-STATUS-1

- Problem: Source list and readiness signals are informative but still distributed.
- Impact: Operators must mentally combine multiple panels.
- Betroffene Bereiche:
  - knowledge workspace
  - setup knowledge step
  - command-center knowledge cards
- Backend-/Contract-Relevanz: medium
- Empfohlener Fix-Task: unify source persistence, processing, activation, and usage-state labels.
- Prioritaet: P1
- Risiko: medium
- Aufwand: M

### DASHBOARD-P1-PERFORMANCE-UX-OBSERVABILITY-1

- Problem: The dashboard loads multiple site-specific cards and summaries with uneven feedback.
- Impact: Slow or partial loads can look like product bugs.
- Betroffene Bereiche:
  - command center
  - setup wizard
  - site status bar
  - analytics summary panels
- Backend-/Contract-Relevanz: medium
- Empfohlener Fix-Task: add better loading segmentation, retries, and request-state clarity.
- Prioritaet: P1
- Risiko: medium
- Aufwand: M

## P2

### DASHBOARD-P2-SECONDARY-POLISH-1

- Problem: Non-critical polish remains after contract and workflow stabilization.
- Impact: Minor friction remains, but does not block demos.
- Betroffene Bereiche: secondary copy, spacing, optional diagnostics packaging, minor empty states.
- Backend-/Contract-Relevanz: low
- Empfohlener Fix-Task: polish after P0 and P1 close.
- Prioritaet: P2
- Risiko: low
- Aufwand: S

## Recommended Next Task

- `DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1`
