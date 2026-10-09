const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const shared = require('nodemailer/lib/shared');
const { ReportMailerService } = require('../dist/modules/widget/services/report-mailer.service.js');
const { registerMailerTests } = require('../../../test/helpers/mail-network-isolation.cjs');

test('Nodemailer CommonJS default is the factory object used by the compiled API', () => {
  assert.equal(nodemailer.default, nodemailer);
});

registerMailerTests(test, {
  name: 'ReportMailerService (compiled CommonJS API)', nodemailer, shared,
  send: message => new ReportMailerService().send(message),
  checkFailure(error, failure) {
    assert.equal(error.getStatus(), 500);
    assert.equal(error.message, `SMTP send failed: ${failure.message}`);
  },
});
