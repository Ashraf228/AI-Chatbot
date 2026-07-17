# Remote Docker Fallback Workflow Design

## Summary

Dieses Dokument beschreibt das Design fuer einen `workflow_dispatch`-basierten Remote-Docker-Fallback.

Ziel ist ein reproduzierbarer Build-Nachweis fuer Runtime- und Post-Merge-Gates, wenn:

- Main-CI fuer den exakten Squash- oder Merge-Commit nicht sichtbar ist
- lokaler Docker nicht verfuegbar ist

Der dokumentierte Workflow ist jetzt als `.github/workflows/docker-fallback-gate.yml` umgesetzt.

Der erste kontrollierte Dry Run ist erfolgreich gelaufen:

- Run ID: `29590305888`
- Event: `workflow_dispatch`
- `target_sha`: `3c26af03174e94ecfee60cf0f85941d2ce718349`
- `build_scope`: `api`
- Job-Ergebnis: `validate-target`, `docker-config`, `docker-build`, `summary` jeweils `success`
- `final_decision`: `pass`

Der Workflow bleibt bewusst build-only:

- kein Deploy
- kein Containerstart
- keine Production-Secrets
- kein `pull_request_target`
- nur `contents: read`
- nur `.env.example` als Konfigurationspfad

Nicht Bestandteil:

- kein Runner-Setup
- kein Deploy
- keine Secrets
- kein Production-Zugriff

## Design Goals

Das Workflow-Design muss folgende Ziele erfuellen:

- Build-Nachweis auf exakt angegebenem Squash- oder Merge-Commit
- Fallback nur fuer Runtime- und Post-Merge-Gates, wenn Main-CI nicht sichtbar oder nicht verfuegbar ist
- kein Ersatz fuer PR-CI
- kein Deploy-Mechanismus
- kein Production-Zugriff
- auditierbare Run-ID und auditierbare Summary
- maschinenlesbarer und Codex-lesbarer Output

## Workflow Trigger Design

Implementierter Trigger:

- `workflow_dispatch`

Implementierte Inputs:

- `target_sha` required
- `build_scope` optional, allowed values: `api`, `full`, default `api`
- `reason` optional
- `caller_task` optional

Validierungsregeln:

- `target_sha` muss ein 40-stelliger Git-SHA sein
- `target_sha` darf nicht leer sein
- `target_sha` darf kein Branch-Name sein
- `target_sha` muss von `origin/main` erreichbar sein
- PR-Head-SHAs duerfen nicht automatisch als Main-Fallback gelten
- der Workflow baut nur, wenn der Ziel-Commit als Main-reachable nachgewiesen wurde

## Permissions Design

Minimaler Rechtebedarf:

- `contents: read`

Explizit nicht noetig:

- keine write permissions
- keine `packages: write` permissions
- keine `deployments` permissions
- keine `environments`
- keine OIDC- oder Cloud-Credentials
- keine Production-Secrets
- keine Ausgabe des GitHub-Tokens

Der Workflow ist so ausgelegt, dass er auf GitHub-hosted Runnern ohne zusaetzliche Produktionsrechte lauffaehig bleibt.

## Job Design

### Job `validate-target`

Aufgabe:

- Repository auschecken
- History fuer `origin/main` verfuegbar machen
- `target_sha` formal validieren
- pruefen, dass der Commit existiert
- pruefen, dass `target_sha` Ancestor von `origin/main` ist
- pruefen, dass kein PR-Head-only-Commit gebaut wird
- Ziel-Metadaten fuer Folgejobs bereitstellen

Erwartete Schritte:

- `actions/checkout`
- `git fetch origin main --prune`
- SHA-Format validieren
- `git cat-file -e <target_sha>^{commit}`
- `git merge-base --is-ancestor <target_sha> origin/main`
- Ziel-Metadaten ausgeben

Erwartete Output-Felder:

- `target_sha`
- `build_scope`
- `caller_task`
- `validated_main_reachable=true|false`

### Job `docker-config`

Aufgabe:

- auf exakt validiertem Ziel-Commit auschecken
- sauberen Checkout bestaetigen
- Compose-Konfiguration mit `.env.example` pruefen

Erwartete Schritte:

- `actions/checkout` auf `ref: <target_sha>`
- `git rev-parse HEAD`
- `git status --short`
- `docker compose --env-file .env.example config -q`

Ziel:

- fruehes Scheitern bei fehlerhafter Compose-Konfiguration
- keine Build-Arbeit, wenn die statische Konfiguration bereits ungueltig ist

### Job `docker-build`

Aufgabe:

- Build nur nach erfolgreicher Konfigurationspruefung ausfuehren
- exakt zwischen `api` und `full` unterscheiden

Erwartete Schritte:

- wenn `build_scope=api`:
  - `docker compose --env-file .env.example build api`
- wenn `build_scope=full`:
  - `docker compose --env-file .env.example build`

Harte Regeln:

