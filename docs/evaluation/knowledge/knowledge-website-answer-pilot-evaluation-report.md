# Knowledge Website Answer Pilot Evaluation Report

## Summary

- Audit date: Sunday, August 2, 2026
- Baseline: `bdaea702264d9a52acaf4bfaf9485296b802fd8d`
- Scope decision: `pilot_evaluation_report_added`
- This report documents the internal evaluation evidence for the mock-only website-answer runtime pilot.
- The evaluated pilot remains internal-only and mock-only.
- Runtime gate, answer evaluation, retrieval, and source attribution remain mandatory.
- Public widget, production/live, and unknown-context paths remain blocked.
- No live provider calls, live LLM answers, live embeddings, external RAG, deploy, or customer-data paths were used.
- Guided customer demo remains `still_blocked`.
- Self-service customer demo remains `blocked`.
- Real pilot remains `blocked`.

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` established a mock-only website-answer evaluation path with retrieval and source attribution verification.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1` established a strict default-deny runtime gate for website answers.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3` established a gated mock-only embedding ingest path with verified retrieval and attribution for website sources.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1` added the internal mock-only runtime pilot orchestration path and blocked public/production/live contexts.
- What was still missing was a dedicated evaluation report that consolidates the evidence into one internal readiness artifact.

## Scope Decision

- Variant A was selected: `pilot_evaluation_report_added`.
- Existing synthetic tests and post-merge checks already provide sufficient evidence.
- No runtime code, API service code, dashboard code, or widget code changes were needed.
- No extra fixture test was required.
- Follow-up after merge remains `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1`.

## Evaluation Method

- The report is internal and evidence-based.
- The scenarios are synthetic and derived from existing unit, integration, and regression tests plus the already completed post-merge checks for `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1`.
- No live provider, live LLM, live embedding, external RAG, deploy, real website crawl, customer data, or production data was used.
- PASS means the internal mock pilot or the denial boundary behaved as expected.
- BLOCKED_AS_EXPECTED means the scenario is intentionally denied and the denial is the correct outcome.
- Evidence sources used:
  - `apps/api/test/website-answer-runtime-pilot.test.cjs`
  - `apps/api/test/website-answer-runtime-gate.test.cjs`
  - `apps/api/test/website-answer-evaluation.service.test.cjs`
  - `apps/api/test/website-embedding-ingest.service.test.cjs`
  - `apps/api/test/provider-approval-storage-lookup.test.cjs`
  - `apps/api/test/provider-approval-policy.test.cjs`
  - `apps/api/test/provider-embedding-gate.test.cjs`
  - `apps/api/test/knowledge-retrieval.service.test.cjs`
  - `apps/api/test/conversation-engine-runtime-pilot.test.cjs`
  - `apps/api/test/site-status.service.test.cjs`
  - Local build/typecheck/security runs from the post-merge gate on `bdaea702264d9a52acaf4bfaf9485296b802fd8d`

## Synthetic Scenario Matrix

