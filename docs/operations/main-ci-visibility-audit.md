# Main CI Visibility Audit

## Summary

Main-CI auf `main` ist in diesem Repository sehr wahrscheinlich nicht wirklich "weg", sondern in mehreren Codex-Gates mit der falschen API- und Tool-Kombination abgefragt worden.

Die aktuelle Workflow-Konfiguration in `.github/workflows/ci.yml` triggert bereits auf:

- `pull_request`
- `push` auf `main`

Es gibt keine `paths`- oder `paths-ignore`-Filter, die DOKU_ONLY- oder Runtime-Squash-Commits selektiv aus dem CI-Lauf ausschließen würden.

Der beobachtete Effekt entsteht stattdessen aus zwei Ebenen:

1. Der bisher genutzte Commit-Status-Abruf liefert nur klassische Commit-Statuses und bleibt bei GitHub-Actions-Checks leer.
2. Der bisher genutzte Workflow-Run-Abruf für Commits liefert in unserem aktuellen Tooling nur `pull_request`-Runs und blendet `push`-Runs auf `main` aus.

Dadurch wirkt der Squash-/Merge-Commit auf `main` für Codex "CI-los", obwohl die Workflow-Konfiguration selbst nicht auf einen fehlenden `push`-Trigger hindeutet.

## Current Problem

Wiederholt war die Bewertung nach dem Merge:

- PR-CI auf dem PR-Head-Commit sichtbar und grün
- `origin/main` enthält den Squash-Commit
- Main-CI-Kontexte auf dem Squash-/Merge-Commit aus dem aktuellen Codex-Prozess nicht sichtbar

Folgen:

- Runtime-Aufgaben mussten auf Docker-Fallbacks ausweichen
- DOKU_ONLY-Post-Merge-Aufgaben mussten `grün mit Hinweis` statt klar `grün` melden
- zusätzlicher Prüf- und Prompt-Aufwand in `D-E2`-/`E2`-artigen Schritten

## Observed Affected Gates

Betroffen waren laut bisherigem Prozessverlauf unter anderem:

- `P1.2B-22D-E` / `P1.2B-22D-E2`
- `P1.2B-23D-E` / `P1.2B-23D-E2`
- `P1.2B-Status-18-E`
- `P1.2B-Status-19-E`
- `P1.2B-23A-E`
- `P0-Process-Gates-1E`

Betroffen sind damit sowohl:

- `DOKU_ONLY`-Schritte
- Runtime-nahe Boundary-/Deploy-Gates

Das spricht gegen einen reinen Scope-Effekt und für ein systematisches Sichtbarkeitsproblem im Auswertepfad.

## Current Workflow Inventory

Aktuell wurde genau ein relevanter GitHub-Actions-Workflow auditiert:

### `.github/workflows/ci.yml`

Trigger:

- `pull_request`
- `push` auf `main`

Jobs:

- `Source gate`
- `Security audit`
- `Security PostgreSQL isolation`
- `Docker build`

Nicht vorhanden:

- kein `workflow_dispatch`
- keine `paths`
- keine `paths-ignore`
- keine offensichtliche DOKU_ONLY-/Runtime-Aufspaltung in getrennte Workflows

## Trigger Analysis

Die Trigger-Konfiguration spricht klar dafür, dass:

- jeder PR-Head-Commit einen CI-Lauf über `pull_request` erzeugen soll
- jeder Squash-/Merge-Commit auf `main` zusätzlich einen CI-Lauf über `push` erzeugen soll

Die YAML selbst liefert keine Evidenz für:

- versehentlich fehlende `push`-Ausführung auf `main`
- selektive Unterdrückung von Docs-only-Commits
- Ausfilterung bestimmter Dateipfade

Deshalb ist die wahrscheinlichste Erklärung nicht "Workflow läuft nicht", sondern "Workflow wird im aktuellen Codex-Gate nicht korrekt gefunden".

## Status API vs Checks API vs Workflow Runs

Die drei relevanten Ebenen sind verschieden und dürfen nicht verwechselt werden:

### 1. Commit Status API

Die bisherige Status-Abfrage liefert klassische Commit-Statuses.

Beobachtung in diesem Repository:

- für den Squash-Commit `e6b0852538f1b4e367bef5e78213d9d1d1b80fa0` war die Combined-Status-Abfrage leer
- leer bedeutet hier nicht automatisch "kein CI", sondern häufig nur "keine klassischen Commit-Statuses"

Das passt zu GitHub Actions, weil Actions-Ergebnisse typischerweise als Checks erscheinen, nicht als legacy Commit-Statuses.

