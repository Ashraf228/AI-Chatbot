# Golden Question Dataset v1

Dieses Dataset prueft den NOLIS-Kooperationsdemonstrator deterministisch gegen synthetische Inhalte. Es ist kein Nachweis realer Modellqualitaet, kein Penetrationstest und keine Produktionsfreigabe.

## Dateien

- `dataset-v1.jsonl`: versionierte Golden Questions.
- `schema.json`: strukturelles Schema fuer einzelne JSONL-Zeilen.
- `scripts/evaluation/validate-golden-dataset.mjs`: zusaetzliche semantische Validierung.
- `scripts/evaluation/run-golden-evaluation.mjs`: deterministischer Contract-Evaluator.

## Grundregeln

- Keine echten NOLIS-Unterlagen.
- Keine echten Kundendaten.
- Keine echten E-Mail-Adressen oder Domains.
- Keine Chain-of-Thought-Felder.
- Expected Values duerfen nicht geaendert werden, um einen Produktfehler zu kaschieren.
- Hard-Blocker muessen zu 100 Prozent bestehen.

## Ausfuehrung

```bash
npm run eval:nolis-demo:validate
npm run eval:nolis-demo
npm run eval:nolis-demo:case -- --id=GQ-001
```

Reports werden unter `artifacts/evaluation/` erzeugt und nicht versioniert.
