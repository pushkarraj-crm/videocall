import {
  Notification,
  NotificationPriority,
  NotificationReferenceType,
  NotificationType,
} from '@prisma/client';

export type NotificationActionRoute =
  | '/calls/incoming'
  | '/history'
  | '/host/history'
  | '/wallet'
  | '/wallet/history'
  | '/host/withdraw'
  | '/host/kyc'
  | '/invite'
  | '/wallet/purchase'
  | '/promotions/history'
  | '/favorites'
  | '/host/dashboard'
  | '/notifications';

export type SerializedNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: NotificationReferenceType | null;
  referenceId: string | null;
  image: string | null;
  priority: NotificationPriority;
  priorityLabel: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  isRead: boolean;
  clicked: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  actionRoute: NotificationActionRoute;
  timeGroup: 'today' | 'yesterday' | 'earlier';
};

const BROWSER_PUSH_TYPES = new Set<NotificationType>([
  NotificationType.incoming_call,
  NotificationType.missed_call,
  NotificationType.recharge_success,
  NotificationType.withdrawal_approved,
  NotificationType.kyc_approved,
  NotificationType.referral_reward,
  NotificationType.festival_offer,
  NotificationType.admin_announcement,
]);

export function supportsBrowserPush(type: NotificationType): boolean {
  return BROWSER_PUSH_TYPES.has(type);
}

export function resolveReferenceType(type: NotificationType): NotificationReferenceType {
  switch (type) {
    case NotificationType.incoming_call:
    case NotificationType.missed_call:
    case NotificationType.call_rejected:
    case NotificationType.call_cancelled:
    case NotificationType.call_ended:
      return NotificationReferenceType.CALL;
    case NotificationType.referral_reward:
    case NotificationType.friend_joined:
      return NotificationReferenceType.REFERRAL;
    case NotificationType.coupon_available:
    case NotificationType.coupon_expiring:
    case NotificationType.festival_offer:
    case NotificationType.bonus_coins:
      return NotificationReferenceType.PROMOTION;
    case NotificationType.withdrawal_requested:
    case NotificationType.withdrawal_approved:
    case NotificationType.withdrawal_rejected:
    case NotificationType.withdrawal_paid:
      return NotificationReferenceType.WITHDRAWAL;
    case NotificationType.recharge_success:
    case NotificationType.recharge_failed:
      return NotificationReferenceType.RECHARGE;
    case NotificationType.kyc_submitted:
    case NotificationType.kyc_approved:
    case NotificationType.kyc_rejected:
      return NotificationReferenceType.KYC;
    case NotificationType.admin_announcement:
    case NotificationType.system_notice:
    default:
      return NotificationReferenceType.SYSTEM;
  }
}

export function priorityLabel(
  priority: NotificationPriority,
): SerializedNotification['priorityLabel'] {
  switch (priority) {
    case NotificationPriority.low:
      return 'LOW';
    case NotificationPriority.high:
      return 'HIGH';
    case NotificationPriority.urgent:
      return 'URGENT';
    default:
      return 'NORMAL';
  }
}

export function notificationActionRoute(
  type: NotificationType,
  metadata?: Record<string, unknown> | null,
): NotificationActionRoute {
  switch (type) {
    case NotificationType.incoming_call:
      return '/calls/incoming';
    case NotificationType.missed_call:
    case NotificationType.call_rejected:
    case NotificationType.call_cancelled:
      return metadata?.audience === 'host' ? '/host/history' : '/history';
    case NotificationType.recharge_success:
    case NotificationType.recharge_failed:
      return '/wallet';
    case NotificationType.withdrawal_requested:
    case NotificationType.withdrawal_approved:
    case NotificationType.withdrawal_rejected:
      return '/host/withdraw';
    case NotificationType.kyc_submitted:
    case NotificationType.kyc_approved:
    case NotificationType.kyc_rejected:
      return '/host/kyc';
    case NotificationType.referral_reward:
    case NotificationType.friend_joined:
      return '/invite';
    case NotificationType.coupon_available:
    case NotificationType.coupon_expiring:
    case NotificationType.festival_offer:
    case NotificationType.bonus_coins:
      return '/wallet/purchase';
    case NotificationType.new_follower:
      return '/host/dashboard';
    case NotificationType.new_review:
    case NotificationType.rating_milestone:
      return '/host/dashboard';
    case NotificationType.call_ended:
      return metadata?.audience === 'host' ? '/host/history' : '/history';
    case NotificationType.admin_announcement:
    case NotificationType.system_notice:
    case NotificationType.maintenance_notice:
    case NotificationType.feature_release:
    case NotificationType.security_alert:
    case NotificationType.password_changed:
    case NotificationType.login_new_device:
      return '/notifications';
    default:
      return '/notifications';
  }
}

export function resolveTimeGroup(createdAt: Date, now = new Date()): SerializedNotification['timeGroup'] {
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  if (createdAt >= startToday) return 'today';
  if (createdAt >= startYesterday) return 'yesterday';
  return 'earlier';
}

export function serializeNotification(
  row: Notification,
  now = new Date(),
): SerializedNotification {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? null;
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    referenceType: row.referenceType ?? resolveReferenceType(row.type),
    referenceId: row.referenceId,
    image: row.image,
    priority: row.priority,
    priorityLabel: priorityLabel(row.priority),
    isRead: row.isRead,
    clicked: row.clicked,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    actionRoute: notificationActionRoute(row.type, metadata),
    timeGroup: resolveTimeGroup(row.createdAt, now),
  };
}