const test = require('node:test');
const assert = require('node:assert/strict');
const { EcommerceProductAdvisorService } = require('../dist/modules/ecommerce-product-advisor/ecommerce-product-advisor.service.js');
const { ResponseComposerService } = require('../dist/ai/chat-pipeline/response-composer.service.js');

test('EcommerceProductAdvisorService asks a clarification question for broad category queries', async () => {
  const service = new EcommerceProductAdvisorService(
    {
      async query() {
        return { rows: [] };
      },
    },
    {
      async getSite() {
        return {
          tenant_id: 'tenant-1',
        };
      },
    },
    {
      async listForSite() {
        return [
          {
            key: 'ecommerce-product-advisor',
            config: {
              catalogMode: 'shopify_catalog',
            },
          },
        ];
      },
    },
    {
      async searchProductsForSite() {
        return [];
      },
      async searchCollectionsForSite() {
        return [
          { id: 'c1', title: 'Sneaker', handle: 'sneaker', url: 'https://shop/collections/sneaker' },
          { id: 'c2', title: 'Boots', handle: 'boots', url: 'https://shop/collections/boots' },
        ];
      },
    },
  );

  const result = await service.buildRecommendationContextForSite({
    siteId: 'site-1',
    query: 'Ich suche Schuhe',
    limit: 3,
  });

  assert.equal(result.state, 'broad_search');
  assert.equal(result.products.length, 0);
  assert.equal(result.collections.length, 2);
  assert.match(result.clarificationQuestion || '', /Sneaker/);
});

test('EcommerceProductAdvisorService is transparent when product data is missing', async () => {
  const service = new EcommerceProductAdvisorService(
    {
      async query() {
        return { rows: [] };
      },
    },
    {
      async getSite() {
        return {
          tenant_id: 'tenant-1',
        };
      },
    },
    {
      async listForSite() {
        return [
          {
            key: 'ecommerce-product-advisor',
            config: {
              catalogMode: 'shopify_catalog',
            },
          },
        ];
      },
    },
    {
      async searchProductsForSite() {
        return [];
      },
      async searchCollectionsForSite() {
        return [];
      },
    },
  );

  const result = await service.buildRecommendationContextForSite({
    siteId: 'site-1',
    query: 'Was kostet der Premium Hoodie?',
    limit: 3,
  });

  assert.equal(result.products.length, 0);
  assert.equal(result.collections.length, 0);
  assert.match(result.clarificationQuestion || '', /keine verifizierten Produktdaten/i);
  assert.match(result.stateGuide, /Erfinde keine Produkte, Preise, Lieferzeiten/i);
});

test('EcommerceProductAdvisorService combines short follow-up answers with previous user intent', async () => {
  let receivedQuery = '';

  const service = new EcommerceProductAdvisorService(
    {
      async query() {
        return { rows: [] };
      },
    },
    {
      async getSite() {
        return {
          tenant_id: 'tenant-1',
        };
      },
    },
    {
      async listForSite() {
        return [
          {
            key: 'ecommerce-product-advisor',
            config: {
              catalogMode: 'shopify_catalog',
            },
          },
        ];
      },
    },
    {
      async searchProductsForSite(input) {
        receivedQuery = input.query;
        return [];
      },
      async searchCollectionsForSite() {
        return [];
      },
    },
  );

  const result = await service.buildRecommendationContextForSite({
    siteId: 'site-1',
    query: 'Sneaker fuer Herren',
    limit: 3,
    history: [
      { role: 'user', content: 'Ich suche Schuhe' },
      {
        role: 'assistant',
        content:
          'Ich habe dazu passende Kategorien gefunden: Sneaker, Boots. Welche Richtung ist fuer dich relevant?',
      },
      { role: 'user', content: 'Sneaker fuer Herren' },
    ],
  });

  assert.equal(receivedQuery, 'Ich suche Schuhe Sneaker fuer Herren');
  assert.equal(result.effectiveQuery, 'Ich suche Schuhe Sneaker fuer Herren');
});

