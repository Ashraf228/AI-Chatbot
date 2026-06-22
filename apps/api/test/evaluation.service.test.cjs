const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, ForbiddenException } = require('@nestjs/common');
const { EvaluationService } = require('../dist/evaluation/evaluation.service.js');

const access = {
  tenantUserId: 'viewer-1',
  tenantId: 'tenant-1',
  siteId: 'site-demo',
  siteDisplayName: 'Demo Site',
  accountExpiresAt: '2099-01-01T00:00:00.000Z',
  sessionExpiresAt: '2099-01-01T00:00:00.000Z',
  demoStatus: true,
};

function createService(overrides = {}) {
  const queries = [];
  const rateLimitKeys = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (/FROM evaluation_chat_sessions/i.test(sql)) {
        return {
          rows: [
            {
              id: 'eval-session-1',
              tenant_user_id: overrides.tenantUserId || 'viewer-1',
              tenant_id: overrides.tenantId || 'tenant-1',
              site_id: overrides.siteId || 'site-demo',
              conversation_session_id: 'evaluation:eval-session-1',
              conversation_id: null,
              expires_at: overrides.expiresAt || '2099-01-01T00:00:00.000Z',
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const service = new EvaluationService(
    db,
    {
      async process() {
        return {
          conversationId: 'conversation-1',
          sessionId: 'evaluation:eval-session-1',
          answer: 'Antwort aus Demo-Wissen.',
          parts: [],
          sources: [
            {
              title: 'Demo Quelle',
              type: 'faq',
              url: 'javascript:alert(1)',
              score: 0.9,
              metadata: {},
            },
          ],
          toolResults: [],
        };
      },
    },
    { async record() {} },
    {
      async allow(key) {
        rateLimitKeys.push(key);
        return { allowed: true, used: 1 };
      },
    },
  );
  return { service, queries, rateLimitKeys };
}

test('EvaluationService context returns sanitized DTO without internal IDs', async () => {
  const { service } = createService();
  const result = await service.context(access);
  const serialized = JSON.stringify(result);

  assert.equal(result.readOnly, true);
  assert.equal(result.demo, true);
  assert.equal(serialized.includes('tenant-1'), false);
  assert.equal(serialized.includes('viewer-1'), false);
  assert.equal(serialized.includes('site-demo'), false);
});

test('EvaluationService rejects tenantId, siteId and role in chat session requests', async () => {
  const { service } = createService();
  await assert.rejects(() => service.createChatSession(access, { tenantId: 'tenant-2' }), BadRequestException);
  await assert.rejects(() => service.createChatSession(access, { siteId: 'site-other' }), BadRequestException);
  await assert.rejects(() => service.createChatSession(access, { role: 'admin' }), BadRequestException);
});

test('EvaluationService scopes chat messages to current viewer and site', async () => {
  await assert.rejects(
    () => createService({ tenantUserId: 'viewer-2' }).service.sendMessage(access, {
      conversationId: 'eval-session-1',
      message: 'Hallo',
    }),
    ForbiddenException,
  );
  await assert.rejects(
    () => createService({ siteId: 'other-site' }).service.sendMessage(access, {
      conversationId: 'eval-session-1',
      message: 'Hallo',
    }),
    ForbiddenException,
  );
});

test('EvaluationService validates message body and strips unsafe source URLs', async () => {
  const { service, rateLimitKeys } = createService();
  await assert.rejects(
    () => service.sendMessage(access, { conversationId: 'eval-session-1', message: '' }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.sendMessage(access, { conversationId: 'eval-session-1', message: 'x'.repeat(2001) }),
    BadRequestException,
  );

  const result = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Was ist das?',
  }, '203.0.113.10');
  assert.equal(result.sources[0].publicUrl, undefined);
  assert.equal(JSON.stringify(result).includes('score'), false);
  assert.deepEqual(rateLimitKeys, ['evaluation:viewer-1', 'evaluation-ip:203.0.113.10']);
});
