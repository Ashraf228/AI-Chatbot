const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AssistantProfileSaveService,
} = require('../dist/assistant-profiles/assistant-profile-save.service.js');
const {
  AssistantProfileResolverService,
} = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');

function createSaveService() {
  const updates = [];
  const audits = [];
  const diagnostics = {
    async getDiagnostics() {
      return {
        assistantProfileDebug: {
          profileKey: 'universal-assistant',
          profileVersion: 1,
          legacySource: 'assistantProfile',
          deliveryChannels: [
            { type: 'email', enabled: true, status: 'configured' },
            { type: 'webhook', enabled: false, status: 'inactive' },
          ],
        },
      };
    },
  };
  const siteModules = {
    async updateForSite(siteId, modules) {
      updates.push({ siteId, modules });
      return [];
    },
  };
  const auditLogs = {
    async record(entry) {
      audits.push(entry);
    },
  };

  return {
    service: new AssistantProfileSaveService(diagnostics, siteModules, auditLogs),
    updates,
    audits,
  };
}

function validPayload(overrides = {}) {
  return {
    updatedFrom: 'dashboard-wizard',
    assistantProfile: {
      profileKey: 'universal-assistant',
      profileVersion: 1,
      assistantName: 'KI-Mitarbeiter',
      role: 'Support und Beratung',
      businessDescription: 'Beantwortet Fragen und sammelt strukturierte Anliegen.',
      targetUsers: ['website_visitors'],
      tone: 'professional',
      answerStyle: 'concise',
      knowledgeMode: 'grounded',
      enabledTasks: ['answer_questions', 'collect_requests', 'prepare_handoff'],
      requiredFields: [
        { key: 'name', label: 'Name', required: true },
        { key: 'request', label: 'Anliegen', required: true },
      ],
      handoffRules: {
        enabled: true,
        requiredBeforeHandoff: true,
        summaryBeforeHandoff: true,
        askOnlyOneQuestionAtATime: true,
        fallbackBehavior: 'Bei Unsicherheit Uebergabe vorbereiten.',
      },
      deliveryChannels: {
        email: { enabled: true, recipientEmail: 'hidden@example.test' },
        webhook: { enabled: false },
        system: { enabled: true },
      },
      ...overrides,
    },
  };
}

test('assistant profile save service writes only assistant-profile module with metadata', async () => {
  const { service, updates, audits } = createSaveService();

  const result = await service.saveAssistantProfile('site-1', validPayload(), 'tenant-1', 'actor-1');
  const update = updates[0];
  const moduleUpdate = update.modules[0];
  const config = moduleUpdate.config;
  const serializedResult = JSON.stringify(result);

  assert.equal(result.saved, true);
  assert.equal(result.storageLocation, 'site_modules[assistant-profile].config.assistantProfile');
  assert.equal(updates.length, 1);
  assert.equal(update.siteId, 'site-1');
  assert.equal(moduleUpdate.key, 'assistant-profile');
  assert.equal(moduleUpdate.isEnabled, true);
  assert.equal(config.assistantProfile.profileKey, 'universal-assistant');
  assert.equal(config.assistantProfile.knowledgeMode, 'grounded');
  assert.deepEqual(config.assistantProfile.enabledTasks, ['answer_questions', 'collect_requests', 'prepare_handoff']);
  assert.deepEqual(config.assistantProfile.requiredFields.map((field) => field.key), ['name', 'request']);
  assert.equal(config.assistantProfile.deliveryChannels.email.recipientEmail, 'hidden@example.test');
  assert.equal(config.assistantProfile.deliveryChannels.system.enabled, true);
  assert.equal(config.metadata.updatedFrom, 'dashboard-wizard');
  assert.equal(config.metadata.updatedBy, 'actor-1');
  assert.equal(config.metadata.legacyFieldsPreserved, true);
  assert.equal(config.metadata.reversible, true);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'update_assistant_profile');
  assert.equal(audits[0].tenantId, 'tenant-1');
  assert.equal(audits[0].metadata.legacyFieldsPreserved, true);
  assert.doesNotMatch(serializedResult, /hidden@example\.test/);
});

test('assistant profile save service does not touch legacy modules or sites config', async () => {
  const { service, updates } = createSaveService();

  await service.saveAssistantProfile('site-1', validPayload(), 'tenant-1', 'actor-1');

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].modules.map((module) => module.key), ['assistant-profile']);
  assert.equal(updates[0].modules.some((module) => module.key === 'lead-sales'), false);
  assert.equal(updates[0].modules.some((module) => module.key === 'conversation-engine-tests'), false);
});

test('assistant profile save service rejects invalid enabledTasks', async () => {
  const { service, updates } = createSaveService();

  await assert.rejects(
    () => service.saveAssistantProfile('site-1', validPayload({ enabledTasks: ['delete_everything'] }), 'tenant-1', 'actor-1'),
    /Invalid enabledTasks/,
  );
  assert.equal(updates.length, 0);
});

test('assistant profile save service rejects invalid requiredFields', async () => {
  const { service, updates } = createSaveService();

  await assert.rejects(
    () => service.saveAssistantProfile('site-1', validPayload({ requiredFields: [{ key: 'fullAddress' }] }), 'tenant-1', 'actor-1'),
    /Invalid requiredFields key/,
  );
  assert.equal(updates.length, 0);
});

test('assistant profile save service rejects invalid knowledgeMode', async () => {
  const { service, updates } = createSaveService();

  await assert.rejects(
    () => service.saveAssistantProfile('site-1', validPayload({ knowledgeMode: 'unguarded' }), 'tenant-1', 'actor-1'),
    /Invalid assistantProfile\.knowledgeMode/,
  );
  assert.equal(updates.length, 0);
});

test('assistant profile resolver reads saved assistant-profile module before legacy fallback', () => {
  const resolver = new AssistantProfileResolverService();

  const profile = resolver.resolve({
    siteConfig: {
      botType: 'handwerker-first-contact',
      industry: 'local-services',
      conversationFlow: { requiredFields: ['phone'] },
    },
    moduleConfigs: {
      'assistant-profile': {
        assistantProfile: {
          profileKey: 'support-assistant',
          profileVersion: 1,
          assistantName: 'Support Assistent',
          requiredFields: [{ key: 'request', label: 'Anliegen', required: true }],
        },
      },
      'lead-sales': {
        intakeFlow: {
          questionOrder: ['problem', 'phone'],
        },
      },
    },
  });

  assert.equal(profile.profileKey, 'support-assistant');
  assert.equal(profile.legacySource, 'assistantProfile');
  assert.deepEqual(profile.requiredFields.map((field) => field.key), ['request']);
});
