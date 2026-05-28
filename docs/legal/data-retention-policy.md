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
| Offsite-Backups | Vorschlag: 14 taegliche + 4 woechentliche Snapshots | Dry-Run vorhanden; echtes restic forget/prune erst nach separater Freigabe aktivieren |
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
- Der technische Cleanup-Cron ist nur als explizites Opt-in vorgesehen und darf erst nach Freigabe mit `RETENTION_CLEANUP_ENABLED=true` laufen.
- Vorher ist nur ein read-only Dry-Run vorgesehen: `scripts/ops/retention-dry-run.sh`.
- Offsite-restic-Retention ist ebenfalls nur als Dry-Run vorbereitet: `scripts/ops/restic-retention-dry-run.sh`.
- Echtes `restic forget` ohne `--dry-run` und `restic prune` sind nicht aktiv.
- Vor Aktivierung erforderlich:
  - finale Speicherfristen je Datenart.
  - Kundenfreigabe.
  - Test gegen Tenant-/Site-Scope.
  - Dokumentation, welche Daten geloescht oder anonymisiert werden.
  - Pruefung, wie Jobs, Reports, Usage und Backups betroffen sind.
  - aktuelles lokales und Offsite-Backup pruefen.

## Offene Pruefpunkte

- finale Speicherfristen je Kundentyp und Use Case.
- gesetzliche Aufbewahrungspflichten fuer Billing/Vertrag/Kommunikation.
- Backup-Retention fuer restic.
- E-Mail-/Webhook-Job-Retention separat definieren.
- Audit-Log-Retention separat definieren.
- Umgang mit Testdaten in Demo- und Produktionsumgebungen.
- Umgang mit versehentlich eingegebenen besonders sensiblen Daten.
- Kundenwuensche fuer Export, Rueckgabe und Vertragsende.
