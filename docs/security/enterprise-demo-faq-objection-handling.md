# Enterprise Demo FAQ / Objection Handling

## Summary

This document defines a DOKU_ONLY Enterprise Demo FAQ / Objection Handling guide for internal and tightly caveated customer-facing discussions. It provides safe answers, forbidden answers, and escalation points for common enterprise-demo questions without executing a demo, generating screenshots, generating recordings, changing runtime behavior, changing workflows, changing scripts, changing production configuration, reading any database, executing SQL, using a query runner, producing reports, producing exports, verifying backups, setting up monitoring or alerting, or performing any deploy.

This document does not approve a real-customer pilot, active enterprise outreach without caveats, broad enterprise rollout, customer-data use, production-data use, production-secret use, DSAR execution, export execution, deletion or retention execution, backup verification, monitor setup, alert setup, or final legal, privacy, security, or enterprise approval. The current production-context audit remains PASS only with a scoped temporary Next/PostCSS exception. That finding is accepted temporarily, not fixed, expires on `2026-08-06`, and still requires a stable Next upgrade.

## FAQ Decision Summary

- `enterprise_demo_faq_created: yes`
- `internal_demo_faq_use: allowed`
- `safe_demo_faq_use: allowed_with_guardrails`
- `customer_facing_faq_use: conditional_with_caveats`
- `real_customer_pilot_faq_use: blocked_without_explicit_acceptance`
- `broad_rollout_faq_use: blocked`
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
- `deploy_required_by_this_faq: no`

## FAQ Use Boundary

- This FAQ is only a talk and answer aid.
- This FAQ executes no demo.
- This FAQ does not replace legal approval.
- This FAQ does not replace security approval.
- This FAQ does not replace enterprise approval.
- This FAQ does not replace deploy approval.
- Customer-facing use is allowed only with caveats.
- If an answer is uncertain, use `requires explicit approval` and stop scope expansion.

## Mandatory Caveat for Customer-Facing Answers

### English

> This is a scoped Enterprise demo discussion. It does not approve enterprise rollout, real-customer pilot, customer-data use, production-data use, or deploy. The current production-context audit is PASS with a scoped temporary Next/PostCSS exception. That finding is accepted temporarily, not fixed, and a stable Next upgrade remains required.

### German

> Dies ist eine begrenzte Enterprise-Demo-Besprechung. Sie erteilt keine Freigabe fuer Enterprise-Rollout, Real-Customer-Pilot, Kundendaten, Production-Daten oder Deploy. Der aktuelle production-context audit ist PASS mit einer exakt gescopten temporaeren Next/PostCSS-Exception. Der Befund ist temporaer akzeptiert, nicht gefixt; ein stabiler Next-Upgrade bleibt erforderlich.

## FAQ Answer Format

Use this format for every answer:

- `Question:`
- `Safe answer:`
- `Required caveat:`
- `Do not say:`
- `Escalate / stop if:`

## Enterprise Readiness FAQ

### Question: Is this enterprise ready?

- Safe answer: It is not accurate to call the system fully enterprise-ready. Internal walkthroughs and safe demos without customer data are allowed with guardrails. Customer-facing discussion is only conditional with caveats.
- Required caveat: No enterprise rollout, real-customer pilot, customer-data use, or deploy approval is granted by this FAQ.
- Do not say: "Yes, this is enterprise-ready now."
- Escalate / stop if: the audience asks for rollout readiness, customer-data handling, or pilot approval.

### Question: Are we approved for enterprise rollout?

- Safe answer: No. Broad rollout remains blocked.
- Required caveat: Separate enterprise approval and deploy approval would be required.
- Do not say: "The demo proves rollout approval."
- Escalate / stop if: the stakeholder wants rollout commitment language.

### Question: Can we start active enterprise outreach?

