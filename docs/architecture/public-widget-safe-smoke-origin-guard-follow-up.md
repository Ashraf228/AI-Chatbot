## Summary

This follow-up documents why the safe Public Widget smoke after `P1.2B-23E` stayed yellow even though the API-only deploy itself was green.

The safe test-site Widget Config endpoints are publicly reachable and return HTTP `200`, but the session/chat smoke is blocked with HTTP `403` before any full chat response can be verified. The block is consistent with the production Origin Guard path on `/widget/session` and `/widget/chat/message`.

No runtime code, deploy, DB read, DB write, SQL, site-config mutation, or Production config change was performed in this follow-up.

Historical resolution note:

- `P1.2B-23E-F` captured the read-only yellow-state diagnosis.
- `P1.2B-23E-G` later resolved the yellow state without any Site-Config mutation.
- The successful safe-smoke Origin was the already allowed internal Origin `https://p04-internal-test-20260702102313.internal.test`.
- `P1.2B-24E` later revalidated the same safe internal Origin during the API-only deploy of `f315dc11b9caf175f3bfb5a302ee4a2b8ad9fa13`, again with Loader `200`, Bundle `200`, Config `200`, Session `201`, Chat `201`, neutral response text, and unchanged public response shape.

## Current P1.2B-23E Yellow Status

- API live commit: `577518a29eac8a9553309f4aadaf6ac7e12479bc`
- Dashboard live commit: `3a276e7f0ef898bae791638b964087780da80c4d`
- Widget live commit: `7378ddb53bc3588cf35be3530fcbbf5d72e58b12`
- Production health: green
- Widget loader/config health: green
- Public chat smoke was not yet fully verifiable at the time of this read-only audit because the safe smoke session init was blocked with HTTP `403`

## Observed 403 Origin Guard Behavior

Observed read-only probes against the safe internal site `p04-internal-test-20260702102313` showed:

- `GET /widget/config?siteKey=p04-internal-test-20260702102313`: HTTP `200`
- `POST /widget/session`: HTTP `403`
- The `403` body is the standard Nest forbidden payload:
  - `{"message":"Forbidden resource","error":"Forbidden","statusCode":403}`

The `403` reproduced for multiple sanitized header shapes:

- `Origin: https://widget.soulesmartbusiness.com`
- `Referer: https://widget.soulesmartbusiness.com/__codex-smoke`
- `Origin: https://www.soulesmartbusiness.com`
- `Origin: https://app.soulesmartbusiness.com`
- no `Origin` / no `Referer`

This means the initial block was not tied to one accidental smoke header. It was systematic for the tested public Origins.

Later resolution in `P1.2B-23E-G`:

- the preferred safe testsite already had one existing non-customer allowed Origin
- no DB write was needed
- no customer site was changed
- re-running the smoke with the existing internal Origin succeeded

## Safe Test Sites Checked

### `p04-internal-test-20260702102313`

- Config HTTP `200`
- Returned `siteId`: `88f22a5a-35b9-4d38-a5b7-e5bd95f9c23f`
- Returned `domain`: `https://p04-internal-test-20260702102313.internal.test`
- Returned `consentRequired`: `false`
- Returned `leadCaptureEnabled`: `false`

### `production-health-synthetic`

- Config HTTP `200`
- Returned `siteId`: `production-health-synthetic`
- Returned `domain`: `https://synthetic-monitoring.soulesmartbusiness.com`
- Returned `consentRequired`: `true`
- Returned `leadCaptureEnabled`: `false`

## Public Config Findings

The public config returned by `WidgetConfigService.getPublicConfig()` intentionally exposes safe public fields such as:

- `siteId`
- `siteKey`
- `publicKey`
- `apiBase`
- `widgetBundleUrl`
- `domain`
- `consentRequired`
- `leadCaptureEnabled`

It does **not** expose `allowedDomains`.

That omission is consistent with the current public-config design, not by itself proof of broken site data.

Important implementation detail:

- public config `domain` is derived from `config.domain` or the first `allowed_domains` entry
- Origin Guard does **not** use public config `domain`
- Origin Guard uses the database `sites.allowed_domains` array only

## Origin / Referer / Header Findings

The relevant origin resolution path is:

1. `WidgetOriginGuard`
2. `WidgetSecurityService.isAllowedOrigin(siteKey, origin, referer)`
3. `resolveRequestOrigin(origin, referer)`
4. `SELECT allowed_domains FROM sites WHERE id = $1`
5. `isDomainAllowed(requestOrigin, allowed_domains)`

Current behavior from code:

- if `Origin` exists, it is used
- else if `Referer` exists, its `.origin` is used
- else the request is rejected
- production does not allow development-origin bypasses
- `config.domain` does not participate in the allow decision

