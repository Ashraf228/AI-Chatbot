const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { PassThrough } = require('node:stream');

const {
  fetchWithPinnedDns,
  WebsiteFetchError,
  WebsitePolicyError,
  createPinnedLookup,
  extractWebsiteText,
  fetchWebsiteSource,
  validatePublicWebsiteUrl,
} = require('../dist/ingest/website-ingest.js');

function resolverFor(addressesByHost) {
  return async (hostname) => (addressesByHost[hostname] || []).map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
}

function responseFrom({ statusCode = 200, headers = {}, body = '' } = {}) {
  const response = new PassThrough();
  response.statusCode = statusCode;
  response.headers = headers;
  process.nextTick(() => {
    response.end(body);
  });
  return response;
}

function requestStub(handler) {
  return (options, onResponse) => {
    const request = new EventEmitter();
    request.on = request.addListener.bind(request);
    request.setTimeout = (_timeoutMs, listener) => {
      request._timeoutListener = listener;
    };
    request.destroy = (error) => {
      process.nextTick(() => {
        request.emit('error', error);
      });
    };
    request.end = () => {
      handler(options, onResponse, request);
    };
    return request;
  };
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
  const requestImpl = async () => responseFrom({
    statusCode: 302,
    headers: { location: 'http://127.0.0.1/private' },
  });

  await assert.rejects(
    () => fetchWebsiteSource('https://93.184.216.34/faq', { requestImpl, resolver: resolverFor({}) }),
    (error) => error instanceof WebsitePolicyError && error.code === 'ip_blocked',
  );
});

test('fetchWebsiteSource enforces content-type and response size limits', async () => {
  const xmlFetch = async () => responseFrom({
    statusCode: 200,
    headers: { 'content-type': 'application/xml' },
    body: '<feed></feed>',
  });
  await assert.rejects(
    () => fetchWebsiteSource('https://93.184.216.34/feed', { requestImpl: xmlFetch, resolver: resolverFor({}) }),
    (error) => error instanceof WebsitePolicyError && error.code === 'content_type_blocked',
  );

  const hugeBody = 'a'.repeat((1024 * 1024) + 10);
  const hugeFetch = async () => responseFrom({
    statusCode: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: hugeBody,
  });
  await assert.rejects(
    () => fetchWebsiteSource('https://93.184.216.34/huge', { requestImpl: hugeFetch, resolver: resolverFor({}) }),
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
  const requestImpl = async () => responseFrom({
    statusCode: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: html,
  });

  const result = await fetchWebsiteSource('https://93.184.216.34/page', {
    requestImpl,
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

test('validatePublicWebsiteUrl blocks hosts when any DNS answer is private', async () => {
  await assert.rejects(
    () => validatePublicWebsiteUrl('https://example.com/faq', resolverFor({ 'example.com': ['93.184.216.34', '10.0.0.5'] })),
    (error) => error instanceof WebsitePolicyError && error.code === 'resolved_ip_blocked',
  );
});

test('validatePublicWebsiteUrl blocks IPv4-mapped IPv6 private answers', async () => {
  await assert.rejects(
    () => validatePublicWebsiteUrl('https://example.com/faq', resolverFor({ 'example.com': ['::ffff:192.168.1.10'] })),
    (error) => error instanceof WebsitePolicyError && error.code === 'resolved_ip_blocked',
  );
});

test('createPinnedLookup always returns the validated address', () => {
  const lookup = createPinnedLookup({ address: '93.184.216.34', family: 4 });

  lookup('example.com', {}, (error, address, family) => {
    assert.equal(error, null);
    assert.equal(address, '93.184.216.34');
    assert.equal(family, 4);
  });

  lookup('example.com', { all: true }, (error, addresses) => {
    assert.equal(error, null);
    assert.deepEqual(addresses, [{ address: '93.184.216.34', family: 4 }]);
  });
});

test('fetchWithPinnedDns keeps original hostname, SNI and pinned lookup', async () => {
  let capturedOptions;
  const httpsRequestImpl = requestStub((options, onResponse) => {
    capturedOptions = options;
    onResponse(responseFrom({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: 'ok',
    }));
  });

  const response = await fetchWithPinnedDns('https://example.com/path?x=1', { address: '93.184.216.34', family: 4 }, {
    httpsRequestImpl,
    timeoutMs: 1000,
    headers: { 'user-agent': 'SouleKnowledgeIngest/1.0' },
  });
  response.resume();
  await once(response, 'end');

  assert.equal(capturedOptions.hostname, 'example.com');
  assert.equal(capturedOptions.servername, 'example.com');
  assert.notEqual(capturedOptions.rejectUnauthorized, false);

  await new Promise((resolve, reject) => {
    capturedOptions.lookup('example.com', {}, (error, address, family) => {
      try {
        assert.equal(error, null);
        assert.equal(address, '93.184.216.34');
        assert.equal(family, 4);
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });
});

test('fetchWebsiteSource binds the actual request path to the validated DNS result', async () => {
  let seenPinnedAddress;
  const requestImpl = async (url, pinnedAddress) => {
    seenPinnedAddress = { url, pinnedAddress };
    return responseFrom({
      statusCode: 200,
      headers: { 'content-type': 'text/plain' },
      body: 'Knowledge page',
    });
  };

  const result = await fetchWebsiteSource('https://example.com/faq', {
    resolver: resolverFor({ 'example.com': ['93.184.216.34'] }),
    requestImpl,
  });

  assert.equal(seenPinnedAddress.url, 'https://example.com/faq');
  assert.deepEqual(seenPinnedAddress.pinnedAddress, { address: '93.184.216.34', family: 4 });
  assert.equal(result.finalUrl, 'https://example.com/faq');
});

test('fetchWebsiteSource sanitizes timeout failures from pinned request path', async () => {
  const requestImpl = async () => {
    const error = new Error('timeout');
    error.code = 'REQUEST_TIMEOUT';
    throw error;
  };

  await assert.rejects(
    () => fetchWebsiteSource('https://example.com/faq', {
      resolver: resolverFor({ 'example.com': ['93.184.216.34'] }),
      requestImpl,
    }),
    (error) => error instanceof WebsiteFetchError && error.code === 'fetch_timeout',
  );
});

test('extractWebsiteText keeps plain text and caps output length', () => {
  const result = extractWebsiteText(`  ${'abc '.repeat(13000)} `, 'text/plain');
  assert.equal(result.truncated, true);
  assert.equal(result.text.length, 50_000);
});
