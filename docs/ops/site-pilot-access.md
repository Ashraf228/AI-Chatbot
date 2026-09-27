# Zeitlich begrenzter Zugang für einen einzelnen Wissenspilot

Gemeinsame API- und Widget-Hosts können mehrere Sites bedienen. Deshalb prüft
die API eine optionale Pilotregel anhand der **serverseitig geladenen Site-ID
und Tenant-ID**. Eine Regel sperrt nur ihre Ziel-Site. Sites ohne Regel behalten
ihren bisherigen Zugriff; für sie ist kein Pilot-Token nötig.

Das ist eine zusätzliche Zugangsschranke. Sie erstellt keine Providergrants,
ändert keine Rollen, ersetzt keine individuellen Operator-Logins und setzt
keine Kosten- oder Nachrichtenlimits durch. Der Pilot-Token ist ein temporäres
Bearer-Geheimnis für den lokal betriebenen Evaluator. Nur der vorgesehene
Operator erhält ihn. Ein Passwortwechsel oder Account-Widerruf widerruft diesen
separaten Token nicht: dazu die Regel sperren/rotieren und Pilotgrants schließen.

## Serverkonfiguration

`SITE_PILOT_ACCESS_RULES_JSON` enthält eine JSON-Liste mit höchstens 50 Regeln.
Die Compose-Definitionen für Hauptbetrieb und Staging reichen die Variable an
die API weiter. Die Standardkonfiguration ist leer und aktiviert nichts.
Andere Deployment-Definitionen müssen die Variable ausdrücklich ebenfalls
an jede API-Instanz weitergeben, die die Ziel-Site bedienen kann.

Jede Regel benötigt diese fünf Felder:

| Feld | Vertrag |
|---|---|
| `tenantId` | Exakte persistierte Tenant-ID, kein Wildcard |
| `siteId` | Exakte persistierte Site-ID; pro Liste nur einmal |
| `tokenSha256` | SHA-256 als 64 kleine Hexzeichen über `tenantId + NUL + siteId + NUL + token` |
| `validFrom` | Kanonisches UTC-ISO-Format wie von `Date.toISOString()` |
| `expiresAt` | Dasselbe Format, nach `validFrom`, höchstens 60 Minuten später |

Zusätzlich ist ausschließlich das optionale boolesche Feld
`traceKnowledgeSelection` erlaubt. Ohne dieses Feld oder mit `false` bleibt die
unten beschriebene Wissensdiagnose aus. `true` ändert keine Zugangsprüfung und
aktiviert nichts außerhalb dieser Tenant-/Site-Regel. Strings wie `"true"`,
unbekannte Felder und fehlende Pflichtfelder werden abgewiesen. Bestehende
Regeln mit den fünf Pflichtfeldern behalten ihr bisheriges Verhalten.

Der Token besteht aus 32 kryptografisch zufälligen Bytes als 64 kleine
Hexzeichen. Übertragen wird er ausschließlich im Header `X-Site-Pilot-Token`.
Verglichen werden gleich lange Digests mit `crypto.timingSafeEqual`. Ein vom
Client gelieferter Tenant-, Site-, IP- oder Forwarded-Header ist keine Ausnahme.

Vor Beginn, ab Ablauf, bei fehlendem/falschem Token und bei abweichendem Tenant
bleibt die betreffende Site gesperrt (HTTP 403). **Ablauf öffnet die Site nicht.**
Ungültige JSON-Konfiguration, doppelte Site-IDs oder ungültige Regeln verhindern
den API-Start. Deshalb vor dem Umschalten Konfiguration und Health prüfen: Ein
fehlerhaft konfigurierter gemeinsamer API-Prozess wäre für alle Sites ungesund.
Eine gültige, lediglich abgelaufene Regel verhindert den Start nicht.

## Erfasste Pfade

