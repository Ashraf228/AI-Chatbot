# NOLIS Demo Provisioning

Diese Anleitung beschreibt die technische Bereitstellung eines isolierten Kooperationsdemonstrators. Sie dokumentiert keine Zugangsdaten, keine produktiven Kundendaten und keine echten NOLIS-Unterlagen.

## Zweck

Das Provisioning erzeugt einen generischen Evaluation-Tenant, eine Demo-Site, einen zeitlich begrenzten Viewer-Zugang und synthetische Wissensinhalte fuer einen Produkt-Support-Demonstrator. Der Demonstrator ist kein Produktivsystem und keine produktive Fachverfahrensintegration.

## Demo-Profil

- Profil-Key: `public-sector-product-support-demo`
- Inhalte: synthetische deutschsprachige Produkt-Support-Artikel
- Site-Markierung: `is_evaluation_demo=true`
- Retrieval-Scope: `tenant_id`, `site_id`, `demo=true`, `synthetic=true`, aktive/ready Quellen und durchsuchbare Chunks
- Szenarien: quellenbasierte Hilfe, strukturierte Uebergabevorschau, sichere Nicht-Antwort

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
- Szenarioanzahl ist erwartbar

## Reset

```bash
npm run demo:reset:evaluation
npm run demo:reset:evaluation -- --execute --confirm=<DEMO_SITE_SLUG>
```

Reset ist standardmaessig ein Dry-run. Execute benoetigt eine explizite Site-Bestaetigung. Reset entfernt nur Evaluation-Chat-Sessions und zugehoerige Evaluation-Conversations/Messages fuer die bestaetigte Demo-Site. Tenant, Site, Viewer, Knowledge Sources, Dokumente und Chunks bleiben erhalten.

## Sicherheitsgrenzen

- Keine echten NOLIS-Inhalte verwenden.
- Keine Zugangsdaten oder `.env`-Dateien committen.
- Keine Viewer-Passwoerter ausgeben.
- Keine produktiven Tenants oder Sites als Reset-Ziel verwenden.
- Keine externe Uebermittlung aus dem Evaluation Workspace.
- Keine Verwaltungsentscheidung oder Rechtsauskunft durch den Demonstrator behaupten.
