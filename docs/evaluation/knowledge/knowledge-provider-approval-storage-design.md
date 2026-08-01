# Knowledge Provider Approval Storage Design

## Summary

`KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-DESIGN-1` dokumentiert ein spaeteres persistiertes Approval-Storage-Modell fuer Provider-/Embedding-Nutzung. Der Task bleibt `DOKU_ONLY`: kein Approval-Storage wird implementiert, keine Migration wird angelegt, keine echte Approval wird erzeugt, kein Provider wird aufgerufen, keine Embeddings werden erzeugt und kein Website-Embedding-Ingest wird ausgefuehrt.

## Previous State

- `KNOWLEDGE-PROVIDER-EMBEDDING-GATE-1` erzwingt einen Default-Deny-Gate fuer spaetere provider-gestuetzte Website-Indexierung.
- `KNOWLEDGE-PROVIDER-APPROVAL-POLICY-1` definiert einen technischen Approval-Policy-Contract als Laufzeitobjekt.
- `KNOWLEDGE-WEBSITE-EMBEDDING-INGEST-2` bleibt blockiert, weil ein persistiertes Approval-Storage-, Revocation- und Audit-Modell fehlt.
- Der aktuelle Zustand erlaubt keine echte Website-Embedding-Ausfuehrung und keine `runtime_readiness = ready`-Promotion fuer Website-Quellen.

## Scope Decision

`scope_decision = approval_storage_design_documented`

Variante A ist tragfaehig, weil der aktuelle Ist-Zustand klar ist:

- Policy-Contract und Gate existieren bereits.
- Persistierte Approval-Records existieren noch nicht.
- Revocation-/Expiry-Lookup existiert noch nicht unabhaengig von caller-supplied payloads.
- Durable Audit-Ereignisse fuer spaetere Provider-/Embedding-Ausfuehrung existieren noch nicht.

## Approval Storage Model

Vorgeschlagen wird eine spaetere persistierte Haupttabelle `provider_approval_grants`. Der Name kann an bestehende Projektkonventionen angepasst werden, muss aber Tenant-/Site-gebunden und eindeutig auf Provider-/Modell-/Usage-Scope bezogen bleiben.

Das Storage-Modell ist eine technische Ausfuehrungsvoraussetzung. Es ist keine rechtliche Freigabe und keine produktive Aktivierung.

## Approval Grant Fields

Pflichtfelder fuer `provider_approval_grants`:

- `id`
- `tenant_id`
- `site_id`
- `source_id` optional
- `source_types`
- `usage_contexts`
- `environment`
- `provider_key`
- `model`
- `embedding_dimension` optional
- `provider_region` optional
- `data_categories`
- `customer_data_approved`
- `production_approved`
- `provider_dpa_approved`
- `purpose`
- `retention_policy`
- `redaction_policy`
- `logging_policy`
- `deletion_policy`
- `reindex_policy` optional
- `rate_limit`
- `cost_limit`
- `valid_from`
- `expires_at`
- `revoked_at`
- `revoked_by`
- `revocation_reason`
- `approved_by`
- `approval_evidence_ref`
- `created_at`
- `updated_at`

Ableitung aus dem bestehenden Policy-Contract:

- `approvalId -> id`
- `tenantId -> tenant_id`
- `siteId -> site_id`
- `sourceId -> source_id`
- `sourceTypes -> source_types`
- `usageContexts -> usage_contexts`
- `provider -> provider_key`
- `embeddingDimension -> embedding_dimension`
- `providerRegion -> provider_region`
- `customerDataApproved -> customer_data_approved`
- `productionApproved -> production_approved`
- `providerDpaApproved -> provider_dpa_approved`
- `retentionPolicy -> retention_policy`
- `redactionPolicy -> redaction_policy`
- `loggingPolicy -> logging_policy`
- `deletionPolicy -> deletion_policy`
- `reindexPolicy -> reindex_policy`
- `rateLimit -> rate_limit`
- `costLimit -> cost_limit`
- `validFrom -> valid_from`
- `expiresAt -> expires_at`
- `revokedAt -> revoked_at`
- `approvedBy -> approved_by`
- `approvalEvidenceRef -> approval_evidence_ref`

## Constraints / Indexes

Erforderliche spaetere DB-Constraints und Indizes:

- Tenant-/Site-Scope-Index auf `tenant_id, site_id`
- Source-Scope-Index auf `tenant_id, site_id, source_id`
- Provider-/Modell-Index auf `provider_key, model`
- Active-valid-Lookup-Index auf `tenant_id, site_id, environment, revoked_at, valid_from, expires_at`
- Revoked-Lookup-Index auf `revoked_at`
- Expiry-Lookup-Index auf `expires_at`
- Constraint gegen cross-tenant oder global wildcard approvals
- Constraint oder Exclusion-Strategie gegen ueberlappende aktive Grants fuer denselben harten Scope

Verboten im Design:

