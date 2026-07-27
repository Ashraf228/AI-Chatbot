# Dashboard UI Backend Contract Matrix

## Summary

- Audit date: Monday, July 27, 2026
- Baseline: `25d5c1c6adcb6c3e01bcf1f6033d78c77610f569`
- Scope: dashboard setup shell, customer create, conversation-engine demo workspace, status/reload/readiness contract
- This matrix is the binding baseline for all following Dashboard P0 fixes.
- No UI fix is complete without save, reload, completion-status, and role-boundary coverage.
- Customer create vs setup remains a drift risk.
- Conversation logic, design, and privacy completion remain drift-risk areas.
- Knowledge/PDF save-and-continue remains a drift risk.
- The go-live step remains a review/readiness surface, not a developer-debug area.
- Deploy and public-widget activation remain blocked.

## Scope

This contract matrix covers the minimum P0 dashboard areas that currently influence setup truth:

- customer create
- setup wizard customer/bot/delivery/flow/knowledge/design/launch
- demo workspace agent config
- runtime pilot and PDF extract admin proxies
- dashboard status/reload/readiness mappings

## Contract Matrix

| Area / field | UI label | Frontend component | Frontend state key | Submit payload key | Dashboard proxy endpoint | API endpoint | Backend DTO / validation | Backend storage key | Read / reload endpoint | Completion / readiness rule | Role permission | Current risk | Required test | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Customer create basics | Kundenname, Website / Domain | `apps/dashboard/components/sites/SiteForm.tsx` | local form state | `name`, `allowedDomains`, `siteKey`, `tenantId` | direct dashboard page action | `POST /api/sites` | site create DTO | `sites.name`, `sites.allowed_domains`, `sites.site_key`, `sites.tenant_id` | site overview fetches `GET /api/widget/sites/:siteId` later in setup | `basics` complete when name and allowed domain exist | admin/operator create; viewer/customer no write | aligned for basics only | create-form test, setup reload test | aligned |
| Customer create role / task seed | KI-Mitarbeiterrolle, Hauptaufgaben | `apps/dashboard/components/sites/SiteForm.tsx` plus `apps/dashboard/lib/site-create-config.ts` | local form state | nested `config.assistantProfile`, `config.enabledTasks`, legacy `config.botType` etc. | direct dashboard page action | `POST /api/sites` | site create config passthrough | `sites.config.assistantProfile`, `sites.config.enabledTasks`, legacy keys | setup reload later normalizes from merged site payload | no dedicated completion rule; creates duplicate semantics before setup | admin/operator create; viewer/customer no write | duplicated source of truth against setup wizard | create-form test plus contract matrix review | drift_risk |
| Setup customer basics | Kundendaten | `apps/dashboard/components/customer/CustomerSetupWizard.tsx` | `profileForm` | `name`, `allowedDomains`, `websiteUrl`, `supportEmail`, `phone`, `language` | `PATCH /api/sites/:siteId`, `PATCH /api/widget/branding/:siteId`, `PATCH /api/widget/config/:siteId` | `/admin/sites/:siteId`, `/admin/widget/branding/:siteId`, `/admin/widget/config/:siteId` | dashboard route guards plus widget/site update DTOs | `sites.name`, `sites.allowed_domains`, `sites.config.websiteUrl`, `supportEmail`, `phone`, `language`, branding subset | `GET /api/widget/sites/:siteId` | `basics` complete when name + allowed domain exist | admin/operator/customer can read some widget routes; setup writes are admin/operator flows | split write path across basics + branding + widget config | `CustomerSetupWizard.test.tsx` save/reload, status fetch | aligned |
| Setup bot goal / tone in universal mode | Aufgabe des KI-Mitarbeiters, Kommunikationsstil | `CustomerSetupWizard.tsx` | `goalForm.primaryGoal`, `goalForm.tone`, `goalForm.knowledgeMode`, `goalForm.fallbackBehavior`, `goalForm.ctaText`, `goalForm.systemPrompt` | `assistantProfile.*` via assistant-profile save, root `ctaText` and optional `systemPrompt` | `PATCH /api/sites/:siteId/assistant-profile`, `PATCH /api/widget/config/:siteId` | `/admin/sites/:siteId/assistant-profile`, `/admin/widget/config/:siteId` | assistant-profile save validation plus widget config DTO | authoritative `site_modules[module_key=assistant-profile].config.assistantProfile`; legacy bridge `sites.config.ctaText` / `systemPrompt` | `GET /api/widget/sites/:siteId`, `GET /api/sites/:siteId/status` | `template` and `behavior` now use resolved assistant-profile module + legacy text bridge | admin/operator write; viewer/customer no write | previously status read root-only and missed saved module state | `CustomerSetupWizard.test.tsx`, `site-status.service.test.cjs` | aligned_after_fix |
| Setup bot goal / tone in legacy mode | Ziel des Chatfensters, Tonalität | `CustomerSetupWizard.tsx` | `goalForm.*` | root config keys `primaryGoal`, `setupGoal`, `botType`, `tone`, `knowledgeMode`, `fallbackBehavior`, `ctaText`, `systemPrompt` | `PATCH /api/widget/config/:siteId` | `/admin/widget/config/:siteId` | widget config DTO | `sites.config.*` legacy keys | `GET /api/widget/sites/:siteId`, `GET /api/sites/:siteId/status` | `template` + `behavior` from root config | admin/operator write | legacy path still coexists with universal path | `CustomerSetupWizard.test.tsx` legacy goal save | aligned_with_legacy_caveat |
| Setup conversation logic in universal mode | Antworten, Rückfragen, Pflichtinformationen | `CustomerSetupWizard.tsx` | `flowForm.requiredFields`, `flowForm.enabledTasks` | `assistantProfile.requiredFields`, `assistantProfile.enabledTasks`, handoff / delivery fields | `PATCH /api/sites/:siteId/assistant-profile` | `/admin/sites/:siteId/assistant-profile` | assistant-profile save validation | `site_modules[module_key=assistant-profile].config.assistantProfile.requiredFields/enabledTasks` | `GET /api/widget/sites/:siteId` reload normalizes module over legacy | dashboard flow step now maps to backend `behavior` rule; no separate backend flow status yet | admin/operator write | previous dashboard mapped flow to nonexistent status keys | `CustomerSetupWizard.test.tsx` save/reload + status mapping | aligned_after_fix |
| Setup conversation logic in legacy mode | Antworten, Rückfragen, Pflichtinformationen | `CustomerSetupWizard.tsx` advanced legacy area | `flowForm.requiredFields`, `flowForm.enabledTasks` | `conversationFlow.requiredFields`, `enabledTasks` | `PATCH /api/widget/config/:siteId` | `/admin/widget/config/:siteId` | widget config DTO | `sites.config.conversationFlow.requiredFields`, `sites.config.enabledTasks` | `GET /api/widget/sites/:siteId` | backend `behavior` rule reads root goal + root text; legacy flow is still an indirect contributor | admin/operator write | legacy and universal persistence targets differ behind one visible step | `CustomerSetupWizard.test.tsx` legacy flow save | drift_risk |
| Knowledge text / URL / PDF | Wissen | `KnowledgeStep` inside `CustomerSetupWizard.tsx` | `knowledgeForm`, `pdfFile`, local source list | immediate create/import/upload actions | ingest routes under dashboard API | ingest backend endpoints | per-ingest validation and file type/size checks | knowledge source rows plus document processing state | `getKnowledgeSources`, `GET /api/sites/:siteId/status` | `knowledge` complete only when ready active knowledge is available; upload alone is not enough | admin/operator write; viewer/customer no write | save-and-continue semantics remain indirect | knowledge source tests, PDF extract route test | drift_risk |
| Demo PDF extract | PDF-Demo-Wissen | `DemoWorkspaceAgentBuilderCard` and PDF route caller | transient form/file state | multipart `file` only | `POST /api/sites/:siteId/conversation-engine/knowledge/pdf-extract` | `/admin/sites/:siteId/conversation-engine/knowledge/pdf-extract` | admin/operator route guard, PDF type/size boundary | in-memory extraction only, no persistence | no reload endpoint by design | not part of setup completion; test-only helper | admin/operator only; viewer/customer forbidden | aligned and intentionally transient | `ConversationEnginePdfExtractRoute.test.tsx` | aligned |
| Demo workspace config | assistantName, companyContext, assistantRole, targetAudience, tone, allowedTasks, blockedTasks, handoffAllowed, ticketAllowed, requiredFields | `DemoWorkspaceAgentBuilderCard.tsx` | local card form state | `demoWorkspace.*` allowlist only | `GET/PUT/DELETE /api/sites/:siteId/conversation-engine/demo-workspace/config` | `/admin/sites/:siteId/conversation-engine/demo-workspace/config` | backend config allowlist validation | persisted demo-workspace config only; no knowledge/chat/pdf state | same route GET | no setup completion; admin review tool only | admin/operator only | aligned; persistent config is separate from transient knowledge/chat | `DemoWorkspaceAgentBuilderCard.test.tsx`, demo-workspace config API test | aligned |
| Runtime pilot | interner Testchat / Runtime-Pilot | `LaunchStep` admin cards and runtime pilot proxy | request-local test payload | `message`, `history`, `knowledgeSnippets`, `demoWorkspace`, `existingConversationState` | `POST /api/sites/:siteId/conversation-engine/runtime-pilot` | `/admin/sites/:siteId/conversation-engine/runtime-pilot` | admin/operator route guard and runtime pilot validation | no persistence by design | none | not a completion signal; admin-only evaluation surface | admin/operator only; customer/viewer forbidden | still mixed into launch review area | runtime pilot route test + runtime pilot API tests | drift_risk |
| Design visual state | Farben, Logo, Begrüßung, Launcher | `DesignStep` in `CustomerSetupWizard.tsx` | `designForm.brandColor`, `accentColor`, `logoUrl`, `welcomeMessage`, `placeholderText`, `widgetPosition`, `launcherLabel` | branding payload + widget config payload | `PATCH /api/widget/branding/:siteId`, `PATCH /api/widget/config/:siteId` | `/admin/widget/branding/:siteId`, `/admin/widget/config/:siteId` | branding + widget config validation | `sites.config.brandColor`, `accentColor`, `logoUrl`, `welcomeMessage`, `placeholderText`, `widgetPosition`, `launcherLabel` | `GET /api/widget/sites/:siteId`, status endpoint | `design` complete only with visual design + privacy URL | admin/operator write | split write path; status depends on both domains | design save/reload test, status contract follow-up | drift_risk |
| Privacy / consent | Datenschutzlink, Datenschutzhinweis, Consent | `DesignStep` | `designForm.privacyUrl`, `privacyNoticeText`, `consentRequired` | branding `privacyUrl` + widget config `privacyNoticeText`, `consentRequired` | `PATCH /api/widget/branding/:siteId`, `PATCH /api/widget/config/:siteId` | `/admin/widget/branding/:siteId`, `/admin/widget/config/:siteId` | branding + widget config validation | `sites.config.privacyUrl`, `privacyNoticeText`, `consentRequired` | `GET /api/widget/sites/:siteId`, status endpoint | `design` warning if visual state exists but privacy URL missing | admin/operator write | privacy and consent still span multiple surfaces | design/privacy tests, status follow-up | drift_risk |
| Launch / live status | Test & Livegang | `LaunchStep.tsx` | derived from status payload and local testchat state | go-live action, testchat save fields | `POST /api/sites/:siteId/go-live`, widget test chat route, status route | `/admin/sites/:siteId/go-live`, widget test backend, `/admin/sites/:siteId/status` | go-live guard, testchat save, status rule | `sites.config.lastTestedAt`, `lastTestQuestion`, `lastTestAnswer`, `goLiveAt`, `isActive` | `GET /api/sites/:siteId/status` | `launch` sidebar maps `test`, `embed`, `live`; deploy/public widget still blocked | admin/operator review; customer/viewer no admin cards | launch step still overloaded with admin diagnostics | launch component tests plus status review follow-up | drift_risk |

