# Enterprise SRE Security Readiness Audit

## Summary

Stand dieses Audits ist July 23, 2026.

Die aktuelle Plattform ist fuer die bereits production-validierten Boundary- und Dokumentationsschritte stabil genug, um weitere pure Boundary- und DOKU_ONLY-Arbeit sicher fortzusetzen. Fuer eine belastbare Enterprise-, SRE- und Security-Readiness fehlen aber noch mehrere formalisierte Betriebs-, Sicherheits- und Datenschutz-Bausteine.

Positiv bestaetigt sind:

- Main-CI-Workflow auf `pull_request` und `push` auf `main`
- Docker-/Main-CI-Gate-Runbook und Gate-Skripte auf `main`
- Production Health und Public Widget Smoke aktuell gruen dokumentiert
- body-parser Produktionsdrift fixed / production-live dokumentiert
- sharp Produktionsdrift mitigated / production-live dokumentiert
- next Produktionsdrift fixed / production-live dokumentiert
- Production-DB-Ziel weiter `chatbot`
- Migrationsstand weiter `28`
- letzte Migration weiter `028_generic_webhook_signing_modes.sql`
- Public Widget bleibt auf Legacy-Pipeline
- Conversation Engine ist weiter nicht live im Public Widget

Die groessten Enterprise-Luecken liegen aktuell nicht in fehlenden Refactor-Boundaries, sondern in:

- Remote-Docker-Fallback-Operationalisierung
- externer Monitoring-/Alerting-Haertung
- formalisierter Backup-Restore-Drill-Dokumentation
- Enterprise-Security-/RBAC-/Secret-Governance
- DSGVO-/PII-/Retention-Governance
- Runtime-Reliability fuer Queue-, Worker- und Idempotency-Pfade
- Go-live-Readiness fuer Support, SLA/SLO und Kunden-/NOLIS-Betrieb

## Current Baseline

- `origin/main`: `830faf45c73a3dc7765061fee45e19b5ca987386`
- zuletzt dokumentierter live-validierter API-Stand: `df4b2617ad27cab46c0f14c65f9acb08697940a1`
- vorheriger live-validierter API-Stand: `92c78a607386fa73a44bed8b6ede8c87e52420cf`
- zuletzt dokumentiertes live-validiertes API-Image: `sha256:f5783a991f5c6a7ca5c89bceba1c58aaca266c80fdc1f14a5092997a770be03b`
- zuletzt dokumentierter live-validierter Dashboard-Stand: `830faf45c73a3dc7765061fee45e19b5ca987386`
- vorheriger live-validierter Dashboard-Stand: `9b74ee942215597215aaf77b23ee69d6139519ee`
- zuletzt dokumentiertes live-validiertes Dashboard-Image: `sha256:c5d1d8bfa7f7117eda65214964e96e46730b76b8e6663c90629637a2fe81dac9`
- Production Health: gruen dokumentiert
- Public Widget Smoke: gruen dokumentiert
- Public Widget Response Shape: unveraendert
- Production-DB-Ziel: `chatbot`
- `soule_demo`-Drift: nicht dokumentiert, weiterhin zu vermeiden
- Migration Count: `28`
- Latest Migration: `028_generic_webhook_signing_modes.sql`
- Auto-Migration: nein
- `db:migrate`: nein
- body-parser Produktionsdrift:
  - Advisory `GHSA-v422-hmwv-36x6` dokumentiert behoben
  - `body-parser@2.3.0` live im API-Container bestaetigt
  - API-only-Deploy ohne Dashboard-/Widget-/DB-Aenderung erfolgreich
- sharp Produktionsdrift:
  - Advisory `GHSA-f88m-g3jw-g9cj` dokumentiert mitigiert
  - Dashboard-only-Deploy auf `9b74ee942215597215aaf77b23ee69d6139519ee` erfolgreich
  - `sharp` High-Finding im Dashboard-Production-Kontext nicht mehr vorhanden
  - keine neue Audit-Exception und keine Risk Acceptance
