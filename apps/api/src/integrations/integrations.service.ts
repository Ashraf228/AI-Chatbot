import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';
import { IntegrationSecretsService } from './integration-secrets.service';
import {
  INTEGRATION_EVENTS,
  getIntegrationDefinition,
  INTEGRATION_REGISTRY,
  IntegrationDefinition,
  IntegrationEventType,
} from './integration-registry';
import { maskSensitiveRecord, parseJsonRecord, validatePublicIntegrationUrl } from './integration-security';

type IntegrationConnectionRow = {
  id: string;
  tenant_id: string | null;
  site_id: string;
  provider_key: string;
  connection_key: string;
  display_name: string;
  status: string;
  config: Record<string, unknown> | null;
  secrets: Record<string, unknown> | null;
  secrets_encrypted?: boolean;
  created_at: string;
  updated_at: string;
};

function normalizeRecord(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function countConfiguredSecrets(secretFields: string[], secrets: Record<string, unknown>) {
  return secretFields.filter((key) => {
    const value = secrets[key];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  }).length;
}

function readEvents(config: Record<string, unknown>, definition: IntegrationDefinition): IntegrationEventType[] {
  const raw = config.events;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,\n]/)
      : [];
  const allowed = new Set(definition.supportedEvents);
  const selected = values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value): value is IntegrationEventType =>
      INTEGRATION_EVENTS.includes(value as IntegrationEventType) && allowed.has(value as IntegrationEventType),
    );
  return selected.length > 0 ? selected : definition.supportedEvents;
}

function endpointFromConfig(config: Record<string, unknown>) {
  const value = config.url || config.endpointUrl || config.webhookUrl;
  return typeof value === 'string' ? value.trim() : '';
}

