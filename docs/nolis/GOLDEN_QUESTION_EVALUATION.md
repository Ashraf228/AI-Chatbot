# Golden Question Evaluation

Diese Dokumentation beschreibt das deterministische Golden-Question-Gate fuer den NOLIS-Kooperationsdemonstrator. Es ist kein Nachweis realer Modellqualitaet, kein Penetrationstest und keine Produktionsfreigabe.

## Zweck

Das Gate prueft wiederholbar, ob der Demonstrator bei synthetischen deutschsprachigen Produktsupport-Faellen die erwarteten Sicherheits- und Produktgrenzen einhaelt. Der Lauf ist blockierend in CI und benoetigt keinen OpenAI-Aufruf, keinen externen Embedding-Dienst und keinen Internetzugriff.

## Dataset

- Version: `1.0.0`
- Datei: `test/evaluation/golden/dataset-v1.jsonl`
- Schema: `test/evaluation/golden/schema.json`
- Mindestumfang: 120 Faelle
- Aktueller Umfang: 128 Faelle
- Profil: `public-sector-product-support-demo`

Jeder Fall enthaelt ID, Version, Titel, Kategorie, Schweregrad, Sprache, Profil, User-Turns, relevante Demo-Seed-Keys, strukturierte Erwartungen und Tags.

## Kategorien

- Direkte quellenbasierte Antworten
- Paraphrasen, Tippfehler und alltagssprachliche Fragen
- Quellen- und Grounding-Verhalten
- Knowledge Gap und sichere Nicht-Antwort
- Rueckfrage und Loesungspruefung
- Produktsupport-Ticketfluss
- Dringende Eskalation
- Secret- und PII-Redaktion
- Prompt Injection und Scope-Manipulation
- Handoff- und Uebermittlungssemantik

## Hard Blocker

Ein einziger Hard-Blocker-Fehler fuehrt zu einem Exit-Code ungleich null. Hard-Blocker sind insbesondere:

- Cross-Tenant- oder Cross-Site-Quelle
- unmarkierte Knowledge-Quelle im Evaluation-Modus
- Roh-Secret in Antwort, Modellinput, Persistenz, Ticket, Audit oder Report
- Ticket ohne explizite Confirmation
- mehr als ein Ticket bei idempotentem Retry
- automatische externe Uebertragung
- falsche Behauptung einer NOLIS-Uebertragung
- Systemprompt oder interne Agentenkonfiguration im Browser-DTO
- interne Tenant-/Site-/User-ID im Browser-DTO
- unsichere Quellen-URL
- Prompt Injection veraendert Tenant, Site, Rolle, Modell oder Zielsystem
- verbindliche Verwaltungsentscheidung
- Handoff ohne bestaetigtes Demo-Ticket

## Deterministische Architektur

Der Runner nutzt:

- Dataset-Validator mit semantischen Pruefungen
- zentralen Predicate-/Assertion-Layer
- deterministischen Modelladapter im Testpfad
- synthetische Demo-Artikel aus `scripts/demo/evaluation-demo-content.mjs`
- In-Memory-DB-Adapter fuer isolierte Sessions
- gebauten `EvaluationService` aus `apps/api/dist`
- echte Product-Support-Redaktion, Preview-, Confirmation- und Cancel-Logik

Simuliert werden:

- Modellantworten beziehungsweise strukturierte Modellaktionen
- externe Transporte
- Clock und persistente Datenbank

Nicht simuliert werden die Assertions selbst: Quellenprojektion, Ticketzustaende, Confirmation, Idempotenz, Audit-Sicherheit und Report-Sanitizing werden gegen strukturierte Laufresultate geprueft.

## Ausfuehrung

```bash
npm run eval:nolis-demo:validate
npm run eval:nolis-demo
npm run eval:nolis-demo:case -- --id=GQ-001
node scripts/evaluation/run-golden-evaluation.mjs --order=reverse
```

Der normale Lauf baut zuerst die API, damit der Runner den echten `EvaluationService` aus `dist` laden kann.

## CI-Gate

Das Gate laeuft im Source Gate nach den spezialisierten Contract-Gates und vor Smoke/E2E/Produktionsbuilds:

```bash
npm run eval:nolis-demo
```

Es ist nicht als `continue-on-error` markiert und benoetigt keine Secrets.

## Reports

Jeder deterministische Lauf erzeugt:

- `artifacts/evaluation/golden-report.json`
- `artifacts/evaluation/golden-report.md`

Reports werden nicht committed.

Reports enthalten keine Chain-of-Thought, keine vollstaendigen Systemprompts, keine Rohsecrets, keine vollstaendigen Handoff-Payloads und keine vollstaendigen Chatverlaeufe.

## Secret-Sanitizing

Redaction-Faelle verwenden ausschliesslich kuenstliche Marker. Rohwerte duerfen nicht in Browser-DTO, Ticket, Audit oder Report erscheinen. Reports zeigen nur Platzhalter oder Hash-Marker.

## Optionaler Live-Modell-Modus

Der optionale Befehl:

```bash
npm run eval:nolis-demo:live
```

laeuft nur bei expliziter Aktivierung mit `RUN_LIVE_EVAL=1`. Er ist nicht Bestandteil des CI-Gates. Er darf keine Chain-of-Thought anfordern oder speichern und darf nur synthetische Inhalte verwenden.

## Grenzen

- Das Gate beweist keine reale NOLIS-Integration.
- Das Gate nutzt keine echte NOLIS-Dokumentation.
- Das Gate ersetzt keine manuelle Browser-, Accessibility-, Security- oder Fachabnahme.
- Das Gate misst keine echte Modellqualitaet im Livebetrieb.
- Der externe NOLIS-Zugang bleibt nach diesem Schritt weiterhin NO-GO.

## Fehlgeschlagener Case

Bei einem Fehler gilt:

1. Case-ID, erwarteten und tatsaechlichen strukturierten Zustand dokumentieren.
2. Falls Produktcode fehlerhaft ist, nur die kleinste Produktstelle korrigieren.
3. Expected Values nicht aendern, um fehlerhaftes Verhalten gruen zu machen.
4. Den Case dauerhaft als Regressionstest behalten.
