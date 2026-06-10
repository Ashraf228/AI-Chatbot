const test = require('node:test');
const assert = require('node:assert/strict');
const { ItSupportReadinessService } = require('../dist/modules/it-support/it-support-readiness.service.js');

function createHarness({ modules = [], knowledge = {}, ticketWebhook = {} } = {}) {
  const queries = [];
  const db = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (/FROM site_modules/i.test(sql)) {
        return { rows: modules };
      }
      if (/FROM knowledge_sources/i.test(sql)) {
        return {
          rows: [
            {
              active_count: knowledge.activeCount ?? 0,
              imported_template_count: knowledge.importedTemplateCount ?? 0,
              imported_template_keys: knowledge.importedTemplateKeys || [],
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const ticketWebhookService = {
    async getConfig(siteId) {
      assert.equal(siteId, 'site-1');
      return {
        enabled: Boolean(ticketWebhook.enabled),
        forwardingConfigured: Boolean(ticketWebhook.forwardingConfigured),
        hasSigningSecret: Boolean(ticketWebhook.hasSigningSecret),
        lastTestStatus: ticketWebhook.lastTestStatus ?? null,
        lastTestAt: ticketWebhook.lastTestAt ?? null,
      };
    },
  };
  return {
    service: new ItSupportReadinessService(db, ticketWebhookService),
    queries,
  };
}

const validItSupportModule = {
  module_key: 'it-support',
  is_enabled: true,
  config: {
    requiredTicketFields: ['description', 'affectedSystem', 'impact', 'reporterEmail'],
    ticketConfirmationRequired: true,
    escalationKeywords: ['phishing'],
  },
};

const knowledgeFaqModule = {
  module_key: 'knowledge-faq',
  is_enabled: true,
  config: {},
};

test('ItSupportReadinessService returns not_ready when IT support is disabled', async () => {
  const { service } = createHarness({
    modules: [
      { ...validItSupportModule, is_enabled: false },
      knowledgeFaqModule,
    ],
    knowledge: { activeCount: 1 },
    ticketWebhook: { enabled: true, forwardingConfigured: true },
  });

  const result = await service.getReadiness('site-1');

  assert.equal(result.status, 'not_ready');
  assert.equal(result.checks.itSupportEnabled, false);
  assert.ok(result.missing.some((entry) => /it-support Modul/i.test(entry)));
});

test('ItSupportReadinessService returns warning without forwarding or knowledge preparation', async () => {
  const { service } = createHarness({
    modules: [validItSupportModule, knowledgeFaqModule],
    knowledge: { activeCount: 0, importedTemplateCount: 0, importedTemplateKeys: [] },
    ticketWebhook: { enabled: false, forwardingConfigured: false },
  });

  const result = await service.getReadiness('site-1');

  assert.equal(result.status, 'warning');
  assert.deepEqual(result.missing, []);
  assert.ok(result.warnings.some((entry) => /Ticket-Weiterleitung/i.test(entry)));
  assert.ok(result.warnings.some((entry) => /Wissensquellen|IT-Templates/i.test(entry)));
});

test('ItSupportReadinessService returns ready with modules, knowledge and ticket webhook', async () => {
  const { service } = createHarness({
    modules: [validItSupportModule, knowledgeFaqModule],
    knowledge: {
      activeCount: 1,
      importedTemplateCount: 1,
      importedTemplateKeys: ['vpn-not-connecting'],
    },
    ticketWebhook: {
      enabled: true,
      forwardingConfigured: true,
      hasSigningSecret: true,
      lastTestStatus: 'queued',
      lastTestAt: '2026-06-10T12:00:00.000Z',
    },
  });

  const result = await service.getReadiness('site-1');

  assert.equal(result.status, 'ready');
  assert.equal(result.checks.ticketForwardingConfigured, true);
  assert.equal(result.details.activeKnowledgeSourceCount, 1);
  assert.equal(result.details.importedItKnowledgeTemplateCount, 1);
  assert.equal(result.details.ticketWebhook.hasSigningSecret, true);
  assert.equal(Object.prototype.hasOwnProperty.call(result.details.ticketWebhook, 'signingSecret'), false);
  assert.deepEqual(result.missing, []);
});

test('ItSupportReadinessService keeps site-scoped counts isolated', async () => {
  const { service, queries } = createHarness({
    modules: [validItSupportModule, knowledgeFaqModule],
    knowledge: {
      activeCount: 0,
      importedTemplateCount: 0,
      importedTemplateKeys: [],
    },
    ticketWebhook: { enabled: false, forwardingConfigured: false },
  });

  await service.getReadiness('site-1');

  const moduleQuery = queries.find((entry) => /FROM site_modules/i.test(entry.sql));
  const knowledgeQuery = queries.find((entry) => /FROM knowledge_sources/i.test(entry.sql));
  assert.deepEqual(moduleQuery.params, ['site-1']);
  assert.deepEqual(knowledgeQuery.params, ['site-1']);
});
