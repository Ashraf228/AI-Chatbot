# AVV-Checkliste fuer KI-Chat und Lead-Erfassung

Stand: technischer Entwurf, keine Rechtsberatung. Vor Kundeneinsatz juristisch pruefen lassen.

## Rollenmodell

- Kunde/Website-Betreiber: in der Regel Verantwortlicher, weil Zweck und Einsatz des Widgets auf der Kundenwebsite festgelegt werden.
- Plattformbetreiber: in der Regel Auftragsverarbeiter, soweit Daten nur nach Weisung des Kunden verarbeitet werden.
- Abweichungen, gemeinsame Verantwortlichkeit oder eigene Zwecke muessen im Einzelfall geprueft werden.

## Verarbeitete Datenarten

- Chatnachrichten und technische Conversation-Daten.
- Kontaktdaten aus Lead-/Rueckrufanfragen: Name, E-Mail, Telefonnummer.
- Anliegen, Einsatzort/PLZ, Dringlichkeit und freiwillige Nutzerangaben.
- Technische Metadaten wie Site, Session, Zeitstempel, Widget-Origin und Statuswerte.
- Audit-/Betriebslogs mit reduzierten oder maskierten personenbezogenen Daten.

## Zwecke

- Beantwortung von Kundenfragen auf der Website.
- Vorqualifizierung von Service-/Kontaktanfragen.
- Speicherung und Anzeige von Leads im Dashboard.
- optionale Weiterleitung an E-Mail/Webhook/Integrationen.
- Fehleranalyse, Sicherheit, Missbrauchsschutz und Nachvollziehbarkeit.

## Unterauftragsverarbeiter

Vor Kundengang konkret eintragen und vertraglich pruefen:

- Hosting/Serverbetrieb.
- Datenbank-/Redis-Betrieb, falls extern.
- E-Mail-/SMTP-Anbieter fuer Benachrichtigungen.
- KI-/API-Anbieter fuer Antwortgenerierung und optional Embeddings.
- Monitoring/Backup-Anbieter, falls eingesetzt.

Zu dokumentieren:

- Name des Anbieters.
- Leistungszweck.
- Verarbeitete Datenkategorien.
- Standort/Drittlandbezug.
- TOMs und Nachweise.
- Kuendigungs-/Loeschprozess.

## Technische und organisatorische Massnahmen

- Tenant- und Site-Trennung fuer Datenbankabfragen.
- Rollenbasierte Dashboard-Zugriffe.
- Widget-Origin-/Domain-Pruefung.
- Rate Limits fuer Widget, Login, Ingest und Integrations-Tests.
- TLS/HTTPS im Betrieb.
- Secrets nicht in API Responses, Logs, Exporten oder Audit-Metadaten ausgeben.
- PII-Maskierung fuer technische Logs und Audits.
- Backups zugriffsbeschraenken und verschluesselt speichern.
- Admin-Zugriff nur fuer berechtigte Personen, nachweisbar und entziehbar.

## Loesch- und Exportprozess

- Site-spezifischer Export: `GET /admin/sites/:siteId/privacy/export`.
- Site-spezifische Loeschung/Anonymisierung: `POST /admin/sites/:siteId/privacy/delete-data`.
- Einzelne Leads koennen ueber die Admin-/Dashboard-Lead-Funktion geloescht werden.
- Conversation Export/Delete ist admin- und site-scoped.
- Loeschaktionen muessen auditierbar bleiben, ohne exportierte Rohdaten im Audit zu speichern.
- Backups koennen personenbezogene Daten enthalten und brauchen eine separate Retention-/Restore-Regel.

## Retention

Technische Defaults im System:

- Conversations: 90 Tage, falls keine Site-Konfiguration abweicht.
- Leads: 365 Tage, falls keine Site-Konfiguration abweicht.
- Reports: 365 Tage, falls keine Site-Konfiguration abweicht.
- Audit Logs: 180 Tage als Zielwert dokumentiert; operative Bereinigung separat pruefen.

Vor Kundengang klaeren:

- Gewuenschte Aufbewahrungsfristen pro Kunde.
- Ob automatische Bereinigung aktiv bleiben soll.
- Wie Backup-Retention dazu passt.

## Support- und Zugriffsregelung

- Supportzugriffe nur nach Anlass und mit minimal notwendigem Umfang.
- Keine Passwoerter, MFA-Codes, Zahlungsdaten oder Ausweisdaten im Chat erfragen.
- Bei versehentlich eingegebenen sensiblen Daten: nicht weiterverarbeiten, Nutzer warnen und ggf. Loeschprozess anbieten.
- Zugriffe auf Kundendaten intern dokumentieren.

## Datenschutzvorfall

Vor Kundengang Prozess festlegen:

- Meldestelle intern.
- Bewertung von Art, Umfang und betroffenen Daten.
- Benachrichtigung des Kunden.
- Fristen und Verantwortlichkeiten.
- Sicherung relevanter Logs ohne unnoetige Datenkopien.
- technische Sofortmassnahmen und Nachbereitung.

## Juristisch offen

- AVV-Text und TOM-Anlage.
- Liste der Unterauftragsverarbeiter.
- Drittlandtransfer und Rechtsgrundlage je Anbieter.
- Rechtsgrundlage fuer Chat-/Lead-Verarbeitung auf der Kundenwebsite.
- Datenschutzerklaerung des Kunden inkl. Widget-Hinweis.
- Cookie-/Consent-Bewertung fuer konkrete Einbindung.
