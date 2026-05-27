# Backup and Restore Runbook

Stand: 2026-05-27

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
- `ai-chatbot-backup-failed.service` schreibt einen Fehler ins Journal
- externe E-Mail-/Webhook-Benachrichtigung ist noch nicht aktiv, solange kein sicheres Benachrichtigungsziel konfiguriert ist

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

Empfehlung fuer den ersten Kundengang:

- taegliches DB-Backup
- mindestens 14 Tage lokale Retention
- zusaetzlich regelmaessige externe/offsite Sicherung
- Backup-Dateien nicht oeffentlich ausliefern
- Backup-Zugriff nur fuer Server-/Admin-Zugriff

Aktuelle Retention im Backup-Script:

- `BACKUP_RETENTION_DAYS=14`
- geloescht werden nur Dateien mit Prefix `backup_postgres_*.sql.gz`
- manuelle Sonderbackups mit anderem Prefix werden nicht automatisch geloescht

## Offsite-Backup

Status am 2026-05-27: Offsite-Backup ist noch nicht aktiv.

Geprueft wurde:

- kein `restic` installiert
- kein `rclone` installiert
- kein `aws`, `s3cmd` oder `b2` CLI installiert
- keine rclone-, AWS-, B2-, restic- oder Offsite-Env-Datei gefunden
- `rsync` und `scp` sind vorhanden, aber es ist kein sicheres Ziel konfiguriert

Damit gibt es aktuell keine echte externe Backup-Kopie. Das ist vor zahlenden Kunden ein offener Betriebsblocker.

Vorbereitete Optionen:

- Hetzner Storage Box per `rsync` oder `rclone`
- S3-kompatibler Speicher per `rclone`
- `restic` mit verschluesseltem Repository

Anforderungen fuer Aktivierung:

- Credentials nur als Server-Secrets oder root-geschuetzte Env-Dateien
- Testupload mit kleiner Testdatei
- keine oeffentliche Auslieferung von Backup-Dateien
- regelmaessiger Restore-Test aus Offsite-Kopie

Empfohlener Pfad fuer den ersten Kundengang:

1. Hetzner Storage Box oder S3-kompatibles Bucket anlegen.
2. `restic` bevorzugen, damit Backups verschluesselt gespeichert werden.
3. Credentials nur in einer root-geschuetzten Datei wie `/root/AI-Chatbot/.offsite.env` oder in systemd Credentials ablegen.
4. Kleinen Testupload ausfuehren.
5. Erst danach `sync-backups-offsite.sh` oder eine restic-Integration aktivieren.
6. Restore-Test aus der Offsite-Kopie in isolierter Test-DB durchfuehren.

Keine Offsite-Skripte aktivieren, solange Ziel und Credentials fehlen.

## Externe Fehlerbenachrichtigung

Status am 2026-05-27: Externe Fehlerbenachrichtigung ist noch nicht aktiv.

Geprueft wurde:

- kein lokales `mail`, `sendmail` oder `msmtp` installiert
- kein Slack-, Discord-, Teams-, Uptime-Kuma- oder Webhook-Ziel konfiguriert
- SMTP-Variablen sind fuer App-Funktionen vorhanden, aber kein dedizierter Ops-Alert-Kanal ist eingerichtet

Aktueller Fehlerpfad:

- `ai-chatbot-backup.service` wird bei Fehlern als failed markiert
- `ai-chatbot-backup-failed.service` schreibt eine Meldung ins Systemjournal
- manuelle Pruefung:

```bash
systemctl status ai-chatbot-backup.service --no-pager
journalctl -u ai-chatbot-backup.service -n 50 --no-pager
journalctl -t ai-chatbot-backup -n 50 --no-pager
```

Das reicht fuer Demo-Betrieb, aber nicht fuer zahlende Kunden ohne regelmaessige manuelle Kontrolle oder externes Monitoring.

Empfohlene Aktivierung:

1. dediziertes Alert-Ziel anlegen, z. B. Uptime Kuma Push, Slack/Discord/Teams Webhook oder SMTP-Mailbox
2. Secret nur serverseitig speichern, nicht im Repo
3. `notify-backup-failure.sh` erst danach ergaenzen
4. systemd `OnFailure=` auf den echten Notify-Service zeigen lassen
5. Test-Alert mit ungefaehrlicher Meldung senden

## RPO/RTO

- RPO-Ziel: maximal 24 Stunden Datenverlust.
- RTO-Ziel: Wiederherstellung innerhalb weniger Stunden.

Diese Werte sind Startwerte fuer den ersten Kundengang und muessen bei zahlenden Kunden operationalisiert werden.

## Pruefrhythmus

- Backup taeglich automatisieren.
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
