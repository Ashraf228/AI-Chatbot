# Migrations

SQL-Migrationen liegen in `apps/api/migrations` und werden in der Dateireihenfolge angewendet. In Production fuehrt der API-Start Migrationen standardmaessig nicht automatisch aus. Production-Migrationen sollen bewusst ueber den expliziten Migrationsbefehl gestartet werden.

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
4. Migration nach Backup/Freigabe explizit ausfuehren:

```bash
docker compose run --rm api node dist/db/run-migrations.js
```

5. Services starten:

```bash
docker compose up --build -d
```

## Auto-Migration Beim API-Start

Production ist fail-safe:

- `RUN_MIGRATIONS_ON_STARTUP=false`
- `ALLOW_PRODUCTION_AUTO_MIGRATIONS=false`

Wenn `NODE_ENV=production` gesetzt ist, laeuft Auto-Migration beim API-Start nur, wenn beide Flags explizit `true` sind:

- `RUN_MIGRATIONS_ON_STARTUP=true`
- `ALLOW_PRODUCTION_AUTO_MIGRATIONS=true`

Diese Kombination ist nur fuer bewusst freigegebene Ausnahmefaelle gedacht. Der normale Production-Pfad bleibt der explizite Migrationsbefehl nach Backup, Dry-Run und Freigabe.

In Development/Staging bleibt das bisherige Verhalten kompatibel: Auto-Migration darf laufen, solange `RUN_MIGRATIONS_ON_STARTUP` nicht auf `false` gesetzt ist.

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