- next Produktionsdrift:
  - Advisory-Familie fuer Middleware / Proxy bypass, Server Actions DoS und SSRF / cache confusion / internal endpoint disclosure dokumentiert behoben
  - Dashboard-only-Deploy auf `830faf45c73a3dc7765061fee45e19b5ca987386` erfolgreich
  - Next High-Findings im Dashboard-Production-Kontext nicht mehr vorhanden
  - `postcss` bleibt hoechstens `moderate` und nicht blockierend
  - keine neue Audit-Exception und keine Risk Acceptance
- aktueller Email-Job-Duplicate-Track:
  - Runbook- und Approval-Format dokumentiert
  - Staging read-only audit runbook boundary production-safe deployed
  - echter `DB_READ_ONLY_AUDIT` weiter nicht freigegeben
  - P1.2B-26A bleibt ohne explizite menschliche Freigabe blockiert

## Hard Stop Boundaries

Dieses Audit aendert nichts an den bestehenden Stop-Kriterien und Freigabegrenzen.

Weiterhin nicht erlaubt ohne expliziten separaten Auftrag:

- kein Deploy
- keine Migration
- keine SQL-Ausfuehrung
- keine SQL-Dateien im Repo
- keine DB Reads oder Writes
- keine Staging- oder Production-DB-Queries
- keine `email_jobs`- oder `webhook_jobs`-Reads/Writes/Updates
- kein Query Runner
- keine Query Results oder Reports mit Daten
- kein Cleanup, Backfill oder Enforcement
- keine Feature-Flag- oder Production-Config-Aenderung
- keine Public-Widget-Runtime-Aenderung

Der Email-Job-Duplicate-Track ist deshalb fuer Enterprise-Readiness aktuell nur als vorbereiteter, aber bewusst nicht freigegebener Audit-/Runbook-/Boundary-Rahmen zu werten.

## Enterprise Readiness Matrix

