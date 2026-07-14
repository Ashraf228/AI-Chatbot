# Codex Reporting Format

Der finale Statusbericht muss enthalten:

## 1. Status

- `PASS`, `PARTIAL`, `BLOCKED` oder `STOPPED`

## 2. Branch / Commit / PR

- Branch-Name
- Commit-SHA
- PR-URL oder `nicht erstellt`

## 3. Geaenderte Dateien

- nur die tatsaechlich geaenderten Dateien

## 4. Tests

- jeder ausgefuehrte Check mit Ergebnis

## 5. Sicherheitsstatus

- Secrets gefunden: ja/nein
- relevante Sicherheitschecks
- bekannte Restrisiken

## 6. Nicht Eingefuehrt / Nicht Veraendert

- Non-goals explizit bestaetigen

## 7. Stop-Kriterien Geprueft

- bestaetigen, dass keine harten Abbruchregeln verletzt wurden

## 8. Definition Of Done Erfuellt

- ja/nein mit kurzer Begruendung

## 9. Empfehlung Naechster Schritt

- konkreter naechster sicherer Schritt
