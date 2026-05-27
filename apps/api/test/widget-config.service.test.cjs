const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetConfigService } = require('../dist/modules/widget/services/widget-config.service.js');

test('WidgetConfigService.getPublicConfig maps runtime-safe widget config', async () => {
  const db = {
    async query() {
      return {
        rows: [
          {
            id: 'site-1',
            site_key: 'soule-smart-business',
            tenant_id: 'tenant-1',
            name: 'SouleSmartBusiness',
            domain: 'soulesmartbusiness.com',
            brand_color: '#112233',
            accent_color: '#ffeecc',
            font_family: 'inter',
            welcome_message: 'Hi! Wie kann ich helfen?',
            privacy_url: 'https://soulesmartbusiness.com/privacy',
            is_active: true,
            company_name: 'SouleSmartBusiness',
            bot_name: 'Service-Assistent',
            logo_url: 'https://soulesmartbusiness.com/logo.png',
            public_key: 'pk_test',
            widget_bundle_url: 'https://widget.soulesmartbusiness.com/widget.js',
            consent_required: true,
            lead_capture_enabled: true,
            lead_notification_email: 'hello@soulesmartbusiness.com',
            suggested_questions_by_path: { '/': ['Was kostet der Service?'] },
            system_prompt: 'Custom prompt',
          },
        ],
      };
    },
  };

  process.env.PUBLIC_API_BASE_URL = 'https://api.soulesmartbusiness.com';
  process.env.PUBLIC_WIDGET_BUNDLE_URL = 'https://widget.soulesmartbusiness.com/widget.js';

  const service = new WidgetConfigService(db);
  const config = await service.getPublicConfig('soule-smart-business');

  assert.equal(config.siteId, 'site-1');
  assert.equal(config.siteKey, 'soule-smart-business');
  assert.equal(config.apiBase, 'https://api.soulesmartbusiness.com');
  assert.equal(config.theme.fontFamily, 'inter');
  assert.equal(config.leadCaptureEnabled, true);
  assert.equal(config.consentRequired, true);
  assert.equal(config.privacyUrl, 'https://soulesmartbusiness.com/privacy');
  assert.deepEqual(config.suggestedQuestionsByPath['/'], ['Was kostet der Service?']);
});

test('WidgetConfigService.getPublicConfig normalizes local-service greeting to formal wording', async () => {
  const db = {
    async query() {
      return {
        rows: [
          {
            id: 'site-1',
            site_key: 'rohrreinigung-ffm24',
            tenant_id: 'tenant-1',
            name: 'Rohrreinigung FFM24',
            domain: 'rohrreinigung-ffm24.de',
            brand_color: '#b55400',
            accent_color: '#fff0d9',
            font_family: 'system',
            welcome_message: 'Hey!\nWas genau ist bei dir aktuell das Problem?',
            privacy_url: 'https://rohrreinigung-ffm24.de/datenschutz',
            is_active: true,
            company_name: 'Rohrreinigung FFM24',
            bot_name: 'Service-Assistent',
            logo_url: '',
            public_key: 'pk_test',
            widget_bundle_url: 'https://widget.soulesmartbusiness.com/widget.js',
            consent_required: true,
            lead_capture_enabled: true,
            lead_notification_email: '',
            suggested_questions_by_path: {},
            conversation_flow: {},
            system_prompt: '',
            industry: 'local-services',
          },
        ],
      };
    },
  };

  const service = new WidgetConfigService(db);
  const config = await service.getPublicConfig('rohrreinigung-ffm24');

  assert.match(config.greeting, /^Guten Tag/i);
  assert.match(config.greeting, /bei Ihnen/i);
  assert.doesNotMatch(config.greeting, /\b(hey|du|dir|dich|dein|deine|deinen|deiner|deinem|bei dir)\b/i);
});
