# Knowledge Website Embedding Ingest 2

## Summary

- Audit date: Saturday, August 1, 2026
- Baseline: `02c3b83849baadd07403255e4ee2d643c7d6371b`
- Scope: evaluate whether a gated website embedding ingest can be added safely behind provider gate plus provider approval policy with mock-only execution constraints
- Scope decision: `blocked_requires_approval_storage_design`
- No live provider call was added
- No live embedding generation was added
- No customer data was used
- No production data was used
- No deploy was executed
- No public widget was activated
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Previous State

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-2` persists single-page website text provider-free into `documents` and `chunks`.
- `KNOWLEDGE-WEBSITE-INGEST-RUNTIME-READINESS-1` keeps imported website sources at:
  - `ingest_status = extracted`
  - `index_status = pending`
  - `runtime_readiness = not_ready`
- `KNOWLEDGE-PROVIDER-EMBEDDING-GATE-1` introduced a hard default-deny gate in front of any later provider-backed website runtime indexing.
- `KNOWLEDGE-PROVIDER-APPROVAL-POLICY-1` added a technical approval contract, but only as an explicit runtime object passed into the gate.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-1` remained blocked and did not add an execution path.

## Scope Decision

- Variant A was rejected.
  - A real execution path would have to expose a callable embedding adapter boundary.
  - With the current contract, that boundary would still depend on an ad hoc explicit approval payload rather than a persisted approval record with revocation and audit lifecycle.
  - A live-capable execution surface would therefore be too easy to mis-wire against a real provider later without a stronger approval-storage model.
- Variant B was also rejected.
  - A gate-only ingest surface with mock adapter execution still needs a trustworthy distinction between test-only approvals and future live approvals.
  - That distinction is not encoded durably in the current repository state.
- Variant C was rejected.
  - Existing schema already supports provider-free chunk persistence for website sources.
  - No migration is required to store website text chunks themselves.
- Variant D is the correct outcome.
  - The repository has a technical approval contract, but not yet a persisted approval storage / revocation / workflow design that can safely back an executable website embedding ingest path.

## Provider Gate Enforcement

- The provider gate remains mandatory before any later website embedding work.
- Default deny remains mandatory.
- Unknown usage context remains denied.
- Tenant/site mismatch remains denied.
- Unsupported source type remains denied.
- Missing policy remains denied.
- Missing grant remains denied.
- No provider call is possible through the currently implemented gate-only boundary.

## Approval Policy Enforcement

- The approval policy contract remains required for any future website embedding path.
- The current contract validates:
  - tenant id
  - site id
  - optional source id
  - source type
  - usage context
  - provider
  - model
  - customer-data approval
  - provider DPA approval
  - production approval for production context
  - retention, logging, redaction, deletion, rate, and cost fields
- What is still missing for a safe executable ingest path:
  - persisted approval records
  - explicit approval state transitions
  - revocation lookup independent of caller-supplied payloads
  - durable audit trail for later execution
  - a formal distinction between mock-only technical validation and any future live-capable execution

## Embedding Ingest Model

- No website embedding ingest execution path was added in this task.
- No embedding persistence path was added in this task.
- No retrieval-attested ready transition was added in this task.
- No runtime surface was widened.

## Mock Embedding Adapter

- A mock embedding adapter was intentionally not wired into production code.
- The remaining blocker is not the ability to fabricate deterministic test embeddings.
- The blocker is the lack of a durable approval-storage model that can safely separate:
  - synthetic approval validation in tests
  - future live-capable execution paths
- Until that separation exists, adding an executable adapter boundary would be misleadingly close to a live path.

## Default Deny Behavior

- Without valid policy: blocked.
- Without valid grant: blocked.
- Without tenant/site scope: blocked.
- Without explicit future approval storage design: executable ingest remains blocked.
- `runtime_readiness = ready` remains impossible in this task.

## Website Source Preconditions

Any future executable website embedding ingest still requires all of the following:

- tenant-bound source
- site-bound source
- `sourceType = url`
- source remains active
- `ingest_status = extracted`
- extracted text exists and is non-empty
- `runtime_readiness = not_ready`
- `index_status = pending` or `not_requested`
- provider gate allow
- provider approval policy allow
- explicit proof that the execution surface cannot silently fall back to a live provider path

## Runtime Readiness Preconditions

`runtime_readiness = ready` remains reserved for the fully proven case only:

- gate allow
- approval policy allow
- successful indexing/materialization
- retrieval verification
- source-attribution verification
- completion-rule verification

None of those conditions were newly satisfied here.

## Retrieval / Source Attribution

- Retrieval verification with mock embeddings was not added.
- Source-attribution verification with mock embeddings was not added.
- Fake source attribution remains forbidden.
- Cross-tenant retrieval remains forbidden.
- Because retrieval/source attribution are still unproven, `ready` remains blocked.

## Completion Rules

- `extracted` does not count as ready.
- `index_pending` does not count as ready.
- `blocked` does not count as ready.
- `failed` does not count as ready.
- Only `runtime_readiness = ready` counts as completion-ready.
- No existing ready source semantics were widened.

## Tenant / Site Boundary

- Tenant/site scoping remains unchanged.
- No new endpoint was added.
- No authorization-matrix widening was introduced.
- Viewer/public access was not expanded.

## Dashboard Impact

- No dashboard code change was required.
- No provider settings UI was added.
- No provider approval toggle was added.
- No UI claim about automatic website answer-readiness was added.

## Provider / Data / Privacy Boundary

- No live provider calls
- No live embeddings
- No customer data
- No production data
- No provider approval claim
- No customer-data approval claim
- No production approval claim
- Synthetic technical validation remains different from any future real approval

## Tests Added

- No new runtime tests were added because no executable ingest surface was introduced.
- Existing green evidence used for this decision:
  - provider gate tests remain green
  - approval policy tests remain green
  - production-context audit remains green
  - authorization matrix remains green
  - security boundaries remain green

## Known Limitations

- There is still no executable website embedding ingest path.
- There is still no persisted approval storage model for such a path.
- There is still no revocation-backed approval lookup for later execution.
- There is still no retrieval/source-attribution attestation for website embeddings.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-DESIGN-1`
  - define persisted approval record shape
  - define revocation / expiry lookup model
  - define audit evidence linkage for later execution
  - define how mock-only validation is kept separate from any future live-capable ingest path

## Safety Boundaries

- No live provider calls
- No live embeddings
- No customer data
- No production data
- No provider approval claim
- No customer-data approval claim
- No production approval claim
- No deploy
- No public widget
- No runtime-ready auto transition
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
