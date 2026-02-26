import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from './dto';
import { EmbeddingService } from '../vector/embedding.service';
import { VectorService } from '../vector/vector.service';
import { LlmService } from '../vector/llm.service';
import { SitesService } from '../sites/sites.service';
import { isDomainAllowed } from '../utils/cors';
import { buildSystemPrompt } from './prompt';
import { rateLimit } from '../utils/rate-limit';

@Injectable()
export class ChatService {
  constructor(
    private embedder: EmbeddingService,
    private vector: VectorService,
    private llm: LlmService,
    private sites: SitesService,
  ) {}

  async reply(dto: ChatMessageDto, req?: any, origin?: string) {
    const site = await this.sites.getSite(dto.siteId);
    if (!site) throw new Error('Invalid siteId');

    // Rate Limiting
    const ip = req?.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req?.socket?.remoteAddress ||
               'unknown';

    const okIp = await rateLimit(`ip:${ip}`, 30, 60);
    const okSite = await rateLimit(`site:${dto.siteId}`, 300, 60);

    if (!okIp || !okSite) {
      throw new Error('Rate limit exceeded');
    }

    const mode = process.env.SITE_DOMAIN_ALLOWLIST_MODE || 'strict';
    if (mode === 'strict') {
      const allowed = site.allowed_domains || [];
      if (!isDomainAllowed(origin, allowed)) {
        throw new Error('Origin not allowed for this siteId');
      }
    }

    const qEmbedding = await this.embedder.embed(dto.message);
    const hits = await this.vector.search(dto.siteId, qEmbedding, 6);

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

    const answer = await this.llm.answer(buildSystemPrompt(), userPrompt);

    const sources = hits.map((h: any) => ({
      title: h.title,
      url: h.source_url,
      score: Number(h.score),
      metadata: h.metadata,
    }));

    return { answer, sources };
  }
}