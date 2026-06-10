# IT-Support-Agent Backend Go-live Notes

Hinweis: Dieses Dokument beschreibt technische Vorbereitung und Betriebspruefpunkte. Es ersetzt keine rechtliche, vertragliche oder kundenspezifische Freigabe.

## Zweck

Der IT-Support-Agent ist ein First-Level-Support-Agent fuer interne oder externe IT-Anfragen. Er arbeitet knowledge-first, bietet sichere allgemeine Troubleshooting-Schritte an und kann nach Bestaetigung ein strukturiertes Support-Ticket speichern.

Er fragt nicht nach Passwoertern, MFA-Codes, API-Keys, Tokens, Secrets oder Admin-Zugangsdaten. Solche Werte werden vor Ticket- und Event-Payloads redigiert.

## Aktivierung

Fuer einen produktionsnahen Betrieb sollten diese Bausteine aktiv und geprueft sein:

- `it-support` Modul aktivieren.
- `knowledge-faq` Modul aktivieren.
- IT-Wissensbasis fuer den Kunden befuellen und testen.
- `ticket.created` Webhook oder Ticket-Integration konfigurieren, wenn Tickets extern weiterverarbeitet werden sollen.
- `requiredTicketFields` nur mit erlaubten Feldern konfigurieren.
- Finale Ticket-Bestaetigung aktiviert lassen.

Dashboard-Konfiguration der generischen Ticket-Weiterleitung: `docs/TICKET_WEBHOOK_CONFIGURATION.md`.

Dashboard-Readiness-Anzeige fuer den IT-Support-Agenten: `docs/IT_SUPPORT_READINESS.md`.

Read-only Ticketuebersicht im Dashboard: `docs/IT_SUPPORT_TICKETS_DASHBOARD.md`.

## Ablauf

1. Knowledge-first Antwort aus verifizierter Wissensbasis oder sicheren allgemeinen First-Level-Schritten.
2. Loesungskontrolle mit Frage, ob der Hinweis geholfen hat.
3. Ticketangebot, wenn die Loesung nicht reicht oder ein kritischer Vorfall erkannt wird.
4. Datensammlung gemaess `requiredTicketFields`.
5. Finale Bestaetigung vor Ticketerstellung.
6. `create_ticket` speichert das Ticket.
7. `ticket.created` Event wird ueber bestehende Integrations-/Webhook-Architektur queued, falls konfiguriert.

## pendingTicket States

- `solution_offered`: Der Agent hat eine Loesung oder sichere Schritte vorgeschlagen.
- `ticket_offered`: Der Agent hat ein Ticket angeboten und wartet auf Bestaetigung.
- `collecting`: Der Agent sammelt fehlende Ticketfelder.
- `ready_to_create`: Alle Pflichtfelder sind vorhanden, finale Bestaetigung steht aus.
- `created`: Ticket wurde gespeichert.
- `resolved`: Nutzer hat bestaetigt, dass die Loesung geholfen hat.
- `cancelled`: Nutzer hat Ticketerstellung oder Sammlung abgebrochen.

Nach `created`, `resolved` oder `cancelled` startet ein neues IT-Problem eine neue Ticket-Session. Ein einfaches `Ja`, `Ok` oder `Danke` nach `created` erzeugt kein zweites Ticket.

## Required Ticket Fields

Erlaubte Felder:

- `description`
- `affectedSystem`
- `impact`
- `reporterEmail`
- `reporterPhone`
- `reporterName`
- `device`
- `operatingSystem`
- `errorMessage`
- `alreadyTried`
- `department`
- `location`

Defaults bleiben:

- `description`
- `affectedSystem`
- `impact`
- `reporterEmail`

Ungueltige Felder werden entfernt. Wenn nach der Normalisierung nichts uebrig bleibt, werden die Defaults verwendet.

## Weiterleitungsstatus

Das `create_ticket` Tool gibt neben der Ticket-ID einen `forwardingStatus` zurueck:

- `queued`: `ticket.created` wurde in eine Webhook-/Event-Queue eingereiht.
- `not_configured`: Kein passender Webhook oder keine Ticket-Weiterleitung ist aktiv.
- `failed`: Ticket wurde gespeichert, aber Queue/Dispatch konnte nicht bestaetigt werden.
- `unknown`: Status konnte nicht sicher bestimmt werden.

