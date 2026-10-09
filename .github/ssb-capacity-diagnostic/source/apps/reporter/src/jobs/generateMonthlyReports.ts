import { MailerService } from '../services/mailer.service.js';
import { ReportAggregatorService } from '../services/reportAggregator.service.js';
import { ReportRendererService } from '../services/reportRenderer.service.js';
import { reporterJob, reporterJson, reporterWork } from '../maintenance.js';
import { reporterCredential, reporterSiteIds } from '../services/reporter-credentials.js';

export async function generateMonthlyReports() {
  return reporterWork('worker', async () => {
  const aggregator = new ReportAggregatorService();
  const renderer = new ReportRendererService();
  const mailer = new MailerService();
  const subscriptions = await loadSubscriptions('monthly');

  for (const subscription of subscriptions) {
    const accepted = await reporterJob(async () => {
    const report = await aggregator.aggregate({
      frequency: 'monthly',
      siteId: subscription.siteId,
      recipientEmail: subscription.recipientEmail,
    });

    await mailer.send({
      to: report.recipientEmail,
      subject: `Monatsbericht ${report.siteName || report.siteId}`,
      html: renderer.renderHtml(report),
    });
    });
    if (!accepted) break;
  }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void generateMonthlyReports();
}

async function loadSubscriptions(frequency: 'weekly' | 'monthly') {
  const apiBase = (process.env.REPORTER_API_BASE_URL || process.env.BACKEND_BASE_URL || '').replace(/\/$/, '');
  const adminKey = reporterCredential();

  if (!apiBase || !adminKey) {
    throw new Error('REPORTER_API_BASE_URL/BACKEND_BASE_URL or reporter credential missing');
  }

  const items = (await Promise.all(reporterSiteIds().map(siteId => reporterJson<Array<{
    siteId: string; recipientEmail: string; frequency: string; isEnabled: boolean;
  }>>(`${apiBase}/admin/widget/report-subscriptions?siteId=${encodeURIComponent(siteId)}`, {
    headers: {
      'X-REPORTER-TOKEN': adminKey,
      Accept: 'application/json',
    },
  })))).flat();

  return items.filter((item) => item.isEnabled && item.frequency === frequency);
}
