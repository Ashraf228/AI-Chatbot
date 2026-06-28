const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AssistantProfileDiagnosticsService,
} = require('../dist/assistant-profiles/assistant-profile-diagnostics.service.js');
const {
  AssistantProfileDiagnosticsController,
} = require('../dist/assistant-profiles/assistant-profile-diagnostics.controller.js');
const {
  AssistantProfileMigrationPreviewService,
} = require('../dist/assistant-profiles/assistant-profile-migration-preview.service.js');
const {
  AssistantProfileMigrationService,
} = require('../dist/assistant-profiles/assistant-profile-migration.service.js');
const {
  AssistantProfileResolverService,
} = require('../dist/assistant-profiles/assistant-profile-resolver.service.js');

function createDiagnosticsService({
  siteConfig = {},
  modules = [],
  knowledgeCount = 0,
} = {}) {
  const db = {
    async query() {
      return { rows: [{ count: String(knowledgeCount) }] };
    },
  };
  const sites = {
    async getSite(siteId) {
      if (siteId === 'missing-site') {
        return null;
      }
      return {
        id: siteId,
        tenant_id: 'tenant-1',
        name: 'Demo Site',
        site_key: 'demo-site',
        allowed_domains: ['kunde.example'],
        config: siteConfig,
      };
    },
  };
  const siteModules = {
    async listForSite() {
      return modules;
    },
  };

  return new AssistantProfileDiagnosticsService(
    db,
    sites,
    siteModules,
    new AssistantProfileResolverService(),
  );
}

function createPreviewService(input = {}) {
  const diagnostics = createDiagnosticsService(input);
  const db = {
    async query() {
      return { rows: [{ count: String(input.knowledgeCount || 0) }] };
    },
  };
  const sites = {
    async getSite(siteId) {
      if (siteId === 'missing-site') {
        return null;
      }
      return {
        id: siteId,
        tenant_id: 'tenant-1',
        name: 'Demo Site',
        site_key: 'demo-site',
        allowed_domains: ['kunde.example'],
        config: input.siteConfig || {},
      };
    },
  };
  const siteModules = {
    async listForSite() {
      return input.modules || [];
    },
  };

  return new AssistantProfileMigrationPreviewService(
    db,
    sites,
    siteModules,
    new AssistantProfileResolverService(),
    diagnostics,
  );
}

function createMigrationService(input = {}) {
  const preview = input.preview || {
    async getMigrationPreview() {
      return {
        currentProfile: { legacySource: 'lead-sales.intakeFlow' },
        proposedAssistantProfile: {
          profileKey: 'local-service-first-contact',
          profileVersion: 1,
          assistantName: 'Handwerker-Erstkontakt',
          deliveryChannels: {
            email: { enabled: true, status: 'configured' },
          },
        },
        blockers: [],
      };
    },
  };
  const diagnostics = input.diagnostics || {
    async getDiagnostics() {
      return {
        assistantProfileDebug: {
          profileKey: 'local-service-first-contact',
          profileVersion: 1,
          legacySource: 'assistantProfile',
          deliveryChannels: [{ type: 'email', enabled: true, status: 'configured' }],
        },
      };
    },
  };
  const updates = [];
  const audits = [];
  const siteModules = input.siteModules || {
    async updateForSite(siteId, modules) {
      updates.push({ siteId, modules });
      return [];
    },
  };
  const auditLogs = input.auditLogs || {
    async record(entry) {
      audits.push(entry);
    },
  };

  return {
    service: new AssistantProfileMigrationService(preview, diagnostics, siteModules, auditLogs),
    updates,
    audits,
  };
}

