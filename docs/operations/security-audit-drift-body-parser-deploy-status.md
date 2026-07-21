# Security Audit Drift Body-Parser Deploy Status

Stand: 2026-07-21

## Summary

Der produktionsrelevante Security-Drift fuer `body-parser` aus dem API-Produktionskontext ist behoben, auf `main` gemerged und per API-only-Deploy produktiv validiert. Die betroffene Advisory war `GHSA-v422-hmwv-36x6` mit Severity `low`. Der Fix aktualisierte `body-parser` von `2.2.2` auf `2.3.0`, ohne Runtime-Code, ohne `package.json`-Aenderung und ohne neue Audit-Exception.

## Implemented Change

- Package: `body-parser`
- Vorherige Version: `2.2.2`
- Live-Version nach Fix: `2.3.0`
- Advisory: `GHSA-v422-hmwv-36x6`
- Severity: `low`
- betroffener Produktionskontext: `apps/api`
- geaenderte Dateien im Fix-PR:
  - `package-lock.json`
  - `apps/api/package-lock.json`
- nicht geaendert:
  - `package.json`
  - Runtime-Code
  - API-/Dashboard-/Widget-Code
  - Migrations-/SQL-Dateien
  - Production-Config
  - Feature Flags
  - Audit-Exception-Dokumente

## Merge And Main-CI Evidence

- PR: `#117`
- PR-Status: merged
- Squash-Commit auf `main`: `df4b2617ad27cab46c0f14c65f9acb08697940a1`
- Main-CI-Run: `29822559542`
- dokumentierter Rerun-Job: `88611756841`
- exakte Gate-Ergebnisse auf dem Merge-Commit:
  - Source gate: success
  - Security audit: success
  - Docker build: success
  - Security PostgreSQL isolation: success

## Deploy Status

- Deploy-Typ: API-only
- deployed: ja
- Ziel-Commit: `df4b2617ad27cab46c0f14c65f9acb08697940a1`
- API-Commit vorher: `92c78a607386fa73a44bed8b6ede8c87e52420cf`
- API-Commit nachher: `df4b2617ad27cab46c0f14c65f9acb08697940a1`
- API-Image vorher: `sha256:37dc57843880051d6d2c7c339b13e320abb4c507137ab4fe7e68681bdb7a61e1`
- API-Image nachher: `sha256:f5783a991f5c6a7ca5c89bceba1c58aaca266c80fdc1f14a5092997a770be03b`
- API neu gebaut: ja
- API neu erstellt / neu gestartet: ja
- Dashboard-Commit unveraendert: `3a276e7f0ef898bae791638b964087780da80c4d`
- Widget-Commit unveraendert: `7378ddb53bc3588cf35be3530fcbbf5d72e58b12`
- Dashboard neu gebaut / neu gestartet: nein
- Widget neu gebaut / neu gestartet: nein
- Proxy / DB / Redis veraendert: nein
- Rollback noetig: nein

## Production Validation

- `scripts/ops/check-production-health.sh`: Exit-Code `0`
- API `/healthz`: `200`
- API-Container: running / healthy
- API-Image-Label enthaelt Ziel-Commit: ja
- live `body-parser` im API-Container: `2.3.0`
- Datenbankstatus: `ok`
- Redis-Status: `ok`
- Dashboard-Health: `200`
- Widget-Version: `200`
- `production-health-synthetic`: `200`
- `production-health-synthetic` siteKey-Match: ja
- `npm run security:audit:production-contexts`: PASS nach Fix
- Fix ist im Live-API-Image enthalten: ja

## Safe Public Widget Verification

- Safe Testsite Origin: `https://p04-internal-test-20260702102313.internal.test`
- Loader: `200`
- Bundle: `200`
- Config: `200`
- Config siteKey-Match: ja
- Session: `201`
- Chat: `201`
- Antwort neutral: ja
- Response Shape unveraendert: ja
- beobachtete Top-Level-Felder:
  - `answer`
  - `messages`
  - `parts`
  - `sessionId`
  - `sources`
- keine zusaetzlichen Debug-/Preview-/Knowledge-/Delivery-/Secret-Felder: ja

## DB And Side-Effect Safety

- Production-DB-Ziel: `chatbot`
- `soule_demo`-Drift: nein
- `RUN_MIGRATIONS_ON_STARTUP`: unset
- `ALLOW_PRODUCTION_AUTO_MIGRATIONS`: unset
- Auto-Migration beim Start: nein
- Startup-Log bestaetigt Migration-Skip: ja
- technische Smoke-Conversation: ja
- unerwartete `email_jobs`: nein
- unerwartete `webhook_jobs`: nein
- unerwartete Leads / Tickets / Ingestion-Side-Effects: nein
- Query Runner verwendet: nein
- Query Results / Reports erzeugt: nein
- Cleanup / Backfill / Enforcement: nein
- Delivery-/Integration-Execution: nein

## Security Interpretation

- Der behobene Drift war produktionsrelevant, aber `low`, und ist jetzt live beseitigt.
- Der Fix hat keinen Runtime-Pfad, keine DB-Oberflaeche und keine Produktionskonfiguration veraendert.
- Es wurde keine neue Audit-Exception eingefuehrt.
- Es bleiben keine neuen High- oder Critical-Findings aus diesem Fix-Pfad offen.

## Non-Goals

Dieser Schritt hat bewusst nicht umgesetzt:

- keinen Runtime-Code-Fix ausserhalb der Lockfiles
- keine Migration
- kein SQL
- keine SQL-Dateien
- keine DB Reads oder Writes
- keinen Query Runner
- keine Query Results oder Reports mit Daten
- keine `email_jobs`- oder `webhook_jobs`-Reads/Writes/Updates
- keinen Cleanup, Backfill oder Enforcement-Schritt
- keine Public-Widget-Aenderung
- keine Dashboard-Aenderung
- keine NOLIS-spezifische Logik
