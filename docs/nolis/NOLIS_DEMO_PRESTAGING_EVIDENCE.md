# NOLIS Demo Pre-Staging Evidence

Datum: 2026-06-24

Status: `PASS - STAGING EXECUTION AUSSTEHEND`

Externer Zugang: nicht freigegeben.

## Release-Kandidat

- Commit-SHA: `8ea1fa7e4d6d001228f0fc57c3856b3ec77efe01`
- Commit: `8ea1fa7 fix: align postgres security test site fixtures`
- Node-Version lokal: `v24.17.0`
- npm-Version lokal: `11.12.1`

## CI-Nachweis

- Workflow: CI
- Run-ID: `28122862181`
- Commit-SHA: `8ea1fa7e4d6d001228f0fc57c3856b3ec77efe01`
- Ergebnis: `success`

Jobs:

- Source Gate: `success`, completed `2026-06-24T19:07:41Z`
- Security Audit: `success`, completed `2026-06-24T19:06:20Z`
- Docker Build: `success`, completed `2026-06-24T19:06:51Z`
- Security PostgreSQL Isolation: `success`, completed `2026-06-24T19:06:29Z`

## Lokaler automatisierter Gate

- `npm ci`: PASS
- `npm run check:all`: PASS
- `npm run security:check-authorization-matrix`: PASS, 227 Routen
- `npm run test:security-boundaries`: PASS, 70 Checks
- `npm run eval:nolis-demo:validate`: PASS, 128 Faelle, 28/28 Demo Seed Keys abgedeckt
- `npm run eval:nolis-demo`: PASS, 100 Prozent, 42/42 Hard Blocker
- `npm run test:accessibility`: PASS, 2 Dateien, 10 Tests
- `npm run test:webhook-hmac`: PASS, 14 Tests
- `npm run test:analytics-contract`: PASS, 13 Tests
- `npm run test:smoke`: PASS, 332 Tests
- `npm run test:e2e`: PASS, 46 Tests
- `npm run build:all`: PASS
- `npm run security:audit:production-contexts`: PASS
- `npm audit --omit=dev --audit-level=high`: PASS
- `npm ls --all`: PASS
- `docker compose --env-file .env.example config`: PASS

## Audit- und Ausnahmestatus

- High/Critical Production Findings: keine
- Verbleibendes Finding: moderate Next/PostCSS im Root-Workspace-Audit
- Aktueller Recheck: `npm view next version dependencies.postcss --json`
- Recheck-Ergebnis: Next stable `16.2.9`, internes `postcss@8.4.31`
- Aktive Ausnahme: `docs/security/audit-exceptions.md`
- Owner: Platform Owner
- Ablaufdatum: `2026-07-03`
- Legacy-Webhook-Review bleibt sichtbar: `2026-07-24`

## Image- und Runtime-Nachweis

Die Docker-CI hat die Images fuer `api`, `dashboard`, `widget`, `reporter` und `proxy` erfolgreich gebaut. Lokale, eindeutig versionierte Image-Digests wurden in diesem Gate nicht erzeugt oder gepusht.

Bewertung:

- CI-Docker-Build: PASS
- Image-Digests fuer externe Freigabe: ausstehend
- Externer Zugang: nicht freigegeben

## Staging-Ausfuehrung

- `NOLIS_DEMO_STAGING_EXECUTE`: nicht gesetzt
- Staging-Zugangsdaten: nicht gesetzt
- Staging-Mutationen: nicht ausgefuehrt
- Produktionsdeployment: nicht ausgefuehrt

Ergebnis:

- Staging-Migrationen: ausstehend
- Backupstatus Staging: ausstehend
- Demo-Provisionierung: ausstehend
- reale Embedding-Ingestion: ausstehend
- Live-Modell-Smoke: ausstehend
- Viewer-Live-Test: ausstehend
- Ticket-Live-Test: ausstehend
- HMAC-Mock-Handoff-Live-Test: ausstehend
- Browser-/Tastatur-/Screenreader-Restpruefung: ausstehend
- Secret-/Log-Pruefung Staging: ausstehend
- Reset-Probe und finale Neuinitialisierung: ausstehend

## Demo-Skripte ohne Staging-Env

Die stagingabhaengigen Demo-Skripte wurden ohne Staging-Env nur als Preflight angestossen und brachen vor Mutation ab:

- `npm run demo:verify:evaluation`: Abbruch wegen fehlender Demo-Environment-Konfiguration
- `npm run demo:provision:evaluation`: Abbruch wegen fehlender Demo-Environment-Konfiguration

Es wurden dadurch keine Staging- oder Produktionsdaten veraendert.

## Bekannte Einschraenkungen

- Kein GO ohne `NOLIS_DEMO_STAGING_EXECUTE=1` und vollstaendige Staging-Parameter.
- Keine echte Staging-Migration, kein Backup, keine Provisionierung und keine Ingestion wurden ausgefuehrt.
- Kein Live-Test mit dem tatsaechlich eingesetzten Staging-Modell wurde ausgefuehrt.
- Keine reale Browser-/Tastatur-/Screenreader-Restpruefung wurde ausgefuehrt.
- Keine individuellen externen Viewer-Konten wurden fuer Empfaenger vorbereitet.
- Keine Image-Digests fuer freizugebende, gepushte Release-Images dokumentiert.

## Deaktivierungsverfahren

Vor externer Freigabe in Staging zu testen und zu dokumentieren:

- Viewer deaktivieren
- Ablaufdatum in die Vergangenheit setzen
- Evaluation-Site-Zuweisung entfernen
- Demo-Site aus Evaluation-Modus nehmen
- Demo-Reset ausfuehren
- Mock-Handoff deaktivieren

## Entscheidung

`PASS - STAGING EXECUTION AUSSTEHEND`

Begruendung:

Repository, CI und lokale automatisierte Gates sind gruen. Die fuer GO erforderlichen Staging-/Live-Pruefungen wurden mangels ausdruecklicher Ausfuehrungsfreigabe und fehlender Staging-Parameter nicht durchgefuehrt.