- Safe answer: Active enterprise outreach is not approved by this FAQ alone.
- Required caveat: Customer-facing use is conditional and must stay caveated.
- Do not say: "Yes, sales can position this as enterprise-approved."
- Escalate / stop if: the caveat is rejected or removed.

### Question: Can we run a real-customer pilot?

- Safe answer: No. Real-customer pilot remains blocked without explicit acceptance.
- Required caveat: No customer-data approval or production-data approval exists here.
- Do not say: "A pilot can start after this demo."
- Escalate / stop if: any request includes real customer data or live customer execution.

### Question: What is currently allowed?

- Safe answer: Internal demo FAQ use is allowed. Safe demo use without customer data is allowed with guardrails. Synthetic-only feature preview is allowed with guardrails.
- Required caveat: All allowed usage remains synthetic, generic, and non-production.
- Do not say: "Everything except deploy is allowed."
- Escalate / stop if: the answer needs customer-specific or production-specific scope.

### Question: What is conditional?

- Safe answer: Customer-facing FAQ use is conditional with caveats. Safe-test or internal-tenant narratives remain conditional and require separate safe-scope discipline.
- Required caveat: Conditional does not mean approved; it means caveated and bounded.
- Do not say: "Conditional means basically approved."
- Escalate / stop if: the conditional caveat cannot be included.

### Question: What is blocked?

- Safe answer: Real-customer pilot, broad rollout, customer-data use, production-data use, DB audit, query runner, reports with data, DSAR/export/deletion execution, backup verification, monitor/alert setup, and deploy remain blocked or not granted.
- Required caveat: Blocked areas require separate explicit approval.
- Do not say: "Only a few minor items are blocked."
- Escalate / stop if: a blocked area is requested in real time.

### Question: What does conditional_with_caveats mean?

- Safe answer: It means the topic may be discussed only if the safety caveats are included and no blocked execution or data claim is made.
- Required caveat: Conditional_with_caveats is not a release gate, pilot gate, or data-approval gate.
- Do not say: "It means the risk is gone."
- Escalate / stop if: the audience wants the caveat removed.

## Security Baseline FAQ

### Question: Is the security audit green?

- Safe answer: The current production-context audit is PASS with an exact scoped temporary Next/PostCSS exception.
- Required caveat: The exception must be disclosed when the security baseline is discussed.
- Do not say: "Security is fully resolved."
- Escalate / stop if: the audience requires a caveat-free security statement.

### Question: Why is audit PASS if PostCSS is not fixed?

- Safe answer: PASS is currently achieved because a narrow, exact-path exception was approved for the Next-internal PostCSS dependency path in the dashboard production dependency context.
- Required caveat: The finding is accepted temporarily, not fixed.
- Do not say: "PASS means the issue no longer matters."
- Escalate / stop if: the audience wants to treat PASS as a general high-severity waiver.

### Question: What does accepted temporarily mean?

- Safe answer: It means a specific risk is accepted for a limited time and scope under documented assumptions.
- Required caveat: The acceptance is exact-path scoped and time-bounded to `2026-08-06`.
- Do not say: "Accepted temporarily means permanently safe."
- Escalate / stop if: the audience wants to generalize the exception.

### Question: Does this exception weaken all security gates?

- Safe answer: No. It does not grant a blanket waiver. Non-excepted High/Critical findings remain blocking.
- Required caveat: Critical findings are not accepted by this exception.
- Do not say: "We can ignore future high findings now."
- Escalate / stop if: someone proposes a broader suppression.

### Question: Are other High/Critical findings still blocked?

- Safe answer: Yes. Other High/Critical findings remain blocking unless separately and explicitly handled.
- Required caveat: This FAQ does not create any new exception.
- Do not say: "The current exception covers similar findings too."
- Escalate / stop if: a broader advisory waiver is requested.

### Question: What happens at expiry?

- Safe answer: The exception must be revalidated before `2026-08-06`; otherwise the baseline cannot rely on it.
- Required caveat: Stable Next release review remains required before expiry.
- Do not say: "Expiry is only informational."
- Escalate / stop if: there is no revalidation owner or plan.

