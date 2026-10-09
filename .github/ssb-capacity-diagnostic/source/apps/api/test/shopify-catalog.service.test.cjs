const test = require('node:test');
const assert = require('node:assert/strict');
const { ShopifyCatalogService } = require('../dist/integrations/shopify/shopify-catalog.service.js');

test('ShopifyCatalogService filters products by availability, price cap and variant cues', async () => {
  const service = new ShopifyCatalogService({
    async getConnectionForSite() {
      return {
        status: 'connected',
        config: {
          shopDomain: 'shop.example',
          storefrontBaseUrl: 'https://shop.example',
        },
        secrets: {
          adminApiToken: 'token-1',
        },
      };
    },
  });

  const originalFetch = global.fetch;
  global.fetch = async () => {
    return {
      ok: true,
      async json() {
        return {
          products: [
            {
              id: 1,
              title: 'Running Sneaker',
              handle: 'running-sneaker',
              product_type: 'Sneaker',
              tags: 'herren,sport',
              variants: [
                {
                  id: 11,
                  title: '42 Schwarz',
                  price: '89.00',
                  inventory_quantity: 6,
                  inventory_policy: 'deny',
                },
                {
                  id: 12,
                  title: '43 Schwarz',
                  price: '119.00',
                  inventory_quantity: 0,
                  inventory_policy: 'deny',
                },
              ],
            },
            {
              id: 2,
              title: 'Casual Sneaker',
              handle: 'casual-sneaker',
              product_type: 'Sneaker',
              tags: 'herren,casual',
              variants: [
                {
                  id: 21,
                  title: '42 Weiss',
                  price: '129.00',
                  inventory_quantity: 8,
                  inventory_policy: 'deny',
                },
              ],
            },
          ],
        };
      },
    };
  };

  try {
    const products = await service.searchProductsForSite({
      siteId: 'site-1',
      query: 'Sneaker Groesse 42 nur verfuegbar unter 100',
      limit: 3,
    });

    assert.equal(products.length, 1);
    assert.equal(products[0].title, 'Running Sneaker');
    assert.equal(products[0].priceMin, '89.00');
    assert.equal(products[0].priceMax, '89.00');
    assert.equal(products[0].availableForSale, true);
    assert.equal(products[0].variants.length, 1);
    assert.equal(products[0].variants[0].title, '42 Schwarz');
  } finally {
    global.fetch = originalFetch;
  }
});
