# Production Health Synthetic Site Key Audit

## Summary

This document audits the `production-health-synthetic` Widget Config monitoring signal after the production health alert reported:

```text
FAIL widget config invalid http=404
```

The current read-only verification on 2026-07-14 showed that the synthetic Widget Config endpoint now returns HTTP 200 and the expected `siteKey`. That means the original alert is no longer reproducible at the public endpoint, but the monitoring path still needs a stable, explicit source of truth so future checks do not drift back to customer-specific or stale widget keys.

This audit is documentation only. It does not change the production health script, runtime code, site data, widget data, feature flags, database records, migrations, or public widget behavior.

## Current Production Health Script Behavior

Script: `scripts/ops/check-production-health.sh`

The script is a mixed production health check that combines public HTTP checks with host-local checks.

| Check area | Source / default | Current behavior | Failure mode |
| --- | --- | --- | --- |
| API health | `API_HEALTH_URL`, default `https://api.soulesmartbusiness.com/healthz` | GETs API health and reads status, database, redis, and commit fields. | Fails if HTTP request, health state, database, or redis is unhealthy. |
| Dashboard health | `DASHBOARD_HEALTH_URL`, default `https://app.soulesmartbusiness.com/healthz` | GETs Dashboard health and reads build commit. | Warns or fails depending on availability and returned metadata. |
| Dashboard login | `DASHBOARD_URL`, default `https://app.soulesmartbusiness.com/login` | Expects HTTP 200. | Fails if login page is unavailable. |
| Widget loader | `WIDGET_LOADER_URL`, default `https://widget.soulesmartbusiness.com/loader.js` | Expects HTTP 200. | Fails if loader is unavailable. |
| Widget version | `WIDGET_VERSION_URL`, default `https://widget.soulesmartbusiness.com/version.json` | Reads widget build commit. | Warns if version metadata is unavailable or unknown. |
| Widget config | `WIDGET_CONFIG_URL`, default `https://widget.soulesmartbusiness.com/widget/config?siteKey=rohrreinigung-ffm24` | Expects HTTP 200 and a JSON body containing `"siteKey":"$EXPECTED_WIDGET_SITE_KEY"`. | Fails as `widget config invalid` if HTTP status is not 200 or the expected key is absent. |
| Expected widget key | `EXPECTED_WIDGET_SITE_KEY`, default `rohrreinigung-ffm24` | Used only as a body assertion for the Widget Config response. | A stale or mismatched value creates a false red/yellow production health signal. |
| Privacy URL | `PRIVACY_URL`, default `https://www.rohrreinigung-ffm24.de/datenschutz` | Expects HTTP 200. | Fails if the configured page is unavailable. |
| Host-local checks | Docker Compose, backups, offsite backups, logs, disk, job health | Runs inside the production host context. | Fails or warns based on container state, backup freshness, log patterns, disk usage, and job health. |

Important detail: the script accepts a full `WIDGET_CONFIG_URL` and separately asserts `EXPECTED_WIDGET_SITE_KEY`. If these values drift apart, the check fails even when the widget service is healthy.

## Current Synthetic Key Failure

Historical alert:

| Field | Value |
| --- | --- |
| Monitoring key | `production-health-synthetic` |
| Alert result | Widget Config HTTP 404 |
| Alert impact | Production health marked FAIL despite API, DB, Redis, Dashboard, Widget loader, Widget container, Proxy, backups, and job health being OK. |
| Runtime impact | No runtime impact was established from the alert alone. |

Current read-only verification on 2026-07-14:

| Endpoint | Result |
| --- | --- |
| `GET /widget/config?siteKey=production-health-synthetic` | HTTP 200 |
| Returned `siteKey` | `production-health-synthetic` |
| Returned `siteId` | `production-health-synthetic` |
| `isActive` | `true` |
| Public unsafe fields found in response | none for debug, preview, knowledge, delivery, deliveryChannels, assistantProfile, conversationEngine, secret, token, apiKey, signingSecret |

The current endpoint state suggests one of these happened after the alert:

- A dedicated synthetic site or alias was restored.
- The widget service lookup became able to resolve the key again.
- The alert was produced during a transient configuration window.
- The production monitor was using an environment value that has since been corrected.

Because no database reads or production config reads were performed in this audit, this document does not claim which of those explanations is definitive.

## Manual Internal Testsite Baseline

Known internal testsite baseline from the previous production validation:

