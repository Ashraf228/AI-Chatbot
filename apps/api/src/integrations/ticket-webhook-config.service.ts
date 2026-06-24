import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  IntegrationEventDispatcherService,
  type IntegrationDispatchContext,
} from './integration-event-dispatcher.service';
import { IntegrationsService } from './integrations.service';

const TICKET_WEBHOOK_PROVIDER = 'ticket-webhook';
const TICKET_WEBHOOK_CONNECTION = 'primary';
const TICKET_CREATED_EVENT = 'ticket.created';

type MaskedTicketConnection = {
  id: string | null;
  label?: string;
  displayName?: string;
  enabled?: boolean;
  status?: 'connected' | 'disconnected';
  config?: Record<string, unknown>;
  configuredSecretCount?: number;
  hasSigningSecret?: boolean;
  signingMode?: 'hmac_sha256' | 'legacy_secret_header';
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  lastError?: string | null;
};

export type TicketWebhookConfigResponse = {
  providerKey: 'ticket-webhook';
  connectionKey: 'primary';
  enabled: boolean;
  label: string;
  targetUrl: string;
  hasSigningSecret: boolean;
  signingMode: 'hmac_sha256' | 'legacy_secret_header';
  lastTestStatus: string | null;
  lastTestAt: string | null;
  lastError: string | null;
  forwardingConfigured: boolean;
  status: 'not_configured' | 'active' | 'test_queued' | 'test_success' | 'test_failed';
};

export type TicketWebhookUpdateInput = {
  enabled?: boolean;
  label?: string;
  targetUrl?: string;
  signingSecret?: string;
  rotateSecret?: boolean;
};

@Injectable()
export class TicketWebhookConfigService {
  constructor(
    private readonly integrations: IntegrationsService,
    private readonly dispatcher: IntegrationEventDispatcherService,
  ) {}

  async getConfig(siteId: string): Promise<TicketWebhookConfigResponse> {
    const connection = await this.getConnection(siteId);
    return this.mapConnection(connection);
  }

  async updateConfig(
    siteId: string,
    input: TicketWebhookUpdateInput,
  ): Promise<TicketWebhookConfigResponse> {
    const current = await this.getConnection(siteId);
    const enabled = input.enabled === undefined ? true : Boolean(input.enabled);
    const targetUrl = typeof input.targetUrl === 'string'
      ? input.targetUrl.trim()
      : this.getTargetUrl(current?.config || {});

    if (enabled && !targetUrl) {
      throw new BadRequestException('Ticket-Webhook-URL fehlt.');
    }

    const secrets: Record<string, unknown> = {};
    const signingSecret = typeof input.signingSecret === 'string' ? input.signingSecret.trim() : '';
    if (signingSecret) {
      secrets.signingSecret = signingSecret;
    } else if (input.rotateSecret) {
      secrets.signingSecret = this.generateSigningSecret();
    }

    const config = {
      endpointUrl: targetUrl,
      url: targetUrl,
      events: [TICKET_CREATED_EVENT],
    };
    const payload = {
      displayName: input.label?.trim() || current?.displayName || 'Ticket-Weiterleitung',
      enabled,
      config,
      secrets,
    };

    const saved = current?.id
      ? await this.integrations.patchForSite(siteId, current.id, payload)
      : await this.integrations.createForSite(siteId, {
          providerKey: TICKET_WEBHOOK_PROVIDER,
          connectionKey: TICKET_WEBHOOK_CONNECTION,
          ...payload,
        });

    return this.mapConnection(saved as MaskedTicketConnection | null);
  }

  async disableConfig(siteId: string): Promise<TicketWebhookConfigResponse> {
    const current = await this.getConnection(siteId);
    if (current?.id) {
      await this.integrations.deleteForSite(siteId, current.id);
    }
    return this.mapConnection(null);
  }

