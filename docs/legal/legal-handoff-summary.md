# Legal-Handoff Summary

Stand: 2026-05-28

Dieses Dokument ist ein technisches und organisatorisches Uebergabepaket fuer anwaltliche oder datenschutzrechtliche Pruefung. Es ist keine Rechtsberatung und enthaelt keine rechtlichen Garantien. Alle rechtlichen Einordnungen, Rollen, Rechtsgrundlagen, Vertragsbestandteile und Speicherfristen muessen vor Kundeneinsatz final geprueft werden.

## Produktueberblick

Das Produkt ist ein Website-Chat mit Lead-Erfassung fuer kleine und mittlere Unternehmen, insbesondere lokale Dienstleister wie Rohrreinigung, Handwerk und aehnliche Servicebetriebe.

Das Widget wird auf der Website des Kunden eingebunden. Besucher koennen Fragen stellen, Rueckruf- oder Serviceanfragen starten und bei Bedarf Kontaktdaten hinterlassen. Das System beantwortet einfache Fragen anhand der Site-Konfiguration und Wissensbasis und speichert qualifizierte Anfragen im Dashboard.

## Einsatzbereich

- lokale Dienstleister und Handwerksbetriebe
- Websitebesucher, Interessenten und Kunden des Websitebetreibers
- erste Anfrageaufnahme, Vorqualifizierung und Rueckrufwunsch
- Beantwortung von Kosten-, Ablauf- und Servicefragen auf Basis freigegebener Inhalte

## Verarbeitete Datenarten

Je nach Nutzung koennen verarbeitet werden:

- Chatnachrichten und Anliegen
- Name, Telefonnummer und optional E-Mail-Adresse
- Ort, PLZ, Einsatzgebiet oder Standortangabe
- Dringlichkeit, Termin- oder Rueckrufwunsch
- technische Sessiondaten, Zeitstempel, Site-/Tenant-Zuordnung
- Wissensbasis-Inhalte des Kunden
- technische Logs, Zustellstatus, Backup- und Monitoring-Statusdaten

Das System soll keine Passwoerter, MFA-Codes, Zahlungsdaten, Ausweisdaten oder vergleichbare sensible Zugangsdaten aktiv abfragen. Bei sensiblen Eingaben wird technisch ein Hinweis ausgegeben.

## Zwecke der Verarbeitung

- Betrieb eines Website-Chats
- Bearbeitung und Vorqualifizierung von Anfragen
- Rueckruf- und Lead-Verarbeitung
- Anzeige von Leads, Conversations und Statusinformationen im Dashboard
- Zustellung von Leads per E-Mail oder Webhook, soweit konfiguriert
- Beantwortung von Fragen anhand von Wissensbasis und Site-Konfiguration
- technischer Betrieb, Monitoring, Fehleranalyse, Sicherheit und Backup/Restore

## Voraussichtliche Rollen

- Kunde/Websitebetreiber: voraussichtlich Verantwortlicher, soweit er Zweck, Einbindung, Inhalte, Kontaktziele und Nutzung auf seiner Website bestimmt.
- Anbieter/Plattformbetreiber: voraussichtlich Auftragsverarbeiter, soweit Daten nach Weisung des Kunden verarbeitet werden.

Diese Einordnung ist ein Pruefansatz und muss je Vertrags- und Produktszenario juristisch bestaetigt werden. Abweichende Konstellationen, eigene Zwecke oder gemeinsame Verantwortlichkeit sind gesondert zu bewerten.

## Technischer Umsetzungsstand

- Tenant-/Site-Scope fuer Leads, Conversations, Knowledge, Usage, Integrationen und Widget Sessions gehaertet.
- Lead-Speicherung erfolgt vor E-Mail-/Webhook-Zustellung; Zustellfehler gefaehrden die Speicherung nicht.
- Dashboard zeigt abgeleiteten Zustellstatus ohne Job-Payloads.
- Consent-/Privacy-Konfiguration fuer das Widget vorhanden.
- Sensitive-Data-Schutz aktiv.
- Retention-Cleanup ist Opt-in und ohne `RETENTION_CLEANUP_ENABLED=true` deaktiviert.
- Lokale Backups, Offsite-Backups mit restic, Restore-Test aus Offsite-Kopie, Monitoring und Alerting sind technisch eingerichtet.
- Docker- und journald-Logrotation sind dokumentiert und konfiguriert.
- Ein moderates Next/PostCSS Dependency-Risiko ist dokumentiert; High/Critical Findings wurden zuletzt nicht festgestellt.

## Beiliegende Dokumente

- `docs/legal/avv-checklist.md`
- `docs/legal/tom-overview.md`
- `docs/legal/subprocessor-register.md`
- `docs/legal/data-retention-policy.md`
- `docs/legal/customer-go-live-legal-checklist.md`
- `docs/legal/widget-privacy-notice-template.md`
- `docs/legal/customer-privacy-policy-insert-template.md`
- `docs/legal/data-flow-overview.md`
- `docs/legal/legal-review-questions.md`
- `docs/ops/incident-response-runbook.md`
- `docs/ops/backup-restore-runbook.md`
- `docs/ops/monitoring-runbook.md`
- `docs/ops/retention-runbook.md`

## Final zu pruefende Punkte

- AVV und TOM-Anlage finalisieren.
- Rollenmodell je Kundenszenario bestaetigen.
- Rechtsgrundlagen und Informationspflichten auf Kundenseite pruefen.
- Unterauftragsverarbeiter, DPA/AVV-Status und Transfermechanismen pruefen.
- Drittlandtransfer je Anbieter bewerten.
- Speicherfristen je Datenart und Kunde festlegen.
- Kundendatenschutzerklaerung inklusive Chat-/Widget-Hinweis freigeben.
- Cookie-/Consent-Bewertung der konkreten Einbindung pruefen.
- Umgang mit versehentlich eingegebenen sensiblen Daten festlegen.
- Incident- und Meldeprozess organisatorisch freigeben.