| Scenario ID | Purpose | Input Category | Expected Result | Checked Mechanism | Evidence | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| `valid_internal_mock_pilot_answer` | verify the only positive pilot path | synthetic | internal mock answer returned, `publicWidgetEnabled=false`, `productionEnabled=false` | runtime pilot + gate + evaluation + retrieval + attribution | `website-answer-runtime-pilot.test.cjs`, `conversation-engine-runtime-pilot.test.cjs` | PASS |
| `missing_runtime_gate_denied` | verify no answer bypass exists when gate allow is missing | synthetic | answer blocked | runtime gate prerequisite / deny path | `website-answer-runtime-gate.test.cjs`, `conversation-engine-runtime-pilot.test.cjs` | BLOCKED_AS_EXPECTED |
| `missing_answer_evaluation_denied` | verify answer evaluation is mandatory | synthetic | answer blocked | runtime gate + pilot denial | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `missing_retrieval_denied` | verify retrieval is mandatory | synthetic | answer blocked | evaluation + gate denial | `website-answer-runtime-pilot.test.cjs`, `website-answer-runtime-gate.test.cjs`, `website-answer-evaluation.service.test.cjs` | BLOCKED_AS_EXPECTED |
| `missing_source_attribution_denied` | verify source attribution is mandatory | synthetic | answer blocked | pilot denial | `website-answer-runtime-pilot.test.cjs` | BLOCKED_AS_EXPECTED |
| `insufficient_evidence_denied` | verify insufficient evidence blocks answer output | synthetic | answer blocked | evaluation + pilot deny | `website-answer-runtime-pilot.test.cjs`, `conversation-engine-runtime-pilot.test.cjs`, `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `non_ready_source_denied` | verify non-ready sources stay blocked | synthetic | answer blocked | evaluation + gate denial | `website-answer-evaluation.service.test.cjs`, `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `extracted_source_denied` | verify extracted-but-not-ready sources stay blocked | synthetic | answer blocked | source readiness + gate denial | `knowledge-source-readiness.test.cjs`, `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `index_pending_source_denied` | verify index-pending sources stay blocked | synthetic | answer blocked | source readiness + gate denial | `knowledge-source-readiness.test.cjs`, `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `blocked_failed_source_denied` | verify blocked or failed sources stay blocked | synthetic | answer blocked | gate denial | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `cross_tenant_denied` | verify tenant isolation | synthetic | answer blocked | evaluation + gate denial | `website-answer-evaluation.service.test.cjs`, `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `cross_site_denied` | verify site isolation | synthetic | answer blocked | gate denial | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `cross_source_denied` | verify explicit source scoping | synthetic | answer blocked | gate denial | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `fake_source_attribution_denied` | verify fake attribution is blocked | synthetic | answer blocked | evaluation + gate denial | `website-answer-evaluation.service.test.cjs`, `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `public_widget_context_denied` | verify public widget path stays blocked | synthetic | answer blocked | gate + runtime pilot boundary | `website-answer-runtime-pilot.test.cjs`, `website-answer-runtime-gate.test.cjs`, `conversation-engine-runtime-pilot.test.cjs` | BLOCKED_AS_EXPECTED |
| `production_live_context_denied` | verify production/live path stays blocked | synthetic | answer blocked | gate denial | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `provider_live_mode_denied` | verify non-mock mode is blocked | synthetic | answer blocked | gate mode boundary | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `unknown_context_or_role_denied` | verify default deny remains active | synthetic | answer blocked | gate deny | `website-answer-runtime-gate.test.cjs` | BLOCKED_AS_EXPECTED |
| `no_side_effects_no_delivery` | verify no tickets/email/webhooks/DB side effects | synthetic | no side effects | runtime pilot boundary | `conversation-engine-runtime-pilot.test.cjs`, `site-status.service.test.cjs` | PASS |
| `no_live_provider_or_llm` | verify no provider/live answer path exists | synthetic | no provider, no live llm, no live embeddings, no rag | runtime pilot + gate + evaluation + embedding path boundaries | `website-answer-runtime-pilot.test.cjs`, `website-answer-runtime-gate.test.cjs`, `website-answer-evaluation.service.test.cjs`, `website-embedding-ingest.service.test.cjs`, `provider-embedding-gate.test.cjs` | PASS |

## Positive Internal Mock Pilot Case

- The only allowed path is `valid_internal_mock_pilot_answer`.
- Required preconditions:
  - `runtimeContext = internal_admin_test`
  - `answerMode = mock`
  - ready and indexed website source
  - retrieval verified
  - source attribution verified
  - answer evaluation success
  - runtime gate allow
- Verified output characteristics:
  - internal mock answer text is returned
  - `internalOnly = true`
  - `publicWidgetEnabled = false`
  - `productionEnabled = false`
  - source id / URL / title / domain remain present in the structured result
  - no provider or delivery side effects occur

## Denial Scenario Coverage

- Denials cover missing gate prerequisites, missing evaluation, missing retrieval, missing source attribution, insufficient evidence, non-ready state, extracted-only state, index-pending state, blocked/failed state, cross-tenant/site/source mismatches, fake source attribution, public widget context, production/live context, provider-live mode, and unknown context/role.
- The denial outcome is intentional and is treated as the correct safe behavior.
- No denial path introduces fallback to a live provider or a weaker answer path.

