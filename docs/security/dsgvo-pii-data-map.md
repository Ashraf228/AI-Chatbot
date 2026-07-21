# DSGVO PII Data Map

Stand: 2026-07-21

## 1. Summary

This document is a documentation-only PII data map for Enterprise Pilot readiness.

Purpose:

- inventory repository-visible personal-data categories, processing surfaces, storage hints, and privacy risks
- document which privacy-relevant flows are repo-evident, documented-only, inferred, or still unknown
- support later privacy, retention, DSAR, logging, and restore-governance work without touching live systems

This step is intentionally `DOKU_ONLY`.

This map does not:

- read any database
- execute SQL
- use a query runner
- read production or staging logs
- generate reports
- open backups, dumps, or exports
- document customer values or real contact data
- document secrets or connection strings
- claim final legal compliance
- claim that GDPR / DSGVO compliance is already fully achieved

This map is a technical privacy inventory, not legal advice and not a final compliance release.

## 2. Scope

Scope of analysis:

- read-only review of repository documentation under `docs/operations`, `docs/security`, and `docs/architecture`
- read-only review of relevant API, dashboard, widget, package, DTO, entity, and migration files
- field names, table names, route shapes, and storage classes only
- no production calls, no DB inspection, no query results, and no exports

Out of scope:

- production data analysis
- staging data analysis
- raw logs
- legal basis completion
- processor contract review
- implementation changes

## 3. Classification Model

### Data classification labels

- `pii_likely`
  - repository-visible data shape normally contains direct or indirect personal data
- `pii_possible`
  - repository-visible shape can contain personal data depending on user input or tenant usage
- `sensitive_operational_data`
  - not necessarily personal data, but operationally sensitive and leak-relevant
- `secret_like_not_pii`
  - credentials, tokens, encryption material, signing material, or privileged connection data
- `non_pii_operational_metadata`
  - technical state or routing metadata that is usually not personal data on its own
- `unknown_requires_follow_up`
  - privacy relevance cannot be safely proven from repository evidence alone
- `blocked_without_approval`
  - data class or processing path is known but intentionally blocked for live inspection or use

### Evidence levels

- `repo_evident`
  - directly visible in code, DTOs, entities, migrations, or current documentation
- `documented_only`
  - stated in documentation but not fully revalidated in runtime code here
- `inferred_from_field_names`
  - privacy relevance inferred from field or table names only
- `not_validated`
  - visible concept exists, but operational truth is not validated in this task
- `unknown`
  - not reliably known from repository evidence

## 4. Data Subject / Actor Categories

| Actor | Possible Data | Source Evidence | Risk | Follow-up |
| --- | --- | --- | --- | --- |
| public widget visitor | `visitor_id`, `session_id`, message content, `source_url`, `user_agent`, event metadata | `repo_evident` via `001_initial_schema.sql`, widget DTOs, widget controllers/services | High | validate retention, logging, and public-response guardrails |
| website/contact lead | `name`, `email`, `phone`, `message`, contact-request notes | `repo_evident` via `widget_leads`, `agent_contact_requests`, `CaptureLeadDto` | High | review lead retention, downstream delivery, DSAR handling |
| dashboard/admin user | session cookie, `displayName`, `tenantId`, role, expiry metadata | `repo_evident` via dashboard auth/session helpers | Medium | validate session retention, cookie policy, and admin access logging |
| tenant/customer organization contact | tenant user `email`, `display_name`, possible organization references | `repo_evident` via `tenant_users`, `agent_tickets.customer_organization` | High | complete processor and retention mapping |
| support/operator user | actor IDs, actor roles, audit metadata, session metadata | `repo_evident` via `audit_logs`, dashboard auth headers | Medium | review audit retention and least-privilege access |
| synthetic smoke user | synthetic session IDs, synthetic chat prompts, synthetic event metadata | `documented_only` via SRE and architecture docs | Low if synthetic remains synthetic | keep smoke data non-personal and non-customer |
| webhook recipient / external integration actor | endpoint metadata, headers, provider config, ticket/contact payload fields | `repo_evident` via `integration_connections`, `webhook_jobs`, integration registry | High | validate processor inventory and outbound minimization |
| unknown future pilot customer user | any future chat, lead, ticket, report, export, or privacy-action data | `unknown_requires_follow_up` | High | map purpose, legal basis, retention, and DSAR process before pilot scale-up |

