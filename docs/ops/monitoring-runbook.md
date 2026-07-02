# Monitoring Runbook

Stand: 2026-05-28

Dieses Runbook beschreibt den minimalen Betriebscheck fuer den aktuellen Livebetrieb. Es ersetzt keine externe Monitoring-Plattform.

## Aktueller Status

- API, Dashboard, Widget, Proxy, PostgreSQL und Redis laufen in Docker Compose.
- API `/healthz` prueft Datenbank und Redis.
- Lokale taegliche PostgreSQL-Backups laufen ueber `ai-chatbot-backup.timer`.
- Lokaler Backup-Healthcheck ist vorhanden.
- Offsite-Backups laufen ueber `ai-chatbot-backup-offsite.timer`, wenn die Hetzner Storage Box/restic-Konfiguration auf dem Server gesetzt ist.
- Offsite-Backup-Healthcheck ist vorhanden.
- Externes Health-Alerting ist per SMTP angebunden, sofern die SMTP-Werte in `/root/AI-Chatbot/.env` gesetzt sind.

## Healthcheck-Skripte

Production-Health:

```bash
scripts/ops/check-production-health.sh
```

Prueft:

- API `/healthz` mit `database=ok` und `redis=ok`
- Dashboard `/login`
- Widget `loader.js`
- Widget Config fuer `rohrreinigung-ffm24`
- Privacy URL
- Docker-Container-Health fuer `api`, `dashboard`, `widget`, `proxy`, `db`, `redis`
- lokaler Backup-Healthcheck
- Offsite-Backup-Healthcheck
- Job-Healthcheck
- Speicherplatz
- aktuelle Logs auf kritische Muster, ohne Logzeilen auszugeben
- lokaler Git-Commit

Exit-Codes:

- `0`: alles OK
- `1`: kritischer Fehler
- `2`: Warnungen vorhanden

Job-Health:

```bash
scripts/ops/check-job-health.sh
```

Prueft nur aggregierte Counts:

- alte `email_jobs` mit pending/queued/retrying Status
- alte `webhook_jobs` mit pending/queued/retrying Status
- failed `email_jobs` der letzten 24 Stunden
- failed `webhook_jobs` der letzten 24 Stunden

Es werden keine Empfaenger, Payloads, Lead-Daten oder personenbezogene Inhalte ausgegeben.

Alerting:

```bash
TEST_ALERT=1 CHECK_NAME=manual-test CHECK_STATUS=OK CHECK_HINT="Manual monitoring test" scripts/ops/notify-production-health-failure.sh
```

Der Alert-Kanal nutzt SMTP aus der root-geschuetzten Datei `/root/AI-Chatbot/.env`. Es werden keine SMTP-Werte, Webhook-URLs oder Secrets im Repository gespeichert. Alerts enthalten nur technische Statusdaten: Host, Zeitpunkt, Check-Name, Status und einen kurzen Fehlerhinweis.

Production-Health-Timer:

```bash
systemctl status ai-chatbot-production-health.timer --no-pager
systemctl list-timers ai-chatbot-production-health.timer --no-pager
```

Der Timer startet `ai-chatbot-production-health.service` alle 15 Minuten. Das Wrapper-Skript sendet bei Exit-Code `1` oder `2` einen externen Alert und nutzt einen Cooldown von 3600 Sekunden, damit wiederholte Fehler keine Alert-Flut erzeugen. Exit-Code `2` steht fuer Warnungen, z. B. failed Jobs oder Disk-Warnungen.

## Manuelle Checks

Container:

```bash
docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env ps
```

API:

```bash
curl -fsS https://api.soulesmartbusiness.com/healthz
```

Dashboard:

```bash
curl -I https://app.soulesmartbusiness.com/login
```

Widget:

```bash
curl -I https://widget.soulesmartbusiness.com/loader.js
curl -fsS 'https://widget.soulesmartbusiness.com/widget/config?siteKey=rohrreinigung-ffm24'
```

Backup:

```bash
/root/AI-Chatbot/scripts/ops/check-last-backup.sh
/root/AI-Chatbot/scripts/ops/check-offsite-backup.sh
systemctl status ai-chatbot-backup.timer --no-pager
systemctl status ai-chatbot-backup-offsite.timer --no-pager
journalctl -u ai-chatbot-backup.service -n 50 --no-pager
journalctl -u ai-chatbot-backup-offsite.service -n 50 --no-pager
```

Lokale Backup-Fehler loesen ueber `ai-chatbot-backup-failed.service` denselben externen Alert-Kanal aus. Offsite-Backup-Fehler loesen ueber `ai-chatbot-backup-offsite-failed.service` denselben externen Alert-Kanal aus.

Speicherplatz:

```bash
df -h / /root/AI-Chatbot /var/lib/docker
```

Docker-Logrotation pruefen:

```bash
docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env ps
docker inspect --format '{{.Name}} {{json .HostConfig.LogConfig}}' $(docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env ps -q api)
```

Erwartung ab Schritt 11.2: `json-file` mit `max-size=10m` und `max-file=5` fuer `api`, `dashboard`, `widget`, `proxy`, `db`, `redis` und `reporter` bei neu erzeugten Containern. Bestehende Container uebernehmen diese Werte erst nach kontrolliertem Recreate.

Docker-JSON-Loggroessen pruefen, ohne Inhalte auszugeben:

```bash
for c in api dashboard widget proxy db redis; do
  id=$(docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env ps -q "$c")
  path=$(docker inspect --format '{{.LogPath}}' "$id")
  stat -c "$c %s bytes" "$path"
done
```

