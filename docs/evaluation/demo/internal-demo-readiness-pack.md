# Internal Demo Readiness Pack

## Summary

- Date: Sunday, August 30, 2026
- Scope: internal-only, documentation-only readiness pack for safe internal review
- Scope decision: `internal_demo_readiness_pack_documented`
- This pack documents what can currently be shown internally without implying guided-demo, public-widget, production, provider-live, or customer-data approval.

## Scope Decision

- Selected scope decision: `internal_demo_readiness_pack_documented`
- This pack remains internal, synthetic, and non-executing.
- No runtime, API, dashboard, widget, workflow, script, package, migration, SQL, config, or deploy scope is added.

## Purpose

- Structure internal demo preparation around the current bounded capability set.
- Document safe internal test questions and expected answer states.
- Make current blockers explicit so no approval drift is introduced.
- Provide a compact operator reference for later internal walkthroughs.

## Current Capability Snapshot

- The internal testchat baseline is improved and clearer for internal review.
- Answer and source logic is more conservative than before.
- Denied, blocked, and insufficient-evidence paths do not carry source-looking metadata.
- Denied and failed website-ingest cleanup is hardened so blocked states do not leave reusable indexed leftovers.
- Mock adapter boundaries are hardened so untrusted mock-like adapters are denied.
- Provider calls, live embeddings, RAG, public widget, production, customer data, and production data remain blocked.

## What Can Be Shown Internally

- Internal setup and dashboard review flow at a product-walkthrough level.
- Internal testchat behavior with synthetic questions only.
- An answer with source attribution only when safe test data already provides verified evidence.
- No-source behavior when no verified evidence is available.
- Blocked or denied behavior when runtime or evidence gates are not satisfied.
- Security boundaries that explain why some paths remain intentionally blocked.

## What Must Not Be Shown As Released

- Do not present the public widget as ready.
- Do not present production as ready.
- Do not present a customer demo as authorized.
- Do not present provider-live, live embeddings, or RAG as active.
- Do not present customer data or production data as allowed inputs.
- Do not present this pack as legal, privacy, AVV, final approval, or final authorization evidence.

## Internal Test Flow

1. Stay in internal review context only.
2. Use synthetic questions only.
3. Confirm that any positive source attribution shown is backed by verified evidence already present in safe test data.
4. Observe whether the response falls into supported, no-source, insufficient-evidence, blocked, or fallback behavior.
5. Call out blocked paths explicitly instead of working around them.
6. Stop at internal review. Do not convert the walkthrough into a customer, public, or production claim.

## Suggested Internal Test Questions

- "Welche Informationen liegen in der aktuellen Wissensbasis vor?"
- "Was passiert, wenn keine passende Quelle gefunden wird?"
- "Kannst du eine Antwort mit Quelle geben, falls verifizierte Testdaten vorhanden sind?"
- "Was sagst du, wenn die Wissensbasis keine Antwort enthaelt?"
- "Woran erkennt der Operator, dass der Test nicht produktiv ist?"
- "Welche Grenzen verhindern aktuell eine externe oder produktive Nutzung?"

## Expected Answer States

The following labels are demo-pack terms for internal review. They are not claimed here as a formal API contract.

- `supported_by_verified_source`: a bounded internal answer is supported by verified evidence and may show source attribution.
- `no_source_available`: no verified source is available, so the system should not claim a source.
- `insufficient_evidence`: retrieval or attribution evidence is not sufficient to support a grounded answer.
- `retrieval_blocked_or_denied`: retrieval, runtime, tenant, site, source-scope, or policy gates prevent the answer path.
- `fallback_or_error`: a sanitized fallback or error path is reached without inventing evidence.
- `internal_test_only`: the observed behavior is suitable only for internal review and does not imply public or customer readiness.

## Source Attribution Expectations

- Show sources only when attribution is backed by verified snippets and verified attribution logic.
- Show no source when the path is denied, blocked, or insufficient.
- Do not treat title-only or URL-only context as verified source evidence.
- Do not surface source attribution from failed or denied ingest leftovers.
- Do not invent, infer, or decorate unsupported source attribution.

