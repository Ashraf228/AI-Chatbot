const test = require('node:test');
const assert = require('node:assert/strict');
const { SiteStatusService } = require('../dist/sites/site-status.service.js');

function createService(config, options = {}) {
  const assistantProfileModuleConfig = config.__assistantProfileModuleConfig || null;
  const siteConfig = { ...config };
  delete siteConfig.__assistantProfileModuleConfig;
  const knowledgeCount = options.knowledgeCount ?? 1;

  const db = {
    async query(sql) {
      if (sql.includes('FROM site_modules')) {
        return {
          rows: assistantProfileModuleConfig ? [{ config: assistantProfileModuleConfig }] : [],
        };
      }

      return {
        rows: [{ count: String(knowledgeCount) }],
      };
    },
  };
  const sites = {
    async getSite() {
      return {
        id: 'site-1',
        name: 'Muster Handwerk',
        site_key: 'muster-handwerk',
        allowed_domains: ['kunde.de'],
        config: siteConfig,
      };
    },
  };

  return new SiteStatusService(db, sites);
}

function readyConfig(overrides = {}) {
  return {
    industry: 'local-service-first-contact',
    templateId: 'local-service-first-contact',
    templateAppliedAt: '2026-05-29T10:00:00.000Z',
    setupGoal: 'lead_capture',
    enabledTasks: ['answer_questions', 'collect_requests', 'prepare_handoff'],
    conversationFlow: {
      requiredFields: ['name', 'email', 'request'],
    },
    ctaText: 'Soforthilfe',
    welcomeMessage: 'Guten Tag. Beschreiben Sie kurz, was passiert ist.',
    brandColor: '#b55400',
    widgetPosition: 'bottom_right',
    privacyUrl: 'https://kunde.de/datenschutz',
    lastTestedAt: '2026-05-29T10:30:00.000Z',
    leadCaptureEnabled: true,
    ...overrides,
  };
}

function expectStep(status, key) {
  const step = status.steps.find((entry) => entry.key === key);
  assert.ok(step, `expected step ${key}`);
  return step;
}

test('SiteStatusService blocks go-live when lead capture is active and lead recipient email is missing', async () => {
  const service = createService(readyConfig({ leadNotificationEmail: '' }));

  const status = await service.resolveStatus('site-1');
  const leadDelivery = status.steps.find((step) => step.key === 'lead_delivery');

  assert.equal(status.isLiveReady, false);
  assert.equal(status.code, 'setup_incomplete');
  assert.equal(leadDelivery.status, 'warning');
  assert.equal(leadDelivery.missingReason, 'Lead-Empfänger-E-Mail fehlt.');
  assert.equal(status.nextAction.key, 'lead_delivery');
});

test('SiteStatusService allows go-live without lead recipient email when lead capture is disabled', async () => {
  const service = createService(
    readyConfig({
      leadCaptureEnabled: false,
      leadNotificationEmail: '',
    }),
  );

  const status = await service.resolveStatus('site-1');
  const leadDelivery = status.steps.find((step) => step.key === 'lead_delivery');

  assert.equal(status.isLiveReady, true);
  assert.equal(status.code, 'ready_for_live');
  assert.equal(leadDelivery.status, 'complete');
});

test('SiteStatusService treats stored assistant-profile module data as the effective setup contract', async () => {
  const service = createService(
    readyConfig({
      templateId: '',
      templateAppliedAt: '',
      industry: '',
      primaryGoal: '',
      setupGoal: '',
      leadNotificationEmail: 'ops@example.test',
      __assistantProfileModuleConfig: {
        assistantProfile: {
          profileKey: 'universal-assistant',
          profileVersion: 1,
          role: 'Anfragen aufnehmen und qualifizieren',
          enabledTasks: ['answer_questions', 'collect_requests', 'prepare_handoff'],
        },
      },
    }),
  );

  const status = await service.resolveStatus('site-1');
  const template = status.steps.find((step) => step.key === 'template');
  const behavior = status.steps.find((step) => step.key === 'behavior');

  assert.equal(status.code, 'ready_for_live');
  assert.equal(template.status, 'complete');
  assert.equal(behavior.status, 'complete');
});

