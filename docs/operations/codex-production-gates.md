# Codex Production Gates

## Main-CI-Gate

- Pflicht fuer jede Aenderung mit Runtime-Auswirkung
- muss auf exakt dem geplanten Squash-Commit gruen sein

## Docker-Gate

- Pflicht fuer Runtime-Code vor Deploy
- Build- und Container-Gates muessen auf exakt dem geplanten Squash-Commit gruen sein

## Deploy-Gate

- Deploy nur mit explizitem Auftrag
- kein Deploy als Nebenwirkung eines Entwicklungsauftrags

## Migration-Gate

- Migrationen nur in `DB_MIGRATION`
- Audit, Plan, Rollback und Dry Run sind Pflicht
- nie mit Feature-Code vermischen

## Rollback-Gate

- vor Production-Aenderung muss ein klarer Rollback-Punkt dokumentiert sein
- fuer Migrationen zusaetzlich Backfill-/Restore-Plan

## Public-Widget-Gate

- jede Public-Widget-Aenderung braucht:
- Loader Smoke
- Bundle Smoke
- Config Smoke
- Chat Smoke
- Response Shape Gate
- Forbidden Field Scan

## Side-Effect-Gate

- keine unerwarteten Writes in `email_jobs`, `webhook_jobs`, `agent_tickets`, `widget_leads`
- keine ungewollten Kundensite-Mutationen
- keine unbeabsichtigte Conversation-Engine-Aktivierung im Public Widget

## Production-Config-Gate

- keine Production-Config-Aenderung ohne expliziten Auftrag
- keine Feature-Flag-Aenderung ohne expliziten Auftrag
- keine Secrets-Ausgabe
