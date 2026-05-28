# TOM-Uebersicht fuer KI-Chat und Lead-Erfassung

Stand: 2026-05-28

Diese Uebersicht ist ein technischer und organisatorischer Entwurf. Sie ist keine Rechtsberatung und muss vor Kundeneinsatz juristisch und organisatorisch geprueft werden.

## Zugriffskontrolle

- Serverzugriff erfolgt ueber SSH/root oder berechtigte Admin-Zugaenge.
- Server-Secrets, Backup-Konfiguration und SSH-Keys liegen ausserhalb des Repositories.
- Secret-Dateien auf dem Server sollen restriktive Rechte haben, z. B. `600 root:root`.
- Das Dashboard ist fuer berechtigte Nutzer vorgesehen und nicht als oeffentliche Admin-Oberflaeche gedacht.
- Supportzugriffe auf Kundendaten erfolgen anlassbezogen und mit minimal notwendigem Umfang.

## Benutzer- und Rollenmodell

- Admin: technische und organisatorische Verwaltung der Plattform.
- Operator: operative Bearbeitung innerhalb erlaubter Tenants/Sites.
- Customer: kundenseitiger Zugriff, soweit im konkreten Rollenmodell vorgesehen.
- Tenant- und Site-Scope schuetzen Datenbereiche wie Leads, Conversations, Knowledge Sources, Usage und Integrationen.

## Tenant- und Site-Trennung

Tenant-/Site-Scope wurde fuer kritische Bereiche gehaertet:

- Leads und Widget-Leads.
- Conversations und Messages.
- Knowledge Sources, Documents und Chunks.
- Usage und Billing-Zuordnung.
- Site-Konfiguration, Module und Integrationen.
- Widget Sessions und erlaubte Domains.

Ziel ist, dass Daten einer Site oder eines Tenants nicht ueber fremde Site-/Tenant-Kontexte abrufbar sind.

## Transportverschluesselung

- Widget, API und Dashboard werden im Livebetrieb ueber HTTPS ausgeliefert.
- Widget-Session-Erstellung prueft erlaubte Domains/Origins.
- API-, Dashboard- und Widget-Endpunkte werden ueber den produktiven Proxy erreichbar gemacht.

## Datenspeicherung

- Primaere Kundendaten liegen in PostgreSQL.
- Redis wird fuer Cache, Rate Limits und queue-nahe Daten genutzt und ist nicht die primaere Quelle fuer Leads, Sites, Conversations oder Knowledge.
- Knowledge Sources, Documents und Chunks werden in PostgreSQL gespeichert.
- Backups enthalten personenbezogene Daten und sind entsprechend zu schuetzen.

## Backup-Konzept

Aktueller technischer Stand:

- taegliches lokales PostgreSQL-Backup.
- lokale Retention: 14 Tage.
- Offsite-Backup: Hetzner Storage Box.
- Offsite-Tool: restic.
- restic verschluesselt Snapshots clientseitig vor dem Upload.
- Offsite-Healthcheck ist aktiv.
- Restore-Test aus Offsite-Kopie wurde erfolgreich in isolierter Test-DB durchgefuehrt.
- Restore in Produktion nur mit Wartungsfenster, aktuellem Zusatzbackup und Freigabe.
- restic Retention-Dry-Run ist vorhanden; aktueller Dry-Run wuerde alle vorhandenen Snapshots behalten.

Retention/Prune fuer restic ist vorbereitet, aber separat freizugeben und zu testen.

## Monitoring und Alerting

Aktueller technischer Stand:

- Production-Healthcheck fuer API, Dashboard, Widget, Container, DB/Redis, Jobs, Backups, Offsite-Backup und Speicherplatz.
- Job-Healthcheck fuer pending/failed E-Mail- und Webhook-Jobs.
- lokaler Backup-Healthcheck.
- Offsite-Backup-Healthcheck.
- SMTP-basiertes externes Alerting fuer Production-Health- und Backup-Fehler.
- Alerts enthalten technische Statusdaten und keine Lead-Inhalte, Chatverlaeufe, Telefonnummern oder Secret-Werte.
- Docker-Logrotation ist fuer App-Services konfiguriert.
- journald-Retention ist serverseitig begrenzt.

