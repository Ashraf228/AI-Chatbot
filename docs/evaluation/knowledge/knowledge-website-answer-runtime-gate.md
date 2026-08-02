# Knowledge Website Answer Runtime Gate

## Summary

- Audit date: Sunday, August 2, 2026
- Baseline: `688dc25d03d80d9e584a0786ae470b2bdcb04f46`
- Scope decision: `website_answer_runtime_gate_added`
- Added an internal website answer runtime gate for verified mock-only answer paths
- Retrieval remains mandatory before any runtime answer is allowed
- Source attribution remains mandatory before any runtime answer is allowed
- Answer evaluation remains mandatory before any runtime answer is allowed
- Default deny remains active for public, production, live, unknown, and insufficient-evidence paths
- No live provider calls were added
- No live LLM answers were added
- No live embeddings were added
- No external RAG was added
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` added a provider-free internal answer evaluation path for ready website sources with retrieval and source attribution verification.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-3` already enforced ready-only mock ingest boundaries.
- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-LOOKUP-1` and `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` kept provider approval state explicit and read-only.
- The runtime pilot still lacked a dedicated website-answer gate layer and therefore had no explicit internal-only allow decision for verified website answers.

## Scope Decision

- Variant A is safe.
- A pure gate service can consume the existing evaluation result without any provider call or database write.
- The current admin-only runtime pilot already provides an internal test-only path and can surface gate decisions without creating a public route.
- The gate can remain default deny while allowing only a verified internal mock answer path.
- No migration, dependency, approval API, or public widget change is required.

## Website Answer Runtime Gate Model

- Added internal service: `apps/api/src/knowledge-sources/website-answer-runtime-gate.service.ts`
- Added runtime-pilot integration in the existing internal admin-test path only
- The gate consumes:
  - tenant id
  - site id
  - optional source id
  - source type
  - source active status
  - runtime readiness
  - index status
  - runtime context
  - environment
  - actor role
  - answer mode
  - existing website answer evaluation result
- The gate returns:
  - allow / deny decision
  - decision code
  - sanitized message
  - runtime mode
  - human-review marker
  - verified source identity fields
  - missing evidence
  - warnings
  - fixed no-provider / no-LLM / no-embedding / no-RAG flags

## Gate Inputs

- Tenant and site context must be present.
- Source type must be `url`.
- Source must be active.
- Source must be `runtime_readiness = ready`.
- Source must be `index_status = indexed`.
- Runtime context must be `internal_admin_test`.
- Environment must not be `production` or `live`.
- Actor role must stay within `admin` or `operator`.
- Answer mode must stay `mock`.
- A successful answer evaluation result must be present.
- Retrieval verification must be true.
- Source attribution verification must be true.

## Gate Denials

- Missing answer evaluation: denied
- Retrieval not verified: denied
- Source attribution not verified: denied
- Insufficient evidence: denied
- Fake source attribution: denied
- Source inactive: denied
- Source not ready: denied
- Source not indexed: denied
- Unsupported source type: denied
- Tenant mismatch: denied
- Site mismatch: denied
- Source scope mismatch: denied
- Public widget context: denied
- Production/live context: denied
- Unknown context: denied
- Unknown actor role: denied
- Provider/live answer mode: denied
- Non-mock mode: denied

## Internal Mock Runtime Allow Path

- The only allow path is an internal mock-only runtime decision.
- The allow path requires:
  - internal admin-test runtime context
  - non-production environment
  - operator/admin actor role
  - ready and indexed website source
  - successful answer evaluation
  - verified retrieval
  - verified source attribution
  - mock-only answer mode
- The allow path does not invoke any provider.
- The allow path does not generate any live answer.
- The allow path does not activate a public widget or production runtime.

## Retrieval Requirement

- Retrieval remains mandatory before any runtime answer path is allowed.
- Missing retrieval verification blocks the runtime gate.
- Retrieval-empty and insufficient-evidence evaluation outcomes remain blocked.
- No runtime allow decision can bypass retrieval verification.

## Source Attribution Requirement

- Source attribution remains mandatory before any runtime answer path is allowed.
- Missing source attribution blocks the runtime gate.
- Fake source attribution remains blocked.
- Cross-source mismatches remain blocked.
- No runtime allow decision can bypass source attribution verification.

## Answer Evaluation Requirement

- Answer evaluation remains mandatory before any runtime answer path is allowed.
- Runtime gating does not replace answer evaluation.
- Runtime gating only consumes the evaluation result and adds runtime-context safety boundaries.
- A denied evaluation result remains denied at runtime.

## Default Deny Behavior

- Unknown or incomplete state stays denied.
- Public widget stays denied.
- Production/live stays denied.
- Provider-live mode stays denied.
- Non-ready sources stay denied.
- Non-indexed sources stay denied.
- Cross-tenant, cross-site, and cross-source outcomes stay denied.

## Runtime / Completion Boundary

- The gate does not change `runtime_readiness`.
- The gate does not change completion rules.
- The gate does not write approvals.
- The gate does not create side effects.
- The gate does not alter existing suppression of ticket, email, webhook, SQL, query-runner, or provider activity in runtime pilot.

## Tenant / Site / Source Boundary

- Tenant context remains required.
- Site context remains required.
- Exact source scope remains required.
- The runtime gate does not widen any tenant, site, or source scope.
- Any mismatch remains blocked with a sanitized denial.

## Public Widget / Production Boundary

- Public widget answer remains blocked.
- Production answer runtime remains blocked.
- No deploy path was added.
- No public route was added.
- No viewer path was added.
- No enterprise approval or rollout claim was added.

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No approval API endpoints
- No approval grants
- No deploy
- No public widget activation
- No production activation

## Dashboard Impact

- No dashboard code was required.
- No UI toggle was added.
- No provider settings UI was added.
- No public-widget activation hint was added.
- No go-live claim was added.

## Tests Added

- Added: `apps/api/test/website-answer-runtime-gate.test.cjs`
  - missing answer evaluation denied
  - retrieval missing denied
  - source attribution missing denied
  - insufficient evidence denied
  - fake source denied
  - non-ready / non-indexed / inactive / unsupported source denied
  - cross-tenant / cross-site / cross-source denied
  - public widget / production / unknown context denied
  - live-provider / non-mock mode denied
  - verified internal mock runtime allowed
  - no provider / no LLM / no embedding / no RAG side effects
- Extended: `apps/api/test/conversation-engine-runtime-pilot.test.cjs`
  - verified internal mock runtime path exposed through runtime pilot
  - public widget runtime gate denial suppresses response preview

## Known Limitations

- The gate is internal only.
- The gate still depends on a precomputed answer evaluation result.
- The gate does not activate any real customer-facing answer runtime.
- The gate does not approve provider usage.
- Guided customer demo remains blocked.
- Self-service customer demo remains blocked.
- Real pilot remains blocked.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1-D`
  - review and merge the internal website answer runtime gate
- after merge: `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1`
  - evaluate whether a later internal pilot path can surface website answers safely without public or production rollout

## Safety Boundaries

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No customer data
- No production data
- No production secrets
- No credentials
- No passwords
- No approval API endpoints
- No approval grants
- No provider approval claimed
- No customer-data approval claimed
- No production approval claimed
- No enterprise approval claimed
- No deploy
- No public widget activation
- No fake source attribution
