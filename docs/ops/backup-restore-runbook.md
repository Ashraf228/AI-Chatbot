# Backup and Restore Runbook

Stand: 2026-05-28

Dieses Runbook beschreibt den technischen Mindestprozess fuer PostgreSQL-Backups und Restore-Tests. Es enthaelt keine Secrets und ersetzt kein externes Disaster-Recovery-Konzept.

## Aktueller Ist-Zustand

- Primaere Datenquelle ist PostgreSQL im Docker-Volume `ai-chatbot_pgdata`.
- Redis nutzt AOF und wird fuer Cache, Rate Limits und Queue-nahe Daten verwendet. Redis ist aktuell nicht die primaere Kundendatenquelle.
- PDF-, FAQ-, URL- und Manual-Inhalte werden als Knowledge Sources, Documents und Chunks in PostgreSQL gespeichert.
- TLS-Zertifikate und `.env` liegen als Betriebsdaten ausserhalb des Git-Trackings und muessen separat gesichert werden.
- Vor Schritt 6 war auf dem Server ein aelteres manuelles SQL-Backup vorhanden. Eine erkennbare taegliche App-Backup-Automatisierung war nicht aktiv.

## Muss gesichert werden

- `tenants`, `tenant_users`
- `sites`, `site_modules`, Widget-Konfiguration und erlaubte Domains
- `conversations`, `messages`, `widget_sessions`
- `widget_leads`
- `knowledge_sources`, `documents`, `chunks`
- `integration_connections`
- `email_jobs`, `webhook_jobs`
- `usage_daily`, `usage_events`
- `plans`, `tenant_subscriptions`
- `schema_migrations`
- `.env` und Deployment-Konfiguration separat, nicht im Git
- TLS-/Proxy-Konfiguration und Zertifikate separat, nicht im Git

## Kann neu erzeugt werden oder ist temporaer

- Docker Images koennen aus Git neu gebaut werden.
- Dashboard-, API- und Widget-Build-Artefakte koennen neu erzeugt werden.
- Redis-Daten sind fuer den aktuellen Betrieb hilfreich, aber nicht die primaere Quelle fuer Leads, Sites, Conversations oder Knowledge.
- Node Modules und Build Caches werden nicht gesichert.

## Manuelles Backup erstellen

Auf dem Server im Repository:

```bash
scripts/ops/backup-postgres.sh
```

Wichtige Eigenschaften:

- nutzt `docker compose` und die vorhandene `.env`, ohne Secrets auszugeben
- erzeugt ein komprimiertes `*.sql.gz`
- setzt restriktive Dateirechte (`600`)
- bricht ab, wenn die Backup-Datei unerwartet klein ist
- loescht optional alte Backups nur mit dem gleichen Prefix `backup_postgres_*.sql.gz`

Optionale Variablen:

```bash
BACKUP_DIR=/root/AI-Chatbot/backups
BACKUP_RETENTION_DAYS=14
BACKUP_PREFIX=backup_postgres
```

## Automatisierung mit systemd

Auf dem aktuellen Server wird ein systemd Timer bevorzugt.

Versionierte Unit-Dateien:

- `scripts/ops/systemd/ai-chatbot-backup.service`
- `scripts/ops/systemd/ai-chatbot-backup.timer`
- `scripts/ops/systemd/ai-chatbot-backup-failed.service`

Installation auf dem Server:

```bash
cp scripts/ops/systemd/ai-chatbot-backup*.service /etc/systemd/system/
cp scripts/ops/systemd/ai-chatbot-backup.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ai-chatbot-backup.timer
```

Zeitplan:

- taeglich um `02:15 UTC`
- `RandomizedDelaySec=15m`
- `Persistent=true`, damit ein verpasster Lauf nachgeholt wird

Status pruefen:

```bash
systemctl list-timers ai-chatbot-backup.timer --no-pager
systemctl status ai-chatbot-backup.timer --no-pager
journalctl -u ai-chatbot-backup.service -n 50 --no-pager
```

Manuellen Lauf ohne Restore ausloesen:

```bash
systemctl start ai-chatbot-backup.service
```

Fehlerbehandlung:

- systemd markiert den Service bei Fehlern als `failed`
- `ai-chatbot-backup-failed.service` nutzt den bestehenden SMTP-Alertpfad
- Alerts enthalten technische Statusdaten, keine Backups, keine Secret-Werte und keine personenbezogenen Daten

## Backup-Healthcheck

Der Healthcheck prueft, ob ein aktuelles Backup vorhanden und nicht leer ist:

```bash
scripts/ops/check-last-backup.sh
```

Default:

- Prefix: `backup_postgres`
- maximaler Backup-Alter: 48 Stunden
- Mindestgroesse: 1000 Bytes

Optionale Variablen:

```bash
BACKUP_DIR=/root/AI-Chatbot/backups
BACKUP_PREFIX=backup_postgres
BACKUP_MAX_AGE_HOURS=48
BACKUP_MIN_SIZE_BYTES=1000
```

## Restore-Test in isolierter Datenbank

Nie direkt in die Produktionsdatenbank restoren.

