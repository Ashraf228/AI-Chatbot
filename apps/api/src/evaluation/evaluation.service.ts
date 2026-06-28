import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatPipelineService } from '../ai/chat-pipeline/chat-pipeline.service';
import { ChatPipelineSourceReference } from '../ai/chat-pipeline/chat-pipeline.types';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PrismaService } from '../db/prisma.service';
import { RateLimitService } from '../utils/rate-limit.service';
import { EvaluationAccessContext } from './evaluation-access.service';
import {
  buildPreviewSummary,
  createPreviewToken,
  extractProductFields,
  isCancelRequest,
  isSolvedAnswer,
  isTicketRequest,
  isUnresolvedAnswer,
  isUrgentProductCase,
  missingProductFields,
  nextProductQuestion,
  productTicketPreviewContentHash,
  ProductTicketFields,
  ProductTicketPreview,
  publicPreviewFields,
  redactEvaluationSensitiveText,
  redactEvaluationSensitiveValue,
  resolveProductSupportConfig,
  sha256,
} from './evaluation-product-support';

const CHAT_SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_MESSAGE_LENGTH = 2000;
const FORBIDDEN_BODY_KEYS = new Set([
  'tenantId',
  'siteId',
  'role',
  'systemPrompt',
  'model',
  'temperature',
  'tools',
  'knowledgeDocumentIds',
  'webhookUrl',
  'apiKey',
  'file',
  'files',
  'upload',
  'agentId',
  'ticket',
  'ticketFields',
  'forwardingStatus',
  'demo',
  'synthetic',
]);

type EvaluationChatSessionRow = {
  id: string;
  tenant_user_id: string;
  tenant_id: string;
  site_id: string;
  conversation_session_id: string;
  conversation_id: string | null;
  expires_at: string;
};

type EvaluationSiteConfigRow = {
  config: Record<string, unknown> | null;
};

type EvaluationTicketPreviewRow = {
  id: string;
  preview_token_hash: string;
  tenant_user_id: string;
  tenant_id: string;
  site_id: string;
  evaluation_chat_session_id: string;
  conversation_id: string;
  content_hash: string;
  preview: ProductTicketPreview;
  status: string;
  ticket_id: string | null;
  demo_reference: string | null;
  expires_at: string;
  created_at?: string;
};

function assertNoForbiddenKeys(body: Record<string, unknown>) {
  for (const key of Object.keys(body)) {
    if (FORBIDDEN_BODY_KEYS.has(key)) {
      throw new BadRequestException(`${key} is not accepted for evaluation requests`);
    }
  }
}

function sanitizeUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

function projectSources(sources: ChatPipelineSourceReference[]) {
  return sources.slice(0, 5).map((source) => ({
    title: source.title || 'Quelle',
    sourceType: source.type || 'knowledge',
    publicUrl: sanitizeUrl(source.url),
    updatedAt:
      typeof source.metadata?.updatedAt === 'string'
        ? source.metadata.updatedAt
        : undefined,
    demo: true,
  }));
}

function resolveAnswerStatus(answer: string, sources: ChatPipelineSourceReference[]) {
  const normalized = answer.toLowerCase();
  if (normalized.includes('keine passende information') || normalized.includes('keine verifizierten')) {
    return 'knowledge_gap';
  }
  if (normalized.includes('?')) {
    return 'clarification_needed';
  }
  return sources.length > 0 ? 'answered' : 'answered';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asStringArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asBenefitList(value: unknown) {
  if (!Array.isArray(value)) return null;
  const benefits = value
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      title: typeof entry.title === 'string' ? entry.title : '',
      text: typeof entry.text === 'string' ? entry.text : '',
    }))
    .filter((entry) => entry.title && entry.text);
  return benefits.length > 0 && benefits.length <= 6 ? benefits : null;
}

