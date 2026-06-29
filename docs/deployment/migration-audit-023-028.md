# Migration Audit 023-028

Datum: 2026-06-29

## Summary

- M1 Read-only Audit: `PASS`
- M2 Staging Migration Dry-Run: `PASS`
- M2B Target App Validation: `PASS`
- M2C Provider Fix / Public Widget Smoke: `PASS`
- M3 Production Migration + Deploy: `PASS`
- Finale Bewertung: Deployment akzeptiert; keine Production-Feature-Flags aktiviert.

Ziel dieses Audits ist eine Read-only-Bewertung der in Production fehlenden Migrationen `023` bis `028` vor einem Production-Deploy des Main-Stands `05646eb0386730959eae0d68199a697965fb8047`.

## Ausgangslage

- Main-Zielstand: `05646eb0386730959eae0d68199a697965fb8047`
- Production App-Commit laut `/healthz`: `8935c106dd3e5246a353bd48743b2675b26a1a61`
- Production Server-Repo: `13c5c0af97c83c356c3b2b75557e362916e771d8`
- Production Health vor Audit: `PASS`
- Conversation-Engine-Flags in Production: nicht aktiv
- AssistantProfile-/Conversation-Engine-Testmodule in Production: nicht vorhanden
- Ausdrueckliche Grenze dieses Audits: keine Migration, kein Deploy, keine Daten- oder Config-Aenderung

## Production-Stand

Production hat laut `schema_migrations` Migrationen `001` bis `022_it_support_ticket_fields.sql` angewendet. Die Zielobjekte aus `023` bis `028` sind nicht teilweise angewendet.

Read-only Row Counts der betroffenen Bestandsobjekte:

| Tabelle | Row Count |
| --- | ---: |
| `widget_events` | 228 |
| `tenant_users` | 0 |
| `sites` | 2 |
| `conversations` | 16 |
| `agent_tickets` | 0 |
| `integration_connections` | 0 |
| `webhook_jobs` | 0 |

Nicht vorhanden sind derzeit:

- Tabellen: `evaluation_chat_sessions`, `evaluation_ticket_previews`, `evaluation_handoff_events`, `evaluation_handoff_deliveries`, `evaluation_mock_handoff_receipts`
- Spalten aus `024` bis `028`, darunter `tenant_users.expires_at`, `tenant_users.evaluation_site_id`, `sites.is_evaluation_demo`, `agent_tickets.confirmation_id`, `integration_connections.signing_mode`, `webhook_jobs.payload_body`
- Indizes und Constraints aus `024` bis `028`

## Zielstand

Der Zielstand enthaelt die Migrationen:

- `023_normalize_widget_analytics_events.sql`
- `024_tenant_user_expiration.sql`
- `025_evaluation_workspace_access.sql`
- `026_evaluation_product_support_tickets.sql`
- `027_evaluation_signed_handoff.sql`
- `028_generic_webhook_signing_modes.sql`

Der neue Universal-Assistant-/Conversation-Engine-Stack selbst verwendet nach aktuellem Code-Review keine eigene neue Migration. Der Deploy ist dennoch blockiert, weil der Zielstand insgesamt Code enthaelt, der auf Schemaobjekte aus `024` bis `028` zugreift.

## Migrationen

| Nr. | Datei | Zweck | Betroffene Tabellen | Spalten | Indizes / Constraints / FKs | Datenmigration | DDL-only | Lock-/Blockierpotenzial | Risiko |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 023 | `023_normalize_widget_analytics_events.sql` | Historische Widget-Analytics-Eventnamen auf kanonische Werte normalisieren. | `widget_events` | `event_type` | keine | ja, `UPDATE` auf bekannte Aliasse | nein | niedrig bis mittel, abhaengig von `widget_events` Groesse; Production aktuell 228 Zeilen | low |
| 024 | `024_tenant_user_expiration.sql` | Zeitliche Begrenzung fuer Tenant-User vorbereiten. | `tenant_users` | `expires_at` | partieller Index `idx_tenant_users_expires_at` | nein | ja | niedrig; Tabelle leer | low |
| 025 | `025_evaluation_workspace_access.sql` | Evaluation-/Demo-Zugriff und Evaluation-Chat-Sessions einfuehren. | `sites`, `tenant_users`, neue `evaluation_chat_sessions` | `sites.is_evaluation_demo`, `tenant_users.evaluation_site_id` | FK `tenant_users_evaluation_site_fk`, Indizes `idx_tenant_users_evaluation_site`, `idx_sites_evaluation_demo`, `idx_evaluation_chat_sessions_owner` | nein | ja | niedrig bis mittel; FK/Index auf leeren bzw. kleinen Tabellen | low |
| 026 | `026_evaluation_product_support_tickets.sql` | Demo-Produktsupport-Tickets und bestaetigte Ticket-Previews einfuehren. | `agent_tickets`, neue `evaluation_ticket_previews` | mehrere additive Ticketspalten, u. a. `support_profile`, `confirmation_status`, `forwarding_status`, `demo`, `synthetic`, `confirmation_id` | Unique Index `agent_tickets_confirmation_id_unique`, Demo-Index, FKs auf Evaluation-/Tenant-/Site-Tabellen | nein | ja | niedrig; `agent_tickets` leer | low |
| 027 | `027_evaluation_signed_handoff.sql` | Signierten Evaluation-Mock-Handoff speichern und idempotent pruefen. | neue `evaluation_handoff_events`, `evaluation_handoff_deliveries`, `evaluation_mock_handoff_receipts` | neue Tabellenfelder | Unique Constraints fuer Event/Ticket/Delivery/Attempt, Demo-Check, mehrere FKs und Indizes | nein | ja | niedrig; neue Tabellen | low |
| 028 | `028_generic_webhook_signing_modes.sql` | Generische Webhook-Signaturmodi einfuehren; bestehende Webhooks explizit Legacy, neue HMAC. | `integration_connections`, `webhook_jobs` | `signing_mode`, `event_id`, `last_delivery_id`, `payload_body`, `signing_secret`, `signing_secret_encrypted` | Check Constraints, Unique Index `webhook_jobs_event_id_unique_idx`, Defaults und `NOT NULL` | ja, mehrere `UPDATE`s | nein | mittel wegen `ALTER COLUMN SET NOT NULL`, Unique Index und Backfill; Production-Tabellen aktuell leer | medium |

## Risikoanalyse

Die Migrationen sind ueberwiegend additiv. Kritisch im Sinne der Ausfuehrungsplanung ist vor allem `028`, weil sie Bestandsdaten in `integration_connections` und `webhook_jobs` klassifiziert, danach `NOT NULL` setzt und einen Unique Index auf `webhook_jobs.event_id` erstellt. In der aktuellen Production sind beide Tabellen leer, wodurch das konkrete Risiko niedrig bleibt. Strukturell ist `028` dennoch die Migration mit dem hoechsten Risikoprofil.

`023` fuehrt ein Daten-Update auf `widget_events` aus. Bei 228 Zeilen ist das Risiko niedrig. Auf groesseren Installationen waere ein laengerer Row Lock moeglich.

