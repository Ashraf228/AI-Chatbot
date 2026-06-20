const test = require('node:test');
const assert = require('node:assert/strict');
const { PDF_UPLOAD_OPTIONS } = require('../dist/ingest/ingest.controller.js');

test('PDF upload options cap file size at 15 MB', () => {
  assert.equal(PDF_UPLOAD_OPTIONS.limits.fileSize, 15 * 1024 * 1024);
});

test('PDF upload options accept only PDF MIME type', async () => {
  await new Promise((resolve, reject) => {
    PDF_UPLOAD_OPTIONS.fileFilter(null, { mimetype: 'application/pdf' }, (error, acceptFile) => {
      try {
        assert.equal(error, null);
        assert.equal(acceptFile, true);
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });

  await new Promise((resolve, reject) => {
    PDF_UPLOAD_OPTIONS.fileFilter(null, { mimetype: 'text/plain' }, (error, acceptFile) => {
      try {
        assert.match(error.message, /Only PDF files are allowed/);
        assert.equal(acceptFile, false);
        resolve();
      } catch (assertionError) {
        reject(assertionError);
      }
    });
  });
});
