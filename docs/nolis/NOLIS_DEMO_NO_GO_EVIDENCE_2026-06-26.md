# NOLIS Demo Release Evidence

Datum: 2026-06-27
Ergebnis: NO-GO

Diese Datei dokumentiert den finalen Staging-Gate-Lauf fuer den isolierten NOLIS-Demonstrator nach dem Viewer-Session-DTO-Fix. Sie enthaelt keine Secrets, keine Umgebungsvariablenwerte, keine privaten Schluessel, keine Session-Tokens, keine vollstaendigen Viewer-Adressen und keine produktiven personenbezogenen Daten.

## Release-Kandidat

- Repository-Commit: `26ccce23f583fea1381f53933c03b8fd8889c908`
- Deploy-Ziel: isolierter Docker-Stack `soule-demo`
- Demo-Dashboard: `https://demo.soulesmartbusiness.com`
- Demo-API: `https://demo-api.soulesmartbusiness.com`
- Demo-Widget: `https://demo-widget.soulesmartbusiness.com`
- Node-Version lokal: `v24.17.0`
- npm-Version lokal: `11.12.1`

## CI-Status

GitHub-Actions-Lauf fuer Commit `26ccce23f583fea1381f53933c03b8fd8889c908`:

- Run ID: `28300182541`
- Source Gate: PASS
- Security Audit: PASS
- Docker Build: PASS
- Security PostgreSQL Isolation: PASS

## Deployed Stack Evidence

Der isolierte Demo-Stack lief auf Commit `26ccce23f583fea1381f53933c03b8fd8889c908`. Der bestehende Production-/Knete-Staging-Betrieb wurde nicht veraendert.

| Container | Image SHA | Status | Health |
| --- | --- | --- | --- |
| `soule-demo-api-1` | `sha256:b72b71e5a52a9ee52af65b53462a1efdaef3e243d6bc9e00d6367edbd5cf56c5` | running | healthy |
| `soule-demo-dashboard-1` | `sha256:68e7ebfbbb590509d9a0fd1e21b41aa6a1d3ad2841e627112a542a7dbf7cf219` | running | healthy |
| `soule-demo-widget-1` | `sha256:0b874b209112a55d73ab845c89dd84435b96e41426ccbfe05bfca005f41706b2` | running | healthy |
| `soule-demo-proxy-1` | `sha256:54f2a904c251d5a34adf545a72d32515a15e08418dae0266e23be2e18c66fefa` | running | healthy |
| `soule-demo-db-1` | `sha256:7d400e340efb42f4d8c9c12c6427adb253f726881a9985d2a471bf0eed824dff` | running | healthy |
| `soule-demo-redis-1` | `sha256:8b81dd37ff027bec4e516d41acfbe9fe2460070dc6d4a4570a2ac5b9d59df065` | running | healthy |
| `ai-chatbot-proxy-1` | `sha256:9344a5525a7a5fb9526afb8e262beb2c873586ff3cd3e29645357e0c7f609ab4` | running | healthy |

## Demo Provisioning Evidence

`verify-evaluation-demo` wurde nach dem Reset erneut ausgefuehrt.

- Tenant vorhanden: ja
- Demo-Site vorhanden: ja
- Evaluation-Demo markiert: ja
- Aktive interne Viewer: 1
- Fruehestes Viewer-Ablaufdatum: `2026-07-10 00:06:26+00`
- Evaluation-Zuordnung korrekt: ja
- Synthetische Quellen: 28
- Synthetische Dokumente: 28
- Chunks: 28
- Suchbare Chunks: 28
- Szenarien: 3
- Mock-Handoff aktiviert: ja
- Mock-Handoff-Secret konfiguriert: ja
- Mock-Receiver-Origin konfiguriert: ja
- Konfiguration vollstaendig: ja

## External Smoke Evidence

- `GET /login`: 200
- `GET /healthz` auf Demo-API: 200
- `GET /loader.js` auf Demo-Widget: 200
- `GET /widget.js` auf Demo-Widget: 200

## Viewer/Auth Evidence

Interner Test-Viewer, maskiert: `so***@gmail.com`

- Login: PASS
- Redirect nach Login: `/evaluation`
- `GET /evaluation`: 200
- `GET /api/auth/session`: 200
- Session Cache-Control: `no-store`
- Oeffentliche Session-Felder: `accountExpiresAt`, `displayName`, `role`, `sessionExpiresAt`
- Verbotene Felder in Viewer-Session: keine
- `GET /api/evaluation/context`: 200
- Gesperrte Dashboard-Routen fuer Viewer: Redirect nach `/evaluation`
- Logout: PASS
- Session nach Logout: 401

