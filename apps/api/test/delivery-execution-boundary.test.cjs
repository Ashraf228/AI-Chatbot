const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildBlockedExecutionPlan,
  buildDeliveryExecutionPlan,
  buildEmailQueueExecutionPlan,
  buildNoopExecutionPlan,
  buildSafeDeliveryExecutionPlanForAudit,
  buildSafeDeliveryExecutionPlanForLog,
  isEmailQueueDeliveryCommand,
  isNoopDeliveryCommand,
  isUnsupportedDeliveryCommand,
  validateDeliveryCommandForExecution,
  validateEmailQueueCommand,
} = require('../dist/chat/delivery-execution.boundary.js');
const {
  buildNoopDeliveryCommand,
  buildQueueEmailJobCommand,
} = require('../dist/chat/delivery-side-effect.commands.js');
const {
  buildLeadEmailJobPayload,
} = require('../dist/chat/delivery-payload.builders.js');

function buildEmailPayload(overrides = {}) {
  const payload = buildLeadEmailJobPayload({
    mail: {
      to: 'team@example.test',
      subject: 'Neue Anfrage von max@example.test',
      html: '<p>Telefon +49 155 11410215</p>',
      text: 'Kontakt: max@example.test / +49 155 11410215',
    },
    tenantId: 'tenant-1',
    siteId: 'site-1',
    sessionId: 'session-1',
    leadId: 'lead-1',
    contact: {
      name: 'Max Mustermann',
      email: 'max@example.test',
      phone: '+49 155 11410215',
      concern: 'Beratung',
    },
    scheduleIntent: false,
  });

  return {
    ...payload,
    ...overrides,
    metadata: {
      ...payload.metadata,
      ...(overrides.metadata || {}),
    },
  };
}

test('delivery execution boundary classifies supported and unsupported command objects', () => {
  const emailCommand = buildQueueEmailJobCommand({ payload: buildEmailPayload() });
  const noopCommand = buildNoopDeliveryCommand({
    reasonCode: 'delivery_channel_disabled',
    channel: 'email',
  });
  const unsupportedCommand = { type: 'queue_webhook_job', payload: { webhookUrl: 'https://hooks.example.test' } };

  assert.equal(isEmailQueueDeliveryCommand(emailCommand), true);
  assert.equal(isNoopDeliveryCommand(emailCommand), false);
  assert.equal(isNoopDeliveryCommand(noopCommand), true);
  assert.equal(isEmailQueueDeliveryCommand(noopCommand), false);
  assert.equal(isUnsupportedDeliveryCommand(unsupportedCommand), true);
  assert.equal(isUnsupportedDeliveryCommand(null), true);
});

test('delivery execution boundary validates email queue commands as data only', () => {
  const validCommand = buildQueueEmailJobCommand({ payload: buildEmailPayload() });
  const missingPayloadCommand = { type: 'queue_email_job', reasonCode: 'lead_email_ready' };
  const missingRecipientCommand = buildQueueEmailJobCommand({
    payload: buildEmailPayload({ recipientEmail: '   ' }),
  });
  const invalidPayloadCommand = buildQueueEmailJobCommand({
    payload: buildEmailPayload({ subject: '', html: null, text: null }),
  });

  assert.deepEqual(validateDeliveryCommandForExecution(validCommand), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateEmailQueueCommand(validCommand), {
    valid: true,
    reasonCode: 'lead_email_ready',
  });
  assert.deepEqual(validateDeliveryCommandForExecution(missingPayloadCommand), {
    valid: false,
    reasonCode: 'missing_email_job_payload',
    errorCode: 'missing_payload',
  });
  assert.deepEqual(validateEmailQueueCommand(missingRecipientCommand), {
    valid: false,
    reasonCode: 'missing_email_recipient',
    errorCode: 'missing_recipient',
  });
  assert.deepEqual(validateEmailQueueCommand(invalidPayloadCommand), {
    valid: false,
    reasonCode: 'invalid_email_job_payload',
    errorCode: 'invalid_payload',
  });
});

test('delivery execution boundary accepts noop commands without payload', () => {
  const noopCommand = buildNoopDeliveryCommand({
    reasonCode: 'missing_delivery_target',
    channel: 'system',
  });

  assert.deepEqual(validateDeliveryCommandForExecution(noopCommand), {
    valid: true,
    reasonCode: 'missing_delivery_target',
  });
  assert.deepEqual(buildNoopExecutionPlan(noopCommand), {
    action: 'noop',
    reasonCode: 'missing_delivery_target',
    channel: 'system',
  });
  assert.deepEqual(buildDeliveryExecutionPlan(noopCommand), {
    action: 'noop',
    reasonCode: 'missing_delivery_target',
    channel: 'system',
  });
});