`024` bis `027` sind additive DDL mit neuen Spalten, Tabellen, FKs, Indizes und Constraints. Die aktuellen Row Counts sind klein bzw. leer, daher ist keine laengere Blockade zu erwarten. `CREATE INDEX` wird nicht `CONCURRENTLY` ausgefuehrt; bei den aktuellen Groessen ist das vertretbar, fuer groessere Production-Datenbestaende waere es anders zu bewerten.

## Forward-/Backward-Kompatibilitaet

| Migration | Mit aktuellem Production-Code kompatibel? | Mit neuem Main-Code kompatibel? | Muss vor App-Deploy laufen? | Muss App vor Migration laufen? | Sicher vorab bei laufendem altem Code? | Wartungsfenster? | Backfill? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 023 | ja | ja | nein | nein | ja | nein | ja, kleines Update |
| 024 | ja | ja | ja, sobald Viewer-Expiration-Code aktiv ist | nein | ja | nein | nein |
| 025 | ja | ja | ja, Evaluation-/Viewer-Code erwartet `is_evaluation_demo` und `evaluation_site_id` | nein | ja | nein | nein |
| 026 | ja | ja | ja, Evaluation-Ticket-Code erwartet Spalten/Tabellen | nein | ja | nein | nein |
| 027 | ja | ja | ja, Handoff-Code erwartet Tabellen | nein | ja | nein | nein |
| 028 | ja, sofern Legacy-Code unbekannte Zusatzspalten ignoriert | ja | ja, Webhook-Code erwartet `signing_mode`/`payload_body` | nein | ja, mit leerer Production-Tabelle besonders risikoarm | empfohlen kurz | ja, auf leeren Tabellen effektiv ohne Datenlast |

Gesamtbewertung: Migrationen zuerst, danach App-Deploy. Der neue Main-Code ist nicht sicher gegen das aktuelle Production-Schema, weil mehrere Services direkt auf neue Spalten und Tabellen zugreifen.

## Breaking-Change-Pruefung

Gefunden:

- Keine `DROP TABLE`
- Keine `DROP COLUMN`
- Keine `RENAME TABLE`
- Keine `RENAME COLUMN`
- Keine Datenloeschung
- Keine destructive updates
- Keine `ALTER TYPE`

Risikopunkte:

- `028` enthaelt `ALTER COLUMN ... SET NOT NULL` auf bestehenden Tabellen nach Backfill.
- `028` enthaelt `CREATE UNIQUE INDEX` auf `webhook_jobs(event_id)`.
- `025`, `026`, `027` enthalten neue Foreign Keys.
- Mehrere `CREATE INDEX`-Statements sind nicht `CONCURRENTLY`.

Blocker wurden im aktuellen Production-Zustand nicht gefunden, weil die betroffenen Bestandsdaten klein bzw. leer sind. Vor Ausfuehrung muss dennoch ein Backup vorliegen.

## Production-Schema-Pruefung

Read-only bestaetigt:

- `schema_migrations` endet bei `022_it_support_ticket_fields.sql`.
- Zielspalten aus `024` bis `028` existieren nicht.
- Zieltabellen aus `025` bis `027` existieren nicht.
- Zielindizes und Zielconstraints aus `024` bis `028` existieren nicht.
- Keine teilweise Migration erkannt.
- Keine personenbezogenen Datensaetze oder Inhalte wurden ausgegeben.

Idempotenzbewertung:

- Die meisten DDL-Operationen verwenden `IF NOT EXISTS` oder pruefen Constraints per `DO`-Block.
- `028` ist teilweise idempotent fuer Spalten/Constraints, aber die `ALTER COLUMN SET NOT NULL`-Schritte setzen voraus, dass der Backfill erfolgreich war.
- `023` ist inhaltlich idempotent, weil bereits normalisierte Werte nicht mehr im `WHERE`-Set liegen.

## Backup- und Rollback-Plan

Vor `14I-M2`/`14I-M3` erforderlich:

- Vollstaendiges DB-Backup: ja
- Schema-only Backup: ja, empfohlen fuer schnelle Strukturpruefung
- Point-in-time Recovery: pruefen; falls nicht verfuegbar, Restore aus aktuellem Backup als Mindestanforderung
- Restore-Test: aktueller Offsite-Restore-Test vorhanden halten; fuer Production-Migrationsfenster mindestens Backup-Validierung unmittelbar vorher
- App-Rollback nach Migration: grundsaetzlich moeglich, weil Migrationen additiv sind und alter Code Zusatzspalten ignorieren sollte
- Automatisches SQL-Rollback: nein
- Manueller Rollback: teilweise moeglich, aber nicht empfohlen, da `023` Datenwerte normalisiert und `028` Webhook-Signaturzustand klassifiziert
- Restore aus Backup erforderlich bei schwerem Fehler: ja
- Erwartete Downtime: voraussichtlich keine harte Downtime; kurzes Wartungsfenster empfohlen, weil Migration `028` Locks auf Webhook-Tabellen nimmt

## Empfohlene Ausfuehrungsstrategie

Empfehlung: Option A - Migrationen `023` bis `028` zuerst kontrolliert ausfuehren, danach App deployen.

Begruendung:

- Der neue Main-Code referenziert Schemaobjekte aus `024` bis `028`.
- Die Migrationen sind mit dem aktuell laufenden Code kompatibel, da sie additiv sind und keine alten Spalten entfernen.
- Die konkreten Production Row Counts reduzieren Lock-/Backfill-Risiko deutlich.
- Ein App-zuerst-Deploy waere unsicher, weil der neue Code bei Zugriff auf fehlende Tabellen/Spalten Fehler ausloesen kann.

Nicht empfohlen:

- App zuerst deployen.
- Migrationen und App-Deploy ohne Backup in einem Schritt zusammenziehen.
- Feature Flags in Production vor erfolgreichem Schema- und App-Deploy setzen.

## Blocker

Keine strukturellen Blocker fuer einen kontrollierten Migrations-Dry-Run erkannt.

Harte Voraussetzung bleibt: Migrationen duerfen nicht im Rahmen von Schritt 14I ausgefuehrt werden. Dafuer ist ein separater Migrationsschritt mit Backup-Freigabe noetig.

## Freigabevoraussetzungen fuer 14I-M2

`14I-M2` sollte nur starten, wenn:

- Production Health unmittelbar vorher `PASS` ist.
- Vollstaendiges DB-Backup erfolgreich erstellt wurde.
- Backup-Datei/Backup-Job ohne Secret-Ausgabe dokumentiert ist.
- `schema_migrations` weiterhin bei `022` endet.
- Row Counts der betroffenen Tabellen erneut plausibel sind.
- Migration-Dry-Run oder transaktionale Vorpruefung auf einer Kopie/Staging-DB erfolgreich war.
- Kein Production-Feature-Flag fuer Conversation Engine aktiv ist.
- Kein App-Deploy im selben Schritt erfolgt.

## Freigabevoraussetzungen fuer 14I-M3

`14I-M3` sollte nur starten, wenn:

