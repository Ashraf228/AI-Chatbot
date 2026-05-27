# Dependency Risk Register

Stand: 2026-05-27

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

## 2026-05-27 - Behobene Findings

- `next`: von `16.2.4` auf `16.2.6` aktualisiert. High-Findings fuer Next.js sind dadurch im Audit nicht mehr aktiv.
- `qs`: von `6.15.1` auf `6.15.2` aktualisiert.
- `fast-uri`: von `3.1.0` auf `3.1.2` aktualisiert.
- `brace-expansion`: von `5.0.5` auf `5.0.6` aktualisiert.
