# Repository Guidelines

## Architektur

- `apps/api` ist die NestJS-API.
- `apps/dashboard` ist das Next.js-Dashboard.
- `apps/widget` ist das React/Vite-Widget.
- `apps/reporter` enthaelt Reporting-Jobs.

## Sicherheits- und Isolationsregeln

- Tenant- und Site-Isolation ist eine harte Sicherheitsgrenze.
- Jeder Dashboard-/Admin-Endpunkt mit `tenantId`, `siteId` oder Ressourcen-ID muss serverseitig gescoped werden.
- Public-Widget-Endpunkte behalten Origin-Pruefung und Rate Limits.
- Keine Secrets, Passwoerter oder personenbezogenen Testdaten in Code, Fixtures, Logs oder Dokumentation.
- Keine echten Kundenunterlagen oder externen vertraulichen Unterlagen committen.

## Datenbank und Migrationen

- Datenbankmigrationen nur additiv, wiederholbar und rueckwaertskompatibel gestalten.
- Bestehende produktive Daten nicht loeschen oder ungefragt veraendern.
- Migrationen duerfen Tenant-/Site-Isolation nicht lockern.

## Aenderungsumfang

- Keine unaufgeforderten grossen Refactorings.
- Pro Aufgabe nur den beschriebenen Umfang bearbeiten.
- Keine unbeteiligten API-, Payload-, Routing- oder UI-Aenderungen.
- Bekannte Einschraenkungen wahrheitsgemaess dokumentieren.
- Einen Demonstrator nicht als Produktionsintegration bezeichnen.

## Tests und Qualitaet

- Fuer jede Aenderung gezielte Tests, Typechecks und relevante Produktionsbuilds ausfuehren.
- Vor Abschluss den Diff auf Regressionen, fehlende Berechtigungspruefungen, PII-/Secret-Leaks und unnoetige Aenderungen pruefen.
- Kein `npm audit fix --force`.
- Sicherheitswarnungen nicht durch Downgrades, Force-Fixes, Canary-, Beta- oder RC-Versionen umgehen.

## Stil

- UI-Texte sind deutsch.
- Codebezeichner und technische Kommentare bleiben konsistent mit dem vorhandenen Stil.
- Kommentare nur dort ergaenzen, wo sie komplexe oder sicherheitsrelevante Logik klaeren.
