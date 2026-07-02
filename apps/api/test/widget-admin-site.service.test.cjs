const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetAdminSiteService } = require('../dist/modules/widget/services/widget-admin-site.service.js');

function createSiteRow({ siteConfig = {}, assistantProfileModuleConfig = null } = {}) {
  return {
    id: 'site-1',
    site_key: 'site-key',
    tenant_id: 'tenant-1',
    name: 'Musterkunde',
    public_key: 'pk_test',
    allowed_domains: ['kunde.example'],
    config: siteConfig,
    assistant_profile_module_config: assistantProfileModuleConfig,
    created_at: '2026-07-02T00:00:00.000Z',
  };
}

function createService(row) {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: row ? [row] : [] };
    },
  };

  return {
    service: new WidgetAdminSiteService(db),
    queries,
  };
}

test('WidgetAdminSiteService.getSite prefers saved assistant-profile module over legacy site config', async () => {
  const { service, queries } = createService(
    createSiteRow({
      siteConfig: {
        industry: 'generic',
        botType: 'universal-assistant',
        conversationFlow: { requiredFields: ['name', 'email', 'request', 'product_or_topic'] },
        enabledTasks: ['answer_questions', 'collect_requests', 'prepare_handoff', 'support', 'product_advice'],
        assistantProfile: {
          profileKey: 'universal-assistant',
          requiredFields: [{ key: 'name', label: 'Name', required: true }],
          enabledTasks: ['answer_questions'],
        },
      },
      assistantProfileModuleConfig: {
        assistantProfile: {
          profileKey: 'universal-assistant',
          profileVersion: 1,
          requiredFields: [
            { key: 'name', label: 'Name', required: true },
            { key: 'email', label: 'E-Mail', required: true },
            { key: 'request', label: 'Anliegen', required: true },
            { key: 'product_or_topic', label: 'Produkt / Thema', required: true },
            { key: 'customer_number', label: 'Kundennummer', required: true },
          ],
          enabledTasks: [
            'answer_questions',
            'collect_requests',
            'prepare_handoff',
            'support',
            'product_advice',
            'create_ticket',
          ],
          deliveryChannels: {
            email: { enabled: true, recipientEmail: 'hidden@example.test' },
            webhook: { enabled: false, signingSecret: 'do-not-return' },
          },
        },
      },
    }),
  );

  const site = await service.getSite('site-1');

  assert.match(queries[0].sql, /site_modules/);
  assert.equal(site.assistantProfile.profileKey, 'universal-assistant');
  assert.deepEqual(site.assistantProfile.requiredFields.map((field) => field.key), [
    'name',
    'email',
    'request',
    'product_or_topic',
    'customer_number',
  ]);
  assert.deepEqual(site.assistantProfile.enabledTasks, [
    'answer_questions',
    'collect_requests',
    'prepare_handoff',
    'support',
    'product_advice',
    'create_ticket',
  ]);
  assert.equal(site.conversationFlow.requiredFields.length, 4);
  assert.equal(site.enabledTasks.length, 5);
  assert.equal(site.assistantProfile.deliveryChannels.email.recipientEmail, undefined);
  assert.equal(site.assistantProfile.deliveryChannels.webhook.signingSecret, undefined);
});

test('WidgetAdminSiteService.getSite falls back to sites.config assistantProfile when module is absent', async () => {
  const { service } = createService(
    createSiteRow({
      siteConfig: {
        assistantProfile: {
          profileKey: 'support-assistant',
          profileVersion: 1,
          requiredFields: [{ key: 'request', label: 'Anliegen', required: true }],
          enabledTasks: ['support', 'create_ticket'],
        },
      },
      assistantProfileModuleConfig: null,
    }),
  );

  const site = await service.getSite('site-1');

  assert.equal(site.assistantProfile.profileKey, 'support-assistant');
  assert.deepEqual(site.assistantProfile.requiredFields.map((field) => field.key), ['request']);
  assert.deepEqual(site.assistantProfile.enabledTasks, ['support', 'create_ticket']);
});
