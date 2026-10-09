const test = require('node:test');
const assert = require('node:assert/strict');
const { WidgetSecurityService } = require('../dist/modules/widget/services/widget-security.service.js');
const { SiteDataExportService } = require('../dist/site-data/site-data-export.service.js');
const { maskEmail, maskPhone, redactPII, sanitizeForAuditLog } = require('../dist/utils/pii.js');

test('PII helpers mask email, phone and nested secrets', () => {
  assert.equal(maskEmail('max.mustermann@example.de'), 'ma***@example.de');
  assert.equal(maskPhone('+49 170 1234567'), '***4567');
  assert.equal(redactPII('Mail max@example.de Telefon +49 170 1234567'), 'Mail [REDACTED_EMAIL] Telefon [REDACTED_PHONE]');
  assert.deepEqual(
    sanitizeForAuditLog({
      email: 'max@example.de',
      phone: '+49 170 1234567',
      apiKey: 'secret',
      nested: { token: 'secret' },
    }),
    {
      email: 'ma***@example.de',
      phone: '***4567',
      apiKey: '[redacted]',
      nested: { token: '[redacted]' },
    },
  );
});

test('WidgetSecurityService allows configured origin and blocks foreign origin', async () => {
  process.env.NODE_ENV = 'production';
  const db = {
    async query() {
      return { rows: [{ allowed_domains: ['example.de'] }] };
    },
  };
  const rateLimit = {
    async allow() {
      return { allowed: true, used: 1 };
    },
  };
  const widgetConfig = {
    async getSiteByKey() {
      return { id: 'site-1' };
    },
  };
  const service = new WidgetSecurityService(db, rateLimit, widgetConfig);

  assert.equal(await service.isAllowedOrigin('site-key', 'https://example.de'), true);
  assert.equal(await service.isAllowedOrigin('site-key', undefined, 'https://www.example.de/page'), true);
  assert.equal(await service.isAllowedOrigin('site-key', 'https://evil.example.com'), false);
});

test('SiteDataExportService privacy export omits integration secrets', async () => {
  const db = {
    async query(sql) {
      if (/FROM sites/i.test(sql)) {
        return {
          rows: [{
            id: 'site-1',
            tenant_id: 'tenant-1',
            site_key: 'site-key',
            name: 'Demo',
            allowed_domains: ['example.de'],
            public_key: 'public-key',
            config: {},
            created_at: '2026-01-01T00:00:00.000Z',
          }],
        };
      }
      if (/FROM integration_connections/i.test(sql)) {
        return {
          rows: [{
            id: 'integration-1',
            site_id: 'site-1',
            provider_key: 'webhook',
            config: { authorization: 'secret' },
            secrets: { token: 'secret' },
            secrets_encrypted: true,
          }],
        };
      }
      return { rows: [] };
    },
  };
  const audit = { async record() {} };
  const service = new SiteDataExportService(db, audit);

  const exported = await service.exportPrivacyData('site-1', { role: 'admin', actorId: 'admin' });

  assert.equal(exported.site.site_key, 'site-key');
  const serialized = JSON.stringify(exported);
  assert.equal(serialized.includes('"token"'), false);
  assert.equal(serialized.includes('authorization'), false);
});

test('SiteDataExportService privacy delete scopes changes to the selected site', async () => {
  const executed = [];
  const db = {
    async query(sql, params = []) {
      executed.push({ sql, params });
      if (/SELECT tenant_id FROM sites/i.test(sql)) {
        return { rows: [{ tenant_id: 'tenant-1' }] };
      }
      return { rows: [{ 1: 1 }, { 1: 1 }] };
    },
  };
  const audit = { async record() {} };
  const service = new SiteDataExportService(db, audit);

  const result = await service.deletePrivacyData(
    'site-1',
    { deleteLeads: true, deleteTickets: true, confirm: true },
    { role: 'admin', actorId: 'admin' },
  );

  assert.equal(result.counts.widgetLeads, 2);
  assert.equal(result.counts.agentTickets, 2);
  assert.equal(executed.every((entry) => entry.params.includes('site-1')), true);
});
