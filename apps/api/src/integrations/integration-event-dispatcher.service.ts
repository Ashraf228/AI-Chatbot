import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PrismaService } from '../db/prisma.service';
import { IntegrationEventType } from './integration-registry';
import { maskSensitiveRecord, validatePublicIntegrationUrl } from './integration-security';
import { IntegrationsService } from './integrations.service';
import { createWebhookEventId, decodeWebhookSecretB64, serializeWebhookJson } from '../webhooks/webhook-hmac';

export type IntegrationDispatchContext = {
  tenantId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  source?: 'widget' | 'dashboard' | 'api' | 'system' | string;
  agentRunId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
};

export type IntegrationDispatchResult = {
  integrationId: string;
  providerKey: string;
  connectionKey: string;
  type: string;
  status: 'queued' | 'skipped' | 'failed';
  message: string;
  webhookJobId?: string;
};

function endpointFromConfig(config: Record<string, unknown>) {
  const value = config.url || config.endpointUrl || config.webhookUrl;
  return typeof value === 'string' ? value.trim() : '';
}

function methodFromConfig(config: Record<string, unknown>) {
  const method = typeof config.method === 'string' ? config.method.toUpperCase() : 'POST';
  return ['POST', 'PUT', 'PATCH'].includes(method) ? method : 'POST';
}

@Injectable()
export class IntegrationEventDispatcherService {
  private readonly logger = new Logger(IntegrationEventDispatcherService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly auditLogs: AuditLogService,
  ) {}

  async dispatch(
    siteId: string,
    eventType: IntegrationEventType,
    payload: Record<string, unknown>,
    context: IntegrationDispatchContext = {},
  ): Promise<IntegrationDispatchResult[]> {
    const connections = await this.integrations.getActiveEventConnections(siteId, eventType);
    const results: IntegrationDispatchResult[] = [];

    for (const connection of connections) {
      try {
        if (connection.type === 'email') {
          results.push({
            integrationId: connection.id,
            providerKey: connection.providerKey,
            connectionKey: connection.connectionKey,
            type: connection.type,
            status: 'skipped',
            message: 'E-Mail-Integration ist vorbereitet, Versand laeuft ueber bestehende Mail-Konfiguration.',
          });
          continue;
        }

        if (!['webhook', 'crm_webhook', 'ticket_webhook'].includes(connection.type)) {
          results.push({
            integrationId: connection.id,
            providerKey: connection.providerKey,
            connectionKey: connection.connectionKey,
            type: connection.type,
            status: 'skipped',
            message: 'Integrationstyp wird fuer Events aktuell nicht automatisch ausgefuehrt.',
          });
          continue;
        }

        const endpointUrl = endpointFromConfig(connection.config);
        if (!endpointUrl) {
          throw new Error('Webhook URL missing');
        }

        const jobId = randomUUID();
        const signingMode = connection.signingMode === 'hmac_sha256' ? 'hmac_sha256' : 'legacy_secret_header';
        const headers = this.integrations.buildHeaders(connection.config, connection.secrets, signingMode);
        const payloadBody = serializeWebhookJson({
          eventType,
          siteId,
          conversationId: context.conversationId || null,
          source: context.source || 'system',
          payload,
          sentAt: new Date().toISOString(),
        });
        const signingSecret = signingMode === 'hmac_sha256'
          ? this.integrations.getWebhookSigningSecret(connection.secrets)
          : '';
        if (signingMode === 'hmac_sha256' && !decodeWebhookSecretB64(signingSecret)) {
          throw new Error('Webhook HMAC signing secret missing or invalid');
        }
        const protectedSigningSecret = signingMode === 'hmac_sha256'
          ? this.integrations.protectJobSigningSecret(signingSecret)
          : { value: {}, encrypted: false };
        await this.db.query(
          `INSERT INTO webhook_jobs(
             id,
             tenant_id,
             site_id,
             agent_run_id,
             provider_key,
             connection_key,
             endpoint_url,
             method,
             headers,
             payload,
             signing_mode,
             event_id,
             payload_body,
             signing_secret,
             signing_secret_encrypted,
             status,
             retry_count,
             max_attempts,
             available_at,
             locked_at,
             completed_at,
             last_error,
             created_at,
             updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14::jsonb, $15, 'queued', 0, 5,
             now(), null, null, null, now(), now()
           )`,
          [
            jobId,
            context.tenantId || connection.tenantId || null,
            siteId,
            context.agentRunId || null,
            connection.providerKey,
            connection.connectionKey,
            await validatePublicIntegrationUrl(endpointUrl),
            methodFromConfig(connection.config),
            JSON.stringify(headers),
            payloadBody.toString('utf8'),
            signingMode,
            createWebhookEventId(),
            payloadBody.toString('utf8'),
            JSON.stringify(protectedSigningSecret.value),
            protectedSigningSecret.encrypted,
          ],
        );

        await this.auditLogs.record({
          siteId,
          tenantId: context.tenantId || connection.tenantId || null,
          actorId: context.actorId || 'system',
          actorRole: context.actorRole || 'system',
          action: 'integration.event_dispatched',
          resourceType: 'integration_connection',
          resourceId: connection.id,
          metadata: {
            eventType,
            providerKey: connection.providerKey,
            connectionKey: connection.connectionKey,
            webhookJobId: jobId,
            headers: maskSensitiveRecord(headers),
          },
        });

        results.push({
          integrationId: connection.id,
          providerKey: connection.providerKey,
          connectionKey: connection.connectionKey,
          type: connection.type,
          status: 'queued',
          message: 'Integration Event wurde eingereiht.',
          webhookJobId: jobId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Integration event failed';
        this.logger.warn(`Integration event failed for ${connection.providerKey}/${connection.connectionKey}: ${message}`);
        await this.auditLogs.record({
          siteId,
          tenantId: context.tenantId || connection.tenantId || null,
          actorId: context.actorId || 'system',
          actorRole: context.actorRole || 'system',
          action: 'integration.event_failed',
          resourceType: 'integration_connection',
          resourceId: connection.id,
          metadata: {
            eventType,
            providerKey: connection.providerKey,
            connectionKey: connection.connectionKey,
            error: message,
          },
        });
        results.push({
          integrationId: connection.id,
          providerKey: connection.providerKey,
          connectionKey: connection.connectionKey,
          type: connection.type,
          status: 'failed',
          message,
        });
      }
    }

    return results;
  }
}
