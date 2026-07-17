# Remote Docker Fallback Runner Plan

## Summary

Dieser Plan beschreibt einen sicheren Remote-Docker-Fallback fuer Runtime- und Post-Merge-Gates, wenn der exakte Main-CI-Nachweis auf einem Squash- oder Merge-Commit nicht sichtbar ist und lokaler Docker nicht verfuegbar ist.

Der aktuelle Blocker ist operativ, nicht fachlich:

- Main-CI ist auf dem exakten Ziel-Commit nicht immer direkt sichtbar
- `scripts/ops/codex-main-ci-gate.sh` kann lokal ohne `gh` nur `unavailable` liefern
- lokaler Docker ist in mehreren Gates nicht verfuegbar gewesen
- Runtime-Gates brauchen trotzdem einen belastbaren Docker-Build-Nachweis auf exakt dem Ziel-Commit

Die bevorzugte Minimalvariante ist jetzt als `.github/workflows/docker-fallback-gate.yml` umgesetzt.

Der Fallback bleibt strikt begrenzt:

- build-only
- `workflow_dispatch` mit exaktem `target_sha`
- `.env.example` als einziger Konfigurationspfad
- kein Deploy
- kein Containerstart
- keine Production-Secrets

Nicht Bestandteil:

- kein Runner-Setup
- kein Deploy
- keine Secrets
- kein Production-Zugriff

## Current Problem

Der aktuelle Runtime- und Post-Merge-Prozess bevorzugt zu Recht zwei Nachweiswege:

1. Main-CI-Nachweis auf exakt dem Squash- oder Merge-Commit
2. Docker-Fallback nur dann, wenn Main-CI fuer den exakten Commit nicht sichtbar oder nicht verfuegbar ist

Der Blocker tritt heute an drei Stellen auf:

- `scripts/ops/codex-main-ci-gate.sh` bewertet den exakten Commit korrekt, kann lokal ohne `gh` aber nur `unavailable` liefern
- der GitHub-Connector liefert fuer Merge-Commits nicht immer den benoetigten `push`-Run zurueck
- lokaler Docker war wiederholt nicht erreichbar, unter anderem via `unix:///Users/ash/.docker/run/docker.sock`

Dadurch bleibt fuer Runtime-Gates zeitweise nur ein manueller Ausweichprozess auf irgendeine Docker-faehige Umgebung. Dieser Ausweichprozess ist aktuell nicht hinreichend standardisiert, zu wenig auditierbar und fuer wiederholbare Gate-Entscheidungen zu fehleranfaellig.

## Required Safety Invariants

Jeder spaetere Remote-Docker-Fallback muss diese Invarianten erzwingen:

- Build nur auf exakt dem angegebenen Ziel-Commit
- Clean Worktree oder Clean Checkout
- keine Production-Secrets
- kein `docker compose up`
- kein Containerstart
- kein Deploy
- kein Zugriff auf Staging- oder Production-DB
- kein SQL
- keine `.env`-Ausgabe
- keine Kundensite
- kein Public-Widget-spezifischer Sonderpfad ausser reinem Build
- keine Runtime-Codeaenderung
- Ergebnis dient nur als Gate-Nachweis, nicht als Betriebsaktion

## Candidate Options

### Option A: GitHub Actions `workflow_dispatch` Docker Gate

Beschreibung:

- separater manuell ausloesbarer Workflow
- Input ist der exakte Commit SHA
- Workflow checkt exakt diesen Commit aus und fuehrt nur Compose-Validierung und Docker-Builds aus

Vorteile:

- reproduzierbar
- gut auditierbar
- Run-ID und Logs sind direkt in GitHub sichtbar
- kein lokaler Docker noetig
- kein Production-Zugriff erforderlich
- fuer den reinen Build-Fall voraussichtlich ohne zusaetzliche Secrets moeglich

Risiken:

- braucht Workflow-Aenderung: ja
- zusaetzlicher CI-Pfad muss sauber von Deploy getrennt werden
- Gefahr von Scope-Drift, wenn spaeter mehr als Build/Config dort landet

Braucht Secrets:

- moeglichst nein

Braucht Production-Zugriff:

- nein

Nutzen:

- hoechster Audit- und Wiederholbarkeitswert bei geringster lokaler Abhaengigkeit

