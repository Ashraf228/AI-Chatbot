# Support und Operations

Stand: 2026-05-28

Operative Vorlage fuer den Kundenbetrieb. Dieses Dokument ist kein SLA und keine Rechtsberatung. Reaktionszeiten sind Vorschlaege und muessen vor Vertragsnutzung separat vereinbart werden.

## Was wird ueberwacht?

- API Health.
- Widget Loader und Widget Config.
- Dashboard Login.
- Datenbank und Redis.
- Container Health.
- Lokales Backup.
- Offsite Backup.
- Lead-Zustellung.
- E-Mail- und Webhook-Jobs.
- Speicherplatz.
- Kritische Logmuster.

## Was passiert bei Fehler?

1. Alert oder manueller Check faellt auf.
2. Technische Analyse anhand Monitoring-Runbook.
3. Betroffenen Bereich eingrenzen: API, Widget, Dashboard, DB/Redis, Backup, Jobs oder Integration.
4. Kunde informieren, falls Kundenbetrieb oder Lead-Zustellung betroffen sein kann.
5. Incident dokumentieren, falls relevant.
6. Nachbeobachtung und Korrekturmassnahmen festhalten.

## Wie meldet der Kunde ein Problem?

- Supportkontakt: `[SUPPORT_EMAIL_ODER_KONTAKT]`
- Dringende technische Stoerung: `[ESKALATIONSKONTAKT]`
- Inhaltliche Anpassung/Wissensbasis: `[FACHKONTAKT]`

## Reaktionsklassen als Vorschlag

Diese Klassen sind nicht verbindlich, solange sie nicht vertraglich vereinbart wurden.

| Klasse | Beispiel | Ziel fuer interne Priorisierung |
| --- | --- | --- |
| Kritisch | Widget/API nicht erreichbar, Leads koennen nicht gespeichert werden | schnell pruefen und priorisieren |
| Hoch | Lead-Zustellung gestoert, Leads bleiben aber gespeichert | zeitnah analysieren |
| Normal | Antwortqualitaet, Wissensbasis, kleine UI-Frage | im normalen Supportprozess bearbeiten |
| Niedrig | Wunsch nach Text-/Designanpassung | in naechster Anpassungsrunde planen |

## Monatliche Betriebspruefung

- Leads und Zustellstatus stichprobenartig pruefen.
- Haeufige Fragen sammeln.
- Wissensbasis aktualisieren.
- Backup- und Offsite-Health pruefen.
- Restore-Test-Nachweis pruefen.
- Dependency Review pruefen.
- Monitoring- und Alert-Konfiguration pruefen.
- Offene Kundenpunkte nachverfolgen.

## Wissensbasis-Aktualisierung

- Aktualisieren, wenn Leistungen, Preise, Regionen, Oeffnungszeiten oder Prozesse geaendert werden.
- Kunde liefert fachlich freigegebene Inhalte.
- Anbieter oder Betreiber importiert Inhalte nach vereinbartem Prozess.
- Antworten werden mit Testfragen geprueft.
- Alte oder widerspruechliche Inhalte werden entfernt oder deaktiviert.

## Nicht enthalten, sofern nicht beauftragt

- 24/7 manueller Support.
- Juristische Pruefung.
- Individuelle CRM-Integration.
- Telefon-KI.
- WhatsApp.
- Kundenspezifische API-Integrationen.
- Redaktionelle Pflege ohne separate Beauftragung.
