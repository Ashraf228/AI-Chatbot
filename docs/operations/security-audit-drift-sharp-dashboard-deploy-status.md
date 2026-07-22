# Security Audit Drift Sharp Dashboard Deploy Status

Stand: 2026-07-22

## Summary

Diese Status-Doku dokumentiert den bereits abgeschlossenen Dashboard-only-Production-Deploy der `sharp`-Mitigation. Der vorherige High-Advisory `GHSA-f88m-g3jw-g9cj` im Dashboard-Production-Kontext blockiert nicht mehr, die Mitigation liegt auf `main`, und das laufende Production-Dashboard-Image enthaelt den Fix live.

Der Schritt fuehrte keine neue Audit-Exception, keine Risk Acceptance, kein Next-/Framework-Upgrade und kein `npm audit fix --force` ein. Die Produktionsumstellung war auf das Dashboard begrenzt; API, Widget, Proxy, DB und Redis blieben unveraendert. Es gab keinen API-/Widget-Deploy, kein DB-/SQL-Thema und keinen Rollback-Bedarf.

## Implemented Change

- Package: `sharp`
- Advisory: `GHSA-f88m-g3jw-g9cj`
- Severity: `high`
- betroffener Kontext: Root-/Dashboard-Production-Context
- vorheriger Pfad: `@ai-chatbot/dashboard` -> `next@16.2.9` -> `sharp@0.34.5`
- Ursache: Next Image Optimization und die optionale `sharp`-Dependency im Dashboard-Produktionspfad
- Entscheidung: Runtime-/Build-/Audit-Kontext-Mitigation statt Risk Acceptance
- Mitigation:
  - `apps/dashboard/next.config.js` setzt `images.unoptimized = true`
  - bekannte `next/image`-Logo-Nutzung wurde auf statische Assets umgestellt
  - `apps/dashboard/Dockerfile` nutzt `npm ci --omit=optional`
  - der Security-Audit-Kontext wurde an den Dashboard-Production-Installpfad angepasst
  - keine globale unsachliche Optional-Dependency-Maskierung
  - kein direkter `sharp`-Import
- nicht gemacht:
  - keine neue Audit-Exception
  - keine Risk Acceptance
  - kein Next-/Framework-Upgrade
  - kein `npm audit fix --force`

## Merge And Main-CI Evidence

- PR: `#126`
- PR-Status: merged
- Head SHA vor Merge: `05dfa8d32e41e264a7b81585520666b77f7a623f`
- Squash-Commit auf `main`: `9b74ee942215597215aaf77b23ee69d6139519ee`
- geaenderte Dateien in PR `#126`:
  - `apps/dashboard/Dockerfile`
  - `apps/dashboard/app/login/page.tsx`
  - `apps/dashboard/components/layout/BrandLogo.tsx`
  - `apps/dashboard/next.config.js`
  - `docs/security/dependency-risk-register.md`
  - `scripts/security/audit-production-contexts.sh`
- Main-CI-Run: `29877528025`
- exakte Gate-Ergebnisse auf dem Merge-Commit:
  - Source gate: success
  - Security audit: success
  - Docker build: success
  - Security PostgreSQL isolation: success
- Security Diff Scan: keine Findings

## Deploy Status

- Deploy-Art: Dashboard-only
- Deploy durchgefuehrt: ja
- Ziel-Commit: `9b74ee942215597215aaf77b23ee69d6139519ee`
- Dashboard-Commit vorher: `3a276e7f0ef898bae791638b964087780da80c4d`
- Dashboard-Commit nachher: `9b74ee942215597215aaf77b23ee69d6139519ee`
- Dashboard-Image vorher: `sha256:33f81c4173b41bff7db301ff79eb12fb241a5a9f2e3285ef98886d2779113f58`
- Dashboard-Image nachher: `sha256:7239c70845bc01d896aa9088977c9ff40538ad6867455433fca1f274bc32d9b8`
- Dashboard neu gebaut: ja
- Dashboard recreated / restarted: ja
- API neu gebaut / gestartet: nein
- Widget neu gebaut / gestartet: nein
- Proxy / DB / Redis geaendert: nein
- Rollback noetig: nein

## Production Verification

