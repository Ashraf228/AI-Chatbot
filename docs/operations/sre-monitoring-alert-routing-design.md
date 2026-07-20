# SRE Monitoring Alert Routing Design

## Summary

Stand dieses Designs ist July 20, 2026.

Dieses Dokument definiert ein reines Alert-Routing-Design fuer die Enterprise-Pilot-Readiness. Es baut auf `SRE-1A` auf und legt fest, welche Signals mit welcher Severity geroutet werden sollen, welche Rollen verantwortlich sind, welche Eskalationsstufen gelten und welche Mindestregeln vor dem Pilot gelten.

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

## Current Monitoring Baseline

Aus `SRE-1A`, den bestehenden Ops-Dokumenten und den vorhandenen Health-/CI-Signalen ergibt sich aktuell folgende Baseline:

- `scripts/ops/check-production-health.sh` ist als zentraler Health-Gate-Check vorhanden.
- API-, Dashboard- und Widget-Health-Signale sind vorhanden.
- `production-health-synthetic` ist als sicherer Public-Widget-Config-Signalpfad dokumentiert.
- Safe Public Widget Smoke ist etabliert.
- Main-CI und Docker-Fallback-Gate sind vorhanden.
- Security-Audits, Authorization Matrix und Security Boundaries sind vorhanden.
- Rollback-Punkte bei Runtime-/Deploy-Schritten sind dokumentiert.
- Monitoring-Gaps aus `SRE-1A` bleiben offen.
- Externes Uptime-Monitoring ist noch nicht eingerichtet.
- Alert-Routing ist noch nicht eingerichtet.

## Alert Routing Principles

- Rollen statt persoenlicher Kontaktdaten dokumentieren.
- Keine Secrets im Repo dokumentieren.
- Keine echten Webhook-URLs, Slack-/Discord-/PagerDuty-Ziele oder Mailbox-Adressen im Repo dokumentieren.
- Kein Alert-Ziel ohne separates Secret-Management und separaten Implementierungsauftrag.
- Jeder `SEV0`- und `SEV1`-Alert braucht Primary- und Backup-Zuordnung.
- Jeder deploynahe Alert braucht eine klare Go-/No-Go-Auswirkung.
- `Docker fallback gate` oder `Main-CI gate` `PASS` ist kein Deploy.
- Public Widget Smoke Failure ist pilot-relevant und darf nicht als rein informatives Signal behandelt werden.
- Security-relevante Signals muessen getrennt von allgemeinen Ops-Warnungen routebar sein.
- Alerts duerfen keine personenbezogenen Rohdaten, Secrets oder Kundendaten enthalten.
- Query-, Report-, DB- oder Cleanup-Signale bleiben ausserhalb dieses Designs, solange dafuer keine gesonderte Freigabe existiert.

## Routing Roles

Dieses Design verwendet nur Rollen- und Platzhalterbezeichnungen:

- `primary_on_call`
- `backup_on_call`
- `pilot_ops_owner`
- `security_owner`
- `privacy_owner`
- `engineering_owner`
- `customer_success_owner`
- `incident_commander`
- `communications_owner`

Rollenbedeutung:

- `primary_on_call`: erste technische Reaktion auf produktionsrelevante Alerts
- `backup_on_call`: Eskalationsstufe, wenn `primary_on_call` nicht reagiert oder bestaetigt
- `pilot_ops_owner`: Verantwortung fuer Pilot-Betrieb, taeglichen Review und Signalvollstaendigkeit
- `security_owner`: Verantwortung fuer Security-, Secret-, Auth- und Leak-bezogene Incidents
- `privacy_owner`: Verantwortung fuer moegliche Datenschutzvorfaelle und Eskalation in den Privacy-Pfad
- `engineering_owner`: Verantwortung fuer technische Ursachenanalyse, Fix-Priorisierung und Rollback-Unterstuetzung
- `customer_success_owner`: Verantwortung fuer Pilot-Kundenkommunikation nach Freigabe
- `incident_commander`: Fuehrung eines aktiven SEV0-/SEV1-Incidents
- `communications_owner`: abgestimmte Status- und Kundenkommunikation ohne technische Rohdaten

