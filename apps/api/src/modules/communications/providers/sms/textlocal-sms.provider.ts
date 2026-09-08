import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';
import { SmsSendParams, SmsSendResult } from '../types';

@Injectable()
export class TextlocalSmsProvider implements SmsProvider {
  readonly name = 'textlocal';
  private readonly logger = new Logger(TextlocalSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const apiKey = this.config.get<string>('TEXTLOCAL_API_KEY');
    const sender = this.config.get<string>('TEXTLOCAL_SENDER');

    if (!apiKey || !sender) {
      return { success: false, error: 'TEXTLOCAL_API_KEY and TEXTLOCAL_SENDER are required' };
    }

    const numbers = params.to.replace(/\D/g, '');

    try {
      const body = new URLSearchParams({
        apikey: apiKey,
        numbers,
        message: params.body,
        sender,
      });

      const res = await fetch('https://api.textlocal.in/send/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      const json = (await res.json()) as {
        status?: string;
        errors?: Array<{ message: string }>;
        batch_id?: number;
      };

      if (!res.ok || json.status !== 'success') {
        const errMsg = json.errors?.[0]?.message ?? `Textlocal ${res.status}`;
        return { success: false, error: errMsg, response: json as Record<string, unknown> };
      }

      return {
        success: true,
        providerId: json.batch_id ? String(json.batch_id) : undefined,
        response: json as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Textlocal send failed';
      this.logger.error(message);
      return { success: false, error: message };
    }
  }
}