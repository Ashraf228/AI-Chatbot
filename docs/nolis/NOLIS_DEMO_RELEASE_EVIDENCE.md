# NOLIS Demo Release Evidence

Datum: 2026-06-28
Ergebnis: GO
Freigebende Rolle: technischer Final-Gate

Diese Evidence dokumentiert den finalen GO/NO-GO-Gate fuer den erweiterten isolierten NOLIS-Demonstrator. Sie enthaelt keine Passwoerter, Secrets, Sessiontokens, privaten Schluessel, vollstaendige Viewer-E-Mail, Chattexte, Ticketbeschreibungen, Handoff-Payloads oder `.env`-Inhalte.

## Release-Stand

- Release-Commit: `23605f303b4753b9c55ba5c5318fc8b828e5af5a`
- Server-HEAD: `23605f303b4753b9c55ba5c5318fc8b828e5af5a`
- `APP_COMMIT_SHA`: entspricht Release-Commit
- `/healthz` Commit: `23605f303b4753b9c55ba5c5318fc8b828e5af5a`
- Server Working Tree: sauber
- Demo-URL: `https://demo.soulesmartbusiness.com`
- Demo-API: `https://demo-api.soulesmartbusiness.com`
- Demo-Widget: `https://demo-widget.soulesmartbusiness.com`
- Demo-Stack: `soule-demo`
- Serverpfad: `/opt/soule-demo`

Nicht durchgefuehrt:

- Keine NOLIS-Konten angelegt
- Keine Zugangsdaten versendet
- Keine Production-Container veraendert
- `knete-staging` nicht veraendert
- Kein Public-Proxy-Rebuild
- Keine Zertifikats-, DNS- oder Firewall-Aenderung
- Keine Migrationen
- Keine Demo-Provisionierung
- Keine Volumes geloescht

## CI

- GitHub Actions fuer Release-Commit: success
- CI-Run-ID: `28320338092`
- Relevante Gates: Source Gate, Security Audit, Docker Build und Security PostgreSQL Isolation erfolgreich.

## Stack-Health

Status: PASS

- `soule-demo-api-1`: healthy
- `soule-demo-dashboard-1`: healthy
- `soule-demo-widget-1`: healthy
- `soule-demo-db-1`: healthy
- `soule-demo-redis-1`: healthy
- `soule-demo-proxy-1`: healthy
- Production-/`knete-staging`-Container liefen weiterhin.

## Public Smoke Und TLS

Status: PASS

- `https://demo.soulesmartbusiness.com/login`: 200
- `https://demo-api.soulesmartbusiness.com/healthz`: 200
- `https://demo-widget.soulesmartbusiness.com/loader.js`: 200
- `https://demo-widget.soulesmartbusiness.com/widget.js`: 200
- TLS gueltig bis: 2026-09-24
- Zertifikat enthaelt alle sechs geforderten Hosts inklusive der drei Demo-Subdomains.

## Audit Und Dependency-Ausnahme

Status: PASS fuer High/Critical

- `npm audit --omit=dev --audit-level=high`: 0 High, 0 Critical
- `npm run security:audit:production-contexts`: PASS
- Bekannte moderate Ausnahme: Next/PostCSS
- Ausnahme gueltig bis: 2026-07-03
- Bewertung am 2026-06-28: Ausnahme noch gueltig
- Versand oder externer Zugang nach dem 2026-07-03 erfordert erneuten Dependency-Review.

## Demo Verify

Status: PASS

- Demo-Tenant gefunden: ja
- Demo-Site gefunden: ja
- `isEvaluationDemo`: true
- Aktiver Viewer vorhanden: ja
- Evaluation-Zuordnung korrekt: ja
- Synthetische Quellen: 84
- Synthetische Dokumente: 84
- Chunks: 84
- Suchbare Chunks: 84
- Unmarkierte aktive Dokumente im Evaluation-Retrieval: 0
- Szenarien: 12
- Mock-Handoff aktiviert: ja
- Mock-Receiver-Origin konfiguriert: ja
- Konfiguration vollstaendig: ja

## UI-/Workspace-Pruefung

Status: PASS

- Login erfolgreich: ja
- Redirect nach `/evaluation`: ja
- `/evaluation`: 200
- `/api/evaluation/context`: 200
- Positionierung als kommunale NOLIS-KI-Demo vorhanden
- Nutzenkarten vorhanden
- Ausbaustufen vorhanden
- Synthetischer Disclaimer vorhanden
- Hinweis auf kundenspezifische Anpassbarkeit vorhanden
- Szenarien laut Kontext: 12
- Keine `Worauf achten`-/`Beobachtungspunkt`-Anzeige im Szenario-Hauptflow

## Viewer Und Auth

Status: PASS

- Zugangsstrategie: Ein gemeinsamer, zeitlich begrenzter NOLIS-Team-Viewer fuer die Erstbewertung. Keine individuellen personenbezogenen Evaluationskonten in dieser Phase.
- Viewer-Login erfolgreich: ja
- Rolle: Viewer
- `/api/auth/session`: 200
- Cache-Control fuer Session: `no-store`
- Session-DTO enthaelt nur freigegebene oeffentliche Sessionfelder
- Verbotene interne Session-Felder gefunden: nein
- Gesperrte Routen fuer Viewer redirecten: ja
- Logout erfolgreich: ja
- Session nach Logout: 401

## Live-Modelltest

Status: PASS

Getestete Klassen:

- Reisepass
- Wohnsitzummeldung
- Hund anmelden
- CityApp-Veranstaltung
- Formular mit Pflichtfeldern
- Formular laesst sich nicht absenden
- interner Urlaubsantrag
- Sporthallenreservierung
- keine verbindliche Verwaltungsentscheidung
- Prompt-Injection-Abwehr
- fremde Mandantendokumente
- keine falsche NOLIS-Uebermittlungsbehauptung
- kuenstlicher Secret-Test

Ergebnis:

- 13/13 Modellfaelle beantwortet
- Quellen ausschliesslich Demo-markiert
- Keine fremden Quellen erkannt
- Kein Systemprompt-Leak erkannt
- Keine Verwaltungsentscheidung erkannt
- Keine falsche NOLIS-Uebermittlungsbehauptung erkannt
- Kuenstlicher Secret-Marker nicht wiedergegeben
- Keine vollstaendigen Chatantworten in dieser Evidence dokumentiert

## Ticket Und Confirm

Status: PASS

- Product-Support-Fall gestartet: ja
- Ticketvorschau erzeugt: ja
- Confirm erfolgreich: ja
- Retry/Doppelconfirm fuehrte nicht zu doppeltem Demo-Ticket
- Demo-Tickets nach Confirm: 1
- `forwardingStatus`: `not_configured`
- `email_jobs`: 0
- `webhook_jobs`: 0
- Keine externe Uebermittlung: ja
- Kein Fehler `Ticket preview changed` im gueltigen Confirm/Retry-Pfad

## HMAC-Mock-Handoff

Status: PASS

- Handoff bewusst ausgeloest: ja
- Mock-Status: `mock_delivered`
- Demo-Handoff-Event: 1
- Demo-Handoff-Delivery: 1
- Mock-Handoff-Receipt: 1
- Keine externe Uebermittlung: ja
- Keine Signaturen, Event-IDs, Delivery-IDs oder Payloads in dieser Evidence dokumentiert

## Accessibility

Status: PASS

`docs/nolis/ACCESSIBILITY_BASELINE.md` wurde mit manueller Evidence vom 2026-06-28 aktualisiert.

Dokumentiert:

- Chrome/macOS Kernablauf
- Tastatur-only Gesamtablauf
- 200-Prozent-Zoom
- 320-CSS-Pixel-Reflow
- sichtbarer Fokus
- Focus Not Obscured
- Target Size
- Reduced Motion
- VoiceOver-Screenreader-Pruefung
- Mobile Touchbedienung
- Secret-/DOM-Sichtpruefung

Keine `not tested`- oder `failed`-Eintraege verbleiben in der manuellen Pruefmatrix.

## Secret-, DOM- Und Logpruefung

Status: PASS

Serverlogs, geprueft im relevanten Zeitfenster:

- Passwort-Pattern: 0
- Authorization-/Bearer-Pattern: 0
- Sessiontoken-Pattern: 0
- HMAC-/Signatur-Pattern: 0
- API-Key-Pattern: 0
- interne Env-Namen: 0
- Cookie-Header-Pattern: 0
- Fatal/Exception/Unhandled: 0
- HTTP-5xx-Pattern: 0

Keine vollstaendige Viewer-Mail, keine Chattexte, keine Ticketbeschreibung und keine Handoff-Payload wurden in dieser Evidence dokumentiert.

## Reset Und Finaler Zustand

Status: PASS

Vor Reset im finalen Testlauf:

- Evaluation-Chat-Sessions: 14
- Conversations: 14
- Messages: 32
- Ticket-Previews: 3
- Demo-Tickets: 1
- Handoff-Events: 1
- Handoff-Receipts: 1

Reset Execute:

- erfolgreich
- nur Evaluation-/Demo-Artefakte der Demo-Site entfernt
- Knowledge, Tenant, Site und Viewer erhalten

Finaler Zustand nach Reset:

- Demo-Dokumente: 84
- Demo-Chunks: 84
- Evaluation-Chat-Sessions: 0
- Demo-Tickets: 0
- Ticket-Previews: 0
- Handoff-Events: 0
- Handoff-Receipts: 0
- Knowledge bleibt erhalten

## Sicherheitsabgrenzung

- Keine NOLIS-Konten angelegt
- Keine Zugangsdaten versendet
- Keine echten NOLIS-Unterlagen verwendet
- Keine produktive NOLIS-Integration
- Handoff bleibt interner Mock-Handoff
- Keine produktiven Daten geloescht
- Keine Production- oder `knete-staging`-Aenderungen

## Bekannte Grenzen

- Demonstrator nutzt synthetische Inhalte.
- Handoff ist ein interner Mock-Handoff.
- Keine produktive NOLIS-Ticketuebermittlung.
- Keine Rechts- oder Verwaltungsentscheidung durch die KI.
- Next/PostCSS-Ausnahme muss spaetestens am 2026-07-03 erneut bewertet werden.

## Deaktivierungsverfahren

Der isolierte Stack kann ueber die dokumentierten Demo-Deployment-Skripte gestoppt werden. Ein Entfernen von Volumes oder Zertifikaten ist separat freizugeben und wurde in diesem Gate nicht durchgefuehrt.

## Finale Entscheidung

GO

Der erweiterte NOLIS-Demonstrator ist technisch fuer den externen Evaluationszugang freigabefaehig, solange keine Zugangsdaten in diesem Gate versendet werden und die bekannte Next/PostCSS-Ausnahme vor oder am 2026-07-03 erneut bewertet wird.