| Pfad | Prüfung |
|---|---|
| `POST /widget/session` | Vor Lesen/Schreiben einer Widget-Sitzung |
| `POST /widget/chat/message` | Vor Gesprächs-/Pipelineverarbeitung |
| `POST /widget/chat/stream` | Vor Pipeline und vor Streaming-Headern |
| `POST /chat/message` | Nach Site-Auflösung, vor Logging, Zählern und Pipeline |
| Dashboard-Testchat | Seine internen Widget-Anfragen enthalten keinen Pilot-Token und werden für die Ziel-Site ebenfalls abgewiesen. |
| Viewer-Evaluation | Sitzungsanlage und Chat einer eingeschränkten Site sind gesperrt; dieser Kanal erhält keine Token-Ausnahme. |

Der Widget-Host proxyt `/widget/*` zur selben API. Dadurch gilt die Kontrolle
auch dort, sofern alle erreichbaren API-Prozesse den geprüften Build und die
Regel verwenden. Öffentliche Konfiguration und Assets behalten ihr Format und
enthalten weder Regel noch Token. Origin-Prüfungen, Sitzungszuordnung, Rate
Limits und Providergrants bleiben zusätzlich wirksam. Der Browser-CORS-Vertrag
wird nicht um einen Pilot-Header erweitert; der Pilot läuft über den lokalen
Node-Evaluator, nicht über ein eingebettetes Geheimnis im öffentlichen Widget.

Geschützte administrative Diagnose-/Providerwerkzeuge bleiben unter ihrer
bestehenden Autorisierung. Während des begrenzten Pilots keine zusätzlichen
administrativen KI-Läufe auslösen. Diese Zugangsschranke ist keine globale
Provider-Firewall und stoppt keinen sonstigen Verkehr desselben Providerprojekts.

## Optionale Metadaten zur Wissensauswahl

Für einen ausdrücklich begrenzten Diagnosepilot kann die Serverregel
`traceKnowledgeSelection: true` enthalten. Das wird nicht vom Browser, einem
Request-Header oder dem gespeicherten Assistant-Profil gesteuert. Der Code
enthält keine aktivierte Regel. Vor einer produktiven Aktivierung müssen Scope,
Fenster und die Aufbewahrung der Diagnoseausgabe im konkreten Lauf feststehen.

Zusätzlich muss `KNOWLEDGE_PILOT_TRACE_DIR` auf ein eigenes, bereits vorhandenes
privates **tmpfs-Verzeichnis** zeigen. Dann speichert der Wissenspfad pro Frage
eine eigene Metadatendatei. Ohne geeignete Ablage bleibt die Diagnose aus.
Die Ereignisse gehen weder an den API-Logger noch an stdout/stderr; es gibt
keinen Rückfall auf gemeinsame Logs, Datenbank oder Redis. Jede Frage erhält
eine zufällige `traceId`; UTC-Zeit, Tenant, Site, Gespräch, Sitzung und Modus
erlauben die Zuordnung. Gleichzeitige Anfragen haben unterschiedliche Trace-IDs.

| Phase | Aussage |
|---|---|
| `prepared` | Unmittelbar vor dem LLM-Aufruf: geordnete Retrieval-Kandidaten und die für den bereits gebauten Generierungsprompt ausgewählten Chunks. Belegt die Vorbereitung, nicht die Freigabe oder Annahme durch den Provider. |
| `no_evidence` | Auswahl bleibt leer; dieser Pfad ruft keine Generierung auf. |
| `validated` | Nach der strukturellen Belegprüfung: zitierte Chunks mit Zuordnung der öffentlichen Q-Nummer zur ursprünglichen Generierungs-Q-Nummer. Belegt weder fachliche Vollständigkeit noch erfolgreiche Speicherung oder Zustellung. |
| `generation_failed` | Der Generierungsaufruf oder die anschließende Abbruchprüfung ist fehlgeschlagen. Keine Fehlertexte; kein Nachweis, ob bereits Providerverbrauch entstand. |

