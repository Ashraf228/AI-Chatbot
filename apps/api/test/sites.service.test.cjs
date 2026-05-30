const test = require('node:test');
const assert = require('node:assert/strict');
const { SitesService } = require('../dist/sites/sites.service.js');

test('SitesService.createSite persists lead recipient email in site config', async () => {
  let storedSite = null;
  const db = {
    async transaction(fn) {
      return fn({
        async query(sql, params) {
          if (sql.includes('INSERT INTO sites')) {
            storedSite = {
              id: params[0],
              site_key: params[1],
              tenant_id: params[2],
              name: params[3],
              allowed_domains: params[4],
              public_key: params[5],
              config: params[6],
            };
          }
          return { rows: [] };
        },
      });
    },
    async query(sql, params) {
      if (sql.includes('SELECT * FROM sites WHERE id=$1') && storedSite?.id === params[0]) {
        return { rows: [storedSite] };
      }
      return { rows: [] };
    },
  };
  const tenants = {
    async ensureTenantExists(tenantId) {
      return tenantId;
    },
  };
  const auditLogs = { async record() {} };
  const usageLimits = { async assertWithinLimit() {} };
  const service = new SitesService(db, tenants, auditLogs, usageLimits);

  const site = await service.createSite({
    tenantId: 'tenant-1',
    name: 'Muster Handwerk',
    allowedDomains: ['kunde.de'],
    config: {
      botType: 'handwerker-first-contact',
      leadCaptureEnabled: true,
      leadNotificationEmail: 'info@unternehmen.de',
    },
  });

  assert.equal(site.config.leadNotificationEmail, 'info@unternehmen.de');
  assert.equal(site.config.leadCaptureEnabled, true);
  assert.equal(site.config.botType, 'handwerker-first-contact');
});
