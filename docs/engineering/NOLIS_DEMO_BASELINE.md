# NOLIS Demo Baseline

Datum: 2026-06-19

Commit-SHA: `ffd3fa38b44852f63528f29a9898b645422341d7`

Node-Version: `v25.9.0`

npm-Version: `11.12.1`

## Projektueberblick

- Monorepo mit npm Workspaces: `apps/*`, `packages/*`.
- `apps/api`: NestJS-API mit SQL-Migrationen unter `apps/api/migrations`.
- `apps/dashboard`: Next.js-Dashboard.
- `apps/widget`: React/Vite-Widget.
- `apps/reporter`: Reporting-Jobs.
- Docker-Artefakte: `docker-compose.yml`, `docker-compose.staging.yml`, App-Dockerfiles und Nginx-Infrastruktur unter `infra/nginx`.
- Betriebsdokumentation vorhanden unter `docs/ops`, `docs/security`, `docs/legal`, `docs/customer-onboarding` und weiteren Projekt-Dokumenten.

## Baseline-Befehle

| Befehl | Ergebnis | Dauer | Notiz |
| --- | --- | ---: | --- |
| `npm ci` | PASS | 20.09s | Erstlauf in der Sandbox schlug nach 76.13s mit `npm error Exit handler never called!` und Log-Schreibproblem unter `/Users/ash/.npm/_logs` fehl. Wiederholung mit benoetigtem npm-Cache-/Netzwerkzugriff erfolgreich. |
| `npm run check:api` | PASS | 4.75s | TypeScript `--noEmit` fuer `apps/api`. Erste Sandbox-Wiederholung vor erfolgreichem `npm ci` schlug wegen `ENOTFOUND registry.npmjs.org` fehl. |
| `npm run check:widget` | PASS | 3.53s | TypeScript `--noEmit` fuer `apps/widget`. Erste Sandbox-Wiederholung vor erfolgreichem `npm ci` schlug wegen `ENOTFOUND registry.npmjs.org` fehl. |
| `npm run check:reporter` | PASS | 2.49s | TypeScript `--noEmit` fuer `apps/reporter`. Erste Sandbox-Wiederholung vor erfolgreichem `npm ci` schlug wegen `ENOTFOUND registry.npmjs.org` fehl. |
| `npm run test:smoke` | PASS | 12.59s | `271` Tests, `271` bestanden, `0` fehlgeschlagen. |
| `npm run test:e2e` | PASS | 6.98s | `7` Testdateien, `13` Tests bestanden. |
| `npm run build:api` | PASS | 8.95s | NestJS Build erfolgreich. |
| `npm run build:widget` | PASS | 6.73s | TypeScript + Vite Build erfolgreich; `dist/widget.js` erzeugt. |
| `npm run build:reporter` | PASS | 2.21s | TypeScript Build erfolgreich. |
| `npm run build:dashboard` | PASS | 17.62s | Next.js 16.2.6 Production Build erfolgreich; `45` statische Seiten generiert. |
| `npm audit --omit=dev` | FAIL | 1.20s | `6 vulnerabilities`: `1 low`, `2 moderate`, `3 high`. Findings: `esbuild` low in `apps/reporter/node_modules/esbuild`; `multer` high via `@nestjs/platform-express` ohne Fix; `nodemailer <=9.0.0` high mit Fix via `npm audit fix`; `postcss <8.5.10` moderate via Next-internes `postcss`, Force-Fix wuerde auf `next@9.3.3` downgraden. Kein `npm audit fix --force` ausgefuehrt. |

## Audit-Befunde

- `esbuild 0.27.3 - 0.28.0`: low, beliebiges File Read beim Dev-Server auf Windows, Fix laut npm via `npm audit fix`.
- `multer 1.0.0 - 2.1.1`: high, Denial-of-Service-Befunde `GHSA-72gw-mp4g-v24j` und `GHSA-3p4h-7m6x-2hcm`, transitiv ueber `@nestjs/platform-express`, laut npm kein Fix verfuegbar.
- `nodemailer <=9.0.0`: high, mehrere Advisories zu Header Injection, File/URL Access Bypass und TLS/OAuth2-Validierung, Fix laut npm via `npm audit fix`.
- `postcss <8.5.10`: moderate, `GHSA-qx2v-qp2m-jg93`, transitiv ueber Next-internes `postcss`; `npm audit fix --force` wuerde auf `next@9.3.3` downgraden und wurde nicht ausgefuehrt.

## Vorlaeufige Prioritaeten

1. High-Audit-Befunde fuer `nodemailer` und `multer` separat bewerten; keine Force-Fixes oder Downgrades verwenden.
2. Bekannten Next/PostCSS-Befund weiter als Risiko dokumentieren, bis ein sicherer Stable-Patch verfuegbar ist.
3. Vor externem Zugang Tenant-/Site-Scope, Auth und Staging-Smoke gezielt erneut pruefen.
4. Fuer den NOLIS-Demonstrator nur isolierte Testdaten und klar gekennzeichnete Demo-Flows verwenden.

## Recheck 2026-06-19 nach Dependency-Härtung

- Commit vor Härtung: `014f1571f088128eae1d6b92f3a7fd50a2a66a5e`.
- Node-Version: `v25.9.0`.
- npm-Version: `11.12.1`.
- Behoben: `multer` auf `2.2.0`, `nodemailer` auf `9.0.1`, Reporter-`tsx`/`esbuild` auf sichere stabile Versionen, `qs` auf `6.15.2`.
- Zusaetzlich gehaertet: Nodemailer-Transporte deaktivieren Datei- und URL-Zugriff; PDF-Upload-Limit und PDF-MIME-Filter sind gezielt testbar.
- Standalone-Audits der Docker-Kontexte `apps/api`, `apps/dashboard`, `apps/widget` und `apps/reporter`: clean.
- Root-Produktionsaudit: keine High- oder Critical-Findings; verbleibend ist das dokumentierte moderate Next/PostCSS-Finding.
- Bekannte Ausnahme: `next@16.2.9` buendelt im Root-Workspace weiterhin internes `postcss@8.4.31`; kein Force-Fix, kein Downgrade, keine Canary-Version.

## Follow-up 2026-06-20 Runtime- und CI-Konsistenz

- Ziel: lokale, CI- und Docker-Buildpfade auf Node.js `24.17.0`, reproduzierbare `npm ci`-Installationen und getrennte Typecheck-/Build-Gates ausrichten.
- Dashboard-Typecheck und Dashboard-Produktionsbuild sind getrennte Gates.
- Dashboard und Reporter besitzen eigenstaendige Lockfiles fuer ihre Docker-Kontexte.
- Widget-SDK besitzt einen eigenstaendigen Lockfile fuer den Loader-Build.
- Dockerfiles verwenden keine Node-20- oder schwebenden Node-Tags mehr.
- Docker-Build-Verifikation bleibt Voraussetzung fuer externen NOLIS-Zugang.
