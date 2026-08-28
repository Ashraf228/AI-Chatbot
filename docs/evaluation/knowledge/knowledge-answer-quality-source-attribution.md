# Knowledge Answer Quality Source Attribution

## Summary

- Audit date: Friday, August 28, 2026
- Scope decision: `knowledge_answer_quality_source_attribution_boundaries_improved`
- Knowledge-answer quality and source-attribution boundaries were tightened with existing internal evaluation data only
- Denied, insufficient-evidence, retrieval-blocked, and fake-attribution paths no longer surface attribution-looking source metadata
- No API contract expansion was introduced
- No public widget behavior was changed
- No live provider calls, live embeddings, or RAG activation were added

## Previous State

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-STATE-FIX-1` already ensured denied and failed ingest states do not produce usable chunks, embeddings, or ready transitions.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-MOCK-ADAPTER-HARDENING-1` already restricted mock ingest behavior to registered safe mock adapters.
- Website-answer evaluation and runtime-gate logic still allowed denied outcomes to carry source metadata fields, which could imply attribution without verified evidence.

## Scope Decision

- Variant A is safe.
- The fix is limited to internal API evaluation and runtime-gate behavior plus API tests.
- Existing result shapes are preserved; only denied-path attribution values are sanitized to `null` and denied pilot source lists are kept empty.
- No widget, workflow, package, migration, deploy, provider, or database changes are required.

## Answer Quality Goal

- Internal answer-quality behavior must remain conservative when knowledge support is missing.
- Denied or insufficient-evidence outcomes must not look like successful knowledge-backed answers.
- The implementation keeps existing conservative decision semantics rather than introducing a new externally visible support-state enum.

## Source Attribution Boundary

- Source attribution is now emitted only when the evaluation result is both retrieval-verified and source-attribution-verified.
- Denied evaluation results always clear `sourceId`, `sourceUrl`, `sourceTitle`, and `sourceDomain`.
- Denied runtime-gate results also always clear those attribution fields.
- Runtime-pilot source summaries are now only built from verified evaluation outcomes.

## No Source / No Evidence Boundary

- If no verified source evidence exists, source attribution stays empty.
- Denied pilot responses no longer include attribution-looking source arrays when evidence is missing.
- No fabricated source titles, URLs, IDs, or domains are introduced as fallback values.

## Retrieval Blocked Boundary

- Retrieval-blocked, retrieval-empty, insufficient-evidence, and fake-source-attribution states remain denied.
- Those states no longer expose source metadata that could be misread as verified knowledge support.
- No provider, embedding, or RAG fallback is activated when retrieval evidence is missing.

## Tenant / Site / Source Boundary

- Attribution remains scoped to the current tenant, site, and optional source.
- Cross-tenant, cross-site, and source-scope mismatch paths stay denied and attribution-free.
- Runtime-pilot summaries only surface source data from verified in-scope evaluation results.

## Failed / Denied Ingest Boundary

- Failed or denied ingest leftovers remain unusable for attribution.
- The change preserves the earlier ingest-state safety boundary by ensuring denied answer paths cannot surface stale source metadata as if it were verified.

## Public Widget Boundary

- No `apps/widget/**` files were changed.
- No public-widget response contract was widened.
- No internal debug, preview, compare, or quality-only details were added to public widget paths.

## Dashboard Testchat Boundary

- No dashboard code or dashboard tests were changed.
- Internal testchat behavior is indirectly safer because backend denied-path attribution is now conservative.
- No public or production activation semantics were added.

## No Live Provider / No Embedding / No RAG Boundary

- No live provider calls
- No live embeddings
- No embedding generation
- No RAG activation
- No external crawling
- No database writes
- No new persistence

## Tests

- `scripts/ops/codex-preflight.sh`
- `npm run build:api`
- `node apps/api/test/website-answer-evaluation.service.test.cjs`
- `node apps/api/test/website-answer-runtime-gate.test.cjs`
- `node apps/api/test/website-answer-runtime-pilot.test.cjs`
- `node apps/api/test/website-answer-runtime-pilot-observability.test.cjs`
- `node apps/api/test/provider-approval-policy.test.cjs`
- `node apps/api/test/provider-embedding-gate.test.cjs`
- `node apps/api/test/provider-approval-storage-lookup.test.cjs`
- `node apps/api/test/ingest.service.test.cjs`
- `node apps/api/test/website-embedding-ingest.service.test.cjs`
- `npm run test:smoke --workspace=apps/api`
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `npm run check:all`

## Safety Boundaries

- No widget changes
- No workflow changes
- No scripts changes
- No package or lockfile changes
- No migration or SQL changes
- No provider SDK changes
- No secrets, credentials, or API keys added
- No customer data or production data used
- No deploy executed

## Follow-up

- Next gate task: `KNOWLEDGE-ANSWER-QUALITY-SOURCE-ATTRIBUTION-1-D`
- Post-merge follow-up: `KNOWLEDGE-ANSWER-QUALITY-SOURCE-ATTRIBUTION-1-E`
- Post-merge-check follow-up: `INTERNAL-DEMO-READINESS-PACK-1`
