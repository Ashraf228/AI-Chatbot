# Product Support Profile fuer den Evaluation-Demonstrator

Dieses Dokument beschreibt den technischen Demonstrator-Flow fuer ein generisches `product`-Supportprofil. Es ist keine Produktivintegration mit NOLIS oder einem externen Ticketsystem.

## Zweck

Das Profil dient dazu, quellenbasierte Hilfe zuerst anzubieten und nur bei ungelöstem Anliegen einen strukturierten, synthetischen Demo-Supportfall im Demonstrator zu erfassen.

## Aktivierung

Das Profil wird ueber die Site-Konfiguration des Evaluation-Demos aktiviert:

- `moduleConfigs["it-support"].supportProfile = "product"`
- `requireExplicitConfirmation = true`
- `allowExternalForwarding = false`
- `collectContactFromAuthenticatedAccount = true`
- `syntheticOrganizationLabel = "Beispielkommune - Demonstrator"`

Bestehende IT-Support-Sites bleiben beim Default `supportProfile = "it"`.

## Ablauf

1. Der Assistent beantwortet die Frage zuerst quellenbasiert.
2. Der Assistent fragt: `Konnte das Problem damit gelöst werden?`
3. Wenn das Anliegen nicht gelöst ist, werden die notwendigen Supportfall-Felder gesammelt.
4. Der Browser erhaelt nur eine bereinigte Vorschau.
5. Erst die explizite serverseitige Bestaetigung erstellt genau einen internen Demo-Supportfall.

## Pflichtfelder

- Produkt
- Modul
- Organisation
- Beschreibung
- Auswirkung

Weitere optionale Felder koennen erfasst werden, z. B. Formular-/Prozessname, Browser, Geraet, Betriebssystem, Fehlermeldung oder bereits versuchte Schritte.

## Datenschutz- und Sicherheitsgrenzen

- Viewer sollen keine Passwoerter, MFA-Codes, API-Schluessel oder echten personenbezogenen Falldaten eingeben.
- Reporter-Name und Reporter-E-Mail werden serverseitig aus dem authentifizierten Viewer abgeleitet.
- Die Reporter-E-Mail wird nicht an das LLM gesendet und nicht im Browser-Preview-DTO angezeigt.
- Sensible Muster werden mit `[REDACTED]` maskiert.
- Es wird kein Webhook, keine E-Mail und keine externe API fuer Evaluation-Tickets ausgelöst.

## Ergebnis

Ein bestaetigter Demo-Supportfall wird intern in `agent_tickets` gespeichert mit:

- `support_profile = product`
- `demo = true`
- `synthetic = true`
- `confirmation_status = confirmed`
- `forwarding_status = not_configured`

Die Browser-Antwort lautet:

`Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine Übermittlung an ein externes Ticketsystem.`
