import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';
import { SmsSendParams, SmsSendResult } from '../types';

@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';
  private readonly logger = new Logger(Msg91SmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const sender = this.config.get<string>('MSG91_SENDER_ID');
    const route = this.config.get<string>('MSG91_ROUTE') ?? '4';

    if (!authKey || !sender) {
      return { success: false, error: 'MSG91_AUTH_KEY and MSG91_SENDER_ID are required' };
    }

    const mobile = params.to.replace(/\D/g, '').replace(/^91/, '');

    try {
      const res = await fetch('https://control.msg91.com/api/sendhttp.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          authkey: authKey,
          mobiles: mobile,
          message: params.body,
          sender,
          route,
          country: '91',
        }),
      });

      const text = await res.text();
      if (!res.ok || text.toLowerCase().includes('error')) {
        return { success: false, error: text || `MSG91 ${res.status}`, response: { body: text } };
      }

      return {
        success: true,
        providerId: text.trim(),
        response: { body: text },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'MSG91 send failed';
      this.logger.error(message);
      return { success: false, error: message };
    }
  }
}