test('EcommerceProductAdvisorService enters ready_to_recommend when a variant cue is present', async () => {
  const service = new EcommerceProductAdvisorService(
    {
      async query() {
        return { rows: [] };
      },
    },
    {
      async getSite() {
        return {
          tenant_id: 'tenant-1',
        };
      },
    },
    {
      async listForSite() {
        return [
          {
            key: 'ecommerce-product-advisor',
            config: {
              catalogMode: 'shopify_catalog',
            },
          },
        ];
      },
    },
    {
      async searchProductsForSite() {
        return [
          {
            id: 'p1',
            title: 'Running Sneaker',
            handle: 'running-sneaker',
            url: 'https://shop/products/running-sneaker',
            variants: [
              { id: 'v1', title: '42', url: 'https://shop/products/running-sneaker?variant=v1' },
              { id: 'v2', title: '43', url: 'https://shop/products/running-sneaker?variant=v2' },
            ],
          },
        ];
      },
      async searchCollectionsForSite() {
        return [];
      },
    },
  );

  const result = await service.buildRecommendationContextForSite({
    siteId: 'site-1',
    query: 'schwarze Sneaker in Groesse 42',
    limit: 3,
  });

  assert.equal(result.state, 'ready_to_recommend');
  assert.equal(result.clarificationQuestion, undefined);
});

test('ResponseComposerService includes verified price, availability and variants in catalog context', async () => {
  const composer = new ResponseComposerService();

  const context = composer.buildCatalogContext({
    state: 'ready_to_recommend',
    stateGuide: '',
    products: [
      {
        id: 'p1',
        title: 'Premium Hoodie',
        handle: 'premium-hoodie',
        url: 'https://shop/products/premium-hoodie',
        vendor: 'Demo',
        productType: 'Hoodies',
        priceMin: '79.00',
        priceMax: '89.00',
        currencyCode: 'EUR',
        availableForSale: true,
        variantSummary: 'M · L',
        variants: [
          {
            id: 'v1',
            title: 'M / Schwarz',
            url: 'https://shop/products/premium-hoodie?variant=v1',
            price: '79.00',
            currencyCode: 'EUR',
            availableForSale: true,
          },
          {
            id: 'v2',
            title: 'L / Schwarz',
            url: 'https://shop/products/premium-hoodie?variant=v2',
            price: '89.00',
            currencyCode: 'EUR',
            availableForSale: false,
          },
        ],
      },
    ],
    collections: [],
  });

  assert.match(context, /Verifizierte Produktdaten/);
  assert.match(context, /Preis: 79.00 - 89.00 EUR/);
  assert.match(context, /Status: verfuegbar/);
  assert.match(context, /M \/ Schwarz, Preis: 79.00 EUR/);
  assert.match(context, /L \/ Schwarz, Preis: 89.00 EUR, Status: nicht verfuegbar/);
});

test('EcommerceProductAdvisorService carries refinement-only follow-ups across advisor turns', async () => {
  let receivedQuery = '';

  const service = new EcommerceProductAdvisorService(
    {
      async query() {
        return { rows: [] };
      },
    },
    {
      async getSite() {
        return {
          tenant_id: 'tenant-1',
        };
      },
    },
    {
      async listForSite() {
        return [
          {
            key: 'ecommerce-product-advisor',
            config: {
              catalogMode: 'shopify_catalog',
            },
          },
        ];
      },
    },
    {
      async searchProductsForSite(input) {
        receivedQuery = input.query;
        return [];
      },
      async searchCollectionsForSite() {
        return [];
      },
    },
  );

  const result = await service.buildRecommendationContextForSite({
    siteId: 'site-1',
    query: 'nur verfuegbar unter 100',
    limit: 3,
    history: [
      { role: 'user', content: 'Ich suche Schuhe' },
      {
        role: 'assistant',
        content:
          'Ich habe dazu passende Kategorien gefunden: Sneaker, Boots. Welche Richtung ist fuer dich relevant?',
      },
      { role: 'user', content: 'Sneaker fuer Herren' },
      {
        role: 'assistant',
        content: 'Ich habe passende Produkte gefunden. Soll ich eher nach Groesse, Farbe oder einer bestimmten Ausfuehrung eingrenzen?',
      },
      { role: 'user', content: 'Groesse 42' },
      { role: 'assistant', content: 'Hier sind passende Varianten fuer dich.' },
      { role: 'user', content: 'nur verfuegbar unter 100' },
    ],
  });

  assert.equal(
    receivedQuery,
    'Ich suche Schuhe Sneaker fuer Herren Groesse 42 nur verfuegbar unter 100',
  );
  assert.equal(
    result.effectiveQuery,
    'Ich suche Schuhe Sneaker fuer Herren Groesse 42 nur verfuegbar unter 100',
  );
});