Kandidaten und Auswahl enthalten ausschließlich Chunk-/Dokument-/Source-IDs,
Reihenfolge, Score, Zeichenanzahl und SHA-256 des tatsächlich aus dem Speicher
gelesenen `content`. Damit entspricht der Hash dem vollständigen Textfeld im
Generierungsprompt, einschließlich seiner vorhandenen Whitespace-Zeichen.
Ingestion-Metadaten, rekonstruierte PDF-Texte und die gekürzten öffentlichen
Quellenauszüge sind keine Ersatz-Hashbasis. `rank` ist die einsbasierte Position
im Retrieval-Ergebnis, **kein ursprünglicher Chunkindex des Dokuments**. Die
Zuordnung zum Dokument erfolgt über IDs und den passenden Inhaltshash.

Fragen, Antworten, Verlauf, Prompts, Dokumenttexte, Titel, URLs, freie Metadaten,
Tokens und Token-Digests werden von dieser Diagnose nicht ausgegeben. IDs mit
unerwartetem Format werden als `null` erfasst. Die Ausgabe ist auf 16 Kandidaten
und acht ausgewählte beziehungsweise zitierte Chunks begrenzt. Gesamtzahlen und
`*Truncated`-Felder machen eine Überschreitung sichtbar. Bei gekürztem Trace,
fehlendem Hash/ID oder fehlendem Ereignis lässt sich aus Abwesenheit kein
negativer Befund ableiten. Die Diagnose ist kein manipulationssicheres Audit.

Vor jedem Ereignis wird die gültige Opt-in-Regel mit exakt passendem Tenant und
Site erneut geprüft. Ablauf, Entfernung, Deaktivierung oder Änderung von
Token-Digest/Fenster unterdrücken weitere Ereignisse des begonnenen Trace.
Speicherfehler ändern die Chatantwort nicht; unvollständige Traces sind daher
möglich. Die Diagnose verändert weder Retrieval noch Prompt, Modell, öffentliche
Antwort/SSE-Felder, Providergrants, Verbrauchserfassung oder Abbruchverhalten.

IDs, Sitzungskorrelation und Inhaltshashes bleiben schutzbedürftige Metadaten.
Die folgende separate Ablage ermöglicht gezieltes Löschen einzelner Traces.
Entfernen des Opt-in oder Ablauf der Regel löscht keine schon gespeicherte
Datei. Der Ablauf enthält deshalb eine ausdrückliche Löschung und eine
Abwesenheitsprüfung; diese Änderung führt keinen automatischen Löschdienst ein.

### Private Ablage und Operatornachweis

Der Code akzeptiert nur einen kanonischen absoluten Pfad ohne Symlinks, Modus
0700, Eigentümer gleich effektiver API-UID und ein als tmpfs erkanntes
Dateisystem. Dateien werden exklusiv mit 0600 angelegt; symbolische Links,
Hardlinks, fremde Eigentümer und unerwartete Berechtigungen werden abgewiesen.
Dateinamen binden Tenant/Site per SHA-256 und enthalten eine zufällige Trace-ID.
Die normale API schreibt höchstens 32 Dateien pro dedizierter Ablage, je
höchstens 64 KiB und zwei Ereignisse. Das ist kein dauerhafter Telemetriespeicher.
Nur ein API-Prozess darf diese private Ablage beschreiben; Replikas benötigen
je eine eigene Ablage und einen eigenen Nachweis.

Für einen später genehmigten Betrieb ist eine separate, begrenzte tmpfs-Mount
im API-Container vorzusehen, beispielsweise `/run/knowledge-pilot-traces` mit
4 MiB, 0700 und passender UID/GID des `node`-Benutzers. Den **tatsächlichen**
Benutzer aus dem freigegebenen Image verwenden. Die Variable muss über den
bestätigten Deploymentweg an diese API-Instanz übergeben werden; die normalen
Compose-Dateien aktivieren sie nicht. Kein Bind-Mount oder persistentes Volume,
kein allgemeines `/tmp`, keine Aufnahme in Logsammler oder Backups.