### Question: What happens when stable Next is released?

- Safe answer: The dependency path must be reviewed again and upgraded if the stable release resolves the internal PostCSS path.
- Required caveat: A stable Next upgrade remains required.
- Do not say: "We can stay on the old version indefinitely."
- Escalate / stop if: a stable fix exists but is being ignored.

## Next/PostCSS Exception FAQ

### Question: Is PostCSS fixed?

- Safe answer: No. It is not fixed.
- Required caveat: The current wording is `accepted temporarily, not fixed`.
- Do not say: "Yes, that issue is closed."
- Escalate / stop if: the audience expects a fixed-state assurance.

### Question: Why not upgrade now?

- Safe answer: At the documented decision point, no stable Next release with a fixed internal dependency path was accepted as a valid replacement.
- Required caveat: Stable upstream review remains mandatory.
- Do not say: "We simply chose not to fix it."
- Escalate / stop if: a new stable version may now exist and has not been reviewed.

### Question: Why not use canary?

- Safe answer: Canary is not accepted for this scope.
- Required caveat: Only stable releases are acceptable for this mitigation path.
- Do not say: "Canary would be fine for enterprise use."
- Escalate / stop if: someone wants to claim canary as a safe workaround.

### Question: Why not use npm audit fix --force?

- Safe answer: Forced upgrades were not accepted because they can create uncontrolled dependency drift and did not provide a sound stable-path resolution here.
- Required caveat: Blind force-upgrade behavior is outside the approved mitigation path.
- Do not say: "We could force it any time if needed."
- Escalate / stop if: someone wants to bypass dependency review discipline.

### Question: What is the actual scope?

- Safe answer: The exception applies only to `postcss` at `node_modules/next/node_modules/postcss` under `next@16.2.11` in the dashboard production dependency context.
- Required caveat: It is not a broad PostCSS or Next waiver.
- Do not say: "The whole dashboard stack is exempt."
- Escalate / stop if: the scope is widened beyond the documented path.

### Question: Is there runtime exposure?

- Safe answer: Current residual risk is documented as low under current assumptions, not zero.
- Required caveat: Low residual risk is not the same as no residual risk.
- Do not say: "There is no remaining risk."
- Escalate / stop if: runtime assumptions change.

### Question: What is residual risk?

- Safe answer: Residual risk remains low under current deployment assumptions and bounded styling scope, but it is not none.
- Required caveat: Current assumptions still require revalidation on relevant dependency and styling changes.
- Do not say: "Residual risk is gone."
- Escalate / stop if: custom CSS/theme/branding scope expands.

### Question: What triggers revalidation?

- Safe answer: Revalidation is triggered by a new stable Next release, expiry, dependency updates, CSS/theme/branding/custom CSS changes, and public widget styling pipeline changes.
- Required caveat: Revalidation is mandatory, not optional.
- Do not say: "Only expiry matters."
- Escalate / stop if: any trigger occurs.

## Customer Data / Production Data FAQ

### Question: Can we use real customer data?

- Safe answer: No.
- Required caveat: Customer-data use is not approved.
- Do not say: "Only a little customer data would be fine."
- Escalate / stop if: any real customer record is requested.

### Question: Can we show production data?

- Safe answer: No.
- Required caveat: Production-data use is not approved.
- Do not say: "Read-only production viewing is implied."
- Escalate / stop if: production data is requested for proof.

### Question: Can we show customer transcripts?

- Safe answer: No. Use synthetic examples only.
- Required caveat: No customer data, no real transcript evidence.
- Do not say: "We can anonymize live transcripts on the fly."
- Escalate / stop if: real transcript material is requested.

### Question: Can we show customer contacts?

- Safe answer: No. Real contact information is out of scope.
- Required caveat: No real contacts may be documented or shown.
- Do not say: "Placeholder masking is enough for real contact lists."
- Escalate / stop if: any real contact sheet is requested.

