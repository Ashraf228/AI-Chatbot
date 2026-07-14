# Repository Guidelines

## Architektur

- `apps/api` ist die NestJS-API.
- `apps/dashboard` ist das Next.js-Dashboard.
- `apps/widget` ist das React/Vite-Widget.
- `apps/reporter` enthaelt Reporting-Jobs.

## Repository-Grundregeln

- Ein Auftrag = ein Scope = ein Branch = ein PR.
- Kein Direct Push auf `main`.
- Keine PR-fremden Änderungen anfassen.
- Bei Dirty Working Tree separaten Clean Worktree verwenden.
- Keine Secrets ausgeben.
- Keine `.env`, Reports oder Backups committen.
- Keine NOLIS-spezifische Logik im Core.
- Keine Production-Aktionen ohne expliziten Deploy-Auftrag.

## Sicherheits- und Isolationsregeln

- Tenant- und Site-Isolation ist eine harte Sicherheitsgrenze.
- Jeder Dashboard-/Admin-Endpunkt mit `tenantId`, `siteId` oder Ressourcen-ID muss serverseitig gescoped werden.
- Public-Widget-Endpunkte behalten Origin-Pruefung und Rate Limits.
- Keine Secrets, Passwoerter oder personenbezogenen Testdaten in Code, Fixtures, Logs oder Dokumentation.
- Keine echten Kundenunterlagen oder externen vertraulichen Unterlagen committen.

## Change-Klassen

- `DOKU_ONLY`
- `PURE_API_BOUNDARY`
- `API_RUNTIME_UNWIRED`
- `API_RUNTIME_WIRED`
- `SCRIPT_CHANGE`
- `PUBLIC_WIDGET_CHANGE`
- `DASHBOARD_CHANGE`
- `DB_MIGRATION`
- `DB_DATA_CHANGE`
- `PRODUCTION_CONFIG_CHANGE`
- `DEPLOY_ONLY`
- `MONITORING_FIX`

## Verbotene Aktionen Ohne Sonderauftrag

- Deploy
- Migration
- SQL
- DB Reads/Writes
- `email_jobs` Reads/Writes/Updates
- `webhook_jobs` Writes
- `agent_tickets` Writes
- `widget_leads` Writes
- `processPendingJobs`
- `EmailJobsService.enqueue` Refactor
- Feature Flags
- Production Config
- Public Widget Response Change
- Conversation Engine Public Activation
- AssistantProfile Migration
- Kundensite-Mutation
- NOLIS-Hardcoding
- `docker compose up`
- Containerstart
- Secrets Output

## Pflichtchecks Je Change-Klasse

### `DOKU_ONLY`

- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

### `PURE_API_BOUNDARY`

- `npm run check:api`
- `npm run build:api`
- neuer fokussierter Test
- angrenzende Regressionstests
- `npm run test:smoke --workspace=apps/api`
- `npm run check:all`
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`
- vor Deploy: Main-CI/Docker-Gate auf exakt Squash Commit

### `API_RUNTIME_UNWIRED`

- `npm run check:api`
- `npm run build:api`
- neuer fokussierter Test
- angrenzende Regressionstests
- `npm run test:smoke --workspace=apps/api`
- `npm run check:all`
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`
- vor Deploy: Main-CI/Docker-Gate auf exakt Squash Commit

### `API_RUNTIME_WIRED`