### Option B: Self-hosted GitHub Runner mit Docker

Beschreibung:

- dedizierter selbstverwalteter Runner mit Docker
- wird nur fuer Fallback-Builds verwendet
- Build-Job wird ueber GitHub ausgelagert, aber nicht auf GitHub-hosted Runnern ausgefuehrt

Vorteile:

- reproduzierbar
- Build-Logs und Run-Zuordnung bleiben in GitHub sichtbar
- keine lokale Docker-Abhaengigkeit
- kein Production-Zugriff notwendig

Risiken:

- Runner-Hardening zwingend
- Betrieb, Patching, Netzsegmentierung und Cleanup muessen sauber geregelt werden
- Infrastruktur-Ownership und Verfuegbarkeit werden zum neuen Betriebsrisiko

Braucht Secrets:

- nein fuer reinen Build-Nachweis

Braucht Production-Zugriff:

- nein

Nutzen:

- gute Fallback-Option, wenn GitHub-hosted Runner nicht ausreichen oder Buildx/Layer-Caching speziell gesteuert werden soll

### Option C: Remote Docker Build Host

Beschreibung:

- Build wird per SSH oder aehnlichem auf einem entfernten Host ausgefuehrt
- Codex oder ein Operator fuehrt dort den Build direkt aus

Vorteile:

- technisch schnell realisierbar
- kein lokaler Docker noetig
- volle Kontrolle ueber Host und Docker-Version

Risiken:

- braucht SSH- oder Host-Zugriff
- potenziell Secrets oder Zugangsdaten im Operator-Kontext
- hoehere Gefahr von Drift, manuellen Fehlern und nicht standardisierten Logs
- schlechter auditierbar als GitHub-zentrierte Wege

Braucht Secrets:

- potenziell ja, deshalb riskanter

Braucht Production-Zugriff:

- nein, darf aber auch nicht dieselbe Umgebung sein

Nutzen:

- kurzfristig machbar, aber als Standardpfad zu riskant

### Option D: Docker Buildx Remote Builder

Beschreibung:

- zentraler entfernter Builder wird ueber Docker Buildx angesteuert
- eigentliche Gate-Ausfuehrung bleibt ueber einen kontrollierten Ausloesepfad moeglich

Vorteile:

- entkoppelt lokalen Docker vom eigentlichen Build
- gute Performance- und Caching-Optionen
- prinzipiell gut fuer standardisierte Build-Pfade

Risiken:

- braucht Builder-Konfiguration und Lifecycle-Management
- zusaetzliche Komplexitaet
- Fehlkonfiguration kann Intransparenz oder implizite Rechte erzeugen

Braucht Secrets:

- sollten vermieden werden

Braucht Production-Zugriff:

- nein

Nutzen:

- technisch sauber, aber fuer den aktuellen Minimalbedarf zu komplex

### Option E: Kein Remote-Fallback, nur Main-CI-Gate

Beschreibung:

- Runtime-Gates verlassen sich ausschliesslich auf den Main-CI-Nachweis

Risiken:

- nicht ausreichend, wenn Main-CI fuer exakte Merge-Commits nicht sichtbar ist
- blockiert Runtime-Deploy-Gates unnoetig bei lokaler Docker-Nichtverfuegbarkeit
- fuehrt wiederholt zu manuellen Sonderwegen ausserhalb eines standardisierten Prozesses

Warum nicht ausreichend:

- der dokumentierte operative Blocker bleibt vollstaendig bestehen

## Recommended Minimal Approach

Empfohlene Reihenfolge:

1. kurzfristig: GitHub Actions `workflow_dispatch` Docker Gate ohne Production-Secrets
2. alternativ: Docker-faehiger self-hosted Runner ohne Production-Zugriff
3. nicht bevorzugt: Remote Build Host

Begruendung:

- reproduzierbar
- auditierbar
- kein Production-Zugriff
- kein lokaler Docker-Blocker
- keine Secrets im Codex-Kontext erforderlich
- Ergebnis laesst sich sauber als Gate-Nachweis in einen Codex-Report uebernehmen

Der bevorzugte Minimalpfad ist deshalb Option A. Sie liefert den saubersten Nachweis fuer exakt einen Ziel-Commit, bleibt GitHub-zentriert, vermeidet Operator-Zugangsdaten im Codex-Kontext und reduziert das Risiko, dass ein Fallback versehentlich in Richtung Deploy driftet. Diese Option ist jetzt implementiert; Runner-Setup und Ausloesepraxis bleiben separate Betriebsaufgaben.

