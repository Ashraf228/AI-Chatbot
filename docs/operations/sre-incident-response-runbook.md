# SRE Incident Response Runbook

## Summary

Stand dieses Runbooks ist July 20, 2026.

Dieses Dokument definiert ein reines Incident-Response-Runbook fuer die Enterprise-Pilot-Readiness. Es legt fest, wie produktionsrelevante Incidents erkannt, klassifiziert, bestaetigt, eskaliert, kommuniziert, dokumentiert, mitigiert, bei Bedarf fuer einen Rollback bewertet und nachbearbeitet werden.

Der Fokus liegt auf einem kontrollierten Enterprise-Pilot mit stabiler Production Health, klaren SRE-/Security-Gates, dokumentierten Owner-Rollen und expliziten Go-/No-Go-Kriterien.

Dieser Schritt ist bewusst `DOKU_ONLY`.

Nicht Bestandteil:

- keine Alert-Integration
- keine externen Monitoring-Accounts
- keine Production-Config-Aenderung
- keine Workflow-Aenderung
- keine Runtime-Aenderung
- kein Deploy
- keine DB Reads oder Writes
- kein SQL
- keine Secrets
- keine echten Zieladressen oder Webhook-URLs

## Current Incident Response Baseline

Aus `SRE-1A`, `SRE-1B`, bestehenden Ops-Dokumenten, Health-Skripten und CI-/Fallback-Gates ergibt sich aktuell folgende Baseline:

- `scripts/ops/check-production-health.sh` ist der zentrale manuelle und deploynahe Production-Health-Gate-Check.
- API `/healthz`, Dashboard `/healthz`, Widget `loader.js`, Widget `/version.json` und der sichere Widget-Config-Pfad sind als Betriebs-Signale vorhanden.
- `production-health-synthetic` ist als sicherer Public-Widget-Config-Signalpfad dokumentiert.
- Safe Public Widget Smoke ist etabliert.
- Main-CI und Remote Docker Fallback existieren als Build- und Gate-Signale.
- `production-context audit`, Authorization Matrix und Security Boundaries sind Pflichtchecks fuer Merge-, Gate- und Release-nahe Entscheidungen.
- Security Diff Scan ist als zusaetzlicher Review-Prozess dokumentiert.
- Alert-Routing-Design aus `SRE-1B` ist vorhanden, aber nicht technisch eingerichtet.
- Severity-Modell `SEV0`, `SEV1`, `SEV2`, `SEV3` und `INFO` ist vorhanden.
- Externes Alerting ist noch nicht eingerichtet.
- Dieser Incident-Prozess wird hier definiert, aber nicht technisch implementiert.
- `DB_READ_ONLY_AUDIT` bleibt ohne explizite menschliche Freigabe blockiert.

## Incident Roles

Dieses Runbook verwendet ausschliesslich Rollen- und Platzhalterbezeichnungen.

### `incident_commander`

- Aufgabe:
  Fuehrt aktive `SEV0`- und `SEV1`-Incidents, priorisiert Entscheidungen, steuert Eskalation und Statusrhythmus.
- Aktivierung:
  Sofort bei `SEV0`, spaetestens nach Bestaetigung eines `SEV1`.
- Entscheidungskompetenz:
  Incident-Zustand, Eskalationsstufe, Kommunikationsrhythmus, ob Rollback-Entscheidung forciert werden muss.
- Eskalationspflicht:
  Muss `security_owner`, `pilot_ops_owner`, `communications_owner` und relevante technische Owner einbeziehen, wenn Kunden- oder Sicherheitswirkung vorliegt.

### `primary_on_call`

- Aufgabe:
  Erste technische Reaktion auf produktionsrelevante Alerts und Signals.
- Aktivierung:
  Bei `SEV1`, `SEV2` und operativ relevanten `SEV3`-Warnungen.
- Entscheidungskompetenz:
  Erste Triage, initiale Severity-Einschaetzung, erste Mitigation, Vorschlag zu Rollback oder Forward Fix.
- Eskalationspflicht:
  Muss bei fehlender Klarheit, Sicherheitsverdacht oder ausbleibender Stabilisierung an `backup_on_call` und `incident_commander` eskalieren.

