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
