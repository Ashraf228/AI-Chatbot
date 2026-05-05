import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { Response } from 'express';
import { randomUUID } from 'crypto';

import { SendMessageDto } from '../dto/send-message.dto';
import {
  ConversationMessageEntity,
  ConversationMessageRole,
} from '../entities/conversation-message.entity';
import { ChatService } from '../../../chat/chat.service';
import { PrismaService } from '../../../db/prisma.service';
import { WidgetConfigService } from './widget-config.service';
import { EmbeddingService } from '../../../vector/embedding.service';
import { VectorSearchRow, VectorService } from '../../../vector/vector.service';
import { LlmService } from '../../../vector/llm.service';
import { buildSystemPrompt } from '../../../chat/prompt';
import { buildConversationGuide } from '../../../chat/conversation-guide';
import { parseConversationFlow } from '../../../chat/flow-builder';
import { buildResponseParts } from '../../../chat/response-parts';
import { ChatRoutingService } from '../../../chat-routing/chat-routing.service';
import { redactPII } from '../../../utils/pii';
import { sanitizeInput, sanitizeOutput } from '../../../utils/security';
import { WidgetSecurityService } from './widget-security.service';
import { EcommerceProductAdvisorService } from '../../ecommerce-product-advisor/ecommerce-product-advisor.service';

type MessageRow = {
  id: string;
  session_id: string;
  role: ConversationMessageRole;
  content: string;
  created_at: string;
};

type PromptHistoryRow = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

@Injectable()
export class WidgetChatService {
  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  constructor(
    private readonly chatService: ChatService,
    private readonly widgetConfigService: WidgetConfigService,
    private readonly db: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorService: VectorService,
    private readonly llmService: LlmService,
    private readonly chatRoutingService: ChatRoutingService,
    private readonly widgetSecurityService: WidgetSecurityService,
    private readonly ecommerceProductAdvisor: EcommerceProductAdvisorService,
  ) {}

  async sendMessage(dto: SendMessageDto, origin?: string, req?: Request) {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    await this.widgetSecurityService.enforceOrigin(dto.siteKey, origin);
    await this.widgetSecurityService.assertSessionBelongsToSite(site.id, dto.sessionId);
    const reply = await this.chatService.reply(
      {
        siteId: site.id,
        publicKey: site.publicKey || '',
        sessionId: dto.sessionId,
        message: dto.message,
      },
      origin,
      req,
    );

    const rows = await this.db.query<MessageRow>(
      `SELECT m.id, c.session_id, m.role, m.content, m.created_at
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE c.site_id = $1 AND c.session_id = $2
       ORDER BY m.created_at DESC
       LIMIT 2`,
      [site.id, reply.sessionId],
    );

    const messages: ConversationMessageEntity[] = rows.rows
      .slice()
      .reverse()
      .map((row) => ({
        id: row.id,
        sessionId: row.session_id,
        role: row.role,
        content: row.content,
        tokens: 0,
        createdAt: new Date(row.created_at).toISOString(),
      }));

    return {
      sessionId: reply.sessionId,
      answer: reply.answer,
      parts: reply.parts || [],
      sources: reply.sources || [],
      messages,
    };
  }