### Question: Can we show customer reports?

- Safe answer: No. Reports with data are not granted.
- Required caveat: Query results and reports with data remain blocked.
- Do not say: "A sample report from production is okay."
- Escalate / stop if: report evidence is requested.

### Question: Can we show production logs?

- Safe answer: No. Production logs are out of scope for this FAQ.
- Required caveat: This FAQ executes no production-log access.
- Do not say: "A few log lines are harmless."
- Escalate / stop if: production logs are requested.

### Question: Can we use customer domains?

- Safe answer: Not unless separately approved.
- Required caveat: Customer-specific examples require explicit approval.
- Do not say: "A customer domain in a slide is fine by default."
- Escalate / stop if: a real customer domain is proposed.

### Question: Can we use NOLIS-specific examples?

- Safe answer: No NOLIS-specific hardcoding or customer-specific claims should be introduced unless separately approved.
- Required caveat: Generic or synthetic framing should be used instead.
- Do not say: "NOLIS is the standard demo baseline."
- Escalate / stop if: customer-specific branding or promises are requested.

## DSGVO / Privacy FAQ

### Question: Is DSGVO compliance complete?

- Safe answer: DSGVO-related documents exist, but this FAQ does not claim final legal or compliance approval.
- Required caveat: No final DSGVO-conformity claim is granted here.
- Do not say: "Yes, DSGVO is fully complete."
- Escalate / stop if: formal legal sign-off is requested.

### Question: Can DSAR exports be executed?

- Safe answer: No. DSAR execution is not granted.
- Required caveat: Planning exists; execution approval does not.
- Do not say: "We can run DSAR export if asked."
- Escalate / stop if: a real DSAR request is raised.

### Question: Can deletion/retention actions be executed?

- Safe answer: No. Deletion and retention execution are not granted.
- Required caveat: No deletion, correction, or retention action is approved by this FAQ.
- Do not say: "The documented process means it is operational."
- Escalate / stop if: any real lifecycle action is requested.

### Question: Can we show a DSAR export?

- Safe answer: No. No export execution or real export output is approved.
- Required caveat: No JSON, CSV, or ZIP export file may be created or shown.
- Do not say: "A partial export sample is acceptable."
- Escalate / stop if: an export artifact is requested.

### Question: Can we use DB_READ_ONLY_AUDIT?

- Safe answer: No. `DB_READ_ONLY_AUDIT` is not granted.
- Required caveat: Any DB discovery path remains separately gated.
- Do not say: "Read-only audit is implicitly okay."
- Escalate / stop if: any database discovery step is requested.

### Question: Can we use Query Runner for privacy discovery?

- Safe answer: No. Query Runner is not granted.
- Required caveat: No query execution path is approved by this FAQ.
- Do not say: "Only internal query usage would be fine."
- Escalate / stop if: query execution is requested.

### Question: Can we show reports with personal data?

- Safe answer: No. Reports with data are not granted.
- Required caveat: Personal-data reporting remains blocked.
- Do not say: "Masked personal data is enough by default."
- Escalate / stop if: any report with real data is requested.

## SRE / Monitoring / Backup FAQ

### Question: Is monitoring operational?

- Safe answer: Monitoring and alerting decision-gate docs exist, but real monitor and alert setup is not granted.
- Required caveat: Operational proof is not claimed here.
- Do not say: "Yes, monitoring is fully live."
- Escalate / stop if: live monitoring proof is requested.

### Question: Are real alerts configured?

- Safe answer: No approved real alert setup is documented here.
- Required caveat: Real alert setup remains a separate execution scope.
- Do not say: "Alerting is already configured."
- Escalate / stop if: contact endpoints or alert routes are requested.

### Question: Are backups verified?

