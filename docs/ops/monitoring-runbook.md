# Monitoring Runbook

Stand: 2026-05-27

Dieses Runbook beschreibt den minimalen Betriebscheck fuer den aktuellen Livebetrieb. Es ersetzt keine externe Monitoring-Plattform.

## Aktueller Status

- API, Dashboard, Widget, Proxy, PostgreSQL und Redis laufen in Docker Compose.
- API `/healthz` prueft Datenbank und Redis.
- Lokale taegliche PostgreSQL-Backups laufen ueber `ai-chatbot-backup.timer`.
- Lokaler Backup-Healthcheck ist vorhanden.
- Externes Alerting ist noch nicht aktiv.
- Offsite-Backup ist noch nicht aktiv.

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
systemctl status ai-chatbot-backup.timer --no-pager
journalctl -u ai-chatbot-backup.service -n 50 --no-pager
```

Speicherplatz:

```bash
df -h / /root/AI-Chatbot /var/lib/docker
```

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

Backup-Fehler:

1. `systemctl status ai-chatbot-backup.service --no-pager`
2. `journalctl -u ai-chatbot-backup.service -n 100 --no-pager`
3. Speicherplatz und DB-Container pruefen.
4. Nach Fix manuellen Backup-Lauf ausloesen.

Speicher voll:

1. `df -h` und `docker system df` pruefen.
2. Keine Backups blind loeschen.
3. Retention-Regel und Offsite-Status pruefen.
4. Erst alte Build-Caches/Images gezielt bereinigen, wenn sicher.

## Commit-Identitaet

API `/healthz` gibt aktuell Version, Datenbank, Redis und Uptime aus, aber keinen Commit-Hash.

Der Production-Healthcheck gibt den lokalen Server-Repo-Commit aus. Ein API-seitiger Commit-Hash sollte spaeter ueber eine Deployment-Env wie `APP_COMMIT_SHA` oder `BUILD_COMMIT` gesetzt und in `/healthz` angezeigt werden.

## Offene Punkte vor zahlenden Kunden

- externes Alerting aktivieren, z. B. Uptime Kuma, Better Stack, Slack/Teams/Discord Webhook oder E-Mail
- Test-Alert senden und dokumentieren
- Offsite-Backup aktivieren
- Restore-Test aus Offsite-Kopie durchfuehren
- externe HTTP-Uptime-Checks fuer API, Dashboard und Widget konfigurieren
- optional Speicher-/Docker-Volume-Monitoring automatisieren
