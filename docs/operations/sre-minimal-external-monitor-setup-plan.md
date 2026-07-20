# SRE Minimal External Monitor Setup Plan

## Summary

This document defines a documentation-only setup plan for a later minimal external monitoring layer for Enterprise Pilot readiness.
It translates the current SRE baseline into a concrete future setup scope: which monitors should exist, which placeholder targets they should use, how they should assert health, how often they should run, which routes and owner roles they should map to, and which acceptance criteria must be met before any real implementation starts.

This step is intentionally `DOKU_ONLY`.

This document does not:

- create external monitoring accounts
- create monitors
- configure alerts
- configure webhooks
- configure real provider destinations
- store secrets
- execute health checks
- change runtime code
- change workflows
- change production config
- deploy anything
- query any database
- execute SQL

## Current Baseline

The current baseline is already documented across `SRE-1A` through `SRE-1E` and related operations material:

- `SRE-1A` completed the monitoring and alerting audit.
- `SRE-1B` completed the alert routing design.
- `SRE-1C` completed the incident response runbook.
- `SRE-1D` completed the provider-neutral external uptime monitor design.
- `SRE-1E` completed the pilot health review checklist.
- `scripts/ops/check-production-health.sh` exists as the current manual and deploy-adjacent production health gate.
- safe public widget smoke is established as a safe production-adjacent signal.
- `production-health-synthetic` is an established safe widget configuration signal.
- external monitors are not yet technically configured.
- alert delivery is not yet technically configured.
- Docker fallback remains a build gate, not a deploy mechanism.
- `DB_READ_ONLY_AUDIT` remains blocked without explicit human approval.

Implication for this plan:

- Enterprise Pilot already has documented safe signals, routing roles, incident rules, and review routines.
- What is still missing is a minimal, provider-neutral, always-on external monitor setup plan that can later be implemented without introducing secrets, customer data, or unsafe runtime side effects.

## Setup Principles

All future monitor setup work for the pilot should follow these principles:

1. Provider-neutral design first.
2. No secrets in the repository.
3. No real webhook, alert destination, or monitor URLs with tokens in documentation.
4. Use only public or otherwise secret-free targets.
5. Do not mutate customer sites or customer content.
6. Do not collect or expose customer data, transcripts, or PII.
7. No DB reads, SQL, query runner usage, or report generation.
8. Safe synthetic checks are allowed only against the approved safe test site.
9. Monitor failures create incident candidates; they do not automatically trigger rollback.
10. Any real setup requires a separate implementation task and separate operator approval.

## Minimal Provider Requirements

The later provider selection must support, at minimum:

- HTTPS GET checks
- HTTP status assertion
- content assertion
- JSON field assertion, where applicable
- TLS certificate expiry monitoring
- DNS resolution monitoring
- configurable timeout
- consecutive failure threshold
- secret-managed alert destinations
- manual acknowledgement
- maintenance windows
- alert history or audit log
- role-based access
- no public tokens in monitor URLs

Recommended operational behavior:

- standard HTTP monitors should support 2 to 3 consecutive failures before paging
- provider outputs should remain metadata-only wherever possible
- the provider should support route separation between general ops and security-relevant alerts

## Pilot Monitor Inventory

