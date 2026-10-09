import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/** A separate credential authorizes only the four existing reporter GET consumers. */
export function reporterAccess(request: { method: string; originalUrl?: string; url: string; headers: Record<string, unknown> }) {
  const token = request.headers['x-reporter-token'];
  if (token === undefined) return undefined;
  const expected = process.env.REPORTER_API_TOKEN || '';
  if (typeof token !== 'string' || expected.length < 32 || Buffer.byteLength(token) !== Buffer.byteLength(expected)
    || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new UnauthorizedException('Unauthorized');
  const url = new URL(request.originalUrl || request.url, 'http://internal.invalid');
  const match = /^\/admin\/widget\/sites\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
  if (request.method !== 'GET' || !match && !['/admin/widget/events/summary','/admin/widget/optimization','/admin/widget/report-subscriptions'].includes(url.pathname)) throw new ForbiddenException('Forbidden');
  if ([...url.searchParams.keys()].some(k => k !== 'siteId') || url.searchParams.getAll('siteId').length > 1) throw new ForbiddenException('Forbidden');
  const siteId = match?.[1] || url.searchParams.get('siteId');
  let bindings: unknown;
  try { bindings = JSON.parse(process.env.REPORTER_SITE_BINDINGS || ''); } catch { throw new ForbiddenException('Forbidden'); }
  if (!Array.isArray(bindings) || bindings.some(b => !b || typeof b.siteId !== 'string' || typeof b.tenantId !== 'string')
    || new Set(bindings.map(b => b.siteId)).size !== bindings.length) throw new ForbiddenException('Forbidden');
  const binding = bindings.find(b => b.siteId === siteId);
  if (!binding) throw new ForbiddenException('Forbidden');
  return { role: 'operator', actorId: 'reporter', tenantId: binding.tenantId, authMode: 'reporter-read-only' };
}