- Safe answer: No. Backup verification is not granted.
- Required caveat: Backup verification remains separately gated.
- Do not say: "Backups are verified."
- Escalate / stop if: proof of verification is requested.

### Question: Can we run backup verification?

- Safe answer: No. Backup verification execution is not granted.
- Required caveat: This FAQ performs no backup action.
- Do not say: "We can do that during or after the demo."
- Escalate / stop if: live backup checks are requested.

### Question: Can we access backup metadata?

- Safe answer: No. Backup metadata and backup content remain out of scope.
- Required caveat: No backup metadata/content access is granted here.
- Do not say: "Metadata access is harmless."
- Escalate / stop if: backup inventory details are requested.

### Question: Can we trigger a restore?

- Safe answer: No. Restore execution is not granted.
- Required caveat: No backup or restore execution is approved.
- Do not say: "Restore can be used as demo proof."
- Escalate / stop if: restore proof is requested.

### Question: What happens during incidents?

- Safe answer: Incident-response documentation exists, but this FAQ does not execute or prove a live incident path.
- Required caveat: Documentation existence is not the same as live operational proof.
- Do not say: "Incidents are fully covered operationally."
- Escalate / stop if: live incident drill evidence is requested.

## Deploy / Production Change FAQ

### Question: Can we deploy now?

- Safe answer: No deploy approval is granted by this FAQ.
- Required caveat: Deploy requires a separate deploy gate.
- Do not say: "The demo implicitly approves deploy."
- Escalate / stop if: deploy is requested.

### Question: Does this demo approve deploy?

- Safe answer: No.
- Required caveat: Demo discussion and deploy approval are separate decisions.
- Do not say: "Yes, if the audience is satisfied."
- Escalate / stop if: commercial approval is being converted into deploy approval.

### Question: Can we change Production config?

- Safe answer: No.
- Required caveat: Production config changes are out of scope.
- Do not say: "Only a small config tweak would be okay."
- Escalate / stop if: config mutation is requested.

### Question: Can we set feature flags?

- Safe answer: No feature-flag change is approved by this FAQ.
- Required caveat: No runtime toggle or config mutation is allowed here.
- Do not say: "Feature flags are non-production enough to ignore."
- Escalate / stop if: runtime flags are requested.

### Question: Can we run smoke tests?

- Safe answer: This FAQ itself runs no smoke tests and approves none.
- Required caveat: No healthchecks or smoke tests are approved by this document.
- Do not say: "We can run production-smoke proof after the meeting."
- Escalate / stop if: live smoke execution is requested.

### Question: Can we mutate customer sites?

- Safe answer: No customer-site mutation is approved.
- Required caveat: No real customer-site interaction without separate approval.
- Do not say: "A small customer-site tweak is fine."
- Escalate / stop if: customer-site mutation is requested.

## Widget / Dashboard / API Demo FAQ

### Question: Can we show widget flow?

- Safe answer: Yes, but only as a synthetic widget flow.
- Required caveat: No live customer widget interaction, no customer-site mutation, no real side effects.
- Do not say: "This is a live customer widget flow."
- Escalate / stop if: the flow depends on customer data or live traffic.

### Question: Can we show dashboard/admin?

- Safe answer: Yes, but only as a synthetic dashboard/admin walkthrough.
- Required caveat: No production tenant data, no real users, no reports with data, no admin mutation.
- Do not say: "This is the live customer operations view."
- Escalate / stop if: live admin access is requested.

### Question: Can we call the API live?

- Safe answer: No live production API call is approved by this FAQ.
- Required caveat: API discussion is conceptual unless separately approved.
- Do not say: "A live API call is fine for proof."
- Escalate / stop if: any live production API request is proposed.

### Question: Can we send email/webhook?

- Safe answer: No. Email or webhook delivery is not part of this FAQ scope.
- Required caveat: No delivery side effects are approved here.
- Do not say: "We can send a harmless test message."
- Escalate / stop if: outbound delivery is requested.