Journald-Retention pruefen:

```bash
journalctl --disk-usage
grep -E '^(SystemMaxUse|MaxRetentionSec)=' /etc/systemd/journald.conf.d/ai-chatbot.conf
```

Erwartung ab Schritt 11.2: `SystemMaxUse=500M` und `MaxRetentionSec=14day`. Die reproduzierbare Vorlage liegt im Repo unter `scripts/ops/systemd/ai-chatbot-journald.conf.example`; sie enthaelt keine Secrets und muss bei Bedarf serverseitig nach `/etc/systemd/journald.conf.d/ai-chatbot.conf` kopiert werden.

Logs:

```bash
docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env logs --tail=200 api
docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env logs --tail=200 widget
docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env logs --tail=200 proxy
```

Keine Logs mit personenbezogenen Daten in Tickets, Slack oder externe Tools kopieren.

## Reaktion auf Fehler

API down:

1. `docker compose ps` pruefen.
2. `journalctl` und API-Logs pruefen.
3. Datenbank- und Redis-Health pruefen.
4. Falls nach Deploy: aktuellen Git-Commit und Container-Build pruefen.

Widget down:

1. `loader.js` und `widget.js` per HTTP pruefen.
2. Proxy-Logs pruefen.
3. API `/widget/config` und `/widget/session` testen.
4. Domain-/Origin-Validation pruefen.

DB/Redis down:

1. Containerstatus pruefen.
2. Docker-Volume und Speicherplatz pruefen.
3. Keine Restore-Aktion ohne Wartungsfenster, aktuelles Zusatzbackup und Freigabe.

Failed E-Mail-/Webhook-Jobs:

1. `scripts/ops/check-job-health.sh` ausfuehren.
2. Nur Counts bewerten, keine Payloads nach extern kopieren.
3. SMTP-/Webhook-Konfiguration pruefen.
4. Leads bleiben in der Datenbank gespeichert; Zustellfehler duerfen Lead-Speicherung nicht blockieren.
5. Wenn der Production-Health-Timer wegen failed/pending Jobs alarmiert, zuerst die betroffene Queue anhand aggregierter Counts pruefen und erst danach gezielt im geschuetzten Admin-Kontext tiefer analysieren.

Backup-Fehler:

1. `systemctl status ai-chatbot-backup.service --no-pager`
2. `journalctl -u ai-chatbot-backup.service -n 100 --no-pager`
3. Speicherplatz und DB-Container pruefen.
4. Bei Offsite-Fehlern zusaetzlich `systemctl status ai-chatbot-backup-offsite.service --no-pager` und `journalctl -u ai-chatbot-backup-offsite.service -n 100 --no-pager` pruefen.
5. Nach Fix manuellen Backup-Lauf oder Offsite-Sync ausloesen.

Speicher voll:

1. `df -h` und `docker system df` pruefen.
2. Keine Backups blind loeschen.
3. Retention-Regel und Offsite-Status pruefen.
4. Erst alte Build-Caches/Images gezielt bereinigen, wenn sicher.

False Positives und Wartung:

1. Bei geplanten Wartungen Timer temporaer pausieren:

```bash
systemctl stop ai-chatbot-production-health.timer
```

2. Nach Wartung wieder aktivieren:

```bash
systemctl start ai-chatbot-production-health.timer
```

3. Bei wiederholten nicht-kritischen Warnungen Schwellenwerte nur nach Ursachenpruefung anpassen, z. B. `JOB_FAILED_WARN_COUNT`, `DISK_WARN_PERCENT` oder `ALERT_COOLDOWN_SECONDS`.
4. Alerts nie mit Lead-Daten, Chatverlaeufen, Telefonnummern oder anderen personenbezogenen Daten anreichern.

## Commit-Identitaet

API `/healthz` gibt Version, Commit, Datenbank, Redis und Uptime aus.

Der API-Commit wird aus `APP_COMMIT_SHA` gelesen. Als Fallbacks werden `BUILD_COMMIT` und `GIT_COMMIT` akzeptiert. Es werden nur Git-SHA-artige Werte ausgegeben; wenn keine Build-Env gesetzt ist oder der Wert nicht wie ein Commit aussieht, zeigt `/healthz` `commit: "unknown"`.

Empfohlener Deployment-Ablauf vor einem Rebuild:

```bash
export APP_COMMIT_SHA="$(git rev-parse HEAD)"
docker compose --project-directory /root/AI-Chatbot --env-file /root/AI-Chatbot/.env up --build -d api
```

Der Production-Healthcheck warnt, wenn der API-Commit fehlt oder `unknown` ist, und gibt weiterhin den lokalen Server-Repo-Commit aus. Dashboard und Widget haben eigene Build-Metadaten (`/healthz` beziehungsweise `/version.json`). Bei einem Dashboard-only oder Widget-only Deploy duerfen diese Werte vom API-Commit abweichen; entscheidend ist, dass der jeweils deployte Service den erwarteten Zielcommit ausweist.

## Offene Punkte vor zahlenden Kunden

- externe HTTP-Uptime-Checks fuer API, Dashboard und Widget konfigurieren
- restic Retention/Prune nach separater Freigabe aktivieren
- fachliche Retention erst nach juristischer/organisatorischer Freigabe aktivieren; vorher nur `scripts/ops/retention-dry-run.sh` nutzen
- optional Speicher-/Docker-Volume-Monitoring automatisieren
