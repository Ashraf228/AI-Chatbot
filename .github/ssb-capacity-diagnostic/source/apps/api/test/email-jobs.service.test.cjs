const test = require('node:test');
const assert = require('node:assert/strict');
const { EmailJobsService } = require('../dist/modules/widget/services/email-jobs.service.js');

test('EmailJobsService.enqueue stores queued email jobs', async () => {
  const dbCalls = [];
  const service = new EmailJobsService(
    {
      async query(sql, params) {
        dbCalls.push({ sql, params });
        return { rows: [] };
      },
    },
    {
      async send() {},
    },
  );

  service.processPendingJobs = async () => {};

  const result = await service.enqueue({
    kind: 'lead_notification',
    to: 'hello@soulesmartbusiness.com',
    subject: 'Neuer Lead',
    html: '<p>Test</p>',
    text: 'Test',
    metadata: { siteId: 'site-1' },
  });

  assert.ok(result.id);
  assert.equal(result.queued, true);
  assert.equal(dbCalls.length, 1);
  assert.match(dbCalls[0].sql, /INSERT INTO email_jobs/i);
  assert.equal(dbCalls[0].params[1], 'lead_notification');
});

test('EmailJobsService retries failed jobs and eventually marks report runs as failed', async () => {
  const updates = [];
  let pickCount = 0;

  const service = new EmailJobsService(
    {
      async query(sql, params) {
        if (/WITH next_job AS/i.test(sql)) {
          pickCount += 1;
          if (pickCount === 1) {
            return {
              rows: [
                {
                  id: 'job-1',
                  kind: 'report',
                  recipient_email: 'hello@soulesmartbusiness.com',
                  subject: 'Weekly report',
                  html: '<p>Report</p>',
                  text: 'Report',
                  metadata: { reportRunId: 'run-1' },
                  retry_count: 4,
                  max_attempts: 5,
                },
              ],
            };
          }

          return { rows: [] };
        }

        if (/UPDATE email_jobs/i.test(sql) || /UPDATE report_runs/i.test(sql)) {
          updates.push({ sql, params });
        }

        return { rows: [] };
      },
    },
    {
      async send() {
        throw new Error('SMTP unavailable');
      },
    },
  );

  await service.processPendingJobs();

  assert.equal(updates.length, 2);
  assert.match(updates[0].sql, /UPDATE email_jobs/i);
  assert.equal(updates[0].params[1], 'failed');
  assert.match(updates[1].sql, /UPDATE report_runs/i);
  assert.equal(updates[1].params[0], 'run-1');
});
