# Enterprise Demo Talk Track

## Summary

This document defines a DOKU_ONLY enterprise demo talk track for internal walkthroughs and tightly scoped customer-facing discussions. It does not approve a real customer pilot, broad enterprise rollout, active enterprise outreach, customer data use, production data use, production secret use, DB access, SQL execution, query execution, report generation, export execution, backup verification execution, monitor or alert setup, or any deploy.

This document does not execute a demo, generate screenshots, create recordings, change runtime behavior, change workflows, change scripts, change production configuration, or claim final legal, privacy, or enterprise-security approval. The current security baseline remains PASS only with a scoped temporary Next/PostCSS exception. That exception is accepted temporarily, not fixed, and does not grant production deploy or customer-data approval.

## Talk Track Decision Summary

- `enterprise_demo_talk_track_created: yes`
- `internal_product_walkthrough_talk_track: allowed`
- `safe_demo_without_customer_data_talk_track: allowed_with_guardrails`
- `synthetic_only_feature_preview_talk_track: allowed_with_guardrails`
- `safe_test_internal_tenant_talk_track: conditional`
- `customer_facing_enterprise_talk_track: conditional_with_caveats`
- `real_customer_pilot_talk_track: blocked`
- `broad_enterprise_rollout_talk_track: blocked`
- `customer_data_use: no`
- `production_data_use: no`
- `production_secret_use: no`
- `DB_READ_ONLY_AUDIT: not_granted`
- `query_runner: not_granted`
- `reports_with_data: not_granted`
- `DSAR_execution: not_granted`
- `export_execution: not_granted`
- `backup_verification_execution: not_granted`
- `monitor_alert_setup: not_granted`
- `deploy_required_by_this_talk_track: no`

## Audience / Demo Mode Matrix

| Audience | Demo Mode | Current Status | Required Caveat | Blocked Claims |
| --- | --- | --- | --- | --- |
| Internal engineering | Architecture and control walkthrough | Allowed | Synthetic/generic framing only; no execution rights follow from the walkthrough. | No deploy, no DB audit execution, no customer-data usage claims. |
| Internal product / sales | Product value and safe-preview narrative | Allowed with guardrails | Preview scope only; no active enterprise outreach approval is implied. | No broad rollout, no pilot approval, no legal/compliance completion claim. |
| Internal leadership | Readiness and blocker review | Allowed with guardrails | Staged readiness only; unresolved approvals and scoped exception must be named. | No "enterprise ready now" or "risk-free" claim. |
| Customer-facing non-technical | Scoped product preview | Conditional with caveats | Synthetic-only content, no customer data, no production data, no rollout approval. | No customer-ready, pilot-ready, or deploy-ready statement. |
| Customer-facing technical / security | Architecture and governance review | Conditional with caveats | Temporary Next/PostCSS exception and all not-granted areas must be disclosed. | No DB/SQL/query runner/report/export/backup/monitor approval claim. |
| Procurement / security review | Control and evidence narrative | Allowed with guardrails | Documentation posture only; no execution proof beyond documented statuses. | No claim that all operational controls are fully live or complete. |
| Real-customer pilot audience | Pilot or rollout-facing session | Blocked | Separate explicit approval would be required before any such session. | All pilot, rollout, customer-data, and production-data claims remain blocked. |

## Opening Caveat Script

> This is a scoped product preview based on synthetic or generic content. It is not a rollout approval, not a real-customer pilot approval, and not an approval to use customer data, production data, or production secrets. No deploy, DB read, SQL execution, query runner, report generation, DSAR execution, export execution, backup verification, or monitor setup is being performed here. The current security baseline is green only with a scoped temporary Next/PostCSS exception. That issue is accepted temporarily, not fixed, and still requires a stable upstream upgrade. Legal, DSGVO, and final enterprise approval remain incomplete.

## Core Demo Narrative

### Problem statement

- Allowed message: The product aims to provide controlled conversational assistance with clear operational and security boundaries.
- Caveat: The current enterprise posture is phased and partially gated.
- Forbidden statement: "This is already fully enterprise-ready for any customer rollout."

### Product value proposition

- Allowed message: The platform can support safe, synthetic feature walkthroughs for chatbot, dashboard, and governance concepts.
- Caveat: Demonstrated value is limited to approved preview scope.
- Forbidden statement: "All enterprise controls are already operational in production."

### Enterprise readiness posture

- Allowed message: Readiness is being advanced through explicit design, audit, approval, and boundary documents.
- Caveat: Several execution-heavy domains remain deliberately deferred or blocked.
- Forbidden statement: "Security, privacy, and operations are fully complete."

### Safe data boundary

