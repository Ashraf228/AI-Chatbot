# Retention Runbook

Stand: 2026-05-28

Dieses Runbook beschreibt den technischen Stand der Datenaufbewahrung und einen sicheren Dry-Run. Es ist keine Rechtsberatung. Es aktiviert keine automatische Loeschung und ersetzt keine finale Freigabe der Speicherfristen.

## Aktueller Befund

- Site-spezifische Retention-Werte existieren in `sites.config`:
  - `chatRetentionDays`, Standard: 90
  - `leadRetentionDays`, Standard: 365
  - `reportRetentionDays`, Standard: 365
- Es gibt einen API-`RetentionService` mit Dry-Run fuer einzelne Sites.
- Der API-`RetentionService` enthielt bereits einen taeglichen Cleanup-Cron fuer Conversations, Widget-Leads und Report-Runs.
- Der Cleanup-Cron ist ab diesem Stand sicherheitshalber per `RETENTION_CLEANUP_ENABLED=true` explizit opt-in. Ohne diese Env-Einstellung wird keine automatische Retention-Loeschung ausgefuehrt.
- Lokale DB-Backups haben aktive 14-Tage-Retention ueber `backup-postgres.sh`.
- Offsite-Backups ueber restic sind aktiv, aber restic Retention/Prune ist noch nicht aktiv.
- Fuer Offsite-Backups gibt es ein separates Dry-Run-Script: `scripts/ops/restic-retention-dry-run.sh`.

## Vorgeschlagene Speicherfristen

Die Vorschlaege stehen in `docs/legal/data-retention-policy.md`:

- Leads/Rueckrufanfragen: 90 bis 180 Tage.
- Conversations/Messages: 30 bis 180 Tage.
- E-Mail-/Webhook-Jobs: 30 bis 90 Tage.
- technische Logs: so kurz wie praktikabel.
- lokale DB-Backups: aktuell 14 Tage.
- Offsite-Backups: Vorschlag 14 taegliche + 4 woechentliche Snapshots nach separater Freigabe.
- Testdaten: zeitnah loeschen oder klar markieren.
- Billing/Usage: separat nach vertraglicher/steuerlicher Notwendigkeit pruefen.
- Knowledge Sources/Chunks: solange Vertrag/Kunde aktiv ist, danach loeschen oder zurueckgeben.
- Audit Logs: nach Sicherheits- und Nachweisbedarf pruefen.

## Dry-Run ausfuehren

Der Dry-Run gibt nur aggregierte Counts aus und loescht keine Daten:

```bash
scripts/ops/retention-dry-run.sh
```

Optionale Schwellenwerte:

```bash
CONVERSATION_RETENTION_DAYS=180 \
LEAD_RETENTION_DAYS=180 \
JOB_RETENTION_DAYS=90 \
AUDIT_RETENTION_DAYS=180 \
REPORT_RETENTION_DAYS=365 \
USAGE_REVIEW_DAYS=365 \
LOCAL_BACKUP_RETENTION_DAYS=14 \
scripts/ops/retention-dry-run.sh
```

Ausgabe:

- Datenbereich.
- vorgeschlagene Frist oder Pruefschwelle.
- Anzahl Kandidaten.
- Gesamtanzahl.
- ob automatische Loeschung aktiv ist.
- technischer Cleanup-Status.
- Scope-/Sicherheitshinweis.

Der Dry-Run gibt keine Namen, Telefonnummern, E-Mail-Adressen, Chat-Inhalte, Lead-Inhalte, Payloads oder Secret-Werte aus.

## Technischer Status je Bereich

