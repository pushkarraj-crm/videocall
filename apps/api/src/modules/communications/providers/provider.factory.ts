import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleEmailProvider } from './email/console-email.provider';
import { EmailProvider } from './email/email-provider.interface';
import { ResendEmailProvider } from './email/resend-email.provider';
import { SendgridEmailProvider } from './email/sendgrid-email.provider';
import { SmtpEmailProvider } from './email/smtp-email.provider';
import { ConsoleSmsProvider } from './sms/console-sms.provider';
import { Msg91SmsProvider } from './sms/msg91-sms.provider';
import { SmsProvider } from './sms/sms-provider.interface';
import { TextlocalSmsProvider } from './sms/textlocal-sms.provider';
import { TwilioSmsProvider } from './sms/twilio-sms.provider';
import { EmailSendParams, EmailSendResult, SmsSendParams, SmsSendResult } from './types';

@Injectable()
export class CommunicationProviderFactory {
  private readonly logger = new Logger(CommunicationProviderFactory.name);
  private emailProvider?: EmailProvider;
  private emailFallback?: EmailProvider;
  private smsProvider?: SmsProvider;
  private smsFallback?: SmsProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly consoleEmail: ConsoleEmailProvider,
    private readonly smtpEmail: SmtpEmailProvider,
    private readonly sendgridEmail: SendgridEmailProvider,
    private readonly resendEmail: ResendEmailProvider,
    private readonly consoleSms: ConsoleSmsProvider,
    private readonly twilioSms: TwilioSmsProvider,
    private readonly msg91Sms: Msg91SmsProvider,
    private readonly textlocalSms: TextlocalSmsProvider,
  ) {}

  getEmailProvider(): EmailProvider {
    if (!this.emailProvider) {
      const name = (this.config.get<string>('EMAIL_PROVIDER') ?? 'console').toLowerCase();
      this.emailProvider = this.resolveEmailProvider(name) ?? this.consoleEmail;
    }
    return this.emailProvider;
  }

  getSmsProvider(): SmsProvider {
    if (!this.smsProvider) {
      const name = (this.config.get<string>('SMS_PROVIDER') ?? 'console').toLowerCase();
      this.smsProvider = this.resolveSmsProvider(name) ?? this.consoleSms;
    }
    return this.smsProvider;
  }

  async sendEmail(params: EmailSendParams): Promise<EmailSendResult & { provider: string }> {
    const primary = this.getEmailProvider();
    let result = await primary.send(params);
    let provider = primary.name;

    if (!result.success) {
      const fallbackName = this.config.get<string>('EMAIL_PROVIDER_FALLBACK');
      const fallback = fallbackName ? this.resolveEmailProvider(fallbackName.toLowerCase()) : undefined;
      if (fallback && fallback.name !== primary.name) {
        this.logger.warn(`Email failover: ${primary.name} -> ${fallback.name}`);
        result = await fallback.send(params);
        provider = fallback.name;
      }
    }

    return { ...result, provider };
  }

  async sendSms(params: SmsSendParams): Promise<SmsSendResult & { provider: string }> {
    const primary = this.getSmsProvider();
    let result = await primary.send(params);
    let provider = primary.name;

    if (!result.success) {
      const fallbackName = this.config.get<string>('SMS_PROVIDER_FALLBACK');
      const fallback = fallbackName ? this.resolveSmsProvider(fallbackName.toLowerCase()) : undefined;
      if (fallback && fallback.name !== primary.name) {
        this.logger.warn(`SMS failover: ${primary.name} -> ${fallback.name}`);
        result = await fallback.send(params);
        provider = fallback.name;
      }
    }

    return { ...result, provider };
  }

  private resolveEmailProvider(name: string): EmailProvider | undefined {
    switch (name) {
      case 'smtp':
        return this.smtpEmail;
      case 'sendgrid':
        return this.sendgridEmail;
      case 'resend':
        return this.resendEmail;
      case 'console':
        return this.consoleEmail;
      default:
        return undefined;
    }
  }

  private resolveSmsProvider(name: string): SmsProvider | undefined {
    switch (name) {
      case 'twilio':
        return this.twilioSms;
      case 'msg91':
        return this.msg91Sms;
      case 'textlocal':
        return this.textlocalSms;
      case 'console':
        return this.consoleSms;
      default:
        return undefined;
    }
  }
}