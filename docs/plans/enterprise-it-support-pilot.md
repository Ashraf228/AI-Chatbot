# Enterprise IT Support Pilot

Status: integration phases 1–5 merged with exact Main-CI; Phase 6 usage runtime split in progress; pilot activation remains blocked

Current integration baseline: `1a3e542e6d972a318388a8482882adcd222df6de`

Historical Poweruser package base: `bc3e9666d3ac3a9d8de7796aca54c54f39283ae4`

## Product contract

- Audience: authenticated internal employees of one customer tenant.
- Initial boundary: one tenant and one explicitly assigned site.
- Customer poweruser scope: manage approved IT knowledge templates only.
- Ticket handoff: the existing HMAC webhook; no customer endpoint is configured by this package.
- Provider, operator, platform, deployment, and public-widget rights remain unavailable to the customer poweruser.
- Imported templates are inactive drafts. Import, overwrite, and delete do not create embeddings, documents, chunks, provider calls, or an answer-ready transition.
- FAQ, manual text, PDF, URL, re-index, activation, and answer testing remain on their existing internal paths until their provider and runtime authorization contracts are complete.

## Milestones

| Milestone | Acceptance criteria | Status |
| --- | --- | --- |
| M1 Pilot contract | Audience, one-tenant/one-site boundary, poweruser scope, ticket handoff, and no-live limits are explicit. | complete in this plan |
| M2 Staging baseline | Immutable images, HTTPS/origin switch, migration probe and controlled migration, access guard evidence, monitoring, and restore evidence are complete. | blocked on operational gates |
| M3 Customer flow | Persisted poweruser capability, site-scoped template management, provider-authorized ingestion and generation, and full API/BFF flow are proven. | partial: template, LLM and ingestion gates integrated; usage, Admin Preview, customer workspace and final integrated acceptance remain open |
| M4 Operations and onboarding | Customer-specific runbook, budget/usage evidence, support ownership, and poweruser training are complete. | not started |
| M5 Limited pilot | Separate deploy, provisioning, grant, and activation approvals are recorded and the reversible pilot acceptance run passes. | not started |

No milestone beyond M1 is complete merely because this package passes local tests.

## Workstream A scope

The implementation scope is limited to:

- a dedicated API authorization service that verifies the signed individual tenant session, active persisted tenant user, tenant membership, exact `knowledgeManagementV1` capability, and assigned site;
- a dedicated customer IT-template controller for capability-protected catalog listing, atomic draft import/overwrite, and deletion of an owned template draft;
- reuse of `ItKnowledgeTemplateImportService`, `KnowledgeSourcesService`, plan source limits, audit logging, and existing IT templates;
- a dashboard BFF transport that forwards the signed session and internal dashboard token, enforces same-origin mutation provenance, validates exact request/response shapes, and never trusts client tenant identifiers;
- a customer-facing template panel and read-only knowledge listing while provider-dependent ingestion remains blocked;
- API, BFF, UI, authorization-matrix, and regression tests plus canonical IT-support documentation.

Capability metadata contract:

```json
{
  "knowledgeManagementV1": {
    "enabled": true,
    "siteIds": ["assigned-site-id"]
  }
}
```

Only the existing internal-admin tenant-user mutation path can write this metadata. The poweruser endpoints cannot read or mutate tenant-user metadata and cannot assign capabilities.

## Workstream A invariants

- `customer` role alone never authorizes a mutation.
- Viewer, missing capability, inactive/expired principal, foreign tenant, foreign site, and unassigned site fail closed.
- Resource identifiers are checked against the already authorized tenant and site.
- Request bodies reject unknown or reserved fields.
- Multi-template import is atomic; retry with `skip_existing` is idempotent; `overwrite` returns the existing source to an inactive, not-ready draft and removes stale indexed documents in the same transaction.
- Provider/operator capability keys do not grant knowledge management and the knowledge capability grants no provider/operator action.
- No external provider, email, webhook, customer system, public widget, or production action is used.

## Historical Workstream B findings