### `backup_on_call`

- Aufgabe:
  Zweite technische Eskalationsstufe, wenn `primary_on_call` nicht bestaetigt, ueberlastet oder blockiert ist.
- Aktivierung:
  Bei unbeantworteten `SEV0`/`SEV1` und bei laenger laufenden `SEV2`.
- Entscheidungskompetenz:
  Uebernahme der Incident-Fuehrung auf technischer Ebene, wenn `primary_on_call` nicht reagieren kann.
- Eskalationspflicht:
  Muss Engpaesse transparent machen und an `incident_commander` weitergeben.

### `pilot_ops_owner`

- Aufgabe:
  Verantwortung fuer Pilot-Betrieb, taegliche Incident-/Health-Review und Pilot-Go-/No-Go-Disziplin.
- Aktivierung:
  Bei allen `SEV0`/`SEV1`, pilotrelevanten `SEV2` und Review-Zyklen.
- Entscheidungskompetenz:
  Kann den Pilot aus betrieblicher Sicht blockieren oder pausieren.
- Eskalationspflicht:
  Muss bei fehlender Owner-Abdeckung, fehlender Recovery-Baseline oder offenem Sicherheitsrisiko Pilot-Go stoppen.

### `security_owner`

- Aufgabe:
  Fuehrt Security-relevante Incidents wie Secret-Leaks, Auth-/RBAC-Anomalien, Tenant-Isolation-Risiken und Datenexpositionsverdacht.
- Aktivierung:
  Sofort bei `SEV0` mit Security-/PII-Bezug oder bei `SEV1` mit Sicherheitsverdacht.
- Entscheidungskompetenz:
  Security-Klassifikation, Scope-Begrenzung, Umgang mit sensitiven Logs, Follow-up fuer Rotation und Härtung.
- Eskalationspflicht:
  Muss Privacy- und Kommunikationspfad einbeziehen, wenn Daten oder Kundeneffekte betroffen sein koennen.

### `privacy_owner`

- Aufgabe:
  Bewertung moeglicher Datenschutz- oder PII-Auswirkungen.
- Aktivierung:
  Bei Verdacht auf Datenexposition, Log-Leak, Public-Widget-Leak oder falsch gerouteter Kommunikation.
- Entscheidungskompetenz:
  Privacy-Klassifikation, PII-Minimierung in Artefakten und Nachbearbeitung.
- Eskalationspflicht:
  Muss `security_owner` und `communications_owner` einbeziehen, wenn extern kommuniziert werden muss.

### `engineering_owner`

- Aufgabe:
  Technische Ursachenanalyse, Fix-Planung, Stabilisierung und Rollback-Unterstuetzung.
- Aktivierung:
  Bei allen `SEV1`, laenger laufenden `SEV2` und regressionsnahen Deploy-Incidents.
- Entscheidungskompetenz:
  Technische Bewertung von Forward Fix versus Rollback, Recovery-Nachweis und Folgeaufgaben.
- Eskalationspflicht:
  Muss offene technische Rest-Risiken fuer Pilot-Go transparent machen.

### `customer_success_owner`

- Aufgabe:
  Kontext fuer Pilot-Kundenwirkung, Eskalationsrelevanz und abgestimmte Kommunikationsvorbereitung.
- Aktivierung:
  Wenn Kundenwirkung bestaetigt oder wahrscheinlich ist.
- Entscheidungskompetenz:
  Bewertung, ob Pilot-Kunden informiert werden muessen.
- Eskalationspflicht:
  Muss mit `communications_owner` arbeiten und darf keine unabgestimmte Kundenkommunikation ausloesen.

### `communications_owner`

- Aufgabe:
  Steuert alle externen oder kundenbezogenen Status-Updates.
- Aktivierung:
  Bei bestaetigter oder wahrscheinlicher Kundenwirkung sowie bei Security-/Privacy-Incidents mit Aussenwirkung.
- Entscheidungskompetenz:
  Formulierung und Taktung von Statusmeldungen.
- Eskalationspflicht:
  Muss ohne technische Rohdaten, Secrets oder Kundendaten kommunizieren.

