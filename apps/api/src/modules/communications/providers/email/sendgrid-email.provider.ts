import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email-provider.interface';
import { EmailSendParams, EmailSendResult } from '../types';

@Injectable()
export class SendgridEmailProvider implements EmailProvider {
  readonly name = 'sendgrid';
  private readonly logger = new Logger(SendgridEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      return { success: false, error: 'SENDGRID_API_KEY and EMAIL_FROM are required' };
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: from },
          subject: params.subject,
          content: [
            { type: 'text/plain', value: params.text },
            ...(params.html ? [{ type: 'text/html', value: params.html }] : []),
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return { success: false, error: `SendGrid ${res.status}: ${body}` };
      }

      const messageId = res.headers.get('x-message-id') ?? `sendgrid-${Date.now()}`;
      return { success: true, providerId: messageId, response: { status: res.status } };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'SendGrid send failed';
      this.logger.error(message);
      return { success: false, error: message };
    }
  }
}