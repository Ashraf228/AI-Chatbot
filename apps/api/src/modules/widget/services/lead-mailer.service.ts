import { Injectable } from '@nestjs/common';
import { MailMessage, ReportMailerService } from './report-mailer.service';

type LeadNotificationPayload = {
  recipientEmail: string;
  siteId: string;
  siteName: string;
  submittedAt: string;
  source?: string;
  scheduleIntent?: boolean;
  dashboardUrl?: string;
  lead: {
    name: string;
    email: string;
    phone?: string | null;
    message?: string | null;
  };
};

@Injectable()
export class LeadMailerService {
  constructor(private readonly mailer: ReportMailerService) {}

  buildLeadNotification(payload: LeadNotificationPayload): MailMessage {
    const subject = `Neue Anfrage über den Chatbot – ${payload.siteName || payload.siteId}`;

    return {
      to: payload.recipientEmail,
      subject,
      html: this.renderHtml(payload),
      text: this.renderText(payload),
    };
  }

  async sendLeadNotification(payload: LeadNotificationPayload) {
    await this.mailer.send(this.buildLeadNotification(payload));
  }

  private renderHtml(payload: LeadNotificationPayload) {
    return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>Neuer Lead</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #1b1f23; line-height: 1.5;">
    <h1>Neuer Lead eingegangen</h1>
    <p><strong>Site:</strong> ${escapeHtml(payload.siteName || payload.siteId)}</p>
    <p><strong>Zeitpunkt:</strong> ${escapeHtml(payload.submittedAt)}</p>
    <p><strong>Quelle:</strong> ${escapeHtml(payload.source || 'Widget Chat')}</p>
    <p><strong>Terminabsicht:</strong> ${payload.scheduleIntent ? 'Ja' : 'Nein'}</p>
    <h2>Kontaktdaten</h2>
    <ul>
      <li><strong>Name:</strong> ${escapeHtml(payload.lead.name)}</li>
      <li><strong>E-Mail:</strong> ${escapeHtml(payload.lead.email || '-')}</li>
      <li><strong>Telefon:</strong> ${escapeHtml(payload.lead.phone || '-')}</li>
    </ul>
    <h2>Anliegen</h2>
    <p>${escapeHtml(payload.lead.message || '-')}</p>
    ${
      payload.dashboardUrl
        ? `<p><a href="${escapeHtml(payload.dashboardUrl)}">Im Dashboard öffnen</a></p>`
        : ''
    }
  </body>
</html>`;
  }

  private renderText(payload: LeadNotificationPayload) {
    return [
      `Neue Anfrage über den Chatbot – ${payload.siteName || payload.siteId}`,
      `Zeitpunkt: ${payload.submittedAt}`,
      `Quelle: ${payload.source || 'Widget Chat'}`,
      `Terminabsicht: ${payload.scheduleIntent ? 'Ja' : 'Nein'}`,
      '',
      'Kontaktdaten:',
      `- Name: ${payload.lead.name}`,
      `- E-Mail: ${payload.lead.email || '-'}`,
      `- Telefon: ${payload.lead.phone || '-'}`,
      '',
      'Anliegen:',
      payload.lead.message || '-',
      payload.dashboardUrl ? `Dashboard: ${payload.dashboardUrl}` : '',
    ].join('\n');
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