## 5. PII Category Inventory

| Data Category | Examples as field names only | Surfaces | Classification | Evidence Level | Notes |
| --- | --- | --- | --- | --- | --- |
| name | `name`, `display_name`, `reporter_name`, `companyName`, `botName` | widget leads, contact requests, tenant users, tickets, site config | `pii_likely` | `repo_evident` | direct identifier when tied to a person |
| email | `email`, `recipient_email`, `fromEmail`, `notifyEmails`, `reporter_email`, `leadNotificationEmail` | widget leads, tenant users, report subscriptions/runs, SMTP config, tickets | `pii_likely` | `repo_evident` | also appears in integration and delivery configuration |
| phone | `phone`, `preferred_channel` when phone selected | widget leads, contact requests, lead capture, contact collection | `pii_likely` | `repo_evident` | direct contact detail |
| address / location / service address | `address`, `fullAddress`, `location`, `source_url`, `page_url`, `allowed_domains`, `domain` | local-service/contact flows, tickets, widget events, site settings | `pii_possible` | `repo_evident` / `inferred_from_field_names` | service address is likely personal in local-service use cases |
| free-text message content | `message`, `note`, `description`, `last_message`, `input_summary`, `output_summary` | widget chat, leads, tickets, analytics, agent runs | `pii_possible` | `repo_evident` | user-entered free text can include arbitrary PII |
| conversation content | `content`, `messages`, `conversation.metadata`, `summaryBeforeHandoff` | `messages`, exports, chat pipeline, analytics, handoff flows | `pii_possible` | `repo_evident` | content can include sensitive or confidential text |
| session identifiers | `session_id`, `sessionId`, `visitor_id`, `visitorId`, `evaluation_chat_session_id` | widget, conversations, analytics, evaluation flows | `pii_possible` | `repo_evident` | indirect identifiers, especially when linked with site or time |
| tenant/site identifiers | `tenant_id`, `tenantId`, `site_id`, `siteId`, `site_key`, `siteKey` | all major API and dashboard surfaces | `non_pii_operational_metadata` | `repo_evident` | not personal by default, but linkable to customer context |
| user/admin identifiers | `actor_id`, `actor_role`, `tenant_user_id`, `sub`, `displayName` | dashboard auth, audit logs, admin headers, evaluation flows | `pii_likely` | `repo_evident` | employee/operator account data |
| auth/session/cookie metadata | session cookie, `X-DASHBOARD-ACTOR`, `X-DASHBOARD-TENANT`, `sessionExpiresAt`, `accountExpiresAt` | dashboard auth/session APIs, backend proxy headers | `sensitive_operational_data` | `repo_evident` | account/session metadata, not always PII alone but security-sensitive |
| IP / user-agent / referer / origin metadata | client IP, `userAgent`, `Origin`, `Referer`, `sourceUrl`, `pageUrl` | widget session/chat/events, rate limiting, origin guard, logs | `pii_possible` | `repo_evident` | IP and browser metadata can be personal data |
| webhook payload metadata | `payload`, `headers`, `event_id`, `delivery_id`, event type, field mapping | webhook jobs, integration registry, HMAC signing | `pii_possible` | `repo_evident` | can carry user/contact/ticket data outbound |
| email delivery metadata | `kind`, `recipient_email`, `subject`, `html`, `text`, `last_error`, delivery metadata keys | `email_jobs`, report runs, SMTP override config | `pii_likely` | `repo_evident` | contains direct contact data and delivery history |
| report / analytics metadata | `report_subject`, `error_message`, `frequency`, widget analytics events, conversion metrics | `report_runs`, `report_subscriptions`, business analytics, dashboard reports | `pii_possible` | `repo_evident` | some analytics are aggregate, some surfaces expose recipient or text hints |
| backup-contained data | all rows in Postgres-backed privacy-relevant tables | backup / restore planning and decision-gate docs | `blocked_without_approval` | `documented_only` | production backup contents are intentionally not inspected |
| logs / error traces | sanitized metadata, request context, error messages, log event fields | audit logs, app logs, incident docs, CI logs | `pii_possible` | `repo_evident` / `documented_only` | may contain snippets or metadata if not fully redacted |
| secrets / credentials | `token`, `secret`, `password`, `apiKey`, `authorization`, `INTEGRATION_SECRET_KEY`, `OPENAI_API_KEY` | integration secrets, dashboard backend token, webhook signing, provider auth | `secret_like_not_pii` | `repo_evident` | sensitive but distinct from personal data; still critical to privacy/security |