### `deploy_owner`

- Aufgabe:
  Haltet den Deploy-Kontext, den letzten Rollback-Punkt und die letzte verifizierte Release-Basis fest.
- Aktivierung:
  Bei Deploy-Regressionsincidents oder wenn ein Rollback bewertet werden muss.
- Entscheidungskompetenz:
  Stellt den technischen Deploy- und Rollback-Kontext bereit.
- Eskalationspflicht:
  Muss offenlegen, wenn Runtime-Impact, unbekannte Image-Basis oder unklare Rollback-Sicherheit vorliegen.

## Incident Channels / Placeholders

Die folgenden Ziele sind rein abstrakte Platzhalter:

- `<incident_bridge>`
- `<primary_ops_channel>`
- `<security_alert_channel>`
- `<deploy_review_channel>`
- `<daily_health_review_channel>`
- `<customer_comms_channel>`
- `<postmortem_tracker>`

Klarstellungen:

- alle Ziele sind Platzhalter
- keine realen URLs, E-Mail-Adressen, Telefonnummern oder Channel-IDs
- keine Secrets im Repo
- technische Einrichtung erst in einem separaten Implementierungsauftrag

Empfohlene Verwendung:

- `<incident_bridge>`: aktiver Kommunikationsraum fuer `SEV0`/`SEV1`
- `<primary_ops_channel>`: Standardziel fuer technische Incident- und Betriebs-Signale
- `<security_alert_channel>`: getrennte Behandlung von Security- und Privacy-bezogenen Incidents
- `<deploy_review_channel>`: deploynahe Status- und Rollback-Kommunikation
- `<daily_health_review_channel>`: taegliche oder deploybezogene Zusammenfassungen
- `<customer_comms_channel>`: nur fuer freigegebene Kundenkommunikation
- `<postmortem_tracker>`: Nachverfolgung von Incident-Nacharbeit

## Severity Classification

| Severity | Definition | Example Signals | Initial Owner | Response Target | Pilot Impact |
| --- | --- | --- | --- | --- | --- |
| `SEV0` | Kritischer Sicherheits- oder Totalausfall mit sofortigem Containment-Bedarf | data exposure, auth bypass, public widget leak with sensitive data, secret leak, full production outage | `incident_commander` + `security_owner` | sofort, maximal 15 Minuten | blockierend |
| `SEV1` | Produktionskritischer Ausfall oder hohes operatives Risiko ohne direkte Totalausfall-Exposition | API unavailable, DB unavailable, Widget chat unavailable, high 5xx rate, unexpected migration run, Production health red | `primary_on_call` | 30 Minuten | blockierend bis geklaert |
| `SEV2` | Spuerbare Degradation oder wiederholtes Betriebsproblem mit moeglicher Kundenwirkung | degraded performance, queue/job backlog, webhook/email delivery failures, repeated safe smoke failure, Redis degraded | `primary_on_call` | 4 Stunden | eingeschraenkt / beobachten |
| `SEV3` | Nicht-blockierende Warnung oder sich anbahnendes Risiko | non-blocking warning, approaching resource limits, dependency warning, intermittent latency, repeated moderate warnings | `pilot_ops_owner` oder `primary_on_call` | naechster Arbeitstag / Health Review | nicht blockierend |
| `INFO` | Reine Statusinformation ohne Incident-Pflicht | successful deploy, successful health review, successful fallback build, scheduled maintenance note | `pilot_ops_owner` | Review-Zyklus | kein Blocker |

## Incident Lifecycle

### 1. Detection

- Ziel:
  Potenziell kritisches Signal schnell erkennen.
- Verantwortliche Rolle:
  `primary_on_call` oder `pilot_ops_owner`
- Erwartete Artefakte:
  Incident-Notiz mit Zeitstempel, Signalquelle und erster Reichweiten-Einschaetzung
- Stop-/Escalation-Bedingungen:
  Sofort eskalieren, wenn Security-/PII-Verdacht, Public-Widget-Leak oder Totalausfall vorliegt

### 2. Triage

- Ziel:
  Signal bestaetigen, Fehlalarm ausschliessen und betroffene Oberflaechen eingrenzen.
