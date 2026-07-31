# Knowledge Website Embedding Ingest

## Summary

`KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-1` bleibt vorerst blockiert. Die technische Analyse zeigt, dass ein echter Website-Embedding-Ingest-Codepfad zwar naheliegend ist, die aktuelle Provider-/Daten-/Freigabemodellierung aber noch nicht ausreicht, um einen solchen Pfad sicher auf `main` zu hinterlegen.

## Previous State

- Website-Quellen werden bereits als provider-freier Text persistiert.
- `runtime_readiness` bleibt fuer Website-Quellen standardmaessig `not_ready`.
- `index_status` bleibt fuer Website-Quellen standardmaessig `pending` oder `not_requested`.
- Der Provider-/Embedding-Gate aus `KNOWLEDGE-PROVIDER-EMBEDDING-GATE-1` ist implementiert.
- Default bleibt `not_granted`.
- Website-Embedding ohne expliziten Grant bleibt blockiert.

## Scope Decision

`scope_decision = blocked_requires_provider_approval_policy`

Die Implementierung wird in diesem Schritt bewusst nicht vorgenommen.

## Provider Gate Enforcement

- Der bestehende Provider-/Embedding-Gate deckt Default-Deny, Tenant-/Site-Bindung, Source-Type, Usage-Context, Customer-Data-Approval und Production-Approval ab.
- Der Gate ist fuer `website_ingest_runtime_indexing` korrekt vor einem moeglichen Provider-/Embedding-Pfad positioniert.
- Ohne explizite Freigabe bleibt Website-Embedding geblockt.

## Embedding Ingest Model

Der analysierte Zielpfad waere:

1. Website-Quelle wurde bereits extrahiert.
2. Persistierte Website-Chunks werden fuer Embeddings vorbereitet.
3. Provider-/Embedding-Gate wird vor jeder Embedding-Anforderung erzwungen.
4. Embeddings werden persistiert.
5. Retrieval und Source Attribution werden verifiziert.
6. Erst danach darf `runtime_readiness = ready` werden.

Dieser Zielpfad wird hier noch nicht implementiert, weil die aktuelle Freigabemodellierung fuer den Schritt 3 bis 6 noch nicht ausreichend abgeschlossen ist.

## Default Deny Behavior

- Default bleibt `not_granted`.
- Ohne Grant keine Provider Calls.
- Ohne Grant keine Embeddings.
- Ohne Grant kein RAG.
- Ohne Grant kein `runtime_readiness = ready`.
- Ohne Grant keine Completion-Freigabe.

## Website Source Preconditions

Ein spaeterer Website-Embedding-Ingest darf nur fuer Quellen laufen, die:

- tenant-/site-bound sind
- `sourceType = url` haben
- aktiv sind
- `ingest_status = extracted` haben
- Text-Chunks tatsaechlich persistiert haben
- `runtime_readiness = not_ready` haben
- `index_status = pending` oder `not_requested` haben

## Runtime Readiness Preconditions

`runtime_readiness = ready` darf fuer Website-Quellen erst gesetzt werden, wenn alle folgenden Punkte technisch und fachlich abgesichert sind:

- Provider-/Embedding-Gate explizit erlaubt
- Embedding-Persistenz erfolgreich
- Retrieval-Verifikation erfolgreich
- Source Attribution benutzt echte gespeicherte Quellenmetadaten
- Completion-Regeln zaehlen die Quelle erst nach erfolgreicher Verifikation

## Retrieval / Source Attribution

Die Analyse zeigt zwei harte Anforderungen:

- Retrieval darf keine Fake-Quelle erzeugen.
- Source Attribution muss reale `source_id`, URL und Titel der gespeicherten Website-Quelle verwenden.

Ein spaeterer Implementierungsschritt braucht daher eine explizite Verifikationsregel fuer Retrieval und Attribution, bevor `ready` gesetzt wird.

## Completion Rules

Weiterhin gueltig:

- `extracted` zaehlt nicht als ready
- `index_pending` zaehlt nicht als ready
- `blocked` zaehlt nicht als ready
- `failed` zaehlt nicht als ready
- erst `indexed + runtime_ready` darf als completion-relevant gelten

## Tenant / Site Boundary

- Tenant und Site muessen in jedem Provider-/Embedding-Kontext explizit gebunden bleiben.
- Eine spaetere Freigabe darf nicht tenant-uebergreifend oder site-uebergreifend wirken.

## Dashboard Impact

In diesem Schritt keine Dashboard-Aenderung.

- kein Provider-Settings-UI
- kein Freigabe-Toggle
- kein Operator-UI, das Provider aktivieren koennte
- kein Ready-/Deploy-/Public-Widget-Signal

## Provider / Data / Privacy Boundary

Dieser Schritt fuehrt keinen Provider Call aus.

Wesentliche Blocker fuer die echte Implementierung:

- `EmbeddingService` ist aktuell ein live-faehiger OpenAI-Adapter.
- Ein echter Ingest-Pfad wuerde ohne zusaetzliche Boundary-/Policy-Sicherung einen spaeter verdrahtbaren Live-Provider-Pfad schaffen.
- Ein spaeterer `ready`-Uebergang braucht eine explizite Policy fuer:
  - Provider und Modell
  - Datenkategorie
  - Tenant und Site
  - Zweck
  - Retention
  - Kosten-/Rate-Limits
  - DPA/AVV/Datenschutzpruefung
  - Logging-/Redaction-Regeln
  - Loesch-/Reindex-Konzept

## Tests Added

Keine neuen Runtime-Tests in diesem Schritt, weil keine sichere Runtime-Implementierung eingefuehrt wurde.

Beibehaltene Sicherheitsbasis:

- production-context audit
- authorization matrix
- security boundaries
- bestehende Provider-Gate-Tests

## Known Limitations

- Kein echter Website-Embedding-Ingest implementiert.
- Kein Retrieval-Verifikationspfad fuer noch nicht `ready` gesetzte Website-Quellen implementiert.
- Kein mock-only Execution Contract fuer einen spaeteren Embedding-Adapter fixiert.
- Keine separate Provider-Approval-Policy technisch hinterlegt.

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-APPROVAL-POLICY-1`
- danach erst ein neuer Implementierungsschritt fuer den gated Website-Embedding-Ingest

## Safety Boundaries

- kein echter Provider Call
- keine echten Embeddings
- keine Kundendaten
- keine Production-Daten
- keine Provider-Freigabe behauptet
- Gate bleibt Pflicht
- Default deny bleibt Pflicht
- Website-Quelle wird ohne expliziten Grant nicht indexierbar
- kein `runtime_readiness = ready`
- kein Deploy
- kein Public Widget
- Guided customer demo bleibt `still_blocked`
- Self-service demo bleibt `blocked`
- Real pilot bleibt `blocked`
