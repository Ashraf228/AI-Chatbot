# Summary

`DEMO-WORKSPACE-KNOWLEDGE-UPLOAD-1` adds an admin/operator-only Demo Workspace knowledge upload MVP that keeps synthetic or explicitly approved demo snippets only in browser state. Active snippets are passed to the existing runtime-pilot test chat through `POST /api/sites/:siteId/conversation-engine/runtime-pilot`, which proxies to `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`.

The change does not enable public widget activation, production activation, deploys, customer data handling, persistence, file storage, embeddings, RAG indexing, ticket delivery, email delivery, or webhook delivery.

# Scope

- Demo Workspace only
- Admin/operator test path only
- In-memory text and markdown knowledge snippets only
- Optional `.json` as plain text only
- Existing runtime-pilot contract only
- No API persistence path
- No public widget activation
- No production activation
- No deploy

# Dashboard Knowledge Upload Integration Point

The MVP is implemented inside `apps/dashboard/components/customer/setup-wizard/DemoWorkspaceAgentBuilderCard.tsx`.

The card now provides:

- paste-based snippet entry
- optional snippet title
- browser-only `.txt`, `.md`, `.markdown`, and `.json` plain-text upload
- active snippet list
- single snippet removal
- clear-all action
- runtime-pilot usage display for submitted and used snippets

# Supported Input Types

Supported in this step:

- `.txt`
- `.md`
- `.markdown`
- `.json` as plain text
- direct pasted text

Not supported in this step:

- `.pdf`
- binary document formats
- uploads that require server-side storage
- uploads that require embeddings or RAG indexing

# In-Memory Knowledge Boundary

Knowledge snippets live only in browser state inside the Demo Workspace builder. They are not persisted to a database, not written to file storage, not indexed, and not reused outside the current local browser session.

The runtime-pilot request carries the active snippets as synthetic in-memory request data only. The UI also keeps the transcript in browser state only.

# Runtime Pilot Endpoint Usage

The MVP reuses the existing runtime-pilot flow:

- dashboard proxy: `POST /api/sites/:siteId/conversation-engine/runtime-pilot`
- admin endpoint: `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`

No new runtime activation path was introduced. No production runtime wiring was added.

# Activation Boundary

- Public widget activation: no
- Production activation: no
- Deploy required: no
- Feature flag activation in production: no
- Enterprise approval claim: no

# Side Effects Boundary

- DB writes: no
- SQL: no
- Query runner: no
- Provider calls: no
- Ticket delivery: no
- Email delivery: no
- Webhook delivery: no
- Knowledge persistence: no
- Agent config persistence: no
- Chat history persistence: no

# File / PDF Boundary

Text and markdown files are read locally in the browser and converted into in-memory snippets only.

PDF upload is intentionally deferred in this task because this MVP must not introduce:

- new packages
- new storage
- new provider calls
- new persistence surfaces
- new extraction infrastructure

For this run:

- `pdf_upload_enabled: false`
- `pdf_extraction_deferred: true`

# Known Limitations

- No PDF extraction
- No file persistence
- No snippet versioning
- No publish/go-live path
- No public widget knowledge activation
- No production knowledgebase updates
- No customer data handling
- No production data handling
- No embeddings
- No RAG indexing
- No export/download flow
- No enterprise readiness claim

# Relationship to Testchat

This step builds directly on `DEMO-WORKSPACE-TESTCHAT-1`.

The existing runtime-pilot test chat now receives active in-memory snippets per turn and renders which snippets were submitted and which snippets the runtime pilot reported as used. The chat remains browser-state only and keeps the same no-side-effect boundary as before.

# Recommended Next Step

`DEMO-WORKSPACE-PDF-KNOWLEDGE-UPLOAD-1`

That follow-up should decide whether PDF text extraction can be added safely without introducing persistence, storage, provider calls, embeddings, or production-facing activation.
