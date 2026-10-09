const test = require('node:test');
const assert = require('node:assert/strict');
const { AgentsService } = require('../dist/agents/agents.service.js');

test('AgentsService lists agent availability based on enabled site modules', async () => {
  const db = {
    async query() {
      return { rows: [] };
    },
  };

  const sites = {
    async getSite(id) {
      return { id, tenant_id: 'tenant-1' };
    },
  };

  const siteModules = {
    async listForSite() {
      return [
        { key: 'lead-sales', isEnabled: true },
        { key: 'knowledge-faq', isEnabled: true },
        { key: 'ecommerce-product-advisor', isEnabled: false },
      ];
    },
  };

  const service = new AgentsService(db, sites, siteModules);
  const agents = await service.listAvailableAgents('site-1');

  const sales = agents.find((agent) => agent.key === 'lead-sales-agent');
  const ecommerce = agents.find((agent) => agent.key === 'ecommerce-product-advisor');

  assert.equal(sales.isAvailable, true);
  assert.equal(ecommerce.isAvailable, false);
  assert.ok(ecommerce.missingModules.includes('ecommerce-product-advisor'));
});

test('AgentsService.createRun stores the tenant of the selected site on the run', async () => {
  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (/SELECT\s+id,\s+tenant_id,\s+site_id,\s+agent_key/i.test(sql)) {
        return {
          rows: [
            {
              id: 'run-1',
              tenant_id: 'tenant-2',
              site_id: 'site-2',
              agent_key: 'lead-sales-agent',
              trigger_source: 'manual',
              status: 'queued',
              input_summary: 'Lead pruefen',
              output_summary: null,
              metadata: {},
              error_message: null,
              created_at: '2026-05-05T00:00:00.000Z',
              started_at: null,
              completed_at: null,
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const sites = {
    async getSite(id) {
      return { id, tenant_id: 'tenant-2' };
    },
  };

  const siteModules = {
    async listForSite() {
      return [
        { key: 'lead-sales', isEnabled: true },
        { key: 'knowledge-faq', isEnabled: true },
      ];
    },
  };

  const service = new AgentsService(db, sites, siteModules, { async retry() {} });
  await service.createRun('site-2', {
    agentKey: 'lead-sales-agent',
    inputSummary: 'Lead pruefen',
  });

  const insertCall = queries.find((entry) => /INSERT INTO agent_runs/i.test(entry.sql));
  assert.ok(insertCall);
  assert.equal(insertCall.params[1], 'tenant-2');
  assert.equal(insertCall.params[2], 'site-2');
});