## Aligned Areas

- Setup customer basics save and reload paths are coherent.
- Demo workspace config persistence already enforces an allowlist and excludes knowledge, PDF, and chat artifacts.
- Demo PDF extract route is admin/operator-only, non-persistent, and no-store.
- Universal assistant-profile saves now influence backend status evaluation through the resolved module profile.
- Wizard bot and flow steps now map to actual backend status keys instead of a nonexistent flow keyspace.

## Drift Risk Areas

- Customer create still seeds role/task semantics before setup rewrites related concepts.
- Legacy and universal conversation logic still use different persistence targets behind one visible step.
- Knowledge/PDF completion remains indirect because source existence, readiness, and activation are different states.
- Design and privacy still span multiple write paths and one shared readiness surface.
- Launch remains a mixed operator review surface instead of a narrow product-safe go-live review step.
- Runtime pilot remains an internal evaluation tool, not a customer-safe completion artifact.

## Unknown Areas

- A dedicated backend flow/readiness key separate from `behavior` does not yet exist.
- The exact long-term contract between customer create defaults and setup authority is not settled.
- A customer-safe explanation model for deploy/public-widget state is still pending the go-live redesign follow-up.

## Required Tests

- save/reload/status tests for wizard customer/bot/flow/design paths
- demo workspace persistence allowlist tests
- PDF extract admin boundary tests
- runtime pilot admin boundary tests
- status service regression tests for module-backed assistant-profile readiness
- authorization matrix and security-boundary regression checks

## Recommended Follow-up Fixes

- `DASHBOARD-P0-SETUP-COMPLETION-STATE-FIX-1`
- `DASHBOARD-P0-GO-LIVE-STEP-REDESIGN-1`
- `DASHBOARD-P0-CUSTOMER-CREATE-VS-SETUP-DEDUPLICATION-1`
- `DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1`
- `DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`
- `CONV-ENGINE-HANDOFF-CLOSURE-1`
