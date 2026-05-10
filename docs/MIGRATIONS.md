# Migrations

Die API fuehrt SQL-Migrationen ueber `DatabaseMigrationsService` beim Start automatisch aus. Migrationen liegen in `apps/api/migrations` und werden in der Dateireihenfolge angewendet.

## Lokal

```bash
npm run db:migrate
```

Oder direkt:

```bash
npm run migrate --workspace=apps/api
```

## Production Mit Docker

Empfohlene Reihenfolge:

1. Backup erstellen.
2. Neuen Code pullen.
3. `.env` pruefen.
4. Migration optional vorab ausfuehren:

```bash
docker compose run --rm api node dist/db/run-migrations.js
```

5. Services starten:

```bash
docker compose up --build -d
```

## Idempotenz

Migrationen sollen idempotent oder ueber `schema_migrations` nur einmal angewendet werden. Neue Migrationen duerfen keine bestehenden Kundendaten loeschen.

## Rollback

Es gibt aktuell keine automatische Down-Migration. Rollback bedeutet operativ:

1. Services stoppen.
2. Vorheriges Git-Release auschecken.
3. DB-Backup wiederherstellen, falls Schema inkompatibel ist.
4. Services neu bauen/starten.

## Vor Jeder Production-Migration

- `pg_dump` Backup erstellen.
- Backup-Datei verschluesselt/zugriffsgeschuetzt ablegen.
- `docker compose --env-file .env config` pruefen.
- `npm run check:api`, `npm run build:api`, `npm run test:smoke --workspace=apps/api` lokal oder in CI ausfuehren.
