const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, ForbiddenException } = require('@nestjs/common');
const { EvaluationService } = require('../dist/evaluation/evaluation.service.js');

const access = {
  tenantUserId: 'viewer-1',
  tenantId: 'tenant-1',
  siteId: 'site-demo',
  viewerEmail: 'viewer@example.test',
  viewerDisplayName: 'Demo Viewer',
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
      if (/SELECT config FROM sites/i.test(sql)) {
        return { rows: [{ config: overrides.siteConfig || null }] };
      }
      return { rows: [] };
    },
  };
  const service = new EvaluationService(
    db,
    {
      async process(input) {
        if (overrides.capturePipelineInput) {
          overrides.capturePipelineInput(input);
        }
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

function createProductService(overrides = {}) {
  const auditRecords = [];
  const state = {
    previews: [],
    tickets: [],
    queries: [],
  };
  const siteConfig = overrides.siteConfig || {
    evaluationWorkspace: { supportProfile: 'product' },
    moduleConfigs: {
      'it-support': {
        supportProfile: 'product',
        requiredFields: ['product', 'module', 'customerOrganization', 'description', 'impact'],
        allowExternalForwarding: false,
        collectContactFromAuthenticatedAccount: true,
        syntheticOrganizationLabel: 'Beispielkommune - Demonstrator',
      },
    },
  };
  const query = async (sql, params = []) => {
    state.queries.push({ sql, params });
    if (/FROM evaluation_chat_sessions/i.test(sql)) {
      return {
        rows: [
          {
            id: 'eval-session-1',
            tenant_user_id: 'viewer-1',
            tenant_id: 'tenant-1',
            site_id: 'site-demo',
            conversation_session_id: 'evaluation:eval-session-1',
            conversation_id: null,
            expires_at: '2099-01-01T00:00:00.000Z',
          },
        ],
      };
    }
    if (/SELECT config FROM sites/i.test(sql)) {
      return { rows: [{ config: siteConfig }] };
    }
    if (/FROM evaluation_ticket_previews/i.test(sql) && /ORDER BY created_at DESC/i.test(sql)) {
      return {
        rows: state.previews.filter((preview) => ['collecting', 'pending'].includes(preview.status)).slice(-1),
      };
    }
    if (/INSERT INTO evaluation_ticket_previews/i.test(sql)) {
      const preview = JSON.parse(params[8]);
      state.previews.push({
        id: params[0],
        preview_token_hash: params[1],
        tenant_user_id: params[2],
        tenant_id: params[3],
        site_id: params[4],
        evaluation_chat_session_id: params[5],
        conversation_id: params[6],
        content_hash: params[7],
        preview,
        status: params[9],
        ticket_id: null,
        demo_reference: null,
        expires_at: params[10],
        created_at: '2026-01-01T00:00:00.000Z',
      });
      return { rows: [] };
    }
    if (/UPDATE evaluation_ticket_previews/i.test(sql) && /status = 'superseded'/i.test(sql)) {
      state.previews.forEach((preview) => {
        if (preview.status === 'pending') preview.status = 'superseded';
      });
      return { rows: [] };
    }
    if (/UPDATE evaluation_ticket_previews/i.test(sql) && /status = 'cancelled'/i.test(sql)) {
      const preview = state.previews.find((entry) =>
        entry.preview_token_hash === params[0] &&
        entry.tenant_user_id === params[1] &&
        entry.tenant_id === params[2] &&
        entry.site_id === params[3] &&
        entry.conversation_id === params[4] &&
        entry.status === 'pending'
      );
      if (preview) {
        preview.status = 'cancelled';
        return { rows: [{ id: preview.id }] };
      }
      return { rows: [] };
    }
    if (/FROM evaluation_ticket_previews/i.test(sql) && /preview_token_hash = \$1/i.test(sql)) {
      return { rows: state.previews.filter((preview) => preview.preview_token_hash === params[0]) };
    }
    if (/INSERT INTO agent_tickets/i.test(sql)) {
      if (!state.tickets.some((ticket) => ticket.confirmationId === params[22])) {
        state.tickets.push({
          id: params[0],
          tenantId: params[1],
          siteId: params[2],
          description: params[5],
          reporterEmail: params[7],
          metadata: JSON.parse(params[9]),
          product: params[10],
          module: params[11],
          customerOrganization: params[12],
          impact: params[15],
          forwardingStatus: 'not_configured',
          demoReference: params[21],
          confirmationId: params[22],
        });
      }
      return { rows: [] };
    }
    if (/SELECT id FROM agent_tickets WHERE confirmation_id/i.test(sql)) {
      const ticket = state.tickets.find((entry) => entry.confirmationId === params[0]);
      return { rows: ticket ? [{ id: ticket.id }] : [] };
    }
    if (/UPDATE evaluation_ticket_previews/i.test(sql) && /status = 'confirmed'/i.test(sql)) {
      const preview = state.previews.find((entry) => entry.id === params[0]);
      if (preview) {
        preview.status = 'confirmed';
        preview.ticket_id = params[1];
        preview.demo_reference = params[2];
      }
      return { rows: [] };
    }
    return { rows: [] };
  };
  const db = {
    query,
    async transaction(callback) {
      return callback({ query });
    },
  };
  const service = new EvaluationService(
    db,
    {
      async process(input) {
        if (overrides.capturePipelineInput) overrides.capturePipelineInput(input);
        return {
          conversationId: 'conversation-1',
          sessionId: 'evaluation:eval-session-1',
          answer: 'Antwort aus Demo-Wissen.',
          parts: [],
          sources: [],
          toolResults: [],
        };
      },
    },
    { async record(entry) { auditRecords.push(entry); } },
    { async allow() { return { allowed: true, used: 1 }; } },
  );
  return { service, state, auditRecords };
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

test('EvaluationService reads dynamic demo scenarios from site config and enables evaluation retrieval mode', async () => {
  let pipelineInput = null;
  const scenarios = [
    { key: 'grounded-help', title: 'Soforthilfe', prompt: 'Wie pruefe ich den Status?' },
    { key: 'handoff-preview', title: 'Uebergabe', prompt: 'Bitte Uebergabe vorbereiten.' },
    { key: 'safe-non-answer', title: 'Nicht-Antwort', prompt: 'Trifft die KI eine Entscheidung?' },
  ];
  const { service } = createService({
    siteConfig: {
      evaluationWorkspace: {
        workspaceTitle: 'Partner Demo',
        scenarios,
        technicalFeatures: ['Demo-Scope', 'Keine Produktivdaten'],
      },
    },
    capturePipelineInput(input) {
      pipelineInput = input;
    },
  });

  const context = await service.context(access);
  assert.equal(context.workspaceTitle, 'Partner Demo');
  assert.deepEqual(context.scenarios.map((scenario) => scenario.key), scenarios.map((scenario) => scenario.key));
  assert.deepEqual(context.technicalFeatures, ['Demo-Scope', 'Keine Produktivdaten']);

  await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Wie pruefe ich den Status?',
  });
  assert.equal(pipelineInput.evaluationMode, true);
  assert.equal(pipelineInput.siteConfig.evaluationWorkspace.workspaceTitle, 'Partner Demo');
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

test('EvaluationService product profile answers knowledge first and then asks resolution check', async () => {
  const { service, state } = createProductService();
  const result = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Wie funktioniert der Formularstatus?',
  });

  assert.match(result.answer, /Konnte das Problem damit gelöst werden\?/);
  assert.equal(result.ticketPreview, null);
  assert.equal(state.tickets.length, 0);
});

test('EvaluationService creates sanitized product ticket preview without reporter email in browser DTO', async () => {
  const { service, state } = createProductService();
  const result = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload blockiert bei hoher Auswirkung. Authorization: Bearer very-secret-token-12345',
  });

  assert.equal(result.ticketPreview.status, 'ready');
  assert.ok(result.ticketPreview.previewToken);
  assert.equal(result.ticketPreview.fields.supportProfile, 'product');
  assert.equal(JSON.stringify(result.ticketPreview).includes('viewer@example.test'), false);
  assert.equal(JSON.stringify(result.ticketPreview).includes('very-secret-token-12345'), false);
  assert.equal(JSON.stringify(result.ticketPreview).includes('[REDACTED]'), true);
  assert.equal(state.tickets.length, 0);
});

