# Datenfluss-Uebersicht

Stand: 2026-05-28

Diese Uebersicht beschreibt den technischen Datenfluss fuer den KI-Chat und die Lead-Erfassung. Sie ist keine Rechtsberatung. Rechtsgrundlagen, Informationspflichten, Rollen und Speicherfristen muessen fuer den konkreten Kundenfall geprueft werden.

| Schritt | Datenart | System | Zweck | Speicherort | Empfaenger | Offene Pruefpunkte |
| --- | --- | --- | --- | --- | --- | --- |
| Widget wird geladen | technische Requestdaten, Domain, ggf. IP-/Headerdaten | Kundenwebsite, Widget, Proxy | Chat-Widget bereitstellen | technische Logs, soweit erforderlich | Websitebesucher, Proxy/Hosting | Einbindung, Cookie-/Consent-Bewertung, Datenschutzhinweis |
| Consent-/Privacy-Hinweis | keine oder minimale technische Sessiondaten | Widget | Nutzer ueber Verarbeitung und Datenschutzerklaerung informieren | Widget-Konfiguration in DB | Websitebesucher | Text final juristisch pruefen, Kunden-Privacy-URL pflegen |
| Session startet | Site-Key, erlaubter Origin, Visitor-/Session-ID, technische Metadaten | API, Widget Session Service | gueltige Site/Domain pruefen, Chat starten | PostgreSQL | Plattform/Dashboard | Rechtsgrundlage und technische Sessiondauer pruefen |
| Chatnachricht | Chattext, Anliegen, Zeitstempel, Session-/Site-Zuordnung | API, Chat Pipeline | Anfrage verstehen und beantworten | PostgreSQL, ggf. KI/API-Verarbeitung | Plattform, KI/API-Anbieter soweit genutzt | KI-Anbieter, Drittlandtransfer, Transparenzhinweis |
| Wissensbasis-Abfrage | Kundeninhalte, relevante Knowledge Chunks, technische Querydaten | API, Knowledge Retrieval | Antwort anhand freigegebener Inhalte stuetzen | PostgreSQL | Plattform, ggf. KI/API-Anbieter | Kundendaten in Knowledge Sources pruefen |
| Lead-Erfassung | Name, Telefon, E-Mail optional, Problem, Ort/PLZ, Dringlichkeit | API, Widget Leads | Anfrage/Rueckruf speichern und vorqualifizieren | PostgreSQL | Websitebetreiber/Dashboard | Datenminimierung, Pflicht-/Optionale Felder, Rechtsgrundlage |
| Zustellung per E-Mail | Lead-Benachrichtigung, technische Zustelldaten | Email Jobs, SMTP | Lead an konfiguriertes Ziel senden | PostgreSQL Jobstatus, SMTP-System | Websitebetreiber, SMTP-Anbieter | DPA/AVV SMTP, Inhalt der Benachrichtigung, Fehlerbehandlung |
| Zustellung per Webhook | Lead-Event, technische Zustelldaten | Webhook Jobs | Lead an Integration weitergeben | PostgreSQL Jobstatus, Zielsystem | Websitebetreiber/Integration | Zielsystem, DPA/AVV, Payload-Minimierung |
| Dashboard-Anzeige | Leads, Conversations, Zustellstatus, Site-Kontext | Dashboard, API | Bearbeitung und Ueberblick fuer berechtigte Nutzer | PostgreSQL | berechtigte Dashboard-Nutzer | Rollen/Rechte, Kunden-Zugriffsmodell, Protokollierung |
| Export/Loeschung | Site-spezifische Daten, Exportdateien, Loeschstatus | API/Dashboard | Betroffenenrechte und Vertragsende unterstuetzen | PostgreSQL, temporaere Exportausgabe | berechtigte Admin-/Kundenrolle | Prozess, Identitaetspruefung, Backup-Auswirkung |
| Lokales Backup | PostgreSQL-Dump mit Kundendaten | Backup-Script, Server-Dateisystem | Wiederherstellbarkeit | `/root/AI-Chatbot/backups` auf Server | Plattform/Admin | Zugriffsschutz, lokale Retention, Restore-Prozess |
| Offsite-Backup | verschluesselte restic Snapshots | restic, Hetzner Storage Box | Schutz vor Server-/DB-Verlust | Hetzner Storage Box | Plattform/Admin, Backup-Anbieter | DPA/AVV, Speicherort, Retention/Prune-Freigabe |
| Monitoring/Alerting | technische Statusdaten, Host, Zeitpunkt, Check-Status | Health Scripts, SMTP Alerting | Ausfaelle und Backup-/Job-Probleme erkennen | Server-Logs, SMTP-Transport | Plattform/Admin, SMTP-Anbieter | Alert-Inhalte, keine personenbezogenen Inhalte, DPA/AVV |
| Logrotation | technische Logs | Docker, journald | Betrieb und Fehleranalyse begrenzen | Server-Logs | Plattform/Admin | Aufbewahrungsdauer, PII-Minimierung, Zugriffsschutz |

## Grundregeln fuer den Betrieb

- Keine Secret-Werte in Git, Logs, Alerts oder Dokumentation aufnehmen.
- Keine Backup-Inhalte in Tickets, Chats oder externe Tools kopieren.
- Keine Lead-Inhalte, Telefonnummern, Namen oder Chatverlaeufe in Monitoring-Alerts senden.
- Retention-Cleanup nur nach finaler Freigabe aktivieren.
- Restore in Produktion nur mit Wartungsfenster, aktuellem Zusatzbackup und Freigabe.
