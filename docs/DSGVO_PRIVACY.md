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
