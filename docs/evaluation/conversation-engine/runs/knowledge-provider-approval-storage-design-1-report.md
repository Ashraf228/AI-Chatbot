# Knowledge Provider Approval Storage Design 1 Report

## Summary

Ein persistiertes Approval-Storage-, Revocation- und Audit-Design fuer spaetere Provider-/Embedding-Ausfuehrung wurde dokumentiert. Der Task bleibt `DOKU_ONLY` und fuehrt keine Runtime-, Schema- oder Provider-Aktion aus.

## Scope Decision

- `scope_decision = approval_storage_design_documented`
- Approval-Storage-Design dokumentiert: ja
- Approval-Storage implementiert: nein
- Approval-Grants erzeugt: nein

## Approval Storage Model

- spaetere Haupttabelle `provider_approval_grants`
- harter Tenant-/Site-/optional Source-Scope
- Provider-/Modell-/Usage-/Environment-Bindung
- kein Secret-, Credential- oder Kundendaten-Storage im Grant
- overlap-/wildcard-kritische Faelle muessen spaeter per Constraints blockiert werden

## Revocation Model

- explizite Revocation ueber `revoked_at`, `revoked_by`, `revocation_reason`
- Revocation darf nicht nur UI-seitig sein
- spaetere Jobs muessen vor jedem Batch revalidieren
- widerrufene Grants blockieren Folge-Batches und spaetere Provider Calls

## Audit Lifecycle

- separates Audit-Event-Modell fuer create/update/revoke/check/block/start/complete/fail
- kein raw content
- keine embeddings
- keine secrets
- Tenant-/Site-Zuordnung bleibt Pflicht

## Runtime Gate Lookup

- spaeterer Gate-Lookup laedt nur aktive, gueltige, nicht widerrufene Grants
- exakter Match auf Tenant, Site, Source, Provider, Modell, Usage-Context und Environment
- bestehender Policy-Contract validiert den geladenen Grant erneut
- Revalidation direkt vor Provider Call, vor jedem Batch und vor jeder Ready-Transition

## API / Role Design

- spaetere interne Endpunkte fuer create/list/detail/revoke/optional validate
- `admin` und spaeter klar autorisierte `operator` koennen intern arbeiten
- `viewer`, `public` und cross-tenant bleiben denied
- kein self-service approval
- kein UI-Toggle als Approval-Ersatz

## Dashboard / UI Design

- spaeter nur read-only status, warning, revoked-/expired-Hinweise und readiness checklist
- kein `Provider aktivieren`-Toggle
- keine one-click production approval
- keine automatische ready-Behauptung

## Provider / Data / Privacy Boundary

- Storage-Design ist technische Voraussetzung, keine juristische Freigabe
- keine Provider-Freigabe behauptet
- keine Kundendatenfreigabe behauptet
- keine Production-Freigabe behauptet
- echte Nutzung bleibt bis zu separaten Freigaben und Implementierung blockiert

## Still Blocked

- Guided customer demo bleibt `still_blocked`
- Self-service demo bleibt `blocked`
- Real pilot bleibt `blocked`
- kein Deploy
- kein Public Widget
- kein Website-Embedding-Ingest

## Safety Confirmation

- keine Runtime-/Dashboard-/Widget-/Workflow-/Script-/Package-/Migration-Aenderung
- keine Credentials
- keine Passwoerter
- keine Screenshots/Recordings
- keine Live Provider Calls
- keine Live Embeddings

## Recommended Next Step

`KNOWLEDGE-PROVIDER-APPROVAL-STORAGE-SCHEMA-1`
