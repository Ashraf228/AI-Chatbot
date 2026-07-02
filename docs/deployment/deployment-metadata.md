# Deployment Metadata

This deployment uses service-specific commit metadata. Do not treat the server
repository commit as the runtime commit for every service.

## Commit Sources

- API runtime commit: `GET /healthz`, field `apiCommit` or `commit`.
- Dashboard build commit: `GET /healthz`, field `commit`.
- Widget build commit: `GET /version.json`, field `commit`.
- Server repository commit: `git rev-parse HEAD` on the host.
- Image commit label: `org.opencontainers.image.revision`.

All commit fields are non-secret metadata. They must be Git-SHA-like values or
`unknown`.

## Expected Deployment Semantics

API-only deploy:

- Expected `apiCommit` equals the target commit.
- Dashboard and widget commits may remain unchanged.

Dashboard-only deploy:

- Expected dashboard `/healthz.commit` equals the target commit.
- API `/healthz.apiCommit` may remain unchanged.
- Widget commit may remain unchanged.

Widget-only deploy:

- Expected widget `/version.json.commit` equals the target commit.
- API and dashboard commits may remain unchanged.

Full deploy:

- API, dashboard and widget commits should all equal the target commit.

## Build Metadata Contract

Docker builds accept these non-secret build arguments:

```text
APP_COMMIT_SHA
BUILD_COMMIT
BUILD_DATE
```

Runtime containers expose:

```text
APP_COMMIT_SHA
BUILD_COMMIT
BUILD_DATE
```

Images expose:

```text
org.opencontainers.image.revision
org.opencontainers.image.created
```

## Safety Rules

- Do not put secrets, database URLs or provider keys into health responses.
- Do not infer API freshness from the dashboard image, or the reverse.
- Dashboard-only deploys must not rewrite API `APP_COMMIT_SHA`.
- Monitoring should report commit mismatches as service-specific diagnostics.
- A mismatch is only critical when the changed service does not report the
  expected target commit or health is failing.
