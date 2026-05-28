# Incident Response Runbook

Stand: 2026-05-28

Dieses Runbook beschreibt den technischen Erstablauf bei Betriebsstoerungen und moeglichen Datenschutzvorfaellen. Es ist keine Rechtsberatung. Rechtliche Meldepflichten, Fristen und Kommunikationspflichten muessen im Einzelfall juristisch geprueft werden.

## Was ist ein technischer Incident?

Beispiele:

- API, Dashboard, Widget, Datenbank oder Redis nicht erreichbar.
- Widget startet keine Sessions.
- Leads werden nicht gespeichert oder nicht zugestellt.
- Backup, Offsite-Backup oder Restore-Check schlaegt fehl.
- Production-Health oder Job-Health meldet kritische Fehler.
- Speicherplatz, Docker-Volumes oder Zertifikate verursachen Ausfallrisiken.

## Was ist ein moeglicher Datenschutzvorfall?

Beispiele, die geprueft werden muessen:

- unberechtigter Zugriff auf Leads, Conversations oder Knowledge Sources.
- Cross-Tenant- oder Cross-Site-Zugriff.
- versehentliche Offenlegung von Chatverlaeufen, Telefonnummern, E-Mail-Adressen oder Standortdaten.
- Verlust oder unbefugter Zugriff auf Backups.
- Secrets, API-Keys oder Zugangsdaten wurden offengelegt.
- Logs oder Alerts enthalten personenbezogene Inhalte und wurden unberechtigt geteilt.

## Erste Schritte

1. Systeme stabilisieren und weiteren Schaden begrenzen.
2. Keine produktiven Daten loeschen, bevor Scope und Beweissicherung bewertet wurden.
3. Relevante Logs sichern, aber keine unnoetigen personenbezogenen Kopien erstellen.
4. Betroffene Tenants, Sites, Datenarten und Zeitraeume identifizieren.
5. Aktuellen Git-Commit, Containerstatus und letzte Deployments dokumentieren.
6. Backup- und Restore-Status pruefen.
7. Interne technische und organisatorische Verantwortliche informieren.

## Technische Erstpruefung

```bash
scripts/ops/check-production-health.sh
scripts/ops/check-job-health.sh
scripts/ops/check-last-backup.sh
scripts/ops/check-offsite-backup.sh
docker compose ps
```

Weitere Hinweise:

- `docs/ops/monitoring-runbook.md` fuer Health-, Job- und Logchecks nutzen.
- `docs/ops/backup-restore-runbook.md` fuer Backup-/Restore-Ablauf nutzen.
- Kein Restore in Produktion ohne Wartungsfenster, aktuelles Zusatzbackup und Freigabe.

## Datenschutzpruefung

Zu klaeren:

- Sind personenbezogene Daten betroffen?
- Welche Datenarten sind betroffen?
- Welche Tenants/Sites sind betroffen?
- War unberechtigter Zugriff moeglich?
- Wurden Daten veraendert, geloescht, offengelegt oder nur zeitweise nicht verfuegbar?
- Sind Backups, Logs, Alerts oder externe Dienste betroffen?
- Muss der Kunde informiert werden?
- Muss eine Meldepflicht juristisch geprueft werden?

## Kundenkommunikation vorbereiten

Keine vorschnellen Rechtsaussagen machen. Sachlich vorbereiten:

- betroffene Systeme.
- Zeitraum.
- bekannter technischer Sachstand.
- moeglich betroffene Datenarten.
- bisherige Sofortmassnahmen.
- naechste technische Schritte.
- Kontaktperson fuer Rueckfragen.

## Dokumentation

Intern dokumentieren:

- Zeitpunkt der Erkennung.
- Quelle des Alerts oder Hinweises.
- beteiligte Personen.
- betroffene Systeme/Tenants/Sites.
- technische Ursache, soweit bekannt.
- Sofortmassnahmen.
- weitere Massnahmen.
- Entscheidung, ob juristische Bewertung erforderlich ist.

## Nachbereitung

- Root-Cause-Analyse erstellen.
- Tests oder Monitoring erweitern, wenn sinnvoll.
- Secrets rotieren, falls Zugangsdaten betroffen sein koennten.
- Kundeninformation und interne Dokumentation abschliessen.
- Backup-/Restore- und Scope-Checks erneut pruefen.
- Lessons Learned in Runbooks uebernehmen.

## Wichtige Regeln

- Keine personenbezogenen Rohdaten in externe Tickets oder Chat-Tools kopieren, sofern nicht erforderlich und freigegeben.
- Keine Secret-Werte in Logs, Dokumentation oder Screenshots aufnehmen.
- Keine produktiven Daten ohne Freigabe loeschen.
- Rechtliche Meldefristen und Informationspflichten juristisch pruefen lassen.
