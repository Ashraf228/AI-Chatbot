# SRE Monitoring Alerting Audit

## Summary

Stand dieses Audits ist July 19, 2026.

Dieses Audit dokumentiert die aktuelle Monitoring-, Alerting-, Healthcheck- und Incident-Baseline fuer die Enterprise-Pilot-Version des Projekts. Der Fokus liegt auf Production-Betrieb, sicherem Pilot-Onboarding, nachvollziehbaren Betriebs-Signalen und den noch offenen Luecken vor einer belastbaren Pilot-Kundenansprache.

Dieser Schritt ist bewusst `DOKU_ONLY`.

Nicht Bestandteil:

- keine Monitoring-Integration
- keine Alert-Konfiguration
- keine Runtime-Aenderung
- keine Workflow-Aenderung
- keine Production-Config-Aenderung
- kein Deploy
- keine DB Reads oder Writes
- kein SQL
- keine Reports mit Daten

## Current SRE Baseline

Aus Doku, Skripten und Workflows ist aktuell belegbar:

- `scripts/ops/check-production-health.sh` ist vorhanden und bildet den zentralen manuellen beziehungsweise timerfaehigen Production-Health-Gate-Check.
- API `/healthz` ist als strukturierter Health-Endpunkt vorhanden und prueft Datenbank und Redis.
- Dashboard `/healthz` ist vorhanden und liefert service- und commit-bezogene Build-Metadaten.
- Widget `/healthz` und `/version.json` sind vorhanden; `loader.js` und `widget.js` werden separat ausgeliefert.
- `production-health-synthetic` ist als sicherer Widget-Config-Monitoring-Pfad dokumentiert und in mehreren production-validierten Refactor-Schritten als gruen nachgewiesen.
- Safe Public Widget Smoke ist dokumentiert und wird in Production-validierten Boundary-/Deploy-Schritten als eigenes Signal genutzt.
- Remote Docker Fallback ist als build-only GitHub-Workflow implementiert und per Dry Run validiert.
- Main-CI auf `pull_request` und `push` auf `main` ist etabliert.
- `production-context audit`, Authorization Matrix und Security Boundaries sind Pflichtchecks fuer Doku-, Security- und Runtime-Gates.
- Security Diff Scan ist als zusaetzlicher Review-Prozess dokumentiert.
- Rollback-Punkte werden fuer Runtime-/Deploy-Aufgaben dokumentiert.
- Migration-Safety-Gates und Post-Merge-Gates sind prozessual etabliert.
- `DB_READ_ONLY_AUDIT` bleibt ohne explizite menschliche Freigabe blockiert.

## Existing Signals

