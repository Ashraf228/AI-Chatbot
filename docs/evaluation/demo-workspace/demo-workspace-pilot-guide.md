# Demo Workspace Pilot Guide

## Summary

This guide supports a structured evaluation of the Demo Workspace.

The Demo Workspace is an admin/operator-only evaluation surface for reviewing:

- agent configuration
- saved demo configuration
- in-memory knowledge snippets
- in-memory PDF demo knowledge
- test chat behavior
- runtime pilot state and safety boundaries

It is not a production system, not a public widget flow, and not a go-live approval.

## Who This Guide Is For

- evaluators
- technical contacts supporting the evaluation
- decision-makers reviewing product flow and safety boundaries

This guide is not intended for public end users and does not describe a public-widget workflow.

## Before You Start

- Use only synthetic or explicitly approved demo content.
- Do not use real customer data.
- Do not use production data.
- Do not paste passwords, tokens, API keys, or secrets.
- Do not upload confidential documents.
- Do not treat this demo as a production go-live.

## What You Can Test

- agent configuration
- saving and loading the agent configuration
- the test chat
- text, Markdown, and JSON knowledge snippets
- PDF demo knowledge upload
- engine state, intent, goal, selected agent, and next action
- missing fields behavior
- handoff simulation
- safety boundaries and blocked requests

## What You Should Not Test

- real customer data
- production data
- real credentials
- real tickets
- real emails
- real webhooks
- public widget behavior
- deploy or go-live actions
- real integrations into production systems
- final performance benchmarking claims

## Recommended 15-Minute Walkthrough

1. Open the Demo Workspace in the dashboard.
2. Fill in the basic agent fields:
   - assistant name
   - company context
   - assistant role
   - target audience
   - tone
3. Define allowed and blocked tasks.
4. Save the demo configuration.
5. Send a first test message in the test chat.
6. Add a small text or Markdown knowledge snippet.
7. Add a synthetic demo PDF.
8. Ask a follow-up question that should use the added knowledge.
9. Inspect engine state, response draft, missing fields, and next action.
10. Review the boundaries:
    - no deploy
    - no public widget activation
    - no customer data
    - no production data

## Recommended 30-Minute Evaluation

1. Configure a company-specific demo assistant with a short company context.
2. Adjust tasks and blocked actions to shape the assistant behavior.
3. Save the configuration, reload it, and confirm that only the agent configuration returns.
4. Run a normal company-information question.
5. Run a support question.
6. Add a text/Markdown/JSON snippet and test whether the chat uses it.
7. Add a synthetic PDF and test whether the response reflects the extracted content.
8. Trigger a handoff-style request and confirm that only simulation happens.
9. Trigger a complaint/support escalation and confirm that no real email or ticket is sent.
10. Trigger a privacy or production-data request and confirm that the response stays safe.
11. Reset the saved configuration and confirm that:
    - only the saved demo config is removed
    - chat history does not come back
    - knowledge snippets and PDFs are not restored from persistence

## What To Look At During Testing

- Is the company context reflected in the answer?
- Is the selected agent plausible?
- Is the next action understandable?
- Are missing fields requested when necessary?
- Does handoff remain simulated?
- Does the answer use the snippet or PDF content when relevant?
- Does the system reject unsafe or out-of-scope requests?
- Does save/load/reset behave only on agent configuration?

## Known Limitations

- No deploy.
- No public-widget activation.
- No production activation.
- Knowledge, PDFs, and chat history are not stored permanently.
- Agent configuration can be stored.
- `PASS_WITH_PARTIALS` remains a caveat from synthetic evaluation follow-up work.
- Response speed and conversation-engine behavior are still being optimized.
- The demo is intended for structured evaluation, not final load or performance judgment.

## Performance Note

The demo environment is not intended to be treated as the final performance-benchmarking environment.

Current observations are most useful for:

- feature flow
- conversation logic
- safety boundaries
- handoff and missing-field behavior

Response speed and conversation quality are still being improved.

## Recommended Feedback Format

When sharing feedback, include:

- what was tested
- which input was used
- what response was expected
- what response actually happened
- whether knowledge was relevant
- whether handoff behavior was correct
- whether the answer felt too slow

Do not send real customer data, real credentials, or confidential documents with feedback.

Screenshots are optional and should only be created if separately approved and fully sanitized.

## Next Steps After Evaluation

- guided review discussion
- feedback triage
- prioritization of the next pilot function
- only then: separate decisions about later technical approvals

## Scope Reminder

This guide does not claim:

- production readiness
- enterprise approval
- customer-data approval
- public-widget readiness
- deploy approval

It is a structured pilot/evaluation guide only.
