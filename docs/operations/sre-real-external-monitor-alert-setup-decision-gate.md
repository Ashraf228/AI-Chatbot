# SRE Real External Monitor / Alert Setup Decision Gate

Stand: 2026-07-23

## Summary

This document is a documentation-only decision gate for any later real external monitor and alert setup for Enterprise Pilot operations.

Purpose:

- confirm the current SRE, enterprise, and security documentation baseline
- decide whether any real external monitor setup is approved now
- decide whether any real alert setup is approved now
- define the minimum evidence and approvals required before any later implementation task may begin

This step is intentionally `DOKU_ONLY`.

This decision gate does not:

- set up monitors
- set up alerts
- create or use monitoring provider accounts
- create webhook, email, chat, or pager destinations
- test webhooks, email alerts, or pager routes
- execute health checks
- read production logs
- change production config
- deploy anything
- read any database
- execute SQL
- use a query runner
- generate reports
- document real target URLs, contact data, secrets, or tokens

Current position:

- no real setup was performed
- no monitoring accounts were created
- no monitors were created
- no alerts were created
- no webhooks were tested
- no real target URLs were documented
- no real contacts were documented
- no secrets were documented
- no production config was changed
- no deploy was performed
- no healthchecks were executed by this task
- no production logs were reviewed by this task

## Current Baseline

The documented baseline inherited into this gate is:

- `SRE-1B` alert routing design exists
- `SRE-1C` incident response runbook exists
- `SRE-1D` external uptime monitor design exists
- `SRE-1E` pilot health review checklist exists
- `SRE-1F` minimal external monitor setup plan exists
- `ENT-SEC-1A` enterprise security gap audit exists
- `ENT-SEC-1B` enterprise pilot go/no-go decision exists
- `enterprise-sre-security-readiness-audit` exists
- production-context audit baseline is documented `PASS`
- no open High/Critical production-context blocker is currently documented
- `body-parser`, `sharp`, and `next` production blockers are documented as resolved or mitigated
- `postcss` remains only `moderate`
- `production-health-synthetic` remains the approved safe config-level signal
- safe public widget smoke remains an approved bounded signal
- real external monitoring is still not operationally proven
- real alert routing is still not operationally proven
- broad enterprise rollout remains `no`
- limited pilot remains `conditional_with_guardrails`

## Decision Summary

- `real_external_monitor_setup_approved`: `no`
- `real_alert_setup_approved`: `no`
- `monitoring_provider_account_setup_approved`: `no`
- `alert_destination_setup_approved`: `no`
- `webhook_integration_approved`: `no`
- `email_alert_integration_approved`: `no`
- `pager_integration_approved`: `no`
- `production_config_change_approved`: `no`
- `deploy_approved`: `no`
- `customer_site_monitoring_approved`: `no`
- `safe_synthetic_widget_chat_smoke_approved`: `no`

Human approval status:

- `human_approval_status`: `not_granted`

## Current Preconditions Review

| Precondition | Current Status | Decision |
| --- | --- | --- |
| `SRE-1B` alert routing design exists | yes | green |
| `SRE-1C` incident response runbook exists | yes | green |
| `SRE-1D` external uptime monitor design exists | yes | green |
| `SRE-1E` pilot health review checklist exists | yes | green |
| `SRE-1F` minimal external monitor setup plan exists | yes | green |
| `ENT-SEC-1B` enterprise pilot go/no-go decision exists | yes | green |
| monitor provider selected | not documented here | blocked |
| monitoring account available | not documented here | blocked |
| alert destinations approved | not granted | blocked |
| real contact or on-call owners named | not proven in repo-safe form | blocked |
| escalation owner named | role model only | blocked |
| privacy or security owner review completed for real setup | not granted | blocked |
| production-safe monitor target list approved | not granted | blocked |
| safe synthetic site approved for external automation | not granted for this task | blocked |
| no-customer-data synthetic scope approved | not granted for this task | blocked |
| secret or token handling approved | not granted | blocked |
| production config change approved | not granted | blocked |
| maintenance or test window approved | not granted | blocked |
| rollback or disable plan approved | not granted | blocked |

## Monitor Setup Decision Matrix

