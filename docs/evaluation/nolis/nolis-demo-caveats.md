# NOLIS Demo Caveats

## Allowed

- gefuehrte Demo
- synthetische oder harmlos freigegebene Demo-Inhalte
- Demo-PDFs
- Feedback zur Logik
- Feedback zur Bedienung

## Not Allowed

- Kundendaten
- Production-Daten
- echte NOLIS-Systemzugriffe
- echte Zugangsdaten
- echte Tickets, E-Mails oder Webhooks
- Public Widget
- Deploy
- Ableitung einer echten Pilotfreigabe aus der Demo

## Persistence Model

Persisted:

- agent config

Not persisted:

- chat
- knowledge snippets
- PDFs
- extracted PDF text
- runtime results

## Security Caveat

- `production-context audit`: PASS
- Next/PostCSS: `accepted temporarily, not fixed`
- expiry: `2026-08-20`
- no deploy approval
- no enterprise approval
- no customer-data approval

## Language Guardrails

Verbotene Aussagen:

- `production-ready`
- `enterprise-ready`
- `DSGVO final freigegeben`
- `Kundendaten erlaubt`
- `Public Widget aktiviert`
- `Deploy freigegeben`
- `Next/PostCSS fixed`

Erlaubte Aussagen:

- `gefuehrte Demo ohne Kundendaten erlaubt`
- `NOLIS guided demo candidate allowed_with_caveats`
- `echte Pilotfreigabe bleibt separater Schritt`
- `Plattform wird weiter optimiert`
