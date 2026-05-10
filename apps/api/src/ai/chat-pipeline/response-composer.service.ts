import { Injectable } from '@nestjs/common';

import { buildConversationGuide } from '../../chat/conversation-guide';
import { parseConversationFlow } from '../../chat/flow-builder';
import { buildSystemPrompt, getSiteSystemPrompt } from '../../chat/prompt';
import { buildResponseParts } from '../../chat/response-parts';
import { ChatRouteDecision } from '../../chat-routing/chat-route-types';
import { VectorSearchRow } from '../../vector/vector.service';
import {
  ChatPipelineAdvisorContext,
  ChatPipelineHistoryEntry,
  ChatPipelineSourceReference,
} from './chat-pipeline.types';

@Injectable()
export class ResponseComposerService {
  buildRoutingGuide(routeDecision: ChatRouteDecision) {
    return `
Routing-Pfad: ${routeDecision.route}
Routing-Grund: ${routeDecision.reason}
${routeDecision.guide}
    `.trim();
  }

  buildConversationGuide(history: ChatPipelineHistoryEntry[], conversationFlow: unknown) {
    return buildConversationGuide(history, parseConversationFlow(conversationFlow));
  }

  buildSystemPrompt(params: {
    siteConfig?: Record<string, unknown> | null;
    systemPrompt?: string | null;
    guides: string[];
  }) {
    const promptOverride = params.systemPrompt || getSiteSystemPrompt(params.siteConfig);
    return buildSystemPrompt(promptOverride, params.guides.filter(Boolean).join('\n\n'));
  }

  buildUserPrompt(params: {
    history: ChatPipelineHistoryEntry[];
    message: string;
    context: string;
    catalogContext: string;
    advisorStateGuide?: string;
  }) {
    return `
Verlauf:
${params.history
  .map((entry) => `${entry.role === 'user' ? 'Nutzer' : 'Assistent'}: ${entry.content}`)
  .join('\n') || '(kein Verlauf vorhanden)'}

Nutzerfrage:
${params.message}

Kontext:
${params.context || '(kein Kontext gefunden)'}
${params.catalogContext ? `\n\nProduktkatalog:\n${params.catalogContext}` : ''}
${params.advisorStateGuide ? `\n\nAdvisor-Zustand:\n${params.advisorStateGuide}` : ''}
`.trim();
  }

  buildContext(hits: VectorSearchRow[]) {
    return hits
      .map(
        (h, idx) =>
          `# Kontext ${idx + 1} (score ${Number(h.score).toFixed(3)})\n${h.content}`,
      )
      .join('\n\n');
  }

  buildCatalogContext(advisorContext: ChatPipelineAdvisorContext) {
    if (advisorContext.products.length === 0 && advisorContext.collections.length === 0) {
      return '';
    }

    return [
      ...advisorContext.products.map(
        (product, idx) =>
          `# Produkt ${idx + 1}\nTitel: ${product.title}\nURL: ${product.url}\nAnbieter: ${product.vendor || '-'}\nTyp: ${product.productType || '-'}`,
      ),
      ...advisorContext.collections.map(
        (collection, idx) =>
          `# Kategorie ${idx + 1}\nTitel: ${collection.title}\nURL: ${collection.url}`,
      ),
    ].join('\n\n');
  }

  buildSources(hits: VectorSearchRow[]): ChatPipelineSourceReference[] {
    return hits.map((h) => ({
      sourceId: h.source_id || undefined,
      title: h.source_label || h.title || undefined,
      type: h.source_type || undefined,
      url: h.source_url || undefined,
      score: Number(h.score),
      excerpt: h.content ? h.content.slice(0, 280) : undefined,
      metadata: h.metadata,
    }));
  }

  buildParts(input: Parameters<typeof buildResponseParts>[0]) {
    return buildResponseParts(input);
  }
}
