# Dashboard Authorization Matrix

Diese Datei beschreibt das Security-Gate fuer Dashboard-, Viewer- und Backend-Routen. Sie ist keine Produktbeschreibung, sondern eine technische Pruefgrundlage fuer Regressionen an Tenant-, Site-, Viewer- und Rollen-Grenzen.

## Artefakte

- Matrix: `test/security/authorization-matrix.json`
- Route-Inventar: `scripts/security/authorization-inventory.mjs`
- Matrix-Check: `npm run security:check-authorization-matrix`
- Boundary-Gate: `npm run test:security-boundaries`
- PostgreSQL-Schema-Gate: `npm run test:security:postgres`

## Rollen

- `admin`: globaler administrativer Zugriff. Admin-Routen muessen serverseitig durch `AdminKeyGuard` beziehungsweise Dashboard-Session plus internes Dashboard-Token geschuetzt sein.
- `operator`: operativer Zugriff ohne globale Admin-Funktionen. Ressourcen mit Site-Bezug muessen serverseitig ueber `AdminScopeService` oder eine aequivalente Scope-Pruefung begrenzt sein.
- `customer`: tenantgebundene Rolle. Die Session muss eine `tenantId` enthalten; Site-/Ressourcen-Zugriffe duerfen nicht tenantuebergreifend funktionieren.
- `viewer`: isolierter Evaluationszugang. Viewer duerfen nur die exakt freigegebenen Evaluation-Routen nutzen und werden serverseitig ueber `EvaluationAccessService` revalidiert.

## Viewer-Allowlist

Viewer-Zugriff ist absichtlich exakt und nicht prefixbasiert. Die erlaubten Pfade stehen in `apps/dashboard/lib/viewer-access.ts` und muessen mit der Matrix uebereinstimmen:

- `/evaluation`
- `/api/auth/logout`
- `/api/auth/session`
- `/api/evaluation/context`
- `/api/evaluation/chat/session`
- `/api/evaluation/chat/message`
- `/api/evaluation/chat/ticket/confirm`
- `/api/evaluation/chat/ticket/cancel`
- `/api/evaluation/chat/ticket/handoff`
- `/api/evaluation/chat/ticket/handoff/status`

Neue Viewer-Routen muessen bewusst in Code, Matrix und Tests ergaenzt werden. Prefix-Allowlists wie `startsWith("/api/evaluation")` sind fuer Viewer nicht zulaessig.

## Matrix-Felder

Jeder Eintrag in `test/security/authorization-matrix.json` deklariert mindestens:

- `layer`: `dashboard` oder `api`
- `method` und `path`
- `allowedRoles`
- `authType`
- `tenantBound`, `siteBound`, `ownershipBound`
- `mutation`
- `sensitiveResponse`
- `expectedScopeCheck`
- `testCaseId`
- `exception`, falls es sich bewusst um Auth-, Public-Widget- oder Mock-Receiver-Endpunkte handelt

Der Matrix-Check schlaegt fehl, wenn eine Route im Source-Inventar fehlt, doppelt deklariert ist, nicht mehr existiert oder Viewer ausserhalb der exakten Allowlist freigegeben werden.

## Abgrenzung

Die Matrix ersetzt keine Fachtests. Sie ist ein blockierendes Sicherheitsinventar. Fachliche Tests muessen weiterhin pruefen, dass die jeweilige Route das erwartete Verhalten ausfuehrt.
