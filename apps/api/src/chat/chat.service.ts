import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';

import { ChatMessageDto } from './dto';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorSearchRow, VectorService } from '../vector/vector.service';
import { LlmService } from '../vector/llm.service';
import { SitesService } from '../sites/sites.service';
import { isDomainAllowed } from '../utils/cors';
import { buildSystemPrompt } from './prompt';
import { RateLimitService } from '../utils/rate-limit.service';
import { PrismaService } from '../db/prisma.service';
import { redactPII } from '../utils/pii';
import { sanitizeInput, sanitizeOutput } from '../utils/security';
import { logEvent } from '../utils/logger';
import { estimateOpenAICost } from '../usage/costs';

@Injectable()
export class ChatService {
  private getErrorMessage(error: unknown, fallback: string) {
    return error instanceof Error ? error.message : fallback;
  }

  constructor(
    private embedder: EmbeddingService,
    private vector: VectorService,
    private llm: LlmService,
    private sites: SitesService,
    private rateLimit: RateLimitService,
    private db: PrismaService,
  ) {}

  private async insertUsageEvent(params: {
    tenantId: string;
    siteId: string;
    conversationId: string;
    sessionId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    latencyMs: number;
    success: boolean;
  }) {
    await this.db.query(
      `INSERT INTO usage_events (
        id, tenant_id, site_id, conversation_id, session_id,
        model, input_tokens, output_tokens, total_tokens,
        estimated_cost, latency_ms, success, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, now()
      )`,
      [
        randomUUID(),
        params.tenantId,
        params.siteId,
        params.conversationId,
        params.sessionId,
        params.model,
        params.inputTokens,
        params.outputTokens,
        params.totalTokens,
        params.estimatedCost,
        params.latencyMs,
        params.success,
      ],
    );
  }

  private async upsertDailyUsage(params: {
    tenantId: string;
    siteId: string;
    requestCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
    successCount: number;
    errorCount: number;
    latencyMs: number;
  }) {
    await this.db.query(
      `INSERT INTO usage_daily (
        tenant_id, site_id, day,
        request_count, user_message_count, assistant_message_count,
        input_tokens, output_tokens, total_tokens,
        estimated_cost, success_count, error_count, latency_ms,
        created_at, updated_at
      ) VALUES (
        $1, $2, CURRENT_DATE,
        $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        now(), now()
      )
      ON CONFLICT (tenant_id, site_id, day)
      DO UPDATE SET
        request_count           = usage_daily.request_count           + EXCLUDED.request_count,
        user_message_count      = usage_daily.user_message_count      + EXCLUDED.user_message_count,
        assistant_message_count = usage_daily.assistant_message_count + EXCLUDED.assistant_message_count,
        input_tokens            = usage_daily.input_tokens            + EXCLUDED.input_tokens,
        output_tokens           = usage_daily.output_tokens           + EXCLUDED.output_tokens,
        total_tokens            = usage_daily.total_tokens            + EXCLUDED.total_tokens,
        estimated_cost          = usage_daily.estimated_cost          + EXCLUDED.estimated_cost,
        success_count           = usage_daily.success_count           + EXCLUDED.success_count,
        error_count             = usage_daily.error_count             + EXCLUDED.error_count,
        latency_ms              = usage_daily.latency_ms              + EXCLUDED.latency_ms,
        updated_at              = now()`,
      [
        params.tenantId,
        params.siteId,
        params.requestCount,
        params.userMessageCount,
        params.assistantMessageCount,
        params.inputTokens,
        params.outputTokens,
        params.totalTokens,
        params.estimatedCost,
        params.successCount,
        params.errorCount,
        params.latencyMs,
      ],
    );
  }

