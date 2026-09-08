import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';
import { SmsSendParams, SmsSendResult } from '../types';

@Injectable()
export class TwilioSmsProvider implements SmsProvider {
  readonly name = 'twilio';
  private readonly logger = new Logger(TwilioSmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const from = this.config.get<string>('TWILIO_FROM_NUMBER');

    if (!sid || !token || !from) {
      return { success: false, error: 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER required' };
    }

    try {
      const body = new URLSearchParams({
        To: params.to,
        From: from,
        Body: params.body,
      });

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      const json = (await res.json()) as { sid?: string; message?: string; status?: string };
      if (!res.ok) {
        return { success: false, error: json.message ?? `Twilio ${res.status}`, response: json };
      }

      return {
        success: true,
        providerId: json.sid,
        response: json as Record<string, unknown>,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Twilio send failed';
      this.logger.error(message);
      return { success: false, error: message };
    }
  }
}