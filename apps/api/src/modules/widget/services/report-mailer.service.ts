import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import nodemailer from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

@Injectable()
export class ReportMailerService {
  private getConfig() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.REPORTS_FROM_EMAIL || user || '';

    return { host, port, user, pass, from };
  }

  isConfigured() {
    const { host, user, pass, from } = this.getConfig();
    return Boolean(host && user && pass && from);
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'SMTP is not fully configured. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and REPORTS_FROM_EMAIL.',
      );
    }
  }

  async send(message: MailMessage) {
    const { host, port, user, pass, from } = this.getConfig();
    this.assertConfigured();

    try {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      throw new InternalServerErrorException(`SMTP send failed: ${message}`);
    }
  }
}