| Area | Current State | Gap | Risk | Priority | Next Task | Blocking? | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CI / Main-CI Gate | `ci.yml` triggert auf `pull_request` und `push` auf `main`; Main-CI-Gate-Skript auf `main` vorhanden | Nutzung im Alltag erst seit kurzem formalisiert; weitere Routinevalidierung sinnvoll | Mittel | P0 | Betrieb ueber `scripts/ops/codex-main-ci-gate.sh` weiter standardisieren | Nein | Hauptproblem war Sichtbarkeit/Auswertung, nicht fehlender Trigger |
| Docker Fallback | Docker-Fallback ist als Prozess dokumentiert, aber nicht als belastbarer Remote-Runner-Standard abgeschlossen | Kein standardisierter Docker-faehiger Fallback-Runner fuer blockierte lokale Daemons | Hoch | P0 | `P0-Docker-1A Remote Docker Fallback Runner Plan` | Ja | Relevanter Blocker fuer Runtime-Deploy-Gates bei lokaler Docker-Nichtverfuegbarkeit |
| Monitoring / Alerting | Lokale Health-Skripte und Alert-Wrapper vorhanden | Externe Ueberwachung, Routing und Eskalationspfad nicht vollstaendig auditiert | Hoch | P0 | `SRE-1A External Monitoring / Alert Routing Audit` | Ja | Aktuelle Checks decken API, Dashboard, Widget, Jobs, Disk und Logs ab |
| Incident Response | Produktionsgates und Stop-Kriterien dokumentiert | Kein formalisierter Incident-Runbook-/Escalation-/Severity-Katalog gelesen | Mittel | P1 | Incident-Response-Runbook-Audit | Nein | Aktuell eher implizit als operativ formalisiert |
| Backup / Restore | Backup-Freshness-Checks und Restore-Test-Skript vorhanden | Kein formaler Restore-Drill-Plan mit Regelbetrieb, Nachweis und Verantwortlichkeiten | Hoch | P0 | `SRE-2A Backup Restore Drill Plan` | Ja | Restore-Test-Skript ist gute Basis, aber noch kein Enterprise-Nachweis |
| Security / RBAC | Authorization-Matrix- und Security-Boundary-Checks im CI | Kein zusammenhaengender Enterprise-Security-Gap-Report fuer Admin-/Operator-Flaechen | Hoch | P1 | `ENT-SEC-1A Enterprise Security Gap Audit` | Ja | Schwerpunkt auf Admin-Flaechen, Privilegien und Prozessgrenzen |
| Tenant Isolation | Harte Tenant-/Site-Isolation ist in `AGENTS.md` und Security-Tests verankert | Kein expliziter Enterprise-Review fuer alle Live-Admin-/Ops-Pfade | Hoch | P1 | `ENT-SEC-2A Tenant Isolation / RBAC Review` | Ja | Technische Grundlage gut, Governance-Nachweis fehlt |
| Public Widget Security | Public Widget bleibt Legacy-Pipeline; Response Shape und Smoke sind auditiert | Kein vollstaendiger enterprise-orientierter Threat-/Abuse-/Rate-Limit-Review gelesen | Mittel | P1 | Public Widget Security Review | Nein | Vorteil: Conversation Engine noch nicht live |
| Webhook Security | Delivery- und Notification-Safety-Audits vorhanden; Secret-sensitive Felder werden sanitisiert | Live-Webhook-Ausfuehrungspfad noch nicht als separater Enterprise-Safety-Track abgeschlossen | Hoch | P1 | Webhook Execution Safety | Ja | Relevanz steigt mit mehr Live-Integrationen |
| Secrets Management | Sensitive-Scan-Skripte und Secret-Stop-Kriterien vorhanden | Kein vollstaendiges Secret-Inventar, Rotation-Plan oder Ownership-Mapping gelesen | Hoch | P1 | `ENT-SEC-4A Secrets Inventory / Rotation Plan` | Ja | Fuer Enterprise-Betrieb und Audits zentral |
| DSGVO / PII / Retention | Mehrere Boundaries und Audits begrenzen PII-Exposure; Public Widget bleibt konservativ | Kein formaler Data-Map-, Retention- oder DSAR-Audit-Stand gelesen | Hoch | P1 | `DSGVO-1A PII Data Map` | Ja | Datenschutz-Readiness ist noch nicht formal abgeschlossen |
| Delivery / Integrations | Mehrere pure Delivery-Boundaries production-validiert | Live-Orchestrator-/Dispatcher-/Integration-Wiring noch stark zentralisiert | Hoch | P2 | Delivery Wiring Decision Gate | Nein | Architektonischer Fortschritt da, Runtime-Entkopplung noch offen |
| Conversation Engine Rollout | Nicht live im Public Widget; Legacy-Pipeline unveraendert | Kein formaler Canary-/Rollout-/Rollback-Plan fuer spaeteren Live-Gang | Hoch | P2 | Conversation Engine Canary Plan | Nein | Bewusste Nicht-Aktivierung reduziert aktuelles Risiko |
| Email Job Duplicate / Idempotency | Audit-/Decision-/Runbook-Boundaries vorhanden; echte Audit-Ausfuehrung nicht freigegeben | Kein echter Read-only Audit, kein Enqueue-/Worker-Refactor, keine Enforcement-Strategie | Hoch | P2 | `P1.2B-26A` bleibt blockiert; danach Idempotency Enforcement Plan | Nein | Fachlich vorbereitet, operativ bewusst geparkt |
| Worker / Queue Reliability | Smoke-, Security- und Health-Checks vorhanden; Queue-Tabellen im Restore-Test beruecksichtigt | Kein zusammenhaengender Audit zu Retry, Locking, Duplication, Failure-Handling | Hoch | P2 | Worker / Queue / Retry / Locking Audit | Ja | Relevanter Zuverlaessigkeitsblock fuer Enterprise-Betrieb |
| Billing / Usage | `usage_daily`/`usage_events`-Oberflaechen existieren implizit im Datenmodell | Kein Governance-/Abrechnungs-/Usage-Audit gelesen | Mittel | P3 | Billing / Usage Governance Audit | Nein | Noch kein harter Blocker fuer reine Boundary-Arbeit |
| Customer / NOLIS Go-live | NOLIS-spezifische Gates und Golden-Question-Checks existieren | Kein kompletter Go-live-/Support-/Pilot-Checklist-Track gelesen | Mittel | P3 | Customer / NOLIS Go-live Audit | Nein | Vor kommerziellem/oeffentlichem Rollout relevant |

