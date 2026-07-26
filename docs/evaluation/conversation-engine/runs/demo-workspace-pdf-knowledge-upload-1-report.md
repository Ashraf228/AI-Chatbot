# Demo Workspace PDF Knowledge Upload 1

## Summary
Adds an admin/operator-only in-memory PDF knowledge upload MVP to the Demo Workspace builder.

## Scope
- Admin/operator demo workspace only.
- Only synthetic or explicitly approved demo PDFs.
- No customer data.
- No production data.
- No deploy.

## PDF Extraction Path
- Dashboard route: `POST /api/sites/:siteId/conversation-engine/knowledge/pdf-extract`
- Existing extractor: `pdf-parse`
- Processing model: request-memory only with `Cache-Control: no-store`

## Supported Input Types
- Paste
- `.txt`
- `.md`
- `.markdown`
- `.json`
- `.pdf` up to 5 MB

## In-Memory PDF Boundary
- PDF file is parsed only in request memory.
- Extracted text becomes an in-memory knowledge snippet in browser state.
- PDF file is not persisted.
- Extracted text is not persisted.
- No disk storage.

## Runtime Pilot Endpoint Usage
- Runtime pilot stays on `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`
- Dashboard proxy stays on `POST /api/sites/:siteId/conversation-engine/runtime-pilot`
- Knowledge snippets continue to be forwarded only for the admin demo test path.

## Activation Boundary
- No public widget activation.
- No production activation.
- No deploy.
- No feature-flag activation.

## Side Effects Boundary
- No DB writes.
- No SQL.
- No query runner.
- No provider calls.
- No tickets, emails, or webhooks.

## File Storage / Persistence Boundary
- No file storage.
- No knowledge persistence.
- No embeddings.
- No RAG indexing.

## OCR Boundary
- No OCR.
- Image-only PDFs remain unsupported in this MVP.

## Known Limitations
- Only admin/operator dashboard sessions are allowed.
- Only site-bound demo uploads are allowed.
- The runtime pilot still uses short in-memory snippet excerpts.
- PDFs without extractable text are rejected.

## Relationship to Knowledge Upload
- Extends `DEMO-WORKSPACE-KNOWLEDGE-UPLOAD-1`
- Reuses the existing in-memory snippet model.
- Adds a guarded PDF extraction path without touching the production knowledge base.

## Recommended Next Step
- `DEMO-WORKSPACE-KNOWLEDGE-PERSISTENCE-1`
- or `DEMO-WORKSPACE-CONFIG-PERSISTENCE-1`
- or `CONV-ENGINE-SYNTHETIC-EVAL-FIX-2`