| Candidate Monitor | Current Direction | Decision Basis |
| --- | --- | --- |
| API health | future candidate | public secret-free target, but no real setup approved now |
| Dashboard health | future candidate | public secret-free target, but no real setup approved now |
| Widget loader reachability | future candidate | public asset reachability is acceptable in principle, but no real setup approved now |
| Widget bundle metadata | future candidate | metadata-only target is acceptable in principle, but no real setup approved now |
| Widget config safe synthetic | future candidate | safe config signal exists, but no real setup approved now |
| TLS certificate expiry | future candidate | public TLS monitoring is acceptable in principle, but no real setup approved now |
| DNS resolution | future candidate | public DNS monitoring is acceptable in principle, but no real setup approved now |
| production health synthetic | future candidate | existing safe signal, but no external implementation approved now |
| safe widget chat smoke | separate explicit approval required | bounded synthetic path only, still `not approved` |
| customer-site monitoring | blocked | customer-facing site mutation or customer data risk must stay closed |
| admin or dashboard login synthetic | blocked | identity, test account, and security review not approved |
| webhook delivery monitor | blocked | delivery side effects and destination control not approved |
| email delivery monitor | blocked | delivery side effects and real routing not approved |
| database direct monitor | blocked | no DB reads, no production DB query path |
| Redis direct monitor | blocked | no direct internal-state or infrastructure read path approved |

Default direction:

- safe external HTTP, TLS, and DNS checks are only future candidates
- safe widget chat smoke requires a separate explicit approval
- customer-site monitoring stays blocked
- webhook and email delivery monitoring stay blocked
- direct DB and Redis monitoring stay blocked

## Alert Setup Decision Matrix

| Candidate Route / Integration | Current Direction | Decision Basis |
| --- | --- | --- |
| SRE owner channel | placeholder only | no real route approved |
| incident commander channel | placeholder only | no real route approved |
| security or privacy escalation | placeholder only | no real route approved |
| customer communication owner path | placeholder only | no real route approved |
| deploy owner path | placeholder only | no real route approved |
| backup or restore owner path | placeholder only | no real route approved |
| dashboard owner path | placeholder only | no real route approved |
| API owner path | placeholder only | no real route approved |
| widget owner path | placeholder only | no real route approved |
| external pager route | blocked | pager integration not approved |
| email route | blocked | email integration not approved |
| webhook route | blocked | webhook integration not approved |
| chat or ops route | placeholder only | no real route approved |

Routing defaults:

- role placeholders may stay documented
- no real contact information belongs in the repository
- no external pager, webhook, or email integration is approved without explicit human approval

## Allowed Future Setup Candidate

Documented future candidate only:

- name: `SRE-1G-EXEC Minimal External Monitor / Alert Setup`
- scope: provider-neutral or separately approved provider setup
- inputs: approved safe monitor URLs only
- alert mapping: approved placeholder-to-real route mapping outside the repository or in secure configuration only
- secrets: no secrets in the repository
- data handling: no customer data, no customer-site mutation, no real customer contact data in the repository
- DB surface: no `DB_READ_ONLY_AUDIT`, no SQL, no query runner, no reports
- deploy coupling: no deploy unless separately approved
- production config coupling: no production config change unless separately approved
- delivery integrations: no webhook, email, or pager integration without explicit approval
- synthetic scope: safe widget chat smoke only if separately approved
- side effects: no delivery side effects

This candidate is not approved by this document.
It is only documented as the smallest later setup option.

## Explicit Approval Format For Future Setup

Any later setup task requires a separate explicit human approval in substance equivalent to:

```text
Ich gebe SRE-1G-EXEC Minimal External Monitor / Alert Setup frei, ausschliesslich fuer genehmigte sichere externe HTTP/TLS/DNS- und ggf. safe-synthetic-Ziele, ohne Kundensites, ohne Kundendaten, ohne Secrets im Repo, ohne webhook/email/pager tests ohne separate Freigabe, ohne Production-Config-Aenderung ohne separate Freigabe und ohne Deploy ohne separate Freigabe.
```

This example text is not an approval.

Current state:

- `human_approval_granted`: `no`

## Approval Status Matrix

| Approval Area | Current Status |
| --- | --- |
| `monitoring_provider_approval` | `not_granted` |
| `monitoring_account_approval` | `not_granted` |
| `alert_destination_approval` | `not_granted` |
| `on_call_owner_approval` | `not_granted` |
| `incident_owner_approval` | `not_granted` |
| `privacy_owner_review` | `not_granted` |
| `security_owner_review` | `not_granted` |
| `production_config_change_approval` | `not_granted` |
| `secret_handling_approval` | `not_granted` |
| `safe_synthetic_site_approval` | `not_granted` |
| `customer_site_monitoring_approval` | `not_granted` |
| `webhook_integration_approval` | `not_granted` |
| `email_integration_approval` | `not_granted` |
| `pager_integration_approval` | `not_granted` |
| `deploy_approval` | `not_granted` |