### 2. Checks API

Für GitHub Actions ist die Checks-Ebene die passendere Sicht auf einen Commit.

Wichtige Folgerung:

- wenn nur Commit-Statuses abgefragt werden, kann ein echter Actions-Lauf unsichtbar bleiben
- für Squash-/Merge-Commits auf `main` sollte stattdessen die Checks-Ebene pro Git-Ref ausgewertet werden

### 3. Workflow Runs API

Workflow-Runs sind die dritte Ebene:

- sie zeigen den tatsächlichen Workflow-Lauf
- sie lassen sich nach `event`, `branch` und `head_sha` eingrenzen

Für den PR-Head-Commit `070459579553fbed130bd3176e70fe1d0a77054d` war ein CI-Run sichtbar:

- Run `29488852225`
- Ergebnis `success`

Für den Squash-Commit `e6b0852538f1b4e367bef5e78213d9d1d1b80fa0` war in unserem aktuellen Codex-Prozess kein Run sichtbar.

Entscheidende Prozessbeobachtung:

- der derzeit verwendete Commit-Workflow-Run-Abruf im Codex-Prozess liefert nur `pull_request`-Runs
- dadurch werden `push`-Runs auf `main` für Squash-/Merge-Commits systematisch ausgeblendet

## Path Filter Analysis

In `.github/workflows/ci.yml` gibt es:

- keine `paths`
- keine `paths-ignore`

Schlussfolgerung:

- DOKU_ONLY-Commits und Runtime-Commits werden von der Trigger-Konfiguration nicht unterschiedlich behandelt
- das Problem ist nicht durch einen Path-Filter erklärbar

## Branch / Main Push Behavior

Der aktuelle Workflow definiert explizit:

- `push.branches = [main]`

Das bedeutet:

- jeder Squash-Merge auf `main` sollte einen Push-basierten Workflow-Lauf auslösen

Wenn dieser Lauf in Codex nicht sichtbar ist, gibt es drei realistische Möglichkeiten:

1. der Push-Run läuft, wird aber durch den aktuellen Auswertepfad nicht gefunden
2. der Push-Run läuft und ist in GitHub sichtbar, aber nicht über die derzeit verwendeten API-Helfer
3. der Push-Run läuft tatsächlich nicht, obwohl die YAML korrekt aussieht

Die aktuelle Evidenz spricht am stärksten für `1` oder `2`, nicht für `3`.

## Root Cause Hypotheses

### Primäre Hypothese

Der Codex-Prozess fragt für Main-CI aktuell die falschen oder unvollständigen Oberflächen ab.

Konkret:

- Commit-Statuses statt Checks
- PR-gefilterte Workflow-Run-Sicht statt Push-Run-Sicht auf `main`

Wirkung:

- PR-Head-CI sichtbar
- Squash-/Merge-Commit-CI scheinbar unsichtbar

### Sekundäre Hypothese

Zusätzlich könnte ein GitHub-spezifischer UI-/API-Unterschied zwischen:

- PR-Head-Commit
- Push-Run auf `main`
- Commit-Status-Oberfläche
- Check-Suite-Oberfläche

den Effekt verstärken.

### Niedrig priorisierte Hypothese

Branch-Protection- oder Required-Checks-Konfiguration könnte inkonsistent sein.

Aktueller Audit-Stand:

- nicht direkt verifiziert
- keine Evidenz, dass dies die primäre Ursache ist
- eher Folge-/Nebenaspekt als Kernproblem

## Recommended Fix Options

### A. Workflow so anpassen, dass jeder Push auf `main` sichtbare Checks erzeugt

Betroffene Dateien:

- `.github/workflows/ci.yml`

Risiko:

- mittel

Braucht GitHub Settings:

- nein

Braucht Workflow-Änderung:

- ja

Braucht Runtime-Code:

- nein

Rückrollbarkeit:

- hoch, per Workflow-Revert

Erwarteter Nutzen:

- nur sinnvoll, wenn sich nachweist, dass `push` auf `main` aktuell tatsächlich nicht läuft

Bewertung:

- nicht minimal
- derzeit nicht die wahrscheinlichste erste Maßnahme, weil `push` bereits konfiguriert ist

### B. `workflow_dispatch` ergänzen

Betroffene Dateien:

- `.github/workflows/ci.yml`

Risiko:

- niedrig bis mittel

Braucht GitHub Settings:

- nein

Braucht Workflow-Änderung:

- ja

Braucht Runtime-Code:

- nein

Rückrollbarkeit:

- hoch

Erwarteter Nutzen:

