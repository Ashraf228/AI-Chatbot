const test = require('node:test');
const assert = require('node:assert/strict');
const nodemailer = require('nodemailer');
const { ReportMailerService } = require('../dist/modules/widget/services/report-mailer.service.js');

const SMTP_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'REPORTS_FROM_EMAIL'];

function withSmtpEnv(fn) {
  const previous = Object.fromEntries(SMTP_ENV.map((key) => [key, process.env[key]]));
  process.env.SMTP_HOST = 'smtp.example.test';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user@example.test';
  process.env.SMTP_PASS = 'password';
  process.env.REPORTS_FROM_EMAIL = 'reports@example.test';

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const key of SMTP_ENV) {
        if (previous[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = previous[key];
        }
      }
    });
}

test('ReportMailerService disables Nodemailer file and URL access', async () => {
  await withSmtpEnv(async () => {
    const originalCreateTransport = nodemailer.createTransport;
    let transportOptions = null;

    nodemailer.createTransport = (options) => {
      transportOptions = options;
      return {
        async sendMail() {
          return { messageId: 'test-message' };
        },
      };
    };

    try {
      const service = new ReportMailerService();
      await service.send({
        to: 'recipient@example.test',
        subject: 'Report',
        text: 'Report body',
      });

      assert.equal(transportOptions.disableFileAccess, true);
      assert.equal(transportOptions.disableUrlAccess, true);
    } finally {
      nodemailer.createTransport = originalCreateTransport;
    }
  });
});
