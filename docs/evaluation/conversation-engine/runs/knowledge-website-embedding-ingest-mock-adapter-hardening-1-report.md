# Knowledge Website Embedding Ingest Mock Adapter Hardening 1 Report

## Summary

Der Website-Embedding-Ingest wurde gegen unsichere mock-like Adapter gehaertet.
`mode: "mock"` allein reicht nicht mehr aus.

## Scope Decision

`website_embedding_ingest_mock_adapter_boundary_hardened`

## Root Cause

Ein caller-supplied Adapter konnte bisher allein ueber ein String-Flag akzeptiert werden.
Damit war nicht beweisbar, dass seine Methode provider-frei und netzwerkfrei bleibt.

## Adapter Boundary Review

Der Service validiert jetzt nicht nur den Mode, sondern auch, ob der Adapter aus der internen Safe-Mock-Factory stammt.

## Hardening Strategy

- interne Safe-Mock-Factory
- modulinterne `WeakSet`-Registrierung
- gefrorenes Adapterobjekt
- Ablehnung vor jedem `embedText`-Aufruf

## Unsafe Mock-like Adapter Review

Plain objects mit `mode: "mock"` werden blockiert.
Mock-like Adapter mit Netzwerk-Marker werden ebenfalls vor Ausfuehrung abgelehnt.

## Safe Mock Adapter Review

Der interne deterministische Safe-Mock-Adapter bleibt fuer den Success-Pfad verfuegbar und testbar.

## No Live Provider / No Embedding / No RAG Review

- keine Live Provider Calls
- keine Live Embeddings
- kein RAG
- keine Public Retrieval Activation

## Denied Adapter State Boundary

Abgelehnte Adapter erzeugen keine Chunks, keine Embeddings und keine Ready-Transition.

## Ready Transition Boundary

`markReady(...)` bleibt auf den verifizierten Success-Pfad begrenzt.

## Source Attribution Boundary

Abgelehnte Adapter koennen keine Source-Attribution-Evidenz erzeugen.
Die Retrieval-/Attribution-Checks bleiben fuer den Success-Pfad erhalten.

## Tests

- unsafe plain mock rejected before call
- unsafe network-capable mock-like adapter rejected before call
- safe mock adapter accepted
- denied/fail cleanup regressions preserved
- source isolation preserved

## Remaining Risks

Die Härtung ist an den internen Service-/Factory-Vertrag gebunden.
Weitere Adapter-Einstiegspunkte muessen dieselbe Safe-Mock-Regel beibehalten.

## Follow-up

`KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-MOCK-ADAPTER-HARDENING-1-D`
