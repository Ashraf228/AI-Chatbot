const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { TenantsService } = require('../dist/tenants/tenants.service.js');

test('TenantsService.createTenant normalizes tenant ids and stores a display name', async () => {
  const calls = [];
  const db = {
    async query(sql, params = []) {
      calls.push({ sql, params });

      if (sql.includes('SELECT id, name, created_at') && sql.includes('FROM tenants')) {
        return {
          rows: [
            {
              id: 'hausverwaltung-nord',
              name: 'Hausverwaltung Nord',
              created_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const service = new TenantsService(db);
  const tenant = await service.createTenant({
    id: 'Hausverwaltung Nord',
    name: 'Hausverwaltung Nord',
  });

  assert.equal(tenant.id, 'hausverwaltung-nord');
  assert.equal(tenant.name, 'Hausverwaltung Nord');
  assert.equal(calls[0].params[0], 'hausverwaltung-nord');
});

test('TenantsService.ensureTenantExists rejects unknown tenant ids', async () => {
  const db = {
    async query() {
      return { rows: [] };
    },
  };

  const service = new TenantsService(db);

  await assert.rejects(
    () => service.ensureTenantExists('missing-tenant'),
    (error) => error instanceof BadRequestException && error.message === 'tenantId not found',
  );
});

test('TenantsService.ensureTenantExists accepts legacy underscore tenant ids', async () => {
  const calls = [];
  const db = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      return { rows: [{ id: 't_default' }] };
    },
  };

  const service = new TenantsService(db);
  const tenantId = await service.ensureTenantExists('t_default');

  assert.equal(tenantId, 't_default');
  assert.deepEqual(calls[0].params[0], ['t_default', 't-default']);
});
