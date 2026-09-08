import { CommunicationEventType } from '@prisma/client';

export interface CommunicationSettingsView {
  marketingEmails: boolean;
  marketingSms: boolean;
  transactionalEmails: boolean;
  transactionalSms: boolean;
  securityEmails: boolean;
  securitySms: boolean;
  promotionEmails: boolean;
  promotionSms: boolean;
  referralUpdates: boolean;
}

const SECURITY_EVENTS = new Set<CommunicationEventType>([
  CommunicationEventType.otp_verification,
  CommunicationEventType.password_reset,
  CommunicationEventType.login_new_device,
  CommunicationEventType.security_alert,
]);

const MARKETING_EVENTS = new Set<CommunicationEventType>([
  CommunicationEventType.welcome_email,
  CommunicationEventType.signup_success,
  CommunicationEventType.google_login_welcome,
]);

const PROMOTION_EVENTS = new Set<CommunicationEventType>([
  CommunicationEventType.coupon_available,
  CommunicationEventType.coupon_expiry,
  CommunicationEventType.festival_offer,
  CommunicationEventType.admin_announcement,
  CommunicationEventType.maintenance,
  CommunicationEventType.feature_release,
  CommunicationEventType.admin_custom,
]);

const REFERRAL_EVENTS = new Set<CommunicationEventType>([
  CommunicationEventType.referral_reward,
  CommunicationEventType.friend_joined,
]);

const TRANSACTIONAL_EVENTS = new Set<CommunicationEventType>([
  CommunicationEventType.recharge_success,
  CommunicationEventType.recharge_failed,
  CommunicationEventType.receipt,
  CommunicationEventType.invoice,
  CommunicationEventType.kyc_submitted,
  CommunicationEventType.kyc_approved,
  CommunicationEventType.kyc_rejected,
  CommunicationEventType.withdrawal_submitted,
  CommunicationEventType.withdrawal_approved,
  CommunicationEventType.withdrawal_rejected,
  CommunicationEventType.withdrawal_paid,
  CommunicationEventType.missed_call_summary,
  CommunicationEventType.monthly_call_summary,
]);

export function defaultCommunicationSettings(): CommunicationSettingsView {
  return {
    marketingEmails: true,
    marketingSms: true,
    transactionalEmails: true,
    transactionalSms: true,
    securityEmails: true,
    securitySms: true,
    promotionEmails: true,
    promotionSms: true,
    referralUpdates: true,
  };
}

export function serializeCommunicationSettings(row: {
  marketingEmails: boolean;
  transactionalEmails: boolean;
  marketingSms?: boolean;
  transactionalSms?: boolean;
  sms?: boolean;
  promotionEmails: boolean;
  promotionSms: boolean;
  referralUpdates: boolean;
}): CommunicationSettingsView {
  const transactionalSms = row.transactionalSms ?? row.sms ?? true;
  const marketingSms = row.marketingSms ?? row.sms ?? true;
  return {
    marketingEmails: row.marketingEmails,
    marketingSms,
    transactionalEmails: row.transactionalEmails,
    transactionalSms,
    securityEmails: true,
    securitySms: true,
    promotionEmails: row.promotionEmails,
    promotionSms: row.promotionSms,
    referralUpdates: row.referralUpdates,
  };
}

export function settingsWritePayload(dto: Partial<CommunicationSettingsView>) {
  const data: Record<string, boolean> = {};
  if (dto.marketingEmails !== undefined) data.marketingEmails = dto.marketingEmails;
  if (dto.transactionalEmails !== undefined) data.transactionalEmails = dto.transactionalEmails;
  if (dto.marketingSms !== undefined) {
    data.marketingSms = dto.marketingSms;
    data.sms = dto.marketingSms;
  }
  if (dto.transactionalSms !== undefined) {
    data.transactionalSms = dto.transactionalSms;
    data.sms = dto.transactionalSms;
  }
  if (dto.promotionEmails !== undefined) data.promotionEmails = dto.promotionEmails;
  if (dto.promotionSms !== undefined) data.promotionSms = dto.promotionSms;
  if (dto.referralUpdates !== undefined) data.referralUpdates = dto.referralUpdates;
  return data;
}

export function canSendEmail(
  eventType: CommunicationEventType,
  settings: CommunicationSettingsView,
): boolean {
  if (SECURITY_EVENTS.has(eventType)) return true;
  if (MARKETING_EVENTS.has(eventType)) return settings.marketingEmails;
  if (PROMOTION_EVENTS.has(eventType)) return settings.promotionEmails;
  if (REFERRAL_EVENTS.has(eventType)) return settings.referralUpdates;
  if (TRANSACTIONAL_EVENTS.has(eventType)) return settings.transactionalEmails;
  return settings.transactionalEmails;
}

export function canSendSms(
  eventType: CommunicationEventType,
  settings: CommunicationSettingsView,
): boolean {
  if (SECURITY_EVENTS.has(eventType)) return true;
  if (MARKETING_EVENTS.has(eventType)) return settings.marketingSms;
  if (PROMOTION_EVENTS.has(eventType)) return settings.promotionSms;
  if (REFERRAL_EVENTS.has(eventType)) return settings.referralUpdates;
  if (TRANSACTIONAL_EVENTS.has(eventType)) return settings.transactionalSms;
  return settings.transactionalSms;
}