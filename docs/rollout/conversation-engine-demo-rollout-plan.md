# Conversation Engine Demo Rollout Plan

## Summary

This plan defines a controlled rollout for Conversation Engine admin-test features on exactly one internal demo site.

No runtime behavior changes are part of this plan. The public widget remains on the legacy chat pipeline. Feature flags must remain inactive until a separate execution step explicitly enables them for the approved demo site.

## Scope

The rollout scope is limited to admin/operator test features:

- AssistantProfile diagnostics
- Migration preview
- Conversation Engine preview
- Legacy compare
- Test cases
- Response preview
- Knowledge preview

The preferred target is:

- `tenantId`: `nolis-evaluation`
- `siteId`: `nolis-product-support-demo`

The site may only be used if at least one of these safety markers is present:

- `is_evaluation_demo=true`
- `environment=demo`, `environment=staging`, or `environment=test`
- `internalTestSite=true`
- a domain containing `demo`, `staging`, or `test`

## Non-goals

This rollout must not enable or perform:

- Conversation Engine behavior in the public widget
- automatic AssistantProfile migration
- production lead, ticket, email, webhook, or integration actions from preview mode
- automatic ingestion
- test cases on productive customer sites
- Knowledge Preview for public users
- production feature flags
- production customer-site configuration changes

## Target Demo Site

Use only the approved internal demo site:

```text
tenantId=nolis-evaluation
siteId=nolis-product-support-demo
```

Do not use:

- a productive customer site
- a production domain without a demo marker
- a site with real customer interactions
- a site where feature flags would affect public users

Before activation, confirm the target site is isolated and explicitly marked as demo, staging, test, or internal.

## Feature Flags

The relevant flags are:

```text
conversationEngine.previewEnabled
conversationEngine.compareEnabled
conversationEngine.responsePreviewEnabled
conversationEngine.knowledgePreviewEnabled
conversationEngine.adminTestOnly
```

For the approved demo site only, the intended test-mode values are:

```text
previewEnabled=true
compareEnabled=true
responsePreviewEnabled=true
knowledgePreviewEnabled=true
adminTestOnly=true
```

Storage location:

```text
site_modules.config.conversation-engine-tests
```

These flags must not be enabled on other sites.

## Preconditions

Before rollout execution:

- Production health is green.
- Demo health is green.
- Main commit is known and verified.
- Feature flags are currently inactive.
- The demo site is clearly internal or demo-only.
- Admin/operator access is available.
- Customer and anonymous access to admin-test features is blocked.
- Public widget legacy smoke is green.
- No generated reports, environment files, backups, or operational data are staged.

## Rollout Stages

### Stage 0: Preflight

Confirm:

- Production health is green.
- Demo health is green.
- Main commit is correct.
- Feature flags are currently inactive.
- The demo site is internal/demo/test/staging.
- Admin/operator access is available.
- Customer and public access is blocked.
- Public widget legacy smoke is green.

Stop if any condition is unclear.

### Stage 1: Enable Admin Test Flags On Demo Site

Enable only for the target demo site:

```text
previewEnabled=true
compareEnabled=true
responsePreviewEnabled=true
knowledgePreviewEnabled=true
adminTestOnly=true
```

Do not enable:

- flags on other sites
- production flags
- public widget live engine behavior
- AssistantProfile migration

### Stage 2: Execute Test Cases

Run the approved starter test cases with:

```text
includeResponsePreview=true
includeKnowledge=true
```

Review these metrics:

- `totalCases`
- `aligned`
- `partial`
- `conflict`
- `unknown`
- `intentAccuracy`
- `goalAccuracy`
- `agentAccuracy`
- `responseQualitySummary`
- `knowledgeSummary`

Expected results:

- `conflict=0`
- `unknown=0`
- `retrievalError=0`
- no risky responses
- no cross-tenant snippets

### Stage 3: Manual Admin UI Validation

With an admin/operator user, confirm:

- KI-Mitarbeiter profile card loads.
- Migration preview loads.
- Conversation Engine preview works.
- Legacy compare works.
- Response preview works.
- Knowledge preview shows sources and grounding.
- Test cases show quality and knowledge summaries.

With customer and anonymous access, confirm:

- admin-test cards are not visible.
- protected proxies return `403` for customer access.
- protected proxies return `401` for anonymous access.

### Stage 4: Public Widget Safety

On the same demo site, confirm:

