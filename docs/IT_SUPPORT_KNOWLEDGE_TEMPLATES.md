# IT-Support Knowledge-Base Templates

Hinweis: Diese Templates sind technische Basisinhalte fuer First-Level-Support. Sie muessen vor Kundeneinsatz fachlich, organisatorisch und rechtlich geprueft und kundenspezifisch angepasst werden.

## Zweck

Die IT-Knowledge-Base-Templates liefern wiederverwendbare, sichere Startinhalte fuer den `it-support-agent`. Sie sollen typische IT-Support-Faelle knowledge-first beantworten und erst danach strukturiert in die Ticketerfassung fuehren.

Die Templates veraendern keine Kundendaten automatisch. Ein Import pro Site muss explizit durch einen Backend-/Admin-Prozess ausgeloest werden.

## Standard-Templates

- `vpn-not-connecting`: VPN verbindet nicht
- `password-reset`: Passwort zuruecksetzen
- `mfa-2fa-problem`: MFA / 2FA funktioniert nicht
- `outlook-email-not-sending`: Outlook sendet oder empfaengt keine E-Mails
- `wifi-network-issue`: WLAN oder Netzwerk funktioniert nicht
- `printer-not-printing`: Drucker druckt nicht
- `laptop-slow`: Laptop oder PC ist langsam
- `software-not-working`: Software funktioniert nicht
- `access-permission-request`: Zugriff oder Berechtigung beantragen
- `phishing-mail-received`: Phishing-Mail erhalten
- `malware-suspicion`: Malware- oder Virenverdacht
- `account-locked`: Konto gesperrt oder Login blockiert
- `device-lost`: Geraet verloren oder gestohlen
- `server-or-company-outage`: Server-, Netzwerk- oder Unternehmensausfall
- `generic-it-ticket`: Allgemeines IT-Problem melden

## Sicherheitsregeln

- Keine Passwoerter abfragen.
- Keine MFA-Codes, TANs, PINs oder Wiederherstellungscodes abfragen.
- Keine API-Keys, Tokens, Secrets oder Admin-Zugangsdaten abfragen.
- Keine riskanten PowerShell-, Terminal-, Registry- oder Loeschbefehle ausgeben.
- Keine Security-Bypass-Anleitungen geben.
- Security-Faelle kurz behandeln und schnell eskalieren.

## Nutzung pro Kunde/Site

Der Template-Katalog liegt backendseitig in `apps/api/src/modules/it-support/it-knowledge-base-templates.ts`.

Der Import-Service `ItKnowledgeTemplateImportService` kann Templates pro `tenantId` und `siteId` in die bestehende Knowledge-Base importieren:

- ohne `templateKeys`: alle Standard-Templates
- mit `templateKeys`: nur ausgewaehlte Templates
- `mode: "skip_existing"`: vorhandene Template-Artikel nicht duplizieren
- `mode: "overwrite"`: vorhandene Template-Artikel ueber den bestehenden Ingest-Pfad neu einlesen

Die importierten Knowledge Sources werden markiert mit:

- `sourceType: "it_support_template"`
- `metadata.templateKey`
- `metadata.templateVersion`
- `metadata.industry = "it-support"`

## Anpassung vor Go-live

Die Templates sind allgemeines Basiswissen. Vor einem Kundeneinsatz sollten mindestens diese Punkte angepasst werden:

- konkrete Support-Kontaktwege
- erlaubte Self-Service-Prozesse
- kundenspezifische Systeme und Namen
- Eskalationswege bei Security- oder Ausfallfaellen
- Ticketpflichtfelder und Priorisierungsregeln
- Datenschutz- und Betriebsfreigaben

## Nicht enthalten

- automatische Jira-, Zendesk-, Freshdesk- oder TANSS-Integration
- Passwort- oder MFA-Reset-Automation
- kundenspezifische SLAs
- automatische Aktivierung fuer bestehende Sites
- automatische Veraenderung bestehender Knowledge Bases