test('assistant profile diagnostics returns sanitized local-service debug data', async () => {
  const service = createDiagnosticsService({
    knowledgeCount: 0,
    siteConfig: {
      botType: 'handwerker-first-contact',
      industry: 'local-service-first-contact',
      leadCaptureEnabled: true,
      leadNotificationEmail: 'dispatch@example.test',
      conversationFlow: {
        requiredFields: ['problem', 'phone'],
        questionTexts: { phone: 'Telefon?' },
      },
    },
    modules: [
      {
        key: 'lead-sales',
        isEnabled: true,
        config: {
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
    ],
  });

  const result = await service.getDiagnostics('site-1');
  const debug = result.assistantProfileDebug;
  const serialized = JSON.stringify(result);

  assert.equal(debug.profileKey, 'local-service-first-contact');
  assert.equal(debug.profileVersion, 1);
  assert.equal(debug.legacySource, 'lead-sales.intakeFlow');
  assert.equal(debug.sourceLabel, 'bestehender Anfrage-Flow');
  assert.deepEqual(debug.requiredFields.map((field) => field.key), ['problem', 'fullAddress', 'phone']);
  assert.deepEqual(debug.deliveryChannels, [
    { type: 'email', enabled: true, status: 'configured' },
    { type: 'webhook', enabled: false, status: 'inactive' },
  ]);
  assert.ok(debug.warnings.includes('Legacy conversationFlow aktiv'));
  assert.ok(debug.warnings.includes('lead-sales.intakeFlow wird bevorzugt'));
  assert.ok(debug.warnings.includes('botType ist deprecated'));
  assert.ok(debug.warnings.includes('Keine Wissensbasis erkannt'));
  assert.ok(debug.warnings.includes('Profil stammt aus Legacy-Mapping'));
  assert.doesNotMatch(serialized, /dispatch@example\.test/);
});

test('assistant profile diagnostics returns universal profile for site without flow', async () => {
  const service = createDiagnosticsService({
    siteConfig: {
      leadCaptureEnabled: false,
    },
    modules: [],
    knowledgeCount: 1,
  });

  const result = await service.getDiagnostics('site-1');
  const debug = result.assistantProfileDebug;

  assert.equal(debug.profileKey, 'universal-assistant');
  assert.equal(debug.legacySource, 'default');
  assert.deepEqual(debug.requiredFields, []);
  assert.equal(debug.deliveryChannels.find((channel) => channel.type === 'email').enabled, false);
});

test('assistant profile diagnostics controller enforces site access before returning debug data', async () => {
  const calls = [];
  const controller = new AssistantProfileDiagnosticsController(
    {
      async getDiagnostics(siteId) {
        calls.push({ method: 'getDiagnostics', siteId });
        return { assistantProfileDebug: { profileKey: 'universal-assistant' } };
      },
    },
    {
      async getMigrationPreview(siteId) {
        calls.push({ method: 'getMigrationPreview', siteId });
        return { proposedAssistantProfile: { profileKey: 'universal-assistant' } };
      },
    },
    {
      async savePreviewAsAssistantProfile(siteId) {
        calls.push({ method: 'savePreviewAsAssistantProfile', siteId });
        return { saved: true };
      },
    },
    {
      getAuth(req) {
        calls.push({ method: 'getAuth', req });
        return { role: 'operator', tenantId: 'tenant-1' };
      },
      async assertSiteAccess(auth, siteId, options) {
        calls.push({ method: 'assertSiteAccess', auth, siteId, options });
      },
    },
  );

  const result = await controller.getDiagnostics('site-1', { dashboardAuth: { role: 'operator' } });

  assert.deepEqual(result, { assistantProfileDebug: { profileKey: 'universal-assistant' } });
  assert.deepEqual(calls[1], {
    method: 'assertSiteAccess',
    auth: { role: 'operator', tenantId: 'tenant-1' },
    siteId: 'site-1',
    options: { allowedRoles: ['admin', 'operator'] },
  });
  assert.deepEqual(calls[2], { method: 'getDiagnostics', siteId: 'site-1' });
});

test('assistant profile migration preview maps legacy Handwerker site to local-service profile', async () => {
  const service = createPreviewService({
    knowledgeCount: 1,
    siteConfig: {
      botType: 'handwerker-first-contact',
      leadCaptureEnabled: true,
      leadNotificationEmail: 'dispatch@example.test',
    },
    modules: [
      {
        key: 'lead-sales',
        isEnabled: true,
        config: {
          intakeFlow: {
            questionOrder: ['problem', 'urgency', 'fullAddress', 'fullName', 'phone'],
            questionTexts: { phone: 'Telefon?' },
          },
        },
      },
    ],
  });

  const result = await service.getMigrationPreview('site-1');
  const serialized = JSON.stringify(result);

  assert.equal(result.proposedAssistantProfile.profileKey, 'local-service-first-contact');
  assert.equal(result.proposedAssistantProfile.profileVersion, 1);
  assert.equal(result.proposedStorageLocation, 'site_modules[assistant-profile].config.assistantProfile');
  assert.equal(result.reversible, true);
  assert.ok(result.changes.some((change) => change.from === 'lead-sales.intakeFlow.questionOrder'));
  assert.ok(result.changes.some((change) => change.from === 'leadNotificationEmail' || change.from?.includes('leadNotificationEmail')));
  assert.doesNotMatch(serialized, /dispatch@example\.test/);
});

test('assistant profile migration preview falls back to universal profile without flow', async () => {
  const service = createPreviewService({
    siteConfig: {},
    modules: [],
  });

  const result = await service.getMigrationPreview('site-1');

  assert.equal(result.proposedAssistantProfile.profileKey, 'universal-assistant');
  assert.ok(result.blockers.includes('Keine eindeutige Site-Konfiguration gefunden.'));
});

test('assistant profile migration preview warns about conflicting legacy field sources', async () => {
  const service = createPreviewService({
    siteConfig: {
      conversationFlow: {
        questionOrder: ['problem', 'phone'],
      },
    },
    modules: [
      {
        key: 'lead-sales',
        isEnabled: true,
        config: {
          intakeFlow: {
            questionOrder: ['problem', 'fullAddress', 'phone'],
          },
        },
      },
    ],
  });

  const result = await service.getMigrationPreview('site-1');

  assert.ok(result.warnings.some((warning) => warning.includes('Widersprüchliche requiredFields')));
  assert.ok(result.warnings.some((warning) => warning.includes('Mehrere Legacy-Quellen aktiv')));
});

test('assistant profile migration preview warns when lead capture has no delivery email', async () => {
  const service = createPreviewService({
    siteConfig: {
      leadCaptureEnabled: true,
      botType: 'handwerker-first-contact',
    },
    modules: [],
  });

  const result = await service.getMigrationPreview('site-1');

  assert.ok(result.warnings.includes('Lead-Erfassung ist aktiv, aber keine E-Mail-Zustellung konfiguriert.'));
});

test('assistant profile diagnostics controller exposes migration preview only after site access', async () => {
  const calls = [];
  const controller = new AssistantProfileDiagnosticsController(
    {
      async getDiagnostics(siteId) {
        calls.push({ method: 'getDiagnostics', siteId });
        return { assistantProfileDebug: { profileKey: 'universal-assistant' } };
      },
    },
    {
      async getMigrationPreview(siteId) {
        calls.push({ method: 'getMigrationPreview', siteId });
        return { proposedAssistantProfile: { profileKey: 'universal-assistant' } };
      },
    },
    {
      async savePreviewAsAssistantProfile(siteId) {
        calls.push({ method: 'savePreviewAsAssistantProfile', siteId });
        return { saved: true };
      },
    },
    {
      getAuth(req) {
        calls.push({ method: 'getAuth', req });
        return { role: 'admin', tenantId: 'tenant-1' };
      },
      async assertSiteAccess(auth, siteId, options) {
        calls.push({ method: 'assertSiteAccess', auth, siteId, options });
      },
    },
  );

  const result = await controller.getMigrationPreview('site-1', { dashboardAuth: { role: 'admin' } });

  assert.deepEqual(result, { proposedAssistantProfile: { profileKey: 'universal-assistant' } });
  assert.deepEqual(calls[1], {
    method: 'assertSiteAccess',
    auth: { role: 'admin', tenantId: 'tenant-1' },
    siteId: 'site-1',
    options: { allowedRoles: ['admin', 'operator'] },
  });
  assert.deepEqual(calls[2], { method: 'getMigrationPreview', siteId: 'site-1' });
});

test('assistant profile migration service saves block-free preview without changing legacy fields', async () => {
  const { service, updates, audits } = createMigrationService();

  const result = await service.savePreviewAsAssistantProfile('site-1', 'tenant-1', 'actor-1');
  const serialized = JSON.stringify(result);

  assert.equal(result.saved, true);
  assert.equal(result.storageLocation, 'site_modules[assistant-profile].config.assistantProfile');
  assert.equal(updates.length, 1);
  assert.equal(updates[0].siteId, 'site-1');
  assert.deepEqual(updates[0].modules[0].key, 'assistant-profile');
  assert.equal(updates[0].modules[0].isEnabled, true);
  assert.equal(updates[0].modules[0].config.migration.legacyFieldsPreserved, true);
  assert.equal(updates[0].modules[0].config.migration.reversible, true);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'save_assistant_profile');
  assert.doesNotMatch(serialized, /dispatch@example\.test/);
});

test('assistant profile migration service refuses preview with blockers', async () => {
  const { service, updates, audits } = createMigrationService({
    preview: {
      async getMigrationPreview() {
        return {
          currentProfile: { legacySource: 'default' },
          proposedAssistantProfile: {
            profileKey: 'universal-assistant',
            profileVersion: 1,
            assistantName: 'Universal-Assistent',
          },
          blockers: ['Keine eindeutige Site-Konfiguration gefunden.'],
        };
      },
    },
  });

  await assert.rejects(
    () => service.savePreviewAsAssistantProfile('site-1', 'tenant-1', 'actor-1'),
    /AssistantProfile preview has blockers/,
  );
  assert.equal(updates.length, 0);
  assert.equal(audits.length, 0);
});

test('assistant profile diagnostics controller saves profile only after site access', async () => {
  const calls = [];
  const controller = new AssistantProfileDiagnosticsController(
    {
      async getDiagnostics(siteId) {
        calls.push({ method: 'getDiagnostics', siteId });
        return { assistantProfileDebug: { profileKey: 'universal-assistant' } };
      },
    },
    {
      async getMigrationPreview(siteId) {
        calls.push({ method: 'getMigrationPreview', siteId });
        return { proposedAssistantProfile: { profileKey: 'universal-assistant' } };
      },
    },
    {
      async savePreviewAsAssistantProfile(siteId, tenantId, actorId) {
        calls.push({ method: 'savePreviewAsAssistantProfile', siteId, tenantId, actorId });
        return { saved: true };
      },
    },
    {
      getAuth(req) {
        calls.push({ method: 'getAuth', req });
        return { role: 'operator', tenantId: 'tenant-1', actorId: 'actor-1' };
      },
      async assertSiteAccess(auth, siteId, options) {
        calls.push({ method: 'assertSiteAccess', auth, siteId, options });
        return { id: siteId, tenant_id: 'tenant-1' };
      },
    },
  );

  const result = await controller.saveAssistantProfile('site-1', { dashboardAuth: { role: 'operator' } });

  assert.deepEqual(result, { saved: true });
  assert.deepEqual(calls[1], {
    method: 'assertSiteAccess',
    auth: { role: 'operator', tenantId: 'tenant-1', actorId: 'actor-1' },
    siteId: 'site-1',
    options: { allowedRoles: ['admin', 'operator'] },
  });
  assert.deepEqual(calls[2], {
    method: 'savePreviewAsAssistantProfile',
    siteId: 'site-1',
    tenantId: 'tenant-1',
    actorId: 'actor-1',
  });
});