  async streamMessage(dto: SendMessageDto, origin: string | undefined, req: Request | undefined, res: Response) {
    const site = await this.widgetConfigService.getSiteByKey(dto.siteKey);
    await this.widgetSecurityService.enforceOrigin(dto.siteKey, origin);
    await this.widgetSecurityService.assertSessionBelongsToSite(site.id, dto.sessionId);
    await this.widgetSecurityService.enforceRateLimit(
      `${dto.siteKey}:stream:${this.widgetSecurityService.getClientIp(req)}`,
      20,
      60_000,
    );
    const message = sanitizeInput(dto.message);
    const sessionId = dto.sessionId.trim();
    const tenantId = site.tenantId || '';

    if (!tenantId) {
      throw new Error('Site misconfigured (tenant missing)');
    }

    const conversation = await this.ensureConversation(site.id, tenantId, sessionId);
    await this.db.query(
      `UPDATE widget_sessions
       SET last_seen_at = now(),
           source_url = COALESCE($3, source_url)
       WHERE id = $1 AND site_id = $2`,
      [sessionId, site.id, req?.headers.referer || null],
    );
    const userContent = redactPII(message);

    await this.db.query(
      `INSERT INTO messages(id, conversation_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), conversation.id, 'user', userContent],
    );

    const historyRes = await this.db.query<PromptHistoryRow>(
      `SELECT role, content
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 6`,
      [conversation.id],
    );
    const history = historyRes.rows.slice().reverse();
    const routeDecision = await this.chatRoutingService.resolveForSite({
      siteId: site.id,
      message,
      history,
    });
    const conversationGuide = buildConversationGuide(history, parseConversationFlow(site.conversationFlow));
    const routingGuide = `
Routing-Pfad: ${routeDecision.route}
Routing-Grund: ${routeDecision.reason}
${routeDecision.guide}
    `.trim();

    const qEmbedding = await this.embeddingService.embed(message);
    const hits = await this.vectorService.search(tenantId, site.id, qEmbedding, 6);
    const context = hits
      .map(
        (h: VectorSearchRow, idx: number) =>
          `# Kontext ${idx + 1} (score ${Number(h.score).toFixed(3)})\n${h.content}`,
      )
      .join('\n\n');
    const advisorContext =
      routeDecision.route === 'advisor'
        ? await this.ecommerceProductAdvisor.buildRecommendationContextForSite({
            siteId: site.id,
            query: message,
            limit: 3,
            history,
          })
        : {
            products: [],
            collections: [],
            clarificationQuestion: undefined,
            effectiveQuery: message,
            state: 'ready_to_recommend',
            stateGuide: '',
          };
    const catalogContext =
      advisorContext.products.length > 0 || advisorContext.collections.length > 0
        ? [
            ...advisorContext.products.map(
              (product, idx) =>
                `# Produkt ${idx + 1}\nTitel: ${product.title}\nURL: ${product.url}\nAnbieter: ${product.vendor || '-'}\nTyp: ${product.productType || '-'}`,
            ),
            ...advisorContext.collections.map(
              (collection, idx) =>
                `# Kategorie ${idx + 1}\nTitel: ${collection.title}\nURL: ${collection.url}`,
            ),
          ].join('\n\n')
        : '';
    const shouldClarifyAdvisor =
      routeDecision.route === 'advisor' && Boolean(advisorContext.clarificationQuestion);

    const userPrompt = `
Verlauf:
${history
  .map((entry) => `${entry.role === 'user' ? 'Nutzer' : 'Assistent'}: ${entry.content}`)
  .join('\n') || '(kein Verlauf vorhanden)'}

Nutzerfrage:
${message}

Kontext:
${context || '(kein Kontext gefunden)'}
${catalogContext ? `\n\nProduktkatalog:\n${catalogContext}` : ''}
${advisorContext.stateGuide ? `\n\nAdvisor-Zustand:\n${advisorContext.stateGuide}` : ''}
`.trim();

    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const writeEvent = (payload: Record<string, unknown>) => {
      res.write(`${JSON.stringify(payload)}\n`);
    };

    writeEvent({ type: 'start', sessionId });

    let fullAnswer = '';

    try {
      let safeAnswer = '';
      if (shouldClarifyAdvisor) {
        safeAnswer = sanitizeOutput(advisorContext.clarificationQuestion || '');
      } else {
        await this.llmService.streamAnswer(
          buildSystemPrompt(site.systemPrompt, [routingGuide, conversationGuide].join('\n\n')),
          userPrompt,
          async (chunk) => {
            const safeChunk = sanitizeOutput(chunk);
            fullAnswer += safeChunk;
            writeEvent({ type: 'chunk', delta: safeChunk });
          },
        );

        safeAnswer = sanitizeOutput(fullAnswer);
      }

      const sources = hits.map((h: VectorSearchRow) => ({
        title: h.title || undefined,
        url: h.source_url || undefined,
        score: Number(h.score),
        metadata: h.metadata,
      }));
      const parts = buildResponseParts({
        answer: safeAnswer,
        route: routeDecision.route,
        sources,
        products: advisorContext.products,
        collections: advisorContext.collections,
        cta: shouldClarifyAdvisor ? undefined : routeDecision.cta,
      });

      await this.db.query(
        `INSERT INTO messages(id, conversation_id, role, content)
         VALUES ($1, $2, $3, $4)`,
        [randomUUID(), conversation.id, 'assistant', safeAnswer],
      );

      await this.db.query(
        `UPDATE conversations
         SET last_active_at = now()
         WHERE id = $1`,
        [conversation.id],
      );

      await this.db.query(
        `UPDATE widget_sessions
         SET last_seen_at = now()
         WHERE id = $1 AND site_id = $2`,
        [sessionId, site.id],
      );

      writeEvent({
        type: 'done',
        answer: safeAnswer,
        sessionId,
        parts,
        sources,
      });
    } catch (error: unknown) {
      writeEvent({
        type: 'error',
        message: this.getErrorMessage(error, 'Streaming failed'),
      });
    } finally {
      res.end();
    }
  }

  private async ensureConversation(siteId: string, tenantId: string, sessionId: string) {
    const convRes = await this.db.query<{ id: string }>(
      `SELECT id
       FROM conversations
       WHERE tenant_id = $1 AND site_id = $2 AND session_id = $3
       LIMIT 1`,
      [tenantId, siteId, sessionId],
    );

    let conversationId = convRes.rows[0]?.id;

    if (!conversationId) {
      conversationId = randomUUID();
      await this.db.query(
        `INSERT INTO conversations(id, tenant_id, site_id, session_id)
         VALUES ($1, $2, $3, $4)`,
        [conversationId, tenantId, siteId, sessionId],
      );
    }

    return { id: conversationId };
  }
}
