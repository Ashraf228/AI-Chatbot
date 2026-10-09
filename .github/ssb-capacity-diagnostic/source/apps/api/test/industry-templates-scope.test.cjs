const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { IndustryTemplatesController } = require('../dist/industry-templates/industry-templates.controller.js');
const { ConversationsController } = require('../dist/conversations/conversations.controller.js');

test('IndustryTemplatesController apply checks site access before applying a template', async () => {
  const calls = [];
  const templates = {
    async applyTemplate() {
      calls.push('applyTemplate');
      return { ok: true };
    },
  };
  const scope = {
    getAuth(req) {
      calls.push('getAuth');
      return req.dashboardAuth;
    },
    async assertSiteAccess(auth, siteId, options) {
      calls.push({ method: 'assertSiteAccess', auth, siteId, options });
      throw new ForbiddenException('Forbidden');
    },
  };
  const controller = new IndustryTemplatesController(templates, scope);

  await assert.rejects(
    () =>
      controller.apply(
        'site-b',
        { templateKey: 'local-services' },
        { dashboardAuth: { role: 'operator', tenantId: 'tenant-a', actorId: 'operator-a' } },
      ),
    ForbiddenException,
  );

  assert.equal(calls.some((call) => call === 'applyTemplate'), false);
  assert.deepEqual(calls[1], {
    method: 'assertSiteAccess',
    auth: { role: 'operator', tenantId: 'tenant-a', actorId: 'operator-a' },
    siteId: 'site-b',
    options: { allowedRoles: ['admin', 'operator'] },
  });
});

test('IndustryTemplatesController apply uses scoped actor after site access passes', async () => {
  const calls = [];
  const templates = {
    async applyTemplate(siteId, payload) {
      calls.push({ method: 'applyTemplate', siteId, payload });
      return { siteId, payload };
    },
  };
  const scope = {
    getAuth(req) {
      return req.dashboardAuth;
    },
    async assertSiteAccess(auth, siteId, options) {
      calls.push({ method: 'assertSiteAccess', auth, siteId, options });
      return { id: siteId, tenant_id: auth.tenantId };
    },
  };
  const controller = new IndustryTemplatesController(templates, scope);

  const result = await controller.apply(
    'site-a',
    { templateKey: 'local-services', mode: 'fill_missing_only', appliedBy: 'body-actor' },
    { dashboardAuth: { role: 'operator', tenantId: 'tenant-a', actorId: 'operator-a' } },
  );

  assert.deepEqual(result.payload, {
    templateKey: 'local-services',
    mode: 'fill_missing_only',
    appliedBy: 'operator-a',
  });
  assert.equal(calls[0].method, 'assertSiteAccess');
  assert.equal(calls[1].method, 'applyTemplate');
});

test('ConversationsController delete checks conversation access before deleting', async () => {
  const db = {
    async query() {
      throw new Error('db should not be called before scope check passes');
    },
  };
  const scope = {
    getAuth(req) {
      return req.dashboardAuth;
    },
    async assertConversationAccess(auth, conversationId, options) {
      assert.deepEqual(auth, { role: 'admin', actorId: 'admin-a' });
      assert.equal(conversationId, 'conversation-b');
      assert.deepEqual(options, { allowedRoles: ['admin'] });
      throw new ForbiddenException('Forbidden');
    },
  };
  const controller = new ConversationsController(db, scope);

  await assert.rejects(
    () =>
      controller.deleteOne(
        'conversation-b',
        undefined,
        undefined,
        { dashboardAuth: { role: 'admin', actorId: 'admin-a' } },
      ),
    ForbiddenException,
  );
});

test('ConversationsController site export checks site access before querying messages', async () => {
  const calls = [];
  const db = {
    async query() {
      calls.push('query');
      return { rows: [] };
    },
  };
  const scope = {
    getAuth(req) {
      return req.dashboardAuth;
    },
    async assertSiteAccess(auth, siteId, options) {
      calls.push({ method: 'assertSiteAccess', auth, siteId, options });
      return { id: siteId, tenant_id: auth.tenantId };
    },
  };
  const controller = new ConversationsController(db, scope);

  await controller.export(
    'site-a',
    undefined,
    undefined,
    { dashboardAuth: { role: 'admin', tenantId: 'tenant-a', actorId: 'admin-a' } },
  );

  assert.deepEqual(calls[0], {
    method: 'assertSiteAccess',
    auth: { role: 'admin', tenantId: 'tenant-a', actorId: 'admin-a' },
    siteId: 'site-a',
    options: { allowedRoles: ['admin'] },
  });
  assert.equal(calls[1], 'query');
});
