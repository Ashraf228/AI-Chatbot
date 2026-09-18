# Conversation Engine Admin Test Mode

## Overview

The Conversation Engine is currently an internal test and diagnostics layer. It is not the live decision engine for the public widget. General diagnostics remain admin/operator-only; an explicitly assigned individual customer employee can use only the bounded Demo Workspace actions described below.

The public widget continues to use the legacy chat pipeline. Conversation Engine features are intended for controlled review, comparison, response preview, and quality checks inside the dashboard.

All Conversation Engine test features are feature-flag protected and default to inactive.

## Feature Flags

The relevant site-scoped flags are:

```text
conversationEngine.previewEnabled
conversationEngine.compareEnabled
conversationEngine.responsePreviewEnabled
conversationEngine.knowledgePreviewEnabled
conversationEngine.adminTestOnly
```

Expected defaults:

- `previewEnabled`: `false`
- `compareEnabled`: `false`
- `responsePreviewEnabled`: `false`
- `knowledgePreviewEnabled`: `false`
- `adminTestOnly`: `true` when test mode is enabled

These flags must only be enabled for explicit internal test scenarios. They must not be enabled automatically for production sites.

## Access Model

Conversation Engine test features are dashboard-only. General diagnostics, compare, response preview, stored test cases, and internal AssistantProfile details remain restricted to admin/operator roles.

An individual non-viewer `tenant_users` account may additionally receive the persisted `customerWorkspaceOperatorV1` capability with an exact non-empty `siteIds` list. On every bounded request the API verifies the signed customer session, active account, current role, account expiry, persisted capability, and same-tenant site membership. The capability permits only:

- `GET /admin/sites/:siteId/conversation-engine/demo-workspace/access`
- `GET/PUT/DELETE /admin/sites/:siteId/conversation-engine/demo-workspace/config`
- `POST /admin/sites/:siteId/conversation-engine/knowledge/pdf-extract`
- `POST /admin/sites/:siteId/conversation-engine/runtime-pilot`

Only platform admins may grant or revoke it through `PUT/DELETE /admin/tenant-users/:id/customer-workspace-access`. Revocation or account deactivation takes effect on the next API authorization check. The capability is stored in existing tenant-user metadata, so rollback is removal of that single key; no schema migration is involved. It does not grant access to any other operator endpoint and does not replace query-embedding, LLM-generation, ingestion, or provider grants.

The customer runtime-pilot response sets `assistantProfileDebug` to `null` and does not resolve internal diagnostics. Customer requests containing `websiteAnswerRuntimeGateInput` or `websiteAnswerRuntimePilotInput` are rejected before pilot execution; those admin/operator-only inputs cannot introduce a tenant, site, source, or provider context into the bounded customer path.

The shared dashboard operator session has no individual tenant/site assignment and gains no new rights from this capability. Viewer, anonymous, and public widget sessions remain excluded. No public widget response may expose diagnostics, compare results, response previews, knowledge snippets, quality scores, or internal AssistantProfile details.

## AssistantProfile Diagnostics

AssistantProfile diagnostics show which normalized profile is resolved from the current site and module configuration.

Typical use:

- Confirm whether a legacy site maps to the expected AssistantProfile.
- Check which source was used, such as stored profile, intake flow, conversation flow, or legacy `botType`/`industry` mapping.
- Review required fields, enabled tasks, enabled agents, handoff rules, and delivery channel status.

Diagnostics must not expose full delivery addresses, secrets, phone numbers, full visitor messages, or private tokens.

## Migration Preview And Save

Migration preview shows how existing legacy configuration would map into a neutral AssistantProfile.

Important constraints:

- Preview is read-only.
- Saving a profile is explicit opt-in.
- Legacy fields remain preserved.
- Saving an AssistantProfile does not switch the public widget to the Conversation Engine.
- No automatic AssistantProfile migration should run on production sites.

## Legacy Compare

Legacy Compare is an admin dry-run comparison between:

- the current legacy behavior estimate, and
- the Conversation Engine decision preview.

It is a diagnostic aid, not a byte-identical replay of the live production pipeline.

