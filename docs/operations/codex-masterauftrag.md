# Codex Masterauftrag Template

## Ziel

- Beschreibe das fachliche oder technische Ziel in einem Satz.

## Change-Klasse

- Eine Klasse aus `AGENTS.md` waehlen.

## Ausgangslage

- aktueller Branch / Commit
- bekannte Vorarbeiten
- relevante Einschraenkungen

## Erlaubter Scope

- explizit erlaubte Dateien, Komponenten und Grenzen

## Verbotener Scope

- alles, was nicht veraendert werden darf
- alle Non-goals des Auftrags

## Technische Grenzen

- keine unerlaubten Runtime-, DB-, Deploy- oder Production-Aktionen
- keine Secrets
- keine PR-fremden Aenderungen
- keine kundenspezifische oder NOLIS-spezifische Core-Logik

## Pflichtchecks

- Liste der Checks gemaess Change-Klasse
- zusaetzliche auftragsspezifische Checks

## Stop-Kriterien

- harte Abbruchregeln fuer diesen Auftrag
- Verweis auf `docs/operations/codex-stop-criteria.md`

## Definition Of Done

- Verweis auf `AGENTS.md`
- auftragsspezifische Abnahmekriterien

## Ausgabeformat

Das Abschlussformat muss enthalten:

1. Status
2. Branch / Commit / PR
3. Geaenderte Dateien
4. Tests
5. Sicherheitsstatus
6. Nicht eingefuehrt / nicht veraendert
7. Stop-Kriterien geprueft
8. Definition of Done erfuellt
9. Empfehlung naechster Schritt