Die lokale CLI wird im API-Image mitgeliefert. Sie benötigt den bestehenden
OS-/Container-Operatorzugang unter derselben UID wie die API. Sie eröffnet
keinen HTTP-Endpunkt und erweitert keine Dashboard-Rolle oder Grant-Capability.
Ein solcher Hostoperator ist privilegiert; Tenant-/Site-Argumente verhindern
versehentliche breite Operationen, ersetzen aber keine OS-Zugriffssteuerung.

Im API-Container, mit dessen konfigurierter Umgebung:

```sh
node dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js status
node dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js probe \
  --tenant-id "$PILOT_TENANT_ID" --site-id "$PILOT_SITE_ID"
```

`status` liefert Bereitschaft und Belegung, bei ungeeigneter Ablage Exitcode 2.
`probe` legt ausschließlich eine neue synthetische Metadatendatei mit zufälliger
ID an, liest sie zurück und löscht sie sofort. Erfolg muss `ready`, `readBack`,
`deleted` und `absent` jeweils als `true` ausweisen. Dabei werden weder
Providergrants noch Embeddings, Antworten oder Datenbankabfragen ausgelöst.
Der Nachweis ist **vor jeder Aktivierung und auf jeder bedienenden Instanz**
auszuführen. Ein erfolgreiches `status` allein beweist kein Schreiben/Löschen.

Nach dem freigegebenen Capture ist die echte Sitzungs-ID bekannt. Damit lassen
sich genau die zugehörigen Traces finden, prüfen und einzeln löschen:

```sh
node dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js list \
  --tenant-id "$PILOT_TENANT_ID" --site-id "$PILOT_SITE_ID" \
  --session-id "$PILOT_SESSION_ID"
node dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js read \
  --tenant-id "$PILOT_TENANT_ID" --site-id "$PILOT_SITE_ID" \
  --trace-id "$PILOT_TRACE_ID"
node dist/ai/chat-pipeline/knowledge-pilot-trace-cli.js delete \
  --tenant-id "$PILOT_TENANT_ID" --site-id "$PILOT_SITE_ID" \
  --trace-id "$PILOT_TRACE_ID"
```

`read` gibt die geschützten Metadaten für die laufbezogene Prüfung aus. Seine
Ausgabe nicht in gemeinsame Logs, öffentliche Berichte oder Git umleiten.
Nur der freigegebene private Belegsatz darf einen Export erhalten; dessen
Löschfrist gilt separat. Datei-/Parserfehler werden ohne Pfad oder Inhalt
ausgegeben. Keine Wildcards oder rekursiven Löschbefehle verwenden.

Vor der endgültigen Löschbestätigung Grants schließen, laufende Requests
abwickeln und Trace-Opt-in entfernen. `delete` meldet bei tatsächlicher Löschung
`deleted: true, absent: true`; ein wiederholtes Löschen meldet
`deleted: false, absent: true`. Ein anschließendes `list` darf die Trace-ID nicht
mehr enthalten. Ein verspätetes Ereignis kann die gelöschte Datei nicht wieder
anlegen. Andere Traces und gemeinsame API-/Auditlogs werden nicht bearbeitet.

Docker entfernt tmpfs-Inhalte beim Stoppen des Containers. Deshalb vor einem
zur Konfigurationsübernahme erforderlichen Container-Neustart prüfen und bei
Bedarf nur gezielt in den genehmigten befristeten Belegsatz exportieren. Keine
Containerstopps als Löschabkürzung für einzelne Traces. tmpfs kann Host-Swap
verwenden; die bestehenden Regeln für Swap, Dumps, Snapshots und Exporte müssen
auch diesen Speicher abdecken. Der Code verspricht weder forensische Löschung
noch Löschung bereits exportierter Kopien. Keine neuen Hostberechtigungen oder
globalen Swap-/Backupänderungen dafür vornehmen.

