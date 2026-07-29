# Knowledge Website Crawl Ingest 2

## Summary

- Audit date: Wednesday, July 29, 2026
- Baseline: `2b5943997ec40febbbaeb769b691d93609e908d4`
- Scope: implement a safe, provider-free single-URL website ingest MVP
- Scope decision: `single_url_ingest_implemented`
- No deploy was executed
- No public widget was activated
- No production activation was approved
- No customer data was used
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`

## Scope Decision

- Variant A was safe to implement.
- The existing provider-free persistence/status foundation from `KNOWLEDGE-INGEST-PERSISTENCE-SCHEMA-1` was sufficient.
- The existing admin/operator-only URL ingest route could be retained.
- No new dependency was required.
- No new migration was required.
- No embedding or provider call was required.

## Security Model

- Only a single public `http` or `https` URL is accepted.
- The ingest stays tenant-bound and site-bound.
- The existing admin/operator permission boundary remains in place.
- No viewer/public ingest route was added.
- No authenticated crawling, JavaScript rendering, browser automation, sitemap crawling, or full-domain crawling was added.

## URL Validation Rules

- Allowed:
  - `http://`
  - `https://`
- Explicitly blocked:
  - invalid URLs
  - non-HTTP schemes
  - URLs with embedded credentials
  - `localhost`
  - single-label internal hostnames
  - `.local`, `.internal`, `.lan`, `.home`, `.corp`
  - `0.0.0.0`
  - `127.0.0.0/8`
  - `::1`
  - `::`
  - RFC1918 private IPv4 ranges
  - `169.254.0.0/16`
  - `169.254.169.254`
  - IPv6 private and link-local ranges
- Host resolution is validated before the fetch and again after redirects.

## SSRF Boundary

- Redirects are manual and capped at 3.
- Every redirect target is revalidated before the next request.
- DNS resolution must succeed for named hosts.
- Direct IP targets are only allowed when the IP is public.
- Policy violations move the source into `blocked` with a sanitized error.

## Fetch Limits

- Single URL only
- No link following beyond redirects
- No domain crawl
- No sitemap crawl
- No PDF crawl
- Timeout: 8 seconds
- Maximum response size: 1 MB
- Maximum extracted text: 50,000 characters
- Allowed content types:
  - `text/html`
  - `text/plain`
  - `application/xhtml+xml`
- No cookies or authorization headers are sent.

## Content Extraction

- HTML is reduced to plain text.
- `script`, `style`, `noscript`, `nav`, `header`, `footer`, and `svg` blocks are removed.
- HTML entities are normalized.
- The extracted text is truncated conservatively before persistence.
- No raw HTML is returned by the API response.

## Persistence / Status Flow

- The source is created with:
  - `ingest_status = fetch_pending`
  - `index_status = not_requested`
  - `runtime_readiness = not_ready`
- Runtime flow:
  - `fetch_pending`
  - `fetching`
  - `fetched`
  - `extracted`
  - `failed`
  - `blocked`
- Extracted website text is persisted provider-free through:
  - `documents`
  - `chunks`
- Persisted website chunks are stored without embeddings.
- Retrieval continues to ignore those chunks because vector search requires non-null embeddings and `runtime_readiness = ready`.

## Runtime Readiness Boundary

- `extracted` is not `ready`.
- `index_status = not_requested` remains not ready.
- `runtime_readiness` is never auto-promoted to `ready` by this task.
- Website import does not make the source answer-ready.
- Completion, retrieval, public widget behavior, and launch readiness remain unchanged.

## Dashboard Flow

- The existing setup flow still imports exactly one website URL at a time.
- The URL panel now states explicitly:
  - only one public page is imported
  - no automatic website/domain crawl happens
  - the imported source is not automatically answer-ready
- Knowledge source cards now show:
  - `Importiert, noch nicht antwortbereit`
  - the explicit ingest/index/runtime triplet
  - the single-page boundary

## Authorization Boundary

- The existing `/admin/ingest/url` route remains admin/operator-only.
- Site scoping remains enforced through the admin scope service.
- The authorization matrix stayed aligned with the current route set.
- No new permission class or public/viewer ingest route was introduced.

## Tests Added

- Added:
  - `apps/api/test/website-ingest.test.cjs`
  - `apps/dashboard/test/KnowledgeSourceCard.test.tsx`
- Updated:
  - `apps/api/test/ingest.service.test.cjs`
  - `apps/api/test/knowledge-source-readiness.test.cjs`
- Revalidated:
  - SSRF guard policy cases
  - redirect-to-private blocking
  - provider-free URL persistence without embeddings
  - extracted-but-not-ready lifecycle handling
  - dashboard clarity for imported website sources

## Known Limitations

- This task does not implement:
  - full-domain crawling
  - sitemap crawling
  - authenticated crawling
  - JavaScript rendering
  - PDF crawling through the website path
  - embedding generation
  - RAG indexing
  - automatic runtime readiness
  - deploy
  - public widget activation
  - customer self-service activation
- Imported website text is persisted for later controlled follow-up work, not for immediate answer generation.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-INGEST-RUNTIME-READINESS-1`
  - decide when indexed/runtime-ready promotion is allowed
  - decide how provider-backed retrieval should be reintroduced
  - keep answer-readiness approval separate from raw extraction

## Safety Boundaries

- Single page only
- No full crawl
- No domain crawl
- No sitemap crawl
- No authenticated crawl
- No JavaScript rendering
- No provider calls
- No embeddings
- No RAG
- No deploy
- No public widget activation
- No production activation
- No customer data
- No production data
- No credentials
- No passwords
- No fake source attribution
- Guided customer demo remains `still_blocked`
- Self-service customer demo remains `blocked`
- Real pilot remains `blocked`
