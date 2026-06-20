require('reflect-metadata');

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateSync } = require('class-validator');
const { Test } = require('@nestjs/testing');

const { PrismaService } = require('../dist/db/prisma.service.js');
const { RateLimitService } = require('../dist/utils/rate-limit.service.js');
const {
  WidgetEventsController,
} = require('../dist/modules/widget/controllers/widget-events.controller.js');
const {
  WidgetSessionController,
} = require('../dist/modules/widget/controllers/widget-session.controller.js');
const {
  WidgetAnalyticsService,
} = require('../dist/modules/widget/services/widget-analytics.service.js');
const {
  WidgetAdminReportsService,
} = require('../dist/modules/widget/services/widget-admin-reports.service.js');
const {
  WidgetConfigService,
} = require('../dist/modules/widget/services/widget-config.service.js');
const {
  WidgetSecurityService,
} = require('../dist/modules/widget/services/widget-security.service.js');
const {
  WidgetSessionService,
} = require('../dist/modules/widget/services/widget-session.service.js');
const {
  WidgetOriginGuard,
} = require('../dist/modules/widget/guards/widget-origin.guard.js');
const {
  WidgetRateLimitGuard,
} = require('../dist/modules/widget/guards/widget-rate-limit.guard.js');
const {
  WidgetSiteGuard,
} = require('../dist/modules/widget/guards/widget-site.guard.js');
const {
  CreateSessionDto,
} = require('../dist/modules/widget/dto/create-session.dto.js');
const {
  TrackEventDto,
} = require('../dist/modules/widget/dto/track-event.dto.js');

const siteA = {
  id: 'site-a',
  tenantId: 'tenant-a',
  siteKey: 'site-a-key',
  name: 'Site A',
  allowedDomains: ['https://site-a.example.test'],
};

const siteB = {
  id: 'site-b',
  tenantId: 'tenant-b',
  siteKey: 'site-b-key',
  name: 'Site B',
  allowedDomains: ['https://site-b.example.test'],
};

class AnalyticsSmokeDb {
  constructor() {
    this.sites = [siteA, siteB];
    this.sessions = [];
    this.events = [];
    this.inserts = [];
  }

