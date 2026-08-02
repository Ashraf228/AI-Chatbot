# Knowledge Website Answer Pilot Observability

## Summary

- Audit date: Sunday, August 2, 2026
- Baseline: `799374d4643063219b1a15f138cb80273bb5251c`
- Scope decision: `pilot_observability_added`
- Added a structured internal observability envelope for the website-answer runtime pilot
- Observability remains internal-only, mock-only, non-persistent, and provider-free
- Allowed and denied pilot paths now expose sanitized gate, evaluation, retrieval, source-attribution, denial, and safety state
- No DB writes, no external telemetry, no live provider calls, no live LLM answers, no live embeddings, and no external RAG were added
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-ANSWER-EVALUATION-1` added provider-free answer evaluation with verified retrieval and source attribution requirements.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-GATE-1` added default-deny runtime gating for public, production, live-provider, and unknown contexts.
- `KNOWLEDGE-WEBSITE-ANSWER-RUNTIME-PILOT-1` added the internal mock-only pilot orchestration path.
- The pilot returned allow / deny state and sanitized output, but it did not yet return a dedicated observability envelope that summarized gate, evaluation, retrieval, attribution, denials, and safety boundaries in one structured object.

## Scope Decision

- Variant A was selected: `pilot_observability_added`.
- The existing internal pilot already had a bounded mock-only path.
- A non-persistent observability envelope could be added inside the pilot result without migrations, new dependencies, DB writes, public routes, provider calls, or deploy behavior.
- No provider approval, customer-data approval, production approval, or go-live claim is implied by this change.

## Observability Model

- Added internal observability contract in `apps/api/src/knowledge-sources/website-answer-runtime-pilot.service.ts`.
- The pilot result now contains:
  - `observabilityVersion`
  - `runId`
  - internal/mock/public/production state
  - runtime context, environment, actor role, answer mode
  - top-level allow / deny decision
  - runtime gate summary
  - answer-evaluation summary
  - retrieval summary
  - source-attribution summary
  - boundary flags
  - denial codes and denial reasons
  - safety flags
  - sanitized warnings
- The observability envelope is returned only through the existing internal mock runtime-pilot result.
- No new endpoint, route, queue, webhook, telemetry sink, or persistence path was added.

## Observability Envelope

- `observabilityVersion = "1"`
- `runId` comes from request or correlation context and is sanitized
- `internalOnly = true`
- `mockOnly = true`
- `publicWidgetEnabled = false`
- `productionEnabled = false`
- `gate` exposes evaluated / allowed / decision / reason / sanitized message / review requirement / missing evidence / warnings
- `answerEvaluation` exposes evaluated / answered / decision / insufficient-evidence / retrieval / attribution / missing evidence / warnings
- `retrieval` exposes verification state, source count, and ready-source usage
- `sourceAttribution` exposes verified status, source ids, and sanitized source metadata
- `boundaries` exposes public-widget, production, provider-live, persistence, side-effect, and external-telemetry blocking
- `denials` exposes active denial state with deduplicated decision codes and reasons
- `safety` exposes hard true flags for no live provider calls, no live LLM answers, no live embeddings, no RAG, no approval grants, no deploy, no telemetry, and no persistence

## Sanitization Rules

- No raw website content in the observability envelope
- No raw retrieved chunks in the observability envelope
- No raw answer text in the observability envelope
- No secrets, API keys, tokens, passwords, cookies, or credentials in the observability envelope
- No userinfo, query strings, or fragments in source URLs inside observability
- No provider raw errors or stack traces in the observability envelope
- Stack-trace-like or raw error strings are normalized to `internal_error_redacted`
- Top-level `answerText` remains on the pilot result only for the allowed internal mock path

## Allowed Internal Mock Pilot Observability

- Allowed state remains limited to `allowed_internal_mock_runtime_pilot`
- Allowed observability requires:
  - internal admin-test runtime context
  - non-production environment
  - admin or operator role
  - `answerMode = mock`
  - successful answer evaluation
  - verified retrieval
  - verified source attribution
  - runtime gate allow decision
- Allowed observability includes:
  - `gate.allowed = true`
  - `answerEvaluation.answered = true`
  - `retrieval.verified = true`
  - `sourceAttribution.verified = true`
  - all safety flags true

## Denial Observability

- Denied states now remain observable without exposing raw content.
- Covered denial families:
  - public widget blocked
  - production/live blocked
  - provider-live blocked
  - unknown context blocked
  - insufficient evidence
  - retrieval not verified
  - source attribution not verified
  - fake source attribution
  - tenant mismatch
  - site mismatch
  - source mismatch
  - runtime pilot error
