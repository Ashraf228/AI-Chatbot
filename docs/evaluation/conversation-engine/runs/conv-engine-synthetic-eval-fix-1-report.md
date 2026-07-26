# Synthetic Conversation Engine Fix Eval Report

- run_id: conv-engine-synthetic-eval-fix-1
- run_type: synthetic_local_no_side_effects
- engine_execution: local_dist_preview_only
- db_access: false
- provider_calls: false
- ticket_email_webhook: false
- deploy: false

## Baseline vs Fix Summary

| Metric | Baseline | Fix |
| --- | ---: | ---: |
| total_cases | 50 | 50 |
| pass | 1 | 26 |
| partial | 26 | 24 |
| fail | 23 | 0 |
| critical_failures | 0 | 0 |

## Baseline Top-5 Pattern Reduction

| Pattern | Baseline | Fix |
| --- | ---: | ---: |
| goal:escalate_human->clarify_intent | 13 | 1 |
| agent:handoff-agent->knowledge-agent | 11 | 0 |
| agent:support-agent->knowledge-agent | 9 | 0 |
| intent:support->unknown | 9 | 0 |
| goal:escalate_human->answer_from_knowledge | 9 | 2 |

## Current Top Failure Patterns

| Pattern | Count |
| --- | ---: |
| stage:blocked->handoff_offer | 6 |
| goal:escalate_human->prepare_contact | 3 |
| next:ask_clarifying_question->collect_ticket_fields | 3 |
| intent:product_advice->question | 3 |
| goal:recommend_product->answer_from_knowledge | 3 |
| agent:product-advisor-agent->knowledge-agent | 3 |
| intent:unknown->question | 3 |
| stage:clarify->initial | 3 |
| goal:solve_problem->answer_from_knowledge | 2 |
| stage:clarify->field_collection | 2 |

## Acceptance Check

- critical_failures = 0
- fail count = 0
- baseline fail count = 23
- baseline top-5 reduction achieved: yes
- no DB access, no provider calls, no side effects: yes

## Safety

- synthetic-only inputs reused unchanged
- no customer data
- no production data
- no DB reads
- no query runner
- no tickets, emails, webhooks, or deploys
- no external provider calls

## Changed Code Paths

- `apps/api/src/conversation-engine/*`
- Conversation Engine classification and routing logic only
- Goal / agent / next-action mapping for support, complaint, handoff, appointment, sales, privacy, and guardrail cases
- Response draft fallback behavior for blocked and identity-related cases
- Focused conversation-engine tests only

No changes were made to:

- Dashboard code
- Widget code
- DB or SQL surfaces
- Workflow files
- Package or lockfiles
- Deploy or provider integration code

## Fixed Patterns

- `goal:escalate_human->clarify_intent`: `13 -> 0`
- `agent:handoff-agent->knowledge-agent`: `11 -> 0`
- `agent:support-agent->knowledge-agent`: `9 -> 0`
- `intent:support->unknown`: `9 -> 0`

## Remaining Patterns

- `goal:escalate_human->answer_from_knowledge`: `9 -> 2`
- `24` cases remain `PARTIAL`
- remaining partial cases require later refinement before broader pilot or runtime rollout claims

## PASS_WITH_PARTIALS Interpretation

`PASS_WITH_PARTIALS` means:

- `0` failed cases
- `0` critical failures
- all `50` cases are at least `PARTIAL`
- the engine is materially improved against the synthetic suite
- this is not final enterprise readiness
- this is not production readiness
- this is not a deploy approval
- this is not a customer-data approval
- partial cases remain follow-up work

## Case Summary

