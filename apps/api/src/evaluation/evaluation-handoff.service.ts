import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PrismaService } from '../db/prisma.service';
import {
  buildWebhookHeaders,
  createWebhookDeliveryId,
  createWebhookEventId,
  decodeWebhookSecretB64,
  normalizeSignatureToleranceSeconds,
  payloadSha256Hex,
  serializeWebhookJson,
  verifyWebhookSignature,
} from '../webhooks/webhook-hmac';
import { EvaluationAccessContext } from './evaluation-access.service';
import { buildPreviewSummary, ProductImpact, redactEvaluationSensitiveValue } from './evaluation-product-support';

const EVENT_TYPE = 'evaluation.product_support_ticket.handoff';
const RECEIVER_PATH = '/internal/evaluation/mock-handoff/v1';
const MAX_PAYLOAD_BYTES = 64 * 1024;
const FORBIDDEN_HANDOFF_KEYS = new Set([
  'tenantId',
  'siteId',
  'tenantUserId',
  'ticketId',
  'webhookUrl',
  'receiverUrl',
  'secret',
  'signature',
  'role',
  'forwardingStatus',
  'eventId',
  'deliveryId',
  'payload',
]);

type TicketRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  title: string;
  description: string;
  support_profile: string;
  product: string | null;
  module: string | null;
  customer_organization: string | null;
  customer_reference: string | null;
  process_or_form_name: string | null;
  impact: string | null;
  device: string | null;
  operating_system: string | null;
  error_message: string | null;
  already_tried: string | null;
  evaluation_chat_session_id: string;
  demo_reference: string | null;
  demo: boolean;
  synthetic: boolean;
  created_at: string;
};

type HandoffEventRow = {
  id: string;
  event_id: string;
  event_type: string;
  tenant_id: string;
  site_id: string;
  tenant_user_id: string;
  evaluation_chat_session_id: string;
  conversation_id: string;
  evaluation_ticket_id: string;
  payload_body: string;
  payload_hash: string;
  status: string;
  delivered_at: string | null;
  last_error_code: string | null;
  created_at: string;
};

type DeliveryRow = {
  delivery_id: string;
  attempt_number: number;
  status: string;
  http_status: number | null;
  retryable: boolean;
  response_summary: string | null;
  error_code: string | null;
  completed_at: string | null;
};

function assertOnlyConversationId(body: Record<string, unknown>) {
  for (const key of Object.keys(body)) {
    if (key !== 'conversationId' || FORBIDDEN_HANDOFF_KEYS.has(key)) {
      throw new BadRequestException(`${key} is not accepted for evaluation handoff requests`);
    }
  }
}

function cleanString(value: unknown, maxLength = 1200) {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, maxLength)
    : undefined;
}

function normalizeOrigin(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    if (url.protocol === 'https:') return url.origin;
    if (process.env.NODE_ENV !== 'production' && url.protocol === 'http:') return url.origin;
    return null;
  } catch {
    return null;
  }
}

function timeoutMs(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1000, Math.min(parsed, 10000)) : 5000;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeResponseSummary(value: string) {
  return value.replace(/[\r\n\t]+/g, ' ').slice(0, 8000);
}

