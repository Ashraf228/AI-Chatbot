# Speicherfristen-Policy fuer KI-Chat und Lead-Erfassung

Stand: 2026-05-28

Diese Policy ist ein Vorschlag fuer die rechtliche und organisatorische Abstimmung. Sie ist keine Rechtsberatung. Speicherfristen muessen je Kunde, Zweck, Rechtsgrundlage und gesetzlicher Aufbewahrungspflicht geprueft und freigegeben werden.

## Grundsaetze

- Personenbezogene Daten nur so lange speichern, wie sie fuer den jeweiligen Zweck erforderlich sind.
- Testdaten zeitnah loeschen oder klar als Test kennzeichnen.
- Fachliche Daten, technische Logs und Backups getrennt betrachten.
- Backups koennen geloeschte Daten bis zum Ablauf der Backup-Retention enthalten.
- Automatische Loeschung erst aktivieren, wenn Fristen final abgestimmt, technisch getestet und freigegeben sind.

## Vorgeschlagene Fristen

| Datenart | Vorschlag | Begruendung/Notiz |
| --- | --- | --- |
| Leads/Rueckrufanfragen | 90 bis 180 Tage | ausreichend fuer Bearbeitung, Nachverfolgung und Qualitaetskontrolle; laenger nur bei vertraglichem Bedarf |
| Conversations/Messages | 30 bis 180 Tage | abhaengig von Support-/Nachweisbedarf des Kunden |
| E-Mail-/Webhook-Jobs | 30 bis 90 Tage | technische Nachvollziehbarkeit von Zustellungen und Fehlern |
| technische Logs | so kurz wie praktikabel | nur fuer Betrieb, Fehleranalyse und Sicherheit; keine unnoetigen personenbezogenen Inhalte |
| lokale DB-Backups | aktuell 14 Tage | bestehende lokale Retention des Backup-Skripts |
| Offsite-Backups | Vorschlag: 14 taegliche + 4 woechentliche Snapshots | erst nach separater restic Retention/Prune-Freigabe aktivieren |
| Testdaten | zeitnah loeschen oder klar markieren | keine echten personenbezogenen Testdaten verwenden |
| Billing/Usage | nach steuerlicher und vertraglicher Notwendigkeit pruefen | nicht pauschal festlegen |
| Knowledge Sources | solange Vertrag/Kunde aktiv ist | bei Vertragsende loeschen oder zurueckgeben, je Vereinbarung |
| Audit-/Betriebsnachweise | nach Sicherheits- und Nachweisbedarf pruefen | moeglichst ohne Rohdaten speichern |

## Loesch- und Exportprozess

- Site-spezifischer Export und Delete/Anonymisierung sind technisch vorbereitet.
- Conversation Export/Delete ist site- und admin-scoped.
- Lead-Loeschung erfolgt ueber Admin-/Dashboard-Funktion oder sicheren Admin-Prozess, soweit freigegeben.
- Vor Vertragsende festlegen, ob Daten geloescht, anonymisiert oder exportiert/zurueckgegeben werden.
- Backups folgen ihrer eigenen Retention und werden nicht einzeln manuell veraendert.

## Automatische Loeschung

- Automatische fachliche Loeschung wird in diesem Schritt nicht aktiviert.
- Vor Aktivierung erforderlich:
  - finale Speicherfristen je Datenart.
  - Kundenfreigabe.
  - Test gegen Tenant-/Site-Scope.
  - Dokumentation, welche Daten geloescht oder anonymisiert werden.
  - Pruefung, wie Jobs, Reports, Usage und Backups betroffen sind.

## Offene Pruefpunkte

- finale Speicherfristen je Kundentyp und Use Case.
- gesetzliche Aufbewahrungspflichten fuer Billing/Vertrag/Kommunikation.
- Backup-Retention fuer restic.
- Umgang mit Testdaten in Demo- und Produktionsumgebungen.
- Umgang mit versehentlich eingegebenen besonders sensiblen Daten.
- Kundenwuensche fuer Export, Rueckgabe und Vertragsende.
