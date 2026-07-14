# Codex Runbook

## Aufgabe Starten

- Auftrag lesen
- Scope, Non-goals und Change-Klasse festhalten
- Stop-Kriterien pruefen

## Scope Klassifizieren

- genau eine Change-Klasse waehlen
- Testmatrix und Gates aus `AGENTS.md` und `docs/operations/codex-test-matrix.md` ableiten

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
