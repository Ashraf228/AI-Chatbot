# Synthetic Conversation Engine Eval Runner Notes

- run_id: conv-engine-synthetic-eval-1
- runner_type: local_in_memory_harness
- base_runtime: built apps/api/dist classes
- db_access: false
- provider_calls: false
- ticket_email_webhook: false
- deploy: false

## Inputs
- docs/evaluation/conversation-engine/synthetic-personas.json
- docs/evaluation/conversation-engine/synthetic-contexts.json
- docs/evaluation/conversation-engine/synthetic-test-cases.json
- docs/evaluation/conversation-engine/synthetic-evaluation-rubric.md

## Assumptions
- Universal assistant profile used as the base profile for all synthetic cases.
- Context-specific handoff enablement comes from the synthetic context documents.
- Explicit handoff/ticket required fields were only applied where the synthetic context defines them.
- For non-contact goals without explicit field policy, expected missing fields were used as the synthetic required-field proxy to keep the evaluation deterministic and synthetic-only.
- Stage comparison maps runtime stages to synthetic rubric stages: understand->initial, qualify->clarify, collect_details->field_collection, confirm/handoff->handoff_offer, completed/recovery->fallback.
- Response previews were generated with the local ResponseDraftService only and without knowledge retrieval snippets, DB access, or external providers.

## Safety
- No DB queries
- No SQL
- No Query Runner
- No external providers
- No Production config
- No real data
- No side effects
