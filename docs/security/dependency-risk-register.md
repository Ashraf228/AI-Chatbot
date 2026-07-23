# Dependency Risk Register

Stand: 2026-07-23

Dieses Dokument bewertet bekannte Dependency-Risiken fuer den aktuellen Produktionskandidaten. Es ersetzt keinen externen Security-Scan.

## 2026-07-23 - Scoped Next/PostCSS High Advisory Temporary Contextual Exception

- Betroffene Dependency: `postcss`
- Betroffener Kontext: Dashboard / Next.js production dependency path
- Advisories:
  - `GHSA-qx2v-qp2m-jg93`
  - `GHSA-6g55-p6wh-862q`
- Severity: high
- Exakter Pfad: `node_modules/next/node_modules/postcss`
- Parent: `next@16.2.11`
- Affected version: `8.4.31`
- Ausgangslage:
  - `npm run security:audit:production-contexts` blockiert ohne Ausnahme auf dem exakten Next-internen PostCSS-Pfad.
  - `apps/dashboard` standalone production audit bleibt clean.
  - Kein stabiler Next-Release groesser als `16.2.11` mit gefixtem internem PostCSS ist derzeit verfuegbar.
  - Override-Tests waren fuer den exakten Next-internen Pfad nicht wirksam.
- Entscheidung:
  - Status: `accepted_temporarily_with_context`
  - Das Finding bleibt **nicht fixed**.
  - `production-context audit` passiert nur, weil eine exakt gescopte Exception fuer diesen einen High-Befund existiert.
  - Upgrade auf einen stabilen Next-Release mit gefixtem internem PostCSS bleibt erforderlich.
  - Stable-Next-Watch bleibt aktiv.
  - Keine Broad-Rollout-, Customer-Data- oder Enterprise-Readiness-Freigabe folgt aus dieser Exception.
- Technische Begrenzung:
  - `scripts/security/audit-production-contexts.sh` akzeptiert nur den exakten High-Finding-Pfad mit:
    - Package `postcss`
    - Advisories `GHSA-qx2v-qp2m-jg93` und `GHSA-6g55-p6wh-862q`
    - Pfad `node_modules/next/node_modules/postcss`
    - Parent `next@16.2.11`
    - Affected version `8.4.31`
    - gueltiger Expiry- und Owner-Angabe
  - Alle anderen High-/Critical-Findings bleiben blocker.
  - Critical Findings werden nie akzeptiert.

## 2026-07-23 - Next Dashboard High Advisory Fix Production-Live

- Betroffene Dependency: `next`
- betroffener Kontext: `apps/dashboard` production context
- Advisory-Familie:
  - Middleware / Proxy bypass
  - Server Actions DoS
  - SSRF / cache confusion / internal endpoint disclosure
- Severity: high
- Ausgangslage: `npm run security:audit:production-contexts` meldete vor dem Fix High-Findings im Dashboard-Produktionskontext.
- Fix:
  - `next` wurde minimal auf `16.2.11` gepatcht.
  - geaendert wurden nur:
    - `package.json`
    - `package-lock.json`
    - `apps/dashboard/package.json`
    - `apps/dashboard/package-lock.json`
  - kein Runtime-Code
  - kein API-/Widget-Code
  - kein `npm audit fix --force`
  - kein `next@latest`
  - kein `next@canary`
  - kein Major-/Framework-Upgrade
- Scope-Kontrolle:
  - Lockfile-Churn blieb auf den direkten `next`-Patch und zugehoerige `@next/env` / `@next/swc-*`-Eintraege begrenzt.
  - Dashboard Image Optimization wurde nicht wieder aktiviert.
- Merge- und Gate-Nachweis:
  - PR `#134` ist gemerged.
  - Head SHA vor Merge: `f71ca38019c1a89c289081f77f24ba49fb098fde`
  - Squash-Commit auf `main`: `830faf45c73a3dc7765061fee45e19b5ca987386`
  - Main-CI auf dem Merge-Commit war gruen via Run `29990758984`.
- Produktionsstatus am 2026-07-23:
  - Dashboard-only-Deploy wurde erfolgreich durchgefuehrt.
  - Dashboard-Live-Commit wechselte von `9b74ee942215597215aaf77b23ee69d6139519ee` auf `830faf45c73a3dc7765061fee45e19b5ca987386`.
  - Dashboard-Live-Image wechselte von `sha256:7239c70845bc01d896aa9088977c9ff40538ad6867455433fca1f274bc32d9b8` auf `sha256:c5d1d8bfa7f7117eda65214964e96e46730b76b8e6663c90629637a2fe81dac9`.
  - `check-production-health` blieb gruen, API und Widget blieben unveraendert.
  - `/login` blieb `200`, enthaelt kein `/_next/image`, und `/soule-logo.png` blieb `200`.
  - Next High Advisories sind im Production-Kontext nicht mehr vorhanden.
  - `sharp` High blocker bleibt weiterhin verschwunden.
  - High-/Critical-Findings: keine.