## Priorisierte Roadmap

### Phase 1: Process / SRE Stabilization

- `P0-Docker-1A Remote Docker Fallback Runner Plan`
- `P0-Review-1A Codex Review / Security Diff Scan Policy`
- `SRE-1A External Monitoring / Alert Routing Audit`
- `SRE-2A Backup Restore Drill Plan`

### Phase 2: Security Baseline

- `ENT-SEC-1A Enterprise Security Gap Audit`
- `ENT-SEC-2A Tenant Isolation / RBAC Review`
- `ENT-SEC-3A Admin Audit Log Scope`
- `ENT-SEC-4A Secrets Inventory / Rotation Plan`

### Phase 3: DSGVO / Privacy

- `DSGVO-1A PII Data Map`
- `DSGVO-2A Retention / DSAR Audit`
- `DSGVO-3A PII-safe Logging Review`
- `DSGVO-4A AVV/DPA/TOMs package`

### Phase 4: Runtime Reliability

- Worker / Queue / Retry / Locking Audit
- `EmailJobsService.enqueue Refactor Plan`
- `processPendingJobs Refactor Plan`
- Idempotency Enforcement Plan

### Phase 5: Delivery / Conversation Engine

- Delivery Wiring Decision Gate
- Webhook Execution Safety
- Conversation Engine Canary Plan
- Public Widget Rollout Plan

### Phase 6: Go-live Readiness

- SLA / SLO Definition
- Support / Incident Process
- Customer Onboarding
- NOLIS Pilot Checklist

## Recommended Next Task

Empfohlener naechster Schritt:

- `ENT-SEC-1A Retry`

Begruendung:

- die drei zuletzt production-relevanten Dependency-Drifts `body-parser`, `sharp` und `next` sind jetzt dokumentiert production-live geschlossen
- der zuvor akute Security-Dependency-Blocker fuer einen belastbaren Enterprise-Sicherheitsbaseline-Track ist damit ausgeraeumt
- der naechste sinnvolle Fokus ist deshalb wieder der zusammenhaengende Enterprise-Security-Gap-Audit fuer Admin-, RBAC-, Secret- und Prozessgrenzen

Sinnvolle Alternative:

- `SRE-1G Real External Monitor / Alert Setup Decision Gate`

Diese Alternative ist dann sinnvoll, wenn vor dem naechsten Enterprise-Security-Audit zuerst die externe Monitoring-/Alerting-Haertung formalisiert werden soll.

## Non-goals

Dieses Audit ist bewusst kein Implementierungs-, Deploy- oder DB-Auftrag.

Nicht Bestandteil dieses Schritts:

- keine Workflow-Aenderung
- kein Runtime-Code
- kein Deploy
- keine Migration
- kein SQL
- keine SQL-Dateien
- keine DB Reads oder Writes
- kein Query Runner
- keine Query Results oder Reports
- kein Cleanup, Backfill oder Enforcement
- keine Public-Widget-Aktivierung der Conversation Engine
- keine NOLIS-spezifische Core-Logik
