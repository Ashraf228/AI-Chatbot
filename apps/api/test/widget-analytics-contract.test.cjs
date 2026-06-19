const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BadRequestException } = require('@nestjs/common');
const {
  WIDGET_ANALYTICS_EVENT_TYPES,
  WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES,
  WIDGET_ANALYTICS_ACCEPTED_EVENT_TYPES,
  normalizeWidgetAnalyticsEventType,
} = require('../dist/modules/widget/analytics-events.js');
const { WidgetAnalyticsService } = require('../dist/modules/widget/services/widget-analytics.service.js');
const { WidgetAdminReportsService } = require('../dist/modules/widget/services/widget-admin-reports.service.js');

const canonicalEvents = [
  'impression',
  'open',
  'close',
  'chat_started',
  'message_sent',
  'message_received',
  'fallback',
  'lead_modal_opened',
  'lead_submitted',
  'consent_accepted',
];

const legacyAliases = {
  widget_loaded: 'impression',
  widget_impression: 'impression',
  widget_opened: 'open',
  widget_closed: 'close',
  fallback_answer: 'fallback',
};

test('widget analytics contract exposes all canonical and legacy event names', () => {
  assert.deepEqual(WIDGET_ANALYTICS_EVENT_TYPES, canonicalEvents);
  assert.deepEqual(WIDGET_ANALYTICS_LEGACY_EVENT_ALIASES, legacyAliases);
  assert.deepEqual(new Set(WIDGET_ANALYTICS_ACCEPTED_EVENT_TYPES), new Set([
    ...canonicalEvents,
    ...Object.keys(legacyAliases),
  ]));
});

test('widget analytics normalizes canonical values and legacy aliases', () => {
  for (const eventType of canonicalEvents) {
    assert.equal(normalizeWidgetAnalyticsEventType(eventType), eventType);
  }

  for (const [legacy, canonical] of Object.entries(legacyAliases)) {
    assert.equal(normalizeWidgetAnalyticsEventType(legacy), canonical);
  }
});

test('widget analytics rejects unknown event names with HTTP 400 semantics', () => {
  assert.throws(
    () => normalizeWidgetAnalyticsEventType('unknown_event'),
    (error) => error instanceof BadRequestException && error.getStatus() === 400,
  );
});

test('WidgetAnalyticsService persists only canonical event names', async () => {
  const insertedEventTypes = [];
  const service = new WidgetAnalyticsService(
    {
      async query(sql, params = []) {
        if (/INSERT INTO widget_events/i.test(sql)) {
          insertedEventTypes.push(params[3]);
        }
        return { rows: [] };
      },
    },
    {
      async getSiteByKey(siteKey) {
        return { id: 'site-1', siteKey };
      },
    },
    {
      async enforceOrigin() {},
      async assertSessionBelongsToSite() {},
    },
  );

  for (const [inputEvent, canonicalEvent] of [
    ...canonicalEvents.map((eventType) => [eventType, eventType]),
    ...Object.entries(legacyAliases),
  ]) {
    const result = await service.track({
      siteKey: 'site-key',
      sessionId: 'session-1',
      eventType: inputEvent,
      pageUrl: 'https://example.test/',
      metadata: {},
    }, 'https://example.test');
    assert.equal(result.eventType, canonicalEvent);
  }

  assert.deepEqual(insertedEventTypes, [
    ...canonicalEvents,
    ...Object.values(legacyAliases),
  ]);
});

test('WidgetAnalyticsService rejects unknown event names before database insert', async () => {
  let inserts = 0;
  const service = new WidgetAnalyticsService(
    {
      async query(sql) {
        if (/INSERT INTO widget_events/i.test(sql)) inserts += 1;
        return { rows: [] };
      },
    },
    {
      async getSiteByKey(siteKey) {
        return { id: 'site-1', siteKey };
      },
    },
    {
      async enforceOrigin() {},
      async assertSessionBelongsToSite() {},
    },
  );

  await assert.rejects(
    () => service.track({
      siteKey: 'site-key',
      sessionId: 'session-1',
      eventType: 'unknown_event',
      pageUrl: 'https://example.test/',
      metadata: {},
    }, 'https://example.test'),
    (error) => error instanceof BadRequestException && error.getStatus() === 400,
  );
  assert.equal(inserts, 0);
});

test('WidgetAdminReportsService counts canonical and rollout legacy events without double counting', async () => {
  const events = [
    { site_id: 'site-a', event_type: 'impression', metadata: {} },
    { site_id: 'site-a', event_type: 'widget_loaded', metadata: {} },
    { site_id: 'site-a', event_type: 'widget_impression', metadata: {} },
    { site_id: 'site-a', event_type: 'open', metadata: {} },
    { site_id: 'site-a', event_type: 'widget_opened', metadata: {} },
    { site_id: 'site-a', event_type: 'fallback', metadata: {} },
    { site_id: 'site-a', event_type: 'fallback_answer', metadata: {} },
    { site_id: 'site-a', event_type: 'message_received', metadata: { fallback: true } },
    { site_id: 'site-a', event_type: 'unknown_legacy', metadata: {} },
  ];
  const service = new WidgetAdminReportsService(
    {
      async query(sql, params = []) {
        const siteId = params[0];
        if (/COUNT\(\*\) FILTER[\s\S]*widget_impressions/i.test(sql)) {
          const scoped = events.filter((event) => !siteId || event.site_id === siteId);
          return {
            rows: [{
              widget_impressions: scoped.filter((event) => [
                'impression',
                'widget_loaded',
                'widget_impression',
              ].includes(event.event_type)).length,
              widget_openings: scoped.filter((event) => [
                'open',
                'widget_opened',
              ].includes(event.event_type)).length,
              started_chats: scoped.filter((event) => event.event_type === 'chat_started').length,
              fallback_answers: scoped.filter((event) => (
                ['fallback', 'fallback_answer'].includes(event.event_type) ||
                event.metadata?.fallback === true
              )).length,
            }],
          };
        }
        if (/FROM widget_sessions/i.test(sql)) return { rows: [{ total_sessions: 0, average_duration: 0 }] };
        if (/FROM widget_leads/i.test(sql)) return { rows: [{ leads: 0 }] };
        if (/JOIN messages/i.test(sql)) return { rows: [{ user_messages: 0, assistant_messages: 0 }] };
        if (/GROUP BY page_url/i.test(sql)) return { rows: [] };
        return { rows: [] };
      },
    },
    {},
    {},
    {},
  );

  const summary = await service.getSummary('site-a');

  assert.equal(summary.widgetImpressions, 3);
  assert.equal(summary.widgetOpenings, 2);
  assert.equal(summary.fallbackAnswers, 3);
});

test('widget analytics migration maps documented legacy values and leaves unknown values untouched', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../migrations/023_normalize_widget_analytics_events.sql'),
    'utf8',
  );

  for (const [legacy, canonical] of Object.entries(legacyAliases)) {
    assert.match(migration, new RegExp(`WHEN '${legacy}' THEN '${canonical}'`));
    assert.match(migration, new RegExp(`'${legacy}'`));
  }
  assert.match(migration, /ELSE event_type/i);
  assert.match(migration, /Unknown historical values are intentionally left unchanged/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+widget_events/i);
});