- `npm run check:api`
- `npm run build:api`
- neuer fokussierter Test
- angrenzende Regressionstests
- `npm run test:smoke --workspace=apps/api`
- `npm run check:all`
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`
- Main-CI-Gate gruen
- Docker-Gate gruen auf exakt Squash Commit
- Rollback-Punkt dokumentiert

### `SCRIPT_CHANGE`

- `bash -n` fuer geaenderte Scripts
- `shellcheck` falls verfuegbar
- keine Secrets im Output
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

### `PUBLIC_WIDGET_CHANGE`

- Widget build
- Loader Smoke
- Bundle Smoke
- Config Smoke
- Chat Smoke
- Response Shape Gate
- Forbidden Field Scan

### `DASHBOARD_CHANGE`

- Dashboard build/typecheck
- geaenderte UI-Tests
- relevante API-/Proxy-Regressionschecks
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

### `DB_MIGRATION`

- separater Audit
- separater Migration Plan
- Rollback Plan
- Backfill Plan
- Staging/Dry Run
- keine Vermischung mit Feature-Code

### `DB_DATA_CHANGE`

- nur mit explizitem Sonderauftrag
- Write-Scope dokumentiert
- Rollback/Restore-Plan dokumentiert
- Staging/Dry Run vor Production

### `PRODUCTION_CONFIG_CHANGE`

- nur mit explizitem Sonderauftrag
- diffbarer Config-Plan
- Rollback dokumentiert
- kein Vermischen mit Runtime-Code

### `DEPLOY_ONLY`

- Main-CI-Gate gruen
- Docker-Gate gruen
- Rollback-Punkt dokumentiert
- Post-Deploy-Healthcheck dokumentiert

### `MONITORING_FIX`

- betroffene Monitoring-Skripte/Docs pruefen
- keine Production-Mutation ohne Sonderauftrag
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

## Stop-Kriterien

Codex muss sofort stoppen bei:

- Scope unklar
- unerwartete Datei im Diff
- Secret gefunden
- Runtime-Code in Doku-only-Auftrag
- SQL/Migration in Nicht-DB-Auftrag
- `email_jobs` Reads/Writes/Updates ausserhalb explizitem DB-Auftrag
- `processPendingJobs`-Aufruf ausserhalb explizitem Worker-Auftrag
- Public Widget Response Shape veraendert
- Feature Flag geaendert
- Production Config geaendert
- CI rot
- Docker-Gate fehlt bei Runtime-Code
- Dirty Tree ohne Clean Worktree
- Production Health rot
- Side Effects unerwartet
- Rollback-Punkt fehlt
- NOLIS-spezifische Logik im Core

## Definition Of Done

Ein Auftrag ist fertig, wenn:

- Scope eingehalten
- nur erwartete Dateien geaendert
- keine Secrets
- keine PR-fremden Aenderungen angefasst
- geforderte Tests gruen
- `git diff --check` gruen
- CI bewertet
- Sicherheitsstatus dokumentiert
- Non-goals bestaetigt
- naechster Schritt empfohlen

## Datenbank Und Migrationen

- Datenbankmigrationen nur additiv, wiederholbar und rueckwaertskompatibel gestalten.
- Bestehende produktive Daten nicht loeschen oder ungefragt veraendern.
- Migrationen duerfen Tenant-/Site-Isolation nicht lockern.

## Aenderungsumfang

- Keine unaufgeforderten grossen Refactorings.
- Pro Aufgabe nur den beschriebenen Umfang bearbeiten.
- Keine unbeteiligten API-, Payload-, Routing- oder UI-Aenderungen.
- Bekannte Einschraenkungen wahrheitsgemaess dokumentieren.
- Einen Demonstrator nicht als Produktionsintegration bezeichnen.

## Tests Und Qualitaet

- Fuer jede Aenderung gezielte Tests, Typechecks und relevante Produktionsbuilds ausfuehren.
- Vor Abschluss den Diff auf Regressionen, fehlende Berechtigungspruefungen, PII-/Secret-Leaks und unnoetige Aenderungen pruefen.
- Kein `npm audit fix --force`.
- Sicherheitswarnungen nicht durch Downgrades, Force-Fixes, Canary-, Beta- oder RC-Versionen umgehen.

## Stil

- UI-Texte sind deutsch.
- Codebezeichner und technische Kommentare bleiben konsistent mit dem vorhandenen Stil.
- Kommentare nur dort ergaenzen, wo sie komplexe oder sicherheitsrelevante Logik klaeren.
