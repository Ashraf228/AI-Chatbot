const test = require('node:test');
const assert = require('node:assert/strict');

const {
  WebsiteFetchError,
  WebsitePolicyError,
  extractWebsiteText,
  fetchWebsiteSource,
  validatePublicWebsiteUrl,
} = require('../dist/ingest/website-ingest.js');

function resolverFor(addressesByHost) {
  return async (hostname) => (addressesByHost[hostname] || []).map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
}

test('validatePublicWebsiteUrl blocks credentials in URL', async () => {
  await assert.rejects(
    () => validatePublicWebsiteUrl('https://user:pass@example.com/faq', resolverFor({})),
    (error) => error instanceof WebsitePolicyError && error.code === 'credentials_not_allowed',
  );
});

test('validatePublicWebsiteUrl blocks metadata and private targets', async () => {
  await assert.rejects(
    () => validatePublicWebsiteUrl('http://169.254.169.254/latest'),
    (error) => error instanceof WebsitePolicyError && error.code === 'ip_blocked',
  );
  await assert.rejects(
    () => validatePublicWebsiteUrl('http://127.0.0.1/secret'),
    (error) => error instanceof WebsitePolicyError && error.code === 'ip_blocked',
  );
});

test('fetchWebsiteSource blocks redirects into private space', async () => {
  const fetchImpl = async () => new Response(null, {
    status: 302,
    headers: { location: 'http://127.0.0.1/private' },
  });

  await assert.rejects(
    () => fetchWebsiteSource('https://93.184.216.34/faq', { fetchImpl, resolver: resolverFor({}) }),
    (error) => error instanceof WebsitePolicyError && error.code === 'ip_blocked',
  );
});

test('fetchWebsiteSource enforces content-type and response size limits', async () => {
  const xmlFetch = async () => new Response('<feed></feed>', {
    status: 200,
    headers: { 'content-type': 'application/xml' },
  });
  await assert.rejects(
    () => fetchWebsiteSource('https://93.184.216.34/feed', { fetchImpl: xmlFetch, resolver: resolverFor({}) }),
    (error) => error instanceof WebsitePolicyError && error.code === 'content_type_blocked',
  );

  const hugeBody = 'a'.repeat((1024 * 1024) + 10);
  const hugeFetch = async () => new Response(hugeBody, {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
  await assert.rejects(
    () => fetchWebsiteSource('https://93.184.216.34/huge', { fetchImpl: hugeFetch, resolver: resolverFor({}) }),
    (error) => error instanceof WebsitePolicyError && error.code === 'response_too_large',
  );
});

test('fetchWebsiteSource extracts and truncates website text without JS execution', async () => {
  const html = `
    <html>
      <head>
        <script>window.secret = "ignore me";</script>
      </head>
      <body>
        <header>Header</header>
        <main>${'Wissen '.repeat(12000)}</main>
      </body>
    </html>
  `;
  const fetchImpl = async () => new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  const result = await fetchWebsiteSource('https://93.184.216.34/page', {
    fetchImpl,
    resolver: resolverFor({}),
  });

  assert.equal(result.sourceDomain, '93.184.216.34');
  assert.equal(result.truncated, true);
  assert.equal(result.extractedText.length, 50_000);
  assert.equal(result.extractedText.includes('ignore me'), false);
});

test('validatePublicWebsiteUrl fails when hostname cannot be resolved', async () => {
  await assert.rejects(
    () => validatePublicWebsiteUrl('https://example.com/faq', resolverFor({})),
    (error) => error instanceof WebsiteFetchError && error.code === 'dns_lookup_failed',
  );
});

test('extractWebsiteText keeps plain text and caps output length', () => {
  const result = extractWebsiteText(`  ${'abc '.repeat(13000)} `, 'text/plain');
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, 50_000);
});
