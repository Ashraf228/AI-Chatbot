import { MailerService } from '../services/mailer.service';
import { ReportRendererService } from '../services/reportRenderer.service';

export async function sendLeadDigest() {
  const renderer = new ReportRendererService();
  const mailer = new MailerService();

  const digests = [
    { siteId: 'demo-site', recipientEmail: 'reports@example.com', leadCount: 0 },
  ];

  for (const digest of digests) {
    await mailer.send({
      to: digest.recipientEmail,
      subject: `Lead-Digest ${digest.siteId}`,
      text: renderer.renderLeadDigest(digest),
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void sendLeadDigest();
}
