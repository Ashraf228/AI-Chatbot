import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../db/prisma.service';
import { SitesService } from '../../sites/sites.service';
import { SiteModulesService } from '../../site-modules/site-modules.service';
import {
  DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG,
  normalizeEcommerceProductAdvisorModuleConfig,
} from '../../site-modules/module-configs';
import {
  ShopifyCatalogService,
  ShopifyCollection,
  ShopifyProduct,
} from '../../integrations/shopify/shopify-catalog.service';

type RecommendationContext = {
  products: ShopifyProduct[];
  collections: ShopifyCollection[];
  agentRunId?: string;
  clarificationQuestion?: string;
  effectiveQuery?: string;
  state: RecommendationState;
  stateGuide: string;
};

export type RecommendationState =
  | 'broad_search'
  | 'category_selected'
  | 'variant_refinement'
  | 'ready_to_recommend';

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

const BROAD_QUERY_PATTERN =
  /\b(suche|brauche|habt ihr|gibt es|etwas|irgendwas|shop|produkt|produkte)\b/i;
const VARIANT_CUE_PATTERN =
  /\b(groesse|größe|size|farbe|variante|modell|version|schwarz|weiss|weiß|blau|rot|xl|l|m|s)\b/i;
const CLARIFICATION_PROMPT_PATTERN =
  /\b(welche richtung|eingrenzen|produktart|kategorie suchst du|groesse, farbe|ausfuehrung)\b/i;
const AVAILABILITY_FILTER_PATTERN =
  /\b(nur\s+verf(?:ü|ue)gbar|auf\s+lager|sofort\s+lieferbar)\b/i;
const PRICE_FILTER_PATTERN =
  /\b(?:unter|bis|max(?:imal)?|ab|mindestens|min(?:imal)?)\s+\d{1,5}(?:[.,]\d{1,2})?\s*(?:€|eur|euro)?\b/i;

function isRefinementOnlyQuery(input: string) {
  const normalized = input.trim();
  const tokens = tokenize(normalized);
  if (tokens.length === 0) {
    return false;
  }

  const hasFilterCue =
    VARIANT_CUE_PATTERN.test(normalized) ||
    AVAILABILITY_FILTER_PATTERN.test(normalized) ||
    PRICE_FILTER_PATTERN.test(normalized);
  const hasBroadIntentCue = BROAD_QUERY_PATTERN.test(normalized);

  return hasFilterCue && !hasBroadIntentCue && tokens.length <= 8;
}

@Injectable()
export class EcommerceProductAdvisorService {
  constructor(
    private readonly db: PrismaService,
    private readonly sites: SitesService,
    private readonly siteModules: SiteModulesService,
    private readonly shopifyCatalog: ShopifyCatalogService,
  ) {}

  async getConfigForSite(siteId: string) {
    const modules = await this.siteModules.listForSite(siteId);
    const module = modules.find((entry) => entry.key === 'ecommerce-product-advisor');

    if (!module) {
      return DEFAULT_ECOMMERCE_PRODUCT_ADVISOR_MODULE_CONFIG;
    }

    return normalizeEcommerceProductAdvisorModuleConfig(module.config);
  }

  async searchCatalogForSite(input: { siteId: string; query: string; limit?: number }) {
    const config = await this.getConfigForSite(input.siteId);
    if (config.catalogMode !== 'shopify_catalog') {
      return [];
    }

    return this.shopifyCatalog.searchProductsForSite(input);
  }

