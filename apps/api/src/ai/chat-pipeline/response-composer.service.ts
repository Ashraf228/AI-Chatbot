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
    const localServiceGuide = buildLocalServiceConversationGuide(history, conversationFlow);
    if (localServiceGuide) {
      return localServiceGuide;
    }

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
      'Verifizierte Produktdaten. Verwende nur diese Produkte, Kategorien, Preise, Varianten und Verfuegbarkeiten. Wenn eine Information hier fehlt, sage das transparent.',
      ...advisorContext.products.map(
        (product, idx) => {
          const price = formatCatalogPrice(product.priceMin, product.priceMax, product.currencyCode);
          const availability = product.availableForSale === false ? 'nicht verfuegbar' : 'verfuegbar oder nicht sicher angegeben';
          const variants = (product.variants || [])
            .slice(0, 5)
            .map((variant) => {
              const variantPrice = formatCatalogPrice(variant.price, undefined, variant.currencyCode);
              const variantAvailability = variant.availableForSale === false ? 'nicht verfuegbar' : 'verfuegbar oder nicht sicher angegeben';
              return `- ${variant.title}${variantPrice ? `, Preis: ${variantPrice}` : ''}, Status: ${variantAvailability}, URL: ${variant.url}`;
            })
            .join('\n');

          return `# Produkt ${idx + 1}
Titel: ${product.title}
URL: ${product.url}
Anbieter: ${product.vendor || '-'}
Typ: ${product.productType || '-'}
Preis: ${price || 'nicht angegeben'}
Status: ${availability}
Varianten: ${product.variantSummary || 'nicht angegeben'}${variants ? `\nBekannte Varianten:\n${variants}` : ''}`;
        },
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

function buildLocalServiceConversationGuide(
  history: ChatPipelineHistoryEntry[],
  conversationFlow: unknown,
) {
  if (!conversationFlow || typeof conversationFlow !== 'object' || Array.isArray(conversationFlow)) {
    return undefined;
  }

  const flow = conversationFlow as Record<string, unknown>;
  const questionTexts = flow.questionTexts && typeof flow.questionTexts === 'object' && !Array.isArray(flow.questionTexts)
    ? flow.questionTexts as Record<string, unknown>
    : {};
  const preferredVocabulary = asStringArray(flow.preferredVocabulary);
  const forbiddenTerms = asStringArray(flow.forbiddenGenericTerms);
  const recentHistory = history
    .slice(-6)
    .map((entry) => `${entry.role === 'user' ? 'Nutzer' : 'Assistent'}: ${compactText(entry.content || '')}`)
    .join('\n');

  if (!Array.isArray(flow.requiredFields) || !Array.isArray(flow.questionOrder)) {
    return undefined;
  }

  return `
Gesprächsphase: local_service_intake
Gesprächsregel: Behandle diese Unterhaltung als lokalen Dienstleister-Erstkontakt. Nutze konkrete Dienstleister-Sprache und keine generische B2B-Beratung.
Ansprache: Verwenden Sie konsequent die formelle Sie-Ansprache mit "Sie", "Ihnen" und "Ihr". Verwenden Sie niemals "du", "dir", "dich", "dein" oder "bei dir". Formulieren Sie Wissensbasis-Inhalte entsprechend formal um.
Bevorzugte Begriffe: ${preferredVocabulary.join(', ') || 'Einsatz, Problem, Einsatzort, Dringlichkeit, Rückruf'}
Verbotene Begriffe: ${forbiddenTerms.join(', ') || 'Projekt, Support-Anfrage, Business-Prozess, Automatisierung, Beratungsgespräch'}
Rückfrage-Reihenfolge: ${asStringArray(flow.questionOrder).join(' -> ')}
Standardfragen:
- Problem: ${asString(questionTexts.problem) || 'Was genau ist betroffen?'}
- Einsatzort: ${asString(questionTexts.location) || 'In welchem Ort oder welcher PLZ befindet sich der Einsatzort?'}
- Dringlichkeit: ${asString(questionTexts.urgency) || 'Wie dringend ist es aktuell?'}

Wenn Sie eine Wissensfrage beantworten, hängen Sie keine allgemeine Auswahl wie "Support, Prozesse oder Marketing" an. Stellen Sie nur eine passende lokale Rückfrage, falls sie wirklich nötig ist.

Letzte Nachrichten:
${recentHistory || '(kein Verlauf vorhanden)'}
`.trim();
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()))
    : [];
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function compactText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function formatCatalogPrice(priceMin?: string, priceMax?: string, currencyCode?: string) {
  if (!priceMin && !priceMax) {
    return undefined;
  }

  const currency = currencyCode || 'EUR';
  if (priceMin && priceMax && priceMin !== priceMax) {
    return `${priceMin} - ${priceMax} ${currency}`;
  }

  return `${priceMin || priceMax} ${currency}`;
}
