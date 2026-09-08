import { BadRequestException, Injectable } from '@nestjs/common';
import { CommunicationChannel, CommunicationEventType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { renderEmailLayout } from './email/base-layout';
import { kycEmailTemplate } from './email/kyc';
import { passwordResetTemplate } from './email/password-reset';
import { promotionEmailTemplate } from './email/promotion';
import { rechargeReceiptTemplate } from './email/recharge-receipt';
import { referralEmailTemplate } from './email/referral';
import { securityAlertTemplate } from './email/security-alert';
import { welcomeEmailTemplate } from './email/welcome';
import { withdrawalEmailTemplate } from './email/withdrawal';
import { kycStatusSmsTemplate } from './sms/kyc-status';
import { otpSmsTemplate } from './sms/otp';
import { rechargeSuccessSmsTemplate } from './sms/recharge-success';
import { securityAlertSmsTemplate } from './sms/security-alert';
import { withdrawalUpdateSmsTemplate } from './sms/withdrawal-update';
import { smsPrefix } from '../../../common/utils/app-brand';
import { interpolatePlaceholders } from '../utils/placeholders';

export interface RenderedTemplate {
  subject?: string;
  text: string;
  html?: string;
  templateKey: string;
  templateId?: string;
}

const ALLOWED_KEYS = new Set([
  'welcome',
  'recharge_receipt',
  'withdrawal',
  'kyc',
  'referral',
  'promotion',
  'password_reset',
  'security_alert',
  'otp',
  'recharge_success',
  'withdrawal_update',
  'kyc_status',
  'security_alert_sms',
  'custom',
]);

@Injectable()
export class TemplateEngineService {
  constructor(private readonly prisma: PrismaService) {}

  validateTemplateKey(key: string) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new BadRequestException(`Unknown template key: ${key}`);
    }
  }

  async renderEmail(
    eventType: CommunicationEventType,
    data: Record<string, string>,
  ): Promise<RenderedTemplate> {
    const code = this.renderEmailCode(eventType, data);
    const db = await this.prisma.communicationTemplate.findFirst({
      where: {
        type: code.templateKey,
        channel: CommunicationChannel.email,
        isActive: true,
      },
    });

    if (!db) return code;

    const subject = db.subject
      ? interpolatePlaceholders(db.subject, data)
      : code.subject;
    const text = interpolatePlaceholders(db.body, data);
    const html = db.htmlBody
      ? interpolatePlaceholders(db.htmlBody, data)
      : renderEmailLayout({
          title: db.title,
          bodyHtml: `<p>${text.replace(/\n/g, '<br/>')}</p>`,
        });

    return {
      subject: subject ?? code.subject,
      text,
      html,
      templateKey: db.type,
      templateId: db.id,
    };
  }

  async renderSms(
    eventType: CommunicationEventType,
    data: Record<string, string>,
  ): Promise<RenderedTemplate> {
    const code = this.renderSmsCode(eventType, data);
    const db = await this.prisma.communicationTemplate.findFirst({
      where: {
        type: code.templateKey,
        channel: CommunicationChannel.sms,
        isActive: true,
      },
    });

    if (!db) return code;

    return {
      text: interpolatePlaceholders(db.body, data),
      templateKey: db.type,
      templateId: db.id,
    };
  }

  private renderEmailCode(
    eventType: CommunicationEventType,
    data: Record<string, string>,
  ): RenderedTemplate {
    switch (eventType) {
      case CommunicationEventType.welcome_email:
      case CommunicationEventType.signup_success:
      case CommunicationEventType.google_login_welcome: {
        const t = welcomeEmailTemplate({ name: data.name ?? 'there', appUrl: data.appUrl });
        return { ...t, templateKey: 'welcome' };
      }
      case CommunicationEventType.recharge_success:
      case CommunicationEventType.receipt:
      case CommunicationEventType.invoice: {
        const t = rechargeReceiptTemplate({
          name: data.name ?? 'there',
          amountInr: data.amountInr ?? data.amount ?? '0',
          coins: data.coins ?? '0',
          invoiceNumber: data.invoiceNumber ?? data.transactionId,
          paidAt: data.paidAt ?? data.date,
        });
        return { ...t, templateKey: 'recharge_receipt' };
      }
      case CommunicationEventType.withdrawal_submitted:
      case CommunicationEventType.withdrawal_approved:
      case CommunicationEventType.withdrawal_rejected:
      case CommunicationEventType.withdrawal_paid: {
        const t = withdrawalEmailTemplate({
          name: data.name ?? 'there',
          status: data.status ?? eventType.replace('withdrawal_', ''),
          amountInr: data.amountInr ?? data.amount ?? '0',
          note: data.note,
        });
        return { ...t, templateKey: 'withdrawal' };
      }
      case CommunicationEventType.kyc_submitted:
      case CommunicationEventType.kyc_approved:
      case CommunicationEventType.kyc_rejected: {
        const t = kycEmailTemplate({
          name: data.name ?? 'there',
          status: data.status ?? eventType.replace('kyc_', ''),
          reason: data.reason,
        });
        return { ...t, templateKey: 'kyc' };
      }
      case CommunicationEventType.referral_reward:
      case CommunicationEventType.friend_joined: {
        const t = referralEmailTemplate({
          name: data.name ?? 'there',
          event: eventType === CommunicationEventType.referral_reward ? 'reward' : 'friend_joined',
          friendName: data.friendName,
          coins: data.coins ?? data.coupon,
        });
        return { ...t, templateKey: 'referral' };
      }
      case CommunicationEventType.coupon_available:
      case CommunicationEventType.coupon_expiry:
      case CommunicationEventType.festival_offer:
      case CommunicationEventType.admin_announcement:
      case CommunicationEventType.maintenance:
      case CommunicationEventType.feature_release:
      case CommunicationEventType.admin_custom: {
        const t = promotionEmailTemplate({
          name: data.name ?? 'there',
          title: data.title ?? 'Special Offer',
          message: data.message ?? data.body ?? '',
          ctaLabel: data.ctaLabel,
          ctaUrl: data.ctaUrl,
        });
        return { ...t, templateKey: 'promotion' };
      }
      case CommunicationEventType.password_reset: {
        const t = passwordResetTemplate({
          name: data.name ?? 'there',
          resetUrl: data.resetUrl ?? 'https://platform.app/reset',
          expiresIn: data.expiresIn,
        });
        return { ...t, templateKey: 'password_reset' };
      }
      case CommunicationEventType.login_new_device:
      case CommunicationEventType.security_alert: {
        const t = securityAlertTemplate({
          name: data.name ?? 'there',
          alert: data.alert ?? 'Unusual activity detected on your account.',
          device: data.device,
          location: data.location,
          time: data.time ?? data.date,
        });
        return { ...t, templateKey: 'security_alert' };
      }
      default:
        throw new BadRequestException(`No email template for event: ${eventType}`);
    }
  }

  private renderSmsCode(
    eventType: CommunicationEventType,
    data: Record<string, string>,
  ): RenderedTemplate {
    switch (eventType) {
      case CommunicationEventType.otp_verification: {
        const text = otpSmsTemplate({ code: data.code ?? '000000', expiresIn: data.expiresIn });
        return { text, templateKey: 'otp' };
      }
      case CommunicationEventType.recharge_success: {
        const text = rechargeSuccessSmsTemplate({
          amountInr: data.amountInr ?? data.amount ?? '0',
          coins: data.coins ?? '0',
        });
        return { text, templateKey: 'recharge_success' };
      }
      case CommunicationEventType.withdrawal_submitted:
      case CommunicationEventType.withdrawal_approved:
      case CommunicationEventType.withdrawal_rejected:
      case CommunicationEventType.withdrawal_paid: {
        const text = withdrawalUpdateSmsTemplate({
          status: data.status ?? eventType.replace('withdrawal_', ''),
          amountInr: data.amountInr ?? data.amount ?? '0',
        });
        return { text, templateKey: 'withdrawal_update' };
      }
      case CommunicationEventType.kyc_submitted:
      case CommunicationEventType.kyc_approved:
      case CommunicationEventType.kyc_rejected: {
        const text = kycStatusSmsTemplate({ status: data.status ?? eventType.replace('kyc_', '') });
        return { text, templateKey: 'kyc_status' };
      }
      case CommunicationEventType.referral_reward: {
        const text = `${smsPrefix()}Referral reward earned! {{coins}} coins credited.`.replace(
          '{{coins}}',
          data.coins ?? 'bonus',
        );
        return { text, templateKey: 'referral_reward_sms' };
      }
      case CommunicationEventType.login_new_device:
      case CommunicationEventType.security_alert: {
        const text = securityAlertSmsTemplate({
          alert: data.alert ?? 'Unusual login detected.',
        });
        return { text, templateKey: 'security_alert_sms' };
      }
      default:
        throw new BadRequestException(`No SMS template for event: ${eventType}`);
    }
  }

  preview(templateKey: string, channel: 'email' | 'sms', data: Record<string, string>) {
    this.validateTemplateKey(templateKey);
    const emailEvents: Record<string, CommunicationEventType> = {
      welcome: CommunicationEventType.welcome_email,
      recharge_receipt: CommunicationEventType.receipt,
      withdrawal: CommunicationEventType.withdrawal_approved,
      kyc: CommunicationEventType.kyc_approved,
      referral: CommunicationEventType.referral_reward,
      promotion: CommunicationEventType.coupon_available,
      password_reset: CommunicationEventType.password_reset,
      security_alert: CommunicationEventType.security_alert,
    };
    const smsEvents: Record<string, CommunicationEventType> = {
      otp: CommunicationEventType.otp_verification,
      recharge_success: CommunicationEventType.recharge_success,
      withdrawal_update: CommunicationEventType.withdrawal_paid,
      kyc_status: CommunicationEventType.kyc_approved,
      security_alert_sms: CommunicationEventType.security_alert,
    };

    if (channel === 'email') {
      return this.renderEmailCode(emailEvents[templateKey] ?? CommunicationEventType.welcome_email, data);
    }
    return this.renderSmsCode(smsEvents[templateKey] ?? CommunicationEventType.otp_verification, data);
  }
}