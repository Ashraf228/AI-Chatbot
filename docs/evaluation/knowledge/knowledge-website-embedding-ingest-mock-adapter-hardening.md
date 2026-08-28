# Knowledge Website Embedding Ingest Mock Adapter Hardening

## Summary

Der Website-Embedding-Ingest akzeptiert nicht mehr beliebige caller-supplied Adapter mit `mode: "mock"`.
Stattdessen muss der Adapter aus einer internen Safe-Mock-Factory stammen. Unsichere mock-like Adapter werden vor jedem `embedText`-Aufruf blockiert.

## Root Cause

Der bisherige Guard pruefte nur `adapter.mode === "mock"`.
Damit war kein struktureller Nachweis moeglich, dass ein uebergebenes Objekt intern nicht doch Netzwerk-, Provider- oder andere Side Effects ausfuehrt.

## Scope Decision

`website_embedding_ingest_mock_adapter_boundary_hardened`

## Current Adapter Boundary

Vor der Aenderung akzeptierte der Service jedes Objekt mit `mode: "mock"` und `embedText(...)`.
Die Methode wurde direkt im Index- und Retrieval-Verifikationspfad ausgefuehrt.

## Hardening Strategy

- Ein interner Safe-Mock-Adapter wird ueber eine modulinterne Factory erzeugt.
- Safe Adapter werden in einer modulweiten `WeakSet`-Registrierung vermerkt.
- Der Service akzeptiert nur exakt diese intern registrierten Adapterobjekte.
- Die Factory liefert gefrorene Adapterobjekte, damit Call-Sites die sichere Implementierung nicht nachtraeglich austauschen.

## Unsafe Mock-like Adapter Boundary

Plain objects mit `mode: "mock"` werden abgelehnt.
Das gilt auch fuer mock-like Objekte mit zusaetzlichen Netzwerk-Indikatoren wie `networkCapable: true`.
Die Ablehnung erfolgt vor jedem `embedText`-Aufruf, sodass keine Adapter-Side-Effects ausgefuehrt werden.

## Safe Mock Adapter Boundary

Der interne Safe-Mock-Adapter bleibt fuer deterministische Tests nutzbar.
Er erzeugt weiter lokale, deterministische Mock-Vektoren ohne Provider-SDK, Netzwerk oder externe Abhaengigkeiten.

## No Live Provider / No Live Embedding / No RAG Boundary

- Keine Live Provider Calls
- Keine Live Embeddings
- Kein RAG
- Keine Public Retrieval Activation

Die Hardening-Aenderung erweitert keinen Live-Pfad und schwächt die Default-Deny-Gates nicht ab.

## Denied Adapter State Boundary

Unsichere Adapter fuehren zu einem blockierten Ingest-Ergebnis mit sanitizierter Fehlermeldung.
Es werden keine Chunks geschrieben, keine Embeddings persistiert und kein Ready-Zustand gesetzt.

## Ready Transition Boundary

`markReady(...)` bleibt ausschliesslich dem verifizierten Success-Pfad vorbehalten.
Abgelehnte oder fehlgeschlagene Adapter duerfen keine Ready-Transition ausloesen.

## Source Attribution Boundary

Abgelehnte Adapter duerfen keine Retrieval- oder Source-Attribution-Evidenz erzeugen.
Die bestehende Verifikations- und Rollback-Logik fuer den Success-/Failure-Pfad bleibt erhalten.

## Tests

- Plain mock-like adapter rejected before call
- Network-capable mock-like adapter rejected before call
- Safe mock adapter accepted
- Existing denied/fail cleanup regressions remain green
- No ready transition from rejected adapter
- No source attribution from rejected adapter

## Remaining Risks

Der Hardening-Schritt haertet den Ingest-Service gegen unregistrierte mock-like Adapter im aktuellen Modulvertrag.
Ein spaeterer groesserer Adapter-Contract ueber weitere Module hinweg muss dieselbe interne Safe-Factory-Regel konsequent beibehalten.

## Follow-up

`KNOWLEDGE-ANSWER-QUALITY-SOURCE-ATTRIBUTION-1`
