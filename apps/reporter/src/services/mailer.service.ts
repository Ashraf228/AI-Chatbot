import nodemailer from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export class MailerService {
  async send(message: MailMessage) {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.REPORTS_FROM_EMAIL || user || 'reports@localhost';

    if (!host || !user || !pass) {
      console.log('[reporter] SMTP not configured, skipping real send', {
        to: message.to,
        subject: message.subject,
      });
      return { ok: false, skipped: true };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      disableFileAccess: true,
      disableUrlAccess: true,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    return { ok: true };
  }
}