Use it to identify mismatches such as:

- legacy lead-flow behavior where the engine sees a knowledge question,
- missing required fields,
- conflicting intent or goal decisions,
- unexpected local-service bias,
- low-confidence engine decisions.

No leads, tickets, emails, webhooks, integrations, or public widget state changes should be created by compare mode.

## Response Preview

Response Preview simulates what the Conversation Engine would answer for a test message.

It can show:

- detected intent and goal,
- selected agent,
- next action,
- missing required fields,
- draft response,
- handoff recommendation,
- quality status,
- quality findings, risks, and recommendations.

Response Preview is admin/operator-only and does not change live chat behavior.

## Knowledge Preview

Knowledge Preview adds read-only knowledge retrieval to Response Preview.

It can show:

- whether knowledge retrieval was attempted,
- retrieval status,
- grounding status,
- sanitized knowledge source titles,
- sanitized excerpts,
- quality risks related to unsupported source claims.

Knowledge Preview is read-only. It must not trigger ingestion, document creation, chunk creation, or knowledge-source writes.

Embedding retrieval uses the same server-side `site_runtime/query_embedding`
contract as other runtime queries. The checked site tenant, exact site, active
`runtime_readiness = 'ready'` source state, deployment environment, provider and
model must match one current persisted grant. Admin or operator access enables
the preview UI only; it never substitutes for that provider grant. Missing,
expired, revoked, ambiguous or malformed grants and lookup failures return the
existing sanitized preview error without starting provider transport.

The shared query embedding transport is fixed to the expected HTTPS embedding
endpoint, disables SDK retries and SDK logging, and rejects redirects. The grant
is evaluated at the transport boundary for every caller attempt. No grant is
created or broadened by preview execution.

The expected grounding states are:

- `grounded`: response draft uses concrete snippets.
- `partially_grounded`: snippets exist but the draft may need review.
- `ungrounded`: knowledge was needed but no suitable snippet supported the draft.
- `not_required`: the test case did not require knowledge retrieval.

## Evaluation Runner

The evaluation runner can execute stored admin test cases and produce local reports.

Generated reports must not be committed. Reports under the generated evaluation report directory are operational artifacts and should remain ignored by git.

Use dry-run mode before any stateful internal demo run.

## Safety Boundaries

The following must remain true unless a separate rollout plan explicitly changes them:

- Public widget remains on the legacy chat pipeline.
- Public widget responses contain no debug, preview, compare, quality, grounding, or knowledge preview fields.
- Feature flags default inactive.
- General admin test UI is gated to admin/operator roles; only the bounded Demo Workspace surface may be shown to an individually capability-assigned customer.
- Tenant and site scoping are enforced server-side.
- Knowledge Preview retrieval is read-only.
- Knowledge Preview provider transport requires an exact persisted query-embedding grant.
- No ingestion is triggered by preview mode.
- No leads, tickets, emails, webhooks, or integrations are triggered by preview or compare mode.
- AssistantProfile migration remains explicit and reversible.

## Production Rollout Rules

Before any staging or production rollout:

- Confirm main CI is green.
- Confirm authorization matrix and security boundary tests pass.
- Validate on one isolated internal demo/staging site first.
- Keep `adminTestOnly=true`.
- Do not enable public widget Conversation Engine behavior.
- Do not enable Knowledge Preview on production customer sites without an explicit rollout decision.
- Confirm no generated reports, secrets, `.env` files, backups, or operational data are committed.

## Quick Verification Checklist

- Admin/operator can access the existing test cards subject to their existing scope rules.
- A capability-assigned customer can access only the Demo Workspace card and internal testchat for an exact assigned site.
- Other customer, viewer, shared-operator, and anonymous sessions cannot use the bounded customer workspace path.
- Public widget config contains no preview/debug fields.
- Public widget chat response contains no preview/debug/knowledge fields.
- `conversationEngine.knowledgePreviewEnabled` is inactive by default.
- Knowledge Preview uses tenant/site-scoped retrieval.
- No ingestion or document/chunk writes occur during preview.
- Generated reports are not tracked by git.
