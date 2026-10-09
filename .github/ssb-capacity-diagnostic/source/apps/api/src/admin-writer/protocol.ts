import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';

export type WriterRequest = {
  version: 1;
  id: string;
  issuedAt: number;
  expiresAt: number;
  method: string;
  path: string;
  body: Record<string, unknown>;
  session: { role: string; sub: string; exp: number; tenantId?: string; tenantUserId?: string };
  authorization?: string;
  sessionProof?: string;
};

// Closed route vocabulary, not a SQL, URL or method proxy.
export function writerRoute(method: string, path: string): boolean {
  // Encoded identifiers remain a single route segment; SQL receives the decoded ID.
  if (/%(?![0-9a-f]{2})/i.test(path)) return false;
  path = path.replace(/%[0-9a-f]{2}/gi, '_');
  if (method === 'POST' && ['/admin/sites', '/admin/tenants', '/admin/tenant-users'].includes(path)) return true;
  if (method === 'POST' && path === '/admin/tenant-users/authenticate') return true;
  if (method === 'PATCH' && path === '/admin/billing/plan') return true;
  if (/^\/admin\/sites\/[A-Za-z0-9_-]+$/.test(path)) return ['DELETE', 'PATCH'].includes(method);
  if (/^\/admin\/sites\/[A-Za-z0-9_-]+\/(?:privacy\/)?delete-data$/.test(path)) return method === 'POST';
  if (/^\/customer\/it-knowledge\/[A-Za-z0-9_-]+\/templates\/[A-Za-z0-9_-]+$/.test(path)) return method === 'DELETE';
  if (/^\/admin\/ingest\/(?:sources|knowledge)\/[A-Za-z0-9_-]+$/.test(path)) return method === 'DELETE';
  if (/^\/admin\/tenant-users\/[A-Za-z0-9_-]+$/.test(path)) return method === 'PATCH';
  if (/^\/admin\/tenant-users\/[A-Za-z0-9_-]+\/customer-workspace-access$/.test(path)) return ['PUT', 'DELETE'].includes(method);
  return method === 'POST' && /^\/internal\/site-runtime-(?:llm-)?grants\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+\/revoke)?$/.test(path);
}

export function verifyWriterRequest(payload: string, signature: string, key: string): WriterRequest {
  if (key.length < 64 || Buffer.byteLength(payload) > 65536 || !/^[a-f0-9]{64}$/.test(signature)) throw new UnauthorizedException();
  const expected = createHmac('sha256', key).update(payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new UnauthorizedException();
  let value: WriterRequest;
  try { value = JSON.parse(payload); } catch { throw new BadRequestException('Invalid request'); }
  const now = Date.now();
  if (!value || value.version !== 1 || !/^[a-f0-9-]{36}$/.test(value.id)
    || !Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt)
    || value.issuedAt > now || value.expiresAt <= now || value.expiresAt - value.issuedAt > 30000
    || value.expiresAt <= value.issuedAt || !writerRoute(value.method, value.path)
    || !value.body || typeof value.body !== 'object' || Array.isArray(value.body)
    || !value.session || !['admin', 'operator', 'customer', 'login'].includes(value.session.role)
    || typeof value.session.sub !== 'string' || !value.session.sub
    || !Number.isSafeInteger(value.session.exp) || value.session.exp < value.expiresAt
    || Object.keys(value).some(k => !['version','id','issuedAt','expiresAt','method','path','body','session','authorization','sessionProof'].includes(k))) {
    throw new UnauthorizedException();
  }
  if (value.path === '/admin/tenant-users/authenticate') {
    if (value.session.role !== 'login') throw new UnauthorizedException();
  } else {
    const token = value.authorization?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (!token || !/^[a-f0-9]{64}$/.test(value.sessionProof || '')) throw new UnauthorizedException();
    const proof = createHmac('sha256', key).update(`writer-session-v1:${token}`).digest();
    if (!timingSafeEqual(proof, Buffer.from(value.sessionProof!, 'hex'))) throw new UnauthorizedException();
    let claims: WriterRequest['session'];
    try { claims = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')); }
    catch { throw new UnauthorizedException(); }
    for (const field of ['role','sub','exp','tenantId','tenantUserId'] as const) {
      if (claims[field] !== value.session[field]) throw new UnauthorizedException();
    }
    if (value.session.role === 'login') throw new UnauthorizedException();
  }
  return value;
}
