const test = require('node:test');
const assert = require('node:assert/strict');
const { SiteModulesService } = require('../dist/site-modules/site-modules.service.js');

test('SiteModulesService.listForSite merges registry defaults with stored module flags', async () => {
  const db = {
    async query() {
      return {
        rows: [
          {
            site_id: 'site-1',
            module_key: 'ecommerce-product-advisor',
            is_enabled: true,
            config: { source: 'shopify' },
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      };
    },
  };

  const sites = {
    async getSite(id) {
      return { id };
    },
  };

  const service = new SiteModulesService(db, sites);
  const modules = await service.listForSite('site-1');

  const leadSales = modules.find((entry) => entry.key === 'lead-sales');
  const ecommerce = modules.find((entry) => entry.key === 'ecommerce-product-advisor');

  assert.equal(leadSales.isEnabled, true);
  assert.equal(ecommerce.isEnabled, true);
  assert.equal(ecommerce.config.catalogMode, 'shopify_catalog');
  assert.equal(ecommerce.config.ctaLabel, 'Produktberatung anfragen');
});
