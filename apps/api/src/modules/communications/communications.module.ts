import { Module } from '@nestjs/common';
import { AdminCommunicationsController } from './admin-communications.controller';
import { AdminOutboundController } from './admin-outbound.controller';
import { CommunicationEventProcessorService } from './communication-event-processor.service';
import { CommunicationsAdminService } from './communications-admin.service';
import { CommunicationsDispatcherService } from './communications-dispatcher.service';
import { CommunicationsQueueService } from './communications-queue.service';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { InternalCommunicationsController } from './internal-communications.controller';
import { ConsoleEmailProvider } from './providers/email/console-email.provider';
import { ResendEmailProvider } from './providers/email/resend-email.provider';
import { SendgridEmailProvider } from './providers/email/sendgrid-email.provider';
import { SmtpEmailProvider } from './providers/email/smtp-email.provider';
import { CommunicationProviderFactory } from './providers/provider.factory';
import { ConsoleSmsProvider } from './providers/sms/console-sms.provider';
import { Msg91SmsProvider } from './providers/sms/msg91-sms.provider';
import { TextlocalSmsProvider } from './providers/sms/textlocal-sms.provider';
import { TwilioSmsProvider } from './providers/sms/twilio-sms.provider';
import { TemplateEngineService } from './templates/template-engine.service';

@Module({
  controllers: [
    CommunicationsController,
    AdminCommunicationsController,
    AdminOutboundController,
    InternalCommunicationsController,
  ],
  providers: [
    CommunicationsService,
    CommunicationsQueueService,
    CommunicationsDispatcherService,
    CommunicationsAdminService,
    CommunicationEventProcessorService,
    TemplateEngineService,
    CommunicationProviderFactory,
    ConsoleEmailProvider,
    SmtpEmailProvider,
    SendgridEmailProvider,
    ResendEmailProvider,
    ConsoleSmsProvider,
    TwilioSmsProvider,
    Msg91SmsProvider,
    TextlocalSmsProvider,
  ],
  exports: [
    CommunicationsService,
    CommunicationsQueueService,
    CommunicationsDispatcherService,
    CommunicationsAdminService,
    CommunicationEventProcessorService,
    TemplateEngineService,
  ],
})
export class CommunicationsModule {}