- globale Approval ohne Tenant-/Site-Bindung
- implizite Production-Freigabe
- Speicherung von API-Keys, Secrets oder Provider-Credentials
- Speicherung von Rohinhalten, Embeddings oder Kundendaten im Grant

## Revocation Model

Revocation muss spaeter explizit und durable sein:

- Widerruf setzt `revoked_at`, `revoked_by`, `revocation_reason`
- Revocation Reason bleibt sanitisiert und enthaelt keine Rohdaten
- Revocation darf nur durch spaetere berechtigte Rollen erfolgen
- Ein widerrufener Grant darf nie wieder als aktiv gelten

Runtime-Anforderungen bei Revocation:

- der Gate-Lookup prueft `revoked_at is null` unmittelbar vor jedem Provider Call
- ein spaeterer Embedding- oder Reindex-Job revalidiert vor jedem Batch
- wird ein Grant waehrend eines Jobs widerrufen, muessen Folge-Batches abbrechen
- Revocation darf nicht nur UI-seitig existieren

Reindex-/Deletion-Folge:

- Revocation allein behauptet keine automatische Loeschung
- ein spaeterer Folgeprozess darf nur auf Basis eines separaten, auditierten Deletion-/Reindex-Plans laufen
- nach Revocation bleibt weitere Provider-/Embedding-Ausfuehrung blockiert

## Audit Lifecycle

Vorgeschlagen wird eine spaetere zweite Tabelle `provider_approval_audit_events`.

Pflicht-Events:

- `approval_created`
- `approval_updated`
- `approval_revoked`
- `approval_expired`
- `approval_checked`
- `approval_denied`
- `provider_call_blocked`
- `embedding_job_requested`
- `embedding_job_started`
- `embedding_job_blocked`
- `embedding_job_completed`
- `embedding_job_failed`

Pflichtfelder je Audit-Event:

- `id`
- `tenant_id`
- `site_id`
- `source_id` optional
- `actor_id` oder `system_actor`
- `role`
- `event_type`
- `decision_code`
- `provider_key`
- `model`
- `usage_context`
- `grant_id`
- `sanitized_reason`
- `request_id` oder `correlation_id`
- `created_at`

Audit darf spaeter nicht enthalten:

- raw website content
- embeddings
- API keys oder secrets
- Kundendaten-Rohwerte

## Runtime Gate Lookup

Ein spaeterer persistenter Gate-Lookup muss mit folgenden Inputs arbeiten:

- `tenant_id`
- `site_id`
- `source_id`
- `source_type`
- `usage_context`
- `provider`
- `model`
- `environment`

Lookup-Regeln:

- nur aktive Grants
- `valid_from <= now`
- `expires_at > now`
- `revoked_at is null`
- harter Tenant-/Site-Match
- optionaler harter `source_id`-Match
- `source_type` und `usage_context` muessen enthalten sein
- `provider_key` und `model` muessen exakt matchen
- `customer_data_approved`, `provider_dpa_approved` und bei Production auch `production_approved` muessen `true` sein

Zusaetzliche Contract-Validierung:

- der bereits vorhandene Contract aus `provider-approval-policy.ts` validiert den geladenen Record nach dem DB-Lookup erneut
- nur `storage grant + policy contract pass` darf spaeter `allow` bedeuten

Revalidation ist zwingend:

- unmittelbar vor Provider Call
- vor jedem Batch eines spaeteren Embedding-Jobs
- vor jeder spaeteren `ready`-Transition

Denial-Verhalten:

- kein Provider Call
- keine Embedding-Erzeugung
- keine `runtime_readiness = ready`
- sanitisiertes Audit-Event

## Revalidation Requirements

Ein spaeterer ausfuehrbarer Pfad darf keine stale cached approval verwenden.

Pflichtregeln:

- Grant vor Jobstart laden reicht nicht aus
- Job muss vor jedem Batch gegen aktuelle Revocation-/Expiry-Lage pruefen
- Ready-Transition darf nur nach finaler Revalidation erfolgen
- ein expired Grant blockiert genauso wie ein revoked Grant

## API / Role Design

Keine API wird in diesem Task implementiert. Fuer spaeteres Runtime-Wiring werden folgende internen Admin-/Operator-Endpunkte erwartet:

- `POST /sites/:siteId/provider-approvals`
- `GET /sites/:siteId/provider-approvals`
- `GET /sites/:siteId/provider-approvals/:approvalId`
- `POST /sites/:siteId/provider-approvals/:approvalId/revoke`
- optional `POST /sites/:siteId/provider-approvals/:approvalId/validate`

Zukuenftiges Rollenmodell:

- `admin` und spaeter klar autorisierte `operator` duerfen interne Approval anlegen oder widerrufen
- `viewer` bleibt denied
- `public` bleibt denied
- cross-tenant bleibt denied
- site-bound enforcement bleibt Pflicht
- self-service customer approval bleibt blocked bis zu einem separaten Task
- ein UI-Toggle darf keine Approval erzeugen

