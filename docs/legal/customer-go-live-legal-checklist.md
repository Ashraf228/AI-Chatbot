# Kunden-Go-Live-Checkliste Datenschutz und Organisation

Stand: 2026-05-28

Diese Checkliste ist eine operative Vorbereitung fuer Kundengo-live. Sie ist keine Rechtsberatung und muss je Kunde fachlich und juristisch freigegeben werden.

## Vor jedem Kunden-Go-live pruefen

- Impressum auf der Kundenseite vorhanden.
- Datenschutzerklaerung auf der Kundenseite vorhanden.
- Chat/Widget ist in der Datenschutzerklaerung erwaehnt.
- `privacyUrl` im Widget ist gesetzt.
- `privacyUrl` ist erreichbar.
- `consentRequired` ist entsprechend juristischer Bewertung aktiv.
- erlaubte Domain ist korrekt gesetzt.
- keine falsche oder fremde Domain ist erlaubt.
- AVV ist vorbereitet, geprueft und bei Bedarf unterschrieben.
- Unterauftragsverarbeiter sind offengelegt oder geprueft.
- Speicherfristen sind abgestimmt.
- Kontakt fuer Datenschutzanfragen ist festgelegt.
- Loesch-/Exportprozess ist bekannt.
- Bot fordert keine Passwoerter, Zahlungsdaten, MFA-Codes, Ausweisdaten oder besonders sensiblen Daten aktiv an.
- Hinweis auf automatisierten digitalen Assistenten ist sichtbar oder in Datenschutzhinweisen enthalten.
- Testlead mit klaren TEST-Daten wurde durchgefuehrt, falls fuer Abnahme erforderlich.
- Testlead wurde geloescht oder bleibt klar als Test markiert.
- Wissensbasis enthaelt keine fremden Kundendaten.
- Lead-Zieladresse oder Zustellweg ist korrekt.
- Leads erscheinen im Dashboard.
- Conversations erscheinen im Dashboard.
- Monitoring fuer API, Dashboard, Widget, Jobs und Backups ist aktiv.
- lokales Backup ist aktiv.
- Offsite-Backup ist aktiv.
- Restore-Test aus Offsite-Kopie ist nachgewiesen.
- rechtliche Pruefpunkte sind dokumentiert und freigegeben.

## Technischer Demo-/Abnahmecheck

- Widget loader laedt auf der Kundendomain.
- Widget Config laedt fuer den korrekten Site-Key.
- gueltiger Origin startet eine Session.
- ungueltiger Origin wird geblockt.
- Datenschutzhinweis ist sichtbar und nicht irrefuehrend.
- Testfrage wird fachlich passend beantwortet.
- Preis-/Kostenfragen fuehren nicht zu unnoetigem Lead-Druck.
- Rueckrufwunsch fuehrt zu einer klaren, optionalen Kontaktaufnahme.
- sensible Eingaben loesen einen Schutz-/Warnhinweis aus.

## Nicht im Video oder Kundentermin zeigen

- `.env`, Secret-Dateien, SSH-Keys oder Backup-Konfiguration.
- echte Telefonnummern, E-Mail-Adressen, Chatverlaeufe oder Lead-Inhalte.
- interne Serverpfade, sofern nicht fuer technische Freigabe erforderlich.
- API-Keys, SMTP-Werte oder Webhook-URLs.