| Field | Value |
| --- | --- |
| Internal testsite key | `p04-internal-test-20260702102313` |
| Internal testsite siteId | `88f22a5a-35b9-4d38-a5b7-e5bd95f9c23f` |
| Previous smoke scope | Widget loader, bundle, config, session/chat smoke |
| Previous smoke result | Green |
| Public unsafe fields | none observed in prior smoke |
| Side effects | No leads, jobs, tickets, documents, chunks, ingestion, feature flags, or Conversation Engine public activation |

Current read-only verification on 2026-07-14:

| Endpoint | Result |
| --- | --- |
| `GET /widget/config?siteKey=p04-internal-test-20260702102313` | HTTP 200 |
| Returned `siteKey` | `p04-internal-test-20260702102313` |
| Returned `siteId` | `88f22a5a-35b9-4d38-a5b7-e5bd95f9c23f` |
| `isActive` | `true` |
| Public unsafe fields found in response | none for debug, preview, knowledge, delivery, deliveryChannels, assistantProfile, conversationEngine, secret, token, apiKey, signingSecret |

No new chat/session smoke was executed in this audit because the scope is read-only and explicitly avoids database reads/writes or widget data mutations.

## Endpoint And Route Analysis

Public Widget Config route:

```text
GET /widget/config?siteKey=<siteKey>
```

Relevant code:

- `apps/api/src/modules/widget/controllers/widget-config.controller.ts`
- `apps/api/src/modules/widget/guards/widget-site.guard.ts`
- `apps/api/src/modules/widget/services/widget-config.service.ts`

Observed behavior from code:

- `WidgetConfigController` exposes `GET widget/config`.
- `WidgetSiteGuard` requires a non-empty `siteKey` from query, body, or `x-site-key`.
- `WidgetConfigService.getPublicConfig(siteKey)` resolves the site through `getSiteByKey(siteKey)`.
- `getSiteByKey` queries `sites.site_key = $1`.
- Missing site key returns `NotFoundException('Unknown siteKey')`, which maps to HTTP 404.
- Inactive site returns HTTP 403.
- The public config response includes public widget fields such as `siteId`, `siteKey`, `apiBase`, title, greeting, theme, privacy URL, domain, and active state.

Implications:

- The endpoint is key-based, not tenant/site-id based.
- `production-health-synthetic` must exist as an actual `sites.site_key` or another explicitly supported lookup path.
- A tenant slug, site ID, or monitoring label is not sufficient unless it is also a valid widget site key.
- A stable synthetic monitor should not depend on a customer site key or municipality-specific site key.

## Root Cause Hypotheses

| Hypothesis | Evidence | Risk | Current assessment |
| --- | --- | --- | --- |
| `production-health-synthetic` did not exist as `sites.site_key` when the alert ran. | HTTP 404 maps to `Unknown siteKey`; the alert reported 404. | Monitoring false red/yellow. | Plausible historical cause. |
| The monitor used a stale or mismatched `WIDGET_CONFIG_URL` / `EXPECTED_WIDGET_SITE_KEY`. | The script has two independent env-driven values. | Healthy widget endpoint can still fail if URL and expected key diverge. | Plausible and should be guarded. |
| The synthetic key was restored after the alert. | Current read-only check returns HTTP 200 for `production-health-synthetic`. | Without documentation, future drift can recur. | Plausible. |
| The route expects a site key but the monitor used a label. | Code queries `sites.site_key = $1`. | A human-readable monitor name can return 404 if not a real key. | Plausible historical cause. |
| The site existed but was inactive. | Code would return 403 for inactive sites; alert was 404. | Less likely for the observed alert. | Unlikely for the 404 alert. |
| The widget service or route was globally broken. | Internal testsite and current synthetic config checks return 200; loader/version were OK. | Low. | Not supported. |
| Customer-specific defaults caused drift. | Script defaults still reference a customer-like key and privacy URL. | Monitoring can become coupled to an unrelated customer site. | Real design risk. |

## Fix Options

