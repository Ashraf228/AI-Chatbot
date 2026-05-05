import { Injectable } from '@nestjs/common';
import { IntegrationsService } from '../integrations.service';

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  url: string;
  priceMin?: string;
  priceMax?: string;
  currencyCode?: string;
  availableForSale?: boolean;
  variantSummary?: string;
  variants?: ShopifyVariant[];
};

export type ShopifyCollection = {
  id: string;
  title: string;
  handle: string;
  url: string;
  productCount?: number;
};

export type ShopifyVariant = {
  id: string;
  title: string;
  url: string;
  price?: string;
  currencyCode?: string;
  availableForSale?: boolean;
};

type ShopifyConnection = {
  shopDomain: string;
  storefrontBaseUrl: string;
  adminApiToken: string;
};

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumberString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return '';
}

function tokenize(input: string) {
  return normalizeString(input)
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function safeStorefrontBaseUrl(storefrontBaseUrl: string, shopDomain: string) {
  const base = normalizeString(storefrontBaseUrl);
  if (base) {
    return base.replace(/\/+$/, '');
  }

  const normalizedDomain = normalizeString(shopDomain);
  if (!normalizedDomain) {
    return '';
  }

  return `https://${normalizedDomain}`;
}

function productHaystack(product: ShopifyProduct) {
  return [
    product.title,
    product.handle,
    product.vendor || '',
    product.productType || '',
    product.variantSummary || '',
    ...(product.tags || []),
  ]
    .join(' ')
    .toLowerCase();
}

function collectionHaystack(collection: ShopifyCollection) {
  return [collection.title, collection.handle].join(' ').toLowerCase();
}

function parsePriceValue(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function detectCatalogFilters(query: string) {
  const normalizedQuery = normalizeString(query).toLowerCase();
  const maxPriceMatch = normalizedQuery.match(
    /\b(?:unter|bis|max(?:imal)?)\s+(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?\b/i,
  );
  const minPriceMatch = normalizedQuery.match(
    /\b(?:ab|mindestens|min(?:imal)?)\s+(\d{1,5}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?\b/i,
  );
  const explicitSizeTerms = Array.from(
    normalizedQuery.matchAll(/\b(?:groesse|größe|size)\s*(\d{2,3}|xs|s|m|l|xl|xxl)\b/gi),
  )
    .map((match) => normalizeString(match[1]).toLowerCase())
    .filter(Boolean);
  const colorAndNamedVariantTerms = tokenize(normalizedQuery).filter((term) => {
    return ['xs', 's', 'm', 'l', 'xl', 'xxl', 'schwarz', 'weiss', 'weiß', 'blau', 'rot', 'gruen', 'grün'].includes(
      term,
    );
  });
  const variantTerms = Array.from(new Set([...explicitSizeTerms, ...colorAndNamedVariantTerms]));

  return {
    availableOnly:
      /\bnur\s+verf(?:ü|ue)gbar\b/i.test(normalizedQuery) ||
      /\bauf\s+lager\b/i.test(normalizedQuery) ||
      /\bsofort\s+lieferbar\b/i.test(normalizedQuery),
    maxPrice: maxPriceMatch ? parsePriceValue(maxPriceMatch[1]) : undefined,
    minPrice: minPriceMatch ? parsePriceValue(minPriceMatch[1]) : undefined,
    variantTerms,
  };
}

function priceMatchesRange(
  priceMin: string | undefined,
  priceMax: string | undefined,
  filters: ReturnType<typeof detectCatalogFilters>,
) {
  const min = parsePriceValue(priceMin);
  const max = parsePriceValue(priceMax);

  if (filters.maxPrice !== undefined && min !== undefined && min > filters.maxPrice) {
    return false;
  }

  if (filters.minPrice !== undefined && max !== undefined && max < filters.minPrice) {
    return false;
  }

  return true;
}

function variantMatchesTerms(variant: ShopifyVariant, terms: string[]) {
  if (terms.length === 0) {
    return true;
  }

  const haystack = [variant.title, variant.price || ''].join(' ').toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function normalizeProductFromVariants(
  product: ShopifyProduct,
  variants: ShopifyVariant[],
  keepAllVariants: boolean,
): ShopifyProduct {
  const relevantVariants = keepAllVariants ? product.variants || [] : variants;
  const prices = relevantVariants
    .map((variant) => parsePriceValue(variant.price))
    .filter((value): value is number => value !== undefined);

  return {
    ...product,
    variants: relevantVariants,
    priceMin: prices.length ? Math.min(...prices).toFixed(2) : product.priceMin,
    priceMax: prices.length ? Math.max(...prices).toFixed(2) : product.priceMax,
    availableForSale:
      relevantVariants.length > 0
        ? relevantVariants.some((variant) => variant.availableForSale !== false)
        : product.availableForSale,
    variantSummary:
      relevantVariants.length > 0
        ? relevantVariants
            .map((variant) => normalizeString(variant.title))
            .filter(Boolean)
            .slice(0, 3)
            .join(' · ') || undefined
        : product.variantSummary,
  };
}

function applyCatalogFilters(products: ShopifyProduct[], query: string) {
  const filters = detectCatalogFilters(query);

  return products.reduce<ShopifyProduct[]>((acc, product) => {
    if (filters.availableOnly && product.availableForSale === false) {
      return acc;
    }

    if (!priceMatchesRange(product.priceMin, product.priceMax, filters)) {
      return acc;
    }

    const variants = (product.variants || []).filter((variant) => {
      if (filters.availableOnly && variant.availableForSale === false) {
        return false;
      }

      if (!priceMatchesRange(variant.price, variant.price, filters)) {
        return false;
      }

      return variantMatchesTerms(variant, filters.variantTerms);
    });

    const productHaystackValue = productHaystack(product);
    const productMatchesVariantTerms =
      filters.variantTerms.length === 0 ||
      filters.variantTerms.every((term) => productHaystackValue.includes(term));

    if ((product.variants || []).length > 0) {
      if (filters.variantTerms.length > 0 && variants.length === 0 && !productMatchesVariantTerms) {
        return acc;
      }

      acc.push(normalizeProductFromVariants(product, variants, filters.variantTerms.length === 0));
      return acc;
    }

    if (!productMatchesVariantTerms) {
      return acc;
    }

    acc.push(product);
    return acc;
  }, []);
}

function rankByTerms<T>(
  entries: T[],
  query: string,
  haystackFor: (entry: T) => string,
) {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return entries;
  }

  return entries
    .map((entry) => {
      const haystack = haystackFor(entry);
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.entry);
}

@Injectable()
export class ShopifyCatalogService {
  constructor(private readonly integrations: IntegrationsService) {}

  private async getConnection(siteId: string): Promise<ShopifyConnection | null> {
    const connection = await this.integrations.getConnectionForSite(siteId, 'shopify', 'primary');
    if (!connection || connection.status !== 'connected') {
      return null;
    }

    const shopDomain = normalizeString(connection.config.shopDomain);
    const storefrontBaseUrl = safeStorefrontBaseUrl(
      normalizeString(connection.config.storefrontBaseUrl),
      shopDomain,
    );
    const adminApiToken = normalizeString(connection.secrets.adminApiToken);

    if (!shopDomain || !storefrontBaseUrl || !adminApiToken) {
      return null;
    }

    return {
      shopDomain,
      storefrontBaseUrl,
      adminApiToken,
    };
  }

  private async requestJson<T>(connection: ShopifyConnection, path: string): Promise<T> {
    const response = await fetch(`https://${connection.shopDomain}${path}`, {
      headers: {
        'X-Shopify-Access-Token': connection.adminApiToken,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Shopify request failed with HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  async searchProductsForSite(input: {
    siteId: string;
    query: string;
    limit?: number;
  }): Promise<ShopifyProduct[]> {
    const connection = await this.getConnection(input.siteId);
    if (!connection) {
      return [];
    }

    const data = await this.requestJson<{
      products?: Array<{
        id?: string | number;
        title?: string;
        handle?: string;
        vendor?: string;
        product_type?: string;
        tags?: string;
        status?: string;
        variants?: Array<{
          id?: string | number;
          title?: string;
          price?: string | number;
          inventory_quantity?: number;
          inventory_policy?: string;
        }>;
      }>;
    }>(
      connection,
      '/admin/api/2025-01/products.json?limit=30&status=active&fields=id,title,handle,product_type,vendor,tags,status,variants',
    );

    const products: ShopifyProduct[] = Array.isArray(data.products)
      ? data.products.reduce<ShopifyProduct[]>((acc, product) => {
          const handle = normalizeString(product.handle);
          const title = normalizeString(product.title);
          if (!handle || !title) {
            return acc;
          }

          const variants = Array.isArray(product.variants) ? product.variants : [];
          const normalizedVariants = variants.reduce<ShopifyVariant[]>((variantAcc, variant) => {
            const variantId = String(variant.id || '');
            const variantTitle = normalizeString(variant.title);
            if (!variantId || !variantTitle || variantTitle.toLowerCase() === 'default title') {
              return variantAcc;
            }

            const quantity = Number(variant.inventory_quantity);
            const availableForSale =
              quantity > 0 || normalizeString(variant.inventory_policy) === 'continue';

            variantAcc.push({
              id: variantId,
              title: variantTitle,
              url: `${connection.storefrontBaseUrl}/products/${handle}?variant=${variantId}`,
              price: normalizeNumberString(variant.price) || undefined,
              currencyCode: 'EUR',
              availableForSale,
            });
            return variantAcc;
          }, []);
          const prices = variants
            .map((variant) => Number(normalizeNumberString(variant.price)))
            .filter((value) => Number.isFinite(value));
          const priceMin = prices.length ? Math.min(...prices).toFixed(2) : undefined;
          const priceMax = prices.length ? Math.max(...prices).toFixed(2) : undefined;
          const availableForSale =
            variants.length > 0
              ? variants.some((variant) => {
                  const quantity = Number(variant.inventory_quantity);
                  return quantity > 0 || normalizeString(variant.inventory_policy) === 'continue';
                })
              : undefined;
          const variantTitles = variants
            .map((variant) => normalizeString(variant.title))
            .filter((value) => value && value.toLowerCase() !== 'default title');

          acc.push({
            id: String(product.id || handle),
            title,
            handle,
            vendor: normalizeString(product.vendor) || undefined,
            productType: normalizeString(product.product_type) || undefined,
            tags: normalizeString(product.tags)
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
            url: `${connection.storefrontBaseUrl}/products/${handle}`,
            priceMin,
            priceMax,
            currencyCode: 'EUR',
            availableForSale,
            variantSummary: variantTitles.slice(0, 3).join(' · ') || undefined,
            variants: normalizedVariants,
          });
          return acc;
        }, [])
      : [];

    return applyCatalogFilters(rankByTerms(products, input.query, productHaystack), input.query).slice(
      0,
      Math.max(1, Math.min(input.limit || 3, 6)),
    );
  }

  async searchCollectionsForSite(input: {
    siteId: string;
    query: string;
    limit?: number;
  }): Promise<ShopifyCollection[]> {
    const connection = await this.getConnection(input.siteId);
    if (!connection) {
      return [];
    }

    const data = await this.requestJson<{
      smart_collections?: Array<{
        id?: string | number;
        title?: string;
        handle?: string;
      }>;
      custom_collections?: Array<{
        id?: string | number;
        title?: string;
        handle?: string;
      }>;
    }>(
      connection,
      '/admin/api/2025-01/custom_collections.json?limit=25&fields=id,title,handle',
    );
    const smartData = await this.requestJson<{
      smart_collections?: Array<{
        id?: string | number;
        title?: string;
        handle?: string;
      }>;
    }>(connection, '/admin/api/2025-01/smart_collections.json?limit=25&fields=id,title,handle');

    const rows = [...(data.custom_collections || []), ...(smartData.smart_collections || [])];
    const collections: ShopifyCollection[] = rows.reduce<ShopifyCollection[]>((acc, collection) => {
      const handle = normalizeString(collection.handle);
      const title = normalizeString(collection.title);
      if (!handle || !title) {
        return acc;
      }

      acc.push({
        id: String(collection.id || handle),
        title,
        handle,
        url: `${connection.storefrontBaseUrl}/collections/${handle}`,
      });
      return acc;
    }, []);

    return rankByTerms(collections, input.query, collectionHaystack).slice(
      0,
      Math.max(1, Math.min(input.limit || 3, 6)),
    );
  }
}
