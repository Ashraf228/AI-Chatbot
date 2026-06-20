# Build and CI

Stand: 2026-06-20

## Runtime

- Standardisierte Node.js-Version: `24.17.0`.
- Zulässiger Engine-Bereich: `>=24.17.0 <25`.
- Lokale Versiondateien: `.nvmrc` und `.node-version`.
- Docker-Basisimages fuer Node-Services: `node:24.17.0-alpine`.
- npm wird ueber die jeweilige Node-Installation genutzt; Installationen laufen reproduzierbar mit `npm ci`.

## Lokale Installation

```sh
nvm use
npm ci
```

App-Kontexte mit eigenem Docker-Buildpfad besitzen eigene Lockfiles:

- `apps/api/package-lock.json`
- `apps/dashboard/package-lock.json`
- `apps/widget/package-lock.json`
- `apps/reporter/package-lock.json`
- `packages/widget-sdk/package-lock.json`

Diese Lockfiles werden nicht manuell editiert.

## Typechecks

```sh
npm run check:api
npm run check:dashboard
npm run check:widget
npm run check:reporter
npm run check:all
```

`check:dashboard` fuehrt nur den Typecheck aus. Der Next-Produktionsbuild bleibt ein separater Build-Gate.

## Tests

```sh
npm run test:smoke
npm run test:e2e
```

Bei knappen Ressourcen sollen E2E und Next-Builds sequenziell laufen. Ein einmaliger E2E-Timeout unter paralleler hoher Buildlast ist kein Freigabesignal; der Test muss sequenziell gruen sein.

## Produktionsbuilds

```sh
npm run build:api
npm run build:dashboard
npm run build:widget
npm run build:reporter
npm run build:all
```

`NEXT_TELEMETRY_DISABLED=1` wird in CI und im Dashboard-Docker-Build gesetzt.

## Produktionsaudits

```sh
npm run security:audit:production-contexts
npm audit --omit=dev --audit-level=high
```

Der Root-Workspace-Audit blockiert ab `high`. Die eigenstaendigen App-Kontext-Audits muessen `0 vulnerabilities` melden, solange keine explizite Ausnahme genau fuer diesen Produktionspfad dokumentiert ist.

Aktive Audit-Ausnahmen duerfen nicht abgelaufen sein und duerfen keinen TODO-Owner enthalten.

## Docker-Builds

```sh
docker compose --env-file .env.example config
docker compose --env-file .env.example build api
docker compose --env-file .env.example build dashboard
docker compose --env-file .env.example build widget
docker compose --env-file .env.example build reporter
```

Die App-Dockerfiles verwenden `npm ci`. Runtime-Images behalten vorhandene non-root `USER node` Vorgaben fuer API, Dashboard und Reporter.

Wenn lokal kein Docker-Daemon erreichbar ist, gelten nur die lokalen Node/npm-Gates als geprueft. Externer Zugang bleibt blockiert, bis der Docker-CI-Job gruen ist.

## Dashboard PostCSS

Der Root-Workspace-Audit meldet weiterhin ein moderates internes Next/PostCSS-Finding. Fuer das Dashboard-Produktionsimage ist der eigenstaendige App-Kontext massgeblich:

- Root-Workspace: `next@16.2.9` loest intern `postcss@8.4.31` auf.
- Dashboard-App-Kontext: `apps/dashboard/package-lock.json` pinnt `postcss@8.5.15`.
- Dashboard-Docker-Build nutzt `apps/dashboard` als Build-Kontext und kopiert kein Root-`node_modules`.

Der CI-Docker-Job prueft die PostCSS-Version im gebauten Dashboard-Image. Falls das Image nicht `postcss@8.5.15` verwendet, ist das Ergebnis `FAIL`.

## CI-Jobs

- `source-gate`: Root-`npm ci`, Lockfile-Diff, Typechecks, Smoke/E2E, Produktionsbuilds.
- `security-audit`: Root-High-Gate und strikte App-Kontext-Audits.
- `docker-build`: Compose-Konfiguration und Docker-Builds fuer API, Dashboard, Widget, Reporter und Proxy; Node-Versionen und non-root User werden geprueft.

Keine CI-Aktion pusht Images oder deployed die Anwendung.