- kein `docker compose up`
- kein Containerstart
- keine Production-Secrets
- kein Zugriff auf Production-Infrastruktur

### Job `summary`

Aufgabe:

- GitHub Step Summary schreiben
- normalisierten maschinenlesbaren Entscheidungsblock erzeugen

Erwartete Inhalte:

- Ziel-SHA
- Build-Scope
- Ergebnisse der Validierung
- Ergebnis der Compose-Pruefung
- Ergebnis des Docker-Builds
- Bestaetigung, dass kein `compose up`, kein Containerstart, kein Deploy und keine Production-Secrets verwendet wurden

Der Summary-Job soll sowohl fuer Menschen lesbar sein als auch einen kompakten strukturierten Ergebnisblock liefern, den ein spaeterer Codex-Report direkt uebernehmen kann.

## Required Command Shape

Der Workflow darf nur einen eng begrenzten Befehlsrahmen verwenden:

- `git rev-parse HEAD`
- `git status --short`
- `git merge-base --is-ancestor <target_sha> origin/main`
- `docker compose --env-file .env.example config -q`
- `docker compose --env-file .env.example build api`
- optional bei `build_scope=full`:
  - `docker compose --env-file .env.example build`

Verboten:

- `docker compose up`
- Containerstart
- Production-`.env`
- Secrets
- Deploy

## Output Contract

Erwarteter Ergebnisblock:

```json
{
  "target_sha": "<sha>",
  "branch": "main",
  "event": "workflow_dispatch",
  "build_scope": "api",
  "clean_checkout": true,
  "target_is_ancestor_of_origin_main": true,
  "compose_config": "pass",
  "docker_build_api": "pass",
  "docker_build_full": "not_run",
  "compose_up_executed": false,
  "production_secrets_used": false,
  "container_started": false,
  "deploy_executed": false,
  "final_decision": "pass"
}
```

Anforderungen an den Output:

- keine echten Secrets
- keine sensitiven Roh-Logs
- kein impliziter Production-Kontext
- sowohl in GitHub Step Summary als auch in einer klar markierten maschinenlesbaren Form ausgebbar

## Failure / Stop Criteria

Der Workflow muss sofort stoppen bei:

- ungueltiger Ziel-SHA
- Ziel-SHA nicht in `origin/main`
- Dirty Checkout
- `.env.example` fehlt
- Compose-Config fehlschlaegt
- Docker-Build fehlschlaegt
- Workflow benoetigt Secrets
- Workflow versucht Deployment
- Workflow versucht `docker compose up`
- Workflow startet Container
- Workflow braucht Production-Zugriff
- Logs enthalten Secrets
- Ziel-SHA ist nur PR-Head und nicht main-reachable

## Relationship to Existing Gates

- `scripts/ops/codex-main-ci-gate.sh` bleibt der erste und bevorzugte Pfad
- Remote Docker Fallback nur, wenn Main-CI nicht sichtbar oder nicht verfuegbar ist
- `DOKU_ONLY` braucht keinen Docker-Fallback
- `PURE_API_BOUNDARY` und `API_RUNTIME_UNWIRED` koennen den Fallback brauchen
- Deploy bleibt separater Schritt nach Fallback-`PASS`
- Fallback-`PASS` ist kein Deploy

Der Workflow soll sich damit in bestehende Runtime-Post-Merge-Gates einfuegen, statt einen parallelen Freigabemechanismus zu eroeffnen.

Empfohlene Gate-Reihenfolge:

1. `scripts/ops/codex-main-ci-gate.sh --sha <squash>`
2. direkte GitHub Main-Push-CI-Pruefung, falls verfuegbar
3. `Docker fallback gate` per `workflow_dispatch`
4. sonst `blockiert`

## Security Considerations

Der Workflow muss diese Sicherheitsprinzipien einhalten:

- keine Secrets
- keine Production-Environment
- kein privilegierter Runner noetig
- kein self-hosted Production-Host als Standard
- GitHub-hosted Runner bevorzugt, falls Docker-Build ausreichend funktioniert
- kein Pull-Request-Code mit Production-Rechten
- kein `pull_request_target`
- Build nur fuer main-reachable Commit
- keine Token-Ausgabe in Logs oder Summary

## Recommended Implementation Follow-up

Empfohlener Folgeauftrag:

- `P0-Docker-1C-D PR pruefen, CI abwarten, Squash Merge`

Mit hartem Stop-Rahmen:

- eigene PR
- `.github/workflows/docker-fallback-gate.yml`
- keine Secrets
- kein Deploy
- nur Workflow-Implementierung
- erst nach Review

## Non-goals

Explizit nicht Bestandteil dieses Dokuments:

- keine Implementierung
- keine Workflow-Datei
- kein Runner-Setup
- kein Deploy
- kein DB-Zugriff
- kein SQL
- keine Secrets
- keine Production-Config
- keine Runtime-Codeaenderung
