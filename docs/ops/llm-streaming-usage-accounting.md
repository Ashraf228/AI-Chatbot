# LLM usage accounting — Phase 6 runtime integration

Task: `ENTERPRISE_DEMO_PHASE_6_LLM_USAGE_RUNTIME_1`.
Integration base: `1a3e542e6d972a318388a8482882adcd222df6de`.
Source package: `LLM_STREAMING_USAGE_ACCOUNTING_1`, exported from local commit
`fd60ed429956dd6c1ae0b64bc4e99640ee12e44d`; original package base
`c02b5012535a08d3bb16a9fa2cfdb53724e984b2`.

Phase 5 already integrated migration 034 and its schema checks. This Phase 6
split integrates only usage runtime, existing admin dashboard, tests, and docs.
The Phase 1 DELETE fix, Phase 3 ingestion-grant negative regression and PostgreSQL
cleanup fix remain preserved. No deployment, provider call, operational migration,
provisioning, new pricing, or budget rule is authorized by this code integration.
A new independent review of this derived split is required before Ready/Merge;
the original package review is retained as historical evidence.

## Baseline audit and final path matrix

Baseline references below are to the original package base, not the split baseline. `LlmService.answer` used
`res.usage || { ...0 }` at lines 78–89. `streamAnswer` neither requested usage nor
examined usage-only chunks and returned zeros at lines 130–134. The pipeline
wrote `usage_events` and incremented `usage_daily` separately at lines 806–827,
using a new random event ID on each persistence pass (lines 859–878). Exceptions
before a successful response never reached usage storage.

| Provider call / entry | Usage reception | Assignment | Persistence | Evaluation / baseline classification |
| --- | --- | --- | --- | --- |
| Pipeline.process → LlmService.answer | Normal SDK completion usage | Server UUID per invocation; normalized tenant/site and pipeline conversation/session | One call event plus atomic token aggregate | Baseline successful values existed; missing-as-zero and retryable persistence were actual gaps |
| Pipeline.stream → LlmService.streamAnswer | `stream_options.include_usage=true`; inspect usage even with empty choices/text | Same per-call rule; request-local AsyncLocalStorage transport-start marker | Exactly one finalization after success, error or caller abort if HTTP transport started | Baseline always-zero was an actual implementation gap |
| Widget stream → pipeline → SDK | Response close/request aborted → AbortSignal | No new public identity or diagnostics | Retain measurement received before abort; unknown remains explicit | Baseline had no propagated cancellation; now no continued generation to obtain usage |
| Grant/config/pre-aborted rejection | No provider transport, no provider usage | No provider event | No synthetic zero-consumption event | Distinct from a started request with missing usage |
| Rule-based/agent fallback | No LLM call | Existing response/conversation assignment | Existing legacy event/message counters | No new LLM consumption; not retroactively declared provider-confirmed |
| UsageController → existing dashboard usage page | Confirmed call events; missing/incomplete call count; legacy-event count | Existing admin-only route, same parameterized tenant/site filters | Read-only event aggregation | Baseline endpoint returned request counts and flat request estimate; UI expected token fields not supplied. Additive `llm_usage` object closes measurement display gap |
| BusinessAnalyticsService.averageLatency | Existing event latency | Existing authorized site set | Same usage_events table | Includes newly observable failed calls; no token or price calculation |
| UsageLimitService | Existing successful-response request/message counters | Existing tenant-scoped query | Existing usage_daily counters unchanged | Monthly-message budget behavior unchanged |
| Reporter | No usage_events/usage_daily/token consumer found | Not applicable | Unchanged | No reporter implementation change needed |
| Query/ingestion embeddings | Separate existing provider paths | Existing separate grants | No LLM usage events | Unchanged; embedding tokens excluded from LLM accounting |

## Measurement contract

- `usage_events.id` is the server-generated UUID of one actual LLM invocation.
  A new actual call gets a new ID, including multiple calls in one conversation.
  The transport-start marker is scoped with AsyncLocalStorage so concurrent calls
  cannot misattribute each other's transport.
- `usage_status=confirmed`: provider supplied nonnegative integral input/output/total
  values, representable by existing integer columns, and input + output = total.
  A provider-confirmed zero is valid. No local tokenization or estimated token counts.
- `missing`: no usage object received; all three values and estimated cost are NULL.
- `incomplete`: some fields invalid/missing or inconsistent totals. Individually
  supplied valid values remain available in the event, but none enter confirmed
  aggregates and estimated cost is NULL.
- `legacy`: pre-existing records and unchanged rule-based response records have no
  new measurement proof. Historical zero values are never backfilled as confirmed.
- `call_outcome` is independently `success`, `error` or `aborted`. A call may have
  confirmed usage before a later delivery/stream failure. Provider-confirmed values
  then remain confirmed; outcome does not erase actual consumption.
- Stream usage is a snapshot for the entire call, not a delta. Repeated snapshots
  replace the in-memory snapshot; only one final snapshot is persisted. Detail
  categories such as cached/reasoning/audio tokens are already included in totals
  and are not added again.
- Identity, usage status, provider and outcome are internal. Neither prompts,
  responses, credentials nor SDK errors are included in usage metadata/logging.
  A storage failure logs only the generated call ID and a fixed event name.

