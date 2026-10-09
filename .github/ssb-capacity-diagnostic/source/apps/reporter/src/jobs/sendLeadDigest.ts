import { MailerService } from '../services/mailer.service.js';
import { ReportRendererService } from '../services/reportRenderer.service.js';
import { reporterJob, reporterWork } from '../maintenance.js';

export async function sendLeadDigest() {
  return reporterWork('worker', async () => {
  const renderer = new ReportRendererService();
  const mailer = new MailerService();

  const digests = [
    { siteId: 'demo-site', recipientEmail: 'reports@example.com', leadCount: 0 },
  ];

  for (const digest of digests) {
    const accepted = await reporterJob(async () => {
    await mailer.send({
      to: digest.recipientEmail,
      subject: `Lead-Digest ${digest.siteId}`,
      text: renderer.renderLeadDigest(digest),
    });
    });
    if (!accepted) break;
  }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void sendLeadDigest();
}
