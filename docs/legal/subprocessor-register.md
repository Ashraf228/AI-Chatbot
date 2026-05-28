# Unterauftragsverarbeiter-Register

Stand: 2026-05-28

Dieses Register ist ein technischer Arbeitsstand fuer Datenschutz-/AVV-Pruefung. Es ist keine Rechtsberatung. Vertragsstaende, Laender, Transfermechanismen und Rollen muessen vor Kundeneinsatz konkret geprueft und freigegeben werden.

| Anbieter | Dienst/Zweck | Datenarten | Sitz/Land | EU/EWR oder Drittland | Vertrag/DPA vorhanden? | Transfermechanismus zu pruefen | Status | Notizen |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hosting-/Server-Anbieter | Betrieb von API, Dashboard, Widget, PostgreSQL, Redis und Proxy | Chatdaten, Leads, Site-/Tenant-Daten, technische Logs | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | konkreten Anbieter und Standort aus Serververtrag eintragen |
| Hetzner Storage Box | Offsite-Backup-Ziel fuer verschluesselte restic Snapshots | verschluesselte DB-Backups mit personenbezogenen Daten | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | technisch aktiv; restic verschluesselt clientseitig; keine Credentials im Repo |
| E-Mail-/SMTP-Anbieter | Lead-/Betriebsbenachrichtigungen und Monitoring-Alerts | technische Alertdaten, ggf. Lead-Benachrichtigungen je Konfiguration | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | keine Secret-Werte dokumentieren; Lead-Inhalte in Alerts vermeiden |
| KI-/API-Anbieter | Antwortgenerierung und ggf. Embeddings | Chatnachrichten, Wissensbasis-Kontext, technische Requestdaten | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | Datenfluss, Speicherbedingungen und Drittlandtransfer gesondert pruefen |
| DNS-/Proxy-/CDN-Anbieter | Domain, TLS, Routing und optional Schutzfunktionen | technische Requestdaten, IP-/Headerdaten je Dienst | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | nur aufnehmen, soweit tatsaechlich eingesetzt |
| Monitoring-/Alerting-Anbieter | externe Benachrichtigung bei Health-/Backup-Fehlern | technische Statusdaten, Host, Zeitpunkt, Check-Name | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | SMTP-Alerting aktiv; keine personenbezogenen Inhalte in Alerts vorgesehen |
| Git-/Repository-Anbieter | Quellcodeverwaltung und Release-Abgleich | Quellcode, keine produktiven Kundendaten vorgesehen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | zu pruefen | keine `.env`, Backups, Zertifikate oder Secrets committen |

## Pruefpunkte je Anbieter

- Ist der Anbieter tatsaechlich am konkreten Kundenbetrieb beteiligt?
- Welche Datenarten werden uebermittelt oder gespeichert?
- In welchem Land findet Verarbeitung statt?
- Gibt es einen DPA/AVV oder vergleichbaren Vertrag?
- Gibt es Drittlandtransfer und welcher Mechanismus wird genutzt?
- Gibt es technische oder organisatorische Schutzmassnahmen?
- Wie erfolgt Loeschung oder Rueckgabe bei Vertragsende?
- Wie werden Sicherheitsvorfaelle gemeldet?
