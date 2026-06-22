import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ChatPipelineService } from '../ai/chat-pipeline/chat-pipeline.service';
import { ChatPipelineSourceReference } from '../ai/chat-pipeline/chat-pipeline.types';
import { AuditLogService } from '../audit-logs/audit-log.service';
import { PrismaService } from '../db/prisma.service';
import { RateLimitService } from '../utils/rate-limit.service';
import { EvaluationAccessContext } from './evaluation-access.service';

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

@Injectable()
export class EvaluationService {
  constructor(
    private readonly db: PrismaService,
    private readonly chatPipeline: ChatPipelineService,
    private readonly auditLogs: AuditLogService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async context(access: EvaluationAccessContext) {
    await this.audit('evaluation_workspace_opened', access, { result: 'ok' });
    return {
      workspaceTitle: `${access.siteDisplayName} Evaluation`,
      siteDisplayName: access.siteDisplayName,
      readOnly: true,
      demo: true,
      disclaimer:
        'Kooperationsdemonstrator mit synthetischen Inhalten. Keine Verbindung zu Produktivsystemen oder externen Fachverfahren.',
      accountExpiresAt: access.accountExpiresAt,
      sessionExpiresAt: access.sessionExpiresAt,
      capabilities: [
        'Quellenbasierte Antworten testen',
        'Strukturierte Uebergabe als Vorschau ansehen',
        'Sichere Nicht-Antwort bei fehlendem Wissen pruefen',
      ],
      scenarios: [
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
      ],
      technicalFeatures: [
        'Mandanten- und Site-Trennung',
        'Zeitlich begrenzter Evaluationszugang',
        'Dedizierte Evaluation-Endpunkte',
        'Keine Verwaltungsentscheidung durch die KI',
      ],
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
    const message = typeof body.message === 'string' ? body.message.trim() : '';
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
    const result = await this.chatPipeline.process({
      tenantId: access.tenantId,
      siteId: access.siteId,
      sessionId: session.conversation_session_id,
      message,
      source: 'dashboard',
      sourceUrl: 'https://evaluation.local/demo',
    });

    await this.db.query(
      `UPDATE evaluation_chat_sessions
       SET conversation_id = $2,
           updated_at = now()
       WHERE id = $1`,
      [conversationId, result.conversationId],
    );
    await this.audit('evaluation_message_submitted', access, { result: 'ok', conversationId });

    return {
      conversationId,
      messageId: result.conversationId,
      answer: result.answer,
      answerStatus: resolveAnswerStatus(result.answer, result.sources || []),
      sources: projectSources(result.sources || []),
      handoffPreview: this.projectHandoff(result),
      completedAt: new Date().toISOString(),
    };
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
