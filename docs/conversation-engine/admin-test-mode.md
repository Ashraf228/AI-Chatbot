# Conversation Engine Admin Test Mode

## Overview

The Conversation Engine is currently an admin/operator test and diagnostics layer. It is not the live decision engine for the public widget.

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

These flags must only be enabled for explicit admin/operator test scenarios. They must not be enabled automatically for production sites.

## Access Model

Conversation Engine test features are dashboard-only features for admin/operator roles.

They are not exposed through public widget responses. Customer users, anonymous users, and public widget sessions must not receive diagnostics, compare results, response previews, knowledge snippets, quality scores, or internal AssistantProfile details.

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
- Admin test UI is gated to admin/operator roles.
- Tenant and site scoping are enforced server-side.
- Knowledge Preview retrieval is read-only.
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

- Admin/operator can access the test cards.
- Customer and anonymous users cannot access admin test features.
- Public widget config contains no preview/debug fields.
- Public widget chat response contains no preview/debug/knowledge fields.
- `conversationEngine.knowledgePreviewEnabled` is inactive by default.
- Knowledge Preview uses tenant/site-scoped retrieval.
- No ingestion or document/chunk writes occur during preview.
- Generated reports are not tracked by git.