## Alert Destination Model

Zielbezeichnungen bleiben abstrakte Platzhalter:

- `primary_ops_channel`
- `security_alert_channel`
- `deploy_review_channel`
- `daily_health_review_channel`
- `incident_bridge`
- `customer_comms_channel`

Klarstellungen:

- alle Ziele sind Platzhalter
- keine realen URLs, E-Mail-Adressen, Telefonnummern oder Channel-IDs
- keine Secrets im Repo
- technische Einrichtung erst in einem separaten Implementierungsauftrag

Empfohlene Verwendung:

- `primary_ops_channel`: Standardziel fuer produktionsrelevante technische Alerts
- `security_alert_channel`: getrennte Behandlung fuer Secret-, Auth-, Leak- und Security-Signals
- `deploy_review_channel`: deploynahe Go-/No-Go- oder Post-Deploy-Signale
- `daily_health_review_channel`: taegliche oder deploybezogene Review-Zusammenfassungen
- `incident_bridge`: aktiver Incident-Kommunikationsraum fuer `SEV0`/`SEV1`
- `customer_comms_channel`: nur fuer freigegebene abgestimmte Kundenkommunikation

## Severity Routing Matrix

| Severity | Example Signals | Primary Route | Secondary Route | Response Target | Escalation | Pilot Impact |
| --- | --- | --- | --- | --- | --- | --- |
| `SEV0` | data exposure, auth bypass, full production outage, secret leak, public widget leak with sensitive data | `incident_bridge` + `security_alert_channel` | `primary_ops_channel` | sofort, maximal 15 Minuten | `incident_commander` + `security_owner` sofort aktiv | blockierend |
| `SEV1` | API unavailable, DB unavailable, widget chat unavailable, high 5xx, unexpected migration run | `primary_ops_channel` | `incident_bridge` | 30 Minuten | `primary_on_call`, danach `backup_on_call` und `pilot_ops_owner` | blockierend bis geklaert |
| `SEV2` | degraded performance, queue/job backlog, webhook/email delivery failures, repeated safe smoke failure, Redis degraded | `primary_ops_channel` | `daily_health_review_channel` | 4 Stunden | bei Wiederholung oder Kundenwirkung an `engineering_owner` und `pilot_ops_owner` | eingeschraenkt / beobachten |
| `SEV3` | non-blocking warning, approaching resource limits, dependency warning, intermittent latency | `daily_health_review_channel` | `primary_ops_channel` | naechster Arbeitstag / Review-Zyklus | bei Haefung an `pilot_ops_owner` | nicht blockierend |
| `INFO` | successful deploy, successful health review, successful fallback build, scheduled maintenance note | `deploy_review_channel` oder `daily_health_review_channel` | none | Review-Zyklus | keine Soforteskalation | kein Blocker |

## Pilot Minimum Alert Routes

Die folgenden Minimalrouten gelten als Pilot-Mindestdesign:

- API down -> `SEV1` -> `primary_on_call` + `pilot_ops_owner`
- Dashboard down -> `SEV2` oder `SEV1` je nach aktiver Pilot-Nutzung
- Widget loader/config down -> `SEV1`
- Widget chat smoke failure -> `SEV1` bei voller Nichtverfuegbarkeit, sonst `SEV2`
- DB health failure -> `SEV1`
- Redis health failure -> `SEV2`, bei API-Auswirkung `SEV1`
- unexpected migration run -> `SEV1`
- secret-like log hit -> `SEV0` oder `SEV1` je nach Inhalt und Expositionsrisiko
- high 5xx rate -> `SEV1`
- queue/job backlog -> `SEV2`
- email/webhook delivery failure spike -> `SEV2`
- auth/RBAC anomaly -> `SEV0` oder `SEV1`
- webhook replay/signature anomaly -> `SEV1` oder `SEV2`

## Deploy-Time Routing

Deploy-bezogene Routing-Regeln bleiben rein prozessual:

- vor Deploy: Health-Gate pruefen
- waehrend Deploy: Rollback-Punkt dokumentieren
- nach Deploy: Health, Widget Smoke und kritische Logs pruefen
- bei Failure:
  - Severity nach Kunden- und Oberflaechen-Impact klassifizieren
  - Rollback-Entscheidung explizit treffen
  - Incident-Log-Eintrag anlegen

Klarstellung:

- dieses Dokument startet keinen Deploy
- dieses Dokument konfiguriert keine Alerts

## Daily Pilot Health Review

Der taegliche oder deploybezogene Review bleibt `DOKU_ONLY` und basiert auf sicheren Signalen:

- production health
- widget smoke
- security audit status
- offene kritische Log-Hinweise
- offene Incident-Anzahl
- queue/job warning summary, soweit nur ueber sichere aggregierte Signals verfuegbar

Nicht Bestandteil:

- keine DB Reads
- kein Query Runner
- keine Reports mit Daten

## Incident Log Template

```text
timestamp:
severity:
signal:
affected_surface:
detected_by:
owner_role:
immediate_action:
rollback_needed_yes_no:
customer_impact_yes_no_unknown:
status:
follow_up:
```

Template-Regeln:

- keine personenbezogenen Rohdaten
- keine Secrets
- keine echten Alert-Zieladressen
- nur technische Minimalinformation

## Escalation Rules

- `SEV0` eskaliert sofort an `incident_commander` + `security_owner`.
- `SEV1` eskaliert an `primary_on_call`; wenn nicht bestaetigt, an `backup_on_call` und `pilot_ops_owner`.
- `SEV2` wird im Pilot-Review verfolgt, eskaliert aber bei Wiederholung, Kundenwirkung oder wachsender Dauer.
- `SEV3` laeuft ueber Health Review und Review-Zyklus.
- `INFO` wird nur dokumentiert.
- Fehlende Owner-Zuordnung blockiert Pilot-Go.
- Fehlende Secondary-/Backup-Zuordnung fuer `SEV0`/`SEV1` blockiert Pilot-Go.

## Pilot Go No-Go Impact

Pilot Go nur wenn:

- Alert-Routing-Design dokumentiert ist
- Owner-Rollen definiert sind
- externes Monitoring als Folgeauftrag geplant ist
- Incident-Log-Template vorhanden ist
- Rollback-Entscheidungspfad dokumentiert ist
- keine offenen `SEV0`/`SEV1` bestehen
- keine High/Critical Security Findings offen sind
- keine unklare Production Config besteht

Pilot No-Go wenn:

- keine Alert-Zustellung geplant ist
- keine Owner-Rollen definiert sind
- keine Eskalationslogik definiert ist
- Health unzuverlaessig ist
- Public Widget Smoke unzuverlaessig ist
- secret-like log hits ungeklärt bleiben
- Auth/RBAC/Tenant-Isolation-Luecken offen sind

## Implementation Roadmap

### Phase 1

- `SRE-1C Incident Response Runbook`
- `SRE-1D External Uptime Monitor Design`

### Phase 2

- `SRE-1E Minimal Alert Integration Plan`
- `SRE-1F Pilot Health Review Checklist`

### Phase 3

- `SRE-2A Backup Restore Drill Plan`

## Stop Boundaries

Explizit ausserhalb dieses Designs:

- dieses Design richtet keine Alerts ein
- dieses Design aendert keine Production Config
- dieses Design erstellt keine externen Accounts
- dieses Design speichert keine Secrets
- dieses Design deployt nichts
- dieses Design liest keine DB
- dieses Design fuehrt kein SQL aus
- dieses Design erzeugt keine Reports mit Daten

## Recommended Next Step

Empfehlung:

- `SRE-1C Incident Response Runbook`

Alternative:

- `SRE-1D External Uptime Monitor Design`

## Non-goals

- keine Implementierung
- keine externen Monitoring-Accounts
- keine Secret-Erstellung
- kein Deploy
- kein DB-Zugriff
- kein SQL
- keine Runtime-Aenderung
- keine Kundendaten
