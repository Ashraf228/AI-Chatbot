# Backup And Restore

## PostgreSQL Backup

```bash
docker compose exec db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backups/chatbot-$(date +%F).sql
```

Empfehlung:

- taeglich fuer Production
- vor jeder Migration
- verschluesselt oder zugriffsgeschuetzt speichern
- Backup-Retention definieren

## PostgreSQL Restore

```bash
docker compose stop api dashboard reporter
docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB" < backups/chatbot-YYYY-MM-DD.sql
docker compose up -d
```

Bei Schema-Rollback auf passendes Git-Release achten.

## Docker Volumes

Postgres-Daten liegen im Compose-Volume `pgdata`. Volume-Backups sind moeglich, ersetzen aber keinen getesteten `pg_dump`-Restore.

## Redis

Redis speichert Rate-Limit- und Cache-Daten. In der aktuellen Architektur ist Redis nicht die primaere Datenquelle. Optional kann Redis ueber AOF/RDB gesichert werden, aber fuer Disaster Recovery ist PostgreSQL wichtiger.

## Test-Restore

Mindestens monatlich einen Restore in einer isolierten Umgebung testen:

1. Neues leeres Compose-Setup starten.
2. Backup einspielen.
3. API starten.
4. Healthcheck und Dashboard Login testen.
5. Einen Widget-Testchat pruefen.