Die Authorization Matrix wird in diesem DOKU_ONLY-Task nicht veraendert.

## Dashboard / UI Design

Keine UI wird in diesem Task implementiert. Spaetere UI darf nur den Status und die Blocking-Grundlagen sichtbar machen.

Zulaessige spaetere UI-Konzepte:

- read-only approval status
- warning bei fehlender Freigabe
- revoked-/expired-Status
- Hinweis `Indexierung blockiert: Freigabe fehlt`
- Hinweis `Antwortbereit erst nach Indexierung`
- audit-/readiness-checklist

Nicht zulaessige spaetere UI-Konzepte:

- einfacher Toggle `Provider aktivieren`
- one-click production approval
- versteckte customer-data approval
- public-widget activation
- automatische ready-Behauptung
- Approval ohne Policy-Details
- Approval ohne Audit-Evidence

Terminologie fuer den Hauptfluss bleibt kompatibel mit:

- `Wissen`
- `Interner Test`
- `Review & Livegang`
- `Technische Diagnose`
- `oeffentliches Chatfenster`
- `KI-Mitarbeiter`

## Provider / Data / Privacy Boundary

Das Approval-Storage-Modell ist nur technische Voraussetzung fuer spaetere sichere Ausfuehrung.

Es ersetzt nicht:

- Provider-Freigabe
- Customer-Data-Freigabe
- Production-Freigabe
- DPA/AVV-/Datenschutzpruefung
- juristische Bewertung

Technische Kernaussagen:

- Provider Calls koennen Datenabfluss darstellen
- Embeddings koennen Website-/Kundendaten an externe Provider senden
- vor echter Nutzung muessen Provider, Modell, Datenkategorien, Tenant, Site, Quelle, Zweck, Retention, Logging, Redaction, Loeschung/Reindex, Kosten-/Rate-Limits und DPA/AVV separat freigegeben werden

Dieser Task behauptet keine Rechtsberatung und keine Datenschutzfreigabe.

## Migration Plan

Spaeterer Folge-Task `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1` sollte voraussichtlich enthalten:

1. DB-Migration fuer `provider_approval_grants`
2. DB-Migration fuer `provider_approval_audit_events`
3. harte Indizes und Constraints fuer Tenant-/Site-/Active-valid-Lookups
4. Mapping-Layer vom DB-Record auf den bestehenden Policy-Contract
5. read-only Lookup-Funktion fuer den Gate-Pfad

Nicht Teil dieses Tasks:

- Migration ausfuehren
- Daten schreiben
- Grants anlegen
- UI anbinden
- Provider aktivieren

## Tests Required For Implementation

Spaetere Implementierung braucht mindestens:

- Lookup gegen active-valid grant
- expired grant denied
- revoked grant denied
- tenant mismatch denied
- site mismatch denied
- source mismatch denied
- provider/model mismatch denied
- customer-data/DPA/production approvals missing denied
- runtime revalidation vor Provider Call
- Batch-Abbruch nach Revocation
- Audit-Events fuer create/check/revoke/block/complete/fail
- Dashboard read-only status ohne hidden activation path

## Known Limitations

- kein Approval-Storage implementiert
- keine DB-Migration
- keine Approval-Grants erzeugt
- keine Revocation-/Audit-Storage-Implementierung
- kein API-Endpoint implementiert
- kein Dashboard- oder Runtime-Wiring
- kein Provider Call
- keine Embeddings
- kein RAG
- kein Website-Embedding-Ingest

## Remaining Follow-up Fixes

- `KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1`
  - Schema und Audit-Tabellen implementieren
- danach erst ein separater Runtime-/Execution-Task
  - persistente Grant-Lookups in den Gate-Pfad haengen
- danach erst spaeterer Website-Embedding-Execution-Task
  - weiterhin nur mit Gate + Policy + Retrieval-/Attribution-Nachweis

## Safety Boundaries

- Dieser Task ist `DOKU_ONLY`.
- Kein Approval-Storage wurde implementiert.
- Keine DB-Migration wurde angelegt.
- Keine Approval-Grants wurden erzeugt.
- Kein Provider Call wurde ausgefuehrt.
- Keine Embeddings wurden erzeugt.
- Kein RAG wurde ausgefuehrt.
- Keine Provider-Freigabe wird behauptet.
- Keine Kundendatenfreigabe wird behauptet.
- Keine Production-Freigabe wird behauptet.
- Default bleibt denied.
- Ohne persistierte, aktive, nicht widerrufene und nicht abgelaufene Approval bleibt Website-Embedding blockiert.
- Kein `runtime_readiness = ready` wurde hinzugefuegt.
- Kein Deploy.
- Kein Public Widget.
- Guided customer demo bleibt `still_blocked`.
- Self-service demo bleibt `blocked`.
- Real pilot bleibt `blocked`.
