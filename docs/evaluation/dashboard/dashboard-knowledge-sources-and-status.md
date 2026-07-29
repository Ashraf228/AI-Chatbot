# Dashboard Knowledge Sources And Status

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `a38edaba81fda7447880554bc9302e86119ddefb`
- Scope: improve knowledge-source transparency inside the dashboard setup flow
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Problem

- the operator could see that knowledge affected setup completion, but not clearly why
- source-level readiness, processing, failure, and inactive states were not explicit enough
- persistence boundaries were implicit instead of operator-visible
- the setup flow risked suggesting website crawling where only metadata existed
- the internal testchat depended on knowledge readiness, but the source-to-test relationship was not explicit enough

## UI Changes

- the knowledge step now exposes a dedicated save-and-continue status area
- the summary now shows:
- persisted source count
- active ready count
- processing count
- failed count
- explicit review-gate state
- each source card now shows:
- readable status
- persistence hint
- internal test usability
- setup-completion relevance
- source-boundary hint

## Source Status Model

- `ready` / `indexed`: source is treated as usable for the internal test and can count for setup completion when active
- `pending` / `processing`: source remains visible but blocks `Speichern & weiter`
- `failed` / `error`: source remains visible with an operator-safe error message and blocks `Speichern & weiter`
- `disabled` or inactive: source remains visible but does not count for setup completion
- unknown status: UI falls back to `Nicht eindeutig` instead of inventing behavior

## Persistence Boundary

- the summary now states that the list reflects persistent sources from the existing product path
- demo, in-memory, and request-local test data are explicitly excluded from completion proof
- `url_metadata` is treated as metadata only, not as a stored knowledge source
- demo/test/synthetic source types are treated as test-only visibility, not as product-path completion proof

## Testchat Alignment

- the knowledge step now states whether internal testing is currently possible
- active ready sources are framed as usable for the internal testchat
- processing and failed sources are framed as not yet usable
- inactive ready sources are framed as stored but not currently active
- no source state is presented as public-widget-ready or production-active

## Website Boundary

- customer-profile website/domain data is explicitly framed as metadata only
- source cards for website/url imports state that they represent individually imported pages
- the UI does not claim automatic website crawling
- the task does not add crawling, ingestion automation, embeddings, or RAG execution

## No Fake Sources

- the task does not invent source names, citations, or persistence states
- if a detail cannot be derived from the current source state, the UI falls back to a safe explanation
- no fake source attribution was added to the internal testchat or setup summary

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- production activation
- customer-data usage
- website crawling
- RAG / embedding execution

## Regression Coverage

- updated `apps/dashboard/test/CustomerSetupWizard.test.tsx` to cover:
- knowledge-step persistence boundary
- website metadata / no-crawling boundary
- source-card persistence and completion messaging
- mixed ready / processing / failed / inactive source states

## Safety Confirmation

- dashboard-only code change
- no API/runtime/widget change
- no migration
- no DB read or write logic
- no package or lockfile change
- no credentials or passwords
- no screenshots or recordings
- no fake sources
- no new persistence
- no website crawling

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-1`