- Verantwortliche Rolle:
  `primary_on_call`
- Erwartete Artefakte:
  erste Bestaetigung, betroffene Surface, ob Kundenwirkung moeglich ist
- Stop-/Escalation-Bedingungen:
  Bei unklarer Reichweite oder Sicherheitsbezug an `backup_on_call`, `security_owner` oder `incident_commander`

### 3. Severity Assignment

- Ziel:
  Einheitliche Severity nach dokumentiertem Modell vergeben.
- Verantwortliche Rolle:
  `primary_on_call`, bei `SEV0`/`SEV1` mit `incident_commander`
- Erwartete Artefakte:
  dokumentierte Severity, Begruendung, erwarteter Reaktionspfad
- Stop-/Escalation-Bedingungen:
  Unklare Severity darf Pilot-Go nicht beguenstigen; im Zweifel hoeher einstufen

### 4. Ownership

- Ziel:
  Incident-Verantwortung eindeutig zuweisen.
- Verantwortliche Rolle:
  `incident_commander` oder `pilot_ops_owner`
- Erwartete Artefakte:
  `owner_role`, `backup_owner_role`, Kommunikationsverantwortung
- Stop-/Escalation-Bedingungen:
  Fehlende Owner-Zuordnung blockiert Pilot-Go

### 5. Containment

- Ziel:
  Ausbreitung oder Folgeeffekte begrenzen.
- Verantwortliche Rolle:
  `engineering_owner` und bei Security-Verdacht `security_owner`
- Erwartete Artefakte:
  dokumentierte Sofortmassnahme, Scope-Begrenzung, offene Risiken
- Stop-/Escalation-Bedingungen:
  Wenn Containment nicht moeglich ist, Rollback-Entscheidung oder Pilot-Block eskalieren

### 6. Mitigation

- Ziel:
  Service stabilisieren oder degradierte Wirkung reduzieren.
- Verantwortliche Rolle:
  `engineering_owner`
- Erwartete Artefakte:
  Mitigation-Plan, validierte Annahmen, Rest-Risiken
- Stop-/Escalation-Bedingungen:
  Wenn kein sicherer Forward Fix existiert, Rollback bewerten

### 7. Rollback Decision

- Ziel:
  Entscheiden, ob Rollback sicherer ist als Forward Fix.
- Verantwortliche Rolle:
  `deploy_owner` + `engineering_owner`, abgestimmt mit `incident_commander`
- Erwartete Artefakte:
  Rollback-Entscheidung, bekannte Vorversion, bekannte Images, Recovery-Plan
- Stop-/Escalation-Bedingungen:
  Unklarer Rollback-Pfad ist selbst ein Pilot-Blocker

### 8. Communication

- Ziel:
  Relevante Stakeholder ohne Daten- oder Secret-Leaks informieren.
- Verantwortliche Rolle:
  `communications_owner`
- Erwartete Artefakte:
  Status-Update mit Zeitstempel, Impact, aktueller Aktion, naechstem Update
- Stop-/Escalation-Bedingungen:
  Keine Kommunikation mit Kundendaten, Secrets oder internen Token-URLs

### 9. Recovery Validation

- Ziel:
  Nachweisen, dass der Zustand wieder stabil ist.
- Verantwortliche Rolle:
  `primary_on_call` oder `engineering_owner`
- Erwartete Artefakte:
  gruenes Health-/Smoke-/Security-Signal, dokumentierter Recovery-Nachweis
- Stop-/Escalation-Bedingungen:
  Kein Incident-Closure ohne validierte Recovery

### 10. Closure

- Ziel:
  Incident formal beenden und offenen Rest-Risiken markieren.
- Verantwortliche Rolle:
  `incident_commander` oder `pilot_ops_owner`
- Erwartete Artefakte:
  Closure-Zeit, finale Severity, offene Follow-ups
- Stop-/Escalation-Bedingungen:
  Offene `SEV0`/`SEV1` oder unklare Root-Cause-Basis verhindern Closure

### 11. Post-Incident Review

- Ziel:
  Luecken, Folgeaufgaben und Pilot-Go-/No-Go-Auswirkung dokumentieren.