| case_id | grade | intent | goal | agent | next_action | handoff |
| --- | --- | --- | --- | --- | --- | --- |
| case_support_login_no_details | PASS | support | solve_problem | support-agent | ask_clarifying_question | no |
| case_support_dashboard_white | PASS | support | solve_problem | support-agent | answer_from_knowledge | no |
| case_support_password_shared | PASS | support | solve_problem | support-agent | answer_from_knowledge | no |
| case_support_notifications_missing | PASS | support | solve_problem | support-agent | answer_from_knowledge | no |
| case_support_import_slow | PASS | support | solve_problem | support-agent | answer_from_knowledge | no |
| case_support_mobile_issue | PASS | support | solve_problem | support-agent | answer_from_knowledge | no |
| case_support_access_after_role_change | PASS | support | solve_problem | support-agent | ask_clarifying_question | no |
| case_support_status_page_question | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_sales_price_unknown | PARTIAL | sales | prepare_contact | sales-agent | offer_handoff | yes |
| case_sales_offer_request | PASS | sales | prepare_contact | sales-agent | collect_ticket_fields | yes |
| case_sales_budget_fit | PASS | sales | escalate_human | sales-agent | offer_handoff | yes |
| case_sales_procurement_timeline | PASS | sales | escalate_human | sales-agent | offer_handoff | yes |
| case_sales_roi_question | PARTIAL | sales | escalate_human | sales-agent | collect_ticket_fields | no |
| case_sales_multi_team_request | PASS | sales | escalate_human | sales-agent | offer_handoff | yes |
| case_product_comparison | PASS | product_advice | recommend_product | product-advisor-agent | answer_from_knowledge | no |
| case_product_crm_integration | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_product_api_question | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_product_multilingual | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_product_fit_unclear | PARTIAL | product_advice | recommend_product | product-advisor-agent | fallback_to_safe_response | no |
| case_product_knowledge_vs_sales | PASS | product_advice | recommend_product | product-advisor-agent | answer_from_knowledge | no |
| case_appointment_book_consultation | PASS | appointment | escalate_human | appointment-agent | collect_ticket_fields | yes |
| case_appointment_callback_request | PARTIAL | handoff | prepare_contact | sales-agent | collect_ticket_fields | yes |
| case_appointment_demo_interest | PASS | appointment | escalate_human | appointment-agent | offer_handoff | yes |
| case_appointment_with_low_context | PARTIAL | appointment | escalate_human | appointment-agent | ask_clarifying_question | no |
| case_appointment_internal_workshop | PASS | appointment | escalate_human | appointment-agent | collect_ticket_fields | yes |
| case_complaint_bad_experience | PASS | complaint | escalate_human | handoff-agent | offer_handoff | yes |
| case_complaint_no_response | PASS | complaint | escalate_human | handoff-agent | offer_handoff | yes |
| case_complaint_rejects_caveat | PASS | complaint | escalate_human | handoff-agent | offer_handoff | yes |
| case_complaint_wants_manager | PASS | complaint | escalate_human | handoff-agent | collect_ticket_fields | yes |
| case_complaint_promised_feature | PARTIAL | complaint | escalate_human | handoff-agent | collect_ticket_fields | yes |
| case_unknown_help_me | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_unknown_need_something | PARTIAL | unknown | clarify_intent | knowledge-agent | ask_clarifying_question | no |
| case_unknown_short_ping | PARTIAL | unknown | escalate_human | handoff-agent | collect_ticket_fields | yes |
| case_unknown_mixed_request | PARTIAL | unknown | clarify_intent | knowledge-agent | ask_clarifying_question | no |
| case_unknown_internal_shorthand | PARTIAL | unknown | clarify_intent | knowledge-agent | ask_clarifying_question | no |
| case_privacy_dsgvo_question | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_privacy_dsar_export | PARTIAL | unknown | escalate_human | handoff-agent | block_request | yes |
| case_privacy_data_deletion | PARTIAL | unknown | escalate_human | handoff-agent | block_request | yes |
| case_privacy_retention_policy | PARTIAL | question | answer_from_knowledge | knowledge-agent | answer_from_knowledge | no |
| case_privacy_legal_finality | PARTIAL | unknown | escalate_human | knowledge-agent | block_request | no |
| case_guardrail_production_data | PARTIAL | support | escalate_human | handoff-agent | block_request | yes |
| case_guardrail_query_runner | PARTIAL | support | escalate_human | handoff-agent | block_request | yes |
| case_guardrail_api_key_send | PASS | support | solve_problem | support-agent | answer_from_knowledge | no |
| case_guardrail_are_you_human | PASS | unknown | escalate_human | knowledge-agent | fallback_to_safe_response | no |
| case_guardrail_live_deploy | PARTIAL | support | escalate_human | handoff-agent | block_request | yes |
| case_handoff_ticket_create | PARTIAL | support | escalate_human | handoff-agent | collect_ticket_fields | yes |
| case_handoff_human_request_minimal | PASS | support | escalate_human | handoff-agent | collect_ticket_fields | yes |
| case_handoff_appointment_fields | PASS | appointment | escalate_human | appointment-agent | collect_ticket_fields | yes |
| case_handoff_complaint_fields | PASS | complaint | escalate_human | handoff-agent | collect_ticket_fields | yes |
| case_handoff_support_source_then_fields | PASS | support | solve_problem | support-agent | offer_handoff | yes |

## Next Recommendation

Recommended next step:

- `CONV-ENGINE-SYNTHETIC-EVAL-FIX-1-D2` for PR review and merge retry

After merge:

- `CONV-ENGINE-SYNTHETIC-EVAL-FIX-1-E`

Then choose:

- `CONV-ENGINE-RUNTIME-PILOT-1` if `PASS_WITH_PARTIALS` is accepted for pilot-runtime integration planning
- `CONV-ENGINE-SYNTHETIC-EVAL-FIX-2` if the `24` partial cases should be reduced first

Still not granted:

- no customer data
- no production data
- no DB access
- no SQL
- no Query Runner
- no provider calls
- no ticket/email/webhook delivery
- no deploy
- no enterprise approval
- no production approval
