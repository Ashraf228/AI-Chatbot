# Enterprise IT Support Pilot

Status: provider-free customer poweruser package implemented and independently reviewed locally

Reference commit: `bc3e9666d3ac3a9d8de7796aca54c54f39283ae4`

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
| M3 Customer flow | Persisted poweruser capability, site-scoped template management, provider-authorized ingestion and generation, and full API/BFF flow are proven. | partial: provider-free template package complete; provider authorization packages remain open |
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

## Workstream B findings

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
