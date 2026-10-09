import { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DashboardSessionCredential } from '../../lib/auth';

const require = createRequire(import.meta.url);
const { verifyWriterRequest } = require('../../../api/dist/admin-writer/protocol');
export const WRITER_ORIGIN = 'http://writer.synthetic.invalid:3011';

export function writerFixture() {
  const root = mkdtempSync(join(tmpdir(), 'writer-transport-test-'));
  const key = randomBytes(32).toString('hex');
  const file = join(root, 'synthetic-key');
  writeFileSync(file, key, { mode: 0o600 });
  const old = { ADMIN_WRITER_BASE_URL: process.env.ADMIN_WRITER_BASE_URL,
    ADMIN_WRITER_SIGNING_KEY_FILE: process.env.ADMIN_WRITER_SIGNING_KEY_FILE };
  process.env.ADMIN_WRITER_BASE_URL = WRITER_ORIGIN;
  process.env.ADMIN_WRITER_SIGNING_KEY_FILE = file;
  after(() => {
    for (const [k,v] of Object.entries(old)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    rmSync(root, { recursive: true });
  });
  return {
    credential(tenantId: string, tenantUserId: string): DashboardSessionCredential {
      const now = Date.now();
      const session = { role: 'customer' as const, sub: `customer:${tenantId}:synthetic@example.invalid`, tenantId, tenantUserId,
        email: 'synthetic@example.invalid', displayName: 'Synthetic', iat: now, exp: now + 3600000,
        sessionIssuedAt: new Date(now).toISOString(), sessionExpiresAt: new Date(now + 3600000).toISOString() };
      const encoded = Buffer.from(JSON.stringify(session)).toString('base64url');
      const token = `${encoded}.${createHmac('sha256', key).update(encoded).digest('hex')}`;
      return { session, token, writerProof: createHmac('sha256', key).update(`writer-session-v1:${token}`).digest('hex') };
    },
    verify(call: { input: string; init: RequestInit }) {
      assert.equal(call.input, `${WRITER_ORIGIN}/v1/write`);
      assert.equal(call.init.method, 'POST');
      assert.equal(call.init.redirect, 'error');
      const headers = new Headers(call.init.headers);
      assert.equal(headers.get('authorization'), null);
      assert.equal(headers.get('x-dashboard-token'), null);
      return verifyWriterRequest(call.init.body as string, headers.get('x-admin-writer-signature'), key);
    },
  };
}
