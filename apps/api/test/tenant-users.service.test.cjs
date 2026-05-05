const test = require('node:test');
const assert = require('node:assert/strict');
const { TenantUsersService } = require('../dist/tenants/tenant-users.service.js');

test('TenantUsersService.create normalizes email and defaults role to editor', async () => {
  const dbCalls = [];
  const service = new TenantUsersService(
    {
      async query(sql, params) {
        dbCalls.push({ sql, params });

        if (/SELECT\s+id,\s+tenant_id,\s+email,\s+display_name/i.test(sql)) {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'max@example.com',
                display_name: 'Max Mustermann',
                role: 'editor',
                is_active: true,
                metadata: {},
                created_at: '2026-05-04T10:00:00.000Z',
                updated_at: '2026-05-04T10:00:00.000Z',
              },
            ],
          };
        }

        return { rows: [] };
      },
    },
    {
      async ensureTenantExists(id) {
        return id;
      },
    },
  );

  const result = await service.create({
    tenantId: 'tenant-1',
    email: ' MAX@EXAMPLE.COM ',
    displayName: 'Max Mustermann',
  });

  assert.equal(result.email, 'max@example.com');
  assert.equal(result.role, 'editor');
  assert.ok(dbCalls.some((call) => /INSERT INTO tenant_users/i.test(call.sql)));
});
