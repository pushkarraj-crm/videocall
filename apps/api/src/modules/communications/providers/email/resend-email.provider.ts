import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider } from './email-provider.interface';
import { EmailSendParams, EmailSendResult } from '../types';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendEmailProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      return { success: false, error: 'RESEND_API_KEY and EMAIL_FROM are required' };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          text: params.text,
          html: params.html,
        }),
      });

      const json = (await res.json()) as { id?: string; message?: string };
      if (!res.ok) {
        return { success: false, error: json.message ?? `Resend ${res.status}`, response: json };
      }

      return {
        success: true,
        providerId: json.id,
        response: json as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resend send failed';
      this.logger.error(message);
      return { success: false, error: message };
    }
  }
}