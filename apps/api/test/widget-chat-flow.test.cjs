const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetSessionService } = require('../dist/modules/widget/services/widget-session.service.js');
const { WidgetChatService } = require('../dist/modules/widget/services/widget-chat.service.js');

test('widget chat flow can create a session and return an assistant reply', async () => {
  const dbCalls = [];
  let sessionInsertCount = 0;

  const db = {
    async query(sql, params) {
      dbCalls.push({ sql, params });

      if (/FROM widget_sessions\s+WHERE site_id = \$1 AND visitor_id = \$2/i.test(sql)) {
        return { rows: [] };
      }

      if (/INSERT INTO widget_sessions/i.test(sql)) {
        sessionInsertCount += 1;
        return { rows: [] };
      }

      if (/SELECT m\.id, c\.session_id, m\.role, m\.content, m\.created_at/i.test(sql)) {
        return {
          rows: [
            {
              id: 'msg-assistant',
              session_id: params[1],
              role: 'assistant',
              content: 'Wir koennen euch im Support gut entlasten.',
              created_at: '2026-04-27T10:00:01.000Z',
            },
            {
              id: 'msg-user',
              session_id: params[1],
              role: 'user',
              content: 'Ich brauche KI fuer den Support',
              created_at: '2026-04-27T10:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const widgetConfigService = {
    async getSiteByKey(siteKey) {
      return {
        id: 'site-1',
        tenantId: 'tenant-1',
        publicKey: 'pk_test',
        public_key: 'pk_test',
        siteKey,
        isActive: true,
      };
    },
  };

  const sessionService = new WidgetSessionService(db, widgetConfigService);
  const session = await sessionService.createOrResume(
    {
      siteKey: 'soule-smart-business',
      visitorId: 'visitor-1',
      sourceUrl: 'https://soulesmartbusiness.com/kontakt',
      userAgent: 'node-test',
    },
    'https://soulesmartbusiness.com',
    { headers: { 'user-agent': 'node-test' } },
  );

  assert.ok(session.id);
  assert.equal(session.siteId, 'site-1');
  assert.equal(session.visitorId, 'visitor-1');
  assert.equal(sessionInsertCount, 1);

  const widgetChatService = new WidgetChatService(
    widgetConfigService,
    db,
    {
      async enforceOrigin() {},
      async assertSessionBelongsToSite() {},
      async enforceRateLimit() {},
      getClientIp() {
        return '127.0.0.1';
      },
    },
    {
      async process(input) {
        return {
          sessionId: input.sessionId,
          conversationId: 'conversation-1',
          answer: 'Wir koennen euch im Support gut entlasten.',
          parts: [{ kind: 'text', text: 'Wir koennen euch im Support gut entlasten.' }],
          sources: [],
        };
      },
    },
  );

  const reply = await widgetChatService.sendMessage(
    {
      siteKey: 'soule-smart-business',
      sessionId: session.id,
      message: 'Ich brauche KI fuer den Support',
    },
    'https://soulesmartbusiness.com',
    { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
  );

  assert.equal(reply.sessionId, session.id);
  assert.equal(reply.answer, 'Wir koennen euch im Support gut entlasten.');
  assert.equal(reply.messages.length, 2);
  assert.equal(reply.messages[0].role, 'user');
  assert.equal(reply.messages[1].role, 'assistant');
  assert.equal(reply.messages[1].content, 'Wir koennen euch im Support gut entlasten.');
});
