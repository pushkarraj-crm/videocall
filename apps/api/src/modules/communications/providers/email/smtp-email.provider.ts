import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email-provider.interface';
import { EmailSendParams, EmailSendResult } from '../types';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private readonly logger = new Logger(SmtpEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const from = this.config.get<string>('EMAIL_FROM');

    if (!host || !from) {
      return { success: false, error: 'SMTP_HOST and EMAIL_FROM are required' };
    }

    try {
      const nodemailer = await import('nodemailer');
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });

      const info = await transport.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      });

      return {
        success: true,
        providerId: info.messageId,
        response: { accepted: info.accepted, rejected: info.rejected },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SMTP send failed';
      this.logger.error(message);
      return { success: false, error: message };
    }
  }
}