import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('../lib/auth', () => ({getDashboardSessionCredential:vi.fn()}));
import { fetchDashboardBackend, getDashboardBackendHeaders } from '../lib/dashboard-api';
import { createCustomerWorkspaceProxyAuthorizer } from '../lib/customer-workspace-proxy';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('dedicated writer and dashboard token binding', () => {
  it('does not fall back to an inherited ADMIN_KEY', () => {
    vi.stubEnv('DASHBOARD_INTERNAL_TOKEN', '');
    vi.stubEnv('ADMIN_KEY', 'synthetic-old-admin');
    expect(() => getDashboardBackendHeaders()).toThrow('DASHBOARD_INTERNAL_TOKEN missing');
    vi.stubEnv('DASHBOARD_INTERNAL_TOKEN', 'synthetic-dedicated');
    expect(getDashboardBackendHeaders()['x-dashboard-token']).toBe('synthetic-dedicated');
  });
  it('missing writer binding never redirects a write to the legacy API', async () => {
    vi.stubEnv('BACKEND_BASE_URL', 'http://synthetic-api.invalid');
    vi.stubEnv('ADMIN_WRITER_BASE_URL', '');
    const transport = vi.fn(); vi.stubGlobal('fetch', transport);
    const response = await fetchDashboardBackend('/admin/tenant-users/authenticate', {
      method: 'POST', body: JSON.stringify({ tenantId: 'synthetic' }),
    });
    expect(response.status).toBe(503);
    expect(transport).not.toHaveBeenCalled();
  });
  it('uses the actual public-origin variable for scoped Customer writes', async () => {
    vi.stubEnv('DASHBOARD_PUBLIC_URL','https://synthetic.invalid');
    const authorize=createCustomerWorkspaceProxyAuthorizer({getSessionCredential:async()=>({token:'synthetic',
      session:{role:'customer',tenantId:'synthetic',tenantUserId:'synthetic-user',issuedAt:1,expiresAt:2}})});
    const request=new Request('https://synthetic.invalid/api/sites/synthetic/config',{method:'PUT',
      headers:{origin:'https://synthetic.invalid','sec-fetch-site':'same-origin'}});
    expect((await authorize(request,{mutating:true})).response).toBeNull();
    vi.stubEnv('DASHBOARD_PUBLIC_URL','');
    expect((await authorize(request,{mutating:true})).response?.status).toBe(500);
  });
});
