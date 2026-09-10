# Site-runtime grant operator authentication contract

## Status and boundary

This document defines the implemented internal API and Dashboard BFF transport for site-runtime
grant preview, creation, status, and revocation. The transport is registered in the API and reuses
the existing operator-auth, write, audit, and runtime-contract services; it does not duplicate their
business rules.

No UI or CLI invokes these routes. This transport change does not provision users or capabilities,
apply Migration 032, create a grant, deploy a service, or activate provider, public-widget,
production, or Enterprise behavior.

## Identity chain

The accepted principal is an individually authenticated `tenant_users` row. The Dashboard BFF
forwards both:

- the unchanged signed `ssb_admin` tenant-user session token as `Authorization: Bearer <token>`; and
- the dedicated server-side Dashboard credential as `X-DASHBOARD-TOKEN`.

The API verifies the existing two-part base64url payload/signature format with HMAC-SHA256 and
`ADMIN_SESSION_SECRET`. It accepts only a current `customer` session with a stable `tenantUserId`,
tenant, normalized email, matching subject, issued/expiry timestamps, session identifier, and an
expiry no longer than the existing eight-hour session lifetime. The static `dashboard-operator`
principal, `ADMIN_KEY`, actor headers, role headers, unsigned claims, missing secrets, and expired
tokens are rejected.

The API then reloads the persisted principal for every authorization attempt. It checks identity
claim consistency, active state, account expiry, a non-viewer tenant role, the repository's internal
tenant identifiers (`t_default` or `t-default`), and an `internal` tenant subscription. Requiring the
identifier and subscription together is intentional: the billing service also uses subscription
status `internal` for Enterprise plans, so that status alone does not establish an internal platform
principal.

Capability removal, account deactivation, and account expiry therefore take effect on the next call.
There is no positive authorization cache. Existing sessions do not have a per-session revocation
store; an incident response must deactivate the account or remove the capability until a separate
session-revocation contract exists.

## Capability format

Administrative provisioning stores one exact object in
`tenant_users.metadata.siteRuntimeGrantOperatorV1`:

```json
{
  "enabled": true,
  "targets": [
    {
      "tenantId": "target-tenant-id",
      "siteIds": ["target-site-id"]
    }
  ]
}
```

Only `enabled` and `targets` are allowed at the capability level. Each target allows only `tenantId`
and `siteIds`. Targets and site lists must be non-empty, identifiers must be non-empty canonical
repository strings, tenant targets and site IDs must be unique, and `*` is forbidden. Empty,
disabled, malformed, duplicated, wildcard, or extended objects fail closed.

A tenant role never grants this capability. Existing application writes to `tenant_users.metadata`
are limited to the `admin/tenant-users` create and update operations guarded by `AdminKeyGuard`.
Administrative provisioning may use `ADMIN_KEY`; callers using the Dashboard service credential
must additionally assert the Dashboard `admin` role. The Dashboard exposes no tenant-user metadata
self-service BFF route, and customer login only calls the authenticate operation, which does not
return metadata. Thus an internal administrator can provision the capability, while an ordinary
tenant user or tenant admin cannot self-elevate through an existing application route. The shared
administrative credential is not accepted as an execution identity by this auth component.

## Transport routes and request boundary

The Dashboard exposes four server-only BFF routes and maps them to the corresponding internal API
routes:

| Operation | Dashboard BFF | Internal API |
| --- | --- | --- |
| Preview | `POST /api/internal/site-runtime-grants/:tenantId/:siteId/preview` | `POST /internal/site-runtime-grants/:tenantId/:siteId/preview` |
| Create | `POST /api/internal/site-runtime-grants/:tenantId/:siteId` | `POST /internal/site-runtime-grants/:tenantId/:siteId` |
| Revoke | `POST /api/internal/site-runtime-grants/:tenantId/:siteId/:grantId/revoke` | `POST /internal/site-runtime-grants/:tenantId/:siteId/:grantId/revoke` |
| Status | `GET /api/internal/site-runtime-grants/:tenantId/:siteId/:grantId` | `GET /internal/site-runtime-grants/:tenantId/:siteId/:grantId` |

The BFF obtains the unchanged token from the verified, HTTP-only `ssb_admin` cookie. It accepts only
an individual `customer` session with a tenant and `tenantUserId`. It never forwards browser-supplied
authorization, dashboard-token, admin-key, actor, role, tenant, host, or forwarded-host headers.
The target URL is built only from the configured `BACKEND_BASE_URL` origin and encoded path segments,
redirect following is disabled, and both the upstream request and returned response use `no-store`.

Preview and create accept only the write-service term fields. Revoke accepts only
`revocationReason`; status has no body. The API controller authorizes before inspecting or executing
a write and performs its own exact raw-body key check. Its body remains `unknown`, so the global
`ValidationPipe({ whitelist: true, transform: true })` cannot silently strip a reserved field before
that check.

## Mutation provenance

Every POST requires both an `Origin` equal to the exact origin configured in
`DASHBOARD_PUBLIC_URL` and `Sec-Fetch-Site: same-origin`. Missing, malformed, same-site-only, or
foreign values fail before any upstream call. The expected origin never comes from `Host`,
`Forwarded`, or `X-Forwarded-*` request headers. The status GET remains read-only and does not use the
mutation-origin check, but it still requires the verified individual session and full API
authorization.

## Required configuration

- Dashboard: `BACKEND_BASE_URL`, `DASHBOARD_PUBLIC_URL`, `DASHBOARD_INTERNAL_TOKEN`, and
  `ADMIN_SESSION_SECRET`.
- API: `DASHBOARD_INTERNAL_TOKEN` and the same `ADMIN_SESSION_SECRET` used to sign the Dashboard
  session.

The dashboard credential and session-signing secret retain separate purposes. Missing, weak, or
malformed values fail closed. Compose files contain variable references only; secret values remain
outside the repository.

## Response and error projection

The API maps invalid input to 400, authentication failure to 401, missing capability to 403,
unknown or inaccessible scope/grant to 404, overlap or unavailable runtime to 409, and unexpected
failures to a generic 500. The BFF accepts only the documented successful status and exact safe
grant/runtime projection for each operation. Redirects, malformed success bodies, additional
fields, unexpected statuses, and upstream failures become a generic 500. Upstream exception,
database, policy, audit, credential, and token details are never reflected.

## Scope and service context

The requested target tenant and site are compared with the exact capability entries. The API also
queries `sites` and requires the target site to belong to the selected target tenant. Missing,
foreign, malformed, or unauthorized targets all produce the same not-found boundary.

Only after all checks succeed does the component return:

```text
tenantId  = validated target tenant
siteId    = validated target site
actorId   = tenant-user:<persisted tenant_users.id>
actorRole = admin
```

`actorRole` is a fixed capability mapping required by the current write-service contract. It is not
read from the request or stored as a general platform administrator role.

Authentication failures map to 401, missing or malformed operator capability and non-internal
principals to 403, and inaccessible or unknown target scope to 404. Unexpected failures retain their
internal cause while exposing only a generic 500 message. Tokens, credentials, full payloads,
password metadata, and database details are never logged or returned.

## Remaining operational work

Individual internal users and their exact capability targets still require a separate authorized
provisioning step. Migration 032 must be applied separately, and runtime configuration and an
explicit operational release must be validated before grant writes are used. A UI or CLI, if ever
needed, is separate product work. None of these prerequisites or this transport implementation
implies deployment, provider use, public-widget activation, production activation, Enterprise
approval, or grant approval.