  async sendTest(
    siteId: string,
    context: IntegrationDispatchContext = {},
  ): Promise<{ status: 'queued' | 'failed'; message: string; config: TicketWebhookConfigResponse }> {
    const current = await this.getConnection(siteId);
    const mapped = this.mapConnection(current);
    if (!current?.id || !mapped.forwardingConfigured) {
      throw new BadRequestException('Ticket-Webhook ist nicht konfiguriert.');
    }

    const results = await this.dispatcher.dispatch(
      siteId,
      TICKET_CREATED_EVENT,
      {
        event: TICKET_CREATED_EVENT,
        test: true,
        ticketId: 'test-ticket',
        subject: 'Test IT-Support-Ticket',
        description: 'Dies ist ein Test-Webhook.',
        category: 'it_support',
        priority: 'normal',
        customerEmail: 'test@example.com',
        reporter: {
          email: 'test@example.com',
        },
        technicalContext: {
          device: 'Testgeraet',
        },
      },
      {
        ...context,
        source: context.source || 'dashboard',
      },
    );

    const queued = results.find((entry) => entry.status === 'queued');
    const failed = results.find((entry) => entry.status === 'failed');
    const testStatus = queued ? 'queued' : 'failed';
    const lastError = failed?.message || (!queued ? 'Test-Webhook konnte nicht eingereiht werden.' : '');

    const patched = await this.integrations.patchForSite(siteId, current.id, {
      config: {
        lastTestedAt: new Date().toISOString(),
        lastTestStatus: testStatus,
        lastError,
      },
    });

    return {
      status: testStatus,
      message: queued ? 'Test-Webhook wurde eingereiht.' : lastError,
      config: this.mapConnection(patched as MaskedTicketConnection | null),
    };
  }

  private async getConnection(siteId: string): Promise<MaskedTicketConnection | null> {
    return (await this.integrations.getMaskedConnectionForSite(
      siteId,
      TICKET_WEBHOOK_PROVIDER,
      TICKET_WEBHOOK_CONNECTION,
    )) as MaskedTicketConnection | null;
  }

  private mapConnection(connection: MaskedTicketConnection | null): TicketWebhookConfigResponse {
    const config = connection?.config || {};
    const targetUrl = this.getTargetUrl(config);
    const enabled = Boolean(connection?.enabled || connection?.status === 'connected');
    const forwardingConfigured = enabled && Boolean(targetUrl);
    const lastTestStatus = typeof connection?.lastTestStatus === 'string'
      ? connection.lastTestStatus
      : typeof config.lastTestStatus === 'string'
        ? config.lastTestStatus
        : null;
    const lastTestAt = typeof connection?.lastTestedAt === 'string'
      ? connection.lastTestedAt
      : typeof config.lastTestedAt === 'string'
        ? config.lastTestedAt
        : null;
    const lastError = typeof connection?.lastError === 'string'
      ? connection.lastError
      : typeof config.lastError === 'string'
        ? config.lastError
        : null;

    return {
      providerKey: TICKET_WEBHOOK_PROVIDER,
      connectionKey: TICKET_WEBHOOK_CONNECTION,
      enabled,
      label: connection?.displayName || connection?.label || 'Ticket-Weiterleitung',
      targetUrl,
      hasSigningSecret: Boolean(connection?.hasSigningSecret),
      signingMode: connection?.signingMode || 'hmac_sha256',
      lastTestStatus,
      lastTestAt,
      lastError,
      forwardingConfigured,
      status: this.deriveStatus(forwardingConfigured, lastTestStatus),
    };
  }

  private getTargetUrl(config: Record<string, unknown>) {
    const value = config.endpointUrl || config.url || config.webhookUrl;
    return typeof value === 'string' ? value.trim() : '';
  }

  private deriveStatus(
    forwardingConfigured: boolean,
    lastTestStatus: string | null,
  ): TicketWebhookConfigResponse['status'] {
    if (!forwardingConfigured) {
      return 'not_configured';
    }
    if (lastTestStatus === 'success') {
      return 'test_success';
    }
    if (lastTestStatus === 'queued') {
      return 'test_queued';
    }
    if (lastTestStatus === 'failed') {
      return 'test_failed';
    }
    return 'active';
  }

  private generateSigningSecret() {
    return randomBytes(32).toString('base64');
  }
}