## Likely Cause

`403` is **probably** caused by the Origin Guard, and specifically by the effective `allowed_domains` for the safe smoke sites.

Reasoning:

- `/widget/config` succeeds for both safe sites, so the `siteKey` is valid and active
- `/widget/session` fails before a session is created
- the failure is stable across multiple `Origin` / `Referer` variants
- the guard path rejects when `allowed_domains` does not match the request origin
- the public config may still show a `domain` value even when the actual `allowed_domains` set used by the guard is empty or does not include the tested origin

Because this task stayed read-only, the audit itself does **not** prove which exact `allowed_domains` rows were stored in production. It only proves that the tested safe smoke origins were not accepted by the running guard. That gap was closed later in `P1.2B-23E-G`, which confirmed that an existing safe internal Origin already matched the guard.

## Safe Fix Options

### A. Use an already allowed internal origin, if one already exists

- needs DB write: no
- needs Production config: no
- needs deploy: no
- risk Public Widget: low
- rollback possible: yes
- secrets affected: no

Assessment:

This is the lowest-risk path if a non-customer internal origin is already present in `allowed_domains` for either safe site. The current read-only audit could not prove that such an origin already exists without crossing into a state-changing smoke path or a privileged admin/data read.

### B. Add one explicit non-customer allowed domain to a safe smoke site

- needs DB write: yes
- needs Production config: no
- needs deploy: no
- risk Public Widget: low
- rollback possible: yes
- secrets affected: no

Assessment:

This is the most direct repair if no existing internal origin is currently allowed. The preferred values are the already returned non-customer site domains:

- `p04-internal-test-20260702102313.internal.test`
- `synthetic-monitoring.soulesmartbusiness.com`

This requires a separate, explicit site-config mutation approval.

### C. Create a separate Admin-/Ops-Auftrag for a safe site-config update

- needs DB write: yes
- needs Production config: no
- needs deploy: no
- risk Public Widget: low
- rollback possible: yes
- secrets affected: no

Assessment:

This is the operationally correct path if option A cannot be proven. The scope should be narrowly limited to one safe, non-customer site and one explicit `allowedDomains` update, followed by a post-change smoke.

### D. Change runtime code or public config to bypass the guard

- needs DB write: no
- needs Production config: maybe
- needs deploy: yes
- risk Public Widget: high
- rollback possible: yes
- secrets affected: no

Assessment:

Not recommended. The current behavior is a security boundary, not a deploy regression. Relaxing the guard or exposing `allowedDomains` publicly would be a larger policy change and is out of scope.

## Recommended Minimal Fix

Historical recommended minimal fix: `C`, with `A` attempted first during the scoped follow-up.

Practical sequence:

1. Use a privileged admin-/ops-only read path to confirm whether either safe site already has one non-customer `allowedDomains` entry that matches a usable smoke origin.
2. If yes, rerun the safe Public Widget smoke using that exact origin.
3. If no, perform a separate narrowly scoped site-config update for exactly one safe site.
4. Re-run only the safe smoke afterward.

If a write is needed, the safer target is whichever site is explicitly intended for ongoing technical smoke, not a customer site.

## Required Approval Before Config Change

Any actual repair beyond read-only analysis requires a separate explicit approval because it would be a production site-config mutation.

That follow-up must define:

- target site key
- exact non-customer domain to add
- rollback value
- proof that no customer site is touched
- post-change smoke scope only

## Stop Criteria

Stop immediately if:

- a customer site would need to be used
- the origin remains unclear
- the site key remains unclear
- a DB write is required without explicit approval
- a Production config change is proposed
- a runtime code change is proposed
- a Public Widget response shape change is proposed
- a secret would appear in output

## Non-goals

- no deploy
- no migration
- no DB read or DB write
- no Production config change
- no runtime code change
- no script code change
- no customer-site mutation
- no Public Widget response change
- no full chat smoke that would intentionally create production session data

## Recommended Next Step

Resolution:

- The separate scoped ops task was executed as `P1.2B-23E-G`.
- No Site-Config repair was required.
- The safe-smoke succeeded with the existing internal Origin on `p04-internal-test-20260702102313`.

Original recommendation at the time of the read-only audit:

Create a separate scoped ops task:

`P1.2B-23E-G Safe Public Widget Smoke Site-Config Verification / Minimal Allowed-Domain Fix`

Scope for that follow-up:

- admin-/ops-only verification of the current `allowedDomains` state for `p04-internal-test-20260702102313` and `production-health-synthetic`
- if needed, one explicit non-customer `allowedDomains` repair on exactly one safe test site
- post-change rerun of the safe Public Widget chat smoke
