# Dashboard Knowledge Sources and Status

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

## Previous Problem

- the operator could see that knowledge affected setup completion, but not clearly why
- source-level readiness, processing, failure, and inactive states were not explicit enough
- persistence boundaries were implicit instead of operator-visible
- the setup flow risked suggesting website crawling where only metadata existed
- the internal testchat depended on knowledge readiness, but the source-to-test relationship was not explicit enough
- this task is a status/transparency fix, not a new knowledge runtime feature

## Source Status Model

- `ready` / `indexed`: source is treated as usable for the internal test and can count for setup completion when active
- `pending` / `processing`: source remains visible but blocks `Speichern & weiter`
- `failed` / `error`: source remains visible with an operator-safe error message and blocks `Speichern & weiter`
- `disabled` or inactive: source remains visible but does not count for setup completion
- unknown status: UI falls back to `Nicht eindeutig` instead of inventing behavior

## Source Type Model

- `Text`: manually entered knowledge content
- `PDF`: imported PDF source where only the existing source state is described
- `Dokument`: imported document source where only the existing source state is described
- `Demo-/Testwissen`: test-only source type that must not be confused with backend completion proof
- `Website-/Domain-Metadatum`: customer-profile website/domain metadata, not an automatically crawled source
- `Nicht eindeutig`: conservative fallback when the source type cannot be derived safely
- a website/domain in the customer profile is not automatically a knowledge source
- no website crawling is implemented or claimed in this task

## Persistence Model

- the summary now states that the list reflects persistent sources from the existing product path
- demo, in-memory, and request-local test data are explicitly excluded from completion proof
- `url_metadata` is treated as metadata only, not as a stored knowledge source
- demo/test/synthetic source types are treated as test-only visibility, not as product-path completion proof
- no new knowledge persistence is introduced
- no new PDF-content persistence is introduced
- no chat-history persistence is introduced

## Completion Rules

- only active ready/indexed sources count toward the relevant setup/knowledge readiness state
- `processing` does not count as ready
- `failed` / `error` does not count as ready
- `inactive` / `disabled` does not count as ready
- `unknown` remains conservative and does not count as ready
- in-memory/demo/test-only visibility does not count as backend completion when it is not backed by existing backend/product-path state
- no UI-only completion claim is introduced
- the knowledge step exposes a dedicated save-and-continue status area with:
- persisted source count
- active ready count
- processing count
- failed count
- explicit review-gate state

## Testchat Alignment

- the knowledge step now states whether internal testing is currently possible
- active ready sources are framed as usable for the internal testchat
- processing and failed sources are framed as not yet usable
- inactive ready sources are framed as stored but not currently active
- no source state is presented as public-widget-ready or production-active

## Website / Crawling Boundary

- customer-profile website/domain data is explicitly framed as metadata only
- source cards for website/url imports state that they represent individually imported pages
- the UI does not claim automatic website crawling
- the task does not add crawling, ingestion automation, embeddings, or RAG execution

## No Fake Sources Rule

- the task does not invent source names, citations, or persistence states
- if a detail cannot be derived from the current source state, the UI falls back to a safe explanation
- no fake source attribution was added to the internal testchat or setup summary

## Tests Added

- updated `apps/dashboard/test/CustomerSetupWizard.test.tsx` to cover:
- empty-state boundary text
- knowledge-step persistence boundary
- website metadata / no-crawling boundary
- source-card persistence and completion messaging
- mixed ready / processing / failed / inactive source states
- testchat usability messaging
- no fake sources / no fake source-attribution claims
- no deploy/public-widget claims in this scope

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-1` remains the next task if website ingestion is desired later
- `CONV-KNOWLEDGE-SOURCE-STATUS-SCHEMA-1` remains an optional follow-up if a stricter shared source-status schema becomes necessary
- crawling is explicitly not part of this task
- no new runtime, persistence, or provider-calling behavior is introduced here

## Safety Boundaries

- dashboard-only code change
- no API/runtime/widget change
- no migration
- no DB read or write logic
- no package or lockfile change
- no credentials or passwords
- no screenshots or recordings
- no fake sources
- no new persistence
- no PDF-content persistence
- no chat-history persistence
- no website crawling
- no embeddings / no RAG execution
- no provider calls
- no tickets / emails / webhooks
- no deploy
- no public widget activation
- no production activation
- no enterprise approval
- no customer data
- no production data
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-1`
