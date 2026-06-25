# Hetzner NOLIS Demo Deployment

Stand: 2026-06-25

Dieses Runbook beschreibt die spaetere Bereitstellung eines isolierten NOLIS-Demo-Stacks auf dem bestehenden Hetzner-Server. Es enthaelt keine Secrets, keine Zugangsdaten, keine echten NOLIS-Unterlagen und keine Kundendaten.

## Ausgangslage

- Release-Kandidat: der vor Deployment freigegebene Git-Commit. Dieser muss serverseitig ausgecheckt sein und mit `APP_COMMIT_SHA` aus `.env.nolis-demo` uebereinstimmen.
- Compose-Projektname: `soule-demo`
- Geplante Hosts:
  - `demo.soulesmartbusiness.com`
  - `demo-api.soulesmartbusiness.com`
  - `demo-widget.soulesmartbusiness.com`
- Bestehender oeffentlicher Proxy-Container: `ai-chatbot-proxy-1`
- Bestehendes Edge-Netzwerk: `ai-chatbot_edge`
- Bestehender Proxy-Konfigurationsmechanismus: Nginx-Konfiguration wird im Proxy-Container aus den versionierten Templates unter `infra/nginx/` erzeugt.
- Bestehender Zertifikatsmechanismus: Zertifikate werden als read-only Verzeichnis in den Proxy-Container gemountet.
- Zertifikatsstatus: Variante B. Das aktuell gelesene Zertifikat ist kein Wildcard-Zertifikat fuer die Demo-Hosts. Fuer die drei Demo-Hosts sind neue SAN-/Einzelzertifikate erforderlich.

## Zielarchitektur

```text
Internet
  -> bestehender ai-chatbot-proxy auf 80/443
  -> Host-Header-Routing fuer Demo-Hosts
  -> soule-demo-proxy im bestehenden Edge-Netzwerk
  -> soule-demo dashboard/api/widget im Demo-internal-Netzwerk
```

Der bestehende Produktionsproxy bleibt der einzige oeffentliche Dienst auf `80` und `443`.

## Netzwerkmodell

- `existing_edge`: externes Docker-Netzwerk, konfiguriert ueber `EXISTING_EDGE_NETWORK`.
- `demo_internal`: internes Netzwerk fuer Dashboard, API, Widget, DB, Redis und Demo-Proxy.
- `demo_egress`: ausgehendes Netzwerk fuer API und optional Reporter.
- Nur der Demo-Proxy nutzt `existing_edge`.
- API, Dashboard, Widget, DB und Redis sind nicht direkt mit dem bestehenden Produktions-Edge-Netzwerk verbunden.

## Hostports

Der Demo-Stack veroeffentlicht keine Hostports fuer:

- Dashboard
- API
- Widget
- PostgreSQL
- Redis

Die Demo-Datenbank wird nicht an `0.0.0.0` gebunden. Provisionierung soll ueber Container-/Compose-Kontext erfolgen. Falls spaeter ein lokaler Host-Port noetig wird, darf nur `127.0.0.1:15432:5432` verwendet und separat begruendet werden.

## Volumes und Datenisolation

Eigene Demo-Volumes:

- `soule_demo_db_data`
- `soule_demo_redis_data`

Nicht verwenden:

- Produktionsvolumes
- bestehende Staging-Volumes
- Produktionsdatenbank-Dumps im Demo-Verzeichnis

## Ressourcenlimits

Der Server hat begrenzte Ressourcen und keinen Swap. Die Compose-Datei setzt konservative Limits:

- API: `1g`, `0.75` CPU
- DB: `1g`, `0.75` CPU
- Dashboard: `768m`, `0.50` CPU
- Reporter: `512m`, `0.50` CPU
- Redis: `256m`, `0.25` CPU
- Widget: `256m`, `0.25` CPU
- Demo-Proxy: `128m`, `0.25` CPU

Betriebshinweise:

- Builds sequenziell ausfuehren.
- Keine parallelen Docker-Builds auf dem Server.
- Kein automatisches Build-Cache-Prune in Deploy-Skripten.
- Ein kleines Swapfile kann spaeter als Betriebsentscheidung geprueft werden, wird aber nicht automatisch erstellt.

## Vorbedingungen

Vor Deployment pruefen:

- GitHub Actions fuer den Release-Kandidaten sind gruen.
- Keine High-/Critical-Auditfindings.
- Keine abgelaufene Security-Ausnahme.
- DNS fuer die drei Demo-Hosts zeigt auf den Server.
- Zertifikat deckt die drei Demo-Hosts ab.
- Bestehendes Edge-Netzwerk ist bekannt.
- Staging-Environment-Datei liegt serverseitig mit `chmod 600` vor.
- Keine echten NOLIS-Unterlagen liegen im Demo-Kontext.
- Keine Produktivkundendaten werden verwendet.

## Vorbereitung auf dem Server

Empfohlener Serverpfad:

```text
/root/AI-Chatbot
```

Vorbereitung:

