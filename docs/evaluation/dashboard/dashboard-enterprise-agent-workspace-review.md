# Dashboard Enterprise Agent Workspace Review

## Scope

- Audit date: Monday, July 27, 2026
- Baseline: `ed77c27c115094d23194a6f8316606d11adf87ad`
- Review focus: enterprise agent workspace / pilot workspace inside the dashboard setup and customer review flow

## Current Workspace Flow

The workspace exists inside the setup launch area and is currently driven by:

- setup wizard launch step in [apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/LaunchStep.tsx)
- demo workspace builder card in [apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx)
- config persistence route in [apps/dashboard/app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/conversation-engine/demo-workspace/config/route.ts)
- runtime pilot route in [apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts](/private/tmp/AI-Chatbot-dashboard-product-readiness-audit-1/apps/dashboard/app/api/sites/[siteId]/conversation-engine/runtime-pilot/route.ts)

The workspace is functionally present and already separated from public widget activation. That is a strong internal foundation.

## Agent Config

### Current state

- assistant name
- company context
- assistant role
- target audience
- tone
- allowed tasks
- blocked tasks
- required fields
- handoff and ticket allowances

### Audit assessment

- internally powerful: yes
- customer-readable: no
- workspace-first ordering: only partially

The configuration surface is still closer to an internal operator workbench than to a polished pilot workspace.

## Config Persistence

### Current state

Config persistence exists and is one of the strongest productized pieces in the workspace.

### Audit assessment

- persistence exists: yes
- persistence boundaries are explicit in code: yes
- persistence is product-explained in the broader setup shell: only partially

The product should communicate more clearly what persists and what remains transient.

## Knowledge Upload

### Current state

Knowledge can be added through setup knowledge flows and demo workspace tooling.

### Audit assessment

- technically useful: yes
- product-safe completion semantics: no
- source-state clarity: partial

This remains blocked by the wider knowledge-step completion problem.

## PDF Upload

### Current state

PDF upload exists and is productized enough for internal synthetic knowledge testing.

### Audit assessment

- internal admin/operator use: yes
- customer demo clarity: no
- save/process/ready/used chain: not explicit enough

## Testchat

### Current state

The workspace and setup flow both expose internal chat-style testing.

### Audit assessment

- valuable for internal verification: yes
- embedded coherently in customer setup review: no
- clear pass/fail semantics: limited

The testchat should become part of a structured pre-live review rather than one more card in a broad admin area.

## Boundary Panel And Internal Safety

### Current state

The workspace keeps public widget activation, provider calls, and production activation out of scope.

### Audit assessment

- internal safety boundaries: good
- customer-safe explanation of those boundaries: partial
- role-gated internal tooling: yes

The boundary posture is stronger than the UX posture.

## Pilot Guide And Review Flow

### Current state

The repo already contains pilot-oriented documentation and workspace-specific reports, but the dashboard still presents the launch step as a mixed operational surface.

### Audit assessment

- internal pilot rehearsal: conditional yes
- customer-guided pilot walkthrough: no
- self-service pilot workspace: no

## Go-Live Review

The workspace is currently attached to the launch step. That is the wrong long-term position.

Recommended direction:

- keep customer-safe review in the launch step
- move internal workspace tooling into a clearly labeled internal validation zone
- keep admin/operator-only runtime tools out of the final customer-facing review narrative

## Roles

### Admin

- full testing and workspace access: yes
- appropriate for internal product rehearsal: yes

### Operator

- substantial access: yes
- still constrained in some advanced areas: yes
- product flow clarity: still insufficient

### Viewer

- configuration access: no
- correct for safety: yes
- usable for workspace testing: no

## Layout And CSS

The workspace does not fail because of missing capabilities. It fails product-readiness review because the surrounding shell and launch area are too dense and too mixed.

## Backend Alignment Risks

The workspace relies on the broader dashboard contract discipline. Risks remain around:

- setup-state vs workspace-state understanding
- launch-step readiness vs internal validation tools
- knowledge readiness vs knowledge source presence
- testchat result quality vs launch-readiness semantics

## Decision

- workspace internally usable: `conditional`
- guided customer demo usable: `no`
- self-service customer demo usable: `no`
- real pilot usable: `blocked`

## Rationale

The workspace is technically strong enough for internal admin/operator rehearsal. It is not yet packaged strongly enough for customer-safe or pilot-safe use because:

- it lives inside an overloaded final step
- it depends on broader setup-state clarity that is not yet proven
- it exposes internal concepts too close to customer-facing review surfaces

## Recommended Next Task

- `DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1`
