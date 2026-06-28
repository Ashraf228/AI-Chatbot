# NOLIS Demo Provisioning

Diese Anleitung beschreibt die technische Bereitstellung eines isolierten Kooperationsdemonstrators. Sie dokumentiert keine Zugangsdaten, keine produktiven Kundendaten und keine echten NOLIS-Unterlagen.

## Zweck

Das Provisioning erzeugt einen generischen Evaluation-Tenant, eine Demo-Site, einen zeitlich begrenzten Viewer-Zugang und synthetische Wissensinhalte fuer eine kommunale KI-Assistenz-Demo. Der Demonstrator ist kein Produktivsystem und keine produktive Fachverfahrensintegration.

## Demo-Profil

- Profil-Key: `public-sector-product-support-demo`
- Inhalte: 84 synthetische deutschsprachige Artikel fuer kommunale Anwendungsfaelle
- Site-Markierung: `is_evaluation_demo=true`
- Retrieval-Scope: `tenant_id`, `site_id`, `demo=true`, `synthetic=true`, aktive/ready Quellen und durchsuchbare Chunks
- Szenarien: 12 gefuehrte Szenarien fuer Buergerservice, Online-Antraege, Serviceportal, CMS/CityApp, Rathausintern, Sportstaetten, Support, sichere Nicht-Antwort, Prompt-Injection-Abwehr und Mock-Handoff
- Supportprofil: `municipal-service` in der sichtbaren Demo-Konfiguration; intern bleiben Demo-Supportfaelle bestaetigungspflichtig
- Externe Weiterleitung: deaktiviert (`allowExternalForwarding=false`)
- Signierte Demo-Uebergabe: optionaler interner Mock, default-off, keine NOLIS- oder externe Ticketuebermittlung

## Erforderliche Umgebungsvariablen

Die Werte muessen ueber die lokale Shell oder eine sichere Betriebsumgebung gesetzt werden. Keine Werte in Git committen.

| Variable | Zweck |
| --- | --- |
| `DEMO_PARTNER_DISPLAY_NAME` | Anzeigename des Kooperationspartners |
| `DEMO_WORKSPACE_TITLE` | Titel im Evaluation Workspace |
| `DEMO_TENANT_SLUG` | Technischer Tenant-Slug |
| `DEMO_TENANT_DISPLAY_NAME` | Anzeigename des Tenants |
| `DEMO_SITE_SLUG` | Technischer Site-Slug |
| `DEMO_SITE_DISPLAY_NAME` | Anzeigename der Demo-Site |
| `DEMO_VIEWER_EMAIL` | E-Mail des zeitlich begrenzten Viewer-Zugangs |
| `DEMO_VIEWER_DISPLAY_NAME` | Anzeigename des Viewers |
| `DEMO_VIEWER_PASSWORD` | Initialpasswort, nur fuer Provisioning-Execute erforderlich |
| `DEMO_VIEWER_EXPIRES_AT` | ISO-Zeitpunkt, standardmaessig maximal 30 Tage in der Zukunft |
| `DEMO_ALLOWED_ORIGIN` | Erlaubter Demo-Origin ohne Pfad, Query oder Fragment |
| `DEMO_PRIVACY_URL` | Datenschutz-URL ohne Credentials |
| `DEMO_SUPPORT_CONTACT_LABEL` | Optionales Label fuer Demo-Support |

Optionale Variablen fuer die interne signierte Mock-Uebergabe:

| Variable | Zweck |
| --- | --- |
| `EVALUATION_MOCK_HANDOFF_ENABLED` | Nur bei `true` aktiv |
| `EVALUATION_MOCK_RECEIVER_ORIGIN` | API-Origin ohne Pfad, Query, Fragment oder Credentials |
| `EVALUATION_MOCK_HANDOFF_SECRET_B64` | Base64-Secret mit mindestens 32 Bytes |
| `EVALUATION_MOCK_SIGNATURE_TOLERANCE_SECONDS` | Replay-Fenster, akzeptiert 30 bis 600 Sekunden |
| `EVALUATION_MOCK_HANDOFF_TIMEOUT_MS` | Timeout fuer den internen Mock-Call |

## Dry-run

```bash
npm run demo:provision:evaluation
```

Dry-run ist der Standard. Der Befehl zeigt nur einen sicheren Plan mit maskierter Viewer-E-Mail, Artikelanzahl und Ziel-Slugs. Es werden keine Daten geschrieben und keine Secrets ausgegeben.

## Execute

```bash
npm run demo:provision:evaluation -- --execute
```

Execute schreibt Tenant, Site, Viewer-Zuordnung und markierte Wissensquellen. Die Demo-Artikel werden ueber den bestehenden Ingest-/Embedding-Pfad verarbeitet. Wenn die Embedding-Konfiguration nicht verfuegbar ist, muss der Lauf fehlschlagen statt eine scheinbar fertige, aber nicht durchsuchbare Wissensbasis anzulegen.

Idempotenz:

- bestehender Tenant wird aktualisiert, nicht dupliziert
- bestehende Demo-Site wird aktualisiert, nicht dupliziert
- bestehender Viewer wird beibehalten und zeitlich neu begrenzt
- Passwortrotation erfolgt nur mit `--rotate-viewer-password`
- synthetische Quellen werden stabil anhand ihrer Demo-Seed-Keys aktualisiert

## Verify

```bash
npm run demo:verify:evaluation
```

Der Verify-Befehl prueft ohne Secret-Ausgabe:

- Tenant vorhanden
- Site als Evaluation-Demo markiert
- aktiver Viewer ist der Demo-Site zugeordnet
- synthetische Quellen, Dokumente und Chunks sind vorhanden
- Chunks sind durchsuchbar, also mit Embedding gespeichert
- Szenarioanzahl ist erwartbar (10 bis 12, derzeit 12)
- optionaler Mock-Handoff ist entweder deaktiviert oder formal konfiguriert; Secrets werden nicht ausgegeben

## Reset

```bash
npm run demo:reset:evaluation
npm run demo:reset:evaluation -- --execute --confirm=<DEMO_SITE_SLUG>
```

Reset ist standardmaessig ein Dry-run. Execute benoetigt eine explizite Site-Bestaetigung. Reset entfernt nur Evaluation-Chat-Sessions, zugehoerige Evaluation-Conversations/Messages, Demo-Ticketvorschauen, interne Mock-Handoff-Events/Deliveries/Receipts und bestaetigte synthetische Demo-Product-Supportfaelle fuer die bestaetigte Demo-Site. Normale Tickets, Tenant, Site, Viewer, Knowledge Sources, Dokumente und Chunks bleiben erhalten.

## Sicherheitsgrenzen

- Keine echten NOLIS-Inhalte verwenden.
- Keine Zugangsdaten oder `.env`-Dateien committen.
- Keine Viewer-Passwoerter ausgeben.
- Keine produktiven Tenants oder Sites als Reset-Ziel verwenden.
- Keine externe Uebermittlung aus dem Evaluation Workspace.
- Keine E-Mail-, Webhook- oder externe Ticketuebermittlung fuer Demo-Supportfaelle.
- Die signierte Demo-Uebergabe nutzt nur den internen Mock-Empfaenger und ist keine produktive Fachverfahrensintegration.
- Keine Verwaltungsentscheidung oder Rechtsauskunft durch den Demonstrator behaupten.