Der Chat darf nur bei `queued` von eingereihter Weiterleitung sprechen. Ohne konfigurierte Weiterleitung wird transparent gesagt, dass nur das Ticket erstellt wurde.

Neue Tickets speichern den Weiterleitungsstatus zusaetzlich in `agent_tickets.metadata.forwardingStatus`, damit Kunden/Admins den Zustand in der Dashboard-Ticketuebersicht sehen koennen. Alte Tickets ohne gespeicherten Wert werden dort als `unknown` angezeigt.

## Webhook Payload Beispiel

```json
{
  "eventType": "ticket.created",
  "payload": {
    "ticketId": "ticket-id",
    "subject": "IT-Support: VPN - VPN verbindet nicht",
    "description": "VPN verbindet nicht seit heute Morgen",
    "category": "it_support",
    "priority": "normal",
    "urgency": "normal",
    "impact": "single_user",
    "issueType": "vpn",
    "affectedSystem": "VPN",
    "reporter": {
      "name": "Max Muster",
      "email": "max@example.com",
      "phone": "+49..."
    },
    "technicalContext": {
      "device": "Windows Laptop",
      "operatingSystem": "Windows",
      "errorMessage": "Fehler 809"
    },
    "metadata": {
      "sourceAgent": "it-support-agent"
    }
  }
}
```

Keine Systemprompts, API-Keys, Tokens, Secrets oder internen Credentials in Payloads aufnehmen.

## Sensitive-Data-Regeln

Redigiert werden unter anderem:

- Passwort, Password, Kennwort
- MFA Code, 2FA Code, TAN, PIN
- API Key
- Token und Bearer Token
- Secret
- `client_secret`
- `access_token`
- `refresh_token`

Die Redaction gilt auch fuer verschachtelte Felder wie `metadata`, `technicalContext`, `reporter` und Ticketbeschreibungen.

## IT-Knowledge-Base-Templates

Der Backend-Katalog `IT_KNOWLEDGE_BASE_TEMPLATES` stellt wiederverwendbare First-Level-Support-Artikel fuer typische IT-Faelle bereit. Die Templates sind als Basiswissen gedacht und muessen vor Kundeneinsatz fachlich und kundenspezifisch angepasst werden.

Standard-Templates:

- VPN verbindet nicht
- Passwort zuruecksetzen
- MFA / 2FA funktioniert nicht
- Outlook sendet oder empfaengt keine E-Mails
- WLAN oder Netzwerk funktioniert nicht
- Drucker druckt nicht
- Laptop oder PC ist langsam
- Software funktioniert nicht
- Zugriff oder Berechtigung beantragen
- Phishing-Mail erhalten
- Malware- oder Virenverdacht
- Konto gesperrt oder Login blockiert
- Geraet verloren oder gestohlen
- Server-, Netzwerk- oder Unternehmensausfall
- Allgemeines IT-Problem melden

Die Templates fragen keine Passwoerter, MFA-Codes, API-Keys, Tokens oder Secrets ab. Security-Faelle sollen kurz sicher eingeordnet und schnell eskaliert werden.

Details: `docs/IT_SUPPORT_KNOWLEDGE_TEMPLATES.md`

## Go-live Checklist

- `it-support` Modul aktiv.
- `knowledge-faq` Modul aktiv.
- IT-Knowledge-Base befuellt und mit Kundenthemen getestet.
- `requiredTicketFields` validiert.
- Finale Ticket-Bestaetigung aktiv.
- `ticket.created` Webhook/Integration aktiv, falls externe Weiterleitung noetig ist.
- Testflow VPN erfolgreich.
- Testflow Security/Phishing erfolgreich.
- Testflow direkte Ticketerstellung erfolgreich.
- Redaction-Test fuer Passwort/MFA/API-Key/Token erfolgreich.
- Datenschutz/PII-Freigabe kundenspezifisch geprueft.
- Monitoring fuer Ticket- und Webhook-Jobs aktiv.

## Nicht enthalten

- Microsoft-365-Aktionen.
- Passwortreset oder MFA-Reset.
- Jira-, Zendesk-, Freshdesk- oder TANSS-spezifische Integration.
- SLA- oder Queue-Management.
- Kundenspezifische IT-Knowledge-Base-Inhalte.