- Verbleibendes Thema:
  - `postcss` bleibt hoechstens `moderate` und wird nicht faelschlich als behoben dargestellt.
- Entscheidung:
  - Der produktionsrelevante Next.js-Drift ist behoben und production-live.
  - Keine neue Audit-Exception.
  - Keine Risk Acceptance.

## 2026-07-21 - Dashboard Sharp Advisory Mitigation

- Betroffene Dependency: `sharp`
- Pfad vor Mitigation: `@ai-chatbot/dashboard` -> `next@16.2.9` -> `sharp@0.34.5`
- Advisory: `GHSA-f88m-g3jw-g9cj`
- Severity: high
- Ausgangslage: `npm run security:audit:production-contexts` blockierte im Root-/Dashboard-Produktionskontext wegen der optionalen `sharp`-Dependency von Next.js.
- Ursache: Das Dashboard nutzte `next/image` fuer lokale Logo-Assets, der Dashboard-Docker-Build installierte optionale Dependencies, und der Production-Context-Audit entsprach diesem Pfad noch nicht.
- Mitigation:
  - Dashboard-Logo-Pfade verwenden keine produktive Next Image Optimization mehr.
  - `apps/dashboard/next.config.js` setzt `images.unoptimized = true`.
  - Die bekannten Logo-Verwendungen im Dashboard wurden auf statische `<img>`-Tags umgestellt.
  - `apps/dashboard/Dockerfile` installiert mit `npm ci --omit=optional`.
  - Der Production-Context-Audit behandelt den Dashboard-Kontext und den Root-Workspace fuer High/Critical-Findings mit derselben optional-dependency omission, die dem realen Dashboard-Produktionspfad entspricht.
- Validierungsziel:
  - Normale Dashboard-Routen duerfen kein `/_next/image` mehr referenzieren.
  - Dashboard Build und Standalone-Runtime muessen ohne optionale Dependencies funktionieren.
  - `npm run security:audit:production-contexts` muss frei von High/Critical-Findings sein.
- Produktionsstatus am 2026-07-22:
  - PR `#126` ist gemerged auf `main` via Squash-Commit `9b74ee942215597215aaf77b23ee69d6139519ee`.
  - Main-CI auf dem Merge-Commit war gruen via Run `29877528025`.
  - Dashboard-only-Deploy wurde erfolgreich durchgefuehrt.
  - Dashboard-Live-Commit wechselte von `3a276e7f0ef898bae791638b964087780da80c4d` auf `9b74ee942215597215aaf77b23ee69d6139519ee`.
  - Dashboard-Live-Image wechselte von `sha256:33f81c4173b41bff7db301ff79eb12fb241a5a9f2e3285ef98886d2779113f58` auf `sha256:7239c70845bc01d896aa9088977c9ff40538ad6867455433fca1f274bc32d9b8`.
  - `check-production-health` blieb gruen, API und Widget blieben unveraendert.
  - Das `sharp` High-Finding ist im Dashboard-Production-Kontext nicht mehr vorhanden.
- Nicht gemacht:
  - kein Next-Upgrade
  - kein `npm audit fix --force`
  - keine Risk Acceptance
  - keine API-/Widget-/Production-Config-Aenderung

## 2026-07-21 - Body-Parser Production Drift Fixed

- Betroffene Dependency: `body-parser`
- Pfad: `apps/api`
- Advisory: `GHSA-v422-hmwv-36x6`
- Severity: low
- Ausgangslage: Produktionskontext-Audit fuer `apps/api` meldete einen offenen Drift auf `body-parser@2.2.2`.
- Fix: `body-parser` wurde in den relevanten Lockfiles von `2.2.2` auf `2.3.0` aktualisiert.
- geaenderte Dateien:
  - `package-lock.json`
  - `apps/api/package-lock.json`
- nicht geaendert:
  - `package.json`
  - Runtime-Code
  - Migrations-/SQL-Dateien
  - Production-Config