test('delivery execution boundary builds queue, noop and blocked execution plans', () => {
  const payload = buildEmailPayload();
  const emailCommand = buildQueueEmailJobCommand({ payload });
  const noopCommand = buildNoopDeliveryCommand({ reasonCode: 'missing_email_target', channel: 'email' });
  const unsupportedCommand = { type: 'queue_webhook_job', payload: { webhookUrl: 'https://hooks.example.test' } };
  const invalidCommand = buildQueueEmailJobCommand({ payload: buildEmailPayload({ recipientEmail: '' }) });

  assert.deepEqual(buildEmailQueueExecutionPlan(emailCommand), {
    action: 'queue_email_job',
    commandType: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload,
  });
  assert.equal(buildDeliveryExecutionPlan(emailCommand).action, 'queue_email_job');
  assert.equal(buildDeliveryExecutionPlan(noopCommand).action, 'noop');
  assert.deepEqual(buildDeliveryExecutionPlan(unsupportedCommand), {
    action: 'blocked',
    reasonCode: 'delivery_execution_blocked',
    errorCode: 'unsupported_command_type',
  });
  assert.deepEqual(buildDeliveryExecutionPlan(invalidCommand), {
    action: 'blocked',
    reasonCode: 'missing_email_recipient',
    errorCode: 'missing_recipient',
  });
  assert.deepEqual(buildBlockedExecutionPlan('manual_block', 'invalid_payload'), {
    action: 'blocked',
    reasonCode: 'manual_block',
    errorCode: 'invalid_payload',
  });
});

test('delivery execution boundary builds log and audit safe projections without mutating input', () => {
  const payload = Object.freeze({
    ...buildEmailPayload(),
    apiKey: 'dummy-api-key',
    signingSecret: 'dummy-signing-secret',
    headers: Object.freeze({
      authorization: 'Bearer dummy-token',
      'x-trace-id': 'trace-1',
    }),
    metadata: Object.freeze({
      ...buildEmailPayload().metadata,
      token: 'dummy-token',
    }),
  });
  const plan = Object.freeze({
    action: 'queue_email_job',
    commandType: 'queue_email_job',
    reasonCode: 'lead_email_ready',
    payload,
  });

  const logSafe = buildSafeDeliveryExecutionPlanForLog(plan);
  const auditSafe = buildSafeDeliveryExecutionPlanForAudit(plan);

  for (const projection of [logSafe, auditSafe]) {
    const serialized = JSON.stringify(projection);
    assert.equal(serialized.includes('team@example.test'), false);
    assert.equal(serialized.includes('max@example.test'), false);
    assert.equal(serialized.includes('+49 155 11410215'), false);
    assert.equal(serialized.includes('dummy-api-key'), false);
    assert.equal(serialized.includes('dummy-signing-secret'), false);
    assert.equal(serialized.includes('dummy-token'), false);
    assert.equal(serialized.includes('apiKey'), false);
    assert.equal(serialized.includes('signingSecret'), false);
    assert.equal(serialized.includes('authorization'), false);
    assert.equal(serialized.includes('token'), false);
    assert.equal(serialized.includes('[redacted-email]'), true);
    assert.equal(serialized.includes('[redacted-phone]'), true);
  }

  assert.equal(plan.payload.recipientEmail, 'team@example.test');
  assert.equal(plan.payload.apiKey, 'dummy-api-key');
  assert.equal(plan.payload.headers.authorization, 'Bearer dummy-token');
});

test('delivery execution boundary stays unwired and side-effect free', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../src/chat/delivery-execution.boundary.ts'),
    'utf8',
  );

  assert.doesNotMatch(source, /\bdb\./);
  assert.doesNotMatch(source, /PrismaService|email_jobs|webhook_jobs|widget_leads|agent_tickets|audit_logs/);
  assert.doesNotMatch(source, /logEvent|process\.env|fetch\(|axios|createHmac/);
  assert.doesNotMatch(source, /\basync\b/);
  assert.doesNotMatch(source, /EmailJobsService|WebhookJobsService|ToolExecutor|ToolDispatcher|IntegrationEventDispatcher/);
  assert.doesNotMatch(source, /INSERT INTO|UPDATE |DELETE FROM/);

  const orchestratorSource = fs.readFileSync(
    path.join(__dirname, '../src/chat/chat-agent-orchestrator.service.ts'),
    'utf8',
  );
  assert.equal(orchestratorSource.includes('delivery-execution.boundary'), false);
});
