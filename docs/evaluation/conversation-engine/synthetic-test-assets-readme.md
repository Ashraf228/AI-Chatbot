# Conversation Engine Synthetic Test Assets

Stand: 2026-07-26

## Summary

This directory contains internal synthetic-only test assets for the universal Conversation Engine.

Purpose:

- prepare synthetic evaluation material for later intent, goal, and agent-routing reviews
- define expected conversation-state outputs without executing the engine
- define expected safety boundaries and response-quality criteria
- provide reusable internal assets for a later explicitly approved synthetic evaluation task

This asset pack is intentionally limited.

It is:

- synthetic-only
- internal-only
- documentation and data-definition only

It is not:

- an engine run
- a demo run
- a report with real data
- an export workflow
- a deploy workflow

The assets in this directory:

- do not execute the Conversation Engine
- do not execute any synthetic dry run
- do not execute any demo
- do not use customer data
- do not use production data
- do not use production secrets
- do not read a database
- do not execute SQL
- do not use a query runner
- do not create reports
- do not create exports
- do not create screenshots
- do not create recordings
- do not create slides
- do not create tickets, webhooks, emails, or handoff side effects
- do not grant `ENT-SEC-1I-EXEC`
- do not grant `ENT-SEC-1J-EXEC` outside this narrow synthetic asset scope

## Asset Decision Summary

- `conversation_engine_synthetic_test_assets_created: yes`
- `asset_creation_scope: internal_synthetic_only`
- `engine_execution_approved: no`
- `dry_run_execution_approved: no`
- `demo_execution_approved: no`
- `customer_data_use: no`
- `production_data_use: no`
- `production_secret_use: no`
- `DB_READ_ONLY_AUDIT: not_granted`
- `query_runner: not_granted`
- `reports_with_data: not_granted`
- `DSAR_execution: not_granted`
- `export_execution: not_granted`
- `backup_verification_execution: not_granted`
- `monitor_alert_setup: not_granted`
- `deploy_required_by_assets: no`

## Files

### `synthetic-personas.json`

Contains synthetic personas for later evaluation.

Each persona defines:

- role and organization type
- communication style
- technical level
- typical needs
- risk notes

These personas are fictional and contain no real identities.

### `synthetic-contexts.json`

Contains synthetic environment and use-case contexts for later evaluation.

Each context defines:

- industry and assistant role
- allowed and blocked tasks
- knowledge-source assumptions
- handoff and ticket policies
- synthetic data policies

These contexts are fictional and contain no real customer or authority data.

### `synthetic-test-cases.json`

Contains synthetic user prompts and expected Conversation Engine state expectations.

Each case defines:

- synthetic user utterance input
- expected intent, goal, stage, and agent selection
- expected next action
- expected missing fields
- expected response constraints
- guardrail expectations

These cases are designed for later controlled synthetic evaluation only.

### `synthetic-evaluation-rubric.md`

Defines the later scoring model for a synthetic evaluation run.

It does not execute any evaluation.

It only documents:

- scoring dimensions
- pass / partial / fail criteria
- critical failure conditions
- future execution prerequisites

## How These Assets Should Be Used Later

These assets may only be used later with a separate explicit execution approval.

Expected future task:

- `CONV-ENGINE-SYNTHETIC-EVAL-1`

Allowed future usage pattern:

1. explicit approval is granted for synthetic evaluation execution
2. execution scope remains synthetic-only
3. no customer data or production data is introduced
4. no side-effecting runtime path is enabled
5. evaluation outputs remain internal and synthetic-safe

Not allowed by this asset pack:

- automatic execution
- implicit approval for future execution
- runtime activation
- production-site use
- customer-facing use

## Scope Notes

The expected engine-state fields in these assets are evaluation-oriented abstractions for later review:

- `intent`
- `goal`
- `stage`
- `selectedAgentKey`
- `missingFields`
- `nextAction`
- `shouldHandoff`
- `expectedSourcesRequired`
- `mustNotAsk`
- `mustNotClaim`
- `handoffAllowed`
- `ticketAllowed`
- `confidenceExpectation`

Where later runtime structures differ, a future evaluation task must perform explicit field mapping rather than silently changing the synthetic assets.

## Stop Boundaries

This asset pack must not be treated as approval for:

- engine execution
- dry-run execution
- demo execution
- database access
- SQL
- query runner usage
- reports with data
- export execution
- JSON / CSV / ZIP export creation
- DSAR execution
- deletion, correction, or retention execution
- backup verification execution
- monitor or alert setup
- deploys
- screenshots
- recordings
- slide creation
- customer-data use
- production-data use
- production-secret use
- ticket, webhook, or email side effects
- human impersonation
- legal or DSGVO final-compliance claims

## Non-goals

- no engine runner integration
- no runtime test harness changes
- no API changes
- no dashboard changes
- no widget changes
- no workflow changes
- no `scripts/ops` changes
- no `scripts/security` changes
- no package or lockfile changes
- no SQL or migration artifacts
- no reports
- no exports
- no customer-facing collateral
