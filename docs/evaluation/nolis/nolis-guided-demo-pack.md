# NOLIS Guided Demo Pack

## Summary

Dieses Dokument leitet aus dem abgeschlossenen Enterprise Pilot Readiness Gate eine konkrete, gefuehrte Demo-Unterlage fuer NOLIS ab.

Ziel:

- gefuehrte Evaluation fuer NOLIS
- kein Production-Pilot
- keine Kundendaten
- keine NOLIS-Systemzugriffe
- keine vertraulichen Dokumente
- keine Production-Aktivierung
- kein Public Widget
- kein Deploy

## Demo Positioning

Die Demo zeigt den geplanten Ablauf:

- Agent konfigurieren
- Demo-Wissen hinzufuegen
- Testfragen stellen
- Grenzen und Safety Panels pruefen

Die Plattform wird weiter optimiert, insbesondere:

- Gespraechslogik
- Antwortgeschwindigkeit
- Demo-Bedienung

## What NOLIS Can Evaluate

- Verstaendlichkeit des Workspace
- Agent-Konfiguration
- Testchat
- Nutzung von Demo-Wissen
- PDF-Demo-Wissen
- Handoff-Simulation
- Grenzfaelle und Datenschutzgrenzen
- Feedback zur Gespraechslogik
- Feedback zur Geschwindigkeit als Beobachtung, nicht als finaler Benchmark

## What NOLIS Should Not Evaluate Yet

- echte Kundendaten
- echte NOLIS-Daten
- vertrauliche Dokumente
- produktive Integration
- Public Widget
- Deploy
- finale Performance
- Enterprise-Go-live
- finale DSGVO-/Compliance-Freigabe

## Recommended Guided Demo Flow

1. Login
2. Workspace oeffnen
3. Agent konfigurieren
4. Config speichern oder laden
5. Demo Knowledge hinzufuegen
6. PDF Demo Knowledge hinzufuegen
7. Testchat nutzen
8. Antwort und Boundaries pruefen
9. Feedback erfassen

## Required Caveats

- Die Demo ist nicht Production.
- Es duerfen keine Kundendaten verwendet werden.
- Es duerfen keine vertraulichen Dokumente hochgeladen werden.
- Es duerfen keine echten Passwoerter, Tokens oder Secrets eingegeben werden.
- Es erfolgt keine echte Ticket-, E-Mail- oder Webhook-Ausfuehrung.
- Es wird kein Public Widget aktiviert.
- Es wird kein Deploy durchgefuehrt.
- Performance und Conversation Engine werden weiter optimiert.
- Next/PostCSS bleibt `accepted temporarily, not fixed` bis `2026-08-20`.

## Decision Basis

- guided customer demo without customer data: `allowed_with_caveats`
- NOLIS guided demo candidate: `allowed_with_caveats`
- real customer pilot: `blocked`
- deploy approval: `no`
- public widget activation: `no`
- customer data use: `no`
- `DB_READ_ONLY_AUDIT`: `not_granted`

## Recommended Next Step

- `NOLIS-GUIDED-DEMO-PACK-1-D`
- nach Merge: `NOLIS-GUIDED-DEMO-PACK-1-E`
- danach: externe Mail/Testanleitung an Herrn Warnecke finalisieren
