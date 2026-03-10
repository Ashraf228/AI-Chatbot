import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';

import { ChatMessageDto } from './dto';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { LlmService } from '../vector/llm.service';
import { SitesService } from '../sites/sites.service';
import { isDomainAllowed } from '../utils/cors';
import { buildSystemPrompt } from './prompt';
import { RateLimitService } from '../utils/rate-limit.service';
import { PrismaService } from '../db/prisma.service';
import { redactPII } from '../utils/pii';

@Injectable()
export class ChatService {
  constructor(
    private embedder: EmbeddingService,
    private vector: VectorService,
    private llm: LlmService,
    private sites: SitesService,
    private rateLimit: RateLimitService,
    private db: PrismaService, // ✅ neu: für conversations/messages
  ) {}

  async reply(dto: ChatMessageDto, origin?: string, req?: Request) {
    // 1) Site lookup
    const site = await this.sites.getSite(dto.siteId);
    if (!site) throw new HttpException('Invalid siteId', HttpStatus.NOT_FOUND);

    const tenantId = site.tenant_id;
    if (!tenantId) throw new HttpException('Site misconfigured (tenant missing)', HttpStatus.INTERNAL_SERVER_ERROR);

    // 2) publicKey check
    if (!site.public_key || dto.publicKey !== site.public_key) {
      throw new HttpException('Invalid publicKey', HttpStatus.FORBIDDEN);
    }

    // 3) Origin allowlist
    const mode = process.env.SITE_DOMAIN_ALLOWLIST_MODE || 'strict';
    if (mode === 'strict') {
      const allowed = site.allowed_domains || [];
      if (!isDomainAllowed(origin, allowed)) {
        throw new HttpException('Origin not allowed', HttpStatus.FORBIDDEN);
      }
    }

    // 4) Rate limiting
    const ipRaw =
      (req?.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      'unknown';
    const ip = String(ipRaw).replace('::ffff:', '');

    const ipLimit = await this.rateLimit.allow(`ip:${ip}`, 30, 60_000);
    const siteLimit = await this.rateLimit.allow(`site:${dto.siteId}`, 300, 60_000);

    if (!ipLimit.allowed || !siteLimit.allowed) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 5) Conversation find/create
    const sessionId = dto.sessionId?.trim() || randomUUID();

    const convRes = await this.db.query<{ id: string }>(
      `SELECT id FROM conversations
       WHERE tenant_id=$1 AND site_id=$2 AND session_id=$3
       LIMIT 1`,
      [tenantId, dto.siteId, sessionId],
    );

    let conversationId = convRes.rows[0]?.id;
    if (!conversationId) {
      conversationId = randomUUID();
      await this.db.query(
        `INSERT INTO conversations(id, tenant_id, site_id, session_id)
         VALUES ($1,$2,$3,$4)`,
        [conversationId, tenantId, dto.siteId, sessionId],
      );
    }

    // 6) Store user message (redacted)
    const userMsg = redactPII(dto.message);
    await this.db.query(
      `INSERT INTO messages(id, conversation_id, role, content)
       VALUES ($1,$2,$3,$4)`,
      [randomUUID(), conversationId, 'user', userMsg],
    );

    // 7) Retrieval
    const qEmbedding = await this.embedder.embed(dto.message);
    const hits = await this.vector.search(tenantId, dto.siteId, qEmbedding, 6);

    const context = hits
      .map((h: any, idx: number) => {
        const src = h.source_url ? `URL: ${h.source_url}` : `Titel: ${h.title || 'Unbekannt'}`;
        return `# Kontext ${idx + 1} (score ${Number(h.score).toFixed(3)})\n${src}\n${h.content}`;
      })
      .join('\n\n');

    const userPrompt = `
Nutzerfrage:
${dto.message}

Kontext:
${context || '(kein Kontext gefunden)'}
`.trim();

    // 8) Answer
    const answer = await this.llm.answer(buildSystemPrompt(), userPrompt);

    // 9) Store assistant message (optional redaction not necessary)
    await this.db.query(
      `INSERT INTO messages(id, conversation_id, role, content)
       VALUES ($1,$2,$3,$4)`,
      [randomUUID(), conversationId, 'assistant', answer],
    );

    // 10) Update activity
    await this.db.query(
      `UPDATE conversations SET last_active_at=now() WHERE id=$1`,
      [conversationId],
    );

    const sources = hits.map((h: any) => ({
      title: h.title,
      url: h.source_url,
      score: Number(h.score),
      metadata: h.metadata,
    }));

    return { answer, sources, sessionId }; // ✅ sessionId zurückgeben
  }
}