This audit describes the original Poweruser package baseline. The gaps and code
references below are historical; the current integration table at the end of this
plan records which packages have since been merged. They are not a claim that the
current LLM or ingestion paths still lack their implemented grant checks.

### Existing protections

- Public query embeddings enter through `ChatPipelineService` and `RuntimeQueryEmbeddingService`. The latter requires an active persisted `site_runtime` grant bound to tenant, site, provider, model, environment, and `purpose=query_embedding` before calling `EmbeddingService.embedWithResolvedConfig`.
- Website URL ingestion fetches and stores provider-free text first. Runtime vector indexing is a separate grant-gated step in `WebsiteEmbeddingIngestService` and does not silently become answer-ready.
- Dashboard private reads use a signed session at the BFF, an internal dashboard token to the API, and API-side tenant/site ownership checks. Origin protection alone is not treated as backend authorization.

### Confirmed gaps

| Entry point and call chain | Existing guard | Gap and bypass consequence |
| --- | --- | --- |
| `IngestController.faq` -> `IngestService.ingestFaq` -> `EmbeddingService.embed` | internal dashboard role and site scope | no persisted provider grant is checked before every FAQ embedding |
| `IngestController.manual` -> `IngestService.ingestManual` -> `ingestTextIntoSource` -> `EmbeddingService.embed` | internal dashboard role and site scope | no persisted provider grant before manual-text embeddings |
| `IngestController.pdf` -> `IngestService.ingestPdf` -> `EmbeddingService.embed` | upload validation, internal role, site scope | no persisted provider grant before PDF embeddings |
| `IngestController.updateFaqItem` -> `IngestService.updateFaqItem` -> `EmbeddingService.embed` | internal role and resource/site scope | editing can re-embed without a persisted grant |
| `IngestService.resyncSource` for provider-backed source types | internal role and source/site scope; website runtime indexing has a grant gate | non-website re-index paths are not uniformly grant-gated |
| `ChatPipelineService` -> `LlmService.answer` / `streamAnswer` -> OpenAI chat completions | query embedding is grant-gated | the downstream LLM generation has no separate persisted tenant/site authorization |
| `LlmService.streamAnswer` -> streamed completion | no complete usage accumulator | returns zero input/output/total tokens, so streaming cost evidence is incomplete |

### Dependencies and next contracts

- Workstream A must not call the unguarded provider-backed paths; imported drafts therefore remain inactive and not ready.
- The next provider package must first define one narrow persisted LLM-generation grant contract and its tenant/site/model/environment/usage binding. If the current grant schema cannot represent that purpose without weakening the query-embedding invariant, a separate migration contract is required.
- A later, separate ingestion package must enumerate FAQ/manual/PDF/re-index entry points and put one shared provider-embedding gate immediately before every real embedding call. It must not be bundled with LLM grant schema work.
- Complete streaming usage requires requesting provider stream usage, accumulating the final usage event, defining missing-usage failure behavior, and testing billing persistence. It remains a separate package from authorization.
- Internal employee delivery must retain signed individual sessions and API-side persisted-principal/site checks. An intranet origin or network guard is defense in depth, not the identity boundary.

### Code and test evidence

- `apps/api/src/ingest/ingest.service.ts` contains the direct FAQ, manual, PDF, FAQ-edit, and non-URL re-index embedding calls. `apps/api/test/ingest.service.test.cjs` covers their existing lifecycle behavior but has no persisted-grant denial before those provider calls.
- `apps/api/src/ingest/ingest.service.ts` separates provider-free URL persistence from runtime indexing. `apps/api/test/ingest.service.test.cjs`, `apps/api/test/provider-embedding-gate.test.cjs`, and `apps/api/test/website-embedding-ingest.service.test.cjs` cover the website approval boundary.
- `apps/api/src/knowledge-sources/runtime-query-embedding.service.ts` performs the persisted query-embedding decision. `apps/api/test/runtime-query-embedding.service.test.cjs` and `apps/api/test/provider-approval-storage-lookup.test.cjs` cover missing, mismatched, expired, revoked, and malformed grants.
- `apps/api/src/ai/chat-pipeline/chat-pipeline.service.ts` calls `apps/api/src/vector/llm.service.ts` after retrieval. Existing chat and knowledge-retrieval tests use LLM doubles; there is no persisted LLM-generation grant-denial test because no such production gate exists yet.
- `apps/api/src/vector/llm.service.ts` returns zero token usage from `streamAnswer`. Existing pipeline tests exercise streamed output but do not receive a final provider usage event, so complete streamed billing remains unproven.
- `apps/dashboard/lib/auth.ts`, `apps/dashboard/lib/dashboard-api.ts`, `apps/api/src/utils/admin.guard.ts`, and `apps/api/src/utils/admin-scope.service.ts` form the existing private-access chain. The authorization matrix and security-boundary suite verify role and tenant/site scope; neither an Origin header nor the active network guard is treated as principal authentication.

