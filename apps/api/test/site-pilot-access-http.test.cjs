const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash, randomBytes } = require('node:crypto');
const { Test } = require('@nestjs/testing');
const { ValidationPipe, ForbiddenException, NotFoundException } = require('@nestjs/common');
const { WidgetSessionController } = require('../dist/modules/widget/controllers/widget-session.controller.js');
const { WidgetChatController } = require('../dist/modules/widget/controllers/widget-chat.controller.js');
const { WidgetConfigController } = require('../dist/modules/widget/controllers/widget-config.controller.js');
const { WidgetSessionService } = require('../dist/modules/widget/services/widget-session.service.js');
const { WidgetChatService } = require('../dist/modules/widget/services/widget-chat.service.js');
const { WidgetConfigService } = require('../dist/modules/widget/services/widget-config.service.js');
const { WidgetSecurityService } = require('../dist/modules/widget/services/widget-security.service.js');
const { WidgetSiteGuard } = require('../dist/modules/widget/guards/widget-site.guard.js');
const { WidgetOriginGuard } = require('../dist/modules/widget/guards/widget-origin.guard.js');
const { WidgetRateLimitGuard } = require('../dist/modules/widget/guards/widget-rate-limit.guard.js');
const { ChatController } = require('../dist/chat/chat.controller.js');
const { ChatService } = require('../dist/chat/chat.service.js');
const { ChatPipelineService } = require('../dist/ai/chat-pipeline/chat-pipeline.service.js');
const { SitesService } = require('../dist/sites/sites.service.js');
const { PrismaService } = require('../dist/db/prisma.service.js');
const { RateLimitService } = require('../dist/utils/rate-limit.service.js');
const { SiteModulesService } = require('../dist/site-modules/site-modules.service.js');
const { AssistantProfileResolverService } = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');

const origin = 'https://synthetic.example';
const token = randomBytes(32).toString('hex');
const pilot = { id: 'pilot-site', tenantId: 'pilot-tenant', siteKey: 'pilot', config: {}, public_key: 'public-test-key', isActive: true };
const sites = [pilot, { ...pilot, id: 'public-sibling', siteKey: 'sibling' },
  { ...pilot, id: 'public-other', tenantId: 'other-tenant', siteKey: 'other' }];
function rule() {
  return { tenantId: pilot.tenantId, siteId: pilot.id,
    tokenSha256: createHash('sha256').update(`${pilot.tenantId}\0${pilot.id}\0${token}`).digest('hex'),
    validFrom: new Date(Date.now() - 10000).toISOString(), expiresAt: new Date(Date.now() + 300000).toISOString() };
}

async function harness(t) {
  const previous = process.env.SITE_PILOT_ACCESS_RULES_JSON;
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([rule()]);
  const calls = { writes: 0, pipeline: [], rateAllowed: true, grantAllowed: true };
  const sessions = new Map(sites.map((site) => [`existing-${site.siteKey}`, site.id]));
  const db = { async query(sql, params) {
    if (/^(INSERT|UPDATE|DELETE)/i.test(sql.trim())) calls.writes++;
    if (sql.includes('INSERT INTO widget_sessions')) sessions.set(params[0], params[1]);
    if (sql.includes('SELECT allowed_domains')) return { rows: [{ allowed_domains: ['synthetic.example'] }] };
    if (sql.includes('SELECT id FROM widget_sessions')) return { rows: sessions.get(params[0]) === params[1] ? [{ id: params[0] }] : [] };
    if (sql.includes('COUNT(*)')) return { rows: [{ count: 0 }] };
    return { rows: [] };
  } };
  const configs = { async getSiteByKey(key) {
    const site = sites.find((entry) => entry.siteKey === key);
    if (!site) throw new NotFoundException();
    return site;
  }, getPublicConfig: WidgetConfigService.prototype.getPublicConfig };
  const pipeline = {
    async process(input) {
      calls.pipeline.push(input);
      if (!calls.grantAllowed) throw new ForbiddenException('Synthetic downstream grant denial');
      return { sessionId: input.sessionId, answer: 'Synthetic answer', parts: [], sources: [] };
    },
    async stream(input, emit) {
      calls.pipeline.push(input);
      await emit({ type: 'message_start', sessionId: input.sessionId, conversationId: 'synthetic-conversation' });
      await emit({ type: 'token', delta: 'Synthetic answer' });
      await emit({ type: 'message_end', sessionId: input.sessionId, answer: 'Synthetic answer', parts: [], sources: [] });
    },
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [WidgetSessionController, WidgetChatController, WidgetConfigController, ChatController],
    providers: [WidgetSessionService, WidgetChatService, WidgetSecurityService, WidgetSiteGuard,
      WidgetOriginGuard, WidgetRateLimitGuard, ChatService,
      { provide: PrismaService, useValue: db },
      { provide: WidgetConfigService, useValue: configs },
      { provide: SitesService, useValue: { async getSite(id) {
        const site = sites.find((entry) => entry.id === id);
        return site ? { ...site, tenant_id: site.tenantId, allowed_domains: ['synthetic.example'] } : null;
      } } },
      { provide: RateLimitService, useValue: { async allow() { return { allowed: calls.rateAllowed }; } } },
      { provide: ChatPipelineService, useValue: pipeline },
      { provide: SiteModulesService, useValue: { async listForSite() { return []; } } },
      { provide: AssistantProfileResolverService, useValue: new AssistantProfileResolverService() },
    ],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  t.after(async () => {
    await app.close();
    if (previous === undefined) delete process.env.SITE_PILOT_ACCESS_RULES_JSON;
    else process.env.SITE_PILOT_ACCESS_RULES_JSON = previous;
  });
  return { calls,
    async config(site) { return fetch(`${await app.getUrl()}/widget/config?siteKey=${site.siteKey}`); },
    async request(route, site = pilot, headers = {}, body = {}) {
    return fetch(`${await app.getUrl()}${route}`, { method: 'POST', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Origin: origin, ...headers },
      body: JSON.stringify({ siteKey: site.siteKey, siteId: site.id, publicKey: site.public_key,
        sessionId: `existing-${site.siteKey}`, message: 'Synthetic question', ...body }) });
  } };
}