### Question: Can we create leads/tickets?

- Safe answer: No side-effecting creation is approved here.
- Required caveat: No lead/ticket mutation is approved unless separately authorized.
- Do not say: "Only internal lead creation is fine."
- Escalate / stop if: any side effect is requested.

### Question: Can we show debug/preview/knowledge/delivery/secret fields?

- Safe answer: No secret or unsafe field exposure is allowed.
- Required caveat: Debug, preview, knowledge, delivery, and secret fields must remain hidden unless explicitly approved and safety-reviewed.
- Do not say: "Internal fields are fine in a trusted audience."
- Escalate / stop if: hidden field exposure is requested.

## Screenshot / Recording FAQ

### Question: Can we record the demo?

- Safe answer: This FAQ creates no recording and does not grant recording approval.
- Required caveat: Future recording requires separate approval.
- Do not say: "Recording is implied because this is only documentation."
- Escalate / stop if: recording is requested without prior approval.

### Question: Can we take screenshots?

- Safe answer: This FAQ creates no screenshots and does not grant screenshot approval.
- Required caveat: Future screenshots require separate approval and synthetic-only content.
- Do not say: "Screenshots are automatically allowed."
- Escalate / stop if: screenshot creation is requested.

### Question: Can we share slides?

- Safe answer: Slides may only use approved synthetic, generic, non-secret content.
- Required caveat: No customer data, no production logs, no reports with data, no secrets.
- Do not say: "Any internal evidence can go into slides."
- Escalate / stop if: real data or secret material is proposed.

### Question: Can screenshots include customer data?

- Safe answer: No.
- Required caveat: No real customer data is permitted in demo assets.
- Do not say: "Redaction later is enough."
- Escalate / stop if: any real data would appear in assets.

### Question: Where are demo assets stored?

- Safe answer: This FAQ does not define or approve asset storage.
- Required caveat: Storage requires separate approval.
- Do not say: "Storage can be decided ad hoc."
- Escalate / stop if: asset retention decisions are needed.

### Question: How long are demo assets retained?

- Safe answer: This FAQ does not define or approve asset retention.
- Required caveat: Retention requires separate approval.
- Do not say: "Retention is flexible by default."
- Escalate / stop if: retention commitments are requested.

## Procurement / Security Review FAQ

### Question: Can we provide security docs?

- Safe answer: Yes, documented artifacts can be referenced with caveats.
- Required caveat: Documentation reference is not the same as final approval or operational proof.
- Do not say: "The docs prove enterprise approval."
- Escalate / stop if: a doc is being used to imply unsupported execution.

### Question: Can we answer a security questionnaire?

- Safe answer: Only with precise caveats and without overstating approval or operational proof.
- Required caveat: Scoped temporary exception must be disclosed if the baseline is discussed.
- Do not say: "Answer yes to enterprise-ready controls by default."
- Escalate / stop if: an answer would overstate readiness.

### Question: Can we claim enterprise-grade controls?

- Safe answer: We can describe staged controls and documented guardrails, but not claim full enterprise-ready completion.
- Required caveat: Current posture remains bounded and caveated.
- Do not say: "All enterprise-grade controls are complete."
- Escalate / stop if: a broad readiness claim is demanded.

### Question: Can we provide audit evidence?

- Safe answer: We can reference documented evidence and check outcomes with caveats.
- Required caveat: No hidden operational proof should be implied.
- Do not say: "We have complete audit proof for all enterprise domains."
- Escalate / stop if: evidence outside documented scope is requested.

### Question: Can we provide backup/monitoring proof?

- Safe answer: We can point to decision-gate documentation, not to approved operational proof.
- Required caveat: Real backup verification and real monitor setup are not granted.
- Do not say: "Yes, those controls are operationally proven."
- Escalate / stop if: live proof is requested.

### Question: Can we provide compliance proof?

