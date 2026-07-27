# Dashboard UI Backend Contract Risks

## Why This Matters

The dashboard cannot claim readiness if it displays product state that is not guaranteed by backend state.

In this repo, the setup surface is split across multiple write paths:

- customer creation
- site basics
- widget config
- branding
- assistant profile
- ingest routes
- status evaluation
- testchat persistence fields

That architecture can work, but only if every user-visible state is tied to a defined contract.

## Contract Matrix Requirements

Every relevant setup field or status needs a future contract matrix entry with:

- UI label
- frontend component
- frontend state key
- save action
- API endpoint
- backend storage key
- validation rule
- completion rule
- save test
- reload test
- role permission

Without this matrix, a dashboard fix is incomplete.

## Known Contract Risk Areas

### 1. Customer creation vs setup agent configuration

Relevant UI:

- [apps/dashboard/components/sites/SiteForm.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/sites/SiteForm.tsx)
- [apps/dashboard/components/customer/setup-wizard/UseCaseStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/UseCaseStep.tsx)
- [apps/dashboard/components/customer/setup-wizard/ConversationFlowStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/ConversationFlowStep.tsx)

Observed risk:

- customer creation writes `assistantProfile.role`, `enabledTasks`, and related defaults via [apps/dashboard/lib/site-create-config.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/lib/site-create-config.ts)
- setup later writes role/task semantics again via assistant-profile and widget-config routes

Contract risk:

- duplicated source of truth
- unclear prefill vs authoritative edit semantics

### 2. Conversation flow step

Relevant UI:

- [apps/dashboard/components/customer/setup-wizard/ConversationFlowStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/ConversationFlowStep.tsx)

Observed risk:

- legacy mode writes `conversationFlow.requiredFields` plus `enabledTasks` through widget config
- universal mode writes assistant-profile required fields and enabled tasks through assistant-profile route

Contract risk:

- same visible step, different persistence targets
- completion logic may read a third representation

### 3. Design step

Relevant UI:

- design form in the setup wizard
- customer status/checklist launch surfaces

Observed risk:

- design writes across both branding and widget config

Contract risk:

- one step spans multiple APIs
- completion depends on the status service understanding both domains coherently

### 4. Privacy / consent semantics

Relevant UI:

- design/privacy step
- privacy page
- go-live readiness

Observed risk:

- privacy and consent data are split across branding/config/privacy-related screens

Contract risk:

- readiness could lag behind saved values
- different screens may imply different completion requirements

### 5. Knowledge and PDF step

Relevant UI:

- [apps/dashboard/components/customer/setup-wizard/KnowledgeStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/KnowledgeStep.tsx)

Observed risk:

- add/import/upload actions are immediate
- step completion is indirect
- source activation and source readiness are separate concepts

Contract risk:

- "source exists" is not equal to "source ready"
- "source ready" is not equal to "source active"
- "source active" is not equal to "source used by testchat"

### 6. Go-live step

Relevant UI:

- [apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx)
- [apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchReadinessPanel.tsx)
- [apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/GoLivePanel.tsx)

Observed risk:

- final step shows review, testchat, embed state, launch action, and admin tools together

Contract risk:

- user may infer launch-safe state from the wrong surface
- internal admin cards can appear equivalent to launch readiness

### 7. Config persistence in the enterprise agent workspace

Relevant UI and route:

- [apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx)
- [apps/dashboard/app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route.ts)

Observed risk:

- config persistence is real
- broader setup shell does not clearly distinguish persisted config from transient test artifacts

Contract risk:

- users may assume knowledge snippets or chat history persist when they do not

### 8. Testchat / runtime pilot

Relevant UI and routes:

- [apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/TestChatPanel.tsx)
- [apps/dashboard/app/api/widget/test-chat/[siteId]/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/widget/test-chat/[siteId]/route.ts)
- [apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts)

Observed risk:

- there are multiple internal testing surfaces
- they do not yet share a single product-ready evaluation vocabulary

Contract risk:

- "test passed" can mean different things across tools
- launch review can be polluted by internal debug semantics

### 9. Handoff required fields

Relevant UI:

- conversation flow required field chips
- delivery controls
- testchat expectation

Observed risk:

- required field semantics affect both conversation and handoff completion

Contract risk:

- dashboard can appear configured while runtime handoff closure remains functionally incomplete

## Definition Of Done For Dashboard Fixes

A dashboard fix should be considered done only when all of the following are true:

- UI updated
- API/storage target confirmed
- completion-status rule confirmed
- save behavior tested
- reload behavior tested
- role permission checked
- false go-live or false ready state eliminated
- no customer-facing state depends on internal operator explanation

## Recommended Next Task

- `DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1`