- Verantwortliche Rolle:
  `pilot_ops_owner` mit `engineering_owner`, `security_owner` und `communications_owner`
- Erwartete Artefakte:
  Post-Incident-Review, Follow-ups, Owner, Due Dates
- Stop-/Escalation-Bedingungen:
  Fehlende Nacharbeit bei sicherheits- oder pilotrelevanten Incidents blockiert Pilot-Go

## Detection Sources

Verfuegbare und geplante Incident-Signalquellen:

- `scripts/ops/check-production-health.sh`
- API `/healthz`
- Dashboard `/healthz`
- Widget `/version.json`
- Widget loader/config
- Safe Public Widget Smoke
- `production-health-synthetic`
- Main-CI gate
- Docker fallback gate
- `production-context audit`
- Authorization Matrix
- Security Boundaries
- Security Diff Scan
- deploy logs / rollback point
- API logs / critical error scan
- migration skip log
- secret-like log scan
- future external uptime monitors
- future alert routing

## Incident Type Playbooks

### A. Production Health Red

- Erkennung:
  `check-production-health.sh` oder konsolidierte Health-Signale schlagen fehl.
- Severity:
  mindestens `SEV1`
- erste Pruefung:
  API-, Dashboard-, Widget-, DB- und Redis-Signale auseinanderziehen
- Owner:
  `primary_on_call`, danach `incident_commander`
- Rollback-Relevanz:
  hoch bei runtime-naher Regression
- Stop-Kriterien:
  kein Pilot-Go, solange Health rot oder inkonsistent bleibt
- Recovery-Nachweis:
  Health gruenerhalten, betroffene Surface explizit validiert

### B. Public Widget Smoke Failure

- Erkennung:
  Safe Public Widget Smoke oder `production-health-synthetic` ist rot
- Severity:
  `SEV1` bei voller Nichtverfuegbarkeit, sonst `SEV2`
- erste Pruefung:
  Loader, Config, Session und Chat getrennt betrachten
- Owner:
  `primary_on_call` + `pilot_ops_owner`
- Rollback-Relevanz:
  hoch bei deploynahem Zusammenhang
- Stop-Kriterien:
  keine Kundensite mutieren, Response Shape und verbotene Felder pruefen
- Recovery-Nachweis:
  interne Safe-Testsite gruenerhalten, kein Secret-/Delivery-Feld oeffentlich

### C. API Deploy Regression

- Erkennung:
  Regression nach API-Deploy, roter Healthcheck oder Smoke-Ausfall
- Severity:
  `SEV1`, bei Totalausfall oder Leak `SEV0`
- erste Pruefung:
  API-Commit, Dashboard-/Widget-Unveraendertheit, Health und Logs pruefen
- Owner:
  `deploy_owner` + `engineering_owner`
- Rollback-Relevanz:
  hoch
- Stop-Kriterien:
  keine DB-Migration implizit annehmen, Rollback-Punkt explizit ziehen
- Recovery-Nachweis:
  Ziel-Commit, Health und Smoke stimmen wieder

### D. Secret-like Log Hit

- Erkennung:
  secret-like log scan oder kritischer Log-Hinweis
- Severity:
  `SEV0` oder `SEV1` je nach Kontext
- erste Pruefung:
  Log-Ausgabe minimieren, keine sensitiven Inhalte in Chat oder PR kopieren
- Owner:
  `security_owner`
- Rollback-Relevanz:
  falls deploynah oder oeffentliche Exposition moeglich, hoch
- Stop-Kriterien:
  kein Secret in Chat, PR oder Incident-Log replizieren
- Recovery-Nachweis:
  Scope begrenzt, Rotation-Follow-up und Exposure-Bewertung dokumentiert

### E. Auth/RBAC/Tenant-Isolation Anomaly

- Erkennung:
  Authorization-Matrix-Abweichung, Boundary-Failure oder Produktionssignal
- Severity:
  `SEV0` oder `SEV1`
- erste Pruefung:
  Public-/Tenant-Boundary und Scope-Verletzung eingrenzen
- Owner:
  `security_owner` + `engineering_owner`
- Rollback-Relevanz:
  hoch
