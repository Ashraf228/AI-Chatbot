const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createHash, randomBytes } = require('node:crypto');
const { IntegrationsService } = require('../dist/integrations/integrations.service.js');
const { IntegrationSecretsService } = require('../dist/integrations/integration-secrets.service.js');

const TEST_SECRET_KEY = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
const PREVIOUS_SECRET_KEY = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';

test('IntegrationsService.listForSite returns registry entries and masks secret values to counts', async () => {
  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  const db = {
    async query() {
      return {
        rows: [
          {
            id: 'conn-1',
            tenant_id: 'tenant-1',
            site_id: 'site-1',
            provider_key: 'shopify',
            connection_key: 'primary',
            display_name: 'Shopify Hauptshop',
            status: 'connected',
            config: {
              shopDomain: 'shop.example.myshopify.com',
            },
            secrets: {
              adminApiToken: 'super-secret',
            },
            secrets_encrypted: false,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      };
    },
  };

  const sites = {
    async getSite(id) {
      return { id };
    },
  };

  const service = new IntegrationsService(db, sites, new IntegrationSecretsService());
  const connections = await service.listForSite('site-1');
  const shopify = connections.find((entry) => entry.providerKey === 'shopify');

  assert.equal(shopify.status, 'connected');
  assert.equal(shopify.config.shopDomain, 'shop.example.myshopify.com');
  assert.equal(shopify.configuredSecretCount, 1);
  assert.equal(shopify.secretFieldCount, 2);
  assert.equal(shopify.secretFields.some((field) => field.key === 'adminApiToken'), true);
});

test('IntegrationsService.getConnectionForSite decrypts encrypted secrets for internal use', async () => {
  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  const crypto = new IntegrationSecretsService();
  const encryptedSecrets = crypto.encryptRecord({ adminApiToken: 'super-secret' });

  const db = {
    async query() {
      return {
        rows: [
          {
            id: 'conn-1',
            tenant_id: 'tenant-1',
            site_id: 'site-1',
            provider_key: 'shopify',
            connection_key: 'primary',
            display_name: 'Shopify Hauptshop',
            status: 'connected',
            config: {
              shopDomain: 'shop.example.myshopify.com',
            },
            secrets: encryptedSecrets,
            secrets_encrypted: true,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:00.000Z',
          },
        ],
      };
    },
  };

  const sites = {
    async getSite(id) {
      return { id };
    },
  };

  const service = new IntegrationsService(db, sites, crypto);
  const connection = await service.getConnectionForSite('site-1', 'shopify', 'primary');

  assert.equal(connection.status, 'connected');
  assert.equal(connection.secrets.adminApiToken, 'super-secret');
});

test('IntegrationSecretsService encrypts new secrets as v2 and decrypts legacy v1 values', async () => {
  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  const crypto = new IntegrationSecretsService();

  const encryptedRecord = crypto.encryptRecord({ apiKey: 'secret-value' });
  assert.match(encryptedRecord.apiKey, /^enc:v2:/);
  assert.equal(crypto.decryptRecord(encryptedRecord, true).apiKey, 'secret-value');

  const iv = randomBytes(12);
  const legacyKey = createHash('sha256').update(TEST_SECRET_KEY).digest();
  const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
  const encrypted = Buffer.concat([cipher.update('legacy-secret', 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const legacyEnvelope = `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;

  assert.equal(
    crypto.decryptRecord({ apiKey: legacyEnvelope }, true).apiKey,
    'legacy-secret',
  );
});

test('IntegrationsService.buildHeaders supports signingSecret without exposing it as payload data', async () => {
  const service = new IntegrationsService(
    { async query() { return { rows: [] }; } },
    { async getSite(id) { return { id, tenant_id: 'tenant-1' }; } },
    new IntegrationSecretsService(),
  );

  const headers = service.buildHeaders(
    { headers: '{"x-source":"ticket-test"}' },
    { signingSecret: 'signing-secret-value' },
  );

  assert.equal(headers['content-type'], 'application/json');
  assert.equal(headers['x-source'], 'ticket-test');
  assert.equal(headers['x-webhook-secret'], 'signing-secret-value');
  assert.equal(headers['x-api-key'], undefined);
});

test('IntegrationSecretsService rejects weak or missing key material', async () => {
  delete process.env.INTEGRATION_SECRET_KEY;
  const crypto = new IntegrationSecretsService();
  assert.equal(crypto.isConfigured(), false);

  process.env.INTEGRATION_SECRET_KEY = 'too-short';
  assert.equal(crypto.isConfigured(), false);
  assert.throws(() => crypto.encryptRecord({ apiKey: 'x' }), /INTEGRATION_SECRET_KEY/);
});

test('IntegrationSecretsService decrypts v2 secrets with a configured previous key', async () => {
  process.env.INTEGRATION_SECRET_KEY = PREVIOUS_SECRET_KEY;
  delete process.env.INTEGRATION_SECRET_KEY_PREVIOUS;
  const oldCrypto = new IntegrationSecretsService();
  const encryptedRecord = oldCrypto.encryptRecord({ apiKey: 'rotated-secret' });

  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  process.env.INTEGRATION_SECRET_KEY_PREVIOUS = PREVIOUS_SECRET_KEY;
  const currentCrypto = new IntegrationSecretsService();

  assert.equal(
    currentCrypto.decryptRecord(encryptedRecord, true).apiKey,
    'rotated-secret',
  );
});

test('IntegrationsService.rotateSecretsForSite re-encrypts legacy or plaintext secrets with the current key', async () => {
  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  process.env.INTEGRATION_SECRET_LEGACY_KEYS = 'legacy-admin-key';

  const queries = [];
  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (sql.includes('FROM integration_connections')) {
        const iv = randomBytes(12);
        const legacyKey = createHash('sha256').update('legacy-admin-key').digest();
        const cipher = createCipheriv('aes-256-gcm', legacyKey, iv);
        const encrypted = Buffer.concat([cipher.update('old-secret', 'utf8'), cipher.final()]);
        const tag = cipher.getAuthTag();

        return {
          rows: [
            {
              id: 'conn-1',
              tenant_id: 'tenant-1',
              site_id: 'site-1',
              provider_key: 'shopify',
              connection_key: 'primary',
              display_name: 'Shopify Hauptshop',
              status: 'connected',
              config: {},
              secrets: {
                adminApiToken: `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`,
              },
              secrets_encrypted: true,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-02T00:00:00.000Z',
            },
          ],
        };
      }

      return { rows: [] };
    },
  };

  const sites = {
    async getSite(id) {
      return { id };
    },
  };

  const service = new IntegrationsService(db, sites, new IntegrationSecretsService());
  const result = await service.rotateSecretsForSite('site-1');

  assert.equal(result.scanned, 1);
  assert.equal(result.rotated, 1);
  const updateCall = queries.find((entry) => entry.sql.includes('UPDATE integration_connections'));
  assert.ok(updateCall);
  const encryptedSecrets = JSON.parse(updateCall.params[1]);
  assert.match(encryptedSecrets.adminApiToken, /^enc:v2:/);
});

test('IntegrationsService.updateForSite persists the tenant context from the selected site', async () => {
  process.env.INTEGRATION_SECRET_KEY = TEST_SECRET_KEY;
  const queries = [];

  const db = {
    async query(sql, params) {
      queries.push({ sql, params });

      if (sql.includes('FROM integration_connections') && sql.includes('LIMIT 1')) {
        return { rows: [] };
      }

      if (sql.includes('FROM integration_connections')) {
        return { rows: [] };
      }

      return { rows: [] };
    },
  };

  const sites = {
    async getSite(id) {
      return {
        id,
        tenant_id: 'tenant-2',
      };
    },
  };

  const service = new IntegrationsService(db, sites, new IntegrationSecretsService());
  await service.updateForSite('site-2', [
    {
      providerKey: 'shopify',
      connectionKey: 'primary',
      status: 'connected',
      config: {
        values: {
          shopDomain: 'shop.example.myshopify.com',
        },
      },
      secrets: {
        values: {
          adminApiToken: 'token-2',
        },
      },
    },
  ]);

  const insertCall = queries.find((entry) => /INSERT INTO integration_connections/i.test(entry.sql));
  assert.ok(insertCall);
  assert.equal(insertCall.params[1], 'tenant-2');
  assert.equal(insertCall.params[2], 'site-2');
});