## Data And Side-Effect Guardrails

The following boundaries remain closed:

- no customer data
- no PII-bearing payloads
- no real customer sites
- no lead creation
- no ticket creation
- no `email_jobs` mutation
- no `webhook_jobs` mutation
- no `report_runs` mutation
- no query runner
- no reports
- no backup or restore execution
- no delivery side effects
- safe synthetic only if explicitly approved
- no secrets in monitor URLs
- no tokens in docs
- no alert target URLs in docs

## Command And Tool Envelope Decision

Potentially allowed only in a future explicitly approved setup task:

- provider UI or API creation of approved uptime monitors
- adding approved alert destinations in provider configuration
- dry validation of approved monitor response status
- documenting monitor IDs without secrets
- documenting route labels without contact data

Still forbidden now:

- provider account creation
- monitor creation
- alert destination creation
- webhook test
- email test
- pager test
- production config edit
- deploy
- DB reads or writes
- SQL
- query runner
- report generation
- customer-site mutation
- secret or token output
- publication of real contact information

## Evidence Required Before Future Setup

Before any later execution task may begin, all of the following must be available:

- explicit human approval text
- selected monitor provider
- named account owner
- approved monitor inventory
- approved target URL classification
- no-secret URL review
- safe synthetic site approval, if synthetic scope is included
- approved alert route owner
- contact handling location outside the public repository
- escalation mapping
- incident severity mapping
- disable or pause plan
- false-positive handling plan
- maintenance window or test window
- validation plan
- rollback or disable plan
- evidence retention candidate

## Incident And Routing Integration

This gate reuses existing sources:

- `SRE-1B` is the alert routing design source
- `SRE-1C` is the incident response source

Implications for future setup:

- `SEV0` and `SEV1` security or privacy alerts must route to the security and privacy owner path
- deploy-related alerts require a deploy owner path
- customer communication must not be automatic from monitor alerts
- a monitor alert does not equal incident closure
- false positives require human review
- no auto-rollback is approved
- no auto-deploy-stop is approved without human decision

## Pilot Go/No-Go Impact

This gate improves readiness by making real setup requirements explicit.

This gate approves no real setup.

Current impact:

- external monitoring and alerting remains `P0` before active enterprise outreach
- limited pilot remains `conditional_with_guardrails`
- broad enterprise rollout remains `no`
- any real customer pilot still requires owner, contact, routing, and monitoring acceptance or equivalent `P0` closure

## Relationship To Existing Documents

- `SRE-1B` = alert routing design
- `SRE-1C` = incident response runbook
- `SRE-1D` = external uptime monitor design
- `SRE-1F` = minimal external monitor setup plan
- `ENT-SEC-1B` = enterprise pilot go/no-go decision
- `SRE-1G` = real external monitor / alert setup decision gate
- `SRE-1G-EXEC` = separate future execution task only

## Stop Boundaries

This decision gate does not cross any implementation boundary.

- no monitors set up
- no alerts set up
- no provider accounts created
- no webhooks tested
- no emails sent
- no pager triggered
- no DB read
- no SQL
- no query runner
- no reports
- no healthchecks executed
- no production logs reviewed
- no production config changes
- no deploy
- no public widget response change
- no customer-site mutation
- no real contact information documented
- no real alert target URLs documented
- no secrets or tokens documented
- no unrestricted enterprise approval granted

## Non-goals

This step is not:

- provider selection implementation
- account creation
- monitor creation
- alert creation
- webhook setup
- pager setup
- email setup
- deploy work
- production config work
- DB or SQL work
- report generation
- customer data handling
- secret management implementation
- unrestricted enterprise release approval

## Recommended Next Step

Recommended next step:

- `SRE-1G-EXEC Minimal External Monitor / Alert Setup`, only with explicit approval

Viable alternatives:

- `SRE-2F Production Backup Verification Decision Gate`
- `ENT-SEC-1C Enterprise Pilot Control Plan`

If no real monitoring setup is desired yet:

- `ENT-SEC-1C Enterprise Pilot Control Plan`