- Safe answer: No final compliance proof should be claimed from this FAQ.
- Required caveat: Final legal/privacy/compliance approval is not granted here.
- Do not say: "Yes, this proves compliance."
- Escalate / stop if: formal compliance certification language is requested.

## Commercial / Sales Claim FAQ

### Question: Can Sales say this is enterprise-ready?

- Safe answer: No.
- Required caveat: Safe wording is limited to internal readiness work and safe demos with guardrails.
- Do not say: "Enterprise-ready now."
- Escalate / stop if: that phrasing is required for messaging.

### Question: Can Sales say rollout is approved?

- Safe answer: No.
- Required caveat: Broad rollout remains blocked.
- Do not say: "Rollout can begin after the demo."
- Escalate / stop if: rollout commitment is being prepared.

### Question: Can Sales say customer data is supported?

- Safe answer: No customer-data approval is granted here.
- Required caveat: Customer-data use remains not approved.
- Do not say: "Customer data support is ready to go."
- Escalate / stop if: the claim would alter customer expectations.

### Question: Can Sales say security is fully resolved?

- Safe answer: No.
- Required caveat: The baseline is PASS with a scoped temporary exception.
- Do not say: "All security issues are fixed."
- Escalate / stop if: caveat-free security messaging is requested.

### Question: Can Sales say PostCSS is fixed?

- Safe answer: No.
- Required caveat: The finding is accepted temporarily, not fixed.
- Do not say: "PostCSS is resolved."
- Escalate / stop if: the message is being simplified into a false fix claim.

## Objection Handling Matrix

| Objection | Safe Response | Required Caveat | Escalate If | Forbidden Response |
| --- | --- | --- | --- | --- |
| security audit has exception | PASS exists with an exact scoped temporary exception | accepted temporarily, not fixed | exception is treated as blanket waiver | "The exception means the issue is solved." |
| no real monitoring yet | monitoring decision docs exist; setup is not granted | no live operational proof | live alert proof is requested | "Monitoring is operational." |
| backups not verified | backup verification is separately gated and not granted | no verification proof claim | backup proof is required now | "Backups are verified." |
| DSAR execution not available | planning exists, execution is not granted | no real DSAR/export execution | a live DSAR is requested | "We can run a DSAR after the call." |
| customer wants real data demo | only synthetic or generic examples are allowed | no customer or production data | real records are requested | "We can show sanitized real customer data." |
| customer asks for production proof | only documented status can be referenced | no production-log or production-data proof | live production evidence is demanded | "We can prove it live from production." |
| customer asks for NOLIS-specific setup | use generic framing unless separately approved | no customer-specific hardcoding or claims | customer-specific naming is required | "We already support NOLIS-specific setup." |
| procurement asks if fully compliant | state that final compliance approval is not claimed | no final legal/privacy approval | certification language is requested | "Yes, fully compliant." |
| stakeholder asks to remove caveat | caveat is mandatory for customer-facing answers | no caveat removal allowed | caveat is refused | "We can leave the caveat out." |
| stakeholder asks to deploy after demo | deploy is separately gated | no deploy approval here | deploy commitment is requested | "The demo is enough to deploy." |

## Escalation / Stop Rules

Stop or escalate if:

- customer data is requested
- production data is requested
- the security baseline is discussed but the caveat is rejected
- real DSAR/export execution is requested
- Query Runner is requested
- reports with data are requested
- backup/restore proof is requested as completed
- monitor/alert proof is requested as operational
- deploy is requested
- recording is requested without approval
- legal/compliance sign-off is requested

## Allowed Claims

- internal demo talk track exists
- safe demo without customer data is allowed with guardrails
- customer-facing demo is conditional with caveats
- security baseline is currently PASS with a scoped temporary exception
- authorization matrix is PASS
- security boundaries are PASS
- governance docs are completed through `ENT-SEC-1G`
- no customer-data approval exists

## Forbidden Claims

