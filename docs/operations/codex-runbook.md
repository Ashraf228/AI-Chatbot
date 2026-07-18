# Codex Runbook

## Aufgabe Starten

- Auftrag lesen
- Scope, Non-goals und Change-Klasse festhalten
- Stop-Kriterien pruefen

## Scope Klassifizieren

- genau eine Change-Klasse waehlen
- Testmatrix und Gates aus `AGENTS.md` und `docs/operations/codex-test-matrix.md` ableiten

## Skript-Shortcuts

- `scripts/ops/codex-preflight.sh`
- `scripts/ops/codex-doc-only-gate.sh`
- `scripts/ops/codex-pure-api-boundary-gate.sh --focused-test "<command>" --regression-test "<command>"`
- `scripts/ops/codex-sensitive-scan.sh`
- `scripts/ops/codex-main-ci-gate.sh --sha <squash>`

Diese Skripte standardisieren lokale Repo-Gates und den Main-CI-Nachweis fuer exakte Squash- oder Merge-Commits. Workflow-Dateien, GitHub-Settings und Docker-Fallbacks bleiben separate Aufgaben.

Der dokumentierte Docker-Fallback fuer Runtime-Post-Merge-Gates ist jetzt als `.github/workflows/docker-fallback-gate.yml` vorhanden. Er bleibt ein build-only-Notpfad fuer exakte `target_sha`-Commits, nutzt nur `.env.example`, hat nur `contents: read` und ersetzt weder Main-CI noch den separaten Deploy-Schritt.

Der erste kontrollierte Dry Run des Fallback-Workflows war erfolgreich. Fuer Runtime-Post-Merge-Gates ist der Workflow damit operativ nutzbar, wenn Main-CI nicht sichtbar ist und lokaler Docker nicht verfuegbar ist.

## Prompt-Templates

- `docs/operations/prompts/doku-only.md`
- `docs/operations/prompts/pure-api-boundary.md`
- `docs/operations/prompts/commit-pr.md`
- `docs/operations/prompts/pr-review-merge.md`
- `docs/operations/prompts/post-merge-check.md`
- `docs/operations/prompts/api-deploy.md`
- `docs/operations/prompts/db-readonly-decision-gate.md`
- `docs/operations/prompts/security-diff-scan.md`
- `docs/operations/prompts/doku-pr-merge.md`
- `docs/operations/prompts/runtime-post-merge-gate.md`
- `docs/operations/codex-review-security-diff-scan-policy.md`

Kurze Aufgaben sollen nach Moeglichkeit auf eines dieser Templates verweisen statt den kompletten Ablauf jedes Mal neu auszuformulieren.

Bei PR-Review-, Workflow-, Runtime-, Auth-, Tenant-, Widget-, Webhook-, Delivery-, Migration-, Cleanup- und Production-Config-Scope ist zusaetzlich die Review- und Security-Diff-Scan-Matrix aus `docs/operations/codex-review-security-diff-scan-policy.md` anzuwenden.

## Branch / Worktree Vorbereiten

- eigener Branch pro Auftrag
- kein Direct Push auf `main`
- bei Dirty Tree separaten Clean Worktree verwenden

## Implementieren

- nur erlaubte Dateien aendern
- keine PR-fremden Aenderungen anfassen
- keine Secrets, `.env`, Reports oder Backups committen

## Tests Ausfuehren

- Pflichtchecks gemaess Change-Klasse
- auftragsspezifische Zusatztests
- `git diff --check`

## PR Erstellen

- PR-Template vollstaendig ausfuellen
- Scope, Risiken, Rollback und Non-goals dokumentieren

## CI Pruefen

- Main-CI pruefen
- bei Runtime-Code Docker-Gate pruefen
- bei roter CI sofort stoppen

Empfohlener Main-CI-Pfad fuer Runtime-Post-Merge-Gates:

1. `scripts/ops/codex-main-ci-gate.sh --sha <squash>`
2. bei direkter GitHub-Main-Push-CI-Sichtbarkeit: diese ebenfalls dokumentieren
3. bei `pass`: Main-CI-Gate erfuellt
4. bei `waiting`: auf CI warten
5. bei `failed`: blockiert
6. bei `unavailable`: erst dann `.github/workflows/docker-fallback-gate.yml`
7. falls weder Main-CI noch Fallback verfuegbar sind: `blockiert`

## Status-Matrix

- `DOKU_ONLY`: `A/C -> D -> E`
- `PURE_API_BOUNDARY`: `B -> C -> D -> D-E -> E -> Status`
- `API_RUNTIME_UNWIRED`: `B -> C -> D -> D-E -> E -> Status`
- `DEPLOY_ONLY`: `D-E -> E -> Status`
- `DB_READ_ONLY_AUDIT`: `Decision -> Approval -> Staging -> Report -> Production Decision`

Runtime-Boundary-, Merge-, Gate- und Deploy-Schritte bleiben strikt linear. Doku-only- und Audit-only-Aufgaben koennen parallel laufen, solange sie keine gemeinsame Runtime-Freigabe oder Deploy-Abfolge beruehren.

## Merge Durchfuehren

- nur nach gruenen Gates
- nur in den vorgesehenen Branch/PR-Fluss

## Post-Merge-Check

- Commit/PR dokumentieren
- Sicherheitsstatus dokumentieren
- naechsten Schritt empfehlen

## Deploy Nur Mit Explizitem Auftrag

- kein impliziter Deploy
- kein Containerstart oder `docker compose up` ohne Sonderauftrag

## Blocker Melden

- Stop-Kriterium klar nennen
- betroffene Dateien oder Checks nennen
- sichere Fortsetzung vorschlagen