## No Source / Insufficient Evidence Expectations

- If the system cannot verify support, it must not imply a grounded answer.
- No-source behavior should be explicit and understandable to the internal reviewer.
- Insufficient-evidence behavior should stay conservative and attribution-free.
- The operator should describe this as expected boundary behavior, not as a temporary UI limitation.

## Blocked Retrieval / Denied Gate Expectations

- Retrieval-blocked and gate-denied paths should remain visible during internal review.
- Cross-tenant, cross-site, unsupported-context, provider-live, public-widget, and production paths remain denied.
- The operator should not bypass a denial by reframing it as partial readiness.
- Blocked behavior is part of the readiness evidence because it proves default-deny boundaries remain active.

## Dashboard Testchat Guidance

- Use the dashboard testchat only as an internal review surface.
- Keep prompts generic and synthetic.
- Treat source attribution as optional and evidence-bound, not as guaranteed output.
- If no source is available, explain that the system correctly refuses to claim one.
- If a path is blocked, explain that the block is intentional and still in force.

## Operator Talk Track

- "Das ist ein interner Test, kein Livegang."
- "Hier sieht man, ob eine Antwort durch vorhandenes Wissen gestuetzt ist."
- "Wenn keine Quelle vorhanden ist, behauptet das System keine Quelle."
- "Provider, RAG, Public Widget und Production bleiben bis zur Freigabe blockiert."
- "Das System ist aktuell fuer interne Bewertung vorbereitet, nicht fuer Kundendaten oder Produktivbetrieb zugelassen."

## Known Blockers

- No legal, privacy, or AVV approval.
- No final approval.
- No final authorization.
- No approval grant.
- No authorization grant.
- No valid authorization record.
- No guided-demo authorization.
- No public widget authorization.
- No production authorization.
- No customer-data approval.
- No provider-live approval.
- No real demo access artifacts.

## Safety Boundaries

- Internal only.
- Synthetic review only.
- Documentation only.
- No execution rights follow from this pack.

## No Customer Data Boundary

- Do not use customer records, customer messages, customer files, or customer identifiers.
- Do not use customer contact details or any customer-like fixture that looks real.
- If a scenario would require customer data to be convincing, it is out of scope for this pack.

## No Production Data Boundary

- Do not use production logs, production exports, production reports, or production secrets.
- Do not rely on production state to explain internal test outcomes.
- Do not present internal review evidence as production proof.

## No Provider / No Live Embedding / No RAG Boundary

- No provider calls are part of this pack.
- No live embeddings are part of this pack.
- No RAG activation is part of this pack.
- No external crawling or live retrieval activation is part of this pack.

## No Public Widget / No Production Boundary

- Public widget remains blocked.
- Production remains blocked.
- No deploy, rollout, or customer-facing runtime path is enabled by this pack.
- No enterprise release claim may be derived from this pack.

## Legal / Privacy / AVV Boundary

- This pack is not legal advice.
- This pack is not privacy approval.
- This pack is not AVV or DPA completion evidence.
- Any later external audience proposal would still need separate responsible-party review.

## Final Decision / Authorization Boundary

- This pack does not grant final approval.
- This pack does not grant final authorization.
- This pack does not create an authorization record, approval grant, or authorization grant.
- This pack supports internal review only.

## Internal Review Checklist

- Are the test inputs synthetic: yes/no
- Are customer data and customer-like contacts absent: yes/no
- Are production data and production secrets absent: yes/no
- Are no external access artifacts introduced: yes/no
- Are no provider calls involved: yes/no
- Are no live embeddings involved: yes/no
- Is RAG still inactive: yes/no
- Is source attribution shown only when verified: yes/no
- Is no-source behavior explained correctly: yes/no
- Is blocked or denied behavior explained correctly: yes/no
- Are public-widget and production claims avoided: yes/no

## Follow-up Recommendation

- Next gate task: `INTERNAL-DEMO-READINESS-PACK-1-D`
- Post-merge follow-up: `INTERNAL-DEMO-READINESS-PACK-1-E`
- Post-merge-check follow-up: `INTERNAL-DEMO-SCENARIO-RUNNER-1`