- Stop-Kriterien:
  Pilot blockieren bis geklaert
- Recovery-Nachweis:
  Explizite Bestätigung, dass Isolation wieder intakt ist

### F. Unexpected Migration Run

- Erkennung:
  Unerwartetes Migrationssignal, Diff zwischen erwartetem und beobachtetem Zustand
- Severity:
  `SEV1`
- erste Pruefung:
  Migration Safety, letzte Migration und Count gegen bekannten Baseline-Stand pruefen
- Owner:
  `deploy_owner` + `engineering_owner`
- Rollback-Relevanz:
  hoch, aber DB-Rollback nicht implizit annehmen
- Stop-Kriterien:
  sofort Deploy-/DB-Freeze pruefen
- Recovery-Nachweis:
  Datenbankschema stabil, keine weitere unerklaerte Migration

### G. DB/Redis Health Failure

- Erkennung:
  API-Health meldet `database` oder `redis` nicht als `ok`
- Severity:
  `SEV1` oder `SEV2`
- erste Pruefung:
  nur vorhandene Health-Signale und Infrastrukturkontext verwenden
- Owner:
  `primary_on_call`
- Rollback-Relevanz:
  abhaengig von letzter Runtime-Aenderung
- Stop-Kriterien:
  kein ad-hoc DB Read, kein SQL
- Recovery-Nachweis:
  API-Health und Folge-Signale wieder stabil

### H. Queue / Job Backlog or Delivery Failure

- Erkennung:
  sichere aggregierte Betriebs-Signale zeigen Backlog oder Failure-Spike
- Severity:
  `SEV2`, ggf. `SEV1`
- erste Pruefung:
  nur sichere Signale verwenden
- Owner:
  `engineering_owner`
- Rollback-Relevanz:
  mittel bis hoch bei deploynahem Zusammenhang
- Stop-Kriterien:
  keine `email_jobs`- oder `webhook_jobs`-ad-hoc-Reads ohne Freigabe, kein Cleanup, kein Backfill
- Recovery-Nachweis:
  Backlog-/Failure-Signal normalisiert, Folgeaufgaben dokumentiert

### I. Webhook Replay / Signature Failure

- Erkennung:
  Replay-/Signature-Anomalie oder Delivery-Sicherheits-Signal
- Severity:
  `SEV1` oder `SEV2`
- erste Pruefung:
  HMAC-/Replay-Signale pruefen, keine Secrets ausgeben
- Owner:
  `security_owner` + `engineering_owner`
- Rollback-Relevanz:
  abhaengig vom Aenderungskontext
- Stop-Kriterien:
  keine sensitiven Header oder Secrets dokumentieren
- Recovery-Nachweis:
  Delivery-Safety wieder stabil, Follow-up fuer Härtung festgelegt

### J. Security Audit Failure

- Erkennung:
  `production-context audit` meldet High/Critical oder ungeklaerte Findings
- Severity:
  mindestens `SEV1` fuer High/Critical
- erste Pruefung:
  Finding-Klasse und gueltige Exception-Lage pruefen
- Owner:
  `security_owner`
- Rollback-Relevanz:
  abhaengig vom runtime-nahen Ursprung
- Stop-Kriterien:
  High/Critical blockiert, Moderate nur mit dokumentierter Exception und Follow-up
- Recovery-Nachweis:
  Audit wieder gruenerhalten oder sauber begruendete Ausnahme dokumentiert

## Rollback Decision Checklist

- Ist die Aenderung runtime-relevant?
- Ist der letzte Deploy-Commit bekannt?
- Ist das vorherige Image bekannt?
- Gibt es DB-Migrationen?
- Wurden Auto-Migrationen ausgefuehrt?
- Ist DB-Rollback noetig oder verboten?
- Sind Dashboard oder Widget betroffen?
- Ist Public Widget Smoke rot?
- Ist Rollback sicherer als Forward Fix?
- Wer trifft die Rollback-Entscheidung?
- Wie wird Recovery validiert?

Wichtig:

- dieses Runbook fuehrt keinen Rollback aus
- dieses Runbook beschreibt nur die Entscheidung

## Communication Rules