## 6. Processing Surface Inventory

| Surface | Purpose | Possible PII | Storage / Flow | External Exposure | Evidence Level | Risk | Follow-up |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public Widget loader/config/session/chat | public chat entrypoint and session bootstrap | session IDs, visitor IDs, user agent, source URL, chat message text | widget browser state -> `/widget/session` -> `/widget/chat` -> conversations/messages | public internet-facing widget APIs | `repo_evident` | High | validate public response minimization and retention |
| API chat/session/conversation handling | process chat input and persist message history | message content, session identifiers, pending lead metadata, possible address/contact content | `conversations`, `messages`, `conversations.metadata` | indirect via widget and admin views | `repo_evident` | High | map retention and DSAR process |
| Dashboard auth/session/admin surfaces | authenticate staff and customers and proxy backend calls | cookie/session metadata, display name, tenant/user IDs | dashboard cookies and backend headers | admin/operator/customer dashboard | `repo_evident` | High | validate cookie governance and admin log scope |
| Dashboard evaluation / reporting surfaces | operator and viewer evaluation flows, reports, analytics | report recipient emails, recent lead data, conversation snippets, ticket previews | dashboard APIs, `report_runs`, evaluation tables, analytics queries | dashboard-only but user-visible | `repo_evident` | High | review least privilege and export boundaries |
| Email jobs | queued internal or customer-adjacent email delivery | recipient email, subject, body text, metadata, errors | `email_jobs` table and downstream SMTP | outbound mail infrastructure | `repo_evident` | High | review minimization, error leakage, retention |
| Webhook jobs | queued webhook delivery to external systems | payloads, headers, endpoint URLs, event metadata | `webhook_jobs`, integration config | external endpoints | `repo_evident` | High | validate DPA / processor / endpoint ownership |
| Delivery/integration flows | connect CRM, ticketing, webhook, email, commerce systems | lead, contact-request, ticket, conversation handoff payloads | integration registry -> connection config -> queue/delivery | third-party providers or customer endpoints | `repo_evident` | High | define provider inventory and outbound field boundaries |
| Analytics / `report_runs` | measure conversions, activity, and send reports | session-based metrics, recipient email, last message text, error text | `widget_events`, `usage_events`, `usage_daily`, `report_runs`, dashboard summaries | dashboard and report delivery | `repo_evident` | High | separate aggregate-safe analytics from personal-data exports |
| Security / audit logs | trace actions and security-relevant events | actor IDs, roles, masked emails/phones, metadata, possible snippets | `audit_logs`, app logger events, CI logs | admin and ops surfaces | `repo_evident` | Medium to High | validate redaction coverage and retention |
| Production health / smoke checks | safe operational validation | synthetic session IDs, internal smoke origins, safe response text | smoke docs and safe test flows | internal ops only | `documented_only` | Low if synthetic remains synthetic | keep safe-smoke isolated from customer data |
| Backup / restore artifacts | preserve or validate system state | any DB-backed PII classes | backup scripts, offsite sync, restore-test docs | backup/offsite storage and restore operators | `documented_only` | High | requires separate approval and privacy strategy |
| Incident logs / SRE documentation | incident review, runbook output, dry-run evidence | summarized metadata, possible identifiers if not redacted | SRE docs, incident records, review notes | internal ops/security audience | `documented_only` | Medium | enforce no raw customer data in incident artifacts |
| External provider interfaces | LLM, SMTP, webhook, commerce, hosting, monitoring, backup, customer endpoints | prompts/messages, delivery payloads, emails, tokens, endpoint metadata | environment config, integrations, outbound queues, provider APIs | external processors and customer-owned endpoints | `repo_evident` / `documented_only` | High | build processor and transfer inventory |

