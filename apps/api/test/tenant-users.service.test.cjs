const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const { TenantUsersService } = require('../dist/tenants/tenant-users.service.js');
const { TenantUsersController } = require('../dist/tenants/tenant-users.controller.js');
const { REQUIRED_DASHBOARD_ROLES } = require('../dist/utils/dashboard-rbac.js');

test('workspace grant and revoke endpoints require the platform admin role', () => {
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_DASHBOARD_ROLES, TenantUsersController.prototype.setCustomerWorkspaceAccess),
    ['admin'],
  );
  assert.deepEqual(
    Reflect.getMetadata(REQUIRED_DASHBOARD_ROLES, TenantUsersController.prototype.revokeCustomerWorkspaceAccess),
    ['admin'],
  );
});

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
                expires_at: null,
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
  assert.equal(result.expiresAt, null);
  assert.ok(dbCalls.some((call) => /INSERT INTO tenant_users/i.test(call.sql)));
});

test('TenantUsersService.authenticate validates a tenant-scoped password hash', async () => {
  const salt = randomBytes(16);
  const hash = scryptSync('SuperSecret123!', salt, 64);
  const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;

  const service = new TenantUsersService(
    {
      async query(sql) {
        if (/FROM tenant_users/i.test(sql)) {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'kunde@example.com',
                display_name: 'Kunde Eins',
                role: 'viewer',
                is_active: true,
                metadata: { passwordHash },
                expires_at: '2026-12-31T23:00:00.000Z',
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
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

  const result = await service.authenticate({
    tenantId: 'tenant-1',
    email: 'KUNDE@EXAMPLE.COM',
    password: 'SuperSecret123!',
  });

  assert.equal(result.tenantId, 'tenant-1');
  assert.equal(result.email, 'kunde@example.com');
  assert.equal(result.displayName, 'Kunde Eins');
  assert.equal(result.role, 'viewer');
  assert.equal(result.expiresAt, '2026-12-31T23:00:00.000Z');
  assert.equal(result.passwordHash, undefined);
});

test('TenantUsersService.authenticate rejects expired tenant users', async () => {
  const salt = randomBytes(16);
  const hash = scryptSync('SuperSecret123!', salt, 64);
  const passwordHash = `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;

  const service = new TenantUsersService(
    {
      async query(sql) {
        if (/FROM tenant_users/i.test(sql)) {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'viewer@example.com',
                display_name: 'Viewer Eins',
                role: 'viewer',
                is_active: true,
                metadata: { passwordHash },
                expires_at: '2026-01-01T00:00:00.000Z',
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
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

  await assert.rejects(
    () =>
      service.authenticate({
        tenantId: 'tenant-1',
        email: 'viewer@example.com',
        password: 'SuperSecret123!',
      }),
    /Invalid credentials/,
  );
});

test('TenantUsersService.update rejects invalid expiresAt values', async () => {
  const service = new TenantUsersService(
    {
      async query(sql) {
        if (/FROM tenant_users/i.test(sql)) {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'viewer@example.com',
                display_name: 'Viewer Eins',
                role: 'viewer',
                is_active: true,
                metadata: {},
                expires_at: null,
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
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

  await assert.rejects(
    () => service.update('user-1', { expiresAt: 'kein-datum' }),
    /expiresAt must be a valid ISO timestamp/,
  );
});

test('TenantUsersService.update accepts active same-tenant evaluation demo sites for viewers', async () => {
  const dbCalls = [];
  const service = new TenantUsersService(
    {
      async query(sql, params) {
        dbCalls.push({ sql, params });

        if (/FROM sites/i.test(sql)) {
          return {
            rows: [
              {
                id: 'site-demo',
                tenant_id: 'tenant-1',
                is_evaluation_demo: true,
                is_active: true,
              },
            ],
          };
        }

        if (/FROM tenant_users/i.test(sql) && params?.[0] === 'user-1') {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'viewer@example.com',
                display_name: 'Viewer Eins',
                role: 'viewer',
                is_active: true,
                metadata: {},
                expires_at: null,
                evaluation_site_id: null,
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
              },
            ],
          };
        }

        if (/FROM tenant_users/i.test(sql) && params?.[0] === 'tenant-1') {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'viewer@example.com',
                display_name: 'Viewer Eins',
                role: 'viewer',
                is_active: true,
                metadata: {},
                expires_at: null,
                evaluation_site_id: 'site-demo',
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
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

  const result = await service.update('user-1', {
    role: 'viewer',
    evaluationSiteId: 'site-demo',
  });

  assert.equal(result.evaluationSiteId, 'site-demo');
  assert.ok(dbCalls.some((call) => /evaluation_site_id = \$7/i.test(call.sql)));
});

test('TenantUsersService.update rejects evaluation demo sites outside the tenant', async () => {
  const service = new TenantUsersService(
    {
      async query(sql, params) {
        if (/FROM sites/i.test(sql)) {
          return {
            rows: [
              {
                id: 'site-demo',
                tenant_id: 'tenant-2',
                is_evaluation_demo: true,
                is_active: true,
              },
            ],
          };
        }

        if (/FROM tenant_users/i.test(sql) && params?.[0] === 'user-1') {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'viewer@example.com',
                display_name: 'Viewer Eins',
                role: 'viewer',
                is_active: true,
                metadata: {},
                expires_at: null,
                evaluation_site_id: null,
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
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

  await assert.rejects(
    () => service.update('user-1', { role: 'viewer', evaluationSiteId: 'site-demo' }),
    /evaluationSiteId must reference an active evaluation demo site in the same tenant/,
  );
});

test('TenantUsersService grants customer workspace access only to exact same-tenant sites', async () => {
  const calls = [];
  const service = new TenantUsersService(
    {
      async query(sql, params) {
        calls.push({ sql, params });
        if (/FROM tenant_users/i.test(sql)) {
          return {
            rows: [{
              id: 'user-workspace',
              tenant_id: 'tenant-1',
              email: 'workspace@synthetic.invalid',
              display_name: 'Synthetic Workspace User',
              role: 'editor',
              is_active: true,
              metadata: { passwordHash: 'preserved' },
              expires_at: null,
              evaluation_site_id: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            }],
          };
        }
        if (/FROM sites/i.test(sql)) {
          return { rows: [{ id: 'site-1' }, { id: 'site-2' }] };
        }
        return { rows: [] };
      },
    },
    { async ensureTenantExists(id) { return id; } },
  );

  const result = await service.setCustomerWorkspaceAccess('user-workspace', ['site-1', 'site-2']);
  assert.deepEqual(result, {
    tenantUserId: 'user-workspace',
    tenantId: 'tenant-1',
    capability: 'customerWorkspaceOperatorV1',
    enabled: true,
    siteIds: ['site-1', 'site-2'],
  });
  const siteLookup = calls.find((call) => /FROM sites/i.test(call.sql));
  assert.deepEqual(siteLookup.params, ['tenant-1', ['site-1', 'site-2']]);
  const update = calls.find((call) => /jsonb_set/i.test(call.sql));
  assert.deepEqual(update.params, [
    'user-workspace',
    'customerWorkspaceOperatorV1',
    JSON.stringify({ enabled: true, siteIds: ['site-1', 'site-2'] }),
  ]);
  assert.match(update.sql, /COALESCE\(metadata, '\{\}'::jsonb\)/);
});

test('TenantUsersService rejects viewer, malformed, duplicate, and foreign-site workspace grants', async () => {
  const makeService = (role, sites) => new TenantUsersService(
    {
      async query(sql) {
        if (/FROM tenant_users/i.test(sql)) {
          return { rows: [{ id: 'user-1', tenant_id: 'tenant-1', role, metadata: {} }] };
        }
        if (/FROM sites/i.test(sql)) return { rows: sites.map((id) => ({ id })) };
        return { rows: [] };
      },
    },
    { async ensureTenantExists(id) { return id; } },
  );

  await assert.rejects(
    () => makeService('viewer', ['site-1']).setCustomerWorkspaceAccess('user-1', ['site-1']),
    /non-viewer tenant role/,
  );
  await assert.rejects(
    () => makeService('editor', ['site-1']).setCustomerWorkspaceAccess('user-1', ['site-1', 'site-1']),
    /unique siteIds/,
  );
  await assert.rejects(
    () => makeService('editor', ['site-1']).setCustomerWorkspaceAccess('user-1', ['site-1', 'site-foreign']),
    /must belong to the tenant/,
  );
});

test('TenantUsersService revokes only the dedicated workspace capability key', async () => {
  const calls = [];
  const service = new TenantUsersService(
    {
      async query(sql, params) {
        calls.push({ sql, params });
        if (/UPDATE tenant_users/i.test(sql)) {
          return { rows: [{ id: 'user-1', tenant_id: 'tenant-1' }] };
        }
        return { rows: [] };
      },
    },
    { async ensureTenantExists(id) { return id; } },
  );

  assert.deepEqual(await service.revokeCustomerWorkspaceAccess('user-1'), {
    tenantUserId: 'user-1',
    tenantId: 'tenant-1',
    capability: 'customerWorkspaceOperatorV1',
    enabled: false,
    siteIds: [],
  });
  assert.deepEqual(calls[0].params, ['user-1', 'customerWorkspaceOperatorV1']);
  assert.match(calls[0].sql, /metadata = COALESCE\(metadata, '\{\}'::jsonb\) - \$2/);
});

test('generic tenant-user create and update cannot bypass the dedicated workspace grant path', async () => {
  const service = new TenantUsersService(
    {
      async query(sql) {
        if (/FROM tenant_users/i.test(sql)) {
          return {
            rows: [{
              id: 'user-1', tenant_id: 'tenant-1', email: 'user@synthetic.invalid', display_name: 'User',
              role: 'editor', is_active: true, metadata: {}, expires_at: null, evaluation_site_id: null,
              created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
            }],
          };
        }
        return { rows: [] };
      },
    },
    { async ensureTenantExists(id) { return id; } },
  );
  const metadata = { customerWorkspaceOperatorV1: { enabled: true, siteIds: ['site-1'] } };
  await assert.rejects(
    () => service.create({
      tenantId: 'tenant-1', email: 'user@synthetic.invalid', displayName: 'User', metadata,
    }),
    /dedicated admin endpoint/,
  );
  await assert.rejects(() => service.update('user-1', { metadata }), /dedicated admin endpoint/);
});

test('TenantUsersService.update rejects evaluation demo site assignment for non-viewer roles', async () => {
  const service = new TenantUsersService(
    {
      async query(sql, params) {
        if (/FROM tenant_users/i.test(sql) && params?.[0] === 'user-1') {
          return {
            rows: [
              {
                id: 'user-1',
                tenant_id: 'tenant-1',
                email: 'editor@example.com',
                display_name: 'Editor Eins',
                role: 'editor',
                is_active: true,
                metadata: {},
                expires_at: null,
                evaluation_site_id: null,
                created_at: '2026-05-05T08:00:00.000Z',
                updated_at: '2026-05-05T08:00:00.000Z',
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

  await assert.rejects(
    () => service.update('user-1', { role: 'editor', evaluationSiteId: 'site-demo' }),
    /evaluationSiteId requires role viewer/,
  );
});
