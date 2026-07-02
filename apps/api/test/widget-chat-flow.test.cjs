const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetSessionService } = require('../dist/modules/widget/services/widget-session.service.js');
const { WidgetChatService } = require('../dist/modules/widget/services/widget-chat.service.js');
const {
  AssistantProfileResolverService,
} = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');
const {
  ResponseComposerService,
} = require('../dist/ai/chat-pipeline/response-composer.service.js');

function createDb(messages = []) {
  return {
    calls: [],
    async query(sql, params) {
      this.calls.push({ sql, params });

      if (/FROM widget_sessions\s+WHERE site_id = \$1 AND visitor_id = \$2/i.test(sql)) {
        return { rows: [] };
      }

      if (/INSERT INTO widget_sessions/i.test(sql)) {
        return { rows: [] };
      }

      if (/SELECT m\.id, c\.session_id, m\.role, m\.content, m\.created_at/i.test(sql)) {
        return { rows: messages };
      }

      return { rows: [] };
    },
  };
}

function createWidgetChatService({
  site,
  moduleConfigs = {},
  assistantProfiles = new AssistantProfileResolverService(),
  answer = 'Wir koennen euch im Support gut entlasten.',
  messages = [],
}) {
  const db = createDb(messages);
  const widgetConfigService = {
    async getSiteByKey(siteKey) {
      return {
        id: 'site-1',
        tenantId: 'tenant-1',
        publicKey: 'pk_test',
        public_key: 'pk_test',
        siteKey,
        isActive: true,
        config: {},
        ...site,
      };
    },
  };

  return {
    db,
    service: new WidgetChatService(
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
            answer,
            parts: [{ kind: 'text', text: answer }],
            sources: [],
          };
        },
      },
      {
        async listForSite() {
          return Object.entries(moduleConfigs).map(([key, config]) => ({
            key,
            config,
          }));
        },
      },
      assistantProfiles,
    ),
  };
}

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
    {
      async listForSite() {
        return [];
      },
    },
    new AssistantProfileResolverService(),
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
  assert.equal(reply.assistantProfileDebug, undefined);
  assert.equal(reply.assistantProfileMigrationPreview, undefined);
  assert.equal(reply.conversationEnginePreview, undefined);
  assert.equal(reply.conversationEngineCompare, undefined);
  assert.equal(reply.messages.length, 2);
  assert.equal(reply.messages[0].role, 'user');
  assert.equal(reply.messages[1].role, 'assistant');
  assert.equal(reply.messages[1].content, 'Wir koennen euch im Support gut entlasten.');
});

test('widget chat observes local-service AssistantProfile without changing the reply', async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const messages = [
      {
        id: 'msg-assistant',
        session_id: 'session-1',
        role: 'assistant',
        content: 'Antwort bleibt gleich.',
        created_at: '2026-04-27T10:00:01.000Z',
      },
    ];
    const { service } = createWidgetChatService({
      site: {
        id: 'site-local',
        config: {
          botType: 'handwerker-first-contact',
          industry: 'local-service-first-contact',
          leadCaptureEnabled: true,
          leadNotificationEmail: 'dispatch@example.test',
        },
        conversationFlow: {},
        leadCaptureEnabled: true,
        leadNotificationEmail: 'dispatch@example.test',
        industry: 'local-service-first-contact',
      },
      moduleConfigs: {
        'lead-sales': {
          intakeFlow: {
            templateKey: 'local-service-first-contact',
            requiredFields: ['problem', 'phone'],
            questionOrder: ['problem', 'fullAddress', 'phone'],
            questionTexts: {
              problem: 'Was ist passiert?',
              fullAddress: 'Adresse?',
              phone: 'Telefon?',
            },
          },
        },
      },
      answer: 'Antwort bleibt gleich.',
      messages,
    });

    const reply = await service.sendMessage(
      { siteKey: 'site-key', sessionId: 'session-1', message: 'Mein Klo ist verstopft' },
      'https://kunde.example',
      { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
    );

    assert.equal(reply.answer, 'Antwort bleibt gleich.');
    assert.equal(reply.assistantProfileDebug, undefined);
    assert.equal(reply.assistantProfileMigrationPreview, undefined);
    assert.equal(reply.conversationEnginePreview, undefined);
    assert.equal(reply.conversationEngineCompare, undefined);
    const joinedLogs = logs.map((entry) => entry.join(' ')).join('\n');
    assert.match(joinedLogs, /assistant_profile_resolved/);
    assert.match(joinedLogs, /local-service-first-contact/);
    assert.match(joinedLogs, /lead-sales\.intakeFlow/);
    assert.match(joinedLogs, /fullAddress/);
    assert.doesNotMatch(joinedLogs, /dispatch@example\.test/);
  } finally {
    console.log = originalLog;
  }
});

