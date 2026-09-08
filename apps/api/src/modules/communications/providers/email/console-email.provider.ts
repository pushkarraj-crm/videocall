import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './email-provider.interface';
import { EmailSendParams, EmailSendResult } from '../types';

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger = new Logger(ConsoleEmailProvider.name);

  async send(params: EmailSendParams): Promise<EmailSendResult> {
    this.logger.log(`[EMAIL] to=${params.to} subject="${params.subject}"`);
    return {
      success: true,
      providerId: `console-${Date.now()}`,
      response: { mode: 'console' },
    };
  }
}