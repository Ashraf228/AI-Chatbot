# Release Notes

## v0.9.0-production-candidate

Dieser Stand bereitet die Plattform auf einen ersten professionellen Pilot-/Production-Candidate-Betrieb vor.

## Enthalten

- Zentrale Chat-Pipeline fuer Widget, API und Dashboard-Flows.
- Strukturierter Agent-Orchestrator mit Decisions.
- Zentraler Tool Executor fuer Leads, Kontaktanfragen, Tickets, Webhooks, Knowledge Query, Handoff.
- Knowledge/RAG mit Sources, Aktiv/Inaktiv, Re-Sync, Delete, URL Import und `knowledgeMode`.
- Setup Wizard als Business-Onboarding.
- Dashboard Business-Control-Center mit KPIs, Kundenstatus, Leads, Chats, Reports und Analytics.
- Site-scoped Integrationen mit Test, Audit und Webhook-Dispatch.
- Security/DSGVO Hardening: Widget Origin Validation, Rate Limits, PII Redaction, Privacy Export/Delete, Retention Dry-Run.
- Plan-/Usage-/Limit-Architektur ohne Stripe.
- Docker Compose mit internem Netzwerk, Proxy, Healthchecks und required ENV.

## Bekannte Einschraenkungen

- Keine echte Stripe-/Payment-Integration.
- Kein vollautomatischer Retention-Cron als harte Production Policy.
- Kein vollstaendiges Consent-Management-System.
- Kein externer Security/Pentest-Bericht.
- Provider-spezifische CRM/Helpdesk-Connectoren sind noch generisch.
- Production Monitoring/Alerting muss noch mit Betreiber-Infrastruktur verbunden werden.