- Allowed message: Demo content must stay synthetic, generic, or otherwise non-customer and non-production.
- Caveat: No customer records, production logs, or production secrets may be used.
- Forbidden statement: "We can safely use real customer data in the demo."

### Synthetic widget flow narrative

- Allowed message: The widget can be described as a synthetic preview of the end-user chat experience.
- Caveat: This talk track does not execute public widget tests or customer-site mutations.
- Forbidden statement: "This reflects an approved live customer-site deployment."

### Synthetic dashboard / admin narrative

- Allowed message: The dashboard/admin experience can be described at a conceptual level using synthetic examples.
- Caveat: No admin login with customer data, no production-data walk, and no live production demonstration are approved here.
- Forbidden statement: "This is a live customer operations dashboard."

### Security / readiness governance narrative

- Allowed message: The program uses staged approvals, scoped exceptions, explicit stop criteria, and post-merge verification gates.
- Caveat: A scoped temporary Next/PostCSS exception remains open.
- Forbidden statement: "There are no remaining security gaps."

### Current blockers / not granted areas

- Allowed message: DB reads, SQL, query runners, data reports, DSAR execution, backup verification, monitor setup, and real-customer pilots remain not granted.
- Caveat: Some of these areas have planning or decision-gate documentation, but no execution approval.
- Forbidden statement: "These are approved but simply not demoed today."

### Next steps

- Allowed message: Next steps are explicit follow-up tasks and approvals, not implied execution rights.
- Caveat: Future execution requires separate approval and may still fail technical or policy gates.
- Forbidden statement: "The remaining steps are only minor formalities."

## Segment 1: Product / Use Case Overview

- Describe the product as a controlled conversational platform with widget, dashboard, and governance surfaces.
- Emphasize synthetic preview usage and scoped learning/demo intent.
- Do not imply live customer usage, customer-specific tuning, or approved production expansion.

## Segment 2: Architecture Overview

- Describe high-level boundaries between API, widget, dashboard, security checks, and documentation-driven approval gates.
- Describe tenant/site separation only as a conceptual boundary, not as a demonstrated live production control proof.
- Mention that runtime-unwired boundaries were intentionally introduced before any future execution decisions.
- Do not describe any customer-specific integration, production DB access path, or unapproved query capability as operational.
- Do not claim live production API calls, integration credentials, provider tokens, real webhooks, or SMTP flows.

## Segment 3: Synthetic Widget Flow

- Walk through a synthetic end-user conversation example at a narrative level.
- State that the widget response shape and public behavior are discussed conceptually, not changed by this document.
- State explicitly that no smoke test is executed by this talk track.
- Do not expose debug, preview, knowledge, delivery, or secret fields.
- Do not claim a live customer-site demo, a real external monitor, approved real traffic validation, or real lead/ticket/email/webhook side effects.

## Segment 4: Synthetic Dashboard / Admin Flow

- Explain the dashboard/admin surface as an internal control and review plane using synthetic examples only.
- Keep discussion at feature and process level, not live production administration.
- Do not claim live production access, customer-record inspection, operational alert handling, query runner availability, reports with data, admin mutation rights, or feature-flag/config mutation.
- Do not present a live admin login demo unless separately approved.

## Segment 5: Security / Governance Posture

- State that the security baseline is currently green only with a scoped temporary exception for Next-internal PostCSS.
- Explain that the exception is narrow, time-bounded, and not a broad suppression.
- State that no deploy approval, customer-data approval, or enterprise rollout approval follows from that exception alone.

## Segment 6: Privacy / DSGVO Posture

- State that DSGVO, DSAR, export, retention, deletion, and execution-sensitive areas are being handled through staged design and decision-gate documents.
- State clearly that no DSAR execution, no export execution, and no customer-data processing approval is granted by this talk track.
- Do not imply final legal sign-off or operational privacy execution readiness.

## Segment 7: SRE / Operations Posture

- State that monitoring, alert routing, incident response, backup planning, and verification have been documented in staged form.
- State clearly that real alert setup, backup verification execution, restore execution, and customer-site monitoring remain separate execution scopes.
- State that this talk track does not execute production healthchecks, does not read production logs, and does not inspect backup metadata or backup content.
- Do not imply that operational setup is fully live or customer-ready where approvals are still pending.

## Segment 8: Current Blockers / Not Granted

- `real_customer_pilot: blocked`
- `broad_enterprise_rollout: blocked`
- `active_enterprise_outreach: not_approved`
- `customer_data_use: blocked`
- `production_data_use: blocked`
- `DB_READ_ONLY_AUDIT: not_granted`
- `query_runner: not_granted`
- `reports_with_data: not_granted`
- `DSAR_execution: not_granted`
- `export_execution: not_granted`
- `backup_verification_execution: not_granted`
- `monitor_alert_setup: not_granted`
- `deploy: not_granted_by_this_document`
- `final legal/privacy/compliance approval: not_granted`

