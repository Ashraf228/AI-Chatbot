import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../db/prisma.service';
import { SitesService } from '../sites/sites.service';
import { IntegrationSecretsService } from './integration-secrets.service';
import {
  getIntegrationDefinition,
  INTEGRATION_REGISTRY,
  IntegrationDefinition,
} from './integration-registry';

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
      providerKey: definition.providerKey,
      connectionKey: definition.connectionKey,
      label: definition.label,
      description: definition.description,
      category: definition.category,
      displayName: row?.display_name || definition.label,
      status: (row?.status === 'connected' ? 'connected' : 'disconnected') as
        | 'connected'
        | 'disconnected',
      config,
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
}
