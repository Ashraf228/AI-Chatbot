# Dashboard Knowledge Upload Save and Continue

## Summary

`DASHBOARD-P0-KNOWLEDGE-UPLOAD-SAVE-CONTINUE-1` adds an explicit save-and-continue contract to the setup wizard knowledge/PDF step.

The step now states:

- whether knowledge sources are persisted in the existing product path
- whether the sources are processed and ready
- whether the internal testchat can use them
- whether the operator can continue to the internal review step

The step does not add any new persistence surface, deploy path, public widget activation path, or customer-safe release claim.

## Previous Problem

The setup wizard already had source creation actions and a global `Speichern & weiter` button, but the knowledge step lacked one clear completion handshake.

The operator had to infer completion from several separate signals:

- source cards
- activation state
- processing state
- readiness checklist
- later testchat behavior

This made it unclear whether the step was actually saved, usable, and complete.

## Knowledge/PDF Persistence Model

This task keeps the existing persistence model unchanged.

- Setup-wizard knowledge sources remain on the existing product path.
- Listed knowledge sources are persisted backend-backed sources.
- Demo-/in-memory knowledge from other surfaces does not count as setup completion here.
- No new knowledge persistence was introduced.
- No new PDF content persistence was introduced.
- No chat-history persistence was introduced.

## New Save-and-Continue Flow

The knowledge step now exposes one explicit contract before the operator can continue:

1. At least one source must be persisted on the existing product path.
2. At least one active source must be `ready`.
3. Open processing or failed-source states block the continue action until resolved.
4. `Speichern & weiter` only leads to internal review and test, never to deploy, public widget activation, or go-live.

The skip path for the knowledge step was removed so the setup cannot silently bypass this contract.

## Status Labels

The step now makes these states explicit:

- persisted in product path
- still processing
- failed and must be fixed or removed
- active and ready for testchat
- continue blocked
- continue released

Each listed source is also labeled as product-path persisted so the step does not imply request-local or demo-only behavior.

## Completion Rules

Setup completion now aligns with the same rule used by the wizard contract:

- knowledge is complete only when at least one active `ready` knowledge source exists
- zero ready sources means `knowledge_missing`
- in-memory/demo knowledge does not satisfy setup completion
- reload must not claim persisted completion if no backend-backed source exists

## Testchat Handoff

This task makes the handoff to the next internal step visible, but it does not redesign the internal testchat itself.

- The knowledge step now states whether the internal testchat can use customer knowledge.
- The next step remains internal review and test.
- A dedicated follow-up still remains for broader internal testchat packaging.

## Still Blocked

The following remain intentionally blocked:

- website crawling in this task
- deploy
- public widget activation
- go-live
- guided customer demo
- self-service customer demo
- real pilot

## Tests Added

- dashboard knowledge step blocks continue while no usable persisted source exists
- dashboard knowledge step enables continue after a ready active manual source is saved
- API status marks missing knowledge as incomplete until at least one active ready source exists

## Remaining Follow-up Fixes

- `DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`

## Safety Boundaries

- No website crawling in this task.
- No new knowledge/PDF/chat-history persistence.
- No deploy.
- No public widget.
- No go-live.
- Guided customer demo remains blocked.
- Self-service demo remains blocked.
- Real pilot remains blocked.
