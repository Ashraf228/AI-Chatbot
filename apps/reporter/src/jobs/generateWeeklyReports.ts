import { MailerService } from '../services/mailer.service';
import { ReportAggregatorService } from '../services/reportAggregator.service';
import { ReportRendererService } from '../services/reportRenderer.service';

export async function generateWeeklyReports() {
  const aggregator = new ReportAggregatorService();
  const renderer = new ReportRendererService();
  const mailer = new MailerService();
  const subscriptions = await loadSubscriptions('weekly');

  for (const subscription of subscriptions) {
    const report = await aggregator.aggregate({
      frequency: 'weekly',
      siteId: subscription.siteId,
      recipientEmail: subscription.recipientEmail,
    });

    await mailer.send({
      to: report.recipientEmail,
      subject: `Wochenbericht ${report.siteName || report.siteId}`,
      html: renderer.renderHtml(report),
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void generateWeeklyReports();
}

async function loadSubscriptions(frequency: 'weekly' | 'monthly') {
  const apiBase = (process.env.REPORTER_API_BASE_URL || process.env.BACKEND_BASE_URL || '').replace(/\/$/, '');
  const adminKey = process.env.ADMIN_KEY || '';

  if (!apiBase || !adminKey) {
    throw new Error('REPORTER_API_BASE_URL/BACKEND_BASE_URL or ADMIN_KEY missing');
  }

  const res = await fetch(`${apiBase}/admin/widget/report-subscriptions`, {
    headers: {
      'X-ADMIN-KEY': adminKey,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to load report subscriptions: ${res.status}`);
  }

  const items = (await res.json()) as Array<{
    siteId: string;
    recipientEmail: string;
    frequency: string;
    isEnabled: boolean;
  }>;

  return items.filter((item) => item.isEnabled && item.frequency === frequency);
}