```sh
git fetch origin
git checkout <freigegebener-commit>
git status --short
chmod 600 .env.nolis-demo
docker compose --env-file .env.nolis-demo -f docker-compose.nolis-demo.yml -p soule-demo config
```

Die echte `.env.nolis-demo` darf nicht ins Repository.

## Backup- und Preflight-Pflichten

Vor Migration oder Provisionierung:

- Aktuellen Serverzustand dokumentieren.
- Bestehenden Proxy-Containerzustand dokumentieren.
- Bestehende Proxy-Konfiguration sichern.
- Demo-DB-Backup/Snapshot erstellen, sofern DB bereits existiert.
- Kein Produktions-DB-Dump in das Demo-Verzeichnis kopieren.
- Keine Migration ohne Backup oder dokumentierte frische leere Demo-DB.

## Deploymentreihenfolge

1. `scripts/deploy/nolis-demo-preflight.sh .env.nolis-demo`
2. Demo-DB und Redis starten.
3. Migrationen ueber den vorgesehenen Runner ausfuehren.
4. API, Dashboard und Widget starten.
5. Demo-Proxy starten.
6. Interne Healthchecks ausfuehren.
7. Bestehenden Edge-Proxy konfigurieren.
8. Nginx-Konfiguration testen.
9. Reload statt unnoetigem Neustart.
10. Externe Healthchecks ausfuehren.
11. Demo-Provisionierung erst danach.

## Bestehenden Edge-Proxy vorbereiten

Die bestehende Produktions-Proxy-Konfiguration darf nicht automatisch veraendert werden.

Versionierte Vorlage:

```text
infra/nginx/nolis-demo-edge-route.conf.template
```

Ziel:

```text
demo.soulesmartbusiness.com       -> http://soule-demo-proxy:80
demo-api.soulesmartbusiness.com   -> http://soule-demo-proxy:80
demo-widget.soulesmartbusiness.com -> http://soule-demo-proxy:80
```

Patchplan:

1. Bestehende Proxy-Konfiguration sichern.
2. Demo-Server-Bloecke aus `infra/nginx/nolis-demo-edge-route.conf.template` in die aktive Proxy-Konfiguration uebernehmen.
3. Sicherstellen, dass der bestehende Proxy das Netzwerk `ai-chatbot_edge` verwendet und `soule-demo-proxy` dort erreichbar ist.
4. Sicherstellen, dass das Zertifikat die Demo-Hosts abdeckt.
5. Syntax pruefen.
6. Reload ausfuehren.

Beispielbefehle fuer spaeteren manuellen Einsatz:

```sh
cp /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.backup.$(date +%Y%m%d-%H%M%S)
nginx -t
nginx -s reload
```

Wenn der Proxy im Container laeuft, muessen Syntax-Test und Reload im Proxy-Container beziehungsweise ueber den bestehenden Entrypoint-Mechanismus erfolgen. Kein Produktionscontainer darf unnoetig neu erstellt werden.

## Rollback

Bei Fehler:

1. Edge-Proxy-Konfiguration auf Backup zuruecksetzen.
2. Nginx-Syntax pruefen.
3. Reload ausfuehren.
4. Demo-Stack stoppen:

```sh
scripts/deploy/nolis-demo-down.sh .env.nolis-demo
```

Wichtig:

- Keine Demo-Volumes automatisch loeschen.
- Kein `docker compose down -v`.
- Kein Image-Prune.
- Kein Build-Cache-Prune.
- Produktionscontainer nicht neu erstellen.
- DNS optional erst spaeter entfernen.

## Provisionierung

Dry-run:

```sh
npm run demo:provision:evaluation
```

Execute nur mit bewusster Freigabe:

```sh
NOLIS_DEMO_STAGING_EXECUTE=1 npm run demo:provision:evaluation -- --execute
```

Danach:

- Zweiten idempotenten Execute-Lauf durchfuehren.
- `npm run demo:verify:evaluation`
- Erwartung: 28 synthetische Demoartikel, 3 Szenarien, Chunks vorhanden, keine fremden Quellen.

## Freigabe

Vor externem Zugang muss das finale NOLIS-Demo-Gate vollstaendig bestanden sein:

- CI gruen
- Image-Digests dokumentiert
- Migrationen erfolgreich
- Demo-Provisionierung idempotent
- Verify erfolgreich
- Live-Modelltest erfolgreich
- Viewer-/Auth-Test erfolgreich
- Ticket-/Confirm-Test erfolgreich
- HMAC-Mock-Handoff erfolgreich
- Browser-/Accessibility-Restpruefung erledigt
- Secret-/Logpruefung erledigt
- Reset getestet

Erst nach GO:

- individuelle NOLIS-Viewer-Konten anlegen
- Ablaufdatum setzen
- Zugangsdaten getrennt uebermitteln

## Ergebnis bis zum Deployment

Solange die obigen Schritte nicht ausgefuehrt sind:

```text
PASS - DEPLOYMENT PREPARATION READY
```

Dieser Status ist keine externe Freigabe.