- Widget loader returns HTTP 200.
- Widget config returns HTTP 200.
- Widget chat returns HTTP 200 or 201.
- Legacy pipeline remains active.
- Public responses contain none of these fields:
  - `assistantProfileDebug`
  - `conversationEnginePreview`
  - `compare`
  - `engineResponsePreview`
  - `responseQuality`
  - `knowledgeRetrieval`
  - `usedKnowledgeSources`
  - `groundingStatus`

### Stage 5: Monitoring

Monitor for 24 hours after activation.

Track:

- API errors
- Dashboard errors
- Widget errors
- Queue errors
- provider errors
- database errors
- auth/security errors
- AssistantProfile logging volume
- Knowledge Retrieval errors
- unexpected side effects

## Validation Checklist

- Target site is explicitly internal/demo/test/staging.
- Flags are enabled only on the target demo site.
- Admin/operator can use all test cards.
- Customer users cannot see admin-test cards.
- Anonymous users cannot access admin-test routes.
- Public widget stays on the legacy pipeline.
- Public widget responses contain no debug, preview, compare, quality, grounding, or knowledge fields.
- Test cases complete with `conflict=0`.
- Test cases complete with `unknown=0`, or every unknown result is justified.
- Response quality has no risky result.
- Knowledge retrieval has `retrievalError=0`.
- Knowledge Preview returns no cross-tenant snippets.
- No ingestion is triggered.
- No documents or chunks are written.
- No leads, tickets, emails, webhooks, or integrations are triggered by preview or compare mode.

## Stop Criteria

Stop or roll back if any of these occur:

- Public widget shows debug, preview, compare, quality, grounding, or knowledge fields.
- Customer users see admin-test cards.
- Anonymous users can access admin or dashboard proxy routes.
- Cross-tenant snippets are detected.
- Knowledge Retrieval creates writes.
- Ingestion is triggered.
- Leads, tickets, emails, or webhooks are created by preview mode.
- `conflict > 0`.
- `unknown` is unexpectedly high.
- `retrievalError > 0`.
- risky responses are generated.
- API 500 errors increase.
- provider errors increase.
- database errors occur.
- feature flags are accidentally enabled on production customer sites.

## Rollback Plan

Rollback must not require a code deploy.

For the target demo site, disable:

```text
previewEnabled=false
compareEnabled=false
responsePreviewEnabled=false
knowledgePreviewEnabled=false
adminTestOnly=false
```

Alternatively, remove the `conversation-engine-tests` module config for the demo site if that is the safer operational path.

Affected storage:

```text
site_modules.config.conversation-engine-tests
```

No AssistantProfile rollback is needed if AssistantProfile migration was not executed.

After rollback:

- confirm all flags are false or absent.
- confirm public widget remains legacy.
- confirm admin-test routes no longer expose preview output for the site.
- ignore or remove stale `lastRunResult` test output if it creates dashboard confusion.
- run health and security checks again.

## Monitoring

Minimum monitoring window: 24 hours.

Monitor:

- API health
- dashboard health
- widget health
- job health
- queue health
- database health
- provider errors
- auth/security errors
- AssistantProfile logging volume
- Knowledge Preview retrieval status
- unexpected side effects in leads, tickets, jobs, documents, chunks, and ingestion records

Use sanitized logs only. Do not include secrets, full emails, phone numbers, access tokens, or user-provided personal data in monitoring evidence.

## Success Criteria

The demo rollout is successful when:

- admin/operator test features work on the target demo site.
- customer and anonymous access is blocked.
- public widget remains legacy.
- public responses expose no debug, preview, compare, quality, grounding, or knowledge fields.
- test cases complete with `conflict=0`.
- test cases complete with `unknown=0`, or unknown results are justified.
- response quality has no risky result.
- Knowledge Retrieval has no errors.
- no cross-tenant snippets are returned.
- no ingestion occurs.
- no document or chunk writes occur.
- no leads, tickets, emails, webhooks, or integrations are triggered by preview mode.
- 24-hour monitoring shows no critical errors.

## Next Steps

1. Run a read-only preflight against the target demo site.
2. Prepare an execution prompt that enables flags only for `nolis-evaluation / nolis-product-support-demo`.
3. Run test cases with response and knowledge preview enabled.
4. Validate admin UI, public widget safety, side effects, and logs.
5. Decide whether to keep the demo flags active for continued internal review or roll them back.