  async reply(dto: ChatMessageDto, origin?: string, req?: Request) {
    // 1) Site lookup
    const site = await this.sites.getSite(dto.siteId);
    if (!site) {
      throw new HttpException('Invalid siteId', HttpStatus.NOT_FOUND);
    }

    const tenantId = site.tenant_id;
    if (!tenantId) {
      throw new HttpException(
        'Site misconfigured (tenant missing)',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // 2) publicKey check
    if (!site.public_key || dto.publicKey !== site.public_key) {
      throw new HttpException('Invalid publicKey', HttpStatus.FORBIDDEN);
    }

    // 3) Origin validation
    if (!origin) {
      throw new HttpException('Missing origin', HttpStatus.FORBIDDEN);
    }

    if (!origin.startsWith('http')) {
      throw new HttpException('Invalid origin', HttpStatus.FORBIDDEN);
    }

    // 4) Origin allowlist
    const mode = process.env.SITE_DOMAIN_ALLOWLIST_MODE || 'strict';
    if (mode === 'strict') {
      const allowed = site.allowed_domains || [];
      if (!isDomainAllowed(origin, allowed)) {
        throw new HttpException('Origin not allowed', HttpStatus.FORBIDDEN);
      }
    }

    // 5) Logging erst nach erfolgreicher Grundvalidierung
    logEvent('chat_request', {
      siteId: dto.siteId,
      tenantId,
      origin,
      hasSessionId: !!dto.sessionId,
      messageLength: dto.message?.length,
    });

    // 6) Rate limiting
    const ipRaw =
      (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      'unknown';
    const ip = String(ipRaw).replace('::ffff:', '');

    const ipLimit = await this.rateLimit.allow(`ip:${ip}`, 30, 60_000);
    const siteLimit = await this.rateLimit.allow(`site:${dto.siteId}`, 300, 60_000);
    const tenantLimit = await this.rateLimit.allow(`tenant:${tenantId}`, 1000, 60_000);
    const globalLimit = await this.rateLimit.allow(`global`, 5000, 60_000);

    if (!ipLimit.allowed || !siteLimit.allowed || !tenantLimit.allowed || !globalLimit.allowed) {
      logEvent('rate_limit_exceeded', {
        ip,
        siteId: dto.siteId,
        tenantId,
        limits: {
          ip: ipLimit.allowed ? 'ok' : 'exceeded',
          site: siteLimit.allowed ? 'ok' : 'exceeded',
          tenant: tenantLimit.allowed ? 'ok' : 'exceeded',
          global: globalLimit.allowed ? 'ok' : 'exceeded',
        },
      });

      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 7) Daily usage limit
    const dailyLimitRes = await this.db.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id
       WHERE c.tenant_id = $1
         AND m.role = 'user'
         AND m.created_at > now() - interval '1 day'`,
      [tenantId],
    );

    const dailyCount = Number(dailyLimitRes.rows[0].count);
    if (dailyCount >= 5000) {
      logEvent('daily_limit_exceeded', {
        tenantId,
        dailyCount,
        limit: 5000,
      });

      throw new HttpException('Daily usage limit reached', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 8) Input sanitizen
    let safeMessage: string;
    try {
      safeMessage = sanitizeInput(dto.message);
    } catch (err: unknown) {
      throw new HttpException(
        this.getErrorMessage(err, 'Invalid input'),
        HttpStatus.BAD_REQUEST,
      );
    }

    // 9) Conversation find/create
    const sessionId = dto.sessionId?.trim() || randomUUID();

    const convRes = await this.db.query<{ id: string }>(
      `SELECT id
       FROM conversations
       WHERE tenant_id = $1 AND site_id = $2 AND session_id = $3
       LIMIT 1`,
      [tenantId, dto.siteId, sessionId],
    );

    let conversationId = convRes.rows[0]?.id;

    if (!conversationId) {
      conversationId = randomUUID();

      await this.db.query(
        `INSERT INTO conversations(id, tenant_id, site_id, session_id)
         VALUES ($1, $2, $3, $4)`,
        [conversationId, tenantId, dto.siteId, sessionId],
      );

      logEvent('conversation_created', {
        conversationId,
        tenantId,
        siteId: dto.siteId,
        sessionId,
      });
    }

    // 10) User-Message redacted speichern
    const userMsg = redactPII(safeMessage);

    await this.db.query(
      `INSERT INTO messages(id, conversation_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), conversationId, 'user', userMsg],
    );

    // 11) Retrieval
    const retrievalStart = Date.now();

    const qEmbedding = await this.embedder.embed(safeMessage);
    const hits = await this.vector.search(tenantId, dto.siteId, qEmbedding, 6);

    const retrievalTime = Date.now() - retrievalStart;

    logEvent('retrieval_result', {
      conversationId,
      tenantId,
      siteId: dto.siteId,
      hits: hits.length,
      retrievalTime,
    });

    const context = hits
      .map((h: VectorSearchRow, idx: number) => {
        const src = h.source_url
          ? `URL: ${h.source_url}`
          : `Titel: ${h.title || 'Unbekannt'}`;

        return `# Kontext ${idx + 1} (score ${Number(h.score).toFixed(3)})\n${src}\n${h.content}`;
      })
      .join('\n\n');

    const userPrompt = `
Nutzerfrage:
${safeMessage}

Kontext:
${context || '(kein Kontext gefunden)'}
`.trim();

    // 12) LLM Call
    const llmStart = Date.now();
    const llmRes = await this.llm.answer(buildSystemPrompt(), userPrompt);
    const llmTime = Date.now() - llmStart;

    // 13) Kosten schätzen
    const estimatedCost = estimateOpenAICost({
      model: llmRes.model,
      inputTokens: llmRes.usage.inputTokens,
      outputTokens: llmRes.usage.outputTokens,
    });

    // 14) Usage-Event speichern
    await this.insertUsageEvent({
      tenantId,
      siteId: dto.siteId,
      conversationId,
      sessionId,
      model: llmRes.model,
      inputTokens: llmRes.usage.inputTokens,
      outputTokens: llmRes.usage.outputTokens,
      totalTokens: llmRes.usage.totalTokens,
      estimatedCost,
      latencyMs: llmRes.latencyMs,
      success: true,
    });

    // 15) Daily-Aggregat upserten
    await this.upsertDailyUsage({
      tenantId,
      siteId: dto.siteId,
      requestCount: 1,
      userMessageCount: 1,
      assistantMessageCount: 1,
      inputTokens: llmRes.usage.inputTokens,
      outputTokens: llmRes.usage.outputTokens,
      totalTokens: llmRes.usage.totalTokens,
      estimatedCost,
      successCount: 1,
      errorCount: 0,
      latencyMs: llmRes.latencyMs,
    });

    // 16) Output sanitizen
    const safeAnswer = sanitizeOutput(llmRes.text);

    // 17) Assistant-Message speichern
    await this.db.query(
      `INSERT INTO messages(id, conversation_id, role, content)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), conversationId, 'assistant', safeAnswer],
    );

    // 18) last_active_at aktualisieren
    await this.db.query(
      `UPDATE conversations
       SET last_active_at = now()
       WHERE id = $1`,
      [conversationId],
    );

    const sources = hits.map((h: VectorSearchRow) => ({
      title: h.title,
      url: h.source_url,
      score: Number(h.score),
      metadata: h.metadata,
    }));

    // 19) Erfolgs-Logging
    logEvent('chat_success', {
      siteId: dto.siteId,
      tenantId,
      conversationId,
      retrievalTime,
      llmTime,
      totalTime: retrievalTime + llmTime,
      sourcesCount: sources.length,
      answerLength: safeAnswer.length,
    });

    return {
      answer: safeAnswer,
      sources,
      sessionId,
    };
  }
}
