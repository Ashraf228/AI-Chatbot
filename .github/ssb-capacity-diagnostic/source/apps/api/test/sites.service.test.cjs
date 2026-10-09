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

test('SitesService.deleteSite requires exact lowercase confirmation', async () => {
  const db = {
    async query() {
      throw new Error('delete should not query database without confirmation');
    },
    async transaction() {
      throw new Error('delete should not start transaction without confirmation');
    },
  };
  const service = new SitesService(
    db,
    { async ensureTenantExists(tenantId) { return tenantId; } },
    { async record() {} },
    { async assertWithinLimit() {} },
  );

  await assert.rejects(
    () => service.deleteSite('site-1', { confirmation: 'LÖSCHEN' }),
    /löschen/,
  );
});

test('SitesService.deleteSite removes site-scoped records and the site', async () => {
  const siteRow = {
    id: 'site-1',
    site_key: 'site-1',
    tenant_id: 'tenant-1',
    name: 'Testkunde',
    allowed_domains: ['kunde.test'],
    public_key: 'pk_test',
    config: {},
  };
  const deleteStatements = [];
  const db = {
    async query(sql, params) {
      if (sql.includes('SELECT * FROM sites WHERE id=$1') && params[0] === 'site-1') {
        return { rows: [siteRow] };
      }
      return { rows: [] };
    },
    async transaction(fn) {
      return fn({
        async query(sql, params) {
          if (sql.includes('INSERT INTO audit_logs')) {
            return { rows: [] };
          }
          if (sql.includes('WITH deleted AS')) {
            deleteStatements.push({ sql, params });
            return { rows: [{ count: '1' }] };
          }
          return { rows: [] };
        },
      });
    },
  };
  const service = new SitesService(
    db,
    { async ensureTenantExists(tenantId) { return tenantId; } },
    { async record() {} },
    { async assertWithinLimit() {} },
  );

  const result = await service.deleteSite('site-1', {
    confirmation: 'löschen',
    actorId: 'admin-1',
    actorRole: 'admin',
  });

  assert.equal(result.ok, true);
  assert.equal(result.deletedSiteId, 'site-1');
  assert.ok(deleteStatements.some((entry) => entry.sql.includes('DELETE FROM sites WHERE id = $1')));
  assert.ok(deleteStatements.some((entry) => entry.sql.includes('DELETE FROM widget_leads WHERE site_id = $1')));
  assert.ok(deleteStatements.some((entry) => entry.sql.includes('DELETE FROM site_modules WHERE site_id = $1')));
});