- `14I-M2` erfolgreich abgeschlossen und dokumentiert ist.
- Migrationen `023` bis `028` in Production angewendet und in `schema_migrations` sichtbar sind.
- Post-Migration-Schema-Check alle Zieltabellen, Spalten, Indizes und Constraints bestaetigt.
- Production Health nach Migration `PASS` ist.
- Keine neuen kritischen Logs nach Migration auftreten.
- App-Deploy-Plan mit `APP_COMMIT_SHA=05646eb0386730959eae0d68199a697965fb8047` freigegeben ist.
- Feature Flags weiterhin false/unset bleiben.
- Public Widget weiterhin Legacy-Pipeline nutzt.

## Dry-Run Ergebnis 14I-M2

Datum/Zeit: 2026-06-28 23:01:52Z bis 2026-06-28 23:01:54Z

### Umgebung

- Stack: `knete-staging`
- Compose-Datei: `docker-compose.staging.yml`
- DB-Name: `chatbot_staging`
- DB-Host: interner Docker-Service `db` im Staging-Stack
- Staging-Nachweis:
  - Compose-Projektname enthaelt `staging`
  - DB-Name enthaelt `staging`
  - Stack ist separat von `ai-chatbot` Production
  - Staging-Stack hatte `6` Services, `0` unhealthy/bad
  - Staging-Sites: `1`
  - Staging-Site mit Demo/Staging/Test/Localhost-Domain-Marker: `1`
  - Produktionsaehnliche Domain-Marker in Staging-Sites: `0`
- Production betroffen: nein

Rollback-/Clone-Status:

- Staging-DB ist ein separater Staging-Stack, keine Production-DB.
- Ein expliziter Snapshot-Zeitpunkt wurde in diesem Lauf nicht verifiziert.
- Die Staging-DB ist technisch separat und kann bei Bedarf aus Staging-/Backup-Prozess neu aufgebaut werden.
- Fuer Production-Migration bleibt ein frisches vollstaendiges Backup zwingend.

### Vorher-Zustand

- Letzte angewendete Migration: `022_it_support_ticket_fields.sql`
- Migrationen `023` bis `028` vorher angewendet: `0`
- Zieltabellen aus `025` bis `027` vorher vorhanden: `0`
- Zielspalten aus `024` bis `028` vorher vorhanden: `0`

Row Counts vorher:

| Tabelle | Row Count |
| --- | ---: |
| `widget_events` | 0 |
| `tenant_users` | 1 |
| `sites` | 1 |
| `agent_tickets` | 0 |
| `integration_connections` | 0 |
| `webhook_jobs` | 0 |

### Ausfuehrung

Die SQL-Dateien wurden direkt aus dem Zielcommit `05646eb0386730959eae0d68199a697965fb8047` gelesen. Jede Migration lief einzeln in einer Transaktion mit:

- `lock_timeout = '5s'`
- `statement_timeout = '60s'`
- `idle_in_transaction_session_timeout = '60s'`

| Migration | Ergebnis | Laufzeit | Warnings/Locks/Timeouts | Risiko nach Dry-Run |
| --- | --- | ---: | --- | --- |
| `023_normalize_widget_analytics_events.sql` | OK | 292 ms | keine sichtbar | low |
| `024_tenant_user_expiration.sql` | OK | 244 ms | keine sichtbar | low |
| `025_evaluation_workspace_access.sql` | OK | 252 ms | keine sichtbar | low |
| `026_evaluation_product_support_tickets.sql` | OK | 240 ms | keine sichtbar | low |
| `027_evaluation_signed_handoff.sql` | OK | 342 ms | keine sichtbar | low |
| `028_generic_webhook_signing_modes.sql` | OK | 261 ms | keine sichtbar | medium strukturell, in dieser Staging-DB praktisch niedrig |

### Nachher-Zustand

- Migrationen `023` bis `028` angewendet: `6/6`
- Zieltabellen vorhanden: `5/5`
- Zielspalten vorhanden: `23/23`
- Zielindizes vorhanden: `12/12`
- Zielconstraints vorhanden: `6/6`
- `NOT NULL` aus `028` gesetzt:
  - `integration_connections.signing_mode`
  - `webhook_jobs.event_id`
  - `webhook_jobs.payload_body`
  - `webhook_jobs.signing_mode`
  - `webhook_jobs.signing_secret`
  - `webhook_jobs.signing_secret_encrypted`

Row Counts nachher:

| Tabelle | Row Count |
| --- | ---: |
| `widget_events` | 0 |
| `tenant_users` | 1 |
| `sites` | 1 |
| `agent_tickets` | 0 |
| `integration_connections` | 0 |
| `webhook_jobs` | 0 |
| `evaluation_chat_sessions` | 0 |
| `evaluation_ticket_previews` | 0 |
| `evaluation_handoff_events` | 0 |
| `evaluation_handoff_deliveries` | 0 |
| `evaluation_mock_handoff_receipts` | 0 |

### App-Validierung gegen migrierte Staging-DB

Die bereits laufende `knete-staging`-App wurde gegen die migrierte Staging-DB geprueft:

- API `/healthz`: `ok|ok|ok|ffd3fa38b44852f63528f29a9898b645422341d7`
- Dashboard Login: HTTP `200`
- Widget Loader: HTTP `200`
- Widget Bundle: HTTP `200`
- Staging Proxy Health: HTTP `200`
- Public Widget Config: OK
- Public Widget Debug-/Preview-Felder: nicht vorhanden

Einschraenkung:

- Die laufende Staging-App war nicht auf dem Zielcommit `05646eb0386730959eae0d68199a697965fb8047`, sondern auf `ffd3fa38b44852f63528f29a9898b645422341d7`.
- Ein Staging-App-Deploy auf den Zielcommit wurde in diesem Schritt nicht ausgefuehrt, weil der gemeinsam genutzte Server-Repo-Zustand fuer Production nicht unnoetig veraendert werden sollte.
- Lokale Builds und Tests fuer den Zielcommit waren gruen.

### Security Checks

Lokal unter Node `v24.17.0` ausgefuehrt:

- `npm run check:api`: PASS
- `npm run build:api`: PASS
- `npm run security:check-authorization-matrix`: PASS, `253` Routen
- `npm run test:security-boundaries`: PASS, `70` Boundary Checks
- `npm run test:smoke --workspace=apps/api`: PASS, `396/396`
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm run test:e2e`: PASS, `13` Test Files, `51` Tests
- `npm run check:all`: PASS
- `git diff --check`: PASS

### Side Effects

- Production veraendert: nein
- Production letzte Migration nach Dry-Run: weiterhin `022_it_support_ticket_fields.sql`
- Production Health nach Dry-Run: `PASS`
- Production Feature Flags gesetzt: nein
- Production Site-Config veraendert: nein
- Migration auf Production ausgefuehrt: nein
- Staging Tickets erzeugt: nein
- Staging E-Mail-Jobs erzeugt: nein
- Staging Webhook-Jobs erzeugt: nein
- Staging Integrationen erzeugt: nein

### Blocker

Keine Blocker fuer einen kontrollierten Production-Migrationsschritt erkannt.

Offener Hinweis:

- Vor `14I-M3` muss ein echtes Production-Backup erstellt und validiert werden.
- Die App-Validierung gegen exakt den Zielcommit auf Staging ist noch nicht erfolgt; alternativ kann `14I-M3` Migration und anschliessenden App-Deploy mit engmaschigen Healthchecks trennen.

### Freigabeempfehlung fuer 14I-M3

`14I-M3` ist aus Migrationssicht vertretbar, wenn unmittelbar vorher:

- Production Health `PASS` ist.
- Vollstaendiges Production-DB-Backup erstellt wurde.
- Schema-only Backup erstellt oder Schema-Metadaten gesichert wurden.
- `schema_migrations` weiterhin bei `022` endet.
- Row Counts der betroffenen Tabellen erneut plausibel sind.
- Migrationen `023` bis `028` einzeln und transaktional mit Timeout-Schutz ausgefuehrt werden.
- Nach Migration ein Schema-Check ausgefuehrt wird.
- Erst danach der App-Deploy auf `05646eb0386730959eae0d68199a697965fb8047` erfolgt.
- Feature Flags weiterhin false/unset bleiben.

## Target App Validation 14I-M2B

Datum/Zeit: 2026-06-28 23:10Z bis 2026-06-28 23:13Z

### Validierungsstrategie

Strategie: kontrollierter Staging-Deploy des Zielcommits auf den separaten `knete-staging`-Stack.

Um das Production-Repo-Verzeichnis nicht umzuschalten, wurde auf dem Server ein temporaerer Git-Worktree fuer den Zielcommit verwendet:

- Zielcommit: `05646eb0386730959eae0d68199a697965fb8047`
- Temporaerer Worktree: `ssb-m2b-05646eb0386730959eae0d68199a697965fb8047`
- Production-Repo blieb auf `13c5c0af97c83c356c3b2b75557e362916e771d8`
- Production-Container wurden nicht neu gestartet
- Production-DB wurde nicht migriert
- Temporaerer Worktree wurde nach der Validierung entfernt

Der `knete-staging`-Stack wurde aus dem temporaeren Worktree mit `APP_COMMIT_SHA=05646eb0386730959eae0d68199a697965fb8047` neu gebaut und gestartet.

### Umgebung

- Stack: `knete-staging`
- DB: `chatbot_staging`
- Staging-/Test-Nachweis:
  - separater Compose-Projektname
  - DB-Name enthaelt `staging`
  - keine produktionsaehnliche Domain in Staging-Sites
  - bereits migriertes Schema mit `023` bis `028`
- Production betroffen: nein

### Healthchecks

- `knete-staging` Services: `6`, bad/unhealthy: `0`
- API `/healthz`: `ok|ok|ok|05646eb0386730959eae0d68199a697965fb8047`
- Dashboard Login: HTTP `200`
- Dashboard Setup-Seite ohne Session: HTTP `307` zur Auth-Umleitung
- Widget Loader: HTTP `200`
- Widget Bundle: HTTP `200`
- Public Widget Config: OK
- Public Widget Config Debug-/Preview-Felder: nicht vorhanden

### Admin-/Diagnose-Routen

Mit Staging-Admin-Authentifizierung, ohne Ausgabe geheimer Werte:

- AssistantProfile Diagnostics: HTTP `200`
- AssistantProfile Migration Preview: HTTP `200`
- Conversation Engine Preview: HTTP `201`
- Conversation Engine Compare: HTTP `201`
- Conversation Engine Response Preview: HTTP `201`
- Anonymous Zugriff auf Admin-Diagnose: HTTP `401`
- Sanitized Output Scan fuer Secret-Begriffe: keine Treffer mit echten Werten

Damit ist die Schema-Kompatibilitaet der neuen Admin-Testendpoints gegen die migrierte Staging-DB bestaetigt.

### Public Widget Smoke

- Widget Config: erfolgreich, keine Debug-/Preview-Felder
- Widget Session: erfolgreich genug, um eine Staging-Conversation anzulegen
- Widget Chat Message: HTTP `500`

Ursache:

- Staging-LLM/Embedding-Provider-Konfiguration nutzt keinen gueltigen Provider-Key.
- Der Fehler trat beim externen Provider-Aufruf auf, nicht bei Migration, Schema, Routing oder DB-Kompatibilitaet.
- Es wurden keine Schluesselwerte dokumentiert.

Bewertung:

- Public Widget Runtime ist fuer Config/Assets erreichbar.
- Vollstaendige Public-Widget-Chat-Validierung ist blockiert, bis ein gueltiger Staging-Provider-Key gesetzt ist.
- Kein Hinweis auf ein Migrationsschema-Problem.

### Security Checks

Lokal unter Node `v24.17.0` ausgefuehrt:

- `npm run check:api`: PASS
- `npm run build:api`: PASS
- `npm run security:check-authorization-matrix`: PASS
- `npm run test:security-boundaries`: PASS
- `npm run test:smoke --workspace=apps/api`: PASS, `396/396`
- `npm run check:dashboard`: PASS
- `npm run build:dashboard`: PASS
- `npm run test:e2e`: PASS, `13` Test Files, `51` Tests
- `npm run check:all`: PASS
- `git diff --check`: PASS

### Side Effects

- Production veraendert: nein
- Production Health nach M2B: `PASS`
- Production letzte Migration nach M2B: weiterhin `022_it_support_ticket_fields.sql`
- Production Feature Flags gesetzt: nein
- Production Site-Config veraendert: nein
- Production Leads/Jobs/Tickets erzeugt: nein
- Staging technische Test-Conversations: `1`
- Staging Leads: `0`
- Staging E-Mail-Jobs: `0`
- Staging Webhook-Jobs: `0`
- Staging Tickets: `0`

### Blocker

M2B ist nicht vollstaendig freigegeben, weil der Public-Widget-Chat-Smoke auf Staging wegen ungueltiger Staging-Provider-Konfiguration mit HTTP `500` endet.

Kein Blocker gefunden fuer:

- Migration `023` bis `028`
- Ziel-App-Start gegen migrierte DB
- API Health
- Dashboard Login/Setup-Umleitung
- Widget Assets/Config
- Admin-Testendpoints
- Authorization/Security-Gates

### Freigabeempfehlung fuer 14I-M3

Status: bedingt blockiert.

`14I-M3` sollte erst freigegeben werden, wenn eine der folgenden Bedingungen erfuellt ist:

1. Staging erhaelt einen gueltigen nicht-produktiven Provider-Key und der Public-Widget-Chat-Smoke wird erfolgreich wiederholt.
2. Oder der fehlgeschlagene Widget-Chat-Smoke wird explizit als Staging-Secret-/Provider-Konfigurationsproblem akzeptiert, weil alle schema- und app-seitigen Checks gruen sind.

Ohne diese explizite Entscheidung lautet die Empfehlung:

- Production-Migration noch nicht starten.
- Zuerst Staging-Provider-Konfiguration korrigieren oder das Risiko formal akzeptieren.

## Target App Validation 14I-M2B Provider Fix

Datum/Zeit: 2026-06-29 01:16Z

### Ursache des Blockers

Der Public-Widget-Chat-Smoke aus `14I-M2B` scheiterte weiterhin eindeutig an der nicht-produktiven Staging-Provider-Konfiguration.

Sanitized Befund:

- Staging-API-Log meldet Provider-Authentifizierungsfehler `401 Incorrect API key`.
- Der in `knete-staging` konfigurierte Provider-Key ist vorhanden, aber placeholder-/staging-artig und wird vom Provider abgelehnt.
- Modell- und Embedding-Modell-Variablen sind gesetzt.
- Kein vollstaendiger Key, kein Header und kein Secret wurde ausgegeben oder dokumentiert.

### Staging-Provider-Konfiguration

- Nicht-produktiver Key gesetzt: nein, kein gueltiger nicht-produktiver Key war in diesem Schritt verfuegbar.
- Production-Key verwendet: nein.
- Demo-Key verwendet: nein.
- Secret ausgegeben: nein.
- Secret committed: nein.
- `.env.staging` committed: nein.
- Services neu gestartet: nein, weil keine gueltige neue Staging-Konfiguration gesetzt wurde.

### Staging Health

- `knete-staging` API Commit vor Fix-Versuch: `05646eb0386730959eae0d68199a697965fb8047`
- Ziel-App-Commit weiterhin korrekt.
- Kein erneuter Public-Widget-Chat-Smoke mit gueltigem Provider-Key moeglich.

### Production-Unveraendertheit

- Production Health nach Fix-Versuch: `PASS`
- Production letzte Migration: weiterhin `022_it_support_ticket_fields.sql`
- Production Migration ausgefuehrt: nein
- Production Deploy ausgefuehrt: nein
- Production Feature Flags gesetzt: nein
- Produktive Site-Config geaendert: nein

### Ergebnis

Status: blockiert.

Der Fix kann ohne einen gueltigen nicht-produktiven Staging-Provider-Key nicht abgeschlossen werden. Es wurde bewusst kein Production- oder Demo-Key in `knete-staging` uebernommen.

### Freigabeempfehlung fuer 14I-M3

`14I-M3` bleibt blockiert, bis eine der folgenden Entscheidungen getroffen wurde:

1. Ein gueltiger nicht-produktiver Staging-Provider-Key wird in `.env.staging` gesetzt, nur `knete-staging` API wird neu gestartet, und der Public-Widget-Chat-Smoke wird erfolgreich wiederholt.
2. Oder der Provider-Smoke wird explizit als externes Staging-Secret-Problem akzeptiert und die Freigabe erfolgt trotz fehlendem Live-Provider-Smoke.

Empfohlener sauberer Pfad: Option 1.

## Target App Validation 14I-M2C Provider Fix

Datum/Zeit: 2026-06-29 01:21Z

### Ziel

Der blockierte Public-Widget-Chat-Smoke aus `14I-M2B` sollte durch Setzen eines gueltigen nicht-produktiven Provider-Keys fuer `knete-staging` erneut validiert werden.

### Provider-Freigabe

Es wurde kein gueltiger nicht-produktiver Provider-Key im Prompt oder auf dem Server als freigegebene Staging-Konfiguration gefunden.

Sanitized Befund:

- `OPENAI_API_KEY` in `.env.staging` ist gesetzt.
- Der Wert ist placeholder-/staging-artig.
- Der Wert entspricht nicht der erwarteten Provider-Key-Form.
- Der zuletzt sichtbare Staging-Fehler bleibt ein Provider-Authentifizierungsfehler `401 Incorrect API key`.
- `OPENAI_MODEL` und `OPENAI_EMBED_MODEL` sind gesetzt.

### Durchgefuehrte Aenderungen

- Staging-Key gesetzt: nein
- Production-Key verwendet: nein
- Demo-Key verwendet: nein
- Secrets ausgegeben: nein
- Secrets committed: nein
- `.env.staging` committed: nein
- Staging Services neu gestartet: nein
- Code geaendert: nein
- Feature Flags gesetzt: nein

### Staging Health

- `knete-staging` API Commit: weiterhin `05646eb0386730959eae0d68199a697965fb8047`
- Public-Widget-Chat-Smoke wurde nicht wiederholt, weil kein gueltiger nicht-produktiver Provider-Key verfuegbar war.

### Production-Safety

- Production Health: `PASS`
- Production letzte Migration: weiterhin `022_it_support_ticket_fields.sql`
- Production Migration ausgefuehrt: nein
- Production Deploy ausgefuehrt: nein
- Production Feature Flags gesetzt: nein
- Produktive Site-Config geaendert: nein

### Ergebnis

Status: blockiert.

M2C kann ohne einen gueltigen nicht-produktiven Staging-Provider-Key nicht abgeschlossen werden. Der sichere Pfad bleibt, einen separaten Staging-/Test-Key bereitzustellen, ihn ausschliesslich in `.env.staging` zu setzen, nur `knete-staging` API neu zu starten und den Public-Widget-Chat-Smoke erneut auszufuehren.

### Freigabeempfehlung fuer 14I-M3

`14I-M3` bleibt NO-GO, bis:

- ein gueltiger nicht-produktiver Staging-Provider-Key gesetzt ist und
- der Public-Widget-Chat-Smoke auf `knete-staging` HTTP `200` oder `201` liefert und
- keine Debug-/Preview-Felder in der Public-Widget-Response erscheinen.

## Staging Provider Key Requirement

Datum/Zeit: 2026-06-29 01:30Z

### Aktueller Blocker

Der Public-Widget-Chat-Smoke auf `knete-staging` ist weiterhin blockiert, weil die Staging-API beim Provider-Aufruf einen Authentifizierungsfehler meldet.

Sanitized Provider-Fehler:

- Provider-Antwort: `401 Incorrect API key`
- Kein Provider-Key, kein Authorization-Header und kein Secret wurde ausgegeben.
- `OPENAI_API_KEY` ist auf dem Server gesetzt, entspricht aber nicht der erwarteten Provider-Key-Form.
- `OPENAI_MODEL` und `OPENAI_EMBED_MODEL` sind gesetzt.

### Provider und benoetigte Variablen

Der Public-Widget-Chat verwendet die API-Services fuer Retrieval und Antwortgenerierung. Diese nutzen den OpenAI-Client direkt:

- Embeddings: `EmbeddingService`
- Chat Completion: `LlmService`

Benoetigte Staging-Variablen:

| Variable | Zweck | Staging-Anforderung |
| --- | --- | --- |
| `OPENAI_API_KEY` | Provider-Authentifizierung fuer Embeddings und Chat Completion | gueltiger separater Staging-/Test-Key |
| `OPENAI_MODEL` | Chat-/Antwortmodell | z. B. `gpt-4.1-mini` oder freigegebenes Staging-Modell |
| `OPENAI_EMBED_MODEL` | Embedding-Modell fuer Retrieval | z. B. `text-embedding-3-small` oder freigegebenes Staging-Modell |

Secret-Ziel:

- bestehender Staging-Secret-Mechanismus oder
- `.env.staging` im Staging-Serverkontext

Keine dieser Variablen darf im Repository, in Logs oder in Reports mit Wert gespeichert werden.

### Anforderungen an den nicht-produktiven Key

Ein gueltiger Staging-/Test-Key muss:

- nicht in Production verwendet werden
- nicht aus der NOLIS-Demo-Umgebung uebernommen werden, ausser dies wird separat ausdruecklich freigegeben
- fuer den erwarteten Provider gueltig sein
- fuer die benoetigten Modelle freigegeben sein
- providerseitig auf niedrige Kosten-/Rate-Limits begrenzt sein
- nur fuer Staging-/Smoke-Tests vorgesehen sein
- im Secret-Store oder in `.env.staging` liegen, nicht im Repo
- nicht in Logs, Reports oder Terminalausgaben erscheinen
- bei Bedarf ohne Codeaenderung rotierbar sein

Der Production-Key darf fuer `knete-staging` nicht verwendet werden.

### Betroffene Services

| Service | Betroffen | Neustart nach Key-Aenderung |
| --- | --- | --- |
| `knete-staging` API | ja, liest `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_EMBED_MODEL` | ja |
| `knete-staging` Dashboard | nein, nutzt diese Provider-Variablen nicht direkt | nein |
| `knete-staging` Widget | nein, ruft nur die API auf | nein |
| `knete-staging` Reporter | aktuell nicht fuer Public-Widget-Chat relevant | nein |

Nach dem Setzen eines gueltigen Keys soll nur die Staging-API neu gestartet werden. Dashboard, Widget, Production und `soule-demo` bleiben unveraendert.

### Mock-Option

Mock-Option vorhanden: nein.

Im aktuellen Code wurde kein bestehender Mock-/Testprovider gefunden, der den Public-Widget-Chat-Pfad inklusive Embedding- und Chat-Provider realistisch ersetzt. Der Evaluation-Mock-Handoff ist davon getrennt und prueft nur den internen Demo-Handoff, nicht den Widget-Chat-Providerpfad.

Ein neu gebauter Mock ist in diesem Schritt nicht vorgesehen.

### Freigabevoraussetzung fuer 14I-M2C

`14I-M2C` darf erst fortgesetzt werden, wenn:

- ein gueltiger nicht-produktiver Staging-Key in `.env.staging` oder im bestehenden Secret-Mechanismus gesetzt wurde
- die Staging-API neu gestartet wurde
- der Public-Widget-Chat-Smoke erfolgreich wiederholt wurde
- keine Leads, E-Mail-Jobs, Webhook-Jobs oder Tickets unerwartet entstehen
- keine Debug-/Preview-/Compare-Felder in der Public-Widget-Response erscheinen

### Freigabevoraussetzung fuer 14I-M3

`14I-M3` bleibt NO-GO, bis `14I-M2C` mit gueltigem nicht-produktivem Provider-Key bestanden ist oder das fehlende Live-Provider-Smoke-Ergebnis explizit als akzeptiertes Restrisiko freigegeben wird.

Empfehlung: kein Production-Migrationslauf und kein Production-Deploy, bevor `14I-M2C` erfolgreich wiederholt wurde.

## Target App Validation 14I-M2C Retry

Datum/Zeit: 2026-06-29 01:45Z

### Ergebnis

Status: blockiert.

Der Retry wurde vor einem Neustart oder Smoke-Test abgebrochen, weil die Staging-Provider-Konfiguration weiterhin nicht als gueltiger nicht-produktiver Provider-Key verifiziert werden konnte.

### Provider-Fix

- Gueltiger nicht-produktiver Provider-Key verfuegbar: nein
- `OPENAI_API_KEY` gesetzt: ja
- `OPENAI_API_KEY` wirkt provider-konform: nein
- `OPENAI_MODEL` gesetzt: ja
- `OPENAI_EMBED_MODEL` gesetzt: ja
- Production-Key verwendet: nein
- Demo-Key verwendet: nein
- Secrets ausgegeben: nein
- Secrets committed: nein
- `.env.staging` committed: nein

### Durchgefuehrte Aktionen

- `knete-staging` API neu gestartet: nein
- Dashboard neu gestartet: nein
- Widget neu gestartet: nein
- Production veraendert: nein
- Production-Migration ausgefuehrt: nein
- Feature Flags gesetzt: nein
- AssistantProfile-Migration ausgefuehrt: nein
- Conversation Engine im Public Widget aktiviert: nein

### Nicht ausgefuehrte Pruefungen

Folgende Pruefungen wurden bewusst nicht ausgefuehrt, weil die Key-Vorbedingung nicht erfuellt war:

- Public Widget Loader Smoke
- Public Widget Config Smoke
- Public Widget Chat Smoke
- Staging Side-Effect-Vorher/Nachher-Vergleich nach Chat-Smoke
- Admin-/Security-Schnellpruefung gegen neu gestartete Staging-API

### Production-Safety

- Production bleibt unveraendert.
- Production letzte Migration bleibt `022_it_support_ticket_fields.sql`.
- Kein Production-Deploy wurde ausgefuehrt.
- Keine Production-Secrets wurden verwendet.

### Freigabeempfehlung fuer 14I-M3

`14I-M3` bleibt NO-GO.

Der naechste sichere Schritt ist:

1. einen gueltigen separaten Staging-/Test-Provider-Key in `.env.staging` oder im bestehenden Secret-Mechanismus setzen,
2. nur `knete-staging` API neu starten,
3. Public Widget Chat Smoke wiederholen,
4. Side Effects und Public-Response-Felder pruefen.

## Target App Validation 14I-M2C Retry After Key Provisioning

Datum/Zeit: 2026-06-29 01:55Z bis 2026-06-29 02:16Z

### Ergebnis

Status: erfolgreich.

Der Public-Widget-Chat-Smoke auf `knete-staging` wurde nach Bereitstellung eines gueltig wirkenden nicht-produktiven Provider-Keys erfolgreich wiederholt.

### Provider-Fix

- Gueltiger nicht-produktiver Provider-Key verfuegbar: ja
- `OPENAI_API_KEY` gesetzt: ja
- `OPENAI_API_KEY` wirkt provider-konform: ja
- `OPENAI_MODEL` gesetzt: ja
- `OPENAI_EMBED_MODEL` gesetzt: ja
- Production-Key verwendet: nein
- Secrets ausgegeben: nein
- Secrets committed: nein
- `.env.staging` committed: nein

### Staging-Neustart

- `knete-staging` API neu gestartet: ja
- Dashboard neu gestartet: nein
- Widget neu gestartet: nein
- DB/Redis neu gestartet: nein
- Non-secret `APP_COMMIT_SHA` in `.env.staging` auf den Zielcommit korrigiert: ja
- API `/healthz` nach Neustart:
  - `status=ok`
  - `database=ok`
  - `redis=ok`
  - `commit=05646eb0386730959eae0d68199a697965fb8047`
- Container Health:
  - API healthy
  - Dashboard healthy
  - Widget healthy
  - Proxy healthy
  - DB healthy
  - Redis healthy

### Public Widget Smoke

| Pruefung | Ergebnis |
| --- | --- |
| Widget Loader | HTTP `200` |
| Widget Bundle | HTTP `200` |
| Public Widget Config | HTTP `200` |
| Public Widget Chat Message | HTTP `201` |
| Legacy-Chatpipeline antwortet | ja |
| `401 Incorrect API key` | nein |
| HTTP `500` | nein |
| Debug-/Preview-Felder in Public Response | nein |

Gepruefte nicht oeffentliche Felder in Public Responses:

- `assistantProfileDebug`: nicht vorhanden
- `conversationEnginePreview`: nicht vorhanden
- `compare`: nicht vorhanden
- `engineResponsePreview`: nicht vorhanden
- `responseQuality`: nicht vorhanden
- Admin-Testdaten: nicht vorhanden

### Staging Side Effects

Vorher/Nachher:

| Tabelle | Vorher | Nachher | Bewertung |
| --- | ---: | ---: | --- |
| `conversations` | 1 | 2 | akzeptierte technische Staging-Smoke-Conversation |
| `widget_leads` | 0 | 0 | OK |
| `email_jobs` | 0 | 0 | OK |
| `webhook_jobs` | 0 | 0 | OK |
| `agent_tickets` | 0 | 0 | OK |

Es wurden keine Staging-Leads, E-Mail-Jobs, Webhook-Jobs oder Tickets erzeugt.

### Admin-/Security-Schnellpruefung

| Pruefung | Ergebnis |
| --- | --- |
| AssistantProfile Diagnostics | HTTP `200` |
| Migration Preview | HTTP `200` |
| Conversation Engine Preview | HTTP `201` |
| Compare | HTTP `201` |
| Response Preview | HTTP `201` |
| Anonymous Admin-Zugriff | HTTP `401` |
| Customer Admin-Zugriff | HTTP `403` |
| Secret-Scan der Admin-Responses | keine Treffer |

Lokale Checks:

- `npm run security:check-authorization-matrix`: PASS, `253` Matrix-Eintraege fuer `253` Source-Routen
- `npm run test:security-boundaries`: PASS, `70` Boundary-Checks
- `npm run test:smoke --workspace=apps/api`: PASS, `396/396` Tests

### Production-Safety

- Production veraendert: nein
- Production Migration ausgefuehrt: nein
- Production letzte Migration: weiterhin `022_it_support_ticket_fields.sql`
- Production Deploy ausgefuehrt: nein
- Production Feature Flags gesetzt: nein
- Production Health: PASS
- Production-Secrets verwendet: nein
- Production-Counts nach Pruefung:
  - `conversations=16`
  - `widget_leads=7`
  - `email_jobs=6`
  - `webhook_jobs=0`
  - `agent_tickets=0`

### Freigabeempfehlung fuer 14I-M3

`14I-M3` kann vorbereitet werden.

Voraussetzungen fuer die tatsaechliche Production-Migration und den anschliessenden Production-Deploy bleiben:

- frisches Production-Backup unmittelbar vor Migration
- separater expliziter Migrationsschritt fuer `023` bis `028`
- Production Health vor Migration `PASS`
- Feature Flags weiterhin false/unset
- Public Widget bleibt Legacy-Pipeline
- nach Migration erneuter Schema- und Healthcheck
- danach erst App-Deploy auf `05646eb0386730959eae0d68199a697965fb8047`

## Production Migration and Deploy 14I-M3

Datum/Zeit: 2026-06-29 01:23Z bis 2026-06-29 02:25Z

### Ergebnis

Status: erfolgreich.

Production wurde kontrolliert von Migration `022_it_support_ticket_fields.sql` auf `028_generic_webhook_signing_modes.sql` gebracht. Danach wurden API, Dashboard und Widget auf den Ziel-App-Commit `05646eb0386730959eae0d68199a697965fb8047` deployed.

Es wurden keine Conversation-Engine-Feature-Flags aktiviert, keine AssistantProfile-Migration auf produktiven Sites ausgefuehrt und keine produktive Site-Konfiguration manuell geaendert.

### Production Preflight

| Pruefung | Ergebnis |
| --- | --- |
| Production App-Commit vorher | `8935c106dd3e5246a353bd48743b2675b26a1a61` |
| Production Repo-Commit vorher | `13c5c0af97c83c356c3b2b75557e362916e771d8` |
| DB-Migrationsstand vorher | `022_it_support_ticket_fields.sql` |
| Production Health vor Migration | PASS mit Warnung zu alten Log-Matches; keine aktuellen kritischen Logzeilen im Tail sichtbar |
| API intern | HTTP `200`, DB `ok`, Redis `ok` |
| Container Health | API, Dashboard, Widget, Proxy, DB, Redis healthy |
| Aktive DB-Locks/Transaktionen | `0` relevante aktive non-idle Sessions |
| Target-Migrationen vorher teilweise angewendet | nein |
| Target-Tabellen/-Spalten vorher vorhanden | nein |
| Conversation-Engine-Flags vorher aktiv | nein |
| AssistantProfile-/Conversation-Engine-Testmodule vorher vorhanden | nein |

Row Counts vor Migration:

| Tabelle | Count |
| --- | ---: |
| `widget_events` | 228 |
| `tenant_users` | 0 |
| `agent_tickets` | 0 |
| `integration_connections` | 0 |
| `webhook_jobs` | 0 |
| `widget_leads` | 7 |
| `email_jobs` | 6 |
| `conversations` | 16 |

Migration ohne Wartungsmodus war vertretbar wegen geringer Row Counts, leerer `tenant_users`/`agent_tickets`/`integration_connections`/`webhook_jobs` und erfolgreichem Staging-Dry-Run.

### Backup und Rollback

Frisches Backup unmittelbar vor Migration:

- Full DB Backup: `backup_postgres_m3_20260629_0123.sql.gz`
- Full DB Backup Size: `211589` bytes
- Schema-only Backup: `backup_schema_m3_20260629_012335.sql.gz`
- Schema-only Backup Size: `4123` bytes
- Dateirechte: `600`

Rollback-Plan:

- App-Rollback: Production-Repo auf vorherigen Commit `13c5c0af97c83c356c3b2b75557e362916e771d8` zuruecksetzen, `APP_COMMIT_SHA` auf vorherigen App-Commit setzen, API/Dashboard/Widget neu bauen und starten.
- DB-Rollback: bei schwerem Migrationsfehler Restore aus dem frischen Full DB Backup. Automatisches SQL-Downgrade ist nicht vorgesehen.
- Rollback noetig: nein.

### Migrationsergebnis

Die Migrationen wurden einzeln in Transaktionen mit `lock_timeout=5s`, `statement_timeout=60s` und `idle_in_transaction_session_timeout=60s` ausgefuehrt. Die SQL-Dateien auf dem Server wurden per SHA256 gegen den Zielstand geprueft.

| Migration | Ergebnis | Laufzeit | Hinweise |
| --- | --- | ---: | --- |
| `023_normalize_widget_analytics_events.sql` | OK | 86 ms | keine Warnings |
| `024_tenant_user_expiration.sql` | OK | 88 ms | keine Warnings |
| `025_evaluation_workspace_access.sql` | OK | 104 ms | keine Warnings |
| `026_evaluation_product_support_tickets.sql` | OK | 110 ms | keine Warnings |
| `027_evaluation_signed_handoff.sql` | OK | 94 ms | keine Warnings |
| `028_generic_webhook_signing_modes.sql` | OK | 94 ms | erwartete `DROP CONSTRAINT IF EXISTS` Notices fuer noch nicht vorhandene Constraints |

### Schema-Pruefung nach Migration

| Pruefung | Ergebnis |
| --- | --- |
| `schema_migrations` enthaelt `023` bis `028` | ja, `6/6` |
| Zieltabellen vorhanden | ja, `5/5` |
| Zielspalten vorhanden | ja, `23/23` |
| Zielindizes vorhanden | ja, `12/12` |
| Zielconstraints vorhanden | ja, `6/6` |
| NOT NULL aus `028` vorhanden | ja |
| Unique aus `028` vorhanden | ja |
| Unerwartete Datenverluste | nein |

Row Counts nach Migration:

| Tabelle | Count |
| --- | ---: |
| `widget_events` | 228 |
| `tenant_users` | 0 |
| `agent_tickets` | 0 |
| `integration_connections` | 0 |
| `webhook_jobs` | 0 |
| `widget_leads` | 7 |
| `email_jobs` | 6 |
| `conversations` | 16 |

### Deploy

| Pruefung | Ergebnis |
| --- | --- |
| Ziel-App-Commit | `05646eb0386730959eae0d68199a697965fb8047` |
| Production Repo-Commit nach Deploy | `05646eb0386730959eae0d68199a697965fb8047` |
| `APP_COMMIT_SHA` gesetzt | ja, nicht geheimer Wert |
| Gebaute/gestartete Services | API, Dashboard, Widget |
| Proxy neu gebaut | nein |
| DB/Redis neu gestartet | nein |
| API healthy | ja |
| Dashboard healthy | ja |
| Widget healthy | ja |
| Proxy healthy | ja |
| DB healthy | ja |
| Redis healthy | ja |
| API `/healthz` Commit nach Deploy | `05646eb0386730959eae0d68199a697965fb8047` |

### Public Widget Smoke

| Pruefung | Ergebnis |
| --- | --- |
| Dashboard Login | HTTP `200` |
| Widget Loader | HTTP `200` |
| Widget Bundle | HTTP `200` |
| Public Widget Config | HTTP `200` |
| Public Widget Session | HTTP `201` |
| Public Widget Chat Message | HTTP `201` |
| Legacy-Chatpipeline antwortet | ja |
| Debug-/Preview-Felder in Public Response | nein |
| Secret-Scan Public Responses | keine Treffer |

Nicht vorhanden in Public Responses:

- `assistantProfileDebug`
- `conversationEnginePreview`
- `compare`
- `engineResponsePreview`
- `responseQuality`
- Admin-Testdaten

### Feature-Flags und Config

| Pruefung | Ergebnis |
| --- | --- |
| `conversationEngine.previewEnabled=true` auf Production-Sites | nein |
| `conversationEngine.compareEnabled=true` auf Production-Sites | nein |
| `conversationEngine.responsePreviewEnabled=true` auf Production-Sites | nein |
| `conversationEngine.adminTestOnly=true` auf Production-Sites | nein |
| `assistant-profile` Module automatisch angelegt | nein |
| `conversation-engine-tests` Module automatisch angelegt | nein |
| Legacy-Felder manuell geaendert | nein |
| Public Widget Conversation Engine aktiviert | nein |

### Admin-/Security-Pruefung

| Pruefung | Ergebnis |
| --- | --- |
| AssistantProfile Diagnostics | HTTP `200` |
| Migration Preview | HTTP `200` |
| Conversation Engine Preview | HTTP `201` |
| Compare | HTTP `201` |
| Response Preview | HTTP `201` |
| Anonymous Admin-Zugriff | HTTP `401` |
| Customer Admin-Zugriff | HTTP `403` |
| Secret-Scan Admin-Responses | keine Treffer |
| `npm run security:check-authorization-matrix` | PASS, `253` Matrix-Eintraege fuer `253` Source-Routen |
| `npm run test:security-boundaries` | PASS, `70` Boundary-Checks |

### Side Effects und Monitoring

Nach dem expliziten Public-Widget-Smoke:

| Tabelle | Vor Deploy/Smoke | Nach Deploy/Smoke | Bewertung |
| --- | ---: | ---: | --- |
| `conversations` | 16 | 17 | akzeptierte technische Smoke-Conversation |
| `widget_leads` | 7 | 7 | keine unerwarteten Leads |
| `email_jobs` | 6 | 6 | keine unerwarteten E-Mail-Jobs |
| `webhook_jobs` | 0 | 0 | keine unerwarteten Webhook-Jobs |
| `agent_tickets` | 0 | 0 | keine unerwarteten Tickets |

Production Health nach Deploy:

- API/DB/Redis OK
- Dashboard Login OK
- Widget Loader/Config OK
- Backup Freshness OK
- Offsite Backup Freshness OK
- Job Health OK
- Container Health OK
- Repo Commit OK
- Health-Script meldet weiterhin eine Warnung zu `3` Log-Matches im 30-Minuten-Fenster; der anschliessende sanitized Log-Tail zeigte keine aktuellen kritischen Zeilen.

Rollback erforderlich: nein.

### Demo/Staging

| Stack | Ergebnis |
| --- | --- |
| `knete-staging` | API, Dashboard, Widget, Proxy, DB, Redis healthy |
| `soule-demo` | API, Dashboard, Widget, Proxy, DB, Redis healthy |

Staging-/Demo-Flags wurden nicht veraendert. Der Staging-Provider-Key bleibt nur in Staging.

### Postmonitoring 14I-M4

Nach Abschluss von `14I-M3` wurde ein weiteres read-only/Smoke-Nachmonitoring durchgefuehrt.

| Pruefung | Ergebnis |
| --- | --- |
| API `/healthz` | HTTP `200`, Commit `05646eb0386730959eae0d68199a697965fb8047` |
| Widget Loader | HTTP `200` |
| Public Widget Config | HTTP `200` |
| Public Widget Session | HTTP `201` |
| Public Widget Chat Message | HTTP `201` |
| Debug-/Preview-Felder in Public Response | nein |
| Job Health | OK |
| Backup Freshness | OK |
| Offsite Backup Freshness | OK |
| Aktueller sanitized Log-Tail | keine kritischen Treffer |

Side Effects nach dem zusaetzlichen M4-Smoke:

| Tabelle | Count nach M4-Smoke | Bewertung |
| --- | ---: | --- |
| `conversations` | 18 | eine weitere akzeptierte technische Smoke-Conversation |
| `widget_leads` | 7 | keine neuen Leads |
| `email_jobs` | 6 | keine neuen E-Mail-Jobs |
| `webhook_jobs` | 0 | keine neuen Webhook-Jobs |
| `agent_tickets` | 0 | keine neuen Tickets |

Der Healthcheck meldete weiterhin die bekannten historischen Log-Matches im 30-Minuten-Fenster. Der unmittelbar danach gepruefte sanitized Log-Tail zeigte keine aktuellen kritischen Zeilen.

### Finale Empfehlung

Deployment akzeptiert.

Naechste Schritte:

- kurzes Nachmonitoring fortsetzen
- keine Conversation-Engine-Feature-Flags auf Production setzen
- keine AssistantProfile-Migration auf produktiven Sites ausfuehren
- neue Admin-Testfunktionen nur fuer Admin/Operator und nur bewusst nutzen
