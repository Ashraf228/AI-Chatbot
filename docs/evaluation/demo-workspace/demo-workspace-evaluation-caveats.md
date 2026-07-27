# Demo Workspace Evaluation Caveats

## Allowed

- synthetic content
- explicitly approved demo PDFs
- internal test questions
- agent-configuration persistence
- in-memory knowledge
- in-memory PDF-derived snippet use
- in-memory chat evaluation

## Not Allowed

- customer data
- production data
- real secrets
- real customer documents
- real tickets, emails, or webhooks
- deploy
- public widget activation
- persistence of knowledge, PDFs, or chat history
- enterprise go-live claims

## Current Persistence Model

Persisted:

- agent config only

Not persisted:

- chat
- knowledge snippets
- PDFs
- extracted PDF text
- runtime results

## Security Status

- `production-context audit`: PASS
- Next/PostCSS status: exact-scoped accepted temporarily, not fixed
- no deploy approval
- no enterprise approval
- no customer-data approval

## Language Guardrails

Forbidden statements:

- "Die Plattform ist production-ready."
- "Die Plattform ist enterprise-freigegeben."
- "Public Widget ist aktiviert."
- "Kundendaten können schon genutzt werden."
- "DSGVO ist final freigegeben."
- "Next/PostCSS ist gefixt."

Allowed statements:

- "Die Demo zeigt den geplanten Ablauf."
- "Agent-Konfiguration, Testchat und Demo-Wissen können geprüft werden."
- "Die Plattform wird weiter optimiert."
- "Production- und Enterprise-Freigaben sind separate Schritte."

## Additional Evaluation Boundaries

- No real credentials in any test input.
- No confidential documents in any upload.
- No benchmark claims based on this demo alone.
- No claim that `PASS_WITH_PARTIALS` equals final release approval.
- No claim that saving config also saves chat, knowledge, or PDF state.

## Short Evaluator Reminder

If a test requires:

- real data
- production access
- public widget behavior
- deploy activity
- live integration delivery

then it is outside the approved scope of this demo.
