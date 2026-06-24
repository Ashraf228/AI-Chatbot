# Ticket Webhook Configuration

This document describes the generic `ticket.created` forwarding for the IT support agent. It is an operational guide and not a customer-specific integration contract.

## Purpose

The IT support agent can create structured tickets from a chat. If a site has an active ticket webhook, every `ticket.created` event is queued for delivery to the configured endpoint.

Typical targets:

- n8n webhook URL
- Make webhook URL
- A custom backend endpoint
- A later ticket-system bridge

Jira, Zendesk, Freshdesk, TANSS and similar systems are intentionally not implemented as special integrations here. They can be added later as dedicated providers.

## Dashboard Setup

Open the site in the dashboard and go to `Verbindungen`.

Use the `Ticket-Weiterleitung` card to configure:

- `Aktiv` / `Inaktiv`
- Webhook URL
- HMAC Signing Secret
- Test webhook

The Signing Secret is stored through the existing integration secret mechanism and is never returned by the API in clear text.

New generic webhook connections use `hmac_sha256` by default. In that mode the payload is signed and the secret is not transmitted with the request. Existing configurations that previously used the `x-webhook-secret` header remain explicitly marked as `legacy_secret_header` for backward compatibility. They are not migrated automatically.

The HMAC header contract is documented in `docs/security/WEBHOOK_HMAC_SIGNATURES.md`.

## Backend Endpoints

The dashboard proxy calls these API endpoints:

- `GET /admin/sites/:siteId/integrations/ticket-webhook`
- `PUT /admin/sites/:siteId/integrations/ticket-webhook`
- `POST /admin/sites/:siteId/integrations/ticket-webhook/test`
- `DELETE /admin/sites/:siteId/integrations/ticket-webhook`

The endpoints are site-scoped and use the existing dashboard/admin guard and site-scope checks.

## Test Webhook

The test endpoint queues a harmless `ticket.created` payload. It does not use live customer data.

Example payload body inside the integration event:

```json
{
  "event": "ticket.created",
  "test": true,
  "ticketId": "test-ticket",
  "subject": "Test IT-Support-Ticket",
  "description": "Dies ist ein Test-Webhook.",
  "category": "it_support",
  "priority": "normal",
  "customerEmail": "test@example.com",
  "reporter": {
    "email": "test@example.com"
  },
  "technicalContext": {
    "device": "Testgeraet"
  }
}
```

## Forwarding Status

`create_ticket` keeps ticket creation separate from external forwarding.

- `queued`: an active `ticket.created` integration was found and a `webhook_jobs` entry was queued.
- `not_configured`: no active ticket webhook is configured for the site.
- `failed`: ticket creation succeeded, but integration dispatch failed.
- `unknown`: reserved fallback status for unexpected states.

The bot must not claim that a ticket was forwarded when forwarding is `not_configured` or `failed`.

## Security Notes

- HTTPS endpoints are recommended.
- Private/internal URLs are blocked by the existing SSRF guard unless local development explicitly allows them.
- Secrets are not included in webhook payloads.
- Secrets are not returned by GET responses.
- New generic webhook connections use HMAC-SHA256 by default.
- Existing `legacy_secret_header` connections may continue to send `x-webhook-secret` until they are migrated deliberately.
- Migration to HMAC-SHA256 requires receiver-side signature verification, an HMAC secret, and a conscious configuration change by the Platform Owner.
- Test the receiver signature verification before switching a legacy receiver to HMAC-SHA256.
- Do not send passwords, MFA codes, API keys or payment details through tickets.
- Webhook jobs keep historical delivery records; deleting the configuration does not delete previous jobs.

## Legacy Review

The current review target for `legacy_secret_header` connections is `2026-07-24`. This is a review date, not an announced shutdown date. Do not invent a cutoff date until the operational migration plan is approved.

## Operational Limits

- No existing site receives a webhook automatically.
- No seed or startup task creates webhook configurations.
- Test webhooks are only sent after explicit dashboard/API action.
- Provider-specific ticket-system integrations remain separate future work.
