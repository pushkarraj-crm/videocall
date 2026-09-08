import { Injectable } from '@nestjs/common';
import { CommunicationChannel, CommunicationEventType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { CommunicationsQueueService } from './communications-queue.service';
import { CommunicationsService } from './communications.service';
import { InternalEmailDto } from './dto/internal-email.dto';
import { InternalSmsDto } from './dto/internal-sms.dto';
import { TemplateEngineService } from './templates/template-engine.service';
import { APP_TITLE } from '../../common/utils/app-brand';
import { canSendEmail, canSendSms } from './utils/communication-settings.util';

@Injectable()
export class CommunicationsDispatcherService {
  constructor(
    private readonly settings: CommunicationsService,
    private readonly queue: CommunicationsQueueService,
    private readonly templates: TemplateEngineService,
  ) {}

  async sendEmail(dto: InternalEmailDto) {
    const prefs = dto.userId
      ? await this.settings.getSettingsForUser(dto.userId)
      : null;

    if (prefs && !canSendEmail(dto.eventType, prefs)) {
      return { queued: false, skipped: true, reason: 'user_preferences' };
    }

    const data = dto.templateData ?? {};
    const rendered = dto.body
      ? {
          subject: dto.subject ?? APP_TITLE,
          text: dto.body,
          html: dto.htmlBody,
          templateKey: 'custom',
        }
      : await this.templates.renderEmail(dto.eventType, data);

    const idempotencyKey =
      dto.idempotencyKey ??
      `${dto.eventType}:email:${dto.to}:${dto.referenceId ?? uuidv4()}`;

    return this.queue.enqueue({
      userId: dto.userId,
      channel: CommunicationChannel.email,
      eventType: dto.eventType,
      recipient: dto.to,
      subject: rendered.subject,
      body: rendered.text,
      htmlBody: rendered.html,
      templateKey: rendered.templateKey,
      templateId: rendered.templateId,
      templateData: data,
      idempotencyKey,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
    });
  }

  async sendSms(dto: InternalSmsDto) {
    const prefs = dto.userId
      ? await this.settings.getSettingsForUser(dto.userId)
      : null;

    if (prefs && !canSendSms(dto.eventType, prefs)) {
      return { queued: false, skipped: true, reason: 'user_preferences' };
    }

    const data = dto.templateData ?? {};
    const rendered = dto.body
      ? { text: dto.body, templateKey: 'custom' }
      : await this.templates.renderSms(dto.eventType, data);

    const idempotencyKey =
      dto.idempotencyKey ??
      `${dto.eventType}:sms:${dto.to}:${dto.referenceId ?? uuidv4()}`;

    return this.queue.enqueue({
      userId: dto.userId,
      channel: CommunicationChannel.sms,
      eventType: dto.eventType,
      recipient: dto.to,
      body: rendered.text,
      templateKey: rendered.templateKey,
      templateId: rendered.templateId,
      templateData: data,
      idempotencyKey,
      referenceId: dto.referenceId,
      referenceType: dto.referenceType,
    });
  }

  async enqueueWelcome(userId: string, email: string, name: string) {
    return this.sendEmail({
      userId,
      to: email,
      eventType: CommunicationEventType.welcome_email,
      templateData: { name },
      idempotencyKey: `welcome:${userId}`,
    });
  }

  async enqueueOtp(phone: string, code: string, expiresIn?: string) {
    return this.sendSms({
      to: phone,
      eventType: CommunicationEventType.otp_verification,
      templateData: { code, expiresIn: expiresIn ?? '10 min' },
      idempotencyKey: `otp:${phone}:${code}`,
    });
  }
}