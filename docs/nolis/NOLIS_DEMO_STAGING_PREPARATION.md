# NOLIS Demo Staging Preparation

Stand: 2026-06-24

Ziel dieses Dokuments ist die Vorbereitung einer isolierten Demo-/Staging-Umgebung fuer den NOLIS-Kooperationsdemonstrator. Es enthaelt keine Zugangsdaten, keine Secret-Werte, keine echten NOLIS-Unterlagen und keine Kundendaten.

## Zielzustand

- Eigene Demo-/Staging-URL, getrennt von Produktion.
- Eigene Datenbank fuer Staging/Demo, keine Produktivdatenbank.
- Deployment von Commit `f4ff22c438576c45b11142cf913384c99e2f02fc`.
- Alle Staging-Services stammen vom selben Commit.
- Image-Tags und Image-Digests sind dokumentiert.
- Secrets werden ausschliesslich im Secret-Store der Hostingplattform gesetzt.
- Zunaechst existiert nur ein internes Test-Viewer-Konto.
- `NOLIS_DEMO_STAGING_EXECUTE=1` wird erst unmittelbar vor dem kontrollierten Prueflauf gesetzt.

## Harte Trennung

Vor der Bereitstellung pruefen:

- Staging nutzt eine eigene Datenbank.
- Staging nutzt eigene Domains oder Subdomains.
- Staging nutzt eigene Redis-/Cache-Ressourcen.
- Staging nutzt eigene Session-, Verschluesselungs- und Integration-Secrets.
- Staging enthaelt keine Produktivkundendaten.
- Staging enthaelt keine echte NOLIS-Dokumentation.
- Staging verwendet nur synthetische Demo-Inhalte aus dem Repository.
- Externe NOLIS-Konten werden erst nach technischem GO angelegt.

## Deployment-Commit

Zu deployender Commit:

```text
f4ff22c438576c45b11142cf913384c99e2f02fc
```

Vor dem Deployment:

```sh
git fetch origin
git rev-parse origin/main
git checkout f4ff22c438576c45b11142cf913384c99e2f02fc
git status --short
```

Erwartung:

- Working Tree sauber.
- Commit entspricht exakt dem dokumentierten SHA.
- Keine lokalen uncommitted Aenderungen.

## Image-Nachweis

Fuer jeden Service dokumentieren:

| Service | Commit-SHA | Image-Tag | Image-Digest | Buildzeitpunkt | Node-Version | Deploymentzeitpunkt |
| --- | --- | --- | --- | --- | --- | --- |
| api | ausstehend | ausstehend | ausstehend | ausstehend | `24.17.0` | ausstehend |
| dashboard | ausstehend | ausstehend | ausstehend | ausstehend | `24.17.0` | ausstehend |
| widget | ausstehend | ausstehend | ausstehend | ausstehend | `24.17.0` | ausstehend |
| reporter | ausstehend | ausstehend | ausstehend | ausstehend | `24.17.0` | ausstehend |
| proxy | ausstehend | ausstehend | ausstehend | ausstehend | nicht zutreffend | ausstehend |

Beispielhafte Digest-Pruefung, abhaengig von Registry/Runtime:

```sh
docker image inspect <image-ref> --format '{{index .RepoDigests 0}}'
docker image inspect <image-ref> --format '{{json .Config.Labels}}'
```

Wenn eine Container-Registry verwendet wird, muessen die finalen `RepoDigests` aus der Registry oder aus dem deployten Host dokumentiert werden. Ein reines `latest`-Tag reicht nicht als Nachweis.

## Secret-Store-Werte

Alle folgenden Werte werden im Secret-Store der Hostingplattform gesetzt. In Reports nur `gesetzt` oder `nicht gesetzt` dokumentieren, niemals Werte ausgeben.

### Demo-Konfiguration

