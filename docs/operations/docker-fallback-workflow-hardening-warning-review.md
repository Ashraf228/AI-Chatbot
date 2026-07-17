# Docker Fallback Workflow Hardening Warning Review

## Summary

Stand dieses Reviews ist July 17, 2026.

Der Dry Run des Workflows `Docker fallback gate` war erfolgreich. Die dabei beobachteten Warnings zu `actions/checkout@v4` und zur Node-20-Deprecation waren nicht blockierend. Der Workflow bleibt aktuell als build-only Fallback verwendbar.

Dieses Dokument bewertet nur den Hardening-Bedarf und definiert einen sicheren Folgeplan. In diesem Auftrag wurde keine Workflow-Datei geaendert.

## Current Dry Run Evidence

- Run ID: `29590305888`
- Workflow: `Docker fallback gate`
- `target_sha`: `3c26af03174e94ecfee60cf0f85941d2ce718349`
- `build_scope`: `api`
- `overall status`: `success`
- `final_decision`: `pass`
- Deploy: `nein`
- Containerstart: `nein`
- Secrets: `nein`
- DB/SQL: `nein`

## Workflow Context Reviewed

Read-only analysiert wurden:

- `.github/workflows/docker-fallback-gate.yml`
- `.github/workflows/ci.yml`
- `docs/operations/remote-docker-fallback-dry-run-status.md`
- `docs/operations/remote-docker-fallback-workflow-design.md`
- `docs/operations/remote-docker-fallback-runner-plan.md`
- `docs/operations/enterprise-sre-security-readiness-audit.md`
- `docs/operations/codex-runbook.md`

Im Fallback-Workflow werden aktuell diese GitHub Actions verwendet:

- `actions/checkout@v4` in `validate-target`
- `actions/checkout@v4` in `docker-config`
- `actions/checkout@v4` in `docker-build`

Im allgemeinen `ci.yml` werden zusaetzlich verwendet:

- `actions/checkout@v4`
- `actions/setup-node@v4`

Dieses Review aendert daran nichts, dokumentiert aber den Härtungsbedarf fuer spaetere Workflow-only Folgeschritte.

## Observed Warnings

Im erfolgreichen Dry Run wurden nicht-blockierende Runtime-Warnungen auf GitHub-Runnern sichtbar:

- `actions/checkout@v4`
- Node-20-Deprecation fuer JavaScript Actions auf GitHub Actions Runnern

Einordnung:

- kein Dry-Run-Fehler
- kein Deploy-Risiko im ausgefuehrten Run
- kein Hinweis auf Secret-, Production-, DB- oder SQL-Problem
- kein Hinweis auf Runtime-App-Defekt

## Official References Reviewed

Die Bewertung stuetzt sich auf offizielle GitHub-Quellen:

- GitHub Changelog zur Node-20-Deprecation auf GitHub Actions Runnern
- offizielles `actions/checkout` Repository / Release-Hinweise
- offizielles `actions/setup-node` Repository / Release-Hinweise

Relevante Punkte aus diesen Quellen:

- GitHub hat angekuendigt, dass Runner seit June 16, 2026 auf Node 24 als Default umstellen.
- Node 20 bleibt nur temporaer als unsicherer Kompatibilitaetspfad verfuegbar und soll spaeter im Fall 2026 entfernt werden.
- GitHub nennt `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` als Testpfad fuer fruehe Validierung.
- `actions/checkout@v5` wurde auf Node 24 umgestellt und nennt als minimale Runner-Version `v2.327.1`.
- `actions/setup-node@v5` wurde ebenfalls auf Node 24 umgestellt und nennt als minimale Runner-Version `v2.327.1`.

## Risk Assessment

| Warning | Current Impact | Future Risk | Severity | Urgency | Recommended Action |
| --- | --- | --- | --- | --- | --- |
| `actions/checkout@v4` auf Node-20-basiertem JavaScript-Action-Runtime-Pfad | niedrig, nicht blockierend, Dry Run erfolgreich | spaetere Warnungseskalation oder Inkompatibilitaet nach vollstaendiger Node-20-Entfernung | mittel | mittel | gezielte Workflow-only Pruefung auf `actions/checkout@v5` in separater PR |
| Node-20-Deprecation auf GitHub-hosted Runnern | aktuell nur Warnung, kein Dry-Run-Fehler | kuenftige CI-/Fallback-Brueche bei erzwungener Node-24-Laufzeit oder spaeterer Node-20-Entfernung | mittel bis hoch | mittel | Node-24-kompatible Action-Versionen pruefen und Fallback-Workflow erneut dry-run validieren |
| Weiterbetrieb ohne Härtung | kurzfristig akzeptabel, keine direkte Production-Auswirkung | technischer Schuldenaufbau, spaetere hektische Workflow-Reparatur unter Zeitdruck | mittel | mittel | nicht dauerhaft liegen lassen; Folgeaufgabe einplanen |

