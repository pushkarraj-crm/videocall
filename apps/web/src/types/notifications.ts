import type { GiftSentEvent } from '@/lib/gifts/types';

export type NotificationType =
  | 'incoming_call'
  | 'missed_call'
  | 'call_rejected'
  | 'call_cancelled'
  | 'call_ended'
  | 'recharge_success'
  | 'recharge_failed'
  | 'withdrawal_requested'
  | 'withdrawal_approved'
  | 'withdrawal_rejected'
  | 'withdrawal_paid'
  | 'kyc_submitted'
  | 'kyc_approved'
  | 'kyc_rejected'
  | 'referral_reward'
  | 'friend_joined'
  | 'coupon_available'
  | 'coupon_expiring'
  | 'festival_offer'
  | 'bonus_coins'
  | 'new_follower'
  | 'new_review'
  | 'rating_milestone'
  | 'admin_announcement'
  | 'system_notice'
  | 'maintenance_notice'
  | 'feature_release'
  | 'security_alert'
  | 'password_changed'
  | 'login_new_device';

export type NotificationReferenceType =
  | 'CALL'
  | 'WITHDRAWAL'
  | 'RECHARGE'
  | 'KYC'
  | 'REFERRAL'
  | 'PROMOTION'
  | 'SYSTEM';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export type NotificationPriorityLabel = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type NotificationTimeGroup = 'today' | 'yesterday' | 'earlier';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType: NotificationReferenceType | null;
  referenceId: string | null;
  image: string | null;
  priority: NotificationPriority;
  priorityLabel: NotificationPriorityLabel;
  isRead: boolean;
  clicked: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  actionRoute: string;
  timeGroup: NotificationTimeGroup;
}

export interface NotificationListResponse {
  items: AppNotification[];
  page?: number;
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export type NotificationStreamEvent =
  | { event: 'notification'; notification: AppNotification }
  | { event: 'unread_count'; count: number }
  | {
      event: 'incoming_call';
      callId: string;
      callerId: string;
      callerName: string;
      callerAvatarUrl: string | null;
    }
  | { event: 'call_status'; callId: string; status: string }
  | { event: 'call_gift'; callId: string; gift: GiftSentEvent }
  | { event: 'heartbeat'; ts: string };

export type AnnouncementTarget =
  | 'all_users'
  | 'hosts_only'
  | 'users_only'
  | 'verified_hosts'
  | 'premium_users'
  | 'single_user';
