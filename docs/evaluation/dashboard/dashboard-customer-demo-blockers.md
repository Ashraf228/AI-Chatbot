# Dashboard Customer Demo Blockers

## Scope

- Audit date: Monday, July 27, 2026
- Baseline: `ed77c27c115094d23194a6f8316606d11adf87ad`

This document lists blockers for:

- guided customer demo
- self-service customer test
- NOLIS / enterprise pilot usage

## Guided Demo Blockers

### 1. Go-live step is overloaded and not customer-safe

The final step still contains internal review and admin-only tooling. A guide can explain it, but the product surface itself does not yet communicate a clean "review before live" story.

### 2. Setup completion states are not trusted enough

The current completion model depends on backend status keys that are separate from the wizard save logic. Guided demos should not depend on an operator explaining away inconsistent step state.

### 3. Customer creation and setup duplicate role/task semantics

The customer can be created with assistant role, target users, and enabled tasks before setup repeats related concepts. This makes the product look inconsistent very early in the flow.

### 4. Knowledge/PDF step lacks a clear save-and-continue contract

The operator can add or upload knowledge, but the step does not currently provide one explicit completion handshake that says:

- persisted
- processed
- active
- sufficient for next step

### 5. Internal testchat is not integrated as a clean review artifact

The testchat works as an internal tool, but it is still mixed with technical admin surfaces rather than positioned as a structured pre-live validation step.

### 6. Navigation and shell are too loose

Overview, setup, site tabs, command center, and workspace areas feel like adjacent surfaces rather than one clearly guided customer workspace.

### 7. Layout/CSS still feels unfinished

Long forms, many stacked cards, and repeated status areas create friction during a guided walkthrough.

## Self-Service Test Blockers

### 1. Viewer cannot configure the workspace

Viewer access is intentionally constrained. That is correct for safety, but it means self-service product evaluation is still blocked.

### 2. No trustworthy customer-safe setup model yet

Self-service requires the product to explain:

- what to do first
- what is saved
- what is optional
- what blocks launch

The current product still assumes expert interpretation.

### 3. Deploy/public widget remains blocked

That boundary is correct and must remain. It also means the self-service path cannot currently progress into a real activation path.

### 4. Knowledge and testchat flows are still operator-mediated

Without a simpler setup contract and stronger status clarity, self-service users will not know whether knowledge or chat results are valid.

## NOLIS / Enterprise Pilot Blockers

### 1. No product-safe internal admin/operator access pattern documented in the dashboard itself

The product still assumes controlled internal access and guided setup, not a polished pilot operator flow.

### 2. New UI may not be the only factor; the readiness semantics are the main blocker

Even if the newest dashboard is live, the launch review and setup semantics still need P0 fixes before a serious pilot.

### 3. Completion-state truth is not yet strong enough for pilot sign-off

Pilot sign-off cannot rely on a UI that may show open or complete states without a field-level contract matrix behind it.

### 4. Knowledge/PDF/chat persistence and clarity remain incomplete for product trust

The product has strong internal tooling, but it still lacks the clarity needed for pilot operators to judge what is durable, what is transient, and what is demo-only.

### 5. Performance and layout still risk undermining trust

Enterprise users interpret UX instability as operational risk.

## Allowed Workarounds

- internal owner/admin guided walkthroughs
- admin/operator-only explanations during internal review
- internal testchat use without public widget activation
- knowledge upload with synthetic/non-customer content
- command-center and setup walkthrough for internal readiness assessment

## Not Allowed Workarounds

- claiming enterprise readiness
- claiming self-service readiness
- claiming real pilot approval
- enabling deploy or public widget as a workaround for dashboard gaps
- using customer data or production data to mask product-readiness issues
- treating internal admin-only debug cards as customer-safe go-live review

## Required Blockers To Carry Forward

- no known customer-safe internal admin/operator packaging in-product
- new UI not sufficient by itself
- go-live step overloaded and unklar
- setup completion states fehlerhaft / not yet contract-proven
- customer creation and setup duplicate agent-role/task semantics
- knowledge/PDF step missing clear save-and-continue
- testchat not cleanly integrated into setup/go-live review
- CSS/layout not product-clean enough
- viewer cannot configure workspace
- performance/perceived slowness remains a concern
- knowledge/PDF/chat persistence semantics not clear enough
- deploy/public widget remains blocked by design

## Decision Summary

- guided customer demo: blocked
- self-service customer demo: blocked
- NOLIS / enterprise pilot: blocked

## Recommended Next Task

- `DASHBOARD-P0-UI-BACKEND-CONTRACT-ALIGNMENT-1`