- Denied pilot results still return:
  - `answerText = null`
  - no provider calls
  - no live LLM answers
  - no live embeddings
  - no RAG

## Runtime Gate Observability

- Runtime gate remains mandatory before any allowed pilot answer is returned.
- Observability records whether the gate was evaluated and whether it allowed the pilot.
- Public widget, production/live, provider-live, and unknown context denials remain visible as blocked states.
- No gate bypass was introduced.

## Answer Evaluation Observability

- Answer evaluation remains mandatory before any pilot answer is returned.
- Observability records:
  - whether evaluation ran
  - whether an answer was accepted
  - which decision code applied
  - whether insufficient evidence was detected
  - whether retrieval and source attribution were verified
- Evaluation denial remains sanitized and side-effect free.

## Retrieval Observability

- Retrieval remains mandatory.
- Observability records:
  - retrieval verified yes/no
  - source count
  - whether a ready indexed source was used
- Raw retrieval payloads are not included.

## Source Attribution Observability

- Source attribution remains mandatory.
- Observability records:
  - verified yes/no
  - source ids
  - sanitized source metadata
- Fake source attribution remains blocked.
- Cross-tenant and cross-source mismatch outcomes remain blocked.

## No Raw Content / No Secret Boundary

- Observability does not expose page bodies, chunks, prompts, headers, cookies, tokens, or passwords.
- Source URLs are reduced to origin plus pathname.
- Warning and reason fields are sanitized before inclusion.
- No credential handling path was added.

## Runtime / Completion Boundary

- `runtime_readiness` is not changed by this task.
- Completion rules are not changed by this task.
- No approval grants are created.
- No ticket, email, or webhook side effects are created.
- No runtime-go-live status is changed.

## Public Widget / Production Boundary

- Public widget answer runtime remains blocked.
- Production answer runtime remains blocked.
- No public route was added.
- No viewer route was added.
- No deploy path was added.
- No enterprise-ready or customer-ready claim was added.
- Guided customer demo remains `still_blocked`.
- Self-service customer demo remains `blocked`.
- Real pilot remains `blocked`.

## No Provider / No Live Answer Boundary

- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No provider approval API
- No provider approval grant
- No deploy
- No public widget activation
- No production activation

## Persistence / Telemetry Boundary

- Observability is returned in-memory as part of the pilot result only.
- No DB persistence was added.
- No queue persistence was added.
- No file persistence was added.
- No external telemetry was added.
- No third-party analytics or error-forwarding path was added.

## Dashboard Impact

- No dashboard code change was required.
- No UI toggle was added.
- No provider-settings UI was added.
- No public-widget, live-provider, or deploy hint was added.

## Tests Added

- Added: `apps/api/test/website-answer-runtime-pilot-observability.test.cjs`
  - allowed internal mock pilot includes observability envelope
  - no raw-content / no-secret leakage in observability
  - public-widget denial observability
  - production/live-provider denial observability
  - insufficient-evidence / retrieval-gap / attribution-gap / fake-source / tenant-mismatch / unknown-context denial observability
  - side-effect-free static boundary checks
- Extended: `apps/api/test/conversation-engine-runtime-pilot.test.cjs`
  - runtime pilot allow path exposes observability envelope
  - runtime pilot deny path exposes observability envelope

## Known Limitations

- The pilot remains internal only.
- The pilot remains mock only.
- The pilot still depends on ready indexed website chunks and explicit mock query embeddings.
- The observability envelope is diagnostic only and not an operator approval.
- No provider usage is approved.
- No customer-facing runtime path is approved.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Remaining Follow-up Fixes

- Operator-readiness review still missing
- No operator-facing readiness summary yet
- No internal runbook for observability interpretation yet
- No customer/demo approval change

## Safety Boundaries

- Observability is internal
- Observability is mock only
- Observability is non-persistent
- No external telemetry
- No customer data
- No production data
- No production secrets
- No live provider calls
- No live LLM answers
- No live embeddings
- No external RAG
- No deploy
- No public widget activation
- No production activation
- No provider approval claim
- No customer-data approval claim
- No production approval claim
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Next Step

- Gate review: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OBSERVABILITY-1-D`
- Follow-up after merge: `KNOWLEDGE-WEBSITE-ANSWER-PILOT-OPERATOR-READINESS-1`
