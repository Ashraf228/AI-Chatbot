# Security Checklist

This checklist documents the current security posture for the AI-Chatbot platform. It is an engineering checklist, not a penetration-test report.

## Tenant And Site Isolation

- Admin/dashboard routes that operate on a `siteId` should call `AdminScopeService.assertSiteAccess`.
- Non-admin roles must carry a tenant context and may only access sites in their tenant.
- Public widget routes are intentionally not protected by dashboard auth; they use `siteKey`, origin validation and rate limits instead.
- Data export/delete routes are site-scoped and must not run tenant-wide deletes.

## Auth And Access Control

- Dashboard backend calls require `DASHBOARD_INTERNAL_TOKEN`.
- Production dashboard login requires password hashes for configured roles.
- Admin-only actions include global settings, user/role management, destructive data deletion and technical debug areas.
- Operator actions are limited to customer/site operations and business monitoring.

## Widget Domain Validation

- Widget POST endpoints validate `siteKey`.
- Widget requests must originate from configured `allowed_domains`.
- `Origin` is preferred; `Referer` is used as a fallback when `Origin` is unavailable.
- Localhost development origins are only allowed outside production.

## Rate Limits

- Widget chat, leads and events are rate-limited by site key, route and client IP.
- API chat has IP, site, tenant and global fixed-window limits.
- Login is rate-limited in the dashboard proxy.
- Expensive admin actions such as URL ingest and integration connection tests have additional per-actor/site limits.

## Secrets Handling

- Integration secrets are encrypted or migrated through `IntegrationSecretsService`.
- API responses never return cleartext integration secrets.
- Audit logs and export metadata redact keys matching token, secret, password, API key, authorization and similar patterns.
- Webhook headers are masked in audit logs.

## Webhook Security

- Integration URLs must use `http` or `https`.
- Localhost/private network targets are blocked unless explicitly enabled for non-production development.
- Webhook jobs use a timeout and do not log secrets.
- Failed integration dispatches are isolated from chat/tool execution.

## Logging And PII

- Conversation message persistence can redact PII for selected paths.
- Technical logs and audit metadata should use PII redaction helpers.
- Original personal data can remain in business tables when required for lead/ticket handling.
- Export/delete operations are audit-logged without storing exported payloads.

## Deployment Security

- Do not expose Postgres or Redis publicly.
- Keep only reverse proxy ports public.
- Enforce strong values for `DASHBOARD_INTERNAL_TOKEN`, `ADMIN_PANEL_PASSWORD_HASH`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `OPENAI_API_KEY` and `INTEGRATION_SECRET_KEY`.
- Keep `.env` untracked; commit only `.env.example` placeholders.

## Backup Notes

- Backups may contain personal data and must follow the same retention/access rules.
- Restore procedures should be tested before production launch.
- If a deletion request must also affect backups, define the operational process with the customer.