## 7. Storage / Persistence Map

| Storage Area | Possible Data | PII Risk | Evidence | DB Read Needed? | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Postgres | conversations, messages, widget sessions, leads, reports, subscriptions, audit logs, tenant users, tickets, jobs, integrations | High | `repo_evident` via migrations/entities/services | no for inventory; yes for exact live contents | future approved privacy audit if needed |
| Redis | rate-limit and ephemeral operational state; exact key contents not validated here | `unknown_requires_follow_up` | `not_validated` | yes for exact data shape | decide whether Redis can hold identifiers or auth-adjacent data |
| application logs | log events, error messages, audit-like metadata, possible snippets | High | `repo_evident` / `documented_only` | no | review redaction and retention policy |
| dashboard/session storage | dashboard auth cookie; widget `localStorage` / `sessionStorage` for consent, session ID, visitor ID | Medium to High | `repo_evident` | no | verify client-side retention and cookie disclosures |
| widget static/config surface | public site config, widget bundle, public response shape | Medium | `repo_evident` | no | ensure no debug, secret, or delivery internals become public |
| backup storage | DB backups and related restore artifacts | High | `documented_only` | no for this map | treat as PII-bearing by default |
| offsite backup storage | replicated backup copies, retention artifacts | High | `documented_only` | no | validate encryption, ownership, processor role |
| report outputs | report runs, report subscriptions, privacy export outputs, CSV/JSON-like export surfaces | High | `repo_evident` / `documented_only` | no | define export retention and access controls |
| CI artifacts/logs | test output, build logs, security audit output, workflow logs | Medium | `documented_only` | no | ensure no secret or customer-data leakage into CI |
| incident/review docs | SRE docs, post-merge checks, review summaries | Medium | `documented_only` | no | keep metadata-only and avoid customer values |
| external providers | LLM prompts, webhook payloads, SMTP metadata, hosted integrations | High | `repo_evident` / `documented_only` | no | processor inventory and transfer governance needed |

## 8. Data Flow Map

Conceptual flows visible from repository evidence:

1. widget visitor input -> public widget loader/config/session/chat APIs
2. public widget session/chat APIs -> API processing and conversation persistence
3. chat/session data -> `conversations`, `messages`, `widget_sessions`, `widget_events`
4. potential lead/contact data -> `widget_leads` and/or `agent_contact_requests`
5. lead/contact/ticket/handoff state -> `email_jobs` and `webhook_jobs` through delivery paths
6. operational events -> `audit_logs`, app log events, and dashboard summaries
7. reports/analytics -> `widget_events`, `usage_events`, `usage_daily`, `report_runs`, report subscriptions, dashboard reporting UI
8. persisted data -> backup and restore scope as documented in SRE-2A through SRE-2E
9. restore/drill planning -> explicit privacy guardrails and blocked production-data use
10. external provider flows -> webhook, SMTP/email, LLM/API, commerce, and customer-owned endpoints, where configured

Important boundary notes:

- these are conceptual repository-derived flows, not production-verified runtime traces
- no production data path was inspected directly
- any live data-transfer inventory remains incomplete without a separate approved provider/processor audit

## 9. Public Widget Privacy Boundary

Current public top-level response shape is controlled and intentionally narrow:

- `sessionId`
- `answer`
- `parts`
- `sources`
- `messages`

Public boundary rules visible in code and docs:

- widget chat/session/lead/event endpoints are protected by site, origin, and rate-limit guards
- public config intentionally exposes only public-safe config fields
- debug, preview, knowledge, delivery, secret, and admin-only internals must not leak into public widget responses
- safe smoke uses an internal safe testsite / safe origin path, not a customer-site mutation path
- customer-site mutation remains forbidden in the current ops model

Primary public-widget privacy risk:

- user free-text
- contact details entered in lead/contact flows
- possible address/service-location content in local-service scenarios

Public widget must not expose:

- secrets
- internal delivery payloads
- hidden knowledge debug data
- query results
- report payloads
- outbound integration internals

## 10. Jobs / Delivery / Integration PII Risk

Repository-visible risk points:

- `email_jobs` can contain contact and delivery metadata, recipient email, subject, content, metadata, and error strings
- `webhook_jobs` can contain payload, headers, endpoint URLs, event metadata, and delivery-state data
- `agent_contact_requests` can contain name, email, phone, preferred channel, and note
- integration configuration can include destination URLs, field mappings, notification recipients, and configured secret presence

Current governance boundaries:

- reads/writes/updates to these live job tables remain blocked without explicit approval in many current gated tasks
- no query runner is approved here
- no reports with data are approved here
- no cleanup/backfill/enforcement action is part of this map
- no delivery or integration execution is performed by this task

## 11. Logs / Audit / Incident PII Risk

Repository-visible observations:

- logs can potentially include request metadata, error context, session identifiers, or user-provided snippets
- `audit_logs` explicitly store actor, action, resource identifiers, and sanitized metadata
- `apps/api/src/utils/pii.ts` masks emails and phones and redacts sensitive key names in audit-oriented sanitization
- incident and SRE documents are intended to stay metadata-only

Hard constraints for this map:

- no production logs were queried
- no raw incident logs were opened
- no customer data was copied into documentation

Privacy conclusions:

- sanitized event names and metadata-only summaries are acceptable
- secret-like log hits remain security-relevant and can be severe
- follow-up is needed for log redaction coverage and retention policy

## 12. Backup / Restore PII Impact

Based on `SRE-2A` through `SRE-2E`:

- backups can contain PII because Postgres-backed tables clearly contain contact, conversation, report, ticket, audit, and job data classes
- production backup data remains blocked
- production secrets remain blocked
- restore with production data requires separate PII / DSGVO approval
- `DB_READ_ONLY_AUDIT` remains `not_granted`
- `SRE-2E-EXEC Local Synthetic Restore Dry Run` is not allowed without explicit approval
- synthetic, schema-only, and fixture data remain preferred for future restore validation
- query results, reports, dumps, and export artifacts remain forbidden in the current restore-governance line

Privacy implication:

- backup/restore readiness cannot be treated as privacy-safe by default
- any real restore involving production-like or customer-bearing data needs owner assignment, data-class approval, and privacy controls first

## 13. External Recipients / Provider Classes

| Provider Class | Possible Data | Evidence | Risk | Follow-up |
| --- | --- | --- | --- | --- |
| email provider / SMTP | recipient email, subject, body text, notification metadata | `repo_evident` via `email_jobs`, SMTP override integration types, mailer docs | High | processor inventory, retention, and content minimization |
| webhook recipient | lead/contact/ticket/handoff payloads, headers, endpoint metadata | `repo_evident` via `webhook_jobs`, integration registry, HMAC helpers | High | DPA / endpoint ownership / payload allowlist |
| LLM / AI provider | system/user prompts, conversation text, token/usage metadata | `repo_evident` via `LlmService` and OpenAI client usage | High | purpose, transfer, and retention review |
| hosting / infrastructure provider | logs, runtime metadata, config-adjacent information | `documented_only` | Medium to High | inventory provider class and access owners |
| monitoring / logging provider | uptime metadata, alert summaries, possible operational identifiers | `documented_only` | Medium | identify providers and sanitize alert payloads |
| backup/offsite storage provider | backup archives and backup metadata | `documented_only` | High | encryption, access, residency, processor role |
| analytics/reporting provider | report recipients, metrics, export outputs | `repo_evident` / `documented_only` | High | distinguish internal dashboard vs. external delivery |
| customer-owned endpoints | customer webhook URLs, CRM/ticket systems, custom SMTP targets | `repo_evident` / `unknown_requires_follow_up` | High | validate contractual, security, and minimization boundaries |

No real provider secrets, no tokenized URLs, and no live endpoint credentials are documented here.

## 14. PII Risk Register

