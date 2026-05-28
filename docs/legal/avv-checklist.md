# AVV-Checkliste fuer KI-Chat und Lead-Erfassung

Stand: 2026-05-28

Diese Checkliste ist ein technischer und organisatorischer Entwurf. Sie ist keine Rechtsberatung und muss vor Kundeneinsatz juristisch geprueft und an den konkreten Vertrag angepasst werden.

## Ziel

Diese Checkliste sammelt die Informationen, die fuer einen Auftragsverarbeitungsvertrag (AVV), eine TOM-Anlage und die Datenschutzhinweise des Kunden benoetigt werden.

## Rollenmodell

- Kunde/Website-Betreiber: in der Regel Verantwortlicher, weil Zweck, Einbindung und Nutzung des Chat-Widgets auf der Kundenseite bestimmt werden.
- Plattformbetreiber: in der Regel Auftragsverarbeiter, soweit personenbezogene Daten nur nach Weisung des Kunden verarbeitet werden.
- Abweichungen, eigene Zwecke oder gemeinsame Verantwortlichkeit muessen im Einzelfall juristisch geprueft werden.

## Zwecke der Verarbeitung

- Website-Chat zur Beantwortung von Besucherfragen.
- Aufnahme und Vorqualifizierung von Anfragen.
- Rueckruf-, Kontakt- und Lead-Verarbeitung.
- Kundenservice, Support oder Erstberatung je nach Kundenbranche.
- Wissensbasisgestuetzte Beantwortung von Fragen.
- Anzeige von Leads und Gespraechen im Admin-Dashboard.
- optionale Weiterleitung an E-Mail, Webhook oder Integrationen.
- technischer Betrieb, Sicherheit, Fehleranalyse und Missbrauchsschutz.

## Verarbeitete Datenarten

- Name, sofern angegeben.
- Telefonnummer, sofern angegeben.
- E-Mail-Adresse, sofern genutzt.
- Chatnachrichten und Anliegen/Problem.
- Einsatzort, Ort oder PLZ, sofern fuer die Anfrage relevant.
- Dringlichkeit, Termin- oder Rueckrufwunsch.
- Zeitstempel, Statuswerte und technische Sessiondaten.
- Site-/Tenant-Zuordnung.
- Widget-Origin, erlaubte Domain und technische Request-Metadaten.
- Knowledge-/Quellenbezug fuer Antworten, soweit technisch gespeichert.
- Betriebslogs mit moeglichst reduzierten oder maskierten personenbezogenen Daten.

## Betroffenengruppen

- Websitebesucher.
- Interessenten.
- Kunden des Auftraggebers.
- Ansprechpartner bei Unternehmen.
- Nutzer, die ueber das Widget Kontakt- oder Rueckrufanfragen stellen.

## Verarbeitungsorte und Infrastruktur

Vor Kundengang konkret pruefen und dokumentieren:

- Hosting-Standort des Servers.
- Standort der Datenbank-/Redis-Instanz.
- Speicherort der lokalen und externen Backups.
- Standort und Vertragsrahmen des KI-/API-Anbieters.
- Standort und Vertragsrahmen des E-Mail-/SMTP-Anbieters.
- Standort und Vertragsrahmen von Monitoring-/Alerting-Diensten.
- DNS-, Proxy- oder CDN-Dienstleister, falls eingesetzt.

## Unterauftragsverarbeiter

Die konkrete Liste ist im Subprocessor-Register zu pflegen. Mindestens zu pruefen:

- Hosting-/Server-Anbieter.
- Hetzner Storage Box als externes Backup-Ziel.
- E-Mail-/SMTP-Dienst fuer Lead- oder Betriebsbenachrichtigungen.
- KI-/API-Anbieter fuer Antwortgenerierung und optional Embeddings.
- Monitoring-/Alerting-Dienst.
- DNS-, Proxy- oder CDN-Anbieter, falls beteiligt.

Je Anbieter dokumentieren:

- Name des Anbieters.
- Leistungszweck.
- Verarbeitete Datenkategorien.
- Sitz/Land und Drittlandbezug.
- Vertrag/DPA-Status.
- Transfermechanismus, soweit erforderlich.
- Kuendigungs-, Rueckgabe- und Loeschprozess.

## Weisungen des Kunden

- Der Kunde legt fest, auf welcher Website das Widget genutzt wird.
- Der Kunde stellt Inhalte der Wissensbasis bereit oder gibt diese frei.
- Der Kunde legt erlaubte Domains, Kontaktziele, Datenschutzlink und Speicherdauer fest.
- Aenderungen an Verarbeitung, Loeschung, Export oder Integrationen sollten dokumentiert werden.
- Supportzugriffe auf Kundendaten erfolgen nur anlassbezogen und im notwendigen Umfang.

