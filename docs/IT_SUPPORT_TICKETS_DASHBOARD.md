# IT-Support-Tickets im Dashboard

Diese Übersicht zeigt pro Site die vom IT-Support-Agenten erstellten Supportfälle aus `agent_tickets`.

## Zweck

- Kunden und Admins können IT-Tickets lesen, filtern und Details prüfen.
- Die Ansicht ist read-only.
- Es gibt in diesem Schritt keine Ticket-Bearbeitung, SLA-Queue, Kommentare oder externe Ticketsystem-Spezialintegration.

## Welche Tickets angezeigt werden

Ein Ticket wird als IT-Support-Ticket angezeigt, wenn mindestens eines gilt:

- `category = "it_support"`
- `metadata.sourceAgent = "it-support-agent"`
- `source = "chat"` und `issue_type` ist gesetzt

Property-, Lead-, E-Commerce- oder sonstige Agent-Tickets werden dadurch nicht in der IT-Support-Übersicht angezeigt.

## Sichtbare Felder

Die Liste zeigt:

- Ticket-Referenz
- Betreff
- Status
- Priorität
- Issue Type
- betroffenes System
- Reporter Name, E-Mail oder Telefon, falls vorhanden
- Erstellzeitpunkt
- Weiterleitungsstatus

Die Detailansicht zeigt zusätzlich:

- Beschreibung
- Auswirkung und Dringlichkeit
- betroffene Nutzer
- Gerät und Betriebssystem
- Fehlermeldung
- bereits versuchte Schritte
- Standort und Abteilung
- Gesprächsbezug als `conversationId`, falls vorhanden

Es wird kein vollständiger roher Chatverlauf angezeigt.

## Weiterleitungsstatus

Der Weiterleitungsstatus wird aus `agent_tickets.metadata.forwardingStatus` gelesen:

- `queued`: Weiterleitung wurde in die Webhook-Queue eingereiht.
- `not_configured`: Es ist keine Ticket-Weiterleitung eingerichtet.
- `failed`: Weiterleitung konnte nicht eingereiht werden oder ist fehlgeschlagen.
- `unknown`: Alte Tickets oder Tickets ohne gespeicherten Weiterleitungsstatus.

Neue Tickets speichern den Weiterleitungsstatus rückwärtskompatibel in `metadata.forwardingStatus`. Alte Tickets werden nicht verändert.

## Redaction

Ticket-Responses werden vor der Ausgabe redigiert. Das betrifft insbesondere:

- Passwörter und Kennwörter
- MFA-/2FA-/TAN-/PIN-Codes
- API-Keys
- Tokens und Bearer Tokens
- `client_secret`
- `access_token`
- `refresh_token`
- sonstige Secret-Felder in `metadata`

Reporter Name, E-Mail und Telefonnummer dürfen im Ticket angezeigt werden, weil sie Teil des Supportfalls sind.

## Grenzen

Nicht enthalten:

- Status-Workflow
- Ticket-Zuweisung
- Kommentare
- SLA-Management
- Webhook-Retry aus der Ticketübersicht
- Jira-, Zendesk-, Freshdesk- oder TANSS-Spezialintegration
- Microsoft-365-/MFA-/Passwort-Aktionen
