# Dependency Risk Register

Stand: 2026-05-28

Dieses Dokument bewertet bekannte Dependency-Risiken fuer den aktuellen Produktionskandidaten. Es ersetzt keinen externen Security-Scan.

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