## Closing Script

> The safe takeaway is that the product can be discussed and previewed within a synthetic, tightly governed enterprise-demo scope. It is not yet approved for real-customer pilot execution, customer data, production-data workflows, DB-backed audits, exports, backup verification, or broad rollout. The correct next step is to advance only the explicitly defined follow-up gates and approvals.

## Safe Q&A Answer Bank

### Is this enterprise ready?

Answer: It is partially prepared and well-documented, but not fully enterprise-ready for unrestricted customer use. Some preview discussions are allowed; several execution-sensitive areas remain blocked or conditional.

### Can we use real customer data?

Answer: No. This talk track does not approve customer data, production data, or production secrets.

### Can we run this with a customer pilot?

Answer: Not yet. Real-customer pilot scope remains blocked pending further approvals and readiness work.

### Is DSGVO compliance complete?

Answer: No final DSGVO completion claim is allowed here. Privacy and DSAR-related areas have design and decision-gate work, but execution approval is not granted.

### Is the security audit green?

Answer: The current production-context baseline is green only with a scoped temporary Next/PostCSS exception. That should be described precisely, not as a fully fixed state.

### What does the Next/PostCSS exception mean?

Answer: A narrow accepted exception exists for the Next-internal PostCSS dependency path in the dashboard production dependency context. It is temporary, scoped, and does not broaden deploy or customer-use approval.

### Is the PostCSS issue fixed?

Answer: No. It is accepted temporarily, not fixed. A stable upstream upgrade is still required.

### Can we deploy now?

Answer: This talk track does not grant deploy approval. Deploy decisions remain separate.

### Are backups verified?

Answer: No backup verification execution is approved or claimed by this talk track.

### Is monitoring / alerting operational?

Answer: Monitoring and alerting design work exists, but real setup or operational proof is not granted by this talk track.

### Can DSAR exports be executed?

Answer: No. DSAR execution and export execution remain not granted.

### Can we show reports?

Answer: Not reports with real data. This talk track allows only synthetic or generic descriptive framing.

### Can we connect to customer systems?

Answer: No such approval is granted here.

### Can we record the demo?

Answer: No recording approval is granted by this document. Treat recording as out of scope unless separately approved.

### Can we show screenshots?

Answer: No screenshot generation or screenshot-based evidence is created by this document.

### Can we mention NOLIS?

Answer: No NOLIS-specific logic, hardcoding, or customer-specific framing should be introduced.

## Allowed Claims

- The product can be discussed through a scoped enterprise demo talk track.
- Synthetic-only feature preview is allowed with guardrails.
- Security, privacy, and operations readiness are being advanced through staged documentation and explicit gates.
- Governance docs are completed through `ENT-SEC-1F`, with this document adding the talk-track layer.
- Customer-facing enterprise demo posture is conditional with caveats, not broadly approved.
- Real-customer pilot, customer-data use, DB-backed audit execution, exports, backup verification, and monitor setup remain blocked or not granted.
- The production-context security baseline is currently PASS only with a scoped temporary Next/PostCSS exception.

## Forbidden Claims

- "This is production-ready for broad enterprise rollout."
- "This is approved for real customer pilots."
- "Active enterprise outreach is approved without caveats."
- "We can use customer data or production data."
- "DSGVO is fully complete and executed."
- "The PostCSS issue is fixed."
- "Monitoring, alerting, backups, and restore are fully operational."
- "DB audit, SQL, exports, reports, or query runner capabilities are approved."
- "This document itself proves deploy approval."

## Language Guardrails

### Allowed phrases

- "scoped preview"
- "synthetic example"
- "conditional with caveats"
- "not granted"
- "blocked pending follow-up approval"
- "accepted temporarily, not fixed"
- "documented, not executed"

### Forbidden phrases

- "enterprise-ready now"
- "customer-ready now"
- "production-approved"
- "fully compliant"
- "fully fixed"
- "pilot-approved"
- "rollout-approved"

## Demo Stop Criteria

Stop the talk immediately if any participant requests or assumes:

- real customer data
- production data
- production secrets
- live production admin access
- DB reads
- SQL execution
- query runner usage
- reports with data
- DSAR execution
- export execution
- backup verification execution
- real alert setup
- customer-specific commitments about rollout or pilots
- any statement that the temporary Next/PostCSS exception means the issue is fixed

## Demo Asset Rules

- Use only synthetic, generic, or already-approved non-customer content.
- Do not create or show data reports with real records.
- Do not create CSV, JSON, or ZIP exports.
- Do not generate new screenshots or recordings under this document scope.
- Do not use real contact information, customer names, or production identifiers.
- Do not use secrets, tokens, production logs, reports with data, query results, or customer domains unless separately approved.
- Separate approval is required for any future storage or retention of demo assets.

