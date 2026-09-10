# Site-runtime grant operator authentication contract

## Status and boundary

This document defines the API-side authentication and authorization component for a future internal
site-runtime grant transport. The transport itself is **not implemented**: there is no controller,
Dashboard BFF route, UI, CLI, module registration, deployment configuration, or operational grant
provisioning in this change.

The component does not create, revoke, inspect, or audit grants. It only resolves a verified request
to the existing `SiteRuntimeGrantWriteService` context.

## Identity chain

The accepted principal is an individually authenticated `tenant_users` row. The future Dashboard BFF
must forward both:

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

## Remaining transport and operational work

Before this can be used, a separate implementation must register the service, provide
`ADMIN_SESSION_SECRET` to the API through secret management, add a narrowly scoped controller and
same-origin Dashboard BFF routes, enforce the existing `SameSite=Strict` cookie boundary plus an
explicit mutation Origin/Fetch-Metadata check, reject unknown request fields, and map only sanitized
write-service projections.

Individual internal users and their exact capability targets must be provisioned in a separate,
authorized operational step. Migration 032 must be applied separately before grant writes are used.
None of these prerequisites implies deployment, provider use, public-widget activation, production
activation, or grant approval.