  async buildRecommendationContextForSite(input: {
    siteId: string;
    query: string;
    limit?: number;
    history?: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }>;
  }): Promise<RecommendationContext> {
    const config = await this.getConfigForSite(input.siteId);
    if (config.catalogMode !== 'shopify_catalog') {
      return {
        products: [],
        collections: [],
        effectiveQuery: input.query,
        state: 'ready_to_recommend',
        stateGuide:
          'Advisor-Zustand: ready_to_recommend. Es gibt keine Shopify-Kataloganbindung. Antworte mit vorhandenem Wissen und bleibe transparent.',
      };
    }

    const effectiveQuery = this.buildEffectiveQuery(input.history, input.query);

    const [products, collections] = await Promise.all([
      this.shopifyCatalog.searchProductsForSite({ ...input, query: effectiveQuery }),
      this.shopifyCatalog.searchCollectionsForSite({ ...input, query: effectiveQuery }),
    ]);

    const agentRunId = await this.recordSearchRun(input.siteId, effectiveQuery, {
      products,
      collections,
    });
    const state = this.determineRecommendationState(effectiveQuery, products, collections);

    return {
      products,
      collections,
      agentRunId,
      clarificationQuestion: this.buildClarificationQuestion(state, effectiveQuery, products, collections),
      effectiveQuery,
      state,
      stateGuide: this.buildStateGuide(state),
    };
  }

  private determineRecommendationState(
    effectiveQuery: string,
    products: ShopifyProduct[],
    collections: ShopifyCollection[],
  ): RecommendationState {
    const normalizedQuery = effectiveQuery.trim();
    const tokens = tokenize(normalizedQuery);
    const isBroadQuery = tokens.length <= 3 || BROAD_QUERY_PATTERN.test(normalizedQuery);
    const hasVariantHeavyProduct = products.some((product) => (product.variants || []).length > 1);
    const hasVariantCue = VARIANT_CUE_PATTERN.test(normalizedQuery);

    if (collections.length > 0 && isBroadQuery) {
      return 'broad_search';
    }

    if (products.length > 0 && hasVariantHeavyProduct && !hasVariantCue) {
      return 'variant_refinement';
    }

    if (products.length > 0 && hasVariantCue) {
      return 'ready_to_recommend';
    }

    if (products.length > 0 || collections.length > 0) {
      return 'category_selected';
    }

    return 'broad_search';
  }

  private buildEffectiveQuery(
    history:
      | Array<{
          role: 'user' | 'assistant' | 'system';
          content: string;
        }>
      | undefined,
    currentQuery: string,
  ) {
    const normalizedCurrent = currentQuery.trim();
    const currentTokens = tokenize(normalizedCurrent);
    if (!history || currentTokens.length === 0) {
      return normalizedCurrent;
    }

    const currentIndex = history.length - 1;
    const previousAssistant = history
      .slice(0, currentIndex)
      .reverse()
      .find((entry) => entry.role === 'assistant');
    const previousUser = history
      .slice(0, currentIndex)
      .reverse()
      .find((entry) => entry.role === 'user');
    const previousUsers = history
      .slice(0, currentIndex)
      .filter((entry): entry is { role: 'user'; content: string } => entry.role === 'user')
      .map((entry) => entry.content.trim())
      .filter(Boolean);

    if (
      previousAssistant &&
      previousUser &&
      currentTokens.length <= 5 &&
      CLARIFICATION_PROMPT_PATTERN.test(previousAssistant.content)
    ) {
      return `${previousUser.content.trim()} ${normalizedCurrent}`.trim();
    }

    if (isRefinementOnlyQuery(normalizedCurrent) && previousUsers.length > 0) {
      const contextTail = previousUsers.slice(-3);
      return [...contextTail, normalizedCurrent].join(' ').trim();
    }

    return normalizedCurrent;
  }

  private buildClarificationQuestion(
    state: RecommendationState,
    query: string,
    products: ShopifyProduct[],
    collections: ShopifyCollection[],
  ) {
    if (state === 'broad_search' && collections.length > 0) {
      const labels = collections
        .slice(0, 3)
        .map((collection) => collection.title)
        .join(', ');
      return `Ich habe dazu passende Kategorien gefunden: ${labels}. Welche Richtung ist fuer dich relevant?`;
    }

    if (state === 'variant_refinement' && products.length > 0) {
      return 'Ich habe passende Produkte gefunden. Soll ich eher nach Groesse, Farbe oder einer bestimmten Ausfuehrung eingrenzen?';
    }

    if (state === 'broad_search' && products.length === 0 && collections.length === 0) {
      return 'Dazu habe ich aktuell keine verifizierten Produktdaten gefunden. Welche Produktart oder Kategorie suchst du genau? Dann kann ich gezielter pruefen.';
    }

    return undefined;
  }

  private buildStateGuide(state: RecommendationState) {
    switch (state) {
      case 'broad_search':
        return 'Advisor-Zustand: broad_search. Stelle zuerst eine fokussierende Rueckfrage und vermeide vorschnelle Produktempfehlungen. Erfinde keine Produkte, Preise, Lieferzeiten, Rabatte oder Verfuegbarkeit.';
      case 'category_selected':
        return 'Advisor-Zustand: category_selected. Eine Richtung ist erkennbar. Empfiehl nur Produkte oder Kategorien aus dem Produktkatalog oder Unternehmenswissen und halte Rueckfragen knapp.';
      case 'variant_refinement':
        return 'Advisor-Zustand: variant_refinement. Passende Produkte sind gefunden, aber Varianten muessen noch eingegrenzt werden. Nenne nur bekannte Varianten und Preise.';
      case 'ready_to_recommend':
      default:
        return 'Advisor-Zustand: ready_to_recommend. Die Anfrage ist konkret genug fuer direkte Produktempfehlungen. Verwende ausschliesslich verifizierte Katalog- oder Wissensdaten.';
    }
  }

  private async recordSearchRun(
    siteId: string,
    query: string,
    result: { products: ShopifyProduct[]; collections: ShopifyCollection[] },
  ) {
    const site = await this.sites.getSite(siteId);
    if (!site?.tenant_id) {
      return undefined;
    }

    const runId = randomUUID();
    await this.db.query(
      `INSERT INTO agent_runs(
         id,
         tenant_id,
         site_id,
         agent_key,
         trigger_source,
         status,
         input_summary,
         output_summary,
         metadata,
         started_at,
         completed_at,
         created_at
       ) VALUES (
         $1, $2, $3, $4, $5, 'completed', $6, $7, $8::jsonb, now(), now(), now()
       )`,
      [
        runId,
        site.tenant_id,
        siteId,
        'ecommerce-product-advisor',
        'chat',
        query,
        `products=${result.products.length}, collections=${result.collections.length}`,
        JSON.stringify({
          query,
          resultCount: result.products.length + result.collections.length,
          provider: 'shopify',
        }),
      ],
    );

    await this.db.query(
      `INSERT INTO tool_invocations(
         id,
         agent_run_id,
         tenant_id,
         site_id,
         tool_key,
         status,
         input_payload,
         output_payload,
         error_message,
         created_at,
         completed_at
       ) VALUES (
         $1, $2, $3, $4, $5, 'completed', $6::jsonb, $7::jsonb, null, now(), now()
       )`,
      [
        randomUUID(),
        runId,
        site.tenant_id,
        siteId,
        'search_catalog',
        JSON.stringify({ query, limit: 3 }),
        JSON.stringify({
          resultCount: result.products.length + result.collections.length,
          products: result.products,
          collections: result.collections,
        }),
      ],
    );

    return runId;
  }
}