test('EvaluationService confirms product preview idempotently and never queues external forwarding', async () => {
  const { service, state, auditRecords } = createProductService();
  const previewResult = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload blockiert bei hoher Auswirkung.',
  });

  const first = await service.confirmTicket(access, {
    conversationId: 'eval-session-1',
    previewToken: previewResult.ticketPreview.previewToken,
  });
  const second = await service.confirmTicket(access, {
    conversationId: 'eval-session-1',
    previewToken: previewResult.ticketPreview.previewToken,
  });

  assert.equal(first.status, 'created');
  assert.equal(second.demoReference, first.demoReference);
  assert.equal(first.forwardingStatus, 'not_configured');
  assert.equal(state.tickets.length, 1);
  assert.equal(state.tickets[0].forwardingStatus, 'not_configured');
  assert.equal(state.queries.some((call) => /webhook_jobs|email_jobs|integration/i.test(call.sql)), false);
  assert.equal(auditRecords.some((entry) => entry.action === 'evaluation_ticket_created'), true);
});

test('EvaluationService confirms stored product preview when JSONB changes field order', async () => {
  const { service, state } = createProductService();
  const previewResult = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload blockiert bei hoher Auswirkung.',
  });

  const storedPreview = state.previews.at(-1);
  storedPreview.preview.fields = Object.fromEntries(
    Object.entries(storedPreview.preview.fields).sort(([left], [right]) => right.localeCompare(left)),
  );

  const result = await service.confirmTicket(access, {
    conversationId: 'eval-session-1',
    previewToken: previewResult.ticketPreview.previewToken,
  });

  assert.equal(result.status, 'created');
  assert.equal(state.tickets.length, 1);
});