```bash
scripts/ops/restore-postgres-test.sh /root/AI-Chatbot/backups/backup_postgres_YYYYMMDD_HHMM.sql.gz
```

Das Script:

- erstellt eine temporaere Datenbank mit Prefix `restore_check_`
- spielt den Dump mit `ON_ERROR_STOP=1` ein
- prueft zentrale Tabellen und Counts
- prueft, ob die Demo-Site `rohrreinigung-ffm24` vorhanden ist
- entfernt die temporaere Datenbank am Ende automatisch

## Notfall-Restore

Ein Restore in Produktion darf nur geplant erfolgen:

1. Wartungsfenster festlegen.
2. Aktuelles Zusatzbackup erstellen.
3. API, Dashboard, Widget und Reporter stoppen.
4. Produktionsdatenbank nur nach Freigabe ersetzen.
5. Backup einspielen.
6. Migrationen und App-Version gegen Git-Commit pruefen.
7. Services starten.
8. Healthchecks, Dashboard Login, Widget Config und Testchat pruefen.

Kein produktiver Restore ohne aktuelles Zusatzbackup und klare Rueckfallentscheidung.

## Retention

Aktueller Stand fuer den ersten Kundengang:

- taegliches DB-Backup
- mindestens 14 Tage lokale Retention
- zusaetzlich regelmaessige externe/offsite Sicherung ueber Hetzner Storage Box/restic
- Restore-Test aus Offsite-Kopie erfolgreich durchgefuehrt
- Backup-Dateien nicht oeffentlich ausliefern
- Backup-Zugriff nur fuer Server-/Admin-Zugriff

Aktuelle Retention im Backup-Script:

- `BACKUP_RETENTION_DAYS=14`
- geloescht werden nur Dateien mit Prefix `backup_postgres_*.sql.gz`
- manuelle Sonderbackups mit anderem Prefix werden nicht automatisch geloescht

## Offsite-Backup

Status ab Schritt 9.2: Offsite-Backup nutzt Hetzner Storage Box mit `restic`.

Eigenschaften:

- Offsite-Ziel: Hetzner Storage Box ueber SFTP/SSH
- Tool: `restic`
- lokale Quelle: `/root/AI-Chatbot/backups/backup_postgres_*.sql.gz`
- optionale Quelle: `/root/AI-Chatbot/backups/backup_manual_*.sql.gz`
- keine `.env`, keine Zertifikate, keine Logs und keine sonstigen Betriebsdaten
- restic verschluesselt Snapshots clientseitig vor dem Upload
- Credentials liegen ausserhalb des Repositories

Serverlokale Konfiguration:

- `/root/AI-Chatbot/.offsite-backup.env`
- `/root/AI-Chatbot/secrets/restic-password`
- `/root/AI-Chatbot/secrets/storagebox_ed25519`
- optionaler Fallback-Key: `/root/AI-Chatbot/secrets/storagebox_rsa`

Alle Secret-Dateien muessen `600 root:root` haben. Das Verzeichnis `/root/AI-Chatbot/secrets` muss `700 root:root` haben. Secret-Werte werden nicht dokumentiert und nicht in Logs kopiert.

Manuellen Offsite-Sync ausfuehren:

```bash
scripts/ops/sync-backups-offsite.sh
```

Dry-Run ohne Upload:

```bash
DRY_RUN=1 scripts/ops/sync-backups-offsite.sh
```

Offsite-Healthcheck:

```bash
scripts/ops/check-offsite-backup.sh
```

Der Healthcheck prueft:

- mindestens ein restic Snapshot mit Tags `ai-chatbot`, `postgres`, `production`
- juengster Snapshot standardmaessig nicht aelter als 48 Stunden
- Snapshot enthaelt `*.sql.gz` Backup-Dateien mit plausibler Mindestgroesse

Optionale Variablen:

```bash
OFFSITE_BACKUP_MAX_AGE_HOURS=48
OFFSITE_BACKUP_MIN_FILE_BYTES=1000
```

## Offsite-Automatisierung mit systemd

Versionierte Unit-Dateien:

- `scripts/ops/systemd/ai-chatbot-backup-offsite.service`
- `scripts/ops/systemd/ai-chatbot-backup-offsite.timer`
- `scripts/ops/systemd/ai-chatbot-backup-offsite-failed.service`

Installation auf dem Server:

```bash
cp scripts/ops/systemd/ai-chatbot-backup-offsite*.service /etc/systemd/system/
cp scripts/ops/systemd/ai-chatbot-backup-offsite.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ai-chatbot-backup-offsite.timer
```

Zeitplan:

- taeglich um `02:45 UTC`
- `RandomizedDelaySec=10m`
- `Persistent=true`, damit ein verpasster Lauf nachgeholt wird

Status pruefen:

```bash
systemctl list-timers ai-chatbot-backup-offsite.timer --no-pager
systemctl status ai-chatbot-backup-offsite.timer --no-pager
journalctl -u ai-chatbot-backup-offsite.service -n 50 --no-pager
```

Fehlerbehandlung:

