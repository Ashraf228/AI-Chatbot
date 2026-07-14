# Codex Test Matrix

## `DOKU_ONLY`

- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

## `PURE_API_BOUNDARY`

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

## `API_RUNTIME_UNWIRED`

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

## `API_RUNTIME_WIRED`

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
- Main-CI-Gate
- Docker-Gate auf exakt Squash Commit

## `SCRIPT_CHANGE`

- `bash -n` fuer geaenderte Scripts
- `shellcheck` falls verfuegbar
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

## `PUBLIC_WIDGET_CHANGE`

- Widget build
- Loader Smoke
- Bundle Smoke
- Config Smoke
- Chat Smoke
- Response Shape Gate
- Forbidden Field Scan

## `DASHBOARD_CHANGE`

- Dashboard build/typecheck
- geaenderte UI-Tests
- relevante API-/Proxy-Regressionschecks
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`

## `DB_MIGRATION`

- separater Audit
- Migration Plan
- Rollback Plan
- Backfill Plan
- Staging/Dry Run

## `DB_DATA_CHANGE`

- expliziter Sonderauftrag
- Dry Run oder Staging-Nachweis
- Rollback/Restore-Plan

## `PRODUCTION_CONFIG_CHANGE`

- expliziter Sonderauftrag
- Config-Diff
- Rollback-Nachweis
- Post-Change-Healthcheck

## `DEPLOY_ONLY`

- Main-CI-Gate
- Docker-Gate
- Rollback-Gate
- Post-Deploy-Healthcheck

## `MONITORING_FIX`

- betroffene Monitoring-Skripte pruefen
- keine Production-Mutation ohne Sonderauftrag
- `npm run security:audit:production-contexts`
- `npm run security:check-authorization-matrix`
- `npm run test:security-boundaries`
- `git diff --check`
