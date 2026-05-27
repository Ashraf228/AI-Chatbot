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