Option B ist der sinnvollste zweite Pfad, falls ein `workflow_dispatch`-Ansatz organisatorisch oder technisch nicht bevorzugt wird.

Option C soll nicht Standard werden, weil die Kombination aus Host-Zugriff, manueller Ausfuehrung und potenziellen Zugangsdaten den Sicherheits- und Audit-Nutzen verschlechtert.

## Required Command Shape

Der spaeter erlaubte Build-Ablauf muss in jeder Implementierungsvariante dieselbe Form einhalten:

1. Checkout exakt auf Ziel-Commit
2. Verify:
   - `git rev-parse HEAD`
   - `git status --short`
3. Docker:
   - `docker compose --env-file .env.example config -q`
   - `docker compose --env-file .env.example build api`
4. Optionaler Full Build nur wenn das Gate ihn explizit verlangt:
   - `docker compose --env-file .env.example build`

Verboten:

- `docker compose up`
- Containerstart
- Production-`.env`
- Secrets im Build-Kontext ausgeben
- Deploy-Aktionen

Die Verwendung von `.env.example` ist hier zentral, weil der Fallback-Nachweis den Compose- und Image-Build pruefen soll, ohne Production-Konfiguration oder produktive Geheimnisse zu verwenden.

## Expected Output Contract

Der spaetere Fallback-Runner muss mindestens diesen Bericht zurueckgeben:

- `target_sha`
- `repo`
- `branch_or_ref`
- `clean_checkout: yes/no`
- `docker_daemon_available: yes/no`
- `compose_config: pass/fail`
- `docker_build_api: pass/fail`
- `full_build: pass/fail/not_run`
- `no_compose_up: confirmed`
- `no_production_secrets: confirmed`
- `logs_sanitized: yes/no`
- `final_decision: pass/waiting/failed/unavailable`

Dieser Output ist so zu gestalten, dass er direkt in einen Codex-Gate-Report uebernommen werden kann, ohne Roh-Logs, `.env`-Inhalte oder Host-spezifische Geheimnisse preiszugeben.

## Failure / Stop Criteria

Der spaetere Fallback muss sofort stoppen bei:

- falscher Commit
- Dirty Worktree oder unsauberer Checkout
- Docker nicht verfuegbar
- Compose-Config-Fehler
- Build-Fehler
- Production-Secrets waeren noetig
- `.env` waere fuer den Build erforderlich oder wuerde ausgegeben
- Build versucht Container zu starten
- Runner hat Production-Zugriff oder liegt auf einem Production-Host
- Umgebung ist unklar oder nicht reproduzierbar
- Logs enthalten Secrets

## Relationship to Existing Gates

- `scripts/ops/codex-main-ci-gate.sh` bleibt der erste und bevorzugte Nachweispfad
- Remote Docker Fallback wird nur verwendet, wenn Main-CI fuer den exakten Commit nicht sichtbar oder nicht verfuegbar ist
- `DOKU_ONLY` braucht keinen Docker-Fallback
- `PURE_API_BOUNDARY` und runtime-nahe Post-Merge- oder Deploy-Gates brauchen den Fallback nur bei fehlendem Main-CI-Nachweis
- ein erfolgreicher Fallback ersetzt keinen Deploy-Auftrag
- Deploy bleibt ein separater Schritt nach Fallback-`PASS`

## Recommended Follow-up

Empfohlener Folgeauftrag:

- `P0-Docker-1B Remote Docker Fallback Workflow Design`

Empfohlener Scope:

- noch keine Implementierung
- konkreter Entwurf fuer einen minimalen `workflow_dispatch`-Pfad
- exakte SHA-Eingabe
- Checkout- und Output-Contract
- klare Trennung von Build-Nachweis und Deploy
- weiterhin keine Secrets und kein Production-Zugriff

## Non-goals

Explizit nicht Bestandteil dieses Plans:

- keine Implementierung
- keine Workflow-Aenderung
- kein Runner-Setup
- kein Deploy
- kein DB-Zugriff
- kein SQL
- keine Secrets
- keine Production-Config
- keine Runtime-Codeaenderung
