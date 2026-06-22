const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException, UnauthorizedException } = require('@nestjs/common');
const { AdminKeyGuard } = require('../dist/utils/admin.guard.js');

const DASHBOARD_TOKEN = 'dashboard-token-for-viewer-rbac-tests-12345';

function createContext(headers, requiredRoles = []) {
  return {
    switchToHttp() {
      return {
        getRequest() {
          return { headers };
        },
      };
    },
    getHandler() {
      return function handler() {};
    },
    getClass() {
      return function Controller() {};
    },
    requiredRoles,
  };
}

function createGuard(requiredRoles = []) {
  return new AdminKeyGuard({
    getAllAndOverride() {
      return requiredRoles;
    },
  });
}

test('AdminKeyGuard denies viewer dashboard role by default', () => {
  process.env.DASHBOARD_INTERNAL_TOKEN = DASHBOARD_TOKEN;
  const guard = createGuard();

  assert.throws(
    () =>
      guard.canActivate(
        createContext({
          'x-dashboard-token': DASHBOARD_TOKEN,
          'x-dashboard-role': 'viewer',
          'x-dashboard-actor': 'viewer:user-1',
          'x-dashboard-tenant': 'tenant-1',
        }),
      ),
    ForbiddenException,
  );
});

test('AdminKeyGuard does not trust role headers without the dashboard token', () => {
  process.env.DASHBOARD_INTERNAL_TOKEN = DASHBOARD_TOKEN;
  const guard = createGuard(['customer']);

  assert.throws(
    () =>
      guard.canActivate(
        createContext({
          'x-dashboard-role': 'customer',
          'x-dashboard-actor': 'viewer:user-1',
          'x-dashboard-tenant': 'tenant-1',
        }),
      ),
    UnauthorizedException,
  );
});

test('AdminKeyGuard keeps customer access for explicitly allowed customer routes', () => {
  process.env.DASHBOARD_INTERNAL_TOKEN = DASHBOARD_TOKEN;
  const guard = createGuard(['customer']);
  const request = {
    headers: {
      'x-dashboard-token': DASHBOARD_TOKEN,
      'x-dashboard-role': 'customer',
      'x-dashboard-actor': 'customer:user-1',
      'x-dashboard-tenant': 'tenant-1',
    },
  };

  const allowed = guard.canActivate({
    switchToHttp() {
      return {
        getRequest() {
          return request;
        },
      };
    },
    getHandler() {
      return function handler() {};
    },
    getClass() {
      return function Controller() {};
    },
  });

  assert.equal(allowed, true);
  assert.equal(request.dashboardAuth.role, 'customer');
  assert.equal(request.dashboardAuth.tenantId, 'tenant-1');
});
