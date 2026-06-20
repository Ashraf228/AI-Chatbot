# Analytics Contract Test

This document describes the reproducible analytics contract checks used for the NOLIS demonstrator baseline. It is a technical test description, not a production end-to-end proof.

## Goal

The analytics contract tests verify that widget analytics events are accepted, normalized, persisted and reported consistently across API layers. The focus is on:

- Widget session to site assignment.
- Analytics event DTO validation.
- Legacy event normalization.
- Canonical event persistence.
- Site and tenant separation through site-scoped sessions and reports.
- Reporting aggregation for the same stored events.

## Tested Layers

`npm run test:analytics-contract` runs:

- `apps/api/test/widget-analytics-contract.test.cjs`
- `apps/api/test/widget-analytics-reporting-smoke.test.cjs`

The existing contract test covers event constants, the normalization helper, service-level insert parameters, reporting SQL mapping and a static check of migration 023.

The smoke test initializes a Nest test application with:

- Real widget session HTTP controller.
- Real widget events HTTP controller.
- Real DTO decorator validation through `class-validator` with whitelist behavior.
- Real widget site, origin and rate-limit guards.
- Real `WidgetSessionService`.
- Real `WidgetAnalyticsService`.
- Real `WidgetSecurityService`.
- Real `WidgetConfigService`.
- Real `WidgetAdminReportsService`.

## DTO And Controller Coverage

Events are posted through the same controller path used by `/widget/events`. Unknown event names such as `unknown_widget_event` are rejected with HTTP 400 semantics by the DTO validation layer before the persistence path is reached.

Sessions are created through the same controller path used by `/widget/session`, then reused for analytics events.

## Session And Site Checks

The smoke test creates:

- Tenant A with Site A.
- Tenant B with Site B.
- One valid widget session per site.

It verifies:

- A valid Site A session can record a Site A event.
- A Site A session cannot record a Site B event.
- A missing session cannot record an event.
- Failed requests do not create additional analytics rows.

## Legacy Normalization And Persistence

The smoke test sends the sequence:

- `impression`
- `open`
- `chat_started`
- `message_sent`
- `fallback`
- `widget_opened`

`widget_opened` is the legacy alias for `open`.

The fake persistence adapter records the exact bound parameters sent to the `INSERT INTO widget_events` statement. The expected persisted sequence is:

- `impression`
- `open`
- `chat_started`
- `message_sent`
- `fallback`
- `open`

The legacy string `widget_opened` must not reach stored event rows.

## Reporting Aggregation

The smoke test runs `WidgetAdminReportsService.getSummary()` against the same stored events. It checks exact values:

- `widgetImpressions = 1`
- `widgetOpenings = 2`
- `startedChats = 1`
- `sentMessages = 1`
- `fallbackAnswers = 1`

`message_sent` is verified at persistence level and as the fachlich equivalent `sentMessages` report field. The current report summary maps sent message counts from conversation messages, not directly from widget event rows, so the fake adapter provides a scoped message aggregate derived from the smoke-test `message_sent` event.

Report counts treat `0` as a valid measured value. `null` and `undefined` are handled separately as missing values. For backward compatibility with older result shapes, `startedChats` falls back to `totalSessions` only when `started_chats` is missing or null, never when it is `0` or `"0"`. Report numeric fields are normalized so invalid values do not produce `NaN` or `Infinity`.

## Tenant And Site Isolation

The persistence adapter keeps separate Site A and Site B records. Reports are requested per site. Site B events must not alter Site A report values, and Site A events must not appear in Site B report values.

This verifies the current site-scoped reporting boundary. It does not claim to prove a full authenticated tenant-admin reporting path.

## Persistence Strategy

No real database is used. The test uses a production-shaped in-memory adapter that implements the same `PrismaService.query(sql, params)` contract used by the services.

The adapter checks and responds to the actual SQL issued by the services, records insert parameters, and computes reporting rows from the stored in-memory events and sessions.

This avoids:

- Development or production database usage.
- Database passwords in tests.
- Table truncation.
- Persistent test data.
- External network services.

## Migration 023 Boundary

No isolated SQL migration harness exists for this prompt. Migration 023 remains covered by the static contract test, which verifies the documented legacy mappings, preservation of unknown historical values and absence of destructive deletes.

## Local Command

Run:

```sh
npm run test:analytics-contract
```

The command builds the API and then runs both analytics contract tests with Node's built-in test runner.

## CI Integration

The Source Gate in `.github/workflows/ci.yml` runs:

```sh
npm run test:analytics-contract
```

It runs after app dependency installation and API typecheck, and before production builds. It is blocking and does not use `continue-on-error`.

## Not Covered

The test does not cover:

- A real PostgreSQL engine.
- Real SQL migration execution.
- The Nest global `ValidationPipe` runtime object itself.
- Authenticated dashboard/admin viewer permissions.
- External OpenAI, SMTP or webhook calls.
- Browser widget runtime behavior.
- Full production telemetry infrastructure.