| Monitor ID | Purpose | Target Placeholder | Method | Assertion | Frequency | Timeout | Failure Threshold | Severity | Route | Incident Mapping | Setup Priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `api-health` | Detect public API health endpoint availability | `<api_base_url>/healthz` | GET | HTTP `200` and health payload indicates service OK without exposing secrets | 1 to 5 min | 5 to 10s | 2 to 3 consecutive failures | `SEV1` | `<primary_ops_channel>` | repeated failure on critical public surface -> incident candidate | required |
| `dashboard-health` | Detect dashboard health endpoint availability | `<dashboard_base_url>/healthz` | GET | HTTP `200` | 5 min | 10 to 15s | 2 to 3 consecutive failures | `SEV2` or `SEV1` depending pilot dependency | `<primary_ops_channel>` | repeated failure during active pilot usage -> incident candidate | required |
| `widget-version` | Detect widget metadata reachability | `<widget_base_url>/version.json` | GET | HTTP `200` and version payload present | 5 min | 10 to 15s | 2 to 3 consecutive failures | `SEV2` or `SEV1` depending customer-facing dependency | `<primary_ops_channel>` | customer-facing metadata or deploy drift concern -> incident candidate | required |
| `widget-loader` | Detect widget loader reachability | `<widget_base_url>/<loader_path_placeholder>` | GET | HTTP `200` and non-empty JavaScript response | 5 min | 10 to 15s | 2 to 3 consecutive failures | `SEV1` | `<primary_ops_channel>` | repeated public widget asset failure -> incident candidate | required |
| `widget-config-safe` | Detect safe widget config reachability and drift | `<widget_base_url>/widget/config?siteKey=<safe_test_site_key>` | GET | HTTP `200` and `siteKey` matches `<safe_test_site_key>`; no secret, delivery, or debug fields | 5 min | 10 to 15s | 2 to 3 consecutive failures | `SEV1` or `SEV2` | `<primary_ops_channel>` | safe synthetic config regression -> incident candidate | required |
| `tls-expiry` | Detect certificate expiry risk for public pilot hosts | `<public_domains>` | TLS certificate check | certificate valid and expiry above threshold | daily | provider default | threshold-based, not high-frequency retry based | `SEV2` or `SEV1` depending remaining days | `<primary_ops_channel>` | planned remediation unless urgent threshold crossed | required |
| `dns-resolution` | Detect public hostname resolution failure | `<public_domains>` | DNS resolution | resolves to expected public host or IP class with no private secret data | 5 to 15 min | provider default | 2 consecutive failures | `SEV1` | `<primary_ops_channel>` | public hostname resolution failure -> urgent incident candidate | required |
| `safe-widget-chat-smoke` | Optional bounded end-to-end synthetic widget smoke | safe synthetic site only | POST session/chat | session and chat succeed and public response shape stays unchanged | deploy-time first, low-frequency later | provider-specific bounded timeout | 1 failure can open review, paging depends on rollout policy | `SEV1` or `SEV2` | `<primary_ops_channel>` and `<deploy_review_channel>` | targeted functional degradation, not automatically total outage | optional / later |

## Monitor-Specific Safety Notes

### `api-health`

- Use only the public health surface.
- Do not add tokens, auth headers, or private paths.
- Treat latency only as a secondary signal unless a later SLO task defines stricter limits.

### `dashboard-health`

- Use only the public health endpoint.
- Do not automate authenticated dashboard flows in the minimal setup.

### `widget-version`

- Metadata only.
- No customer or session payloads.
- Useful for drift detection after deploy-adjacent review.

### `widget-loader`

- Use a stable public loader path placeholder.
- Response validation should confirm non-empty JavaScript, not business behavior.

### `widget-config-safe`

- Must use the approved `<safe_test_site_key>`.
- The response must not expose delivery, secret, debug, or internal-only fields.
- This monitor remains configuration-focused, not conversation-focused.

### `tls-expiry`

- Public hostnames only.
- No certificate material, tokens, or account secrets in repo documentation.

### `dns-resolution`

- Public hostnames only.
- Resolution output should be treated as infrastructure metadata, not as a source of secret configuration disclosure.

### `safe-widget-chat-smoke`

- Safe test site only.
- No customer site usage.
- No customer data.
- No delivery side effects.
- No lead capture.
- No webhook trigger expectation.
- No secrets in payload or output.
- No transcript retention beyond minimal pass or fail metadata.
- This monitor class requires a separate explicit approval before implementation.

## Setup Phases

### Phase 1: Non-invasive External Checks

Initial setup scope should include:

- `api-health`
- `dashboard-health`
- `widget-version`
- `widget-loader`
- `widget-config-safe`
- `tls-expiry`
- `dns-resolution`

Phase 1 is intentionally limited to public, secret-free, non-invasive targets.

### Phase 2: Routing And Alert Delivery

After monitor definitions are accepted:

- connect the provider to secret-managed alert destinations
- reuse the SRE-1B role and channel model
- keep all routing destinations out of the repository

Phase 2 still does not imply deploy, runtime change, or production mutation.

### Phase 3: Safe Synthetic Smoke

Only after explicit approval:

- add `safe-widget-chat-smoke`
- keep it limited to the safe test site
- forbid customer site mutation
- forbid delivery or integration side effects

### Phase 4: Pilot Review Integration

Once Phase 1 and, if approved, Phase 3 exist:

- feed monitor states into the SRE-1E pilot health review routine
- treat repeated failures as incident candidates under SRE-1C
- use monitor history as operational evidence, not as a substitute for deploy gates

## Required Setup Inputs For Future Implementation

Future implementation work will need placeholder-backed values for:

- `<api_base_url>`
- `<dashboard_base_url>`
- `<widget_base_url>`
- `<loader_path_placeholder>`
- `<safe_test_site_key>`
- `<public_domains>`
- `<primary_ops_channel>`
- `<security_alert_channel>`
- `<daily_health_review_channel>`
- `<incident_bridge>`

Clarifications:

