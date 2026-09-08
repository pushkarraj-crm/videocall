import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider } from './sms-provider.interface';
import { SmsSendParams, SmsSendResult } from '../types';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(params: SmsSendParams): Promise<SmsSendResult> {
    this.logger.log(`[SMS] to=${params.to} body="${params.body.slice(0, 80)}"`);
    return {
      success: true,
      providerId: `console-sms-${Date.now()}`,
      response: { mode: 'console' },
    };
  }
}