| Option | Description | Pros | Cons / risk | Recommendation |
| --- | --- | --- | --- | --- |
| A. Script/config-only stable synthetic key | Make production monitoring explicitly use `production-health-synthetic` for both `WIDGET_CONFIG_URL` and `EXPECTED_WIDGET_SITE_KEY`. | Low risk if the key exists and is stable; no code runtime changes. | Still depends on the synthetic site remaining provisioned. | Recommended baseline. |
| B. Dedicated synthetic site lifecycle | Treat `production-health-synthetic` as a managed internal monitoring site with documented owner, purpose, expected public fields, and rollback path. | Strong long-term monitoring model. | Requires controlled data/config management outside this audit. | Recommended follow-up if not already formalized. |
| C. Add diagnostic split in the script | Distinguish widget service health, synthetic config reachability, and customer/privacy page checks. | Prevents one stale synthetic key from obscuring service health. | Script change needed in a later step. | Recommended for P1.2B-Synthetic-1B. |
| D. Use internal testsite key for monitor | Point monitor at `p04-internal-test-20260702102313`. | Known green baseline. | It may be less semantically clear than a dedicated synthetic key. | Acceptable fallback, not first choice if `production-health-synthetic` is stable. |
| E. Provision or repair site data | Create or update the synthetic site record. | Fixes root cause if the key is missing or inactive. | Production data/config mutation; needs separate approval and rollback. | Out of scope for 1A. |
| F. Keep current behavior undocumented | No change. | No immediate work. | Monitor can drift again; health signal remains ambiguous. | Not recommended. |

## Recommended P1.2B-Synthetic-1B Scope

Recommended next scope: script/config-only stabilization plus diagnostics, without runtime code or production data mutation.

Allowed for 1B:

- Update `scripts/ops/check-production-health.sh` only if needed.
- Introduce explicit variable names such as `SYNTHETIC_WIDGET_SITE_KEY` and derive the config URL from it, or ensure `WIDGET_CONFIG_URL` and `EXPECTED_WIDGET_SITE_KEY` are validated together.
- Keep the default synthetic key non-customer-specific.
- Keep the privacy/customer page check separate from widget service and synthetic config checks.
- Improve failure messages so mismatched URL key, response key, HTTP status, inactive site, and request failure are distinguishable.
- Add tests for URL/key consistency and response validation logic if script logic is changed.
- Update docs for expected production environment variables.

Not allowed for 1B without a separate plan:

- Creating or mutating a production site record.
- Changing widget public response shape.
- Activating feature flags.
- Adding NOLIS-specific or municipality-specific logic.
- Running chat/session smokes against production unless explicitly approved.
- Reading or writing production database rows.
- Running migrations.

Suggested 1B validation:

```text
bash -n scripts/ops/check-production-health.sh
npm run security:audit:production-contexts
npm run security:check-authorization-matrix
npm run test:security-boundaries
git diff --check
```

If script behavior changes, add focused shell/unit coverage for:

- Expected key equals returned key.
- URL key and expected key mismatch produces an explicit diagnostic.
- HTTP 404 is reported as missing synthetic site key.
- HTTP 403 is reported as inactive synthetic site key.
- Widget loader/version health can be green while synthetic config is yellow.

## Required Tests

For this audit:

- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

For P1.2B-Synthetic-1B if scripts change:

- `bash -n scripts/ops/check-production-health.sh`
- Focused script validation for key mismatch and HTTP-status diagnostics.
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

For any later production data/config repair:

- Separate approval.
- Explicit rollback plan.
- Sanitized before/after public config checks.
- No customer site mutation.
- No feature flags.
- No public widget response change.

## Rollback And Revert Strategy

For this audit:

- Revert the documentation commit.
- No runtime rollback exists because no runtime state changes are made.

For a later script-only 1B change:

- Revert the script/docs commit.
- Restore the previous production monitor env values if they were changed by an approved operator action.
- Re-run the production health script in read-only mode.

For a later synthetic site data repair:

- Use a separate rollback plan before making any data/config change.
- Preserve the previous synthetic site state.
- Re-run only read-only public config checks after rollback.

## Non-Goals

- No production deploy.
- No migration.
- No SQL.
- No production database reads or writes.
- No `email_jobs` reads, writes, updates, or processing.
- No feature flags.
- No production config mutation.
- No site/widget/customer data mutation.
- No Conversation Engine activation in the public widget.
- No AssistantProfile migration.
- No NOLIS-specific logic.
- No municipality-specific hardcoding.
- No public widget response change.
- No new runtime refactor.

## Recommended Next Step

Proceed with `P1.2B-Synthetic-1A-D` to review and merge this audit.

After merge, perform `P1.2B-Synthetic-1B` as a narrow script/config stabilization step:

- Keep `production-health-synthetic` as the preferred stable dedicated synthetic key if it remains HTTP 200.
- Make key mismatch diagnostics explicit.
- Keep customer/privacy checks separate from synthetic widget health.
- Avoid DB, runtime, feature flag, deploy, and public widget behavior changes.