test('widget chat observes universal AssistantProfile for sites without flow', async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const { service } = createWidgetChatService({
      site: {
        id: 'site-generic',
        config: {},
        conversationFlow: {},
        leadCaptureEnabled: false,
      },
      answer: 'Allgemeine Antwort.',
    });

    const reply = await service.sendMessage(
      { siteKey: 'site-key', sessionId: 'session-1', message: 'Hallo' },
      'https://kunde.example',
      { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
    );

    assert.equal(reply.answer, 'Allgemeine Antwort.');
    const joinedLogs = logs.map((entry) => entry.join(' ')).join('\n');
    assert.match(joinedLogs, /assistant_profile_resolved/);
    assert.match(joinedLogs, /universal-assistant/);
  } finally {
    console.log = originalLog;
  }
});

test('widget chat keeps legacy behavior when AssistantProfile resolution fails', async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args);
  try {
    const { service } = createWidgetChatService({
      site: {
        id: 'site-error',
        config: {
          leadNotificationEmail: 'secret-recipient@example.test',
        },
      },
      assistantProfiles: {
        resolve() {
          throw new Error('resolver unavailable');
        },
      },
      answer: 'Antwort trotz Resolver-Fehler.',
    });

    const reply = await service.sendMessage(
      { siteKey: 'site-key', sessionId: 'session-1', message: 'Hallo' },
      'https://kunde.example',
      { headers: {}, socket: { remoteAddress: '127.0.0.1' } },
    );

    assert.equal(reply.answer, 'Antwort trotz Resolver-Fehler.');
    const joinedLogs = logs.map((entry) => entry.join(' ')).join('\n');
    assert.match(joinedLogs, /assistant_profile_resolution_failed/);
    assert.match(joinedLogs, /resolver unavailable/);
    assert.doesNotMatch(joinedLogs, /secret-recipient@example\.test/);
  } finally {
    console.log = originalLog;
  }
});

test('universal conversation guide does not turn generic required fields into local-service language', () => {
  const composer = new ResponseComposerService();
  const guide = composer.buildConversationGuide(
    [{ role: 'user', content: 'Hallo, ich brauche Hilfe.' }],
    {
      requiredFields: ['name', 'email', 'phone', 'request'],
      questionOrder: ['request', 'name', 'email', 'phone'],
      questionTexts: {
        request: 'Worum geht es?',
        phone: 'Telefon?',
      },
    },
    {
      botType: 'universal-assistant',
      assistantProfile: { profileKey: 'universal-assistant' },
    },
  );

  assert.doesNotMatch(
    guide,
    /Branche|Handwerker|lokaler Dienstleister|Einsatzadresse|vollständige Adresse|Dringlichkeit|vor Ort/i,
  );
  assert.match(guide, /Kontext|Ziel|Worum geht es/i);
});

test('explicit local-service conversation guide remains available for legacy sites', () => {
  const composer = new ResponseComposerService();
  const guide = composer.buildConversationGuide(
    [{ role: 'user', content: 'Mein Klo ist verstopft.' }],
    {
      templateKey: 'local-service-first-contact',
      requiredFields: ['problem', 'urgency', 'fullAddress', 'phone'],
      questionOrder: ['problem', 'urgency', 'fullAddress', 'phone'],
      questionTexts: {
        fullAddress: 'Bitte nennen Sie die vollständige Einsatzadresse.',
      },
    },
    {
      botType: 'handwerker-first-contact',
    },
  );

  assert.match(guide, /local_service_intake/);
  assert.match(guide, /Einsatzadresse|Dringlichkeit/i);
});
