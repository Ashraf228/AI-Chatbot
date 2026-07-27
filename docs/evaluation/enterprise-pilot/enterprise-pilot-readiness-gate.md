# Enterprise Pilot Readiness Gate

## Summary

This document records the current pilot and demo readiness state after the completed Enterprise Agent Workspace / Pilot Workspace productization.

Purpose:

- make the current pilot/demo boundary explicit
- decide what is allowed now for internal and guided external demos
- define what remains conditional
- define what remains blocked
- keep the current security caveats visible
- point to the next required gates before any real-customer pilot

This is not a production go-live document.
This does not approve customer data use.
This does not approve production data use.
This does not approve deploys.
This does not approve public widget activation.

## Current State After Enterprise Agent Workspace Productization

The current baseline includes:

- Enterprise Agent Workspace / Pilot Workspace
- agent configuration
- config save/load/reset
- in-memory test chat
- text, Markdown, and JSON knowledge snippets
- PDF demo knowledge upload
- boundary card / safety panels
- pilot guide and structured test hints

The current workspace remains intentionally limited:

- no public widget activation
- no deploy
- no customer data
- no production data
- no production secrets
- no knowledge persistence
- no PDF content persistence
- no chat-history persistence

## Readiness Decision Summary

- `enterprise_agent_workspace_available: yes`
- `guided_internal_demo: allowed`
- `guided_customer_demo_without_customer_data: allowed_with_caveats`
- `nolis_guided_demo_candidate: allowed_with_caveats`
- `self_serve_customer_demo: conditional_requires_operator_guidance`
- `real_customer_pilot: blocked`
- `customer_data_use: no`
- `production_data_use: no`
- `public_widget_activation: no`
- `deploy_approval: no`
- `enterprise_rollout: no`
- `DB_READ_ONLY_AUDIT: not_granted`
- `query_runner: not_granted`
- `reports_with_real_data: not_granted`
- `knowledge_persistence: not_granted`
- `pdf_content_persistence: not_granted`
- `chat_history_persistence: not_granted`
- `monitor_alert_setup: not_granted`
- `backup_verification_execution: not_granted`
- `DSAR_execution: not_granted`

## What Is Ready Now

- Enterprise Agent Workspace / Pilot Workspace
- agent configuration
- config save/load/reset
- test chat
- knowledge snippets
- PDF demo knowledge
- pilot guide
- boundary panels

## What Is Allowed Now

- internal demo
- guided external demo without customer data
- synthetic or explicitly approved demo content
- NOLIS-like product-support demo flow with synthetic information
- feedback collection
- conversation-logic evaluation
- UX and workflow evaluation

## What Is Conditional

- self-serve customer evaluation only with operator guidance and test instructions
- external demo only if the mandatory caveats are stated first
- performance discussion only as observation, not as a final benchmark
- pilot preparation without customer data
- knowledge persistence only through a separate gate

## What Remains Blocked

- deploy
- public widget activation
- production runtime activation
- real customer data
- real tickets, emails, or webhooks
- `DB_READ_ONLY_AUDIT`
- query runner
- reports with real data
- production secrets
- knowledge/PDF/chat-history persistence
- enterprise go-live
- final DSGVO/compliance approval

## Caveats Required Before Any External Demo

- The demo is not production.
- No customer data may be used.
- No confidential documents may be uploaded.
- No production data may be used.
- No real ticket, email, or webhook execution occurs.
- No public widget is activated.
- No deploy is performed.
- Response speed and conversation logic are still being optimized.
- This gate does not grant enterprise approval, production approval, or customer-data approval.

## Security / Dependency Caveat

- `production-context audit`: PASS
- root/dashboard PostCSS is technically fixed on `8.5.23`
- Next-internal PostCSS remains `accepted temporarily, not fixed`
- expiry: `2026-08-20`
- no deploy approval follows from this exception
- no enterprise approval follows from this exception
- no customer-data approval follows from this exception
- stable Next watch remains required

## Pilot Decision

- Go for guided customer/evaluator demo without customer data.
- No-go for real-customer pilot with customer data.
- No-go for deploy or public widget activation.

## Missing Gates Before Real Customer Pilot

- customer-data approval
- deploy approval
- public widget activation approval
- monitoring and alert setup execution approval
- backup verification execution approval
- DSAR execution approval
- knowledge/PDF/chat persistence approval
- final DSGVO/compliance approval
- stable Next/PostCSS fix or revalidated exception state

## Recommended Next Gate

Immediate review/merge gate:

- `ENT-PILOT-READINESS-GATE-1-D`

After merge:

- `ENT-PILOT-READINESS-GATE-1-E`

Then:

- `NOLIS-GUIDED-DEMO-PACK-1`
- or `DEMO-WORKSPACE-KNOWLEDGE-PERSISTENCE-1`
- or `REAL-CUSTOMER-PILOT-APPROVAL-GATE-1`