test('EvaluationService confirmation ignores optional null fields in stored preview snapshot', async () => {
  const { service, state } = createProductService();
  const previewResult = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload blockiert bei hoher Auswirkung.',
  });

  const storedPreview = state.previews.at(-1);
  storedPreview.preview.fields.browser = null;
  storedPreview.preview.fields.device = undefined;

  const result = await service.confirmTicket(access, {
    conversationId: 'eval-session-1',
    previewToken: previewResult.ticketPreview.previewToken,
  });

  assert.equal(result.status, 'created');
  assert.equal(state.tickets.length, 1);
});

test('EvaluationService rejects confirmation when stored preview business content changed', async () => {
  const { service, state } = createProductService();
  const previewResult = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload blockiert bei hoher Auswirkung.',
  });

  state.previews.at(-1).preview.fields.description = 'Fachlich veraenderte Beschreibung';

  await assert.rejects(
    () => service.confirmTicket(access, {
      conversationId: 'eval-session-1',
      previewToken: previewResult.ticketPreview.previewToken,
    }),
    /Ticket preview changed/,
  );
  assert.equal(state.tickets.length, 0);
});

test('EvaluationService rejects confirmation for other viewer, other site, expired or cancelled preview', async () => {
  const { service, state } = createProductService();
  const previewResult = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload blockiert bei hoher Auswirkung.',
  });

  await assert.rejects(
    () => service.confirmTicket({ ...access, tenantUserId: 'viewer-2' }, {
      conversationId: 'eval-session-1',
      previewToken: previewResult.ticketPreview.previewToken,
    }),
    ForbiddenException,
  );
  await assert.rejects(
    () => service.confirmTicket({ ...access, siteId: 'site-other' }, {
      conversationId: 'eval-session-1',
      previewToken: previewResult.ticketPreview.previewToken,
    }),
    ForbiddenException,
  );

  state.previews.at(-1).expires_at = '2000-01-01T00:00:00.000Z';
  await assert.rejects(
    () => service.confirmTicket(access, {
      conversationId: 'eval-session-1',
      previewToken: previewResult.ticketPreview.previewToken,
    }),
    ForbiddenException,
  );

  state.previews.at(-1).expires_at = '2099-01-01T00:00:00.000Z';
  const cancel = await service.cancelTicketPreview(access, {
    conversationId: 'eval-session-1',
    previewToken: previewResult.ticketPreview.previewToken,
  });
  assert.equal(cancel.status, 'cancelled');
  await assert.rejects(
    () => service.confirmTicket(access, {
      conversationId: 'eval-session-1',
      previewToken: previewResult.ticketPreview.previewToken,
    }),
    /Ticket preview is not confirmable/,
  );
});

test('EvaluationService rejects forbidden confirmation body fields', async () => {
  const { service } = createProductService();
  await assert.rejects(
    () => service.confirmTicket(access, {
      conversationId: 'conversation-1',
      previewToken: 'token',
      tenantId: 'other-tenant',
    }),
    BadRequestException,
  );
  await assert.rejects(
    () => service.confirmTicket(access, {
      conversationId: 'conversation-1',
      previewToken: 'token',
      ticketFields: { description: 'browser override' },
    }),
    BadRequestException,
  );
});

test('EvaluationService product collection reports missing impact before preview is confirmable', async () => {
  const { service, state } = createProductService();
  const result = await service.sendMessage(access, {
    conversationId: 'eval-session-1',
    message: 'Bitte Ticket melden: Formular Upload zeigt einen Fehler.',
  });

  assert.equal(result.ticketPreview.status, 'collecting');
  assert.deepEqual(result.ticketPreview.missingFields, ['impact']);
  assert.equal(result.ticketPreview.previewToken, undefined);
  assert.equal(state.tickets.length, 0);
});