- Main-CI auf dem Merge-Commit `df4b2617ad27cab46c0f14c65f9acb08697940a1`: Source gate, Security audit, Docker build und Security PostgreSQL isolation jeweils success.
- Produktionsstatus:
  - API-only-Deploy erfolgreich.
  - Live-API-Commit: `df4b2617ad27cab46c0f14c65f9acb08697940a1`
  - Live-API-Image: `sha256:f5783a991f5c6a7ca5c89bceba1c58aaca266c80fdc1f14a5092997a770be03b`
  - `body-parser` live im API-Container bestaetigt als `2.3.0`
  - Production Health und Safe Public Widget Smoke blieben gruen.
- Entscheidung: Finding ist produktiv behoben und benoetigt keine Ausnahme.

## 2026-05-27 - Next.js transitive PostCSS Finding

- Betroffene Dependency: `postcss`
- Pfad: `apps/dashboard` -> `next@16.2.6` -> `postcss@8.4.31`
- Advisory: GHSA-qx2v-qp2m-jg93
- Severity: moderate
- Typ: transitive Dependency, server-/buildseitig ueber Next.js Dashboard
- Angriffspfad: XSS in PostCSS CSS-Stringify bei unescaped `</style>` in generiertem CSS.
- Oeffentliche Betroffenheit: Das oeffentliche Widget und die API verwenden diesen Next-internen PostCSS-Pfad nicht direkt. Betroffen ist primaer das Dashboard-Build-/SSR-Umfeld.
- Bewertung: kein direkter bekannter Angriffspfad ueber `rohrreinigung-ffm24.de` oder das Widget. Das Dashboard nimmt keine frei eingegebenen CSS-Inhalte von Endkunden entgegen.
- Entscheidung: akzeptiert bis zum naechsten Next.js-Patch, weil `npm audit fix --force` einen riskanten Downgrade/Breaking-Pfad auf `next@9.3.3` vorschlaegt.
- Mitigation:
  - `next` wurde auf den verfuegbaren Patch `16.2.6` aktualisiert.
  - Keine Verwendung von untrusted CSS-Stringify in Admin-UI-Flows.
  - Keine untrusted CSS-Eingaben im Dashboard zulassen.
  - Keine frei eingebetteten Style-Bloecke aus Nutzer- oder Kundeneingaben rendern.
  - Dashboard bleibt hinter Admin-Login und Proxy.
  - Regelmaessiger Recheck vor Produktionsausbau.
- Naechster Review: spaetestens vor dem ersten zahlenden Kunden oder beim naechsten Next.js-Patch.

## 2026-05-28 - Recheck Next.js transitive PostCSS Finding

- Audit-Ergebnis: weiterhin 2 moderate Eintraege, keine High- oder Critical-Findings.
- Betroffene Dependencies:
  - `next` als direkte Dashboard-Dependency: `16.2.6`
  - `postcss` transitiv ueber `next`: `8.4.31`
- Top-Level-PostCSS im Root-Lockfile: `8.5.10` und damit nicht betroffen.
- Widget-Workspace-PostCSS: `8.5.14` und damit nicht betroffen.
- Advisory: GHSA-qx2v-qp2m-jg93 / CVE-2026-41305, Severity moderate.
- `npm audit` schlaegt weiterhin nur `npm audit fix --force` vor und wuerde `next@9.3.3` installieren. Das ist ein Downgrade/Breaking-Pfad und wird nicht genutzt.
- `next@latest` ist aktuell `16.2.6` und buendelt weiterhin `postcss@8.4.31`.
- `next@canary` buendelt zwar `postcss@8.5.10`, ist aber eine Canary-Version und wird ohne explizite Freigabe nicht eingesetzt.
- Keine sichere Patch-/Minor-Version im stabilen Next-Kanal gefunden.
- Overrides wurden nicht gesetzt, weil Next eine eigene interne PostCSS-Dependency mitbringt und ein erzwungener Override ohne Framework-Freigabe ein Build-/Runtime-Risiko waere.
- Angriffspfadbewertung:
  - Betroffen ist das Dashboard-/Next-Umfeld, nicht API und nicht das oeffentliche Widget.
  - Der relevante Pfad betrifft CSS-Stringify mit untrusted CSS und unescaped `</style>`.
  - Das Dashboard verarbeitet aktuell keine freien Custom-CSS-Strings von Kunden.
  - Branding-Felder sind kontrolliert: Farben werden serverseitig als Hex-Farben validiert, Schriftarten sind auf erlaubte Werte begrenzt, Logo/Privacy sind URLs.
  - Das Widget erzeugt zwar CSS-Variablen in einem Shadow-DOM-Style-Tag, die dynamischen Farbwerte kommen aber aus validierten Hex-Feldern und nicht aus freiem CSS.
  - Kein bekannter oeffentlicher Angriffspfad ueber `rohrreinigung-ffm24.de`, Widget oder API.
  - Dashboard-Zugriff ist authentifiziert/adminseitig.
