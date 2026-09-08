import { NotificationType } from '@prisma/client';

export interface NotificationPreferenceFlags {
  incomingCalls: boolean;
  recharge: boolean;
  referral: boolean;
  promotions: boolean;
  withdrawals: boolean;
  kyc: boolean;
  reviews: boolean;
  announcements: boolean;
  browserPush: boolean;
  sound: boolean;
  vibration: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationPreferenceFlags = {
  incomingCalls: true,
  recharge: true,
  referral: true,
  promotions: true,
  withdrawals: true,
  kyc: true,
  reviews: true,
  announcements: true,
  browserPush: true,
  sound: true,
  vibration: true,
};

const URGENT_ALWAYS: NotificationType[] = [NotificationType.incoming_call];

export function isNotificationTypeEnabled(
  type: NotificationType,
  settings: NotificationPreferenceFlags,
): boolean {
  if (URGENT_ALWAYS.includes(type)) return true;

  switch (type) {
    case NotificationType.incoming_call:
    case NotificationType.missed_call:
    case NotificationType.call_rejected:
    case NotificationType.call_cancelled:
    case NotificationType.call_ended:
      return settings.incomingCalls;
    case NotificationType.recharge_success:
    case NotificationType.recharge_failed:
    case NotificationType.bonus_coins:
      return settings.recharge;
    case NotificationType.referral_reward:
    case NotificationType.friend_joined:
      return settings.referral;
    case NotificationType.coupon_available:
    case NotificationType.coupon_expiring:
    case NotificationType.festival_offer:
      return settings.promotions;
    case NotificationType.withdrawal_requested:
    case NotificationType.withdrawal_approved:
    case NotificationType.withdrawal_rejected:
    case NotificationType.withdrawal_paid:
      return settings.withdrawals;
    case NotificationType.kyc_submitted:
    case NotificationType.kyc_approved:
    case NotificationType.kyc_rejected:
      return settings.kyc;
    case NotificationType.new_follower:
    case NotificationType.new_review:
    case NotificationType.rating_milestone:
      return settings.reviews;
    case NotificationType.admin_announcement:
    case NotificationType.system_notice:
    case NotificationType.maintenance_notice:
    case NotificationType.feature_release:
    case NotificationType.security_alert:
    case NotificationType.password_changed:
    case NotificationType.login_new_device:
      return settings.announcements;
    default:
      return true;
  }
}

const BROWSER_PUSH_EXCLUDED = new Set<NotificationType>([
  NotificationType.call_cancelled,
  NotificationType.system_notice,
]);

export function supportsBrowserPushForSettings(type: NotificationType): boolean {
  return !BROWSER_PUSH_EXCLUDED.has(type);
}