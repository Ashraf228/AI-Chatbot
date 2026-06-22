const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException } = require('@nestjs/common');
const { EvaluationAccessService } = require('../dist/evaluation/evaluation-access.service.js');

function createService(row) {
  const auditEvents = [];
  return {
    auditEvents,
    service: new EvaluationAccessService(
      {
        async query() {
          return { rows: row ? [row] : [] };
        },
      },
      {
        async record(input) {
          auditEvents.push(input);
        },
      },
    ),
  };
}

const baseRow = {
  tenant_user_id: 'viewer-1',
  tenant_id: 'tenant-1',
  role: 'viewer',
  is_active: true,
  expires_at: '2099-01-01T00:00:00.000Z',
  evaluation_site_id: 'site-demo',
  site_id: 'site-demo',
  site_tenant_id: 'tenant-1',
  site_name: 'Demo Site',
  is_evaluation_demo: true,
  site_active: true,
};

const auth = {
  role: 'viewer',
  tenantId: 'tenant-1',
  tenantUserId: 'viewer-1',
  sessionExpiresAt: '2099-01-01T00:00:00.000Z',
};

test('EvaluationAccessService allows active viewer bound to active demo site in same tenant', async () => {
  const { auditEvents, service } = createService(baseRow);
  const result = await service.resolve(auth);

  assert.equal(result.tenantUserId, 'viewer-1');
  assert.equal(result.tenantId, 'tenant-1');
  assert.equal(result.siteId, 'site-demo');
  assert.equal(result.siteDisplayName, 'Demo Site');
  assert.equal(auditEvents.length, 0);
});

test('EvaluationAccessService denies missing evaluationSiteId', async () => {
  const { auditEvents, service } = createService({ ...baseRow, evaluation_site_id: null, site_id: null });
  await assert.rejects(
    () => service.resolve(auth),
    ForbiddenException,
  );
  assert.equal(auditEvents[0].action, 'evaluation_access_denied');
  assert.deepEqual(auditEvents[0].metadata, { result: 'denied' });
});

test('EvaluationAccessService denies cross-tenant evaluation site', async () => {
  const { service } = createService({ ...baseRow, site_tenant_id: 'tenant-2' });
  await assert.rejects(
    () => service.resolve(auth),
    ForbiddenException,
  );
});

test('EvaluationAccessService denies non-demo and inactive sites', async () => {
  await assert.rejects(
    () => createService({ ...baseRow, is_evaluation_demo: false }).service.resolve(auth),
    ForbiddenException,
  );
  await assert.rejects(
    () => createService({ ...baseRow, site_active: false }).service.resolve(auth),
    ForbiddenException,
  );
});

test('EvaluationAccessService denies inactive, expired or role-changed viewers', async () => {
  await assert.rejects(
    () => createService({ ...baseRow, is_active: false }).service.resolve(auth),
    ForbiddenException,
  );
  await assert.rejects(
    () => createService({ ...baseRow, expires_at: '2020-01-01T00:00:00.000Z' }).service.resolve(auth),
    ForbiddenException,
  );
  await assert.rejects(
    () => createService({ ...baseRow, role: 'customer' }).service.resolve(auth),
    ForbiddenException,
  );
});

test('EvaluationAccessService denies non-viewer sessions before querying evaluation data', async () => {
  const { auditEvents, service } = createService(baseRow);
  await assert.rejects(
    () => service.resolve({ ...auth, role: 'customer' }),
    ForbiddenException,
  );
  assert.equal(auditEvents[0].action, 'evaluation_access_denied');
  assert.equal(auditEvents[0].actorRole, 'customer');
});