test('SiteStatusService treats saved conversation logic as complete without requiring legacy CTA or greeting fields', async () => {
  const service = createService(
    readyConfig({
      templateId: '',
      templateAppliedAt: '',
      industry: '',
      setupGoal: '',
      primaryGoal: '',
      enabledTasks: [],
      conversationFlow: {},
      ctaText: '',
      welcomeMessage: '',
      systemPrompt: '',
      brandColor: '#b55400',
      widgetPosition: 'bottom_right',
      leadNotificationEmail: 'ops@example.test',
      __assistantProfileModuleConfig: {
        assistantProfile: {
          profileKey: 'universal-assistant',
          profileVersion: 1,
          primaryGoal: 'lead_generation',
          role: 'Anfragen aufnehmen und qualifizieren',
          enabledTasks: ['answer_questions', 'collect_requests'],
          requiredFields: [{ key: 'email', label: 'E-Mail', required: true }],
        },
      },
    }),
  );

  const status = await service.resolveStatus('site-1');
  const behavior = expectStep(status, 'behavior');
  const design = expectStep(status, 'design');

  assert.equal(status.code, 'ready_for_live');
  assert.equal(behavior.status, 'complete');
  assert.equal(design.status, 'complete');
});

test('SiteStatusService marks partially saved conversation logic as incomplete instead of not started', async () => {
  const service = createService(
    readyConfig({
      templateId: '',
      templateAppliedAt: '',
      industry: '',
      setupGoal: '',
      primaryGoal: '',
      enabledTasks: [],
      conversationFlow: {},
      ctaText: '',
      welcomeMessage: '',
      systemPrompt: '',
      brandColor: '#b55400',
      widgetPosition: 'bottom_right',
      leadNotificationEmail: 'ops@example.test',
      __assistantProfileModuleConfig: {
        assistantProfile: {
          profileKey: 'universal-assistant',
          profileVersion: 1,
          role: 'Anfragen aufnehmen und qualifizieren',
        },
      },
    }),
  );

  const status = await service.resolveStatus('site-1');
  const behavior = expectStep(status, 'behavior');

  assert.equal(status.code, 'setup_incomplete');
  assert.equal(behavior.status, 'warning');
  assert.equal(behavior.missingReason, 'Ziel oder Gesprächslogik fehlt.');
});

test('SiteStatusService treats saved design defaults plus privacy URL as complete design state', async () => {
  const service = createService(
    readyConfig({
      leadNotificationEmail: 'ops@example.test',
      brandColor: '#b55400',
      widgetPosition: 'bottom_right',
      privacyUrl: 'https://kunde.de/datenschutz',
      welcomeMessage: '',
      logoUrl: '',
    }),
  );

  const status = await service.resolveStatus('site-1');
  const design = expectStep(status, 'design');

  assert.equal(status.code, 'ready_for_live');
  assert.equal(design.status, 'complete');
});

test('SiteStatusService marks saved design without privacy URL as incomplete instead of untouched', async () => {
  const service = createService(
    readyConfig({
      leadNotificationEmail: 'ops@example.test',
      brandColor: '#b55400',
      widgetPosition: 'bottom_right',
      privacyUrl: '',
      welcomeMessage: '',
      logoUrl: '',
    }),
  );

  const status = await service.resolveStatus('site-1');
  const design = expectStep(status, 'design');

  assert.equal(status.code, 'privacy_missing');
  assert.equal(design.status, 'warning');
  assert.equal(design.missingReason, 'Datenschutz-URL fehlt.');
});

test('SiteStatusService keeps live state blocked for review until explicit go-live activation happens', async () => {
  const service = createService(
    readyConfig({
      leadNotificationEmail: 'ops@example.test',
      brandColor: '#b55400',
      widgetPosition: 'bottom_right',
    }),
  );

  const status = await service.resolveStatus('site-1');
  const live = expectStep(status, 'live');

  assert.equal(status.code, 'ready_for_live');
  assert.equal(live.status, 'warning');
  assert.equal(live.missingReason, 'Kunde ist bereit, aber noch nicht live geschaltet.');
});

test('SiteStatusService keeps the knowledge step incomplete until at least one active ready source exists', async () => {
  const service = createService(
    readyConfig({
      leadNotificationEmail: 'ops@example.test',
      knowledgeMode: 'flexible',
    }),
    { knowledgeCount: 0 },
  );

  const status = await service.resolveStatus('site-1');
  const knowledge = expectStep(status, 'knowledge');

  assert.equal(status.code, 'knowledge_missing');
  assert.equal(status.label, 'Wissen fehlt');
  assert.equal(status.isLiveReady, false);
  assert.equal(knowledge.status, 'incomplete');
  assert.equal(knowledge.missingReason, 'Mindestens eine Wissensquelle fehlt.');
});
