# Dashboard Knowledge Upload Save and Continue Report

## Summary

The setup wizard knowledge/PDF step now has an explicit save-and-continue contract.

## UI Changes

- added a dedicated save-and-continue status summary to the knowledge step
- labeled setup-wizard knowledge sources as persisted on the existing product path
- blocked continue while sources are missing, still processing, or failed
- removed the skip path for the knowledge step

## Persistence Model

- setup-wizard knowledge sources remain on the existing product path
- no new knowledge persistence was introduced
- no new PDF content persistence was introduced
- no chat-history persistence was introduced
- demo-/in-memory knowledge does not count as setup completion

## Save-and-Continue Behavior

- continue is released only when at least one active `ready` source exists
- continue stays blocked for processing or failed sources
- continue leads to internal review and test only

## Testchat Handoff

- the step now explicitly states whether the internal testchat can use the saved knowledge
- the broader internal testchat packaging remains a follow-up task

## Still Blocked

- guided customer demo
- self-service customer demo
- real pilot
- deploy
- public widget activation
- go-live
- website crawling

## Safety Confirmation

- no deploy
- no public widget activation
- no production activation
- no customer data
- no production data
- no new persistence surface
- no website crawling

## Recommended Next Step

`DASHBOARD-P0-INTERNAL-TESTCHAT-IN-SETUP-1`
