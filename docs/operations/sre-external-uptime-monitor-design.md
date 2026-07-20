# SRE External Uptime Monitor Design

## Summary

This document defines a provider-neutral external uptime monitor design for Enterprise Pilot readiness.
It is intentionally limited to design, scope, routing, and operational guardrails.
It does not create monitors, change runtime code, modify workflows, or grant any production mutation capability.

## Current External Monitoring Baseline

Current production confidence relies on internal and operator-driven signals, not on a dedicated always-on external uptime monitoring layer.

Observed baseline:

- manual and deploy-adjacent validation through `scripts/ops/check-production-health.sh`
- internal application health endpoints for API and dashboard
- public widget asset reachability checks
- safe synthetic widget validation through the existing public widget configuration and `production-health-synthetic`
- CI and Docker build gates that validate buildability and security posture
- documented routing and incident response structure from SRE-1B and SRE-1C

Current gap:

- no documented minimal external uptime monitor set that continuously checks public production availability from outside the stack
- no provider-neutral monitor taxonomy for Enterprise Pilot readiness
- no explicit mapping from external uptime failures to routing and incident expectations

## Monitor Design Principles

All future external uptime monitors for the pilot should follow these rules:

1. Use only public or otherwise secret-free targets.
2. Prefer stable health or static reachability targets over business-action targets.
3. Separate uptime detection from deploy approval.
4. Route alerts through the SRE-1B ownership model.
5. Escalate incidents through the SRE-1C process model.
6. Avoid collecting customer content, chat payloads, or PII.
7. Keep monitor outputs metadata-only wherever possible.
8. Treat synthetic chat smoke as a special, tightly restricted monitor class.
9. Do not couple external monitoring design to one vendor.
10. Do not interpret monitoring green as proof that deeper application workflows are fully correct.

## Monitor Types

### 1. API Health Monitor

Purpose:
Detect whether the public API health surface is reachable and returns success.

Target shape:

- `GET <api_base_url>/healthz`

Expected signal:

- HTTP `200`
- bounded response time
- no authentication secret required

### 2. Dashboard Health Monitor

Purpose:
Detect whether the public dashboard surface is reachable and returns success on its health endpoint.

Target shape:

- `GET <dashboard_base_url>/healthz`

Expected signal:

- HTTP `200`
- bounded response time
- no login flow, no authenticated page automation

### 3. Widget Loader Reachability Monitor

Purpose:
Detect whether the public widget loader asset remains reachable.

Target shape:

- `GET <widget_base_url>/loader.js`

Expected signal:

- HTTP `200`
- JavaScript content returned

### 4. Widget Bundle Metadata Monitor

Purpose:
Detect whether the public widget version metadata remains reachable.

Target shape:

- `GET <widget_base_url>/version.json`

Expected signal:

- HTTP `200`
- valid JSON
- no customer content

### 5. Widget Config Safe Synthetic Monitor

Purpose:
Validate that the public widget configuration still resolves correctly for a dedicated safe test site key.

Target shape:

- public widget configuration request using `<safe_test_site_key>`

Expected signal:

- HTTP `200`
- expected safe site key match
- response shape remains compatible with the known synthetic health flow

### 6. Safe Synthetic Widget Smoke Monitor

Purpose:
Perform a minimal external end-to-end smoke against the safe test site only.

Target shape:

- secret-free, safe synthetic widget interaction against the designated test site

Expected signal:

- the safe synthetic flow completes without touching customer data
- response remains within the approved public widget response shape

Constraint:

- this is not a normal high-frequency uptime probe
- it is a carefully bounded synthetic monitor class with stricter approval and lower frequency

### 7. TLS Certificate Expiry Monitor

Purpose:
Detect whether public certificates approach expiry.

Target shape:

- certificate checks for public production hostnames represented only as placeholders in documentation

Expected signal:

- remaining validity above agreed threshold

### 8. DNS Resolution Monitor

Purpose:
Detect whether public production hostnames continue to resolve.

Target shape:

- external resolution check for documented public hostnames represented only as placeholders in documentation

Expected signal:

- successful resolution to expected service endpoints

## Pilot Minimum External Monitors

The Enterprise Pilot minimum set should be:

1. API health monitor
2. Dashboard health monitor
3. Widget loader reachability monitor
4. Widget bundle metadata monitor
5. Widget config safe synthetic monitor
6. TLS certificate expiry monitor
7. DNS resolution monitor

Optional but recommended for pilot-hardening, not required for initial minimum:

- safe synthetic widget smoke monitor

Not part of the minimum external uptime set:

- Main CI gate
- Docker fallback gate
- production-context audit
- authorization matrix validation
- security boundary tests

These remain important process and security signals, but they are not continuous public uptime monitors.

## Frequency And Timeout Defaults

Recommended starting defaults:

- API health: every 1 minute, timeout 10 seconds
- dashboard health: every 5 minutes, timeout 15 seconds
- widget loader reachability: every 5 minutes, timeout 15 seconds
- widget bundle metadata: every 5 minutes, timeout 15 seconds
- widget config safe synthetic: every 5 minutes, timeout 15 seconds
- TLS certificate expiry: every 24 hours
- DNS resolution: every 5 to 15 minutes
- safe synthetic widget smoke: deploy-time and post-deploy by default, or low-frequency only after explicit approval