  async query(sql, params = []) {
    if (/FROM\s+\(\s*SELECT[\s\S]*FROM sites s[\s\S]*WHERE s\.site_key = \$1/i.test(sql)) {
      const site = this.sites.find((entry) => entry.siteKey === params[0]);
      return { rows: site ? [this.toSiteConfigRow(site)] : [] };
    }

    if (/SELECT allowed_domains FROM sites WHERE id = \$1 LIMIT 1/i.test(sql)) {
      const site = this.sites.find((entry) => entry.id === params[0]);
      return { rows: site ? [{ allowed_domains: site.allowedDomains }] : [] };
    }

    if (/FROM widget_sessions\s+WHERE site_id = \$1 AND visitor_id = \$2/i.test(sql)) {
      return {
        rows: this.sessions
          .filter((session) => session.site_id === params[0] && session.visitor_id === params[1])
          .slice(0, 1),
      };
    }

    if (/INSERT INTO widget_sessions/i.test(sql)) {
      const [id, siteId, visitorId, sourceUrl, userAgent] = params;
      this.sessions.push({
        id,
        site_id: siteId,
        visitor_id: visitorId,
        started_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        last_seen_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        source_url: sourceUrl,
        user_agent: userAgent,
        lead_captured: false,
      });
      return { rows: [] };
    }

    if (/SELECT id FROM widget_sessions WHERE id = \$1 AND site_id = \$2 LIMIT 1/i.test(sql)) {
      const session = this.sessions.find((entry) => entry.id === params[0] && entry.site_id === params[1]);
      return { rows: session ? [{ id: session.id }] : [] };
    }

    if (/INSERT INTO widget_events/i.test(sql)) {
      const [id, siteId, sessionId, eventType, pageUrl, metadata] = params;
      this.inserts.push({ id, siteId, sessionId, eventType, pageUrl, metadata });
      this.events.push({
        id,
        site_id: siteId,
        session_id: sessionId,
        event_type: eventType,
        page_url: pageUrl,
        metadata: metadata || {},
      });
      return { rows: [] };
    }

    if (/UPDATE widget_sessions/i.test(sql)) {
      const siteId = params[0];
      const sessionId = params[1];
      const pageUrl = params[2];
      const session = this.sessions.find((entry) => entry.id === sessionId && (!siteId || entry.site_id === siteId));
      if (session) {
        session.last_seen_at = new Date('2026-01-01T00:00:30.000Z').toISOString();
        if (pageUrl) session.source_url = pageUrl;
      }
      return { rows: [] };
    }

    if (/COUNT\(\*\)::int AS total_sessions\s+FROM widget_sessions ws/i.test(sql)) {
      const scoped = this.scopedSessions(params[0]);
      return { rows: [{ total_sessions: scoped.length }] };
    }

    if (/COUNT\(\*\) FILTER[\s\S]*widget_impressions/i.test(sql)) {
      const scoped = this.scopedEvents(params[0]);
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

    if (/FROM widget_leads/i.test(sql)) {
      return { rows: [{ leads: 0 }] };
    }

    if (/AVG\(EXTRACT\(EPOCH FROM \(last_seen_at - started_at\)\)\)/i.test(sql)) {
      return { rows: [{ average_duration: 0 }] };
    }

    if (/JOIN messages/i.test(sql)) {
      if (/COUNT\(\*\) FILTER/i.test(sql)) {
        return {
          rows: [{
            user_messages: this.scopedEvents(params[0]).filter((event) => event.event_type === 'message_sent').length,
            assistant_messages: 0,
          }],
        };
      }
      return { rows: [] };
    }

    if (/GROUP BY page_url/i.test(sql)) {
      const counts = new Map();
      for (const event of this.scopedEvents(params[0])) {
        counts.set(event.page_url, (counts.get(event.page_url) || 0) + 1);
      }
      return {
        rows: [...counts.entries()]
          .map(([page_url, total]) => ({ page_url, total }))
          .sort((a, b) => b.total - a.total),
      };
    }

    return { rows: [] };
  }

  scopedEvents(siteId) {
    return siteId ? this.events.filter((event) => event.site_id === siteId) : [...this.events];
  }

  scopedSessions(siteId) {
    return siteId ? this.sessions.filter((session) => session.site_id === siteId) : [...this.sessions];
  }

  toSiteConfigRow(site) {
    return {
      id: site.id,
      tenant_id: site.tenantId,
      name: site.name,
      domain: site.allowedDomains[0],
      brand_color: '#111111',
      accent_color: '#eeeeee',
      font_family: 'system',
      welcome_message: 'Hallo',
      site_key: site.siteKey,
      privacy_url: 'https://privacy.example.test',
      is_active: true,
      company_name: site.name,
      bot_name: 'Bot',
      logo_url: '',
      public_key: `pk_${site.id}`,
      widget_bundle_url: '',
      consent_required: true,
      lead_capture_enabled: true,
      suggested_questions_by_path: {},
      lead_notification_email: '',
      conversation_flow: {},
      system_prompt: '',
      industry: '',
    };
  }
}

async function createSmokeHarness() {
  const db = new AnalyticsSmokeDb();
  const moduleRef = await Test.createTestingModule({
    controllers: [WidgetSessionController, WidgetEventsController],
    providers: [
      WidgetAnalyticsService,
      WidgetConfigService,
      WidgetSecurityService,
      WidgetSessionService,
      WidgetSiteGuard,
      WidgetOriginGuard,
      WidgetRateLimitGuard,
      {
        provide: WidgetAdminReportsService,
        useFactory: (database) => new WidgetAdminReportsService(
          database,
          {},
          {},
          {},
        ),
        inject: [PrismaService],
      },
      {
        provide: PrismaService,
        useValue: db,
      },
      {
        provide: RateLimitService,
        useValue: {
          async allow() {
            return { allowed: true, remaining: 59, resetAt: Date.now() + 60_000 };
          },
        },
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  return {
    app,
    db,
    reports: app.get(WidgetAdminReportsService),
    sessionController: app.get(WidgetSessionController),
    eventsController: app.get(WidgetEventsController),
    siteGuard: app.get(WidgetSiteGuard),
    originGuard: app.get(WidgetOriginGuard),
    rateLimitGuard: app.get(WidgetRateLimitGuard),
  };
}

function createExecutionContext(request) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return request;
        },
      };
    },
  };
}

function toResponse(error) {
  if (typeof error?.getStatus === 'function') {
    return {
      status: error.getStatus(),
      payload: typeof error.getResponse === 'function' ? error.getResponse() : error.message,
    };
  }
  throw error;
}

function validateDto(body, DtoClass) {
  const dto = Object.assign(new DtoClass(), body);
  const errors = validateSync(dto, {
    forbidUnknownValues: false,
    whitelist: true,
  });

  if (errors.length > 0) {
    return { ok: false, response: { status: 400, payload: { message: 'Bad Request' } } };
  }

  return { ok: true, dto };
}

async function dispatchJson(harness, path, body, origin = siteA.allowedDomains[0]) {
  const request = {
    body,
    query: {},
    headers: {
      'content-type': 'application/json',
      origin,
    },
    route: { path },
    socket: { remoteAddress: '127.0.0.1' },
  };
  const context = createExecutionContext(request);

  try {
    for (const guard of [harness.siteGuard, harness.originGuard, harness.rateLimitGuard]) {
      const allowed = await guard.canActivate(context);
      if (!allowed) return { status: 403, payload: 'Forbidden resource' };
    }

    if (path === '/widget/session') {
      const validation = validateDto(body, CreateSessionDto);
      if (!validation.ok) return validation.response;
      return {
        status: 201,
        payload: await harness.sessionController.createSession(validation.dto, origin, request),
      };
    }

    if (path === '/widget/events') {
      const validation = validateDto(body, TrackEventDto);
      if (!validation.ok) return validation.response;
      return {
        status: 201,
        payload: await harness.eventsController.trackEvent(validation.dto, origin, request),
      };
    }

    return { status: 404, payload: 'Not Found' };
  } catch (error) {
    return toResponse(error);
  }
}

async function createSession(harness, site, visitorId) {
  const response = await dispatchJson(harness, '/widget/session', {
    siteKey: site.siteKey,
    visitorId,
    sourceUrl: `${site.allowedDomains[0]}/kontakt`,
    userAgent: 'node-test',
  }, site.allowedDomains[0]);

  assert.equal(response.status, 201);
  assert.equal(response.payload.siteId, site.id);
  return response.payload;
}

async function track(harness, site, sessionId, eventType) {
  return dispatchJson(harness, '/widget/events', {
    siteKey: site.siteKey,
    sessionId,
    eventType,
    pageUrl: `${site.allowedDomains[0]}/kontakt`,
    metadata: {},
  }, site.allowedDomains[0]);
}

function summaryCounts(summary) {
  return {
    impression: summary.widgetImpressions,
    open: summary.widgetOpenings,
    chat_started: summary.startedChats,
    message_sent: summary.sentMessages,
    fallback: summary.fallbackAnswers,
  };
}

test('widget analytics controller flow normalizes, persists and reports events with site isolation', async () => {
  const harness = await createSmokeHarness();
  const { app, db, reports } = harness;

  try {
    const sessionA = await createSession(harness, siteA, 'visitor-a');
    const sessionB = await createSession(harness, siteB, 'visitor-b');

    const firstInsertCount = db.inserts.length;
    const control = await track(harness, siteA, sessionA.id, 'impression');
    assert.equal(control.status, 201);
    assert.equal(db.inserts.length, firstInsertCount + 1);
    assert.equal(db.inserts.at(-1).siteId, siteA.id);
    assert.equal(db.inserts.at(-1).sessionId, sessionA.id);
    assert.equal(db.inserts.at(-1).eventType, 'impression');

    for (const eventType of ['open', 'chat_started', 'message_sent', 'fallback', 'widget_opened']) {
      const response = await track(harness, siteA, sessionA.id, eventType);
      assert.equal(response.status, 201);
    }

    assert.deepEqual(
      db.inserts.filter((entry) => entry.siteId === siteA.id).map((entry) => entry.eventType),
      ['impression', 'open', 'chat_started', 'message_sent', 'fallback', 'open'],
    );
    assert.equal(
      db.events.some((event) => event.event_type === 'widget_opened'),
      false,
      'legacy widget_opened must not be stored after normalization',
    );

    const siteASummary = await reports.getSummary(siteA.id);
    assert.deepEqual(summaryCounts(siteASummary), {
      impression: 1,
      open: 2,
      chat_started: 1,
      message_sent: 1,
      fallback: 1,
    });
    assert.deepEqual(siteASummary.mostActivePages, [{
      pageUrl: `${siteA.allowedDomains[0]}/kontakt`,
      count: 6,
    }]);

    const beforeInvalidEvents = db.events.length;

    const mismatch = await track(harness, siteB, sessionA.id, 'open');
    assert.equal(mismatch.status, 404);
    assert.equal(db.events.length, beforeInvalidEvents);
    assert.deepEqual(summaryCounts(await reports.getSummary(siteA.id)), summaryCounts(siteASummary));

    const unknown = await track(harness, siteA, sessionA.id, 'unknown_widget_event');
    assert.equal(unknown.status, 400);
    assert.equal(db.events.length, beforeInvalidEvents);
    assert.deepEqual(summaryCounts(await reports.getSummary(siteA.id)), summaryCounts(siteASummary));

    const invalidSession = await track(harness, siteA, 'missing-session', 'open');
    assert.equal(invalidSession.status, 404);
    assert.equal(db.events.length, beforeInvalidEvents);
    assert.deepEqual(summaryCounts(await reports.getSummary(siteA.id)), summaryCounts(siteASummary));

    assert.equal((await track(harness, siteB, sessionB.id, 'impression')).status, 201);
    assert.equal((await track(harness, siteB, sessionB.id, 'open')).status, 201);

    assert.deepEqual(summaryCounts(await reports.getSummary(siteA.id)), summaryCounts(siteASummary));
    assert.deepEqual(summaryCounts(await reports.getSummary(siteB.id)), {
      impression: 1,
      open: 1,
      chat_started: 1,
      message_sent: 0,
      fallback: 0,
    });
  } finally {
    await app.close();
  }
});