- `check-production-health`: Exit `0`
- Dashboard-Health: gruen
- Dashboard-Commit korrekt: ja
- API-Health: gruen
- API-Commit unveraendert: `df4b2617ad27cab46c0f14c65f9acb08697940a1`
- Widget-Version: gruen
- Widget-Commit unveraendert: `7378ddb53bc3588cf35be3530fcbbf5d72e58b12`
- DB-Health: gruen
- Redis-Health: gruen
- Container-Zustand:
  - `api`: healthy
  - `dashboard`: healthy
  - `widget`: healthy
  - `proxy`: healthy
  - `db`: healthy
  - `redis`: healthy

## Dashboard Mitigation Verification

- Dashboard-Image enthaelt Ziel-Commit: ja
- Dashboard-Production-Install mit `omit optional` wirksam: ja
- `/login`: `200`
- `/login` enthaelt `/_next/image`: nein
- `/soule-logo.png`: `200`
- normale Dashboard-Routen brauchen `/_next/image`: nein
- `sharp` / `Module sharp not found` im normalen Pfad: nein
- Re-Evaluation noetig, falls Dashboard Image Optimization spaeter wieder aktiviert wird: ja

## Dependency And Audit Verification

- `npm run security:audit:production-contexts`: PASS
- `sharp` High-Advisory im Production-Kontext: verschwunden
- High-/Critical-Findings: nein
- `postcss` moderate unveraendert: ja
- neue Audit-Exception: nein
- Risk Acceptance: nein
- `npm audit fix --force`: nein

## Side-Effect Safety

- API unerwartet betroffen: nein
- Widget unerwartet betroffen: nein
- Public Widget geaendert: nein
- Kundensite-Mutation: nein
- Query Runner / Reports: nein
- Cleanup / Backfill / Enforcement: nein
- Delivery-/Integration-Ausfuehrung: nein
- kritische aktuelle Dashboard-Fehler: nein
- Next/Image-Optimizer-Fehler im normalen Pfad: nein
- `sharp` / `Module sharp not found` im normalen Pfad: nein
- Secret-Leaks: nein
- Migration-Ausfuehrung: nein
- DB-/SQL-Ausfuehrung: nein

## Rollback

- Rollback-Punkt dokumentiert: ja
- vorheriger Dashboard-Commit: `3a276e7f0ef898bae791638b964087780da80c4d`
- vorheriges Dashboard-Image: `sha256:33f81c4173b41bff7db301ff79eb12fb241a5a9f2e3285ef98886d2779113f58`
- Rollback noetig: nein
- Rollback durchgefuehrt: nein

## Security Decision

- `sharp` Advisory produktiv beseitigt: ja
- Production-Context-Audit PASS: ja
- keine High-/Critical-Findings aus diesem Pfad offen: ja
- Exception hinzugefuegt: nein
- Risk Acceptance genutzt: nein
- Next-Upgrade genutzt: nein
- Runtime-/Build-Mitigation production-live: ja
- Dashboard-only-Deploy erfolgreich: ja
- API und Widget unveraendert: ja

## Stop Boundaries

Diese Doku fuehrt selbst keine operative Aktion aus. Sie dokumentiert ausschliesslich bereits gelieferte, sanitized Deploy-, Health-, Audit- und Log-Ergebnisse.

- kein Deploy
- kein Rebuild
- kein Containerstart
- keine Healthchecks
- keine Smokes
- keine neuen Log-Abfragen
- keine DB Reads
- kein SQL
- keine Query Results oder Datenreports
- keine Production-Config-Aenderung
- kein Monitoring-/Alert-Setup
- keine Public-Widget-Response-Aenderung
- keine Kundensite-Mutation

## Recommended Next Step

Empfohlener naechster Schritt:

- `DSGVO-1B-R Retry`

Sinnvolle Alternative:

- `ENT-SEC-1A Enterprise Security Gap Audit`

## Non-Goals

Dieser Schritt hat bewusst nicht umgesetzt:

- keine Implementierung
- kein Deploy
- keine DB-Zugriffe
- kein SQL
- keine Runtime-Aenderung
- keine Kundendatenverarbeitung
- keine Secrets
- kein Monitoring-/Alert-Setup