- `ai-chatbot-backup-offsite.service` loest bei Fehlern `ai-chatbot-backup-offsite-failed.service` aus
- der Failure-Service nutzt den bestehenden SMTP-/Webhook-Alertpfad
- Alerts enthalten nur technische Statusdaten, keine Backups, keine Secret-Werte und keine personenbezogenen Daten

## Offsite-Retention

Retention ist vorbereitet, aber in Schritt 9.2 bewusst noch nicht mit `prune` aktiviert.

Empfehlung fuer den naechsten optionalen Schritt:

- 14 taegliche Snapshots behalten
- 4 woechentliche Snapshots behalten
- erst nach separater Freigabe aktivieren; Offsite-Restore-Test wurde bereits erfolgreich durchgefuehrt
- Retention nur mit Safety-Check und ohne globale Snapshot-Loeschung ausfuehren

Fachliche Daten-Retention und Kandidaten-Counts werden separat ueber das Retention-Runbook geprueft:

```bash
scripts/ops/retention-dry-run.sh
```

## Restore-Test aus Offsite-Kopie

Der Restore-Test aus einer Offsite-Kopie wurde in Schritt 9.3 erfolgreich durchgefuehrt.

Regeln:

- kein Restore in Produktion
- Offsite-Snapshot oder einzelne Backup-Datei nur in isolierte Test-DB einspielen
- danach zentrale Tabellen und Counts pruefen
- Test-DB danach entfernen
- produktive DB bleibt unveraendert

### Letzter Offsite-Restore-Test

Datum: 2026-05-28

Quelle:

- Hetzner Storage Box
- `restic` Snapshot mit Tags `ai-chatbot`, `postgres`, `production`
- wiederhergestellte Datei: `backup_postgres_*.sql.gz`

Ergebnis:

- Offsite-Snapshot wurde in ein temporaeres Verzeichnis unter `/tmp` restored.
- `gzip -t` fuer die ausgewaehlte Backup-Datei war erfolgreich.
- Restore erfolgte in eine isolierte Testdatenbank mit Prefix `restore_check_`.
- Produktive Datenbank wurde nicht veraendert.
- Temporaere Testdatenbank wurde nach der Pruefung entfernt.
- Temporaeres Restore-Verzeichnis wurde entfernt.

Gepruefte Tabellen/Objekte:

- `schema_migrations`: 21
- `tenants`: 2
- `sites`: 2
- `widget_leads`: 4
- `conversations`: 36
- `messages`: 176
- `knowledge_sources`: 3
- `chunks`: 18
- `tenant_subscriptions`: 3
- `site_modules`: 10
- `integration_connections`: 0
- `usage_daily`: 7
- `email_jobs`: 2
- `webhook_jobs`: 0
- Demo-Site `rohrreinigung-ffm24`: vorhanden

Die Counts sind Plausibilitaetswerte aus dem Restore-Test und enthalten keine personenbezogenen Inhalte. Keine Lead-Inhalte, Telefonnummern, Namen oder Chatverlaeufe wurden dokumentiert.

Naechster geplanter Restore-Test:

- monatlich
- zusaetzlich vor groesseren Releases oder vor kritischen Migrations-/Deployment-Schritten

## Externe Fehlerbenachrichtigung

Status ab Schritt 7.3: Externe Fehlerbenachrichtigung ist per SMTP aktiv, sofern die SMTP-Werte in `/root/AI-Chatbot/.env` gesetzt sind.

Aktueller Fehlerpfad:

- `ai-chatbot-backup.service` wird bei Fehlern als failed markiert
- `ai-chatbot-backup-failed.service` sendet einen Alert
- `ai-chatbot-backup-offsite.service` wird bei Fehlern als failed markiert
- `ai-chatbot-backup-offsite-failed.service` sendet einen Alert
- manuelle Pruefung:

```bash
systemctl status ai-chatbot-backup.service --no-pager
journalctl -u ai-chatbot-backup.service -n 50 --no-pager
journalctl -t ai-chatbot-backup -n 50 --no-pager
journalctl -u ai-chatbot-backup-offsite.service -n 50 --no-pager
```

## RPO/RTO

- RPO-Ziel: maximal 24 Stunden Datenverlust.
- RTO-Ziel: Wiederherstellung innerhalb weniger Stunden.

Diese Werte sind Startwerte fuer den ersten Kundengang und muessen bei zahlenden Kunden operationalisiert werden.

## Pruefrhythmus

- Backup taeglich automatisiert ausfuehren und pruefen.
- Restore-Test monatlich oder vor groesseren Releases ausfuehren.
- Nach jedem Restore-Test Counts und Demo-Site-Existenz pruefen.
- Fehlerlogging fuer Backup-Laeufe aufbewahren.

## Sicherheitsregeln

- Backups enthalten personenbezogene Daten.
- Keine Backups, Zertifikate, `.env` oder Betriebsdaten committen.
- Keine Backups in Docker Images kopieren.
- Dateirechte restriktiv halten.
- Offsite-Backups verschluesselt speichern.
- Restore-Tests nur in isolierten Testdatenbanken oder Testcontainern ausfuehren.
