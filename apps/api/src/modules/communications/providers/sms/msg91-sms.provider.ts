import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsProvider } from './sms-provider.interface';
import { SmsSendParams, SmsSendResult } from '../types';

@Injectable()
export class Msg91SmsProvider implements SmsProvider {
  readonly name = 'msg91';
  private readonly logger = new Logger(Msg91SmsProvider.name);

  constructor(private readonly config: ConfigService) {}

  // Authentication codes use an approved MSG91 SMS Flow template. The backend
  // owns OTP verification; MSG91 only delivers the random code.
  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const authKey = this.config.get<string>('MSG91_AUTH_KEY');
    const template = this.config.get<string>('MSG91_OTP_TEMPLATE_ID');
    const variable = this.config.get<string>('MSG91_OTP_VARIABLE', 'OTP');
    if (!authKey || !template) return { success: false, error: 'MSG91 OTP credentials are missing' };
    try {
      const res = await fetch('https://control.msg91.com/api/v5/flow', {
        method: 'POST', signal: AbortSignal.timeout(10000),
        headers: { authkey: authKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ template_id: template, short_url: '0',
          recipients: [{ mobiles: phone.replace(/\D/g, ''), [variable]: code }] }),
      });
      const result = await res.json() as { type?: string; message?: string; request_id?: string };
      if (!res.ok || result.type !== 'success') return { success: false, error: 'MSG91 rejected the OTP request' };
      return { success: true, providerId: result.request_id ?? result.message };
    } catch { return { success: false, error: 'MSG91 OTP delivery failed' }; }
  }

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
