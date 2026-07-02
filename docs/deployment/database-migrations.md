# Database Migrations

Production API startup does not run pending SQL migrations automatically by default. Production schema changes must be executed through an explicit migration command after the normal release gate.

## Production Flow

1. Review the migration diff and affected tables.
2. Create and verify a current backup.
3. Run the migration on staging or a production clone.
4. Confirm that the target app commit is compatible with the migrated schema.
5. Execute the explicit migration command.
6. Verify `schema_migrations` and expected schema objects.
7. Deploy or restart the application services.
8. Run health checks and job checks.

## Explicit Commands

From the repository root:

```bash
npm run db:migrate
```

In Docker production deployments:

```bash
docker compose run --rm api node dist/db/run-migrations.js
```

These commands intentionally run pending migrations and are separate from API server startup.

## Startup Flags

Production defaults:

```text
RUN_MIGRATIONS_ON_STARTUP=false
ALLOW_PRODUCTION_AUTO_MIGRATIONS=false
```

With `NODE_ENV=production`, API startup migrations run only when both flags are explicitly set to `true`:

```text
RUN_MIGRATIONS_ON_STARTUP=true
ALLOW_PRODUCTION_AUTO_MIGRATIONS=true
```

This override should be used only for exceptional, explicitly approved maintenance windows.

In development and staging, startup migrations remain compatible with the previous behavior unless disabled:

```text
RUN_MIGRATIONS_ON_STARTUP=false
```

## Safety Notes

- Do not store real database URLs or credentials in documentation.
- Do not rely on API startup for production schema changes.
- Keep SQL migrations additive and backward-compatible whenever possible.
- Rollback usually requires restoring a database backup if the schema is not backward-compatible.
