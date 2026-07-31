# Knowledge Provider Approval Policy

## Summary

`KNOWLEDGE-PROVIDER-APPROVAL-POLICY-1` implementiert einen rein technischen Provider-/Embedding-Approval-Policy-Contract. Der Contract validiert, ob ein spaeterer Provider-/Embedding-Pfad ueberhaupt formal freigabefaehig waere. Dieser Task erstellt keine echte Freigabe, ruft keinen Provider auf und fuehrt keinen Website-Embedding-Ingest aus.

## Previous Blocker

- `KNOWLEDGE-PROVIDER-EMBEDDING-GATE-1` hat bereits einen Default-Deny-Gate fuer spaeteres Website-Runtime-Indexing eingefuehrt.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-1` blieb blockiert, weil eine technische Provider-/Daten-/Freigabe-Policy fehlte.
- Website-Embedding ohne expliziten Grant blieb dadurch korrekt blockiert.

## Scope Decision

`scope_decision = approval_policy_contract_implemented`

Variante A war technisch tragfaehig:

- kein Storage noetig
- keine Migration noetig
- keine neue Dependency noetig
- keine echte Approval-Anlage noetig
- synthetische Policy-Objekte reichen aus, um den Gate-Contract testbar zu machen

## Approval Policy Model

Der neue Contract modelliert eine spaetere Freigabe als synthetisches Policy-Objekt mit drei Ebenen:

1. Identity / Scope
2. Provider / Model
3. Data / Privacy / Operational Controls

Der Contract ist rein validierend. Er speichert keine Freigaben, erteilt keine Freigaben und fuehrt keine Provider-Aktionen aus.

## Required Approval Fields

Pflichtfelder der technischen Policy:

- `approvalId`
- `tenantId`
- `siteId`
- optional `sourceId`
- `sourceTypes`
- `usageContexts`
- `environment`
- `provider`
- `model`
- optionale technische Provider-Metadaten wie `embeddingDimension` oder `providerRegion`
- `dataCategories`
- `customerDataApproved`
- `productionApproved`
- `providerDpaApproved`
- `purpose`
- `retentionPolicy`
- `redactionPolicy`
- `loggingPolicy`
- `deletionPolicy`
- optional `reindexPolicy`
- `rateLimit`
- `costLimit`
- `validFrom`
- `expiresAt`
- optional `revokedAt`
- `approvedBy`
- `approvalEvidenceRef`

## Default Deny Behavior

Default bleibt denied.

- ohne Policy: denied
- mit unvollstaendiger Policy: denied
- mit widerrufener Policy: denied
- mit abgelaufener Policy: denied
- mit zukuenftigem `validFrom`: denied
- mit Tenant-/Site-/Source-Mismatch: denied
- mit Source-Type-/Usage-Context-Mismatch: denied
- ohne DPA-/Customer-Data-/Production-Freigabe: denied
- ohne Retention-/Logging-/Redaction-/Rate-/Cost-Kontrollen: denied

Website-Embedding ohne gueltige Policy bleibt damit blockiert.

## Provider / Model Boundary

Die technische Policy deckt Provider und Modell explizit ab.

- ein Provider-Mismatch blockiert
- ein Modell-Mismatch blockiert
- ein spaeterer Runtime-Pfad darf nicht still auf ein anderes Modell oder einen anderen Provider ausweichen

Dieser Task ruft keinen Provider auf.

## Customer Data Boundary

`customerDataApproved` ist Pflicht. Ohne dieses Feld auf `true` bleibt der Pfad blockiert.

Dieser Task:

- erteilt keine Kundendatenfreigabe
- verwendet keine Kundendaten
- ersetzt keine organisatorische oder vertragliche Freigabe

## Production Boundary

`productionApproved` ist Pflicht fuer Production-Kontexte.

- Non-Production ohne passende Policy bleibt denied.
- Production ohne passende Policy bleibt denied.
- eine non-production Policy kann Production nicht implizit erlauben.

Dieser Task erteilt keine Production-Freigabe.

## Tenant / Site Boundary

Tenant und Site bleiben hart gebunden.

- Policy ohne Tenant-/Site-Bindung ist unzureichend.
- Tenant-Mismatch blockiert.
- Site-Mismatch blockiert.
- optionale `sourceId` kann die Policy weiter verengen.

## Retention / Logging / Redaction Boundary

Die technische Policy verlangt ausdruecklich:

- `retentionPolicy`
- `loggingPolicy`
- `redactionPolicy`
- `deletionPolicy`
- `rateLimit`
- `costLimit`

Ohne diese Felder bleibt der Pfad blockiert. Damit wird verhindert, dass spaetere Provider-Nutzung ohne Mindestkontrollen als formal freigabefaehig gilt.

## Website Embedding Boundary

Die Integration erfolgt im bestehenden Provider-/Embedding-Gate.

- Website-Embedding bleibt ohne gueltige Policy blockiert.
- Eine synthetische gueltige Policy kann im Test nur eine Gate-Allow-Entscheidung liefern.
- Diese Allow-Entscheidung fuehrt weiterhin keine Provider Calls aus.
- Diese Allow-Entscheidung erzeugt weiterhin keine Embeddings.
- Diese Allow-Entscheidung fuehrt weiterhin kein RAG aus.
- `runtime_readiness = ready` wird nicht gesetzt.
- `index_status` wird nicht nach `indexed` ueberfuehrt.

## Dashboard Impact

Kein Dashboard-Code war noetig.

- kein Toggle
- kein Provider-Settings-UI
- keine Aktivierungsflaeche
- kein Ready-/Production-Claim

## Authorization Boundary

Es wurde kein neuer Endpoint eingefuehrt.

- keine Authorization-Matrix-Erweiterung
- keine Permission-Ausweitung
- keine Public-/Viewer-Route

## Tests Added

Neue oder erweiterte Tests:

- `apps/api/test/provider-approval-policy.test.cjs`
  - missing policy denied
  - valid synthetic policy accepted
  - source-id mismatch denied
- `apps/api/test/provider-embedding-gate.test.cjs`
  - missing policy denied
  - malformed policy denied
  - revoked / expired / future policy denied
  - tenant / site / source type / usage context mismatch denied
  - provider / model mismatch denied
  - customer data / production / DPA missing denied
  - missing retention / logging / redaction / rate / cost controls denied
  - fully scoped synthetic policy can allow a gate decision
- `apps/api/test/ingest.service.test.cjs`
  - website runtime indexing stays blocked without policy
  - valid synthetic policy can acknowledge the gate decision without provider work

## Known Limitations

- Es gibt weiterhin keinen echten Website-Embedding-Ingest.
- Es gibt weiterhin keinen echten Provider Call.
- Es gibt weiterhin keine Embedding-Generierung.
- Es gibt weiterhin kein RAG.
- Es gibt weiterhin keinen `runtime_readiness = ready`-Uebergang.
- Die Policy lebt nur als synthetischer Contract im Code und in Tests.
- Echte Approval-Storage-, Revocation-, Rollen- und Audit-Prozesse sind weiterhin ausserhalb dieses Tasks.

## Remaining Follow-up Fixes

- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-2`
  - spaeterer Runtime-Schritt darf die neue Policy nur vor einem echten Provider-Pfad auswerten
  - weiterhin ohne automatische Ready-Freigabe
  - weiterhin mit expliziter Retrieval-/Attribution-Verifikation

## Safety Boundaries

- Dieser Task ruft keinen Provider auf.
- Dieser Task erzeugt keine Embeddings.
- Dieser Task fuehrt kein RAG aus.
- Dieser Task erteilt keine Provider-Freigabe.
- Dieser Task erteilt keine Kundendatenfreigabe.
- Dieser Task erteilt keine Production-Freigabe.
- Default bleibt denied.
- Ohne gueltige Policy bleibt Website-Embedding blockiert.
- Gueltige synthetische Test-Policy ist keine echte Freigabe.
- Kein `runtime_readiness = ready`.
- Kein Deploy.
- Kein Public Widget.
- Guided customer demo bleibt `still_blocked`.
- Self-service customer demo bleibt `blocked`.
- Real pilot bleibt `blocked`.