Alert threshold defaults:

- require 2 to 3 consecutive failures before paging for non-SEV0 monitor classes
- allow immediate escalation only for clearly critical total outage patterns

## Routing Mapping

External uptime monitoring should route into the SRE-1B alert model.

Default mapping:

- availability alerts -> `<primary_ops_channel>`
- repeated unresolved availability alerts -> `primary_on_call`, then `backup_on_call`
- pilot stakeholder visibility -> `pilot_ops_owner`
- security-significant anomalies -> `security_owner`
- privacy-relevant anomalies -> `privacy_owner`
- platform remediation coordination -> `engineering_owner`
- customer communication preparation, if needed -> `customer_success_owner`

The monitor system should not invent a separate routing model.
It should reuse the existing routing structure and severity language from SRE-1B.

## Incident Mapping

External uptime failures should map into the SRE-1C incident process as follows:

- isolated transient monitor miss -> observe, no incident by default
- repeated failure on one critical public surface -> incident candidate
- simultaneous API and dashboard failure -> likely SEV1 or higher
- safe synthetic widget smoke failure with core public paths still green -> investigate as targeted functional degradation, not automatically total outage
- TLS expiry warning within threshold -> planned remediation, not necessarily active incident
- DNS resolution failure on public production host -> urgent incident candidate

Operational rule:

- monitor failure is a detection signal
- incident classification, communications, rollback, and remediation remain governed by the SRE-1C runbook

## Safe Synthetic Widget Smoke Rules

The safe synthetic widget smoke monitor, if enabled, must remain tightly bounded:

- safe test site only
- no customer site usage
- no customer content
- no delivery side effects
- no lead capture
- no email field submission
- no webhook trigger expectation
- no authenticated dashboard dependency
- no secrets in payloads or outputs
- no report export
- no transcript retention beyond minimal metadata needed for pass or fail

Allowed outputs:

- timestamp
- target class
- pass or fail
- response-shape compatibility
- latency bucket
- failure classification

Disallowed outputs:

- full conversation transcript
- customer-like prompts
- response bodies with sensitive content
- screenshots containing customer data
- copied raw logs with secrets

## Alert Noise And False Positive Controls

External uptime monitoring should minimize false positives through:

1. Consecutive-failure thresholds before escalation.
2. Region diversity only if the provider supports it cleanly.
3. Differentiation between asset-level failure and total application outage.
4. Maintenance-window suppression when a separately approved change window exists.
5. Distinct severity handling for TLS/DNS warnings versus active downtime.
6. Synthetic widget smoke kept lower-frequency than simple health checks.
7. No alerting on raw single-sample latency spikes alone unless thresholds are sustained.

Recommended operator stance:

- prefer fewer trustworthy pilot alerts over noisy high-volume alerts

## Provider-Neutral Implementation Notes

This design is intentionally provider-neutral.
Any future provider choice should support:

- HTTP or HTTPS status checks
- header and body match support
- DNS checks
- TLS expiry checks
- simple escalation policies
- alert fan-out into the existing routing model
- auditability of monitor changes

Provider-specific setup is deferred.

This document does not approve:

- a vendor
- monitor credentials
- alert destination URLs
- incident webhook secrets
- phone trees
- SMS routing
- chat webhook targets

Those belong in a later implementation-only step with separate review.

## Pilot Go/No-Go Criteria

Minimum pilot-ready monitor posture should be considered met when:

1. The pilot minimum monitor set exists.
2. Targets are public or secret-free.
3. Alert routing is mapped to the SRE-1B roles.
4. Incident handling is mapped to the SRE-1C runbook.
5. Safe synthetic widget smoke, if enabled, is restricted to the safe test site.
6. No monitor stores customer data or report payloads.
7. TLS and DNS coverage exists for the production hostnames.
8. Alert noise controls are configured.

Not sufficient by itself:

- green monitor status
- green CI
- green Docker fallback

These are useful signals, but pilot readiness still depends on broader operations and security posture.

## Implementation Roadmap

Recommended implementation order:

1. Confirm canonical public production base URLs.
2. Create simple API and dashboard health monitors.
3. Create widget loader and version metadata monitors.
4. Create widget config safe synthetic monitor with `<safe_test_site_key>`.
5. Add TLS expiry and DNS monitors.
6. Validate routing into the SRE-1B ownership model.
7. Validate incident handling against the SRE-1C workflow.
8. Decide separately whether low-frequency safe synthetic widget smoke is justified.

## Stop Boundaries

This design does not permit:

- creating a real monitor provider integration
- configuring alert destinations
- adding secrets
- adding customer domains or customer data
- enabling high-frequency synthetic chat against customer sites
- storing transcripts or reports with data
- modifying runtime code
- modifying workflows
- modifying scripts
- deploys
- DB reads or writes
- SQL

## Recommended Next Step

Recommended next step:

- `SRE-1E Pilot Health Review Checklist`

Alternative follow-up if implementation planning is preferred first:

- `SRE-1F Minimal External Monitor Setup Plan`

## Non-Goals

This document does not implement:

- external monitor provisioning
- provider selection finalization
- alert destination provisioning
- workflow dispatch automation
- production deploy gating changes
- rollback automation
- public widget runtime changes
- dashboard runtime changes
- API runtime changes
- DB queries
- reports with data