| Signal | Source | Current Status | Automated? | Pilot Use | Gap |
| --- | --- | --- | --- | --- | --- |
| API `/healthz` | `apps/api/src/health.controller.ts`, `scripts/ops/check-production-health.sh` | Vorhanden; prueft `database`, `redis`, `commit`, `uptime`, `latency` | Ja, per Health-Skript und CI/Deploy-Nachweis nutzbar | Primarer API-Liveness- und Runtime-Commit-Signalpfad | Kein externer Uptime-Alarm separat dokumentiert |
| Dashboard `/healthz` | `apps/dashboard/app/healthz/route.ts`, `scripts/ops/check-production-health.sh` | Vorhanden; liefert `service`, `commit`, `buildTime` | Ja, per Health-Skript nutzbar | Dashboard-Verfuegbarkeit und Commit-Metadaten | Kein dedizierter externer Dashboard-Alert dokumentiert |
| Widget `/version.json` | `apps/widget/nginx.conf`, `apps/widget/Dockerfile`, `scripts/ops/check-production-health.sh` | Vorhanden; liefert `service`, `commit`, `buildTime` | Teilweise; im Health-Skript als Warnsignal | Widget-Build-Metadaten und Deploy-Verifikation | Kein Alarm bei Commit-Drift oder fehlender Version separat dokumentiert |
| Widget `/healthz` | `apps/widget/nginx.conf` | Vorhanden; liefert nur `200 ok` | Nein, im Production-Health-Skript derzeit nicht separat verwendet | Einfache Host-Reachability | Kein eigenstaendiges Host-Alerting dokumentiert |
| Widget `loader.js` | `apps/widget/nginx.conf`, `scripts/ops/check-production-health.sh`, `docs/ops/monitoring-runbook.md` | Vorhanden; HTTP-Reachability wird geprueft | Ja, im Health-Skript | Fruehes Public-Widget-Verfuegbarkeitssignal | Kein permanenter externer Loader-Alert dokumentiert |
| Widget Config | `scripts/ops/check-production-health.sh`, `docs/architecture/production-health-synthetic-site-key-audit.md` | Vorhanden; `siteKey`-Drift-Checks sind dokumentiert | Ja, im Health-Skript | Public Widget Config Reachability und Drift-Guard | Kein Alarmrouting mit klaren Owners dokumentiert |
| `production-health-synthetic` | `scripts/ops/check-production-health.sh`, Architektur-/Status-Doku | Gruen dokumentiert; HTTP `200` mit passendem `siteKey` | Ja, im Health-Skript; Nachweise in Status-Doku | Sicherer Public-Widget-Signalpfad ohne Kundensite | Kein explizites permanentes externes Synthetic-Monitoring dokumentiert |
| Safe Public Widget Smoke | Produktionsvalidierte Status-/Architektur-Doku | Gruen dokumentiert, aber prozessual und aufgabenbezogen | Teilweise; aktuell eher Gate-/Ops-getrieben als dauerhaft alert-basiert | Vor/nach Deploy und bei Runtime-Aenderungen wertvoll | Kein dauerhafter Chat-Smoke-Alert dokumentiert |
| API commit verification | `docs/deployment/deployment-metadata.md`, API `/healthz`, Production-Health-Skript | Vorhanden | Teilweise; bei Healthcheck und Deploy-Pruefungen genutzt | Commit-genaue Deploy-Verifikation | Kein Alarm bei unerwartetem Commit-Mismatch |
| Dashboard commit verification | `docs/deployment/deployment-metadata.md`, Dashboard `/healthz` | Vorhanden | Teilweise | Service-spezifische Dashboard-Deploy-Pruefung | Kein dedizierter Mismatch-Alert |
| Widget commit verification | `docs/deployment/deployment-metadata.md`, `/version.json` | Vorhanden | Teilweise | Service-spezifische Widget-Deploy-Pruefung | Kein dedizierter Mismatch-Alert |
| DB connectivity signal | API `/healthz`, `check-production-health.sh` | Vorhanden; `database=ok` ist Teil des API-Health | Ja | Kritischer Produktionszustand | Kein separater externer DB-Only-Alert dokumentiert |
| Redis connectivity signal | API `/healthz`, `check-production-health.sh` | Vorhanden; `redis=ok` oder `skipped` | Ja | Kritischer Produktionszustand fuer Rate Limit / Queue-Naehe | Kein separater Redis-Only-Alert dokumentiert |
| Migration skip / no-auto-migrate signal | Enterprise-/Refactor-Status-Doku | Dokumentiert: `Auto-Migration: nein`, `db:migrate: nein` | Nein | Schutz vor unerwarteten Schema-Aktionen | Kein technischer Alert bei unerwarteter Migration dokumentiert |
| Main-CI gate | `.github/workflows/ci.yml`, `scripts/ops/codex-main-ci-gate.sh` | Vorhanden; exakter SHA-Gate-Pfad etabliert | Ja | Freigabe- und Nachweis-Signal fuer Runtime-/Deploy-Gates | Lokale `gh`-Abhaengigkeit kann `unavailable` liefern |
| Docker fallback gate | `.github/workflows/docker-fallback-gate.yml`, Dry-Run-Status-Doku | Vorhanden; Dry Run `29590305888` erfolgreich | Ja, manuell per `workflow_dispatch` | Build-only Notpfad fuer Runtime-/Post-Merge-Gates | Kein Always-on Monitoring; nur Gate-Fallback |
| `production-context audit` | `npm run security:audit:production-contexts`, CI, lokale Gates | Vorhanden; aktuell PASS dokumentiert | Ja | Verhindert High/Critical-Produktionskontext-Findings | Kein laufender Runtime-Alert, nur Gate |
| Authorization Matrix | `npm run security:check-authorization-matrix`, CI | Vorhanden; Pflichtcheck | Ja | RBAC-/Route-Schutz vor Merge/Deploy | Kein Laufzeit-Anomalie-Alert |
| Security Boundaries | `npm run test:security-boundaries`, CI | Vorhanden; Pflichtcheck | Ja | Harte Security-Basis vor Merge/Deploy | Kein Runtime-Signal fuer spaetere Drift |
| Security Diff Scan process | `docs/operations/codex-review-security-diff-scan-policy.md` | Dokumentiert | Prozessual, nicht technisch erzwungen | Review-Disziplin fuer riskantere Aenderungen | Kein technischer Enforcement- oder Alert-Kanal |
| Deploy rollback point | Runbooks, Deploy-/Status-Doku | Dokumentiert | Prozessual | Pilot-Betrieb braucht reproduzierbare Ruecksetzpunkte | Kein formaler Rollback-Drill-/Alert-Prozess dokumentiert |
| API log critical-error scan | `check-production-health.sh`, `docs/ops/monitoring-runbook.md` | Vorhanden; regex-basierter Warnpfad ohne Log-Inhalt | Ja, im Health-Skript | Fruehes Error-/Exception-Signal | Nur Pattern-Count, kein strukturiertes Error-Rate-Monitoring |
| Boundary error scan | Indirekt ueber Security-/Boundary-Tests und Log-Pattern | Teilweise vorhanden | Teilweise | Fruehes Signal fuer neue Boundary-Verletzungen | Kein dedizierter Runtime-Alert fuer Boundary-Fehlerbilder |
| `processPendingJobs` signal | `scripts/ops/check-job-health.sh`, Monitoring-Runbook | Nur indirekt ueber Queue-Backlog-/Failed-Counts | Ja, aber aggregiert | Erkennt alte/failing Email-/Webhook-Jobs | Kein dedizierter Heartbeat, Duration-, Retry- oder Locking-Alert |
| Query runner / report signal | Hard-stop / Non-goal in Doku | Absichtlich nicht vorhanden | Nein | Schutzgrenze: keine echten Query-/Report-Pfade im Pilot | Es fehlt eine explizite Auditierung, falls spaeter Reporting eingefuehrt wird |
| Backup freshness | `check-last-backup.sh`, Monitoring-Runbook | Vorhanden | Ja | Pflichtsignal fuer Betriebsfaehigkeit | Kein formal dokumentierter Restore-Drill-Nachweis im Regelbetrieb |
| Offsite backup freshness | `check-offsite-backup.sh`, Monitoring-Runbook | Vorhanden, falls Konfiguration gesetzt | Ja | Ausfallsicherheit | Abhaengig von serverseitiger Konfiguration; Ownership/Routings nicht voll auditiert |
| Disk usage | `check-production-health.sh` | Vorhanden; Warn- und Fail-Schwellen | Ja | Fruehes Infrastruktur-Signal | Kein Trend/Forecast-Alert dokumentiert |
| Container health / restart | `docker inspect`, Compose, Monitoring-Runbook | Teilweise vorhanden; aktueller Healthcheck bewertet Status/Health | Teilweise | Erkennt nicht laufende Services | Kein automatisierter Restart-Alert dokumentiert |
| Production health alert wrapper | `scripts/ops/run-production-health-with-alert.sh`, Monitoring-Runbook | Vorhanden; Cooldown und SMTP-Notify dokumentiert | Ja, sofern serverseitig eingerichtet | Aktueller zentraler Alert-Kanal fuer Health-/Warnzustand | Alert-Zustellung, Escalation Owner und Zielplattformen nicht als Pilot-Standard beschrieben |

