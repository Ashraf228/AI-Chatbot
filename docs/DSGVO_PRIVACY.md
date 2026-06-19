# DSGVO / Privacy Notes

This document summarizes the technical privacy handling in the AI-Chatbot platform. It is not legal advice.

## Stored Data

- Site/customer metadata: company name, domains, widget configuration and setup settings.
- Conversations: widget sessions, conversation records and messages.
- Leads/requests: name, email, phone, message, status and timestamp.
- Agent actions: contact requests, tickets, tool invocations and agent runs.
- Knowledge sources: source metadata, documents and chunks.
- Integrations: provider type, configuration metadata and encrypted/masked secrets.
- Reports and audit logs: report metadata, delivery history and administrative actions.

## Purpose

- Operate the customer chat widget.
- Answer questions using customer-provided knowledge.
- Capture leads, tickets and contact requests.
- Dispatch configured integrations.
- Provide business analytics, reports and operational auditability.

## Public Widget Consent And Session Lifecycle

This section describes the technical implementation. It is not legal advice and does not make a compliance guarantee.

When a site configuration has `consentRequired=true`, the public widget reads only the dedicated consent flag before consent. If no valid stored consent exists, the widget does not read, create or persist visitor/session identifiers, does not call `/widget/session`, does not send server-side analytics events and does not send chat messages. Known legacy widget identifier keys for the same site (`ssb_visitor_<siteId>` and `ssb_session_<siteId>`) are removed without using their values. Storage keys from other applications or other sites are not touched.

Pre-consent analytics such as `impression`, `open`, `close` or `lead_modal_opened` are intentionally not buffered and are not replayed after consent. This creates a deliberate measurement boundary: analytics starts only after consent and a valid server session exist.

After the visitor clicks "Einverstanden", the widget stores the consent flag first, removes legacy widget identifiers for that site if needed, creates or reuses exactly one server session via the idempotent session initializer, and only then sends `consent_accepted` with the resulting session ID. Further analytics events are best effort and require a valid session.

When `consentRequired=false`, the widget initializes or reuses a server session during bootstrap as before. Chat and analytics remain best effort; analytics failures must not block chat usage.

For session initialization after consent, the widget sends `sourceUrl` only as origin plus pathname. Query strings, URL fragments and URL credentials are stripped. `userAgent` is sent only after consent or when consent is not required.

## Retention Settings

Default technical retention targets:

- Conversations: 90 days.
- Leads: 365 days.
- Audit logs: 180 days target for policy; operational retention depends on cleanup configuration.
- Full messages: stored by default unless a customer-specific policy disables or redacts them.

Retention settings are stored in site configuration and can be surfaced in the dashboard per customer.

## Export

Site-scoped privacy export endpoint:

- `GET /admin/sites/:siteId/privacy/export`

The export includes site-related conversations, leads, tickets/contact requests and knowledge source metadata. Integration secrets are excluded or redacted.

## Deletion / Anonymization

Site-scoped privacy deletion endpoint:

- `POST /admin/sites/:siteId/privacy/delete-data`

Supported payload:

```json
{
  "deleteConversations": true,
  "deleteLeads": true,
  "deleteTickets": true,
  "deleteKnowledge": false,
  "anonymizeInstead": true,
  "confirm": true
}
```

Deletion/anonymization is site-scoped and returns affected row counts. Audit logs are retained as evidence and are not automatically deleted by this endpoint.

## Roles

- Platform operator: operates the SaaS and technical infrastructure.
- Customer/site owner: determines the customer-specific purpose and retention policy for their widget data.
- Admin: can export/delete/anonymize site data.
- Operator: can export and operate sites but cannot run destructive deletion actions.

## Important Boundaries

- This file describes product behavior only.
- A data processing agreement, privacy policy and customer-specific legal review are still required before production sales.
- Backup retention and deletion from backups must be handled as an operational process.