The installed OpenAI SDK is 6.34.0. Its
`resources/chat/completions/completions.d.ts` documents `include_usage`, empty
choices in the final usage event, and possible loss of this event on interruption.
`core/streaming.js` can quietly end iteration on AbortError; the explicit post-loop
signal check prevents classifying that as success. Official reference:
https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events

## Persistence, failure and budgets

`persistLlmUsage` uses the real existing DatabaseService transaction wrapper.
It validates conversation/session against tenant/site and locks conversation/site
membership, then inserts the event with `ON CONFLICT (id) DO NOTHING RETURNING id`.
Only a newly inserted event changes the daily token aggregate. Event plus aggregate
commit together; failure rolls both back. Reprocessing the same measurement cannot
add its tokens again, including concurrent processing.

Missing/incomplete calls create a zero-increment daily row so days containing only
unmeasured attempts remain visible in the existing daily view. This row is not
proof of zero consumption: the event and `llm_usage` status counters are authoritative.
Historical daily totals are not reinterpreted as fully measured provider usage.

Successful-response message/request counters retain the existing separate pipeline
update. A provider-recorded response does not create a second legacy usage event or
add tokens/cost a second time. Failed or aborted calls do not add successful-message
budget counters. No new budget rule, pricing rule or billing mechanism is introduced.
The existing per-model cost estimator is retained for confirmed calls only. The
admin endpoint's old flat per-request estimate remains unchanged and is labeled
as a flat request estimate on the existing page.

On successful generation, accounting failure still prevents successful response
completion as in the baseline. Public storage errors are now fixed/generic.
On a failed/aborted provider call, recording is attempted once; if recording also
fails, the original failure remains primary and a fixed storage-failure event is
logged. This does not continue generation or retry the provider. A process crash or
unavailable storage can still lose an unfinalized measurement; this package is not
a durable outbox or provider-side reconciliation system. No exactly-once guarantee
across a crash before durable event insertion is claimed.

Grant, maxRetries=0, endpoint/redirect restrictions and logLevel=off remain effective.
Aborted calls are not restarted to obtain a final usage event.

## Additive API and internal contracts

The public widget event and response shapes are unchanged. AbortSignal is an
internal optional pipeline/LLM argument. Internal LLM usage now has nullable token
fields and a measurement status; it is never serialized to the public widget.

Existing admin-only `/admin/usage` and `/admin/usage/summary` responses gain the
additive `llm_usage` object:
`confirmed_calls`, `unmeasured_calls`, `legacy_events`, `input_tokens`,
`output_tokens`, `total_tokens`. Token sums include confirmed events only and are
NULL if there are none. Existing fields and their per-request cost interpretation
remain unchanged. Tenant/site predicates apply equally to daily data and new event
aggregates. Dashboard proxy and API guards/roles remain unchanged; admins retain
existing cross-tenant privileges, no additional customer access is introduced.

## Migration audit, upgrade and rollback plan

Migration `034_llm_usage_measurement.sql` reuses existing tables. It adds status,
provider and outcome columns and relaxes token/cost NOT NULL constraints to represent
unknown values. A check constraint validates new record forms without changing old
rows; existing writers continue to use `legacy` defaults. No data backfill, new grant,
new table, scope widening, destructive data operation or operational migration.

The schema is integrated in Git, not proven applied to any target database.
See `docs/ops/llm-usage-measurement-migration.md` for the separate Phase 5 schema
contract. For later authorized rollout, verify/apply 034 before deploying
new writers/readers; baseline writers can coexist. The isolated test applies the
actual initial usage schema and migration twice, preserving legacy records and old
writer behavior. Migrations 002–033 do not change these usage columns; their grant
contracts are not retested or altered here.

Code rollback can retain the additive schema and measurement data. Reinstating
NOT NULL or dropping metadata is not an automatic rollback: it would lose or obscure
unknown-usage evidence. The test explicitly confirms that NOT NULL restoration fails
while unknown records exist. Any schema rollback requires a separate approved
preservation/archive plan; never convert missing usage to zero. No rollback or
migration is performed against operational data.

## Verification and limits

Tests use actual SDK, LlmService, pipeline persistence, controller and cancellation
paths with synthetic provider transport. Real PostgreSQL16 tests use a disposable
local container with tmpfs storage and cleanup, never a supplied production URL.
Split-specific test results, review findings, file sizes and SHA-256 hashes are
recorded outside the repository. The original package reports a PostgreSQL run;
that inherited result is distinct from a fresh run on this split. Opt-in database
suites are never counted as executed when skipped.

The carried PostgreSQL test now attempts pool and container cleanup independently.
If the body and cleanup both fail, an AggregateError retains the original error
as its cause and retains every cleanup error; successful cleanup rethrows the
original body error unchanged. Six provider-free failure-injection regressions
cover this test-harness correction, including nested and frozen errors. This
does not change production storage or provider behavior.

Remaining limits: provider-confirmed values are not a bill reconciliation;
missing/incomplete and legacy data make all-time totals partial. Existing cost
rates/currency/fallbacks and flat request estimates are not validated as tariffs.
There is no token budget enforcement, billing, new provider or new customer UI.
PR-CI, an independent split review and exact Main-CI remain integration gates.
Target migration, grants/provisioning and activation require separate authorization. `EXTERNAL_IPV6_PROBE_REQUIRED` remains separately open;
server, guard and network configuration are unchanged.