## Relationship to Existing Docs

- `docs/security/enterprise-demo-scope-pack.md` defines the broader demo-scope boundaries.
- `ENT-SEC-1F` is the Enterprise Demo Scope Pack baseline.
- `ENT-SEC-1G` is this Enterprise Demo Talk Track.
- `ENT-SEC-1E` is the Readiness Summary refresh.
- `ENT-SEC-1D` is the Evidence Review Cadence.
- `ENT-SEC-1C-HARDENING` is the Control Evidence Checklist.
- `ENT-SEC-1C` is the Control Plan.
- `ENT-SEC-1B` is the Go/No-Go Decision.
- `P0-Security-Audit-Drift-4E-POLICY` is the scoped temporary Next/PostCSS exception reference.
- `SRE-1G` is the Monitor / Alert Setup Decision Gate.
- `SRE-2F` is the Production Backup Verification Decision Gate.
- `DSGVO-1H` is the DSAR Export Implementation Plan.
- `docs/security/enterprise-pilot-readiness-summary-refresh.md` summarizes staged readiness posture.
- `docs/security/enterprise-pilot-evidence-review-cadence.md` frames evidence review expectations.
- `docs/operations/enterprise-sre-security-readiness-audit.md` provides operational/security readiness context.
- Privacy, SRE, and export-related decision-gate docs remain authoritative for their execution-sensitive domains.

## Recommended Next Step

- `ENT-SEC-1G-D` for PR review and merge
- After completion: `ENT-SEC-1H Enterprise Demo FAQ / Objection Handling`
- Only with explicit approval and separate execution scope: `SRE-1G-EXEC`
- Only with explicit approval and separate execution scope: `SRE-2F-EXEC`
- Only with explicit approval and separate execution scope: `DSGVO-1H-EXEC`

## Stop Boundaries

- Dieser Talk Track ist nur Dokumentation.
- Dieser Talk Track fuehrt keine Demo aus.
- Dieser Talk Track erzeugt keine Screenshots.
- Dieser Talk Track erzeugt keine Recordings.
- Dieser Talk Track aendert keine Runtime.
- Dieser Talk Track aendert keine Workflows.
- Dieser Talk Track aendert keine Scripts.
- Dieser Talk Track fuehrt keine DB Reads oder Writes aus.
- Dieser Talk Track fuehrt kein SQL aus.
- Dieser Talk Track verwendet keinen Query Runner.
- Dieser Talk Track erzeugt keine Query Results oder Reports mit Daten.
- Dieser Talk Track fuehrt keine DSAR-Ausfuehrung aus.
- Dieser Talk Track fuehrt keinen Export aus.
- Dieser Talk Track erzeugt keine JSON-, CSV- oder ZIP-Exportdatei.
- Dieser Talk Track fuehrt keine Loeschung aus.
- Dieser Talk Track fuehrt keine Korrektur aus.
- Dieser Talk Track fuehrt keine Retention-Aktion aus.
- Dieser Talk Track fuehrt keine Backup-Verifikation aus.
- Dieser Talk Track oeffnet keine Backups, Dumps oder Exports.
- Dieser Talk Track richtet kein Monitoring und keine Alerts ein.
- Dieser Talk Track fuehrt keinen Deploy aus.
- Dieser Talk Track liest keine Secrets.
- Dieser Talk Track fuehrt keine Production-Abfragen aus.
- Dieser Talk Track fuehrt keine Healthchecks aus.
- Dieser Talk Track fragt keine Production Logs ab.
- Dieser Talk Track aendert keine Production Config.
- Dieser Talk Track enthaelt keine Secrets und keine realen personenbezogenen Daten.
- Dieser Talk Track dokumentiert keine Kundendaten.
- Dieser Talk Track dokumentiert keine echten Kontakte.
- Dieser Talk Track gibt keine DSGVO-Konformitaet frei.
- Dieser Talk Track gibt keine reale Pilotfreigabe.
- Dieser Talk Track gibt keine Enterprise-Freigabe.
- Dieser Talk Track gibt keine Deploy-Freigabe.
- Dieser Talk Track erteilt keine Pilot-, Rollout-, Deploy-, DB-, Query-, Export- oder Compliance-Freigabe.
- Dieser Talk Track behauptet nicht, dass Next/PostCSS bereits behoben ist.

## Non-goals

- No runtime change
- No workflow hardening
- No script hardening
- No package update
- No deploy approval
- No enterprise rollout approval
- No real-customer pilot approval
- No privacy execution approval
- No DB audit execution approval
- No backup, restore, monitoring, or alert execution approval