## Runtime Gate Coverage

- The runtime gate remains mandatory before answer output.
- The gate keeps default-deny semantics.
- Only an internal verified mock runtime path can be allowed.
- Public widget, production/live, unknown context, and provider-live mode remain blocked.
- Evidence:
  - `WebsiteAnswerRuntimeGateService allows only verified internal mock runtime answers`
  - `WebsiteAnswerRuntimeGateService denies missing answer evaluation and missing verification inputs`
  - `WebsiteAnswerRuntimeGateService denies public widget, production/live, unknown context and unknown roles`
  - `WebsiteAnswerRuntimeGateService denies provider-live mode and enforces mock-only operation`

## Answer Evaluation Coverage

- Answer evaluation remains required before the pilot can return an answer.
- Missing source scope, non-ready sources, retrieval-empty outcomes, tenant/site mismatches, fake source attribution, and adapter failures are blocked.
- Only verified retrieval-backed and attributed mock evaluation results can support the allow path.
- Evidence:
  - `WebsiteAnswerEvaluationService blocks missing source scope before retrieval or adapter calls`
  - `WebsiteAnswerEvaluationService blocks non-ready website sources and never calls retrieval or adapter`
  - `WebsiteAnswerEvaluationService blocks retrieval-empty answers and never calls adapter`
  - `WebsiteAnswerEvaluationService answers with verified source attribution using retrieved context only`
  - `WebsiteAnswerEvaluationService rejects fake source attribution from the mock adapter`

## Retrieval Coverage

- Retrieval remains mandatory before any pilot answer can be accepted.
- Retrieval-empty and retrieval-unverified outcomes remain blocked.
- Website ingest and embedding evidence shows retrieval verification is tied to ready/indexed mock-ingested website chunks only.
- Evidence:
  - `WebsiteAnswerEvaluationService blocks retrieval-empty answers and never calls adapter`
  - `WebsiteEmbeddingIngestService indexes website chunks with mock embeddings, verifies retrieval/source attribution, and marks source ready`
  - `WebsiteEmbeddingIngestService fails without ready transition when retrieval/source attribution cannot be verified`
  - `ChatPipeline evaluation mode bypasses general agent orchestrator and keeps retrieval sources`

## Source Attribution Coverage

- Source attribution remains mandatory before the pilot can return an answer.
- Fake attribution and mismatched attribution stay blocked.
- Verified source id / URL / title / domain remain required on the positive path.
- Evidence:
  - `WebsiteAnswerEvaluationService answers with verified source attribution using retrieved context only`
  - `WebsiteAnswerEvaluationService rejects fake source attribution from the mock adapter`
  - `WebsiteAnswerRuntimePilotService returns a verified internal mock-only pilot answer`

## Tenant / Site / Source Boundary Coverage

- Tenant, site, and explicit source boundaries remain hard requirements.
- Cross-tenant, cross-site, and cross-source scenarios remain blocked.
- The pilot does not widen tenant/site/source scope and does not introduce any viewer/public surface.
- Evidence:
  - `WebsiteAnswerEvaluationService blocks tenant and site mismatches before retrieval`
  - `WebsiteAnswerEvaluationService blocks cross-tenant or foreign source retrieval before answer generation`
  - `WebsiteAnswerRuntimeGateService denies cross-tenant, cross-site and cross-source outcomes`
  - `VectorService.search filters active ready knowledge sources and scopes tenant/site`

## Public Widget / Production Boundary Coverage

- Public widget answer runtime remains blocked.
- Production/live answer runtime remains blocked.
- Unknown context/role remains blocked.
- No public route, public widget activation, production activation, deploy, or real pilot claim was introduced.
- Evidence:
  - `WebsiteAnswerRuntimePilotService blocks pilot answer when runtime gate denies public widget contexts`
  - `WebsiteAnswerRuntimeGateService denies public widget, production/live, unknown context and unknown roles`
  - `runtime pilot blocks website answer runtime gate requests for public widget contexts and suppresses response preview`
  - `SiteStatusService keeps live state blocked for review until explicit go-live activation happens`

