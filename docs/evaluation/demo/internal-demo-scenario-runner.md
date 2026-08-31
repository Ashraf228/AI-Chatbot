# Internal Demo Scenario Runner

## Summary

- Date: Monday, August 31, 2026
- Scope: internal-only, synthetic-only scenario catalog for controlled internal demo review
- Scope decision: `internal_demo_scenario_runner_documented`
- This document defines a bounded internal scenario runner as documentation only and does not add runtime, API, dashboard, widget, workflow, script, package, migration, SQL, config, or deploy scope.

## Scope Decision

- Selected scope decision: `internal_demo_scenario_runner_documented`
- The repository already contains internal evaluation and runtime-gate tests, but no existing internal demo scenario runner that should be expanded here without widening scope.
- A documented scenario catalog is therefore the safest implementation for this task.
- A later design task may still define a more explicit executable runner if that becomes necessary.

## Purpose

- Make internal demo preparation reproducible.
- Document safe synthetic test cases and expected result states.
- Keep source, no-source, denied, blocked, and fallback boundaries explicit.
- Give operators a bounded review checklist for internal walkthroughs.

## Relationship to Internal Demo Readiness Pack

- The readiness pack established what can be shown internally and which boundaries remain blocked.
- This scenario runner builds on that baseline by turning the same bounded capability set into a repeatable review catalog.
- It does not replace the readiness pack or any later authorization gate.

## Scenario Runner Boundary

- This runner is a documented internal scenario catalog.
- It does not execute a real customer demo.
- It does not create external access artifacts.
- It does not create identities, auth material, or delivery artifacts.
- It does not activate provider calls, live embeddings, retrieval for public runtime, or RAG.
- It does not change public widget or production behavior.

## Synthetic Data Boundary

- All scenarios are synthetic-only.
- No real customer names, websites, contacts, or business records are used.
- No production records, exports, logs, or secrets are used.
- If a scenario would require real data or a real website to be convincing, that scenario is out of scope here.

## Scenario List

1. Internal Test Only
2. Verified Source Available
3. No Source Available
4. Insufficient Evidence
5. Denied / Blocked Runtime Gate
6. Failed / Denied Ingest Leftover Protection
7. Safe Mock Adapter Boundary
8. Operator Talk Track

## Scenario 1: Internal Test Only

- Goal: the operator recognizes the path as internal review only.
- Inputs: synthetic internal test prompt only.
- Expected behavior:
  - no live claim
  - no public widget claim
  - no production claim
  - no customer-data usage
- Failure condition:
  - any wording that implies external readiness or customer-safe execution

## Scenario 2: Verified Source Available

- Goal: source attribution appears only when verified evidence is already present in safe test data.
- Inputs: synthetic question with pre-verified internal evidence.
- Expected behavior:
  - source appears only with verified attribution inputs
  - no source inferred from title-only context
  - no source inferred from location-only context
- Failure condition:
  - any source display without verified evidence

## Scenario 3: No Source Available

- Goal: no source is shown when no verified evidence exists.
- Inputs: synthetic question with no verified snippets or attribution basis.
- Expected behavior:
  - no source summary
  - no knowledge-backed claim
  - conservative answer state
- Failure condition:
  - fabricated source, unsupported grounding claim, or implicit evidence claim

## Scenario 4: Insufficient Evidence

- Goal: partial or weak evidence does not become attribution.
- Inputs: synthetic question with incomplete evidence or non-verifiable context.
- Expected behavior:
  - source fields remain empty or null in the bounded result model
  - no overconfident wording
  - no implied verification
- Failure condition:
  - unsupported source or confidence claim

## Scenario 5: Denied / Blocked Runtime Gate

- Goal: blocked paths stay visible as blocked and are not reframed as success.
- Inputs: synthetic path that falls outside runtime or policy allowance.
- Expected behavior:
  - no source
  - no ready claim
  - clear blocked explanation
- Failure condition:
  - blocked path presented as partial success or silent fallback to a grounded claim

## Scenario 6: Failed / Denied Ingest Leftover Protection

