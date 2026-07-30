# Knowledge Website Crawl Ingest 2 Report

## Summary

- Date: Thursday, July 30, 2026
- Run ID: `knowledge-website-crawl-ingest-2`
- Run type: `knowledge_website_single_url_ingest_safe_mvp`
- Scope decision: `single_url_ingest_implemented`

## Scope Decision

- A safe single-URL website ingest MVP was implemented.
- The implementation stays provider-free and tenant/site-bound.
- The dashboard now makes the single-page boundary and not-ready state explicit.

## Security Model

- Admin/operator-only ingest path retained
- URL validation enforced
- SSRF boundary enforced
- Redirect revalidation enforced
- Content-type allowlist enforced
- Timeout and response-size limits enforced

## SSRF Boundary

- Private/local hosts and private/local resolved IPs are blocked.
- Credentials in URLs are blocked.
- Redirects to private/internal destinations are blocked.
- No authenticated crawling or JavaScript rendering was added.

## DNS Rebinding Protection

- The ingest request path no longer depends on ambient DNS resolution inside global `fetch()`.
- The hostname is resolved first, all returned addresses are validated, and the selected public address is pinned into the actual request.
- Redirect targets are resolved, revalidated, and repinned before the next request is sent.
- HTTPS keeps TLS verification enabled with the original hostname preserved for SNI and certificate checks.
- The fix remains provider-free and does not enable crawling beyond the single requested page.

## Status Flow

- `fetch_pending`
- `fetching`
- `fetched`
- `extracted`
- `failed`
- `blocked`

## Runtime Readiness

- Website extraction persists provider-free text only.
- `runtime_readiness` remains `not_ready`.
- `extracted` does not count as answer-ready.
- No retrieval/runtime activation was added.

## Dashboard Flow

- The setup panel states that only one public page is imported.
- No automatic website/domain crawl is claimed.
- Source cards show imported/extracted/not-ready state explicitly.

## Authorization

- Existing ingest route remains admin/operator-only.
- Site-bound access remains enforced.
- Authorization matrix and security boundary checks stayed green.

## Still Blocked

- Guided customer demo remains `still_blocked`.
- Self-service customer demo remains `blocked`.
- Real pilot remains `blocked`.
- No deploy or public widget activation is part of this task.

## Safety Confirmation

- No deploy
- No public widget activation
- No production activation
- No customer data
- No credentials
- No provider calls
- No embeddings / no RAG
- No full-domain crawling
- No authenticated crawling
- No JavaScript rendering

## Recommended Next Step

- `KNOWLEDGE-WEBSITE-INGEST-RUNTIME-READINESS-1`
