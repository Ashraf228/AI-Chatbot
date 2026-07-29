# Dashboard Knowledge Sources And Status 1 Report

## Summary

- run_id: `dashboard-knowledge-sources-and-status-1`
- run_type: `dashboard_p1_knowledge_sources_and_status`
- knowledge sources/status clarity improved: yes
- source summary visible: yes
- source status visible: yes
- source persistence boundary visible: yes
- internal test usability visible: yes
- website crawling boundary visible: yes
- fake source attribution prevented: yes
- dashboard code changed: yes
- API code changed: no
- guided customer demo: `still_blocked`
- self-service customer demo: `blocked`
- real pilot: `blocked`

## UI Changes

- added a dedicated save-and-continue status block to the knowledge step
- exposed persisted, ready, processing, failed, and review-gate signals in the summary
- added source-card explanations for:
- status
- persistence
- internal test usability
- completion relevance
- source boundary

## Source Status Model

- `ready` and `indexed` are shown as usable states when the source is active
- `pending` and `processing` remain visible as block reasons
- `failed` and `error` remain visible as block reasons with operator-safe error copy
- inactive sources remain visible but are shown as non-counting for setup completion
- unknown states fall back to `Nicht eindeutig`

## Persistence Boundary

- the UI now states that the visible list reflects persistent product-path sources
- demo, in-memory, and request-local test data are explicitly not counted as setup proof
- `url_metadata` is framed as metadata only
- demo/test/synthetic source types are framed as test-only visibility, not as completion proof

## Testchat Alignment

- the operator can now see whether current sources are usable for the internal testchat
- ready active sources are clearly presented as test-usable
- processing, failed, and inactive sources are clearly presented as not yet usable or not active
- no source is claimed as public-widget-active or production-active

## Website Boundary

- customer-profile website/domain data is explicitly described as metadata only
- individually imported website/url sources are labeled as single imported pages
- the task does not claim or enable automatic website crawling
- website crawling remains a separate follow-up

## No Fake Sources

- no source name, citation, or persistence fact is invented
- fallback copy is used where exact details are not safely derivable
- the task does not fabricate source attribution in the setup flow or internal test path

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- production activation
- customer-data usage
- website crawling
- embeddings / RAG execution

## Regression Coverage

- updated `apps/dashboard/test/CustomerSetupWizard.test.tsx` to cover:
- persistence-boundary visibility in the empty state
- website metadata / no-crawling explanation
- source-card persistence / usability / completion messaging
- mixed ready / processing / failed / inactive states

## Safety Confirmation

- dashboard-only code change
- no API/runtime/widget change
- no migration
- no DB read or write logic
- no package or lockfile change
- no credentials or passwords
- no screenshots or recordings
- no fake source attribution
- no new persistence
- no website crawling

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-CRAWL-INGEST-1`