- Goal: failed or denied ingest leftovers do not create attribution-looking output.
- Inputs: synthetic state representing denied or failed ingest history.
- Expected behavior:
  - no source carried forward
  - no ready transition inferred from leftovers
  - no reusable indexed state treated as valid evidence
- Failure condition:
  - stale ingest residue appears as usable verified evidence

## Scenario 7: Safe Mock Adapter Boundary

- Goal: only safe mock behavior is acceptable for internal review.
- Inputs: synthetic mock-style adapter path.
- Expected behavior:
  - unsafe plain mock path rejected
  - no untrusted adapter behavior treated as live capability
  - safe mock use remains internal only
- Failure condition:
  - mock-like behavior bypasses policy or resembles live provider behavior

## Scenario 8: Operator Talk Track

- Goal: the operator can explain the bounded state correctly.
- Expected behavior:
  - describe the flow as an internal test
  - explain that source appears only with verified evidence
  - explain that provider, RAG, public widget, and production remain blocked
  - avoid claims of external readiness
- Failure condition:
  - operator wording suggests approval, rollout, or customer-safe activation

## Expected Result States

- `internal_test_only`: internal review context only
- `supported_by_verified_source`: bounded answer supported by verified evidence
- `no_source_available`: no verified source available
- `insufficient_evidence`: evidence exists but does not justify attribution
- `retrieval_blocked_or_denied`: runtime, scope, or policy gate prevents the path
- `fallback_or_error`: sanitized fallback state without fabricated evidence

## Source Attribution Expectations

- Attribution is allowed only when verified evidence exists.
- No source may appear for denied, blocked, failed-ingest, or insufficient-evidence paths.
- No fake attribution, inferred attribution, or leftover attribution is acceptable.

## No Source / Insufficient Evidence Expectations

- If the system cannot verify support, it must not imply grounded knowledge.
- No-source behavior is expected and correct in bounded internal review.
- Insufficient-evidence behavior must stay conservative and attribution-free.

## Blocked / Denied Expectations

- Blocked and denied states are expected evidence of working default-deny boundaries.
- Those states must stay visible to the operator.
- They must not be reframed as almost-ready or partially launched.

## Operator Review Checklist

- Is the scenario clearly internal-only: yes/no
- Is the scenario synthetic-only: yes/no
- Are customer-like records absent: yes/no
- Are production records absent: yes/no
- Is source shown only when verified: yes/no
- Is no-source behavior conservative: yes/no
- Is insufficient-evidence behavior attribution-free: yes/no
- Are blocked and denied states explained accurately: yes/no
- Are provider, RAG, public widget, and production still blocked: yes/no
- Are no external access artifacts introduced: yes/no

## No Customer Data Boundary

- No customer records, transcripts, contacts, uploads, or identifiers belong in this runner.
- No customer-like placeholders should be added when they resemble real-world contact or identity data.
- Customer-safe execution is not inferred from this catalog.

## No Production Data Boundary

- No production logs, metrics, exports, or secrets are part of this runner.
- No production proof or production readiness is established here.
- Production state is intentionally out of scope.

## No Provider / No Live Embedding / No RAG Boundary

- No provider calls are part of this runner.
- No live embeddings are part of this runner.
- No RAG activation is part of this runner.
- No public-runtime retrieval path is enabled by this runner.

## No Public Widget / No Production Boundary

- Public widget remains blocked.
- Production remains blocked.
- No rollout, deploy, or customer-facing activation follows from this runner.

## Legal / Privacy / AVV Boundary

- This runner is not legal approval.
- This runner is not privacy approval.
- This runner is not AVV or DPA completion evidence.
- Any later external usage proposal still needs separate responsible-party review.

## Final Decision / Authorization Boundary

- This runner does not grant final approval.
- This runner does not grant final authorization.
- This runner does not create approval or authorization artifacts.
- It supports internal review only.

## Follow-up Recommendation

- Next gate task: `INTERNAL-DEMO-SCENARIO-RUNNER-1-D`
- Follow-up after merge: `INTERNAL-DEMO-SCENARIO-RUNNER-1-E`
- Follow-up after post-merge check: `INTERNAL-DEMO-OPERATOR-WALKTHROUGH-1`