## Reusable evidence

- Current main CI run `34701824649`: source gate, production-context audit, PostgreSQL isolation, and Docker build passed for the reference commit.
- Existing tenant/site scope, viewer RBAC, provider approval, runtime query embedding, migration, backup/restore tooling, and security-boundary tests remain reusable unless their code changes.
- This package adds focused evidence for the new capability, API controller, BFF transport, UI states, atomic import behavior, and resource-ID denial.

## Independent review and verification

The local review found and closed two P2 issues before commit:

- Overwrite originally accepted an existing `it_support_template` without rechecking its lifecycle. The service and the final SQL update now both reject active or runtime-ready sources, with a regression covering the protected lifecycle.
- `viewer` sessions originally inherited the existing admin/operator import controls in `KnowledgeWorkspace`. Existing knowledge is now writable only for `admin` and `operator`; customer and viewer sessions are read-only, and only customer sessions receive the separately capability-protected template panel.

Verified on Node.js `24.17.0` and npm `11.12.1`:

- focused API authorization/import tests: 17 passed;
- dashboard BFF transport: 7 passed;
- focused dashboard component tests: 5 passed;
- complete API smoke suite: 874 passed, 6 expected opt-in skips, 0 failed;
- complete UI/E2E suite: 113 passed;
- authorization matrix: 281 entries match 281 routes;
- security boundaries: 70 passed;
- API, dashboard, widget, and reporter typechecks/builds passed; the dashboard production build includes all three new BFF routes;
- production dependency audit: all five production contexts passed with no active exception;
- preflight, sensitive scan, and whitespace checks passed.

No real provider, email, webhook, customer system, staging, or production call was made. No runtime, public-widget, production, enterprise, or pilot activation is implied.

## Operational blockers

- `EXTERNAL_IPV6_PROBE_REQUIRED` remains open; the active access guard is unchanged.
- HTTPS/origin service switch, immutable candidate images, migration probe, controlled staging migration, customer endpoint configuration, and operator/capability/grant provisioning require separate authorization.
- No real customer data, provider call, webhook delivery, account provisioning, grant creation, deploy, or runtime activation is part of this branch.

## Package sequence

1. `ENTERPRISE_IT_SUPPORT_PILOT_AUTONOMOUS_PACKAGE_1`: capability-protected provider-free template drafts, tests, and this contract.
2. `SITE_RUNTIME_LLM_GENERATION_GRANT_CONTRACT_1`: narrow read-only contract and migration decision for LLM generation authorization.
3. `KNOWLEDGE_INGEST_PROVIDER_GATE_1`: shared gate for FAQ/manual/PDF/re-index embeddings after the grant contract is available.
4. `STREAMING_USAGE_ACCOUNTING_1`: complete token and cost accounting independently of authorization.
5. Staging and limited-pilot gates only after the implementation packages are independently reviewed and integrated.

## Workstream C: site-runtime LLM generation grant

Status: runtime split independently reviewed and merged in Phase 3 as `6baf93db8a51a577486e51c19dae19f0e3d4e3e4` with exact Main-CI; operational migration, provisioning, and activation remain pending

### Path and contract matrix