## Missing Monitoring Alerting Areas

Die aktuell groessten Luecken fuer Enterprise-Pilot-Betrieb liegen nicht bei einzelnen lokalen Healthchecks, sondern bei dauerhaftem externem Monitoring, klarer Alert-Zustellung und definierter Eskalation.

Fehlende oder nur teilweise abgedeckte Bereiche:

- externes Uptime Monitoring fuer API, Dashboard und Widget
- eigenstaendiger API-Health-Alert
- eigenstaendiger Dashboard-Health-Alert
- eigenstaendiger Widget-Health-Alert
- Public-Widget-Config-Alert bei `siteKey`-Drift oder 404/403
- Public-Widget-Chat-Smoke-Alert
- SSL/TLS-Expiry-Alert
- Domain-/DNS-Alert
- Error-Rate-Alert
- Latency-Alert
- 5xx-Alert
- Container-Restart-Alert
- DB-Connectivity-Alert ausserhalb des kombinierten API-Health-Signals
- Redis-Connectivity-Alert ausserhalb des kombinierten API-Health-Signals
- Disk-Usage-Trend oder Storage-Forecast-Alert
- CPU-/Memory-Alert
- Queue-Backlog-Alert mit klaren Schwellwerten und Eskalation
- Email-/Webhook-Job-Failure-Alert mit Trennung nach Warn- versus Incident-Level
- Migration-unexpected-run-Alert
- Secret-leak- oder unsafe-log-Alert im Livebetrieb
- Auth-/RBAC-Anomaly-Alert
- Webhook replay/signature failure alert
- klarer Incident-Log- oder Pager-Pfad fuer Pilotphase
- definierte Owner- und Escalation-Contacts pro Alert-Klasse

