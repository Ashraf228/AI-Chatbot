# NOLIS Guided Demo Pack 1 Report

## Summary

- run_id: `nolis-guided-demo-pack-1`
- run_type: `nolis_guided_demo_pack_doku_only`
- NOLIS Guided Demo Pack created: yes
- runtime code changed: no
- dashboard code changed: no
- API code changed: no
- deploy used: no
- customer data used: no
- production data used: no

## Created Artifacts

- `docs/evaluation/nolis/nolis-guided-demo-pack.md`
- `docs/evaluation/nolis/nolis-demo-quickstart.md`
- `docs/evaluation/nolis/nolis-demo-scenarios.md`
- `docs/evaluation/nolis/nolis-demo-caveats.md`
- `docs/evaluation/nolis/nolis-feedback-form.md`
- `docs/evaluation/nolis/nolis-email-template-warnecke.md`
- `docs/evaluation/conversation-engine/runs/nolis-guided-demo-pack-1-report.json`
- `docs/evaluation/conversation-engine/runs/nolis-guided-demo-pack-1-report.md`

## NOLIS Demo Scope

- guided customer demo without customer data: `allowed_with_caveats`
- NOLIS guided demo candidate: `allowed_with_caveats`
- real customer pilot: `blocked`
- no deploy
- no public widget activation
- no real NOLIS system access

## Allowed / Not Allowed

Allowed:

- guided demo
- synthetic or approved demo content
- demo knowledge snippets
- demo PDFs
- feedback on conversation logic, usability, and speed observations

Not allowed:

- customer data
- production data
- real login credentials
- real NOLIS documents
- public widget activation
- deploy
- enterprise or pilot approval claims

## Email Template Safety

- placeholders only
- no real login URL
- no real password
- no real contact details
- no concrete time commitment

## Security Caveats

- `production-context audit`: PASS
- root/dashboard PostCSS technically fixed on `8.5.23`
- Next-internal PostCSS remains `accepted temporarily, not fixed`
- expiry: `2026-08-20`
- no deploy approval follows from this exception
- no enterprise approval follows from this exception
- no customer-data approval follows from this exception

## Recommended Next Step

- `NOLIS-GUIDED-DEMO-PACK-1-D`

After merge:

- `NOLIS-GUIDED-DEMO-PACK-1-E`

Then:

- Externe Mail an Herrn Warnecke final formulieren und senden.
