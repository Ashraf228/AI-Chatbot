# Knowledge Website Crawl Ingest

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `c9311f1096678fd84ec1c64ff9115ead9eeedf15`
- Scope: evaluate whether a safe website knowledge ingest MVP can be implemented without deploy, migration, new dependency, customer data, or provider calls
- Scope decision: `blocked_requires_followup`
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`

## Scope Decision

- A safe SSRF-guarded URL import path already exists in the current codebase.
- The current persisted ingest path for URL sources is coupled to embedding generation and vector chunk writes.
- In the current architecture, a URL source becomes a meaningful `ready` knowledge source only after text ingestion into the existing embedding-backed retrieval path.
- This task explicitly forbids provider calls and does not grant a separate embedding/RAG approval.
- A provider-free fallback that merely marks a source as persisted or `ready` would create a fake completion signal and violate the no-fake-sources boundary.
- Therefore the safe MVP is blocked in this task and must not be implemented as half-wired UI or fake ingest.

## Security Model

- Admin/operator-only remains the target permission model.
- Site-bound and tenant-bound scoping remain mandatory.
- Viewer/public access must remain denied.
- URL validation, SSRF guard, redirect validation, and bounded fetch rules remain mandatory for any future implementation.
- No authenticated crawling, no JavaScript rendering, no form submission, and no external-link following are allowed.

## URL Validation Rules

- Allowed schemes for a future implementation:
  - `http`
  - `https`
- Forbidden inputs remain:
  - non-HTTP schemes such as `file:`, `ftp:`, `data:`, `javascript:`, `mailto:`
  - relative URLs
  - URLs with embedded credentials
  - localhost and private/internal address space
- The existing ingest service already validates public URLs before fetch and again after redirects.

## SSRF Boundary

- Existing code already blocks:
  - `localhost`
  - `0.0.0.0`
  - `127.0.0.1`
  - `::1`
  - RFC1918 private IPv4 ranges
  - `169.254.0.0/16`
  - IPv6 private/local ranges beginning with `fc` / `fd`
- Existing code also re-validates redirect targets and caps redirects.
- SSRF hardening is not the primary blocker for this task.

## Fetch Limits

- Existing fetch path already applies:
  - timeout: 8 seconds
  - redirect limit: 3
  - content-type allowlist: `text/html`, `text/plain`, `application/xhtml+xml`
  - response size limit: 2 MB
- These controls are compatible with a future safe MVP.

## Content Extraction

- Existing HTML extraction strips scripts, styles, nav, footer, header, and tags.
- Output is normalized to plain text.
- No JavaScript browser rendering is used.
- No authenticated/session-based crawling is used.

## Persistence Boundary

- Existing `knowledge_sources` persistence already exists.
- Existing URL ingest also writes into `documents` and `chunks`.
- The current retrieval path depends on embeddings and vector chunks for actual knowledge use.
- Without provider calls, this task cannot safely produce a real, usable website knowledge source in the existing product path.
- Without a separate approved persistence/status model, a fake `ready` state would be misleading.

## Source Status Integration

- Existing completion rules count active `ready` sources.
- Existing site readiness and retrieval paths assume the current persisted path is real backend knowledge, not placeholder metadata.
- Therefore a provider-free fake status transition would be unsafe and out of scope.

## Dashboard UI

- The current setup UI already exposes a URL-based knowledge method.
- A future safe implementation may continue to use that path only after the persistence/status blocker is resolved.
- This task must not add a new UI promise for a capability that cannot be safely completed under the current constraints.

## Authorization Boundary

- Existing admin ingest controller already restricts URL ingest to `admin` and `operator`.
- Existing dashboard proxy still allows customer session admission before backend enforcement.
- That proxy detail should be tightened in a later implementation task, but it is not the main blocker here.

## Tests Added

- No runtime tests were added in this blocked scope.
- The following baseline checks were revalidated:
  - production-context audit
  - authorization matrix
  - security boundaries

## Known Limitations

- No safe MVP implementation is possible in this task without either:
  - provider-call approval for the existing retrieval path, or
  - a separate approved persistence/status design that avoids fake completion and fake usability.
- This task does not implement:
  - website crawling
  - full-domain crawl
  - authenticated crawling
  - JavaScript rendering
  - PDF crawling
  - RAG or embeddings
  - provider calls

## Remaining Follow-up Fixes

- `KNOWLEDGE-INGEST-PERSISTENCE-SCHEMA-1`
  - define a safe persisted status model for website ingest that does not fabricate readiness
  - explicitly decide whether a non-embedded intermediate source state is allowed
  - clarify how completion and internal test usability should behave before embeddings exist
- after that schema task, a follow-up implementation task can reuse the existing SSRF/fetch guard path

## Safety Boundaries

- No deploy
- No public widget activation
- No production activation
- No enterprise approval
- No customer data
- No production data
- No credentials
- No password creation/change
- No DB migration
- No SQL
- No new dependency
- No Query Runner
- No provider calls
- No embeddings / no RAG
- No fake source attribution
- No screenshots or recordings
- Guided customer demo remains `still_blocked`
- Self-service demo remains `blocked`
- Real pilot remains `blocked`
