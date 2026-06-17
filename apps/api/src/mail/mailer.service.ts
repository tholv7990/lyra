import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Email transport. Sends over SMTP when SMTP_HOST is configured (nodemailer);
// otherwise falls back to logging the message to the server console (dev stub),
// so the password-reset flow still works without an account. A send failure
// also logs the body so the link is never lost in dev.
@Injectable()
export class MailerService {
  private readonly logger = new Logger('Mailer');
  private readonly transport: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('MAIL_FROM') ?? 'Lyra <no-reply@lyra.local>';
    if (host) {
      const user = config.get<string>('SMTP_USER');
      this.transport = nodemailer.createTransport({
        host,
        port: Number(config.get<string>('SMTP_PORT') ?? 587),
        secure: config.get<string>('SMTP_SECURE') === 'true', // true for port 465
        auth: user ? { user, pass: config.get<string>('SMTP_PASS') } : undefined,
      });
      this.logger.log(`SMTP configured — sending mail via ${host}`);
    } else {
      this.transport = null;
      this.logger.log('No SMTP_HOST — emails are logged to the console (dev stub).');
    }
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    if (!this.transport) {
      this.logger.log(`✉  to=${to} · ${subject}\n${body}`);
      return;
    }
    try {
      await this.transport.sendMail({ from: this.from, to, subject, text: body });
    } catch (err) {
      this.logger.error(`Failed to send "${subject}" to ${to}: ${(err as Error).message}`);
      this.logger.log(`✉  (not sent — logged) to=${to} · ${subject}\n${body}`);
    }
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.send(
      to,
      'Reset your Lyra password',
      `Reset your password using this link (valid for 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    );
  }

  async sendPasswordChanged(to: string): Promise<void> {
    await this.send(
      to,
      'Your Lyra password was changed',
      'Your password was just changed. If this wasn\'t you, reset it immediately and contact support.',
    );
  }
}
