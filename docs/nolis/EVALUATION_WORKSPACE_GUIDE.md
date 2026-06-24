# Evaluation Workspace Guide

Diese Anleitung beschreibt die generische Nutzung des Kooperationsdemonstrators. Es werden keine Zugangsdaten, Domains, Logos oder echten Produktivdaten dokumentiert.

## Anmeldung

1. Mit dem bereitgestellten Evaluationskonto anmelden.
2. Nach erfolgreicher Anmeldung oeffnet sich der Evaluation Workspace.
3. Das Konto ist zeitlich begrenzt. Das Ablaufdatum wird im Kopfbereich angezeigt.

## Szenarien

Der Workspace bietet drei synthetische Szenarien:

- Quellenbasierte Soforthilfe
- Strukturierte Uebergabe
- Sichere Nicht-Antwort bei fehlendem Wissen

Eine Szenariokarte uebernimmt nur einen Beispieltext in das Eingabefeld. Die Nachricht wird erst gesendet, wenn der Nutzer bewusst auf Senden klickt.

Die Szenarien werden serverseitig aus der Demo-Site-Konfiguration geliefert. Fuer das Profil `public-sector-product-support-demo` sind genau drei Szenarien vorgesehen:

1. quellenbasierte Hilfe,
2. strukturierte Uebergabevorschau,
3. sichere Nicht-Antwort bei fehlender Grundlage.

## Quellenanzeige

Wenn eine Antwort auf Demo-Wissen basiert, zeigt der Chat eine reduzierte Quellenliste. Die Quellenansicht enthaelt keine internen Dokument-IDs, Scores oder privaten Speicherorte.

## Handoff-Vorschau

Falls der Testdialog strukturierte Uebergabedaten erkennt, kann eine Vorschau angezeigt werden. Es erfolgt keine externe Uebermittlung an ein Produktivsystem oder Fachverfahren.

## Product-Support-Demo-Tickets

Fuer das Profil `public-sector-product-support-demo` kann der Workspace aus einem ungelösten Anliegen einen internen Demo-Supportfall vorbereiten.

Der Ablauf ist:

1. Der Assistent bietet zuerst quellenbasierte Hilfe an.
2. Der Nutzer bestaetigt, ob das Problem geloest wurde.
3. Bei ungelöstem Anliegen sammelt der Assistent die erforderlichen Angaben.
4. Der Browser zeigt eine bereinigte Vorschau ohne Reporter-E-Mail, interne IDs oder Secret-Werte.
5. Erst der Button `Demo-Ticket erstellen` erstellt einen internen Demo-Supportfall.

Die Erfolgsmeldung lautet:

`Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine Übermittlung an ein externes Ticketsystem.`

Es wird kein Webhook, keine E-Mail und keine externe API angestoßen.

## Sicherheitshinweis im Chat

Der Workspace zeigt sichtbar den Hinweis, keine Passwoerter, MFA-Codes, API-Schluessel oder echten personenbezogenen Falldaten einzugeben. Sensible Muster werden serverseitig maskiert.

## Logout

Zum Beenden der Sitzung den Logout-Button im Kopfbereich verwenden.

## Hinweis

Der Workspace arbeitet mit synthetischen Inhalten. Er ist kein Produktivsystem und keine produktive Fachverfahrensintegration.

## Bereitstellung

Provisioning, Verify und Reset sind in [DEMO_PROVISIONING.md](./DEMO_PROVISIONING.md) beschrieben. Der Content-Katalog liegt in [DEMO_CONTENT_CATALOG.md](./DEMO_CONTENT_CATALOG.md).