| Bereich | Technischer Status | Automatisch aktiv? | Scope-Hinweis |
| --- | --- | --- | --- |
| Conversations | Cleanup vorbereitet, Messages fallen per FK-Cascade mit | nur bei `RETENTION_CLEANUP_ENABLED=true` | `site_id`, `tenant_id` vorhanden |
| Messages | indirekt ueber Conversation Delete | nur indirekt | Scope ueber `conversation_id` |
| Widget-Leads | Cleanup vorbereitet | nur bei `RETENTION_CLEANUP_ENABLED=true` | `site_id` vorhanden, kein eigenes `tenant_id` |
| Report-Runs | Cleanup vorbereitet | nur bei `RETENTION_CLEANUP_ENABLED=true` | `site_id` vorhanden |
| E-Mail-Jobs | kein Retention-Cleanup | nein | globale Tabelle ohne `site_id`; Policy erforderlich |
| Webhook-Jobs | kein Retention-Cleanup | nein | `tenant_id` und `site_id` vorhanden |
| Contact Requests/Tickets | manuelle Privacy-Loeschung/Anonymisierung vorhanden | nein | `tenant_id` und `site_id` vorhanden |
| Knowledge Sources/Documents/Chunks | manuelle Source-/Site-Loeschung vorhanden | nein | `tenant_id` und `site_id` vorhanden |
| Usage/Billing | kein Cleanup, bewusst separat zu pruefen | nein | `tenant_id` und `site_id` vorhanden |
| Audit Logs | kein Cleanup | nein | `tenant_id` und `site_id` vorhanden |
| lokale Backups | 14-Tage-Retention beim Backup-Lauf | ja | Dateisystem, keine Einzelpersonen-Ausgabe |
| Offsite-Backups | restic Snapshots aktiv, Retention-Dry-Run vorhanden, Prune nicht aktiv | nein | nur Tags `ai-chatbot`, `postgres`, `production`; Prune nur nach separater Freigabe |
| technische Logs | Docker/Journald separat pruefen | nicht durch App | aktuell kein App-Cleanup; keine personenbezogenen Inhalte in externe Tickets kopieren |

## Technische Logs

Server-Befund aus Schritt 11:

- Docker nutzt `json-file`.
- Fuer die laufenden App-Container sind keine `max-size`/`max-file` Log-Optionen gesetzt.
- Eine explizite journald-Retention wurde nicht gefunden.

Status ab Schritt 11.2:

- Docker-Logrotation ist in `docker-compose.yml` fuer App-Services ueber `json-file` mit `max-size=10m` und `max-file=5` konfiguriert.
- Die Konfiguration gilt fuer neu erzeugte Container; bestehende Container muessen kontrolliert recreated werden, damit `LogConfig` aktualisiert wird.
- journald-Retention ist serverseitig ueber `/etc/systemd/journald.conf.d/ai-chatbot.conf` mit `SystemMaxUse=500M` und `MaxRetentionSec=14day` begrenzt.
- Logrotation ersetzt keine fachliche Retention fuer Kunden-/Chat-/Lead-Daten.
- Keine Log-Inhalte mit personenbezogenen Daten in externe Tickets oder Chat-Tools kopieren.

## Vor Aktivierung automatischer fachlicher Loeschung

1. Speicherfristen juristisch und organisatorisch final freigeben.
2. Kunden-/Site-spezifische Werte pruefen.
3. Dry-Run in Produktion und Staging/Testdaten ausfuehren.
4. Aktuelles Backup und Offsite-Backup pruefen.
5. Scope-Tests fuer Tenant/Site ausfuehren.
6. Monitoring fuer Retention-Ergebnisse und Fehler vorbereiten.
7. `RETENTION_CLEANUP_ENABLED=true` erst nach Freigabe setzen.
8. Nach erstem Lauf Counts und Logs pruefen, ohne personenbezogene Inhalte zu exportieren.

## Offsite-Retention-Dry-Run

Offsite-Snapshots werden mit restic in der Hetzner Storage Box gespeichert. Eine echte restic-Retention ist noch nicht aktiv.

Dry-Run:

```bash
scripts/ops/restic-retention-dry-run.sh
```

Standardregel:

- `RESTIC_KEEP_DAILY=14`
- `RESTIC_KEEP_WEEKLY=4`
- Snapshot-Filter: Tags `ai-chatbot`, `postgres`, `production`

Das Script fuehrt nur `restic forget --dry-run` aus. Es fuehrt kein `prune` aus und loescht keine Snapshots.

Vor echter Aktivierung:

1. Speicher- und Backup-Konzept freigeben.
2. `scripts/ops/check-offsite-backup.sh` muss OK sein.
3. `restic check` muss OK sein.
4. Dry-Run pruefen und dokumentieren.
5. Sicherstellen, dass keine Snapshots anderer Systeme vom Tag-Filter betroffen sind.
6. Separat entscheiden, ob zusaetzlich `--keep-last` oder Monthly-Retention sinnvoll ist.
7. `prune` erst nach separater Freigabe ausfuehren.

## Aktuell nicht freigegeben

- automatische fachliche Loeschung fuer Kunden-/Chat-/Lead-Daten.
- E-Mail-/Webhook-Job-Cleanup.
- Audit-Log-Cleanup.
- Usage-/Billing-Cleanup.
- restic `forget`/`prune`.
- Loeschung einzelner Daten aus bestehenden Backups.