- manueller Fallback
- löst nicht das automatische Sichtbarkeitsproblem auf Squash-/Merge-Commits

Bewertung:

- nützlich als Backup
- kein echter Primär-Fix

### C. Bestehende Gate-Skripte so erweitern, dass sie Checks API / Workflow Runs zuverlässiger auswerten

Betroffene Dateien:

- `scripts/ops/codex-*.sh`
- ggf. `docs/operations/prompts/*`
- ggf. `docs/operations/codex-runbook.md`

Risiko:

- niedrig

Braucht GitHub Settings:

- nein

Braucht Workflow-Änderung:

- nein

Braucht Runtime-Code:

- nein

Rückrollbarkeit:

- hoch

Erwarteter Nutzen:

- höchster ROI
- beseitigt sehr wahrscheinlich die aktuelle Sichtbarkeitslücke ohne CI-Änderung
- reduziert DOKU_ONLY-Fallbacks und Docker-Fallbacks

Bewertung:

- aktuell bester Minimal-Fix

### D. Required Status Contexts harmonisieren

Betroffene Dateien:

- keine Repo-Dateien zwingend

Risiko:

- mittel

Braucht GitHub Settings:

- ja

Braucht Workflow-Änderung:

- möglicherweise nein

Braucht Runtime-Code:

- nein

Rückrollbarkeit:

- mittel

Erwarteter Nutzen:

- kann Branch-Protection-Klarheit verbessern
- löst aber nicht die eigentliche Sichtbarkeit im Codex-Prozess, wenn dort die falsche API genutzt wird

Bewertung:

- nur nachrangig

### E. Kein Fix, nur Runbook-Fallback dokumentieren

Betroffene Dateien:

- `docs/operations/*`

Risiko:

- niedrig

Braucht GitHub Settings:

- nein

Braucht Workflow-Änderung:

- nein

Braucht Runtime-Code:

- nein

Rückrollbarkeit:

- hoch

Erwarteter Nutzen:

- kurzfristige Klarheit
- kein eigentlicher Effizienzgewinn

Bewertung:

- als Interimshinweis brauchbar
- als Endzustand nicht ausreichend

## Recommended Minimal Fix

Empfohlen wird **Option C**.

Minimaler Folgeschritt:

- nicht den Workflow ändern
- stattdessen den Main-CI-Abgleich in den Codex-Gates korrigieren

Konkret:

1. Main-CI für Merge-/Squash-Commits nicht mehr primär über Combined Status bewerten
2. stattdessen Check-Runs pro Git-Ref auswerten
3. ergänzend Workflow-Runs nach `event=push`, `branch=main` und `head_sha=<squash_sha>` auswerten
4. PR-Head- und Main-Push-Runs im Reporting klar trennen
5. nur wenn danach weiterhin kein Push-Run sichtbar ist, einen Workflow-Fix in `P0-CI-1B` prüfen

Warum das minimal ist:

- keine CI-Datei ändern
- keine GitHub-Settings anfassen
- kein Runtime-Risiko
- direkt auf die wahrscheinlichste Fehlerquelle im Codex-Prozess gerichtet

## Risks

Risiken dieses Audit-Ergebnisses:

- Branch-Protection-/Required-Checks-Settings wurden in diesem Schritt nicht direkt ausgelesen
- GitHub UI-Sichtbarkeit wurde nicht als Hauptsignal verwendet; der Audit basiert auf Repo-Konfiguration plus beobachteten API-/Tooling-Ergebnissen
- falls `push`-Runs auf `main` doch tatsächlich ausbleiben, reicht Option C allein nicht

Trotzdem bleibt Option C die sinnvollste Erstmaßnahme, weil sie:

- die kleinste Änderung ist
- die stärkste aktuelle Evidenz adressiert
- spätere Workflow-Korrekturen nicht ausschließt

## Rollback

Für `P0-CI-1A` selbst ist kein operativer Rollback nötig.

Es handelt sich um einen reinen Doku-Audit.

Für den empfohlenen Folge-Fix gilt:

- Option C wäre rein prozessual und dokumentativ bzw. Tooling-seitig
- ein Rückbau wäre einfach per Revert möglich

## Follow-up Task

Empfohlener nächster Schritt:

- `P0-CI-1B Main-CI Visibility Minimal Fix`

Ziel von `P0-CI-1B`:

- den Codex-Gate-Abgleich für `main` auf Checks- und Push-Run-Sicht umstellen
- PR-Head- und Main-Push-Auswertung sauber trennen
- nur falls danach weiter Lücken bestehen, einen kleinen Workflow-Fix als separaten Folgeauftrag vorbereiten
