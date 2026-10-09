import { createHmac, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import type { DashboardSession } from './auth-core';
import { SESSION_COOKIE_NAME } from './auth-core';
import { writerSigningKey, WRITER_SESSION_COOKIE } from './admin-writer-session';

export function isAdminWriterRoute(method: string, path: string): boolean {
  if (/%(?![0-9a-f]{2})/i.test(path)) return false;
  path = path.replace(/%[0-9a-f]{2}/gi, '_');
  if (method === 'POST' && ['/admin/sites','/admin/tenants','/admin/tenant-users'].includes(path)) return true;
  if (method === 'POST' && path === '/admin/tenant-users/authenticate') return true;
  if (method === 'PATCH' && path === '/admin/billing/plan') return true;
  if (/^\/admin\/sites\/[A-Za-z0-9_-]+$/.test(path)) return ['DELETE','PATCH'].includes(method);
  if (/^\/admin\/sites\/[A-Za-z0-9_-]+\/(?:privacy\/)?delete-data$/.test(path)) return method === 'POST';
  if (/^\/customer\/it-knowledge\/[A-Za-z0-9_-]+\/templates\/[A-Za-z0-9_-]+$/.test(path)) return method === 'DELETE';
  if (/^\/admin\/ingest\/(?:sources|knowledge)\/[A-Za-z0-9_-]+$/.test(path)) return method === 'DELETE';
  if (/^\/admin\/tenant-users\/[A-Za-z0-9_-]+$/.test(path)) return method === 'PATCH';
  if (/^\/admin\/tenant-users\/[A-Za-z0-9_-]+\/customer-workspace-access$/.test(path)) return ['PUT','DELETE'].includes(method);
  return method === 'POST' && /^\/internal\/site-runtime-(?:llm-)?grants\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+\/revoke)?$/.test(path);
}

/** Call only after the existing BFF session and origin checks. Never forward caller signatures. */
export async function fetchAdminWriter(path: string, init: RequestInit, session: DashboardSession | null,
  fetchImpl: typeof fetch = fetch, credential?: { token: string; writerProof?: string }): Promise<Response> {
  const unavailable = () => Response.json({ message: 'Writer unavailable' }, { status: 503 });
  try {
    const method = (init.method || 'GET').toUpperCase();
    const login = path === '/admin/tenant-users/authenticate' && method === 'POST';
    if (!isAdminWriterRoute(method, path) || (!login && (!session || session.role === 'viewer'))) return Response.json({ message: 'Forbidden' }, { status: 403 });
    const base = new URL(process.env.ADMIN_WRITER_BASE_URL || '');
    if (!['http:','https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) return unavailable();
    const key = writerSigningKey();
    const now = Date.now();
    const claims = login ? { role: 'login', sub: 'login', exp: now + 30000, tenantId: undefined, tenantUserId: undefined } : session!;
    let token: string | undefined, sessionProof: string | undefined;
    if (!login) {
      if (credential) { token = credential.token; sessionProof = credential.writerProof; }
      else {
        const jar = await cookies();
        token = jar.get(SESSION_COOKIE_NAME)?.value;
        sessionProof = jar.get(WRITER_SESSION_COOKIE)?.value;
      }
      if (!token || !sessionProof) return Response.json({ message: 'Please sign in again' }, { status: 401 });
    }
    if (claims.exp <= now) return Response.json({ message: 'Unauthorized' }, { status: 401 });
    const payload = JSON.stringify({ version: 1, id: randomUUID(), issuedAt: now,
      expiresAt: Math.min(now + 30000, claims.exp), method, path,
      body: typeof init.body === 'string' && init.body ? JSON.parse(init.body) : {},
      session: { role: claims.role, sub: claims.sub, exp: claims.exp,
        tenantId: claims.tenantId, tenantUserId: claims.tenantUserId },
      authorization: token ? `Bearer ${token}` : undefined, sessionProof });
    const response = await fetchImpl(`${base.origin}/v1/write`, { method: 'POST', body: payload,
      headers: { 'Content-Type':'application/json', 'X-Admin-Writer-Signature': createHmac('sha256', key).update(payload).digest('hex') },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
    const creates = method === 'POST' && ['/admin/sites','/admin/tenants','/admin/tenant-users'].includes(path)
      || method === 'POST' && path.startsWith('/internal/') && !path.endsWith('/revoke');
    return new Response(await response.text(), { status: response.ok && creates ? 201 : response.status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch { return unavailable(); }
}