- fully enterprise ready
- final DSGVO compliant
- legal approved
- real customer pilot approved
- broad rollout approved
- deploy approved
- customer data approved
- production data approved
- `DB_READ_ONLY_AUDIT` approved
- Query Runner approved
- reports with data approved
- DSAR/export/deletion/retention operational
- backup/restore verified
- monitoring/alerting operational
- PostCSS fixed
- Next/PostCSS risk gone
- no residual risk

## Relationship to Existing Docs

- `ENT-SEC-1F` = Enterprise Demo Scope Pack
- `ENT-SEC-1G` = Enterprise Demo Talk Track
- `ENT-SEC-1H` = Enterprise Demo FAQ / Objection Handling
- `ENT-SEC-1E` = Readiness Summary
- `ENT-SEC-1D` = Evidence Review Cadence
- `ENT-SEC-1C-HARDENING` = Evidence Checklist
- `ENT-SEC-1C` = Control Plan
- `ENT-SEC-1B` = Go/No-Go Decision
- `P0-Security-Audit-Drift-4E-POLICY` = scoped temporary Next/PostCSS exception
- `SRE-1G` = Monitor / Alert Setup Decision Gate
- `SRE-2F` = Production Backup Verification Decision Gate
- `DSGVO-1H` = DSAR Export Implementation Plan

## Recommended Next Step

- `ENT-SEC-1H-D` for PR review and merge
- After completion without execution: `ENT-SEC-1I Enterprise Demo Dry-Run Decision Gate`
- Only with explicit approval and separate execution scope: `SRE-1G-EXEC`
- Only with explicit approval and separate execution scope: `SRE-2F-EXEC`
- Only with explicit approval and separate execution scope: `DSGVO-1H-EXEC`

## Stop Boundaries

- Diese FAQ fuehrt keine Demo aus.
- Diese FAQ erzeugt keine Screenshots.
- Diese FAQ erzeugt keine Recordings.
- Diese FAQ liest keine DB.
- Diese FAQ fuehrt kein SQL aus.
- Diese FAQ nutzt keinen Query Runner.
- Diese FAQ erzeugt keine Reports.
- Diese FAQ fuehrt keine DSAR-Anfrage aus.
- Diese FAQ fuehrt keinen Export aus.
- Diese FAQ erzeugt keine JSON-/CSV-/ZIP-Exportdatei.
- Diese FAQ fuehrt keine Loeschung aus.
- Diese FAQ fuehrt keine Korrektur aus.
- Diese FAQ fuehrt keine Retention-Aktion aus.
- Diese FAQ oeffnet keine Backups/Dumps/Exports.
- Diese FAQ liest keine Secrets.
- Diese FAQ fuehrt keine Production-Abfragen aus.
- Diese FAQ fuehrt keine Healthchecks aus.
- Diese FAQ fragt keine Production Logs ab.
- Diese FAQ aendert keine Production Config.
- Diese FAQ deployt nichts.
- Diese FAQ richtet keine Monitore oder Alerts ein.
- Diese FAQ dokumentiert keine Kundendaten.
- Diese FAQ dokumentiert keine echten Kontakte.
- Diese FAQ gibt keine DSGVO-Konformitaet frei.
- Diese FAQ gibt keine reale Pilotfreigabe.
- Diese FAQ gibt keine Enterprise-Freigabe.
- Diese FAQ gibt keine Deploy-Freigabe.
- Diese FAQ markiert Next/PostCSS nicht als gefixt.

## Non-goals

- no implementation
- no demo execution
- no screenshots
- no recordings
- no deploy
- no monitoring setup
- no alert setup
- no DB access
- no SQL
- no query runner
- no reports
- no export
- no DSAR execution
- no deletion, correction, or retention execution
- no backup or restore
- no backup verification
- no runtime change
- no customer data
- no secrets
- no final DSGVO conformity claim
- no pilot approval
- no enterprise approval
- no change to the scoped Next/PostCSS exception