| Variable | Status | Hinweis |
| --- | --- | --- |
| `DEMO_PUBLIC_URL` | ausstehend | Oeffentliche Demo-URL ohne Zugangsdaten |
| `DEMO_PARTNER_DISPLAY_NAME` | ausstehend | Anzeigename des Partners |
| `DEMO_WORKSPACE_TITLE` | ausstehend | Titel im Evaluation Workspace |
| `DEMO_TENANT_SLUG` | ausstehend | Eigener Demo-Tenant |
| `DEMO_TENANT_DISPLAY_NAME` | ausstehend | Anzeigename des Demo-Tenants |
| `DEMO_SITE_SLUG` | ausstehend | Eigene Demo-Site |
| `DEMO_SITE_DISPLAY_NAME` | ausstehend | Anzeigename der Demo-Site |
| `DEMO_ALLOWED_ORIGIN` | ausstehend | Origin ohne Pfad, Query, Fragment oder Credentials |
| `DEMO_PRIVACY_URL` | ausstehend | Datenschutz-URL ohne Credentials |
| `DEMO_VIEWER_EMAIL` | ausstehend | Nur internes Test-Viewer-Konto; in Reports maskieren |
| `DEMO_VIEWER_DISPLAY_NAME` | ausstehend | Anzeigename des internen Test-Viewers |
| `DEMO_VIEWER_PASSWORD` | ausstehend | Nie ausgeben, nie committen |
| `DEMO_VIEWER_EXPIRES_AT` | ausstehend | Zukuenftiger ISO-Zeitpunkt |

### Mock-Handoff

| Variable | Status | Hinweis |
| --- | --- | --- |
| `EVALUATION_MOCK_HANDOFF_ENABLED` | ausstehend | Fuer Staging-Demo auf `true`, erst nach Secret-Konfiguration |
| `EVALUATION_MOCK_RECEIVER_ORIGIN` | ausstehend | Origin ohne Pfad, Query, Fragment oder Credentials |
| `EVALUATION_MOCK_HANDOFF_SECRET_B64` | ausstehend | Base64-Secret mit mindestens 32 Bytes, nie ausgeben |

### Infrastruktur und Runtime

| Bereich | Status | Hinweis |
| --- | --- | --- |
| `DATABASE_URL` oder DB-Parameter | ausstehend | Eigene Staging-Datenbank, keine Produktions-DB |
| Embedding-Provider und API-Key | ausstehend | Secret-Store, keine Ausgabe |
| Modellprovider und API-Key | ausstehend | Secret-Store, keine Ausgabe |
| `DASHBOARD_INTERNAL_TOKEN` | ausstehend | Identisch fuer API und Dashboard |
| Session-Secrets | ausstehend | Staging-eigene Werte |
| Verschluesselungssecrets | ausstehend | Staging-eigene Werte, stabil halten |
| Redis-/Cache-Secrets | ausstehend | Staging-eigene Werte |

## Bewusste Execute-Freigabe

`NOLIS_DEMO_STAGING_EXECUTE=1` ist kein dauerhaftes Staging-Secret. Es wird erst unmittelbar vor dem kontrollierten Staging-Gate gesetzt.

Vor dem Setzen pruefen:

- Deployment laeuft auf Commit `f4ff22c438576c45b11142cf913384c99e2f02fc`.
- Alle Image-Digests sind dokumentiert.
- Staging-Datenbank ist isoliert.
- Backup/Snapshot kann vor Migration erstellt werden.
- Alle Pflichtwerte sind im Secret-Store gesetzt.
- Nur internes Test-Viewer-Konto ist aktiv.
- Keine externen NOLIS-Empfaengerkonten existieren.

## Vorbereitungsschritte

1. Staging-Projekt oder Staging-Host anlegen.
2. Eigene Staging-Datenbank mit pgvector bereitstellen.
3. Eigene Redis-/Cache-Ressource bereitstellen.
4. Demo-/Staging-Domains konfigurieren.
5. Commit `f4ff22c438576c45b11142cf913384c99e2f02fc` deployen.
6. Image-Tags und Image-Digests fuer alle Services dokumentieren.
7. Secret-Store mit allen Pflichtwerten befuellen.
8. Runtime pruefen: Node `24.17.0` fuer Node-Services.
9. Healthchecks ohne Demo-Mutation ausfuehren.
10. Erst danach das finale Staging-Gate mit `NOLIS_DEMO_STAGING_EXECUTE=1` starten.

## Noch nicht ausfuehren

Bis zur bewussten Freigabe nicht ausfuehren:

- `npm run demo:provision:evaluation -- --execute`
- echte Demo-Ingestion gegen Staging
- echte Demo-Reset-Ausfuehrung
- externe Viewer-Konten fuer NOLIS-Empfaenger
- irgendein Produktionsdeploy

## Ergebnis vor dem Staging-Gate

Solange die obigen Punkte noch nicht vollstaendig erledigt sind, bleibt der Status:

```text
PASS - STAGING EXECUTION AUSSTEHEND
```

Dieser Status erlaubt keinen externen Zugang.