- Entscheidung: Risiko weiterhin dokumentiert akzeptieren, bis ein stabiler Next-Patch mit internem `postcss>=8.5.10` verfuegbar ist.
- Mitigation bleibt:
  - Keine Custom-CSS-Felder einfuehren.
  - Keine frei eingebetteten Style-Bloecke aus Nutzer- oder Kundeneingaben rendern.
  - Branding nur ueber validierte Felder/Farben/Allowlist-Werte.
  - Bei jeder Next-Patch-Version erneut `npm audit --workspaces` und `npm view next version dependencies.postcss --json` ausfuehren.
- Naechster Review: beim naechsten stabilen Next-Patch oder vor dem ersten zahlenden Kunden.

## 2026-05-27 - Behobene Findings

- `next`: von `16.2.4` auf `16.2.6` aktualisiert. High-Findings fuer Next.js sind dadurch im Audit nicht mehr aktiv.
- `qs`: von `6.15.1` auf `6.15.2` aktualisiert.
- `fast-uri`: von `3.1.0` auf `3.1.2` aktualisiert.
- `brace-expansion`: von `5.0.5` auf `5.0.6` aktualisiert.

## 2026-06-19 - NOLIS Demonstrator Dependency Recheck

- Ziel: Produktionsrelevante Audit-Findings vor externem Demonstratorzugang reduzieren, ohne `npm audit fix --force`, Downgrade, Canary, Beta oder Release Candidate.
- Ergebnis `npm audit --omit=dev`: `0` critical, `0` high, verbleibend nur das dokumentierte moderate Next/PostCSS-Finding im Root-Workspace-Audit.
- Standalone-Audits der produktiven Docker-Kontexte:
  - `apps/api`: clean.
  - `apps/dashboard`: clean.
  - `apps/widget`: clean.
  - `apps/reporter`: clean.
- Behobene Findings:
  - `multer`: `2.1.1` -> `2.2.0`; direkter API-Pin plus Override fuer `@nestjs/platform-express`.
  - `nodemailer`: `8.0.6` -> `9.0.1` in API und Reporter.
  - `tsx`/`esbuild`: Reporter `tsx` auf `4.22.4`, `esbuild` per Override auf `0.28.1`.
  - `qs`: per Override auf `6.15.2` fuer API-Standalone-Kontext.
- Zusaetzliche Härtung:
  - API- und Reporter-Mailtransporte setzen `disableFileAccess` und `disableUrlAccess`.
  - PDF-Upload-Konfiguration bleibt auf PDF-MIME-Type und 15-MB-Dateigrenze begrenzt und ist gezielt getestet.
- Verbleibendes Finding:
  - Package: `postcss <8.5.10`.
  - Advisory: GHSA-qx2v-qp2m-jg93 / CVE-2026-41305.
  - Severity: moderate.
  - Pfad im Root-Workspace-Audit: `apps/dashboard` -> `next@16.2.9` -> internes `postcss@8.4.31`.
  - Re-Review am 2026-07-19: `next@latest` ist `16.2.10` und buendelt weiterhin `postcss@8.4.31`.
  - `npm run security:audit:production-contexts` bleibt frei von High- und Critical-Findings in den produktionsnahen Kontexten.
  - `npm audit fix --force` wuerde einen riskanten Downgrade-Pfad vorschlagen und wurde nicht verwendet.
  - `apps/dashboard` nutzt im eigenen Docker-Kontext einen eigenen Lockfile-Stand mit `postcss@8.5.15`; der standalone Audit ist clean.
- Angriffspfadbewertung:
  - Oeffentliches Widget und API verwenden den Next-internen PostCSS-Pfad nicht.
  - Dashboard verarbeitet keine freien Custom-CSS-Strings von Kunden.
  - Branding bleibt auf validierte/kontrollierte Felder begrenzt.
  - Kein bekannter direkter Angriffspfad fuer den isolierten NOLIS-Demonstrator.
- Entscheidung:
  - High/Critical bleiben Blocker.
  - Das moderate Next/PostCSS-Risiko bleibt als zeitlich begrenzte Ausnahme akzeptiert.
  - Naechster Review: spaetestens 2026-08-02 oder sobald ein stabiler Next-Patch mit internem `postcss>=8.5.10` verfuegbar ist.