## Automated Gates

- Golden Evaluation: 128/128 PASS
- Hard-Blocker im Golden Gate: 42/42 PASS
- Security Boundaries: 70/70 PASS
- Webhook-HMAC-Test: PASS
- Analytics Contract Test: PASS
- Accessibility-Automation: PASS
- Production Audit High/Critical: PASS

Bekannte Ausnahme:

- Next/PostCSS moderate Finding ist dokumentiert und bis zum Review-Datum 2026-07-03 akzeptiert. Vor externer Freigabe nach diesem Datum ist ein erneuter Review erforderlich.

## Live Model Gate

Live-Fragen gegen den isolierten Demo-Stack wurden ohne Ausgabe von Antworttexten oder vertraulichen Inhalten geprueft.

- Source-/Hilfefrage: PASS
- Troubleshooting-Frage: PASS
- Safe-Non-Answer: PASS
- Prompt-Injection-Schutz: PASS
- Scope-Manipulation-Schutz: PASS
- False-Forwarding-Schutz: PASS
- Secret-Marker-Schutz: PASS
- Live Model Hard Blocker: nein

## Ticket/Handoff Gate

Ergebnis: FAIL

Befund:

- Ein ready Ticket-Preview konnte nicht bestaetigt werden.
- Confirm-Endpunkt antwortete mit 400 und der kontrollierten Fehlermeldung `Ticket preview changed`.
- Es wurde kein Demo-Ticket erstellt.
- Der HMAC-Mock-Handoff konnte dadurch nicht end-to-end ausgefuehrt werden.

Bewertung:

- Das ist ein harter Blocker fuer externe NOLIS-Demo-Freigabe.
- Vermutete Fehlerklasse: Preview-/Confirm-Hash ist nicht stabil zwischen Preview und Confirm, wahrscheinlich durch Normalisierung, Serialisierung oder Persistierung des Preview-Inhalts.

## Reset/Cleanup Evidence

Nach den Live-Tests wurde der Demo-Testzustand zurueckgesetzt.

Entfernte Testdaten im Demo-Scope:

- Evaluation-Chat-Sessions: 5
- Conversations: 5
- Messages: 40
- Ticket-Previews: 9
- Demo-Tickets: 0
- Handoff-Events: 0
- Handoff-Receipts: 0

Finaler Zustand nach Reset:

- Evaluation-Chat-Sessions: 0
- Ticket-Previews: 0
- Demo-Tickets: 0
- Handoff-Events: 0
- Handoff-Deliveries: 0
- Mock-Handoff-Receipts: 0
- Knowledge Sources: 28
- Documents: 28
- Chunks: 28
- Email Jobs: 0
- Webhook Jobs: 0

## Logs

Gepruefte Container:

- `soule-demo-api-1`
- `soule-demo-dashboard-1`
- `soule-demo-widget-1`
- `soule-demo-proxy-1`
- `ai-chatbot-proxy-1`

Ergebnis:

- Secret-Hits: 0
- neue Error-/Exception-/Failed-Muster: 0
- Restarts: 0
- 5xx im geprueften Logfenster: 0

## Nicht Abgeschlossen

Folgende Punkte wurden im finalen Gate nicht vollstaendig abgeschlossen:

- HMAC-Mock-Handoff end-to-end, weil die Ticket-Bestaetigung blockiert.
- Manuelle Browser-/Accessibility-Pruefung in echten Browsern inklusive Screenreader-Kombinationen.
- Externe NOLIS-Konten wurden bewusst nicht verwendet.

## Entscheidung

Finaler Status: NO-GO

Gruende:

1. Ticket-Confirm/Handoff ist nicht end-to-end funktionsfaehig.
2. Die verpflichtende manuelle Browser-/Accessibility-Restpruefung ist noch nicht als finale Evidence dokumentiert.

Naechste Schritte vor GO:

1. Ticket-Preview-/Confirm-Hash stabilisieren.
2. Confirm- und Handoff-Pfad erneut live testen.
3. Demo-Testdaten danach erneut zuruecksetzen und verifizieren.
4. Manuelle Browser-/Accessibility-Pruefung dokumentieren.
5. Finalen Staging-Gate vollstaendig wiederholen.
