const test = require('node:test');
const assert = require('node:assert/strict');

const { ConversationEngineController } = require('../dist/conversation-engine/conversation-engine.controller.js');

function createController(scopeOverrides = {}) {
  return new ConversationEngineController(
    {
      async query() {
        return { rows: [{ count: '0' }] };
      },
    },
    {
      async getSite(siteId) {
        return { id: siteId, tenant_id: 'tenant-1', config: {} };
      },
    },
    {
      async listForSite() {
        return [];
      },
    },
    {
      getAuth() {
        return { role: 'operator', tenantId: 'tenant-1' };
      },
      async assertSiteAccess() {
        return { tenant_id: 'tenant-1' };
      },
      ...scopeOverrides,
    },
    {},
    {
      async getDiagnostics() {
        return { assistantProfileDebug: {} };
      },
    },
    {},
    {},
    {},
    {},
    {},
    {},
  );
}

function createResponseRecorder() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) {
      headers.set(name, value);
    },
  };
}

function withMockedPdfParse(mockFactory, fn) {
  const pdfParse = require('pdf-parse');
  const original = pdfParse.PDFParse;
  pdfParse.PDFParse = mockFactory;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      pdfParse.PDFParse = original;
    });
}

test('pdf extract endpoint parses admin/operator demo PDFs in memory only', async () => {
  await withMockedPdfParse(
    function MockPDFParse() {
      return {
        async getText() {
          return { text: 'Synthetischer Demo-PDF-Inhalt fuer die API-Extraktion.' };
        },
        async destroy() {},
      };
    },
    async () => {
      const controller = createController();
      const response = createResponseRecorder();

      const result = await controller.pdfExtract(
        'site-1',
        {
          originalname: 'Demo Upload.pdf',
          mimetype: 'application/pdf',
          size: 128,
          buffer: Buffer.from('%PDF demo'),
        },
        { dashboardAuth: {} },
        response,
      );

      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      assert.equal(result.fileName, 'Demo Upload.pdf');
      assert.equal(result.extractedText, 'Synthetischer Demo-PDF-Inhalt fuer die API-Extraktion.');
      assert.equal(result.truncated, false);
      assert.deepEqual(result.boundary, {
        pdfStorageUsed: false,
        fileStorageUsed: false,
        dbWriteUsed: false,
        embeddingGenerationUsed: false,
        ragIndexingUsed: false,
        providerCallsUsed: false,
        ocrUsed: false,
      });
    },
  );
});

test('pdf extract endpoint rejects non-pdf uploads', async () => {
  const controller = createController();
  const response = createResponseRecorder();

  await assert.rejects(
    controller.pdfExtract(
      'site-1',
      {
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 12,
        buffer: Buffer.from('demo'),
      },
      { dashboardAuth: {} },
      response,
    ),
    /unsupported file type/,
  );
});

test('pdf extract endpoint rejects too-large files', async () => {
  const controller = createController();
  const response = createResponseRecorder();

  await assert.rejects(
    controller.pdfExtract(
      'site-1',
      {
        originalname: 'too-large.pdf',
        mimetype: 'application/pdf',
        size: 5 * 1024 * 1024 + 1,
        buffer: Buffer.from('%PDF demo'),
      },
      { dashboardAuth: {} },
      response,
    ),
    /PDF too large/,
  );
});

test('pdf extract endpoint trims extracted text to the safety limit', async () => {
  const longText = 'A'.repeat(20_500);

  await withMockedPdfParse(
    function MockPDFParse() {
      return {
        async getText() {
          return { text: longText };
        },
        async destroy() {},
      };
    },
    async () => {
      const controller = createController();
      const response = createResponseRecorder();

      const result = await controller.pdfExtract(
        'site-1',
        {
          originalname: 'Long Demo Upload.pdf',
          mimetype: 'application/pdf',
          size: 256,
          buffer: Buffer.from('%PDF demo'),
        },
        { dashboardAuth: {} },
        response,
      );

      assert.equal(result.extractedText.length, 20_000);
      assert.equal(result.extractedChars, 20_000);
      assert.equal(result.originalChars, 20_500);
      assert.equal(result.truncated, true);
    },
  );
});