- Keine Kundendaten in Incident-Logs.
- Keine Secrets in Chat, PR, Tickets oder Statusmeldungen.
- Keine internen URLs mit Tokens.
- Kundenkommunikation nur ueber `communications_owner`.
- Pilot-Kunden nur informieren, wenn Impact bestaetigt oder wahrscheinlich ist.
- Security- oder PII-Incidents separat eskalieren.
- Status-Updates enthalten Zeitstempel, Impact, aktuelle Aktion und naechstes Update.
- Technische Rohlogs werden nicht in Kommunikationskanaele kopiert.

## Incident Log Template

```text
incident_id:
timestamp_detected:
severity:
signal_source:
affected_surface:
suspected_scope:
customer_impact:
data_exposure_suspected:
owner_role:
backup_owner_role:
immediate_action:
rollback_considered:
rollback_decision:
recovery_validation:
current_status:
next_update_due:
follow_ups:
closure_time:
```

Keine echten Daten dokumentieren.

## Post-Incident Review Template

```text
summary:
timeline:
detection_gap:
response_gap:
customer_impact:
security_privacy_impact:
root_cause_if_known:
what_went_well:
what_failed:
follow_up_tasks:
owners:
due_dates:
pilot_go_no_go_impact:
```

## Pilot Go/No-Go Incident Criteria

Pilot Go ist blockiert bei:

- offener `SEV0`
- ungeklaerter `SEV1`
- High/Critical Security Finding
- Secret leak
- Public Widget Leak
- Auth-/RBAC-/Tenant-Isolation-Luecke
- unklarer Production Config
- unzuverlaessigen Health-Signalen
- fehlendem Rollback-Pfad fuer Runtime-Deploys
- fehlenden Ownern fuer `SEV0` oder `SEV1`

Pilot kann weiterlaufen bei:

- `SEV3` oder `INFO`
- dokumentierten nicht-blockierenden Warnings
- bekannten Moderate Findings mit gueltiger Exception und Follow-up
- erfolgreich validiertem Recovery

## Daily / Deploy-Time Incident Review

Der taegliche oder deploybezogene Review bleibt `DOKU_ONLY` und basiert auf sicheren Signalen:

- offene `SEV0`, `SEV1` und `SEV2`
- Production Health
- Widget Smoke
- Security Audit
- pending rollback decisions
- known warnings
- open follow-ups

Nicht Bestandteil:

- keine DB Reads
- kein Query Runner
- keine Reports mit Daten

## Relationship to Existing Gates

- `SRE-1A` liefert das Monitoring-/Alerting-Audit.
- `SRE-1B` liefert das Routing Design.
- `SRE-1C` liefert das Incident Response Runbook.
- Docker fallback gate ist ein Build-Gate, kein Deploy.
- Security Diff Scan ist ein Review-Gate, kein Testersatz.
- Deploy-Gates bleiben separat.
- `DB_READ_ONLY_AUDIT` bleibt ohne Human Approval blockiert.

## Implementation Roadmap

### Phase 1

- `SRE-1D External Uptime Monitor Design`
- `SRE-1E Pilot Health Review Checklist`

### Phase 2

- `SRE-1F Minimal Alert Integration Plan`

### Phase 3

- `SRE-2A Backup Restore Drill Plan`

## Stop Boundaries

Explizit ausserhalb dieses Runbooks:

- dieses Runbook richtet keine Alerts ein
- dieses Runbook aendert keine Production Config
- dieses Runbook erstellt keine externen Accounts
- dieses Runbook speichert keine Secrets
- dieses Runbook deployt nichts
- dieses Runbook liest keine DB
- dieses Runbook fuehrt kein SQL aus
- dieses Runbook erzeugt keine Reports mit Daten
- dieses Runbook aendert keine Public Widget Response

## Recommended Next Step

Empfehlung:

- `SRE-1D External Uptime Monitor Design`

Alternative:

- `SRE-1E Pilot Health Review Checklist`

## Non-goals

- keine Implementierung
- keine externen Monitoring-Accounts
- keine Secret-Erstellung
- kein Deploy
- kein DB-Zugriff
- kein SQL
- keine Runtime-Aenderung
- keine Kundendaten