Klarstellung:

- keine Production-Auswirkung im erfolgreichen Dry Run
- kein Runtime-App-Risiko
- kein DB-/SQL-Risiko
- kein Hinweis auf Secret-Exposure

## Candidate Hardening Options

### Option A: Nur dokumentieren und beobachten

Bewertung:

- Risiko: niedrig
- keine Aenderung
- kurzfristig akzeptabel

Geeignet wenn:

- der Workflow aktuell nur selten als Fallback genutzt wird
- kurzfristig keine Workflow-only Kapazitaet frei ist

Grenze:

- verschiebt das Problem nur
- spaetere Node-20-Entfernung bleibt unaufgeloest

### Option B: Actions-Versionen gezielt pruefen und spaeter auf Node-24-kompatible Versionen aktualisieren

Bewertung:

- empfohlene Richtung
- eigene PR noetig
- Workflow-only
- kein Deploy

Konkret zu pruefen:

- `actions/checkout@v5` fuer `docker-fallback-gate.yml`
- moegliche Harmonisierung spaeter auch in `ci.yml`
- Runner-Kompatibilitaet fuer die benoetigten GitHub-hosted Runner

Warum bevorzugt:

- adressiert den eigentlichen Deprecation-Pfad direkt
- bleibt auf Workflow-Ebene
- laesst sich mit erneutem Dry Run ohne Production-Zugriff verifizieren

### Option C: Temporär `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` testen

Bewertung:

- nur falls offiziell empfohlen und im Review sinnvoll
- eigenes Review noetig
- kann Warnungen nicht zwingend dauerhaft entfernen
- nicht in diesem Auftrag

Nutzen:

- fruehe Kompatibilitaetspruefung ohne sofortige finale Versionsumstellung

Risiko:

- erzeugt einen zusaetzlichen Testpfad
- ist kein Ersatz fuer die eigentliche Versionshärtung

### Option D: Workflow unveraendert lassen bis GitHub-Lifecycle den Wechsel erzwingt

Bewertung:

- nicht bevorzugt
- erhoeht spaetere CI-Bruchgefahr

Warum nicht empfohlen:

- verschlechtert Planbarkeit
- verschiebt die Aenderung in einen spaeter moeglicherweise kritischeren Zeitpunkt

## Recommended Minimal Follow-up

Empfohlener naechster Schritt:

- `P0-Docker-1F Docker fallback workflow action version hardening`

Empfohlener Scope:

- Workflow-only
- pruefen, ob `actions/checkout@v5` oder spaetere Node-24-kompatible Versionen fuer den Fallback-Workflow geeignet sind
- falls fachlich sauber: gezielte Workflow-PR
- Dry Run erneut ausfuehren
- kein Deploy
- kein Containerstart
- keine Secrets
- kein Production-Zugriff

## Acceptance Criteria for Future Hardening

Ein spaeterer Workflow-Hardening-Fix sollte nur als erfolgreich gelten, wenn:

- der Workflow syntaktisch gueltig bleibt
- `workflow_dispatch` einziger Trigger bleibt
- `target_sha`-Validierung unveraendert erhalten bleibt
- `contents: read` einzige Permission bleibt
- `.env.example` einziger Konfigurationspfad bleibt
- kein Deploy-Pfad eingefuehrt wird
- kein Containerstart eingefuehrt wird
- kein `pull_request_target` eingefuehrt wird
- der Docker-Fallback-Dry-Run gruen bleibt
- der Output Contract weiter erfuellt bleibt

## Risks of a Rushed Upgrade

Ein uebereiltes Actions-Upgrade ohne separaten Review-Schritt kann neue Probleme einfuehren:

- Runner-Mindestversion wird uebersehen
- veraendertes Credential-Verhalten wird nicht bewusst bewertet
- Unterschiede zwischen GitHub-hosted und spaeteren self-hosted Runnern werden vermischt
- Warnung verschwindet, aber der Output Contract oder die Checkout-Semantik aendert sich unbemerkt

Deshalb ist ein kleiner, isolierter Workflow-only Follow-up-PR der sauberste Pfad.

## Non-goals

Explizit nicht Bestandteil dieses Auftrags:

- keine Workflow-Aenderung
- kein Actions-Upgrade in diesem Auftrag
- kein Dispatch
- kein Docker-Build
- kein Deploy
- keine Runtime-App-Aenderung
- keine Secrets
- keine DB-/SQL-Aktion