function isRetryableStatus(status: number | null) {
  return status === null || status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function normalizeImpact(value: string | null): ProductImpact | undefined {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical' ? value : undefined;
}

function mapStatus(status: string): string {
  if (status === 'delivered') return 'mock_delivered';
  if (status === 'delivering') return 'mock_delivering';
  if (status === 'failed_retryable') return 'mock_failed_retryable';
  if (status === 'failed_permanent') return 'mock_failed_permanent';
  if (status === 'queued') return 'mock_queued';
  return 'not_requested';
}

@Injectable()
export class EvaluationHandoffService {
  constructor(
    private readonly db: PrismaService,
    private readonly auditLogs: AuditLogService,
  ) {}

  async requestHandoff(access: EvaluationAccessContext, body: Record<string, unknown>) {
    assertOnlyConversationId(body);
    const conversationId = cleanString(body.conversationId, 200);
    if (!conversationId) {
      throw new BadRequestException('conversationId required');
    }
    await this.audit('evaluation_handoff_requested', access, { result: 'requested', conversationId });

    const ticket = await this.loadConfirmedTicket(access, conversationId);
    const event = await this.ensureEvent(access, ticket, conversationId);
    return this.deliverEvent(access, event);
  }

  async handoffStatus(access: EvaluationAccessContext, body: Record<string, unknown>) {
    assertOnlyConversationId(body);
    const conversationId = cleanString(body.conversationId, 200);
    if (!conversationId) {
      throw new BadRequestException('conversationId required');
    }
    const res = await this.db.query<HandoffEventRow>(
      `SELECT id, event_id, event_type, tenant_id, site_id, tenant_user_id,
              evaluation_chat_session_id, conversation_id, evaluation_ticket_id,
              payload_body, payload_hash, status, delivered_at, last_error_code, created_at
       FROM evaluation_handoff_events
       WHERE tenant_id = $1
         AND site_id = $2
         AND tenant_user_id = $3
         AND evaluation_chat_session_id = $4
         AND demo = true
         AND synthetic = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [access.tenantId, access.siteId, access.tenantUserId, conversationId],
    );
    const event = res.rows[0];
    if (!event) {
      return await this.projectStatus(null, null);
    }
    return await this.projectStatus(event, await this.latestDelivery(event.event_id));
  }

  async receiveMockHandoff(headers: Record<string, string | string[] | undefined>, body: Buffer) {
    const config = this.loadConfig();
    if (!config.enabled || !config.secret) {
      throw new ServiceUnavailableException('mock handoff disabled');
    }
    const eventId = headerValue(headers, 'x-ssb-event-id');
    const deliveryId = headerValue(headers, 'x-ssb-delivery-id');
    const eventType = headerValue(headers, 'x-ssb-event-type');
    const timestamp = headerValue(headers, 'x-ssb-timestamp');
    const signature = headerValue(headers, 'x-ssb-signature');
    if (!eventId || !deliveryId || eventType !== EVENT_TYPE || body.length > MAX_PAYLOAD_BYTES) {
      await this.auditSystem('evaluation_mock_receiver_rejected', { result: 'rejected', reason: 'invalid_headers' });
      throw new BadRequestException('invalid handoff');
    }

    const verification = verifyWebhookSignature({
      secret: config.secret,
      signatureHeader: signature,
      timestampHeader: timestamp,
      body,
      toleranceSeconds: config.toleranceSeconds,
    });
    if (!verification.ok) {
      await this.auditSystem('evaluation_mock_receiver_rejected', { result: 'rejected', reason: verification.code });
      throw new ForbiddenException('invalid signature');
    }

    const eventRes = await this.db.query<HandoffEventRow>(
      `SELECT id, event_id, tenant_id, site_id, payload_hash
       FROM evaluation_handoff_events
       WHERE event_id = $1
         AND event_type = $2
         AND demo = true
         AND synthetic = true
       LIMIT 1`,
      [eventId, EVENT_TYPE],
    );
    const event = eventRes.rows[0];
    const payloadHash = payloadSha256Hex(body);
    if (!event || event.payload_hash !== payloadHash) {
      await this.auditSystem('evaluation_mock_receiver_rejected', { result: 'rejected', reason: event ? 'payload_mismatch' : 'unknown_event' });
      throw new BadRequestException('invalid payload');
    }

    let duplicate = false;
    const receipt = await this.db.query<{ duplicate_count: number }>(
      `INSERT INTO evaluation_mock_handoff_receipts(
         id, event_id, first_delivery_id, last_delivery_id, tenant_id, site_id,
         payload_hash, received_at, last_seen_at, duplicate_count, verification_status
       ) VALUES ($1,$2,$3,$3,$4,$5,$6,now(),now(),0,'verified')
       ON CONFLICT (event_id) DO UPDATE SET
         last_delivery_id = EXCLUDED.last_delivery_id,
         last_seen_at = now(),
         duplicate_count = evaluation_mock_handoff_receipts.duplicate_count + 1
       RETURNING duplicate_count`,
      [randomUUID(), eventId, deliveryId, event.tenant_id, event.site_id, payloadHash],
    );
    duplicate = Number(receipt.rows[0]?.duplicate_count || 0) > 0;
    await this.auditSystem(duplicate ? 'evaluation_mock_receiver_duplicate' : 'evaluation_mock_receiver_verified', {
      result: duplicate ? 'duplicate' : 'verified',
      eventType,
    });
    return { ok: true, duplicate, verified: true };
  }

  private async loadConfirmedTicket(access: EvaluationAccessContext, evaluationChatSessionId: string) {
    const res = await this.db.query<TicketRow>(
      `SELECT id, tenant_id, site_id, title, description, support_profile, product, module,
              customer_organization, customer_reference, process_or_form_name, impact,
              device, operating_system, error_message, already_tried,
              evaluation_chat_session_id, demo_reference, demo, synthetic, created_at
       FROM agent_tickets
       WHERE tenant_id = $1
         AND site_id = $2
         AND evaluation_chat_session_id = $3
         AND support_profile = 'product'
         AND confirmation_status = 'confirmed'
         AND demo = true
         AND synthetic = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [access.tenantId, access.siteId, evaluationChatSessionId],
    );
    const ticket = res.rows[0];
    if (!ticket) {
      throw new BadRequestException('confirmed demo ticket required');
    }
    return ticket;
  }

  private async ensureEvent(access: EvaluationAccessContext, ticket: TicketRow, conversationId: string) {
    const existing = await this.db.query<HandoffEventRow>(
      `SELECT id, event_id, event_type, tenant_id, site_id, tenant_user_id,
              evaluation_chat_session_id, conversation_id, evaluation_ticket_id,
              payload_body, payload_hash, status, delivered_at, last_error_code, created_at
       FROM evaluation_handoff_events
       WHERE evaluation_ticket_id = $1
       LIMIT 1`,
      [ticket.id],
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const eventId = createWebhookEventId();
    const payload = this.buildPayload(ticket, eventId);
    const body = serializeWebhookJson(payload);
    if (body.length > MAX_PAYLOAD_BYTES) {
      throw new BadRequestException('handoff payload too large');
    }
    const payloadHash = payloadSha256Hex(body);
    await this.db.query(
      `INSERT INTO evaluation_handoff_events(
         id, event_id, event_type, tenant_id, site_id, tenant_user_id,
         evaluation_chat_session_id, conversation_id, evaluation_ticket_id,
         demo, synthetic, payload_body, payload_hash, status, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true,$10,$11,'queued',now())`,
      [
        randomUUID(),
        eventId,
        EVENT_TYPE,
        access.tenantId,
        access.siteId,
        access.tenantUserId,
        conversationId,
        conversationId,
        ticket.id,
        body.toString('utf8'),
        payloadHash,
      ],
    );
    const res = await this.db.query<HandoffEventRow>(
      `SELECT id, event_id, event_type, tenant_id, site_id, tenant_user_id,
              evaluation_chat_session_id, conversation_id, evaluation_ticket_id,
              payload_body, payload_hash, status, delivered_at, last_error_code, created_at
       FROM evaluation_handoff_events
       WHERE event_id = $1
       LIMIT 1`,
      [eventId],
    );
    return res.rows[0];
  }

  private async deliverEvent(access: EvaluationAccessContext, event: HandoffEventRow) {
    if (event.status === 'delivered') {
      return await this.projectStatus(event, await this.latestDelivery(event.event_id));
    }
    const attempts = await this.deliveryCount(event.event_id);
    if (attempts >= 3) {
      return await this.projectStatus(event, await this.latestDelivery(event.event_id));
    }
    const config = this.loadConfig();
    if (!config.enabled || !config.secret || !config.receiverOrigin) {
      await this.markEventFailed(event.event_id, 'mock_config_missing', false);
      await this.audit('evaluation_handoff_failed', access, { result: 'failed', reason: 'mock_config_missing' });
      return await this.projectStatus({ ...event, status: 'failed_permanent', last_error_code: 'mock_config_missing' }, null);
    }

    const body = Buffer.from(event.payload_body, 'utf8');
    const attemptNumber = attempts + 1;
    const deliveryId = createWebhookDeliveryId();
    await this.db.query(
      `INSERT INTO evaluation_handoff_deliveries(
         id, delivery_id, event_id, attempt_number, status, created_at, attempted_at
       ) VALUES ($1,$2,$3,$4,'mock_delivering',now(),now())`,
      [randomUUID(), deliveryId, event.event_id, attemptNumber],
    );
    await this.db.query(
      `UPDATE evaluation_handoff_events SET status = 'delivering' WHERE event_id = $1`,
      [event.event_id],
    );
    await this.audit('evaluation_handoff_delivery_started', access, { result: 'started', attemptNumber });

    const timestamp = new Date().toISOString();
    const headers = buildWebhookHeaders({
      secret: config.secret,
      eventId: event.event_id,
      deliveryId,
      eventType: EVENT_TYPE,
      timestamp,
      body,
    });
    const target = `${config.receiverOrigin}${RECEIVER_PATH}`;
    try {
      const response = await fetch(target, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      const responseText = safeResponseSummary(await response.text());
      const retryable = isRetryableStatus(response.status);
      if (response.ok) {
        await this.markDelivery(deliveryId, 'mock_delivered', response.status, false, null, responseText);
        await this.db.query(
          `UPDATE evaluation_handoff_events
           SET status = 'delivered', delivered_at = now(), last_error_code = null
           WHERE event_id = $1`,
          [event.event_id],
        );
        await this.audit('evaluation_handoff_delivered', access, { result: 'delivered', attemptNumber, httpStatus: response.status });
        return await this.projectStatus({ ...event, status: 'delivered', delivered_at: new Date().toISOString() }, await this.latestDelivery(event.event_id));
      }
      await this.markDelivery(deliveryId, retryable ? 'mock_failed_retryable' : 'mock_failed_permanent', response.status, retryable, `http_${response.status}`, responseText);
      await this.markEventFailed(event.event_id, `http_${response.status}`, retryable);
      await this.audit(retryable ? 'evaluation_handoff_retry_scheduled' : 'evaluation_handoff_failed', access, {
        result: retryable ? 'retryable' : 'failed',
        attemptNumber,
        httpStatus: response.status,
      });
      return await this.projectStatus({ ...event, status: retryable ? 'failed_retryable' : 'failed_permanent', last_error_code: `http_${response.status}` }, await this.latestDelivery(event.event_id));
    } catch {
      await this.markDelivery(deliveryId, 'mock_failed_retryable', null, true, 'network_or_timeout', null);
      await this.markEventFailed(event.event_id, 'network_or_timeout', true);
      await this.audit('evaluation_handoff_retry_scheduled', access, { result: 'retryable', attemptNumber, errorCode: 'network_or_timeout' });
      return await this.projectStatus({ ...event, status: 'failed_retryable', last_error_code: 'network_or_timeout' }, await this.latestDelivery(event.event_id));
    }
  }

  private buildPayload(ticket: TicketRow, eventId: string) {
    const fields = redactEvaluationSensitiveValue({
      supportProfile: 'product' as const,
      product: cleanString(ticket.product, 200),
      module: cleanString(ticket.module, 200),
      customerOrganization: cleanString(ticket.customer_organization, 200),
      customerReference: cleanString(ticket.customer_reference, 200),
      processOrFormName: cleanString(ticket.process_or_form_name, 200),
      description: cleanString(ticket.description, 2000),
      impact: normalizeImpact(ticket.impact),
      browser: cleanString(ticket.device, 120),
      device: cleanString(ticket.device, 120),
      operatingSystem: cleanString(ticket.operating_system, 120),
      errorMessage: cleanString(ticket.error_message, 500),
      alreadyTried: cleanString(ticket.already_tried, 500),
    });
    return {
      schemaVersion: 1,
      eventType: EVENT_TYPE,
      eventId,
      occurredAt: new Date(ticket.created_at || Date.now()).toISOString(),
      demo: true,
      synthetic: true,
      ticket: {
        demoReference: ticket.demo_reference,
        supportProfile: 'product',
        product: fields.product,
        module: fields.module,
        customerOrganization: fields.customerOrganization,
        processOrFormName: fields.processOrFormName,
        description: fields.description,
        impact: fields.impact,
        browser: fields.browser,
        device: fields.device,
        operatingSystem: fields.operatingSystem,
        errorMessage: fields.errorMessage,
        alreadyTried: fields.alreadyTried,
      },
      summary: buildPreviewSummary(fields),
    };
  }

  private async deliveryCount(eventId: string) {
    const res = await this.db.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM evaluation_handoff_deliveries WHERE event_id = $1`,
      [eventId],
    );
    return Number(res.rows[0]?.count || 0);
  }

  private async latestDelivery(eventId: string) {
    const res = await this.db.query<DeliveryRow>(
      `SELECT delivery_id, attempt_number, status, http_status, retryable, response_summary, error_code, completed_at
       FROM evaluation_handoff_deliveries
       WHERE event_id = $1
       ORDER BY attempt_number DESC
       LIMIT 1`,
      [eventId],
    );
    return res.rows[0] || null;
  }

  private async receiptDuplicateCount(eventId: string) {
    const res = await this.db.query<{ duplicate_count: number }>(
      `SELECT duplicate_count
       FROM evaluation_mock_handoff_receipts
       WHERE event_id = $1
       LIMIT 1`,
      [eventId],
    );
    return Number(res.rows[0]?.duplicate_count || 0);
  }

  private async markDelivery(deliveryId: string, status: string, httpStatus: number | null, retryable: boolean, errorCode: string | null, responseSummary: string | null) {
    await this.db.query(
      `UPDATE evaluation_handoff_deliveries
       SET status = $2,
           completed_at = now(),
           http_status = $3,
           retryable = $4,
           error_code = $5,
           response_summary = $6
       WHERE delivery_id = $1`,
      [deliveryId, status, httpStatus, retryable, errorCode, responseSummary],
    );
  }

  private async markEventFailed(eventId: string, errorCode: string, retryable: boolean) {
    await this.db.query(
      `UPDATE evaluation_handoff_events
       SET status = $2,
           last_error_code = $3
       WHERE event_id = $1`,
      [eventId, retryable ? 'failed_retryable' : 'failed_permanent', errorCode],
    );
  }

  private async projectStatus(event: HandoffEventRow | null, delivery: DeliveryRow | null) {
    if (!event) {
      return {
        status: 'not_requested',
        message: 'Noch keine Demo-Übergabe ausgeführt.',
        signatureVerified: false,
        duplicateRecognized: false,
      };
    }
    const payload = parseJson(event.payload_body);
    const ticket = (payload.ticket && typeof payload.ticket === 'object') ? payload.ticket as Record<string, unknown> : {};
    const duplicateCount = await this.receiptDuplicateCount(event.event_id);
    return {
      status: mapStatus(event.status),
      demoReference: cleanString(ticket.demoReference, 80),
      attemptCount: delivery ? Number(delivery.attempt_number || 0) : 0,
      signatureVerified: event.status === 'delivered',
      duplicateRecognized: duplicateCount > 0,
      receivedAt: event.delivered_at ? new Date(event.delivered_at).toISOString() : null,
      httpStatus: delivery?.http_status ?? null,
      retryable: Boolean(delivery?.retryable),
      errorCode: event.last_error_code || delivery?.error_code || null,
      message: event.status === 'delivered'
        ? 'Die signierte Demo-Übergabe wurde vom internen Mock-Empfänger bestätigt.'
        : event.status === 'failed_retryable'
          ? 'Die signierte Demo-Übergabe konnte noch nicht bestätigt werden und kann erneut versucht werden.'
          : event.status === 'failed_permanent'
            ? 'Die signierte Demo-Übergabe ist aktuell nicht möglich.'
            : 'Signierte Demo-Übergabe wird geprüft.',
      externalNotice: 'Es erfolgte keine Übermittlung an NOLIS oder ein externes Ticketsystem.',
    };
  }

  private loadConfig() {
    const enabled = process.env.EVALUATION_MOCK_HANDOFF_ENABLED === 'true';
    const secret = decodeWebhookSecretB64(process.env.EVALUATION_MOCK_HANDOFF_SECRET_B64);
    return {
      enabled,
      secret,
      receiverOrigin: normalizeOrigin(process.env.EVALUATION_MOCK_RECEIVER_ORIGIN),
      toleranceSeconds: normalizeSignatureToleranceSeconds(process.env.EVALUATION_MOCK_SIGNATURE_TOLERANCE_SECONDS),
      timeoutMs: timeoutMs(process.env.EVALUATION_MOCK_HANDOFF_TIMEOUT_MS),
    };
  }

  private async audit(action: string, access: EvaluationAccessContext, metadata: Record<string, unknown>) {
    await this.auditLogs.record({
      tenantId: access.tenantId,
      siteId: access.siteId,
      actorId: access.tenantUserId,
      actorRole: 'viewer',
      action,
      resourceType: 'evaluation_handoff',
      metadata,
    });
  }

  private async auditSystem(action: string, metadata: Record<string, unknown>) {
    await this.auditLogs.record({
      actorId: 'system',
      actorRole: 'system',
      action,
      resourceType: 'evaluation_mock_receiver',
      metadata,
    });
  }
}

function headerValue(headers: Record<string, string | string[] | undefined>, key: string) {
  const value = headers[key] || headers[key.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value : '';
}
