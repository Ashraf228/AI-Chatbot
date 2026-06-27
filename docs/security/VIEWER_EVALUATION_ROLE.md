# Viewer Evaluation Role

Diese Notiz beschreibt den technischen Evaluationszugang fuer externe Demos. Sie ist keine Rechtsberatung und ersetzt keine organisatorische Freigabe.

## Zweck

Die Rolle `viewer` ist fuer zeitlich begrenzte externe Evaluationen vorgesehen. Viewer sollen sich anmelden und eine minimale Evaluationsseite sehen koennen, aber keinen Zugriff auf bestehende Dashboard-, Admin-, Kunden-, Reporting- oder Datenrouten erhalten.

## Sicherheitsmodell

- Die Dashboard-Session-Rolle wird ausschliesslich aus der backend-authentifizierten `tenant_users.role` abgeleitet.
- Browser-Werte aus Request-Body, Query-Parametern, Local Storage oder frei gesetzten Headers duerfen die Rolle nicht bestimmen.
- `tenant_users.role = viewer` wird zu `DashboardSession.role = viewer`.
- Bekannte Tenant-Rollen `owner`, `admin`, `manager` und `editor` behalten die bisherige Customer-Semantik.
- Unbekannte Rollen werden beim Login abgelehnt und nicht auf `customer` heruntergestuft.
- Viewer-Sessions benoetigen serverseitig immer eine `tenantId`.
- Die oeffentliche Projektion von `GET /api/auth/session` gibt fuer Viewer keine Tenant-, Site- oder Tenant-User-IDs an den Browser aus.
- Bestehende Dashboard-API- und Backend-Admin-Routen sind fuer Viewer deny-by-default.
- Erlaubt sind nur Login, Logout, `GET /api/auth/session` und die minimale Seite `/evaluation`.

## Ablaufdatum

`tenant_users.expires_at` ist optional. Wenn ein Ablaufdatum gesetzt ist:

- abgelaufene oder inaktive Tenant-User koennen sich nicht anmelden,
- die Login-Antwort bleibt generisch,
- die Session-Laufzeit wird auf das fruehere Ende aus normaler Session-TTL und `expires_at` begrenzt,
- `GET /api/auth/session` gibt nur sichere Metadaten aus.

Wenn kein `expires_at` gesetzt ist, gilt die normale Dashboard-Session-TTL.

## Bekannte Einschraenkung

Die Dashboard-Sessions sind stateless. Eine nachtraegliche Deaktivierung oder Aenderung eines Tenant-Users invalidiert bereits ausgestellte Tokens nicht sofort, solange keine Backend-Revalidierung pro Request erfolgt. Fuer externe Viewer sollten daher kurze Ablaufdaten verwendet werden. Eine zusaetzliche serverseitige Session-Revalidierung kann spaeter ergaenzt werden, falls der Demonstrator laenger laufende Evaluationszugriffe erfordert.

## Manuelle Pruefschritte

1. Viewer-Tenant-User mit zukuenftigem `expiresAt` anlegen.
2. Login als Viewer durchfuehren.
3. Pruefen, dass `/evaluation` erreichbar ist.
4. Pruefen, dass `/sites`, `/settings` und bestehende `/api/*`-Routen mit Viewer-Session nicht erreichbar sind.
5. Pruefen, dass `GET /api/auth/session` keine Tokens, E-Mail-Adressen, Passwoerter, Metadaten oder internen IDs ausgibt.
6. Ablaufdatum in die Vergangenheit setzen und erneuten Login pruefen.

## Nicht enthalten

- Keine produktive NOLIS-Integration.
- Keine Freigabe fuer produktive Kundendaten.
- Keine automatische Sofort-Invalidierung bereits ausgestellter stateless Tokens.