## Protokollierung

- Technische Logs werden fuer Fehleranalyse und Betrieb genutzt.
- Logs sollen keine unnoetigen personenbezogenen Daten enthalten.
- Externe Alerts und Monitoring-Hinweise sollen keine personenbezogenen Inhalte enthalten.
- Bei tieferer Fehleranalyse sollen Rohdaten nur im geschuetzten Admin-/Server-Kontext ausgewertet werden.
- Docker-Container-Logs werden ueber `json-file` mit `max-size=10m` und `max-file=5` begrenzt.
- journald ist serverseitig mit `SystemMaxUse=500M` und `MaxRetentionSec=14day` konfiguriert.

## Sensitive-Data-Schutz

- Der Bot soll keine Passwoerter, MFA-Codes, Zahlungsdaten, Admin-Zugangsdaten oder Ausweisdaten aktiv erfragen.
- Bei sensiblen Eingaben wird der Nutzer darauf hingewiesen, solche Daten nicht im Chat einzugeben.
- IT-Support-Regeln verhindern riskante Befehle ohne verifizierte Wissensbasis und eskalieren bei Sicherheitsvorfaellen.
- Local-Service-Flows fragen nur fachlich erforderliche Daten ab, z. B. Problem, Ort/PLZ, Dringlichkeit, Telefonnummer und Name.

## Loesch- und Exportfaehigkeit

- Conversation Export/Delete ist site- und admin-scoped.
- Site-spezifische Privacy-Export- und Delete-Funktionen sind vorhanden.
- Leads koennen ueber die Admin-/Dashboard-Lead-Funktion geloescht werden, soweit im konkreten Admin-Flow freigegeben.
- Automatische fachliche Retention ist durch `RETENTION_CLEANUP_ENABLED=true` explizit opt-in und aktuell ohne Freigabe nicht aktiv.
- Retention-Dry-Run ist vorhanden und gibt nur aggregierte Counts aus.
- Loesch- und Exportprozesse muessen je Kunde organisatorisch beschrieben und freigegeben werden.
- Backups folgen einer separaten Retention; einzelne Loeschungen wirken nicht sofort auf bereits erstellte Backups.

## Incident Handling

- Monitoring und Alerting melden technische Fehler.
- Bei einem moeglichen Datenschutzvorfall muessen Scope, betroffene Tenants/Sites und Datenarten geprueft werden.
- Logs und relevante technische Informationen sollen gesichert werden, ohne unnoetige Datenkopien zu erzeugen.
- Kundeninformation, Meldepflicht und Fristen muessen juristisch bewertet werden.
- Der Ablauf ist in `docs/ops/incident-response-runbook.md` vorbereitet.

## Wartung und Updates

- npm-audit-Findings werden bewertet und dokumentiert.
- Ein Dependency-Risk-Register existiert unter `docs/security/dependency-risk-register.md`.
- High/Critical Findings wurden zuletzt behoben; ein moderates Next/PostCSS-Finding ist dokumentiert und fuer Review eingeplant.
- Regelmaessige Rechecks vor Produktionsausbau und vor zahlenden Kunden sind vorgesehen.

## Offene Punkte

- finale juristische Pruefung von AVV, TOMs und Datenschutzhinweisen.
- finale Speicherfristen je Kunde.
- Verträge/DPA und Transfermechanismen je Unterauftragsverarbeiter.
- Drittlandtransferbewertung je Anbieter.
- restic Retention/Prune nach separater Freigabe aktivieren.
- regelmaessiger Review von Dependency-Risiken und Backup-/Restore-Nachweisen.