function asExpansionStages(value: unknown) {
  if (!Array.isArray(value)) return null;
  const stages = value
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      title: typeof entry.title === 'string' ? entry.title : '',
      items: asStringArray(entry.items, []),
    }))
    .filter((entry) => entry.title && entry.items.length > 0);
  return stages.length > 0 && stages.length <= 4 ? stages : null;
}

function asScenarioList(value: unknown) {
  if (!Array.isArray(value)) return null;
  const scenarios = value
    .map((entry) => asRecord(entry))
    .map((entry) => ({
      key: typeof entry.key === 'string' ? entry.key : '',
      category: typeof entry.category === 'string' ? entry.category : undefined,
      persona: typeof entry.persona === 'string' ? entry.persona : undefined,
      title: typeof entry.title === 'string' ? entry.title : '',
      prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
      goal: typeof entry.goal === 'string' ? entry.goal : undefined,
      observe: typeof entry.observe === 'string' ? entry.observe : undefined,
      expected: typeof entry.expected === 'string' ? entry.expected : undefined,
      demo: true,
    }))
    .filter((entry) => entry.key && entry.title && entry.prompt);
  return scenarios.length >= 3 && scenarios.length <= 12 ? scenarios : null;
}

@Injectable()
export class EvaluationService {
  constructor(
    private readonly db: PrismaService,
    private readonly chatPipeline: ChatPipelineService,
    private readonly auditLogs: AuditLogService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async context(access: EvaluationAccessContext) {
    const siteConfig = await this.loadSiteConfig(access.siteId);
    const workspace = asRecord(siteConfig.evaluationWorkspace);
    const scenarios = asScenarioList(workspace.scenarios) || [
      {
        key: 'knowledge-help',
        title: 'Quellenbasierte Soforthilfe',
        prompt: 'Welche Unterlagen brauche ich fuer eine typische Anfrage?',
        demo: true,
      },
      {
        key: 'handoff-preview',
        title: 'Strukturierte Uebergabe',
        prompt: 'Ich moechte mein Anliegen an einen Mitarbeiter uebergeben.',
        demo: true,
      },
      {
        key: 'knowledge-gap',
        title: 'Sichere Nicht-Antwort bei fehlendem Wissen',
        prompt: 'Welche verbindliche Entscheidung trifft das Fachverfahren?',
        demo: true,
      },
    ];
    await this.audit('evaluation_workspace_opened', access, { result: 'ok' });
    return {
      workspaceTitle: typeof workspace.workspaceTitle === 'string' ? workspace.workspaceTitle : `${access.siteDisplayName} Evaluation`,
      workspaceSubtitle: asString(
        workspace.workspaceSubtitle,
        'Diese Demo zeigt, wie ein KI-Zusatzmodul kommunale Fragen und Supportfälle quellenbasiert unterstützen könnte.',
      ),
      siteDisplayName: access.siteDisplayName,
      readOnly: true,
      demo: true,
      disclaimer:
        typeof workspace.disclaimer === 'string'
          ? workspace.disclaimer
          : 'Kooperationsdemonstrator mit synthetischen Inhalten. Keine Verbindung zu Produktivsystemen oder externen Fachverfahren.',
      accountExpiresAt: access.accountExpiresAt,
      sessionExpiresAt: access.sessionExpiresAt,
      capabilities: [
        'Quellenbasierte Antworten testen',
        'Strukturierte Uebergabe als Vorschau ansehen',
        'Sichere Nicht-Antwort bei fehlendem Wissen pruefen',
      ],
      scenarios,
      benefits: asBenefitList(workspace.benefits) || [
        {
          title: 'Für Kommunen',
          text: 'Bürgerinnen, Bürger und Mitarbeitende erhalten schnellere Orientierung.',
        },
      ],
      demoAreas: asStringArray(workspace.demoAreas, [
        'Bürgerservice',
        'Online-Anträge',
        'Support & Handoff',
      ]),
      proofPoints: asStringArray(workspace.proofPoints, [
        'Quellenbasierte Antwortlogik',
        'Sichere Nicht-Antwort',
        'Keine externe Übermittlung',
      ]),
      expansionStages: asExpansionStages(workspace.expansionStages) || [
        {
          title: 'Standard',
          items: ['Quellenantworten', 'Ticketvorschau', 'Mock-Handoff'],
        },
      ],
      technicalFeatures: asStringArray(workspace.technicalFeatures, [
        'Mandanten- und Site-Trennung',
        'Zeitlich begrenzter Evaluationszugang',
        'Dedizierte Evaluation-Endpunkte',
        'Keine Verwaltungsentscheidung durch die KI',
      ]),
    };
  }

  async createChatSession(access: EvaluationAccessContext, body: Record<string, unknown>) {
    assertNoForbiddenKeys(body);
    const id = randomUUID();
    const expiresAt = new Date(Math.min(Date.now() + CHAT_SESSION_TTL_MS, Date.parse(access.accountExpiresAt || '') || Date.now() + CHAT_SESSION_TTL_MS));
    const conversationSessionId = `evaluation:${id}`;
    await this.db.query(
      `INSERT INTO evaluation_chat_sessions(
         id, tenant_user_id, tenant_id, site_id, conversation_session_id, expires_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,now(),now())`,
      [id, access.tenantUserId, access.tenantId, access.siteId, conversationSessionId, expiresAt.toISOString()],
    );
    await this.audit('evaluation_chat_session_created', access, { result: 'ok' });
    return {
      conversationId: id,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async sendMessage(access: EvaluationAccessContext, body: Record<string, unknown>, clientIp = 'unknown') {
    assertNoForbiddenKeys(body);
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    const message = redactEvaluationSensitiveText(typeof body.message === 'string' ? body.message.trim() : '');
    if (!conversationId) {
      throw new BadRequestException('conversationId required');
    }
    if (!message) {
      throw new BadRequestException('message required');
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException('message too long');
    }

    const rateLimit = await this.rateLimit.allow(`evaluation:${access.tenantUserId}`, 30, 60_000);
    if (!rateLimit.allowed) {
      throw new HttpException('rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
    const ipLimit = await this.rateLimit.allow(`evaluation-ip:${clientIp}`, 60, 60_000);
    if (!ipLimit.allowed) {
      throw new HttpException('rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    const session = await this.loadChatSession(access, conversationId);
    const siteConfig = await this.loadSiteConfig(access.siteId);
    const result = await this.chatPipeline.process({
      tenantId: access.tenantId,
      siteId: access.siteId,
      sessionId: session.conversation_session_id,
      message,
      source: 'dashboard',
      sourceUrl: 'https://evaluation.local/demo',
      siteConfig,
      evaluationMode: true,
    });

    await this.db.query(
      `UPDATE evaluation_chat_sessions
       SET conversation_id = $2,
           updated_at = now()
       WHERE id = $1`,
      [conversationId, result.conversationId],
    );
    await this.audit('evaluation_message_submitted', access, { result: 'ok', conversationId });

    const productSupport = await this.handleProductSupportMessage(access, session, result.conversationId, siteConfig, message);
    const answer = productSupport?.answer || this.answerWithResolutionCheck(result.answer, siteConfig);

    return {
      conversationId,
      messageId: result.conversationId,
      answer,
      answerStatus: productSupport?.answerStatus || resolveAnswerStatus(result.answer, result.sources || []),
      sources: projectSources(result.sources || []),
      handoffPreview: this.projectHandoff(result),
      ticketPreview: productSupport?.ticketPreview || null,
      completedAt: new Date().toISOString(),
    };
  }

  async confirmTicket(access: EvaluationAccessContext, body: Record<string, unknown>) {
    assertNoForbiddenKeys(body);
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    const previewToken = typeof body.previewToken === 'string' ? body.previewToken.trim() : '';
    if (!conversationId) {
      throw new BadRequestException('conversationId required');
    }
    if (!previewToken) {
      throw new BadRequestException('previewToken required');
    }
    await this.audit('evaluation_ticket_confirmation_requested', access, {
      result: 'requested',
      conversationId,
      at: new Date().toISOString(),
    });

    const tokenHash = sha256(previewToken);
    const execute = async (db: Pick<PrismaService, 'query'>) => {
      const res = await db.query<EvaluationTicketPreviewRow>(
        `SELECT id, preview_token_hash, tenant_user_id, tenant_id, site_id, evaluation_chat_session_id,
                conversation_id, content_hash, preview, status, ticket_id, demo_reference, expires_at, created_at
         FROM evaluation_ticket_previews
         WHERE preview_token_hash = $1
         LIMIT 1`,
        [tokenHash],
      );
      const preview = res.rows[0];
      if (
        !preview ||
        preview.tenant_user_id !== access.tenantUserId ||
        preview.tenant_id !== access.tenantId ||
        preview.site_id !== access.siteId ||
        preview.conversation_id !== conversationId ||
        Date.parse(preview.expires_at) <= Date.now()
      ) {
        await this.audit('evaluation_ticket_confirmation_rejected', access, { result: 'rejected', reason: 'invalid_or_expired' });
        throw new ForbiddenException('Ticket preview not available');
      }
      if (preview.status === 'confirmed' && preview.ticket_id && preview.demo_reference) {
        return this.confirmationResult(preview.demo_reference, preview.created_at);
      }
      if (preview.status !== 'pending') {
        await this.audit('evaluation_ticket_confirmation_rejected', access, { result: 'rejected', reason: preview.status });
        throw new BadRequestException('Ticket preview is not confirmable');
      }
      const expectedHash = this.ticketContentHash(preview.preview.fields, preview.evaluation_chat_session_id, preview.conversation_id, access);
      if (expectedHash !== preview.content_hash) {
        await this.audit('evaluation_ticket_confirmation_rejected', access, { result: 'rejected', reason: 'content_changed' });
        throw new BadRequestException('Ticket preview changed');
      }
      const ticketId = randomUUID();
      const demoReference = `DEMO-${preview.id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;
      const now = new Date().toISOString();
      const fields = redactEvaluationSensitiveValue({
        ...preview.preview.fields,
        supportProfile: 'product' as const,
        reporterName: preview.preview.fields.reporterName || access.viewerDisplayName,
        reporterEmail: access.viewerEmail,
      });
      await db.query(
        `INSERT INTO agent_tickets(
           id, tenant_id, site_id, agent_run_id, title, description, reporter_name, reporter_email,
           priority, status, source, metadata, support_profile, product, module, customer_organization,
           customer_reference, process_or_form_name, impact, device, operating_system, error_message,
           already_tried, confirmation_status, forwarding_status, demo, synthetic,
           evaluation_chat_session_id, demo_reference, confirmation_id, created_at
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,'new','evaluation_demo',$10::jsonb,'product',$11,$12,$13,
           $14,$15,$16,$17,$18,$19,$20,'confirmed','not_configured',true,true,$21,$22,$23,$24::timestamptz
         )
         ON CONFLICT (confirmation_id) WHERE confirmation_id IS NOT NULL DO NOTHING`,
        [
          ticketId,
          access.tenantId,
          access.siteId,
          `evaluation:${preview.evaluation_chat_session_id}`,
          `Demo-Supportfall ${demoReference}`,
          fields.description || 'Demo-Supportfall',
          fields.reporterName || access.viewerDisplayName,
          fields.reporterEmail || access.viewerEmail,
          fields.impact === 'critical' || fields.impact === 'high' ? 'high' : 'normal',
          JSON.stringify({
            demo: true,
            synthetic: true,
            forwardingStatus: 'not_configured',
            summary: buildPreviewSummary(fields),
            browser: fields.browser || null,
          }),
          fields.product,
          fields.module,
          fields.customerOrganization,
          fields.customerReference || null,
          fields.processOrFormName || null,
          fields.impact,
          fields.device || null,
          fields.operatingSystem || null,
          fields.errorMessage || null,
          fields.alreadyTried || null,
          preview.evaluation_chat_session_id,
          demoReference,
          preview.id,
          now,
        ],
      );
      const ticketRes = await db.query<{ id: string }>(
        `SELECT id FROM agent_tickets WHERE confirmation_id = $1 LIMIT 1`,
        [preview.id],
      );
      const confirmedTicketId = ticketRes.rows[0]?.id || ticketId;
      await db.query(
        `UPDATE evaluation_ticket_previews
         SET status = 'confirmed',
             ticket_id = $2,
             demo_reference = $3,
             confirmed_at = now(),
             updated_at = now()
         WHERE id = $1`,
        [preview.id, confirmedTicketId, demoReference],
      );
      await this.audit('evaluation_ticket_created', access, {
        result: 'created',
        conversationId,
        demoReference,
        forwardingStatus: 'not_configured',
        at: now,
      });
      return this.confirmationResult(demoReference, now);
    };
    const transaction = (this.db as PrismaService & { transaction?: (callback: (db: Pick<PrismaService, 'query'>) => Promise<unknown>) => Promise<unknown> }).transaction;
    if (typeof transaction === 'function') {
      return transaction.call(this.db, execute);
    }
    return execute(this.db);
  }

  async cancelTicketPreview(access: EvaluationAccessContext, body: Record<string, unknown>) {
    assertNoForbiddenKeys(body);
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : '';
    const previewToken = typeof body.previewToken === 'string' ? body.previewToken.trim() : '';
    if (!conversationId || !previewToken) {
      throw new BadRequestException('conversationId and previewToken required');
    }
    const res = await this.db.query<EvaluationTicketPreviewRow>(
      `UPDATE evaluation_ticket_previews
       SET status = 'cancelled', cancelled_at = now(), updated_at = now()
       WHERE preview_token_hash = $1
         AND tenant_user_id = $2
         AND tenant_id = $3
         AND site_id = $4
         AND conversation_id = $5
         AND status = 'pending'
       RETURNING id`,
      [sha256(previewToken), access.tenantUserId, access.tenantId, access.siteId, conversationId],
    );
    await this.audit('evaluation_ticket_cancelled', access, { result: res.rows[0] ? 'cancelled' : 'not_found', conversationId });
    return { status: res.rows[0] ? 'cancelled' : 'not_found' };
  }

  private async loadChatSession(access: EvaluationAccessContext, id: string) {
    const res = await this.db.query<EvaluationChatSessionRow>(
      `SELECT id, tenant_user_id, tenant_id, site_id, conversation_session_id, conversation_id, expires_at
       FROM evaluation_chat_sessions
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const row = res.rows[0];
    if (
      !row ||
      row.tenant_user_id !== access.tenantUserId ||
      row.tenant_id !== access.tenantId ||
      row.site_id !== access.siteId ||
      Date.parse(row.expires_at) <= Date.now()
    ) {
      throw new ForbiddenException('Evaluation chat not available');
    }
    return row;
  }

  private async loadSiteConfig(siteId: string) {
    const res = await this.db.query<EvaluationSiteConfigRow>(
      `SELECT config FROM sites WHERE id = $1 LIMIT 1`,
      [siteId],
    );
    return asRecord(res.rows[0]?.config);
  }

  private projectHandoff(result: { toolResults?: Array<{ toolName?: string; status?: string; message?: string }> }) {
    const handoff = (result.toolResults || []).find((entry) =>
      entry.toolName === 'create_ticket' || entry.toolName === 'capture_lead' || entry.toolName === 'schedule_contact',
    );
    if (!handoff) return null;
    return {
      status: 'Vorschau',
      summary: 'Der Dialog enthaelt strukturierte Uebergabedaten. Es wurde keine externe Uebermittlung ausgefuehrt.',
      demo: true,
    };
  }

  private answerWithResolutionCheck(answer: string, siteConfig: Record<string, unknown>) {
    const config = resolveProductSupportConfig(siteConfig);
    if (config.supportProfile !== 'product') {
      return redactEvaluationSensitiveText(answer);
    }
    const safeAnswer = redactEvaluationSensitiveText(answer);
    if (/konnte das problem damit gel[oö]st werden\?/i.test(safeAnswer)) {
      return safeAnswer;
    }
    return `${safeAnswer}\n\nKonnte das Problem damit gelöst werden?`;
  }

  private async handleProductSupportMessage(
    access: EvaluationAccessContext,
    session: EvaluationChatSessionRow,
    realConversationId: string,
    siteConfig: Record<string, unknown>,
    message: string,
  ): Promise<{ answer: string; answerStatus: string; ticketPreview?: ProductTicketPreview } | null> {
    const config = resolveProductSupportConfig(siteConfig);
    if (config.supportProfile !== 'product') {
      return null;
    }
    const state = await this.loadLatestTicketPreview(access, session.id);
    if (state?.status === 'pending' && !isTicketRequest(message) && !isCancelRequest(message)) {
      return null;
    }
    if (isCancelRequest(message)) {
      if (state) {
        await this.db.query(
          `UPDATE evaluation_ticket_previews
           SET status = 'cancelled', cancelled_at = now(), updated_at = now()
           WHERE id = $1 AND status IN ('collecting', 'pending')`,
          [state.id],
        );
      }
      await this.audit('evaluation_ticket_cancelled', access, { result: 'cancelled', conversationId: session.id });
      return {
        answer: 'Verstanden. Ich breche die Aufnahme des Demo-Supportfalls ab.',
        answerStatus: 'cancelled',
      };
    }
    if (state?.status === 'collecting' && isSolvedAnswer(message)) {
      await this.db.query(
        `UPDATE evaluation_ticket_previews
         SET status = 'cancelled', cancelled_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'collecting'`,
        [state.id],
      );
      return {
        answer: 'Gut. Dann wird kein Demo-Supportfall erstellt.',
        answerStatus: 'answered',
      };
    }

    const shouldCollect = Boolean(state) || isUnresolvedAnswer(message) || isTicketRequest(message) || isUrgentProductCase(message, config);
    if (!shouldCollect) {
      return null;
    }

    const previousFields = state?.preview?.fields || { supportProfile: 'product' as const };
    const fields = extractProductFields(message, previousFields, config, {
      name: access.viewerDisplayName,
      email: access.viewerEmail,
    });
    const missingFields = missingProductFields(fields, config);
    const urgent = isUrgentProductCase(message, config) || fields.impact === 'critical';
    if (urgent && !state && missingFields.length > 0) {
      const preview = await this.saveTicketPreview(access, session, realConversationId, fields, missingFields, 'collecting');
      return {
        answer:
          'Das klingt nach einem dringenden oder sicherheitsrelevanten Fall. Bitte geben Sie keine Passwörter, MFA-Codes, API-Schlüssel oder echten personenbezogenen Falldaten ein. Ich kann einen internen Demo-Supportfall vorbereiten.\n\n' +
          nextProductQuestion(missingFields),
        answerStatus: 'urgent_escalation',
        ticketPreview: preview,
      };
    }
    if (missingFields.length > 0) {
      const preview = await this.saveTicketPreview(access, session, realConversationId, fields, missingFields, 'collecting');
      return {
        answer: nextProductQuestion(missingFields),
        answerStatus: 'collecting_ticket_fields',
        ticketPreview: preview,
      };
    }
    const preview = await this.saveTicketPreview(access, session, realConversationId, fields, [], 'pending');
    return {
      answer:
        'Ich habe eine Vorschau fuer den Demo-Supportfall vorbereitet. Bitte pruefen Sie die Angaben und bestaetigen Sie die Erstellung.',
      answerStatus: 'ticket_preview',
      ticketPreview: preview,
    };
  }

  private async loadLatestTicketPreview(access: EvaluationAccessContext, evaluationChatSessionId: string) {
    const res = await this.db.query<EvaluationTicketPreviewRow>(
      `SELECT id, preview_token_hash, tenant_user_id, tenant_id, site_id, evaluation_chat_session_id,
              conversation_id, content_hash, preview, status, ticket_id, demo_reference, expires_at, created_at
       FROM evaluation_ticket_previews
       WHERE tenant_user_id = $1
         AND tenant_id = $2
         AND site_id = $3
         AND evaluation_chat_session_id = $4
         AND status IN ('collecting', 'pending')
       ORDER BY created_at DESC
       LIMIT 1`,
      [access.tenantUserId, access.tenantId, access.siteId, evaluationChatSessionId],
    );
    return res.rows[0] || null;
  }

  private async saveTicketPreview(
    access: EvaluationAccessContext,
    session: EvaluationChatSessionRow,
    _realConversationId: string,
    fields: ProductTicketFields,
    missingFields: string[],
    status: 'collecting' | 'pending',
  ): Promise<ProductTicketPreview> {
    const token = createPreviewToken();
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const publicFields = publicPreviewFields(redactEvaluationSensitiveValue(fields));
    const preview: ProductTicketPreview = {
      status: status === 'pending' ? 'ready' : 'collecting',
      supportProfile: 'product',
      fields: publicFields,
      missingFields,
      previewToken: status === 'pending' ? token : undefined,
      expiresAt,
      demo: true,
      synthetic: true,
    };
    if (status === 'pending') {
      await this.db.query(
        `UPDATE evaluation_ticket_previews
         SET status = 'superseded', updated_at = now()
         WHERE tenant_user_id = $1
           AND tenant_id = $2
           AND site_id = $3
           AND evaluation_chat_session_id = $4
           AND status = 'pending'`,
        [access.tenantUserId, access.tenantId, access.siteId, session.id],
      );
    }
    await this.db.query(
      `INSERT INTO evaluation_ticket_previews(
         id, preview_token_hash, tenant_user_id, tenant_id, site_id, evaluation_chat_session_id,
         conversation_id, content_hash, preview, status, expires_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::timestamptz,now(),now())`,
      [
        id,
        sha256(token),
        access.tenantUserId,
        access.tenantId,
        access.siteId,
        session.id,
        session.id,
        this.ticketContentHash(publicFields, session.id, session.id, access),
        JSON.stringify(preview),
        status,
        expiresAt,
      ],
    );
    await this.audit('evaluation_ticket_preview_created', access, {
      result: status,
      conversationId: session.id,
      missingFields,
      at: new Date().toISOString(),
    });
    return {
      ...preview,
      fields: preview.fields,
    };
  }

  private ticketContentHash(
    fields: ProductTicketPreview['fields'],
    evaluationChatSessionId: string,
    conversationId: string,
    access: EvaluationAccessContext,
  ) {
    return productTicketPreviewContentHash(fields, {
      tenantUserId: access.tenantUserId,
      tenantId: access.tenantId,
      siteId: access.siteId,
      evaluationChatSessionId,
      conversationId,
    });
  }

  private confirmationResult(demoReference: string, createdAt?: string | null) {
    return {
      status: 'created',
      demoReference,
      createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      forwardingStatus: 'not_configured',
      note: 'Der Demo-Supportfall wurde im Demonstrator erfasst. Es erfolgte keine Übermittlung an ein externes Ticketsystem.',
    };
  }

  private async audit(action: string, access: EvaluationAccessContext, metadata: Record<string, unknown>) {
    await this.auditLogs.record({
      tenantId: access.tenantId,
      siteId: access.siteId,
      actorId: access.tenantUserId,
      actorRole: 'viewer',
      action,
      resourceType: 'evaluation_workspace',
      metadata,
    });
  }
}