## Alert Severity Model

### SEV0

- Beispiele:
  - Production down mit Datenverlust- oder Exfiltrationsverdacht
  - Auth-Bypass oder Tenant-Isolation-Bruch
  - Secret-Leak oder personenbezogene Daten im falschen Kontext
- Reaktionszeit-Ziel fuer Pilot:
  - sofort, spaetestens innerhalb von 15 Minuten
- Eskalation:
  - technische Hauptverantwortliche plus organisatorische Verantwortliche sofort einbeziehen
- Rollback-Relevanz:
  - sehr hoch; Rollback oder Containment muss unmittelbar pruefbar sein

### SEV1

- Beispiele:
  - API nicht erreichbar
  - Widget fuer Kunden nicht nutzbar
  - Dashboard down
  - Datenbank oder Redis nicht verfuegbar
  - hoher 5xx- oder Fehleranstieg
- Reaktionszeit-Ziel fuer Pilot:
  - innerhalb von 30 Minuten
- Eskalation:
  - technischer On-Call oder definierter Operations-Owner
- Rollback-Relevanz:
  - hoch; letzter stabiler Stand muss sofort identifizierbar sein

### SEV2

- Beispiele:
  - degradierter Service
  - Queue-Backlog
  - wiederholte Email-/Webhook-Job-Fehler
  - Synthetic Widget Config grenzwertig oder intermittierend
- Reaktionszeit-Ziel fuer Pilot:
  - innerhalb von 2 Stunden
- Eskalation:
  - technische Verantwortliche, bei Kundenwirkung zusaetzlich Pilot-Owner
- Rollback-Relevanz:
  - mittel; haengt von Scope und Kundenwirkung ab

### SEV3

- Beispiele:
  - Disk-Warnschwelle
  - Warnungen aus Log-Pattern-Scan
  - Commit-Metadaten `unknown`
  - Offsite-Backup-Warnungen ohne akuten Ausfall
- Reaktionszeit-Ziel fuer Pilot:
  - innerhalb eines Arbeitstags
- Eskalation:
  - Operations-/SRE-Owner
- Rollback-Relevanz:
  - niedrig bis mittel

### INFO

- Beispiele:
  - Wartungsfenster
  - bekannte nicht-blockierende Runner-/Workflow-Warnungen
  - wiederkehrende Baseline-Reports
- Reaktionszeit-Ziel fuer Pilot:
  - geplanter Review-Zyklus
- Eskalation:
  - keine sofortige Eskalation erforderlich
- Rollback-Relevanz:
  - normalerweise keine

## Enterprise Pilot Minimum Monitoring Requirements

Vor einer belastbaren Pilot-Kundenansprache sollte mindestens folgendes Niveau erreicht sein:

- externes Uptime Monitoring fuer API, Dashboard und Widget
- Health-Skript bleibt als manueller und deploynaher Gate-Check erhalten
- Public Widget Smoke mindestens vor und nach jedem Deploy
- Alert fuer API down
- Alert fuer Widget-Config- oder Chat-Smoke-Failure
- Alert fuer DB-/Redis-Health-Failure
- Alert fuer unerwartete Migration oder fehlgeschlagenen Health-Baseline-Check
- Alert fuer secret-like logs oder kritische Error-Muster
- definierter Rollback-Punkt bei jedem Deploy
- Incident-Log-Template und Incident-Owner
- definierter Eskalationskontakt fuer Pilot-Zeiten
- taeglicher oder deploybezogener Health-Review waehrend der Pilotphase

