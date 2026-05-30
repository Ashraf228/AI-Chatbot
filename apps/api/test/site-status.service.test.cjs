const test = require('node:test');
const assert = require('node:assert/strict');
const { SiteStatusService } = require('../dist/sites/site-status.service.js');

function createService(config) {
  const db = {
    async query() {
      return {
        rows: [{ count: '1' }],
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
        config,
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
    ctaText: 'Soforthilfe',
    welcomeMessage: 'Guten Tag. Beschreiben Sie kurz, was passiert ist.',
    privacyUrl: 'https://kunde.de/datenschutz',
    lastTestedAt: '2026-05-29T10:30:00.000Z',
    leadCaptureEnabled: true,
    ...overrides,
  };
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