- none of these values are set in this task
- no real target values belong in repository documentation
- no secret-bearing values belong in repository documentation
- all real destinations must be configured through provider-side secret management or equivalent secure configuration

## Owner Roles And Routing Expectations

The setup plan reuses the documented SRE-1B routing model.

Primary roles:

- `primary_on_call`
- `backup_on_call`
- `pilot_ops_owner`
- `security_owner`
- `privacy_owner`
- `engineering_owner`
- `incident_commander`

Primary routes:

- `<primary_ops_channel>` for standard pilot availability alerts
- `<security_alert_channel>` for security-significant anomalies
- `<daily_health_review_channel>` for lower-severity review-oriented signals
- `<incident_bridge>` for active `SEV0` or `SEV1` response

Default route mapping:

- availability monitors -> `<primary_ops_channel>`
- repeated unresolved failures -> escalate from `primary_on_call` to `backup_on_call`
- security-significant anomalies -> `security_owner` and `<security_alert_channel>`
- active `SEV0` / `SEV1` -> `<incident_bridge>` with `incident_commander`

## Safety Validation Before Real Setup

Before any real provider setup begins, all of the following must be true:

- no monitor target contains tokens
- no monitor target contains customer data
- the safe test site is confirmed not to be customer-facing
- the widget config response does not expose secret, delivery, or debug fields
- any later synthetic smoke cannot trigger delivery or integration side effects
- alert destinations will be configured through secret management
- owner roles are assigned
- the incident runbook is known to operators
- the pilot health review can absorb monitor outcomes

Additional validation:

- monitor naming is stable and understandable
- failure thresholds are documented per monitor class
- maintenance-window behavior is known
- acknowledgement expectations are documented

## Failure Handling

Monitor failures are detection signals, not autonomous operational actions.

Rules:

- a monitor failure creates an incident candidate
- severity depends on the affected monitor and customer-facing impact
- 2 to 3 consecutive failures are recommended for standard HTTP monitors
- clear security or leak indicators should not wait for long retry windows
- flapping monitors should degrade to review-oriented handling if the service is otherwise stable
- maintenance windows must be documented before suppressing alerts
- no automatic rollback
- no automatic deploy stop without human evaluation unless a separate gate task explicitly requires a no-go decision

Suggested mapping:

- `SEV1`: API outage, public widget loader failure, public DNS failure, safe config failure with sustained impact
- `SEV2`: dashboard degradation, widget metadata failure, certificate threshold breach without current outage
- `SEV3`: noisy intermittent warnings, non-blocking drift investigation, review-only operational signals

## Relationship To Existing SRE Docs

- `SRE-1A` defines the monitoring and alerting baseline and gaps.
- `SRE-1B` defines routing roles, severity expectations, and route placeholders.
- `SRE-1C` defines incident classification, ownership, escalation, and rollback decision flow.
- `SRE-1D` defines the provider-neutral external uptime monitor taxonomy.
- `SRE-1E` defines how safe monitor evidence should be consumed in pilot review routines.
- `SRE-1F` defines the later minimal external monitor setup scope and acceptance criteria.

Related process boundaries:

- Docker fallback gate remains a build gate, not a deploy.
- Security diff scan remains a review gate, not a test replacement.
- `DB_READ_ONLY_AUDIT` remains blocked without human approval.

## Acceptance Criteria For Real Setup Follow-up

A future implementation task may start only when all of the following are true:

- this setup plan is merged
- a provider is selected
- alert destinations are planned as secret-managed targets
- no real secrets are committed to the repository
- pilot owner roles are confirmed
- the safe test site is confirmed for synthetic use
- no-go criteria are accepted in advance

For safe synthetic implementation specifically:

- a separate explicit approval exists
- the smoke does not cause delivery, integration, or customer-facing side effects
- output remains metadata-only

## Recommended Follow-up

Recommended next step:

- `SRE-1G Minimal Alert Integration Plan`

Alternative next step:

- `SRE-2A Backup Restore Drill Plan`

If real implementation is later requested:

- `SRE-1F-IMPL Minimal External Monitor Setup Execution`

But only with:

- explicit approval
- provider selection
- secret management outside the repo
- no customer site mutation
- no DB access
- no SQL
- no deploy bundled into the monitor setup task

## Stop Boundaries

This document explicitly does not:

- create monitors
- create alerts
- create external accounts
- store secrets
- execute health checks
- change production config
- deploy anything
- read any database
- execute SQL
- create query results or reports with data
- change public widget response behavior
- mutate customer sites

## Non-goals

- no implementation
- no external monitoring accounts
- no secret creation
- no alert delivery setup
- no deploy
- no DB access
- no SQL
- no runtime change
- no workflow change
- no customer data handling