## Recommended Implementation Roadmap

### Phase 1: DOKU_ONLY Alert Design

- `SRE-1B Monitoring Alert Routing Design`
- `SRE-1C Incident Response Runbook`

Ziel:

- Alert-Ziele, Routing, Ownership, Eskalation und Pflegeprozess definieren
- keine Integration einrichten

### Phase 2: Minimal External Monitoring

- Uptime checks fuer API, Dashboard und Widget
- Alert routing zu E-Mail, Slack oder Discord je nach verfuegbarer Zielplattform
- keine Secrets im Repo

### Phase 3: Runtime Signals

- Container health und restart tracking
- DB-/Redis-Health-Trend
- Queue-/Job-backlog observation
- log anomaly patterns

### Phase 4: Pilot Operation

- weekly health review
- incident drill
- rollback drill

## Pilot Go No-Go Criteria

Pilot kann starten, wenn:

- Production Health gruen ist
- externe Uptime checks aktiv sind
- Deploy-Rollback dokumentiert ist
- Public Widget Smoke gruen ist
- keine High/Critical Security Findings offen sind
- Auth/RBAC/Tenant-Isolation Pilot-Baseline geprueft ist
- PII Data Map vorhanden ist
- Support- und Incident-Prozess definiert ist

Pilot ist blockiert, wenn:

- Health unzuverlaessig ist
- keine belastbare Alert-Zustellung existiert
- Production Config nicht nachvollziehbar ist
- Secret-Leak vorliegt
- DB-/SQL-/Report-Freigaben unklar sind
- Public Widget Leak vorliegt
- Auth/RBAC/Tenant-Isolation-Luecken ungeklaert sind

## Pilot Blockers Observed In This Audit

Die wichtigsten aktuell beobachteten Monitoring-/Alerting-Blocker fuer Pilot-Readiness sind:

- kein formal dokumentiertes externes Uptime Monitoring als Standard fuer API, Dashboard und Widget
- kein auditiertes Alert-Routing mit klaren Pilot-Ownern und Eskalationswegen
- kein dedizierter Public-Widget-Chat-Smoke-Alert
- keine formale Alert-Klassifizierung mit verbindlichen Reaktionszielen im bestehenden Ops-Prozess
- keine dokumentierte Laufzeitueberwachung fuer Container-Restarts, CPU/Memory und Error-Rate
- nur indirekte Queue-/`processPendingJobs`-Beobachtung ueber aggregierte Job-Counts
- keine explizite Alertierung fuer unerwartete Migrationen oder Konfigurationsdrift

## Existing Incident and Rollback Process

Bereits vorhanden:

- `docs/ops/incident-response-runbook.md` beschreibt technische Erstreaktion, Datenschutzpruefung, Dokumentation und Nachbereitung
- `docs/ops/monitoring-runbook.md` beschreibt manuelle Betriebschecks und Fehlerreaktionen
- Deploy- und Runtime-Gates dokumentieren Rollback-Punkte
- `docs/deployment/deployment-metadata.md` trennt API-, Dashboard- und Widget-Commit-Signale sauber

Noch offen:

- kein formalisiertes Pilot-Eskalationsmodell mit Personen oder Zielkanaelen im Repo
- kein dokumentierter regelmaessiger Incident Drill
- kein dokumentierter Rollback Drill
- keine formale SLO-/SLA-Definition

## Stop Boundaries

Explizit ausserhalb dieses Audits:

- dieses Audit richtet keine Alerts ein
- dieses Audit aendert keine Production Config
- dieses Audit deployt nichts
- dieses Audit liest keine DB
- dieses Audit fuehrt kein SQL aus
- dieses Audit erzeugt keine Reports mit Daten
- dieses Audit aendert keine Public Widget Response

## Recommended Next Step

Empfehlung:

- `SRE-1B Monitoring Alert Routing Design`

Scope:

- `DOKU_ONLY`
- Alert-Ziele, Eskalationspfade und Owner definieren
- keine Integration einrichten
- keine Secrets
- keine Production Config

Sinnvolle Alternative:

- `SRE-2A Backup Restore Drill Plan`

## Non-goals

- keine Implementierung
- keine externen Monitoring-Accounts
- keine Secret-Erstellung
- kein Deploy
- kein DB-Zugriff
- kein SQL
- keine Runtime-Aenderung