function publicConfig(config: Record<string, unknown>) {
  const next = { ...config };
  for (const key of ['headers', 'fieldMapping']) {
    const raw = next[key];
    if (!raw) {
      continue;
    }
    try {
      next[key] = JSON.stringify(maskSensitiveRecord(parseJsonRecord(raw)), null, 2);
    } catch {
      next[key] = raw;
    }
  }
  return maskSensitiveRecord(next);
}

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly secretCrypto: IntegrationSecretsService,
  ) {}

  private async maybeEncryptStoredSecrets(row?: IntegrationConnectionRow) {
    if (!row) {
      return row;
    }

    const currentSecrets = normalizeRecord(row.secrets);
    if (!this.secretCrypto.hasConfiguredSecrets(currentSecrets)) {
      return row;
    }

    const inspected = this.secretCrypto.inspectRecord(
      currentSecrets,
      Boolean(row.secrets_encrypted),
    );
    if (!inspected.requiresMigration) {
      return row;
    }

    if (!this.secretCrypto.isConfigured()) {
      return row;
    }

    const encryptedSecrets = this.secretCrypto.encryptRecord(inspected.decrypted);

    await this.db.query(
      `UPDATE integration_connections
       SET secrets = $2::jsonb,
           secrets_encrypted = true,
           updated_at = now()
       WHERE id = $1`,
      [row.id, JSON.stringify(encryptedSecrets)],
    );

    return {
      ...row,
      secrets: encryptedSecrets,
      secrets_encrypted: true,
    };
  }

  private mapConnection(
    siteId: string,
    definition: IntegrationDefinition,
    row?: IntegrationConnectionRow,
  ) {
    const config = normalizeRecord(row?.config);
    const secrets = normalizeRecord(row?.secrets);
    const secretKeys = definition.secretFields.map((field) => field.key);

    return {
      siteId,
      id: row?.id ?? null,
      providerKey: definition.providerKey,
      connectionKey: definition.connectionKey,
      type: definition.type,
      label: definition.label,
      displayName: row?.display_name || definition.displayName || definition.label,
      description: definition.description,
      category: definition.category,
      enabled: row?.status === 'connected',
      status: (row?.status === 'connected' ? 'connected' : 'disconnected') as 'connected' | 'disconnected',
      supportedEvents: definition.supportedEvents,
      selectedEvents: readEvents(config, definition),
      requiresSecret: definition.requiresSecret,
      testable: definition.testable,
      config: publicConfig(config),
      secretFieldCount: secretKeys.length,
      configuredSecretCount: countConfiguredSecrets(secretKeys, secrets),
      configFields: definition.configFields,
      secretFields: definition.secretFields.map((field) => ({
        key: field.key,
        label: field.label,
        kind: field.kind,
        placeholder: field.placeholder,
      })),
      createdAt: row?.created_at ?? null,
      updatedAt: row?.updated_at ?? null,
      lastTestedAt: typeof config.lastTestedAt === 'string' ? config.lastTestedAt : null,
      lastTestStatus: typeof config.lastTestStatus === 'string' ? config.lastTestStatus : null,
      lastError: typeof config.lastError === 'string' ? config.lastError : null,
    };
  }

  async listForSite(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<IntegrationConnectionRow>(
      `SELECT
         id,
         tenant_id,
         site_id,
         provider_key,
         connection_key,
         display_name,
         status,
         config,
         secrets,
         secrets_encrypted,
         created_at,
         updated_at
       FROM integration_connections
       WHERE site_id = $1
       ORDER BY provider_key ASC, connection_key ASC`,
      [siteId],
    );

    const rows = (
      await Promise.all(res.rows.map((row) => this.maybeEncryptStoredSecrets(row)))
    ).filter((row): row is IntegrationConnectionRow => Boolean(row));
    const rowsByKey = new Map(rows.map((row) => [`${row.provider_key}:${row.connection_key}`, row]));

    return INTEGRATION_REGISTRY.map((definition) =>
      this.mapConnection(
        siteId,
        definition,
        rowsByKey.get(`${definition.providerKey}:${definition.connectionKey}`),
      ),
    );
  }

  async rotateSecretsForSite(siteId: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const res = await this.db.query<IntegrationConnectionRow>(
      `SELECT *
       FROM integration_connections
       WHERE site_id = $1
       ORDER BY provider_key ASC, connection_key ASC`,
      [siteId],
    );

    let rotated = 0;
    let unchanged = 0;

    for (const row of res.rows) {
      const normalized = await this.maybeEncryptStoredSecrets(row);
      if (normalized?.secrets_encrypted && JSON.stringify(normalized.secrets) !== JSON.stringify(row.secrets)) {
        rotated += 1;
      } else {
        unchanged += 1;
      }
    }

    return {
      siteId,
      scanned: res.rows.length,
      rotated,
      unchanged,
    };
  }

  async updateForSite(
    siteId: string,
    connections: Array<{
      providerKey: string;
      connectionKey: string;
      displayName?: string;
      status: 'connected' | 'disconnected';
      config?: { values?: Record<string, unknown> };
      secrets?: { values?: Record<string, unknown> };
    }>,
  ) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const tenantId = site.tenant_id;
    if (!tenantId) {
      throw new BadRequestException('Site has no tenant');
    }

    for (const connection of connections) {
      const definition = getIntegrationDefinition(connection.providerKey, connection.connectionKey);
      if (!definition) {
        throw new BadRequestException(
          `Unknown integration: ${connection.providerKey}/${connection.connectionKey}`,
        );
      }

      const existingRes = await this.db.query<IntegrationConnectionRow>(
        `SELECT *
         FROM integration_connections
         WHERE site_id = $1
           AND provider_key = $2
           AND connection_key = $3
         LIMIT 1`,
        [siteId, definition.providerKey, definition.connectionKey],
      );

      const existing = existingRes.rows[0];
      const migratedExisting = await this.maybeEncryptStoredSecrets(existing);
      const nextConfig = normalizeRecord(connection.config?.values);
      await this.validateConnectionConfig(definition, nextConfig, connection.status === 'connected');
      const incomingSecrets = normalizeRecord(connection.secrets?.values);
      const existingSecrets = this.secretCrypto.decryptRecord(
        normalizeRecord(migratedExisting?.secrets),
        Boolean(migratedExisting?.secrets_encrypted),
      );
      const nextSecrets = {
        ...existingSecrets,
        ...Object.fromEntries(
          Object.entries(incomingSecrets).filter(([_, value]) => {
            if (typeof value === 'string') {
              return value.trim().length > 0;
            }

            return value !== null && value !== undefined;
          }),
        ),
      };

      const displayName =
        connection.displayName?.trim() || migratedExisting?.display_name || definition.label;
      const hasSecrets = this.secretCrypto.hasConfiguredSecrets(nextSecrets);
      const encryptedSecrets = hasSecrets
        ? this.secretCrypto.encryptRecord(nextSecrets)
        : {};

      await this.db.query(
        `INSERT INTO integration_connections(
           id,
           tenant_id,
           site_id,
           provider_key,
           connection_key,
           display_name,
           status,
           config,
           secrets,
           secrets_encrypted,
           created_at,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, now(), now())
         ON CONFLICT (site_id, provider_key, connection_key) DO UPDATE SET
           tenant_id = EXCLUDED.tenant_id,
           display_name = EXCLUDED.display_name,
           status = EXCLUDED.status,
           config = EXCLUDED.config,
           secrets = EXCLUDED.secrets,
           secrets_encrypted = EXCLUDED.secrets_encrypted,
           updated_at = now()`,
        [
          migratedExisting?.id || randomUUID(),
          tenantId,
          siteId,
          definition.providerKey,
          definition.connectionKey,
          displayName,
          connection.status,
          JSON.stringify(nextConfig),
          JSON.stringify(encryptedSecrets),
          hasSecrets,
        ],
      );
    }

    return this.listForSite(siteId);
  }

  async createForSite(
    siteId: string,
    input: {
      providerKey: string;
      connectionKey?: string;
      displayName?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      secrets?: Record<string, unknown>;
    },
  ) {
    await this.upsertOne(siteId, {
      providerKey: input.providerKey,
      connectionKey: input.connectionKey || 'primary',
      displayName: input.displayName,
      status: input.enabled === false ? 'disconnected' : 'connected',
      config: { values: normalizeRecord(input.config) },
      secrets: { values: normalizeRecord(input.secrets) },
    });
    const definition = getIntegrationDefinition(input.providerKey, input.connectionKey || 'primary');
    return this.getMaskedConnectionForSite(siteId, definition?.providerKey || input.providerKey, definition?.connectionKey || input.connectionKey || 'primary');
  }

  async patchForSite(
    siteId: string,
    integrationId: string,
    input: {
      displayName?: string;
      enabled?: boolean;
      config?: Record<string, unknown>;
      secrets?: Record<string, unknown>;
    },
  ) {
    const existing = await this.findRowById(siteId, integrationId);
    if (!existing) {
      throw new BadRequestException('Integration not found');
    }
    await this.upsertOne(siteId, {
      providerKey: existing.provider_key,
      connectionKey: existing.connection_key,
      displayName: input.displayName ?? existing.display_name,
      status: input.enabled === undefined ? existing.status as 'connected' | 'disconnected' : input.enabled ? 'connected' : 'disconnected',
      config: { values: { ...normalizeRecord(existing.config), ...normalizeRecord(input.config) } },
      secrets: { values: normalizeRecord(input.secrets) },
    });
    return this.getMaskedConnectionForSite(siteId, existing.provider_key, existing.connection_key);
  }

  async deleteForSite(siteId: string, integrationId: string) {
    const res = await this.db.query<IntegrationConnectionRow>(
      `DELETE FROM integration_connections
       WHERE id = $1 AND site_id = $2
       RETURNING *`,
      [integrationId, siteId],
    );
    const row = res.rows[0];
    if (!row) {
      throw new BadRequestException('Integration not found');
    }
    return {
      ok: true,
      id: row.id,
      providerKey: row.provider_key,
      connectionKey: row.connection_key,
    };
  }

  async testForSite(siteId: string, integrationId: string) {
    const row = await this.findRowById(siteId, integrationId);
    if (!row) {
      throw new BadRequestException('Integration not found');
    }
    const definition = getIntegrationDefinition(row.provider_key, row.connection_key);
    if (!definition) {
      throw new BadRequestException('Unknown integration');
    }
    const config = normalizeRecord(row.config);
    const secrets = this.secretCrypto.decryptRecord(normalizeRecord(row.secrets), Boolean(row.secrets_encrypted));

    try {
      await this.validateConnectionConfig(definition, config, true);
      if (['webhook', 'crm_webhook', 'ticket_webhook'].includes(definition.type)) {
        const endpointUrl = endpointFromConfig(config);
        const headers = this.buildHeaders(config, secrets);
        const response = await fetch(endpointUrl, {
          method: typeof config.method === 'string' ? config.method : 'POST',
          headers,
          body: JSON.stringify({
            eventType: 'integration.test',
            siteId,
            integrationId,
            sentAt: new Date().toISOString(),
          }),
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) {
          throw new Error(`Webhook returned ${response.status}`);
        }
      }
      const result = await this.patchTestState(row.id, siteId, { ok: true });
      return { status: 'success', message: 'Verbindung erfolgreich getestet.', integration: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection test failed';
      const result = await this.patchTestState(row.id, siteId, { ok: false, error: message });
      return { status: 'failed', message, integration: result };
    }
  }

  async getActiveEventConnections(siteId: string, eventType: IntegrationEventType) {
    const rows = await this.db.query<IntegrationConnectionRow>(
      `SELECT *
       FROM integration_connections
       WHERE site_id = $1
         AND status = 'connected'
       ORDER BY provider_key ASC, connection_key ASC`,
      [siteId],
    );

    const result = [];
    for (const row of rows.rows) {
      const definition = getIntegrationDefinition(row.provider_key, row.connection_key);
      if (!definition || !definition.supportedEvents.includes(eventType)) {
        continue;
      }
      const config = normalizeRecord(row.config);
      const selectedEvents = readEvents(config, definition);
      if (!selectedEvents.includes(eventType)) {
        continue;
      }
      result.push({
        id: row.id,
        tenantId: row.tenant_id,
        siteId: row.site_id,
        providerKey: row.provider_key,
        connectionKey: row.connection_key,
        type: definition.type,
        displayName: row.display_name,
        config,
        secrets: this.secretCrypto.decryptRecord(normalizeRecord(row.secrets), Boolean(row.secrets_encrypted)),
      });
    }
    return result;
  }

  async getConnectionForSite(siteId: string, providerKey: string, connectionKey: string) {
    const site = await this.sites.getSite(siteId);
    if (!site) {
      throw new BadRequestException('Invalid siteId');
    }

    const definition = getIntegrationDefinition(providerKey, connectionKey);
    if (!definition) {
      throw new BadRequestException('Unknown integration');
    }

    const res = await this.db.query<IntegrationConnectionRow>(
      `SELECT *
       FROM integration_connections
       WHERE site_id = $1
         AND provider_key = $2
         AND connection_key = $3
       LIMIT 1`,
      [siteId, providerKey, connectionKey],
    );

    const row = await this.maybeEncryptStoredSecrets(res.rows[0]);
    if (!row) {
      return null;
    }

    return {
      siteId,
      providerKey: definition.providerKey,
      connectionKey: definition.connectionKey,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      displayName: row.display_name,
      status: row.status === 'connected' ? 'connected' : 'disconnected',
      config: normalizeRecord(row.config),
      secrets: this.secretCrypto.decryptRecord(
        normalizeRecord(row.secrets),
        Boolean(row.secrets_encrypted),
      ),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getMaskedConnectionForSite(siteId: string, providerKey: string, connectionKey: string) {
    const items = await this.listForSite(siteId);
    return items.find((item) => item.providerKey === providerKey && item.connectionKey === connectionKey) || null;
  }

  buildHeaders(config: Record<string, unknown>, secrets: Record<string, unknown>) {
    const parsedHeaders = parseJsonRecord(config.headers);
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    for (const [key, value] of Object.entries(parsedHeaders)) {
      if (typeof value === 'string' && key.toLowerCase() !== 'host') {
        headers[key] = value;
      }
    }
    const bearerToken = typeof secrets.bearerToken === 'string' ? secrets.bearerToken.trim() : '';
    const apiKey = typeof secrets.apiKey === 'string' ? secrets.apiKey.trim() : '';
    const signingSecret = typeof secrets.signingSecret === 'string' ? secrets.signingSecret.trim() : '';
    const secret = typeof secrets.secret === 'string' ? secrets.secret.trim() : '';
    if (bearerToken) {
      headers.authorization = `Bearer ${bearerToken}`;
    }
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }
    if (signingSecret || secret) {
      headers['x-webhook-secret'] = signingSecret || secret;
    }
    return headers;
  }

  private async upsertOne(
    siteId: string,
    connection: {
      providerKey: string;
      connectionKey: string;
      displayName?: string;
      status: 'connected' | 'disconnected';
      config?: { values?: Record<string, unknown> };
      secrets?: { values?: Record<string, unknown> };
    },
  ) {
    await this.updateForSite(siteId, [connection]);
  }

  private async findRowById(siteId: string, integrationId: string) {
    const res = await this.db.query<IntegrationConnectionRow>(
      `SELECT *
       FROM integration_connections
       WHERE site_id = $1 AND id = $2
       LIMIT 1`,
      [siteId, integrationId],
    );
    return this.maybeEncryptStoredSecrets(res.rows[0]);
  }

  private async validateConnectionConfig(
    definition: IntegrationDefinition,
    config: Record<string, unknown>,
    enabled: boolean,
  ) {
    if (!enabled) {
      return;
    }
    if (['webhook', 'crm_webhook', 'ticket_webhook'].includes(definition.type)) {
      const endpointUrl = endpointFromConfig(config);
      if (!endpointUrl) {
        throw new BadRequestException('Webhook-URL fehlt.');
      }
      await validatePublicIntegrationUrl(endpointUrl);
      parseJsonRecord(config.headers);
      parseJsonRecord(config.fieldMapping);
    }
  }

  private async patchTestState(
    integrationId: string,
    siteId: string,
    result: { ok: boolean; error?: string },
  ) {
    const patch = result.ok
      ? { lastTestedAt: new Date().toISOString(), lastTestStatus: 'success', lastError: '' }
      : { lastTestedAt: new Date().toISOString(), lastTestStatus: 'failed', lastError: result.error || 'Test fehlgeschlagen' };
    await this.db.query(
      `UPDATE integration_connections
       SET config = COALESCE(config, '{}'::jsonb) || $3::jsonb,
           updated_at = now()
       WHERE id = $1 AND site_id = $2`,
      [integrationId, siteId, JSON.stringify(patch)],
    );
    const row = await this.findRowById(siteId, integrationId);
    if (!row) {
      return null;
    }
    return this.getMaskedConnectionForSite(siteId, row.provider_key, row.connection_key);
  }
}