| Entry and server-side scope | Provider path | Runtime authorization boundary | Required contract |
| --- | --- | --- | --- |
| Public chat API resolves the site and its tenant before `ChatPipelineService.process` | `LlmService.answer` -> OpenAI chat completion | fresh exact `site_runtime` LLM-generation grant for that tenant and site | grant check immediately before the normal provider attempt |
| Public widget resolves the site by site key before `process` or `stream` | `LlmService.answer` / `streamAnswer` -> OpenAI chat completion | the same exact tenant/site grant | grant check immediately before normal or streamed provider creation |
| Internal evaluation derives tenant and site from the persisted evaluation access context | `LlmService.answer` -> OpenAI chat completion | the same exact tenant/site grant | evaluation mode is not an authorization bypass |

- `LlmService` is the only direct chat-generation provider adapter. There is no current provider fallback, and OpenAI SDK retries are disabled with `maxRetries: 0`.
- A later fallback or retry must re-enter the same authorization boundary for every outgoing attempt.
- `purpose=query_embedding` and embedding/ingestion usage contexts never authorize generation. The generation contract uses its own exact purpose and usage context.
- The runtime provider is `openai`; the only permitted endpoint is `https://api.openai.com/v1`, redirects are rejected, and any different `OPENAI_BASE_URL` fails closed before an HTTP request.
- `OPENAI_MODEL` is normalized and validated once per logical call, and that exact value is used by both the grant lookup and outgoing request. The deployment environment is resolved by the existing site-runtime environment contract.
- The site must exist under the supplied tenant. Missing context, ownership mismatch, invalid environment, storage failure, missing/ambiguous/expired/revoked grant, or any binding mismatch fails closed before provider creation.
- Grant decisions are read from storage for every logical attempt; no approval cache or implicit legacy fallback is introduced.
- Public denial and widget-stream error text is fixed and contains no grant identifier, policy reason, provider detail, storage error, or SDK response.

### Runtime split

1. Migration 033 and its schema, rollback, and preflight evidence are already integrated on the `main` baseline. This runtime split does not modify any migration or operational SQL.
2. The storage policy mapper and lookup add a purpose-specific LLM-generation query with exact tenant, site, provider, model, environment, and site-ownership checks while preserving query-embedding behavior.
3. `LlmService` performs a fresh ownership and grant check immediately before both normal and streamed provider calls, using the server-derived tenant and site context from the pipeline.
4. Synthetic SDK transports and a disposable PostgreSQL 16 integration test cover the persisted grant boundary without provider-live traffic.
5. Streaming usage accounting, grant administration, operational migration, provisioning, deployment, and activation remain separate work.

### Local verification status

- API build and all repository typechecks pass under Node 24.17.0 and npm 11.12.1.
- The focused LLM-generation, storage-policy, query-embedding, retrieval, provider-embedding, and widget-stream suites pass 93/93, including actual SDK normal/stream transport and disabled SDK logging under `OPENAI_LOG=debug`.
- The disposable PostgreSQL 16 runtime suite passes 1/1 against migrations through 033. It proves persisted-grant allowance plus revoked, query-only, and cross-tenant denial with no additional HTTP attempt, and leaves no task-owned container or volume behind.
- The API smoke suite passes 899 tests with nine expected opt-in database skips; Authorization Matrix passes 281/281 and Security Boundaries passes 70/70.
- All five production dependency-audit contexts, preflight, the uncommitted-worktree sensitive scan, and tracked/untracked diff checks pass.
- Earlier independent-review findings from the combined source package are represented by SDK-transport, widget-stream, runtime-configuration, rollback-contract, and setup-cleanup regressions. This derived runtime split still requires its own independent review before Ready for review.
- Migration 033 has not been applied to an operational database. No LLM-generation grant exists or is provisioned by this package, no provider-live call was made, and public-widget, staging, production, pilot, or enterprise activation remains unauthorized.

## Knowledge ingestion provider gate — local package

`KNOWLEDGE_INGEST_PROVIDER_GATE_1` starts from local commit
`6dc89ef024a47e4f564b243e1cf83d0e6f1efe61` (parent
`15fd2dbb176b11796f83882587bd42b85fd26cbc`). The preceding LLM logging P2
was independently closed and that package committed locally; its Poweruser
parent remains an integration dependency.