| Risk | Surface | Impact | Current Evidence | Severity | Pilot Impact | Required Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| free-text messages may contain PII | widget chat, conversations, messages, analytics-derived summaries | accidental storage of arbitrary personal data | `repo_evident` | High | Pilot-blocking if exposure is public or uncontrolled | retention, DSAR, logging, and export review |
| contact fields may contain PII | leads, contact requests, tickets, tenant users | direct identifier and contact-channel exposure | `repo_evident` | High | High | minimization and deletion flows |
| logs may capture metadata or snippets | audit logs, app logs, incident notes | privacy and security leakage | `repo_evident` / `documented_only` | High | High | log redaction and retention audit |
| email/webhook job payloads may contain PII | `email_jobs`, `webhook_jobs`, delivery metadata | outbound leakage or over-retention | `repo_evident` | High | High | payload boundaries and processor mapping |
| reports/analytics may contain PII | report recipients, report subjects, recent leads/conversations | data exposure in admin/reporting surfaces | `repo_evident` | High | High | analytics boundary audit |
| backups may contain PII | Postgres backups and offsite copies | bulk sensitive-data exposure | `documented_only` | High | High | encryption/access/privacy approval |
| restore drills may expose PII if not restricted | restore planning and future execution | unauthorized reconstruction of personal data | `documented_only` | High | High | keep production data blocked until approval |
| external providers may receive PII | LLM, SMTP, webhook, CRM, ticketing, commerce | cross-system transfer and processor risk | `repo_evident` / `documented_only` | High | High | processor inventory and DPA status |
| retention/deletion unknown | conversations, leads, reports, tickets, logs | indefinite storage risk | `repo_evident` / `not_validated` | High | High | retention audit |
| data subject request handling unknown | privacy export/delete, DSAR process | incomplete privacy rights handling | `repo_evident` / `not_validated` | High | High | DSAR and legal-process audit |
| processor/DPA status unknown | all external provider classes | contractual/privacy governance gap | `unknown_requires_follow_up` | High | High | processor register and contracts |
| PII in synthetic/smoke flows must remain safe | smoke/test/pilot validation flows | accidental use of real data in test context | `documented_only` | Medium | Medium to High | keep synthetic-only discipline |

## 15. Current Unknowns

- exact production data categories are unknown without an explicitly approved `DB_READ_ONLY_AUDIT`
- retention policy is visible in parts of code, but not fully validated end to end
- deletion policy exists in code paths, but operational truth is not fully validated
- DSAR/export process is partially visible in privacy export/delete routes, but not fully audited as a rights-handling process
- processor inventory is incomplete
- legal basis / purpose mapping is not completed in this task
- PII / DSGVO restore strategy is not completed
- log redaction and log retention are not fully validated
- backup encryption and access ownership are not fully validated
- report/analytics PII boundaries are not fully validated

## 16. Pilot Privacy Go/No-Go Criteria

Pilot Go from a privacy baseline only when:

- a PII data map exists
- PII / DSGVO restore guardrails are documented
- the public widget privacy boundary is documented
- incident-log PII rules are documented
- no high or critical security findings are open
- no known public-widget leak is open
- no unresolved auth / RBAC / tenant-isolation issue is open
- retention/deletion follow-up is planned
- processor/external-recipient follow-up is planned

Pilot No-Go when:

- unknown PII flows have public exposure
- the public widget leaks internal, debug, secret, delivery, or query-result data
- reports or query results with data are exposed without governance
- production backup/restore involving PII is executed without approval
- `DB_READ_ONLY_AUDIT` is treated as granted without explicit human approval
- high/critical security findings remain open
- no privacy owner or no incident privacy path exists

## 17. Stop Boundaries

This map explicitly does not:

- read a database
- execute SQL
- use a query runner
- generate reports
- open backups, dumps, or exports
- read secrets
- run production or staging queries
- change production config
- deploy anything
- change public widget response shape
- mutate a customer site
- grant GDPR / DSGVO compliance approval

## 18. Recommended Next Step

Recommended next step:

- `DSGVO-1B Processing Purpose / Retention / DSAR Gap Audit`

Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

If later restore execution is desired:

- `SRE-2E-EXEC Local Synthetic Restore Dry Run`
- only with explicit approval
- only without production data

## 19. Non-goals

- no legal advice
- no final GDPR / DSGVO compliance rating
- no implementation
- no DB access
- no SQL
- no query runner
- no reports
- no export execution
- no backup/restore execution
- no deploy
- no runtime change
- no customer data values
- no secrets