Technische Referenzen: [Docker tmpfs](https://docs.docker.com/engine/storage/tmpfs/)
und [Node.js fs](https://nodejs.org/docs/latest-v24.x/api/fs.html).

Vor Rückfall auf den früheren stdout-Trace stets `traceKnowledgeSelection`
entfernen oder auf `false` setzen, damit keine neuen Ereignisse in gemeinsame
Logs gelangen. Für einen noch älteren Build ohne Trace-Feld das Feld ganz
entfernen und die fünf übrigen Sperrfelder erhalten; dessen strikte Validierung
würde sonst den Start wegen des unbekannten Felds stoppen. Geschützte Dateien
und etwaige Exporte vor der Rücknahme wie oben bereinigen.
Anschließend den bestehenden Rollout-/Rücknahmeweg verwenden; diese Diagnose
allein ist keine Freigabe für Deployment, Pilotgrants oder neue Livefragen.

## Vorbereitung ohne Provideraufruf

1. Tatsächlichen Zielscope, API-Origin, Site-Key und persönlichen Operator prüfen.
   Private Arbeitsdateien außerhalb des Repositories halten.
2. Mit `randomBytes(32).toString('hex')` einen neuen Token erzeugen. Das rohe
   Geheimnis nicht auf stdout, als CLI-Argument, in eine URL, `.env`, Target-Datei,
   Logs, Git oder einen Report schreiben. Es gehört in den lokalen Schlüsselbund
   beziehungsweise die unten beschriebene private Credential-Datei.
3. Den Scope-Digest wie oben berechnen. Eine private Regeldatei enthält nur die
   JSON-Liste für die Servervariable. Scope und Datum gegen den tatsächlichen
   Pilot abgleichen; keine Beispiel-IDs produktiv einsetzen.
4. Neue Regeldatei im gebauten Checkout providerfrei validieren, ohne ihren
   Inhalt auszugeben:

   ```sh
   node - "$SSB_PILOT_RULES_FILE" <<'NODE'
   const fs = require('node:fs');
   const { readSitePilotAccessRules } = require('./apps/api/dist/utils/site-pilot-access.js');
   const rules = readSitePilotAccessRules(fs.readFileSync(process.argv[2], 'utf8'));
   if (rules.length !== 1) throw new Error('Expected exactly one pilot scope');
   console.log('Pilot rule valid; no request sent');
   NODE
   ```

Die Credential-Datei für den Evaluator hat genau `apiOrigin`, `siteKey` und
`token`, gehört dem aktuellen lokalen Nutzer, ist eine reguläre Datei ohne
Symlink, höchstens 4096 Bytes groß und für Gruppe/Andere unlesbar (z. B. 0600 in
einem Verzeichnis mit 0700). Ihre API-Origin und ihr Site-Key müssen exakt zum
Target passen. Ein falsches Ziel oder unsichere Dateirechte stoppen vor dem
ersten Request. Auch Fehlerausgaben enthalten keinen Credential-Inhalt.

## Rollout und Aktivierung

1. Unabhängigen Code-Review, PR-CI und nach Merge Main-CI/Docker-Gate auf dem
   tatsächlichen Squash-Commit abschließen. Bestehende TLS-Reparatur erhalten.
2. Vor Aktivierung sämtliche neu anzulegenden Pilotgrants weiterhin geschlossen
   lassen. Alten API-Image-/Konfigurationsstand und Rücknahmeweg festhalten.
   Ausschließlich den geprüften API-Build und die für diesen einen Scope
   vorbereitete Variable über den bestätigten Deploymentweg ausrollen.
3. Alle Instanzen/Frontdoors erfassen, alte API-Prozesse und vorher begonnene
   Anfragen abwickeln. Andernfalls könnte ein alter Prozess die Regel noch
   umgehen. Kein pauschales Sperren der gemeinsamen Proxy-Pfade.
4. Extern mit normaler TLS-Prüfung belegen: Ziel-Site ohne/falschen Token gibt
   bei Session, beiden Chatwegen und Legacy HTTP 403 zurück; auch bereits
   vorhandene Sitzungen und manipulierte Forwarded-Header helfen nicht. Einen
   gültigen, zum Scope gehörenden Request verwenden, damit nicht bloß die
   Origin-/Session-Prüfung die Ablehnung erklärt. API- und Widget-Host prüfen.
5. Token-Positivnachweis durch eine Pilot-Session, ohne zusätzliche KI-Frage.
   Unbeteiligte aktive Sites anhand des bisherigen Config-/Session-Vertrags
   prüfen, ohne ungeplante Provideranfragen. Ihre Einträge und Providergrants
   bleiben unangetastet. Alle Test-Sessions in den gezielten Löschumfang aufnehmen.
6. Aktuelles UTC-Fenster der beiden Grants vollständig innerhalb des
   Tokenfensters wählen, höchstens 60 Minuten. Bei Verzögerung die Regel vor
   Grantaktivierung neu vorbereiten; das Fenster nicht durch veraltete Zeitwerte
   oder deaktivierte Prüfung verlängern. Den vorhandenen Monatsrest und
   anderweitigen Projektverbrauch berücksichtigen; kein Limit erhöhen.
7. Query-/LLM-Grants über den bestehenden individuellen Operatorweg erstellen,
   Status belegen und erst danach den freigegebenen Block starten:

   ```sh
   node scripts/evaluation/knowledge-pilot.mjs capture \
     --dataset "$SSB_PILOT_DATASET" --corpus "$SSB_PILOT_PDF" \
     --target "$SSB_PILOT_TARGET" --pilot-access-file "$SSB_PILOT_ACCESS_FILE" \
     --case-ids P01,P03,P05,P09,P12,P33 --mode normal --max-chat-requests 6 \
     --out "$SSB_PILOT_RUN" --execute
   ```

Der Target-Release muss jetzt den tatsächlich ausgerollten korrigierten
API-Commit enthalten. Mitschnitte und Reviews des früheren Releases nicht als
Abnahme dieses Builds mischen. Token und Credential-Dateipfad erscheinen nicht
im Capture; übertragen wird das Geheimnis nur an den gebundenen API-Origin,
ohne Redirect-Following oder Retry.

## Beenden und zurücknehmen

- Nach dem Block beziehungsweise bei Abbruch zuerst die dafür neu angelegten
  Query-/LLM-Grants widerrufen und den Status nachweisen. Andere Grants erhalten.
- Laufende Requests können bereits den Check passiert haben; Ablauf oder
  Tokenrotation beendet diese nicht nachträglich. Lauf und Providerverbrauch
  abgleichen und Abwicklung bestätigen, bevor die Einschränkung entfernt wird.
- Erst danach die konkrete Pilotregel aus der Serverkonfiguration nehmen und
  den bekannten API-Betriebsweg zur Übernahme nutzen. Bei unbestätigtem
  Grantzustand die Sperre beibehalten. Eine abgelaufene Regel sperrt weiterhin.
- Bei Rückfall auf einen Build ohne diese Kontrolle müssen die Pilotgrants
  vorher sicher geschlossen sein. Sonst würde die Zugangsschranke verschwinden.
- Lokale Credential-Datei löschen und Token im Schlüsselbund entfernen;
  Pilot-Rohdaten gemäß bestehender Frist gezielt löschen. Audit-Historie erhalten.

Quellen für die technischen Mechanismen:
[Node.js Crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html#cryptotimingsafeequala-b).
Die Tests verwenden synthetische Daten und ersetzen keine reale fachliche
Pilotabnahme oder Prüfung des produktiven Proxy-/Replikabestands.
