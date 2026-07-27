# Dashboard Product Readiness Audit

## Summary

- Audit date: Monday, July 27, 2026
- Audit branch: `docs/dashboard-product-readiness-audit-1`
- Audit baseline: `ed77c27c115094d23194a6f8316606d11adf87ad`
- Change class: `DOKU_ONLY / DASHBOARD_PRODUCT_READINESS_AUDIT / NO_DEPLOY / NO_CUSTOMER_DATA`
- Scope: dashboard product readiness, customer-demo readiness, enterprise-agent-workspace readiness, and UI-backend contract risk framing

The dashboard is not product-ready enough for guided customer demos, self-service customer testing, or real pilot release. The current implementation already contains the major building blocks:

- customer creation
- setup wizard
- knowledge upload, including PDF
- internal testchat
- enterprise agent workspace / pilot workspace
- config persistence
- go-live status evaluation

The blocking issue is not missing breadth. The blocking issue is inconsistent depth. The UI surface is broader than the current contract discipline, completion-state reliability, and customer-safe packaging.

## Current Dashboard State

The current main branch exposes a broad dashboard surface across:

- customer creation at [apps/dashboard/app/sites/page.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/sites/page.tsx)
- setup wizard at [apps/dashboard/components/customer/CustomerSetupWizard.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/CustomerSetupWizard.tsx)
- setup step UI in [apps/dashboard/components/customer/setup-wizard](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard)
- customer command center at [apps/dashboard/components/sites/CustomerCommandCenter.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/sites/CustomerCommandCenter.tsx)
- customer/site navigation in [apps/dashboard/lib/dashboard-config.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/lib/dashboard-config.ts) and [apps/dashboard/components/customer/CustomerNavGroups.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/CustomerNavGroups.tsx)
- testchat and go-live review in [apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx), [apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx), and [apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx)
- demo workspace persistence and runtime pilot routes in [apps/dashboard/app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route.ts) and [apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts)

The product surface is therefore real and materially useful for internal owner testing. It is not yet packaged tightly enough for customer-facing usage.

## Manual Owner Findings

The owner findings are correct and should be treated as binding for the next dashboard phase.

### 1. UI and backend state must align

This is the central product-quality rule. The dashboard currently spreads save/load state across multiple routes:

- `/api/sites/:siteId`
- `/api/widget/config/:siteId`
- `/api/widget/branding/:siteId`
- `/api/sites/:siteId/assistant-profile`
- `/api/sites/:siteId/status`
- `/api/ingest/*`

Those routes are invoked from the same wizard, but the wizard presents a single mental model to the user. Any mismatch between:

- saved fields
- reloaded fields
- derived status
- step completion
- go-live readiness

will be interpreted as product breakage, not implementation detail.

### 2. Go-live step is overloaded

The launch step combines:

- readiness review
- testchat
- embed code
- go-live action
- assistant diagnostics
- test cases
- response preview
- compare UI
- demo workspace builder

This is not a final review step. It is a mixed review, debug, and internal tooling surface.

### 3. Customer creation duplicates setup

Customer creation already captures:

- target users
- assistant role
- enabled tasks
- lead email
- legacy profile defaults

The setup wizard later captures overlapping concepts again:

- primary goal
- role behavior
- conversation tasks
- delivery behavior
- knowledge mode

This duplication creates drift risk before any UI polish question even begins.

### 4. Completion state is not trustworthy enough

The wizard derives completion using grouped backend status keys in:

- [apps/dashboard/components/customer/setup-wizard/setupWizardValidation.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/setupWizardValidation.ts)
- [apps/dashboard/components/sites/SetupReadinessChecklist.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/sites/SetupReadinessChecklist.tsx)
- [apps/dashboard/components/customer/setup-wizard/SetupWizardSidebar.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/SetupWizardSidebar.tsx)

The UI save paths and the readiness paths are separate concerns. Until they are explicitly contract-tested, the product cannot rely on their alignment.

### 5. Knowledge flow has no step-completion grade of confidence

The knowledge step currently exposes add/import/upload actions and source toggles, but the step does not provide a dedicated "save and continue" contract. The user must infer readiness from:

- source cards
- source status
- activation state
- separate readiness checklist

That is too implicit for customer-safe setup.

### 6. Internal testchat exists, but is not packaged as a customer-safe review tool

The setup testchat is valuable. The current issue is placement and semantics:

- it lives inside launch review
- it shares space with technical admin tools
- it does not clearly distinguish safe preview from internal runtime instrumentation

### 7. Layout and navigation remain too loose

The shell currently combines:

- top-level dashboard navigation
- site navigation groups
- setup sidebar
- command-center action cards
- setup checklist duplication

This makes progression and ownership unclear, especially for non-admin audiences.

### 8. Conversation handoff closure still needs a follow-up fix

The owner-reported handoff-closure defect belongs in the roadmap even though it is not a dashboard code task. The dashboard can only be considered demo-ready when the testchat flow can reliably validate end-state handoff behavior.

## Main Risks

### Product risk

The dashboard can communicate a false sense of readiness because:

- step completion can be shown even when the underlying save/load contract is not fully proven
- launch review presents technical tools in the same surface as business readiness
- customer creation and setup can diverge semantically

### Customer-demo risk

A guided demo currently depends on an expert operator to explain:

- what is legacy vs current
- what is internal-only vs customer-relevant
- what really persists
- what really blocks go-live
- why some statuses remain open after saving

That is not yet a productized demo flow.

### Enterprise-agent-workspace risk

The workspace is internally useful, but still too coupled to:

- admin/operator-only cognition
- internal runtime terminology
- setup-step overload
- mixed persistence and in-memory boundaries

### UX risk

The dashboard has too many parallel status surfaces:

- setup sidebar
- setup checklist
- status bar
- command center
- launch readiness panel
- go-live panel

The user can see the same state represented differently across multiple cards.

## P0 Findings

### DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1

The wizard uses multiple save endpoints while representing a single setup model. This is the hard blocker. Every critical UI field needs explicit contract mapping and save/reload/completion verification.

### DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1

Completion depends on backend status keys grouped in frontend validation logic. Until save paths and status keys are validated together, the UI can show false incompleteness or false readiness.

### DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1

The final step currently mixes customer review with admin diagnostics and debug tooling. That is not acceptable for guided customer demo usage.

### DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1

Customer creation and setup duplicate role, task, and delivery semantics. This is a direct drift source and should be reduced before further UX polishing.

### DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1

Knowledge ingestion lacks a single clear step-finalization flow. The user can add sources, but not complete the step with high confidence.

### DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1

Testchat must be treated as a structured internal pre-live review tool, not as one technical card among several internal debugging cards.

### DASHBOARD-P0-NAVIGATION-AND-WORKSPACE-SHELL-1

The current shell is functional but not coherent enough. Setup, command center, launch review, and workspace tooling need a clearer information architecture.

### DASHBOARD-P0-LAYOUT-CSS-STABILITY-1

Current packaging is too long, too distributed, and too dense for customer-safe operator flows. Layout stability is therefore not cosmetic; it is part of task completion reliability.

## P1 Findings

### KNOWLEDGE-WEBSITE-CRAWL-INGEST-1

Website ingest is important for real product maturity, but it should not cut ahead of contract alignment and setup reliability. It remains a meaningful P1.

### DASHBOARD-P1-TERMINOLOGY-AND-HELP-COPY-1

Terminology such as runtime pilot, compare, diagnostics, migration preview, and test cases needs stronger separation between internal and customer-safe language.

### DASHBOARD-P1-TESTCHAT-RESULT-CLARITY-1

The testchat should communicate result quality, source usage, and follow-up readiness more clearly once the P0 packaging work is done.

### DASHBOARD-P1-KNOWLEDGE-SOURCES-AND-STATUS-1

Knowledge status should communicate:

- source persisted
- source processed
- source active
- source actually used by testchat

without making the operator inspect multiple UI regions.

### DASHBOARD-P1-PERFORMANCE-UX-OBSERVABILITY-1

The dashboard likely needs clearer loading, retry, and request-state feedback once the structure is simplified.

## P2 Findings

P2 should be reserved for non-blocking polish after:

- contract alignment
- completion-state reliability
- launch redesign
- setup deduplication
- knowledge flow clarity
- internal testchat integration
- navigation/shell consolidation

Examples include:

- secondary copy refinement
- optional admin-only diagnostics packaging improvements
- deeper empty-state polish after structure stabilization

## UI/Backend Alignment Requirement

This audit recommends a hard delivery rule for the next dashboard phase:

For every setup-relevant field or toggle, a fix is not complete until the team can identify:

- UI label
- UI component
- frontend state key
- save action
- API endpoint
- backend storage key
- validation rule
- completion-state rule
- reload behavior
- role permission

No dashboard readiness claim should be accepted without that matrix.

## Recommended Fix Sequence

1. `DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1`
2. `DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1`
3. `DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1`
4. `DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1`
5. `DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
6. `DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`
7. `DASHBOARD-P0-NAVIGATION-AND-WORKSPACE-SHELL-1`
8. `DASHBOARD-P0-LAYOUT-CSS-STABILITY-1`
9. `CONV-ENGINE-HANDOFF-CLOSURE-1`

## Demo Readiness Decision

- internal owner testing: `conditional`
- guided customer demo: `blocked_until_P0_dashboard_fixes`
- self-service customer demo: `blocked`
- real pilot: `blocked`

Rationale:

- the system is internally testable
- the system is not yet customer-safe
- go-live semantics are too mixed with internal tooling
- setup truth is not contract-tight enough

## Enterprise Readiness Decision

- enterprise-agent-workspace internally usable: `conditional`
- guided enterprise demo usable: `blocked_until_P0_dashboard_fixes`
- real pilot usable: `blocked`

Rationale:

- the workspace exists
- persistence exists for config
- the internal test surface exists
- the packaging, role clarity, and readiness semantics are not mature enough

## Next Task Recommendation

Recommended next task:

- `DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1`

No deploy, no public widget activation, no enterprise approval, and no customer-data execution should proceed before that task and the remaining P0 dashboard tasks are complete.
