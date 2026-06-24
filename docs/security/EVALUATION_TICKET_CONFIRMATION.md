# Evaluation Ticket Confirmation

Dieses Dokument beschreibt die Sicherheitsgrenzen fuer Demo-Supportfaelle im Evaluation Workspace.

## Grundsatz

Evaluation-Tickets werden nicht ueber den normalen `create_ticket`-Toolpfad erstellt. Dadurch werden Webhooks, E-Mail-Jobs und externe Ticket-Integrationen fuer den Demonstrator nicht angesprochen.

## Preview und Confirmation

Der Ablauf ist zweistufig:

1. `POST /admin/evaluation/chat/message` kann eine bereinigte Ticketvorschau erzeugen.
2. `POST /admin/evaluation/chat/ticket/confirm` erstellt den internen Demo-Supportfall erst nach expliziter Bestaetigung.

Der Confirm-Request akzeptiert nur:

- `conversationId`
- `previewToken`

Nicht akzeptiert werden u. a.:

- `tenantId`
- `siteId`
- Rollen- oder Tool-Vorgaben
- Ticket-Feldwerte
- Webhook-/API-Konfiguration
- Forwarding-Status

## Scope-Pruefungen

Der Server prueft vor Erstellung:

- aktive `viewer`-Rolle
- gebundener Evaluation-Demo-Site-Scope
- gleicher Tenant, gleiche Site und gleicher Viewer
- Preview gehoert zur Conversation
- Preview ist nicht abgelaufen
- Preview wurde nicht ersetzt oder abgebrochen
- Inhalts-Hash ist unveraendert

## Idempotenz

Jede Preview hat eine eindeutige Confirmation-ID. Wiederholte oder parallele Bestaetigungen duerfen nur einen Demo-Supportfall erzeugen. Wiederholte Bestaetigungen liefern dasselbe Demo-Ergebnis zurueck.

## Redaction

Sensible Werte werden vor Speicherung und Anzeige maskiert:

- Bearer-/Session-Tokens
- API-Keys und Secrets
- Passwortfelder
- MFA-/OTP-Kontextwerte
- Private Keys
- Session-Cookies

Die Maske lautet `[REDACTED]`.

## Audit

Audit-Ereignisse enthalten nur sichere technische Metadaten wie Ergebnis, Zeitpunkt, Conversation-ID oder Demo-Referenz. Sie enthalten keine Beschreibung, Reporter-E-Mail, Chat-Inhalte oder Ticket-Feldwerte.

## Externe Uebermittlung

Fuer Evaluation-Tickets gilt:

- kein Webhook-Job
- kein E-Mail-Job
- keine externe API
- `forwardingStatus = not_configured`

## Signierte Demo-Uebergabe

Nach der Ticket-Bestaetigung kann ein Viewer separat eine interne Mock-Uebergabe ausloesen. Diese ist kein normaler `webhook_jobs`-Versand und keine externe Fachverfahren-Integration.

- Browser-Request akzeptiert nur `conversationId`.
- Receiver-URL, Secret, Signatur, Event-ID, Delivery-ID und Payload werden ausschliesslich serverseitig bestimmt.
- Die Signatur folgt `docs/security/WEBHOOK_HMAC_SIGNATURES.md`.
- Der interne Mock-Empfaenger prueft die HMAC-Signatur auf Raw-Body-Basis vor JSON-Parsing.
- Der Browser sieht nur bereinigte Statusdaten und keine Header, Signaturen, Payloads oder internen IDs.
- Auch bei erfolgreicher Mock-Uebergabe erfolgt keine Uebermittlung an NOLIS oder ein externes Ticketsystem.
