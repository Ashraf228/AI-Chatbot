# Conversation Engine Demo Monitoring

## Summary

- 24h+ Demo-Monitoring successfully completed.
- Demo flags remain intentionally active on the internal demo site.
- No rollback is required.
- Production remained unchanged.
- Public Widget remained on the legacy chat pipeline.
- The monitoring automation `16d-nolis-demo-monitoring-checkpoints` was removed after completion.

## Scope

- Internal demo site:
  - `tenantId`: `nolis-evaluation`
  - `siteId`: `nolis-product-support-demo`
- Demo commit: `98271f02fbf5341f1a313b4eee183c9fd59b1b7c`
- Production runtime commit: `94083ba22010653278f87d0d0524e57f713c87ce`
- Admin/operator test mode only.
- No productive customer site.
- No public-widget Conversation Engine activation.

## Active Demo Flags

Enabled only on the internal demo site:

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

## Production Safety

- Production Feature Flags: `0` active.
- No `conversation-engine-tests` module configuration on Production.
- No AssistantProfile auto-migration.
- No Production config change.
- Public Widget stayed on the legacy pipeline.
- No Production rollout is approved by this monitoring result.

## Monitoring Results

- Demo Health: continuously healthy.
- Production Health: continuously healthy.
- Public Widget Safety: passed.
- Admin/Security: passed.
- Logs: no critical signals.
- Side Effects: no leads, jobs, tickets, emails, webhooks, or integrations from preview/test mode.
- Knowledge: stable, no ingestion.
- Documents/Chunks: no new writes during monitoring.

## Testcase Metrics

- `totalCases`: `8`
- `aligned`: `2`
- `partial`: `6`
- `conflict`: `0`
- `unknown`: `0`
- intent accuracy: `100%`
- goal accuracy: `100%`
- agent accuracy: `100%`
- `risky`: `0`
- `retrievalError`: `0`
- `responseQuality`: `8/8 good`
- average score: `100`
- `knowledgeSummary`: no retrieval errors

## Data / Side Effects

- Demo Leads: `0`
- Demo `email_jobs`: `0`
- Demo `webhook_jobs`: `0`
- Demo Tickets: `0`
- Demo Conversations: `6` existing demo/test conversations.
- Demo Knowledge: `84` documents, `84` chunks.
- Ingestion: no.
- `evaluation_ticket_previews`: `0`

## Known Notes

- `partial=6/8` is accepted because `conflict=0`, `unknown=0`, `risky=0`, and `retrievalError=0`.
- Partial results come from legacy/compare heuristics and are not a Public Widget risk.
- Legacy compare remains an admin-test dry run and is not byte-identical to the live pipeline.
- Demo flags remain active only on the internal demo site.

## Stop Criteria

Stop and roll back the demo flags if any of these occur:

- Public Widget shows debug, preview, compare, quality, grounding, or knowledge fields.
- Public Widget uses the Conversation Engine live.
- Customer or anonymous users can access admin-test features.
- Cross-tenant snippets appear.
- Ingestion is triggered.
- New documents or chunks are written.
- Leads, tickets, emails, webhooks, or integrations are created by preview/test mode.
- `conflict > 0`.
- `risky > 0`.
- `retrievalError > 0`.
- Production flags become active.
- Critical logs, HTTP 500 errors, or provider errors appear.

## Rollback Plan

If the internal demo site shows any stop criterion, disable these flags:

```text
previewEnabled=false
compareEnabled=false
responsePreviewEnabled=false
knowledgePreviewEnabled=false
adminTestOnly=false
```

Storage location:

```text
site_modules.config.conversation-engine-tests
```

Notes:

- No code rollback is required.
- No Production rollback is required.
- Public Widget remains legacy.
- No AssistantProfile migration was executed.

## Decision

- Demo flags remain active.
- No rollback.
- No fix required.
- No Production rollout approved.

## Next Steps

1. Continue using the demo as an internal test environment.
2. Do not set Production flags without a separate approval process.
3. Optionally improve compare/partial explanation logic later.
4. If further rollout is desired, create a separate staging or pilot plan.
5. Before any Production pilot, define scope, rollback, monitoring, and Public Widget safety checks again.