The initial audit confirmed ungated FAQ/manual/PDF ingestion, FAQ edits and
source reindex. The user authorized a distinct `knowledge_ingest` purpose and
single usage context; `knowledge_reindex` remains distinct. The local package
adds a source/source-type storage gate at every actual ingestion HTTP attempt,
with exact ownership/provider/model/environment binding, no automatic SDK
retries, fixed endpoint, redirect denial and disabled SDK logging. Prepared
replacement vectors and transactional persistence preserve existing ready
knowledge on rejection/provider/storage failure. No schema migration is needed.

See `docs/ops/knowledge-ingest-provider-gate.md` for the path/contract matrix,
rollback constraints and test boundaries. Query/LLM contracts, provider-free
website/template imports and viewer permissions remain unchanged. No grant,
provider connection or runtime activation is implied. An independent review
identified and corrected an HTTP-400 preservation regression; final verification
and manifest are reported with the local task outcome.

Remaining separate pilot gates: scoped ingestion/reindex grant provisioning,
admin-preview query review, live website-indexing activation, integration/CI and
production gates, and `EXTERNAL_IPV6_PROBE_REQUIRED`. No commit, push, PR, merge,
deploy, server/guard/network change or operational SQL was performed for this
package.


## Current sequential integration status

| Phase | Scope | Git / CI status |
| --- | --- | --- |
| 1 | Poweruser/templates including atomic DELETE rejection | merged `8d5872abd07a82c944e8cb76d243b128e3cd2124`; Main-CI passed |
| 2 | Migration 033 schema | merged `ffae00b5795615da9ae03d73a0ef570a7ddff8e7`; Main-CI passed |
| 3 | LLM-generation runtime grants | merged `6baf93db8a51a577486e51c19dae19f0e3d4e3e4`; Main-CI passed |
| 4 | Ingestion/reindex grants | merged `70dbe3836725ad764799e211b123234cd4d5e36a`; Main-CI passed |
| 5 | Migration 034 schema | merged `1a3e542e6d972a318388a8482882adcd222df6de`; Main-CI 35042178461 attempt 2 passed after an npm-audit HTTP 503 in attempt 1 |
| 6 | LLM usage runtime and existing admin dashboard | derived split in progress; fresh review and CI required |
| 7 | Admin Preview query-embedding grant | local source package reported; integration pending |
| 8 | Site-bound individual customer workspace access | local source package reported; integration pending |

The original local source packages and their reviews do not replace review of
each derived split. Historical local-package status paragraphs above describe
those original implementation tasks. Git integration does not authorize applying
migrations to a target database or activating any provider or customer traffic.

## Phase 6 measurement contract

Normal and streamed calls use provider-confirmed usage. Final textless usage
snapshots are consumed; absent/incomplete values remain explicitly unmeasured.
One server UUID identifies each actual invocation. Event insertion and confirmed
token aggregation share a transaction; repeated persistence of the same UUID does
not double-count. Tenant, site, conversation and session are revalidated before
storage. Pre-transport rejection does not create a provider consumption event.
Aborts reach the SDK and are not continued solely to obtain usage.

Existing successful-message budgets and public widget response shapes remain
unchanged. Embedding usage is excluded. The existing admin usage page separates
confirmed sums, unmeasured calls and legacy events; no new customer surface or
billing tariff is introduced. Process/storage failures can still lose unfinished
measurements; there is no durable outbox or billing reconciliation guarantee.

Migration 034 is a prerequisite for a later usage-runtime deployment. Keep its
additive schema and measurement meaning on code rollback; never turn unknown
usage into zero. The runtime rollback reference is the Phase 5 baseline above,
which retains the LLM-/ingestion-grant and DELETE protections. Operational restore,
lock/backup checks, provider grants, staging acceptance, pilot decisions and
EXTERNAL_IPV6_PROBE_REQUIRED remain separate gates. The historical external
connection evidence limitation remains open.