## Technische und organisatorische Massnahmen

Details sind in `docs/legal/tom-overview.md` dokumentiert. Kernthemen:

- Tenant- und Site-Trennung fuer Leads, Conversations, Knowledge Sources, Usage und Integrationen.
- Rollenbasierte Dashboard-Zugriffe.
- Widget-Origin- und Allowed-Domain-Pruefung.
- TLS/HTTPS fuer Widget, API und Dashboard.
- Keine Ausgabe von Secrets in API Responses, Logs, Exporten oder Dokumentation.
- PII-arme technische Logs und Alerts.
- Zentrale Lead-Speicherung vor Zustellversuchen.
- Usage-/Plan-Limits mit zentraler Pruefung.
- Sensitive-Data-Regeln: keine aktive Abfrage von Passwoertern, MFA-Codes, Zahlungsdaten oder Ausweisdaten.
- Lokale Backups, Offsite-Backups mit restic, Restore-Test aus Offsite-Kopie und Healthchecks.
- Production-Health-, Job-, Backup- und Offsite-Healthchecks mit SMTP-Alerting.

## Loesch- und Exportprozess

- Site-spezifischer Export: `GET /admin/sites/:siteId/privacy/export`.
- Site-spezifische Loeschung/Anonymisierung: `POST /admin/sites/:siteId/privacy/delete-data`.
- Einzelne Leads koennen ueber die Admin-/Dashboard-Lead-Funktion geloescht werden, soweit im konkreten Admin-Flow freigegeben.
- Conversation Export/Delete ist admin- und site-scoped.
- Loeschaktionen sollten auditierbar bleiben, ohne exportierte Rohdaten im Audit zu speichern.
- Backups koennen personenbezogene Daten enthalten und brauchen eine separate Retention- und Restore-Regel.
- Rueckgabe oder Loeschung bei Vertragsende muss vertraglich und technisch festgelegt werden.

## Speicherfristen

Vorschlag und offene Abstimmung sind in `docs/legal/data-retention-policy.md` dokumentiert.

Aktueller technischer Stand:

- Lokale DB-Backups: 14 Tage Retention.
- Offsite-Backup: aktiv ueber Hetzner Storage Box/restic; Retention/Prune separat freizugeben.
- Automatische Datenloeschung fuer fachliche Daten nicht neu aktivieren, bevor Fristen final abgestimmt, getestet und freigegeben sind.

## Support- und Zugriffsregelung

- Supportzugriffe nur nach Anlass, mit minimal notwendigem Umfang und dokumentierbarer Zweckbindung.
- Interne Zugriffe auf Kundendaten auf berechtigte Personen begrenzen.
- Keine Passwoerter, MFA-Codes, Zahlungsdaten oder Ausweisdaten aktiv im Chat erfragen.
- Bei versehentlich eingegebenen sensiblen Daten: Nutzer hinweisen, diese Daten nicht zu senden, und bei Bedarf Loeschprozess anbieten.
- Keine Lead-, Chat- oder Payload-Inhalte in externe Alerts oder Tickets kopieren, sofern nicht erforderlich und freigegeben.

## Incident- und Datenschutzvorfall-Prozess

Der technische Ablauf ist in `docs/ops/incident-response-runbook.md` vorbereitet.

Vor Kundengang klaeren:

- interne Meldestelle und Verantwortliche.
- Bewertung von Art, Umfang und betroffenen Daten.
- Kundeninformation und Eskalationsweg.
- rechtliche Meldefristen und Aufsichtsbehoerdenbezug juristisch pruefen.
- Sicherung relevanter Logs ohne unnoetige Datenkopien.
- technische Sofortmassnahmen und Nachbereitung.

## Offene juristische Pruefpunkte

- finaler AVV-Text und TOM-Anlage.
- finale Rollenverteilung je Kundenszenario.
- Liste und Vertragsstand der Unterauftragsverarbeiter.
- Drittlandtransfer und Transfermechanismen je Anbieter.
- Rechtsgrundlage fuer Chat-/Lead-Verarbeitung auf der Kundenseite.
- konkrete Datenschutzerklaerung des Kunden inklusive Widget-Hinweis.
- Cookie-/Consent-Bewertung fuer die konkrete Einbindung.
- Speicherfristen je Datenart.
- Rueckgabe- und Loeschpflichten bei Vertragsende.
- Umgang mit versehentlich eingegebenen besonders sensiblen Daten.