const routes = ['/widget/session', '/widget/chat/message', '/widget/chat/stream', '/chat/message'];
test('HTTP boundaries reject missing tokens before writes or pipeline calls, including existing sessions and spoofed scope', async (t) => {
  const h = await harness(t);
  for (const route of routes) {
    for (const headers of [{}, { 'x-site-key': 'sibling', 'x-tenant-id': 'other-tenant',
      'x-forwarded-for': '127.0.0.1', 'x-real-ip': '127.0.0.1' }, { 'X-Site-Pilot-Token': '0'.repeat(64) }]) {
      const response = await h.request(`${route}?siteKey=sibling`, pilot, headers);
      assert.equal(response.status, 403, route);
      assert.equal(response.headers.get('content-type').includes('application/json'), true);
      assert.equal((await response.text()).includes(token), false);
    }
  }
  assert.equal(h.calls.writes, 0);
  assert.deepEqual(h.calls.pipeline, []);
});

test('HTTP token permits session, normal, stream and legacy while two other sites need no token', async (t) => {
  const h = await harness(t);
  for (const site of sites) {
    const configResponse = await h.config(site);
    assert.equal(configResponse.status, 200);
    const config = await configResponse.json();
    assert.equal(config.siteId, site.id);
    assert.equal(JSON.stringify(config).includes(token), false);
    assert.equal(Object.hasOwn(config, 'pilotAccess'), false);
    for (const route of routes) {
      const response = await h.request(route, site, site === pilot ? { 'X-Site-Pilot-Token': token } : {});
      assert.ok(response.ok, `${site.siteKey} ${route} ${response.status}: ${await response.text()}`);
    }
  }
  assert.equal(h.calls.writes, 3);
  assert.equal(h.calls.pipeline.length, 9);
  assert.equal(JSON.stringify(h.calls.pipeline).includes(token), false);
  for (const site of sites) assert.equal(h.calls.pipeline.filter((p) => p.siteId === site.id && p.tenantId === site.tenantId).length, 3);
});

test('valid pilot token cannot override origin, session ownership, rate limits or downstream grant denial', async (t) => {
  const h = await harness(t);
  const headers = { 'X-Site-Pilot-Token': token };
  assert.equal((await h.request('/widget/chat/message', pilot, { ...headers, Origin: 'https://untrusted.invalid' })).status, 403);
  assert.equal((await h.request('/widget/chat/stream', pilot, headers, { sessionId: 'existing-other' })).status, 404);
  assert.equal((await h.request('/chat/message', pilot, headers, { publicKey: 'wrong' })).status, 403);
  h.calls.rateAllowed = false;
  assert.equal((await h.request('/widget/chat/message', pilot, headers)).status, 429);
  assert.equal(h.calls.pipeline.length, 0);
  h.calls.rateAllowed = true;
  h.calls.grantAllowed = false;
  assert.equal((await h.request('/widget/chat/message', pilot, headers)).status, 403);
  assert.equal(h.calls.pipeline.length, 1);
});

test('expired rule rejects a previously admitted session; unrelated site still works', async (t) => {
  const h = await harness(t);
  const headers = { 'X-Site-Pilot-Token': token };
  assert.equal((await h.request('/widget/chat/message', pilot, headers)).status, 201);
  process.env.SITE_PILOT_ACCESS_RULES_JSON = JSON.stringify([{ ...rule(),
    validFrom: new Date(Date.now() - 300000).toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() }]);
  for (const route of routes) assert.equal((await h.request(route, pilot, headers)).status, 403);
  assert.equal((await h.request('/widget/chat/message', sites[1])).status, 201);
  assert.equal(h.calls.pipeline.length, 2);
});