## No Provider / No Live Answer Coverage

- The pilot remains mock-only.
- No live provider call path is used.
- No live LLM answer path is used.
- No live embeddings are executed.
- No external RAG path is executed.
- No approval API endpoint or approval grant is created.
- Evidence:
  - `WebsiteAnswerRuntimeGateService denies provider-live mode and enforces mock-only operation`
  - `WebsiteAnswerEvaluationService sanitizes adapter failures and requires mock-only mode`
  - `WebsiteEmbeddingIngestService requires a mock adapter and sanitizes adapter failures`
  - `ProviderEmbeddingGate denies website runtime indexing by default when policy is missing`
  - `runtime pilot blocks query-runner, production-data and deploy requests safely`

## Runtime / Completion Boundary Coverage

- No `runtime_readiness` change was introduced by the pilot.
- No completion rule change was introduced by the pilot.
- No approval grants are created.
- No ticket, email, or webhook delivery is triggered.
- No deploy or go-live claim is added.
- Evidence:
  - `runtime pilot handles dashboard support problem without side effects`
  - `runtime pilot escalates explicit human request without creating a real ticket`
  - `runtime pilot simulates ticket field collection without any delivery side effects`
  - `SiteStatusService keeps live state blocked for review until explicit go-live activation happens`

## Evidence Commands

- `npm run build:api`
- `npm run check:dashboard`
- `npm run build:dashboard`
- `npm run check:all`
- `node --test apps/api/test/website-answer-runtime-pilot.test.cjs`
- `node --test apps/api/test/website-answer-runtime-gate.test.cjs`
- `node --test apps/api/test/website-answer-evaluation.service.test.cjs`
- `node --test apps/api/test/website-embedding-ingest.service.test.cjs`
- `node --test apps/api/test/provider-approval-storage-lookup.test.cjs`
- `node --test apps/api/test/provider-approval-storage-schema.test.cjs`
- `node --test apps/api/test/provider-approval-policy.test.cjs`
- `node --test apps/api/test/provider-embedding-gate.test.cjs`
- `node --test apps/api/test/knowledge-retrieval.service.test.cjs`
- `node --test apps/api/test/conversation-engine-runtime-pilot.test.cjs`
- `node --test apps/api/test/site-status.service.test.cjs`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/DemoWorkspaceAgentBuilderCard.test.tsx apps/dashboard/test/ConversationEngineDemoWorkspaceConfigRoute.test.tsx apps/dashboard/test/ConversationEnginePdfExtractRoute.test.tsx apps/dashboard/test/ConversationEngineRuntimePilotRoute.test.tsx apps/dashboard/test/CustomerSetupWizard.test.tsx`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/CustomerSetupWizard.test.tsx`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/CustomerStatusBar.test.tsx`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/EvaluationWorkspace.test.tsx`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/CustomerNavGroups.test.tsx`
- `npm exec vitest -- run --config vitest.ui.config.ts apps/dashboard/test/SiteForm.test.tsx`
- `npm exec vitest -- run apps/dashboard/test/DashboardRoleAccess.test.ts`
- `scripts/ops/codex-preflight.sh`
- `scripts/ops/codex-sensitive-scan.sh --base origin/main --head HEAD`
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

## Known Limitations

- The report does not run a live pilot.
- The report does not use real websites, real customer data, or production data.
- The report does not claim provider readiness, production readiness, or customer-demo readiness.
- The report depends on existing synthetic tests and completed post-merge evidence rather than a separate execution runner.
- The accepted Next-internal PostCSS exception remains temporary and unchanged until `2026-08-20`.

## Remaining Follow-up Fixes

- Gate review: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-EVALUATION-REPORT-1-D`
- After merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1`

## Safety Boundaries

- Report is internal
- Scenarios are synthetic
- No customer data
- No production data
- No production secrets
- No credentials
- No passwords
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No deploy
- No public widget
- No real pilot
- No provider approval claim
- No customer-data approval claim
- No production approval claim
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
