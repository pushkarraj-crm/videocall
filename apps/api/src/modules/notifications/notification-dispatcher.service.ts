import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationPriority,
  NotificationReferenceType,
  NotificationType,
  Prisma,
  Role,
} from '@prisma/client';
import {
  resolveReferenceType,
  serializeNotification,
  supportsBrowserPush,
} from '../../common/utils/notification-display';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  isNotificationTypeEnabled,
} from '../../common/utils/notification-settings.util';
import { PrismaService } from '../../database/prisma.service';
import { NotificationEventsService } from './notification-events.service';
import type { SendAnnouncementDto } from './dto/send-announcement.dto';

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: NotificationReferenceType;
  referenceId?: string;
  image?: string | null;
  priority?: NotificationPriority;
  metadata?: Prisma.InputJsonValue;
  expiresAt?: Date | null;
};

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
  ) {}

  async create(input: CreateNotificationInput) {
    const settingsRow = await this.prisma.notificationSettings.findUnique({
      where: { userId: input.userId },
    });
    const settings = settingsRow
      ? {
          incomingCalls: settingsRow.incomingCalls,
          recharge: settingsRow.recharge,
          referral: settingsRow.referral,
          promotions: settingsRow.promotions,
          withdrawals: settingsRow.withdrawals,
          kyc: settingsRow.kyc,
          reviews: settingsRow.reviews,
          announcements: settingsRow.announcements,
          browserPush: settingsRow.browserPush,
          sound: settingsRow.sound,
          vibration: settingsRow.vibration,
        }
      : DEFAULT_NOTIFICATION_SETTINGS;

    if (!isNotificationTypeEnabled(input.type, settings)) {
      return null;
    }

    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        referenceType: input.referenceType ?? resolveReferenceType(input.type),
        referenceId: input.referenceId ?? null,
        image: input.image ?? null,
        priority: input.priority ?? NotificationPriority.normal,
        metadata: input.metadata,
        expiresAt: input.expiresAt ?? null,
      },
    });

    const serialized = serializeNotification(row);
    const unreadCount = await this.prisma.notification.count({
      where: { userId: input.userId, isRead: false },
    });

    this.events.emit(input.userId, { event: 'notification', notification: serialized });
    this.events.emit(input.userId, { event: 'unread_count', count: unreadCount });

    return { notification: serialized, unreadCount, browserPush: supportsBrowserPush(row.type) };
  }

  async onIncomingCall(
    callId: string,
    hostId: string,
    callerId: string,
    callerName: string,
    callerAvatarUrl?: string | null,
  ) {
    const result = await this.create({
      userId: hostId,
      type: NotificationType.incoming_call,
      title: 'Incoming call',
      message: `${callerName} is calling you`,
      referenceId: callId,
      image: callerAvatarUrl ?? null,
      priority: NotificationPriority.urgent,
      metadata: { callerId, callerName, callerAvatarUrl: callerAvatarUrl ?? null },
    });
    this.events.emit(hostId, {
      event: 'incoming_call',
      callId,
      callerId,
      callerName,
      callerAvatarUrl: callerAvatarUrl ?? null,
    });
    return result;
  }

  async onCallRejected(callId: string, callerId: string, hostName: string) {
    return this.create({
      userId: callerId,
      type: NotificationType.call_rejected,
      title: 'Call rejected',
      message: `${hostName} declined your call`,
      referenceId: callId,
      priority: NotificationPriority.high,
      metadata: { hostName, audience: 'user' },
    });
  }

  async onCallCancelled(callId: string, callerId: string) {
    return this.create({
      userId: callerId,
      type: NotificationType.call_cancelled,
      title: 'Call cancelled',
      message: 'Your call was cancelled before it was answered',
      referenceId: callId,
      priority: NotificationPriority.normal,
      metadata: { audience: 'user' },
    });
  }

  async onMissedCall(callId: string, callerId: string, hostName: string) {
    return this.create({
      userId: callerId,
      type: NotificationType.missed_call,
      title: 'Missed call',
      message: `You missed a call from ${hostName}`,
      referenceId: callId,
      priority: NotificationPriority.high,
      metadata: { hostName, audience: 'user' },
    });
  }

  async onRechargeSuccess(paymentId: string, userId: string, amountInr: string, coins: number) {
    return this.create({
      userId,
      type: NotificationType.recharge_success,
      title: 'Recharge successful',
      message: `₹${amountInr} added — ${coins} coins credited to your wallet`,
      referenceId: paymentId,
      priority: NotificationPriority.high,
      metadata: { amountInr, coins },
    });
  }

  async onRechargeFailed(paymentId: string, userId: string, amountInr: string, reason?: string) {
    return this.create({
      userId,
      type: NotificationType.recharge_failed,
      title: 'Recharge failed',
      message: reason?.trim()
        ? `Your ₹${amountInr} recharge failed: ${reason.trim()}`
        : `Your ₹${amountInr} recharge could not be completed`,
      referenceId: paymentId,
      priority: NotificationPriority.high,
      metadata: { amountInr, reason: reason ?? null },
    });
  }

  async onWithdrawalRequested(withdrawalId: string, hostId: string, amountInr: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.withdrawal_requested,
      title: 'Withdrawal requested',
      message: `Your withdrawal request of ₹${amountInr} has been submitted`,
      referenceId: withdrawalId,
      priority: NotificationPriority.normal,
      metadata: { amountInr },
    });
  }

  async onWithdrawalApproved(withdrawalId: string, hostId: string, amountInr: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.withdrawal_approved,
      title: 'Withdrawal approved',
      message: `Your withdrawal of ₹${amountInr} has been approved`,
      referenceId: withdrawalId,
      priority: NotificationPriority.high,
      metadata: { amountInr },
    });
  }

  async onWithdrawalRejected(
    withdrawalId: string,
    hostId: string,
    amountInr: string,
    reason?: string,
  ) {
    return this.create({
      userId: hostId,
      type: NotificationType.withdrawal_rejected,
      title: 'Withdrawal rejected',
      message: reason?.trim()
        ? `Your withdrawal of ₹${amountInr} was rejected: ${reason.trim()}`
        : `Your withdrawal of ₹${amountInr} was rejected`,
      referenceId: withdrawalId,
      priority: NotificationPriority.high,
      metadata: { amountInr, reason: reason ?? null },
    });
  }

  async onKycSubmitted(kycId: string, hostId: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.kyc_submitted,
      title: 'KYC submitted',
      message: 'Your KYC documents have been submitted for review',
      referenceId: kycId,
      priority: NotificationPriority.normal,
    });
  }

  async onKycApproved(kycId: string, hostId: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.kyc_approved,
      title: 'KYC approved',
      message: 'Your identity verification is complete. You can now withdraw earnings.',
      referenceId: kycId,
      priority: NotificationPriority.high,
    });
  }

  async onKycRejected(kycId: string, hostId: string, note?: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.kyc_rejected,
      title: 'KYC rejected',
      message: note?.trim()
        ? `Your KYC was rejected: ${note.trim()}`
        : 'Your KYC was rejected. Please resubmit your documents.',
      referenceId: kycId,
      priority: NotificationPriority.high,
      metadata: { note: note ?? null },
    });
  }

  async onCallEnded(callId: string, userId: string, durationSec: number, audience: 'user' | 'host') {
    return this.create({
      userId,
      type: NotificationType.call_ended,
      title: 'Call ended',
      message: `Your call ended · ${Math.max(1, Math.round(durationSec / 60))} min`,
      referenceId: callId,
      priority: NotificationPriority.normal,
      metadata: { audience, durationSec },
    });
  }

  async onReferralReward(referralId: string, userId: string, role: 'referrer' | 'referred') {
    return this.create({
      userId,
      type: NotificationType.referral_reward,
      title: 'Referral reward',
      message:
        role === 'referrer'
          ? 'Your referral reward has been credited to your wallet'
          : 'Welcome bonus from your referral has been credited',
      referenceId: referralId,
      priority: NotificationPriority.high,
      metadata: { role },
    });
  }

  async onFriendJoined(referralId: string, referrerId: string, friendName: string) {
    return this.create({
      userId: referrerId,
      type: NotificationType.friend_joined,
      title: 'Friend joined',
      message: `${friendName} joined using your referral code`,
      referenceId: referralId,
      priority: NotificationPriority.normal,
      metadata: { friendName },
    });
  }

  async onCouponAvailable(promoId: string, userId: string, code: string, title: string) {
    return this.create({
      userId,
      type: NotificationType.coupon_available,
      title: 'Coupon available',
      message: `Use code ${code} — ${title}`,
      referenceId: promoId,
      priority: NotificationPriority.normal,
      metadata: { code },
    });
  }

  async onCouponExpiring(promoId: string, userId: string, code: string, expiresAt: Date) {
    return this.create({
      userId,
      type: NotificationType.coupon_expiring,
      title: 'Coupon expiring soon',
      message: `Code ${code} expires ${expiresAt.toLocaleDateString()}`,
      referenceId: promoId,
      priority: NotificationPriority.high,
      expiresAt,
      metadata: { code },
    });
  }

  async onFestivalOffer(promoId: string, userId: string, title: string) {
    return this.create({
      userId,
      type: NotificationType.festival_offer,
      title: 'Festival offer',
      message: title,
      referenceId: promoId,
      priority: NotificationPriority.high,
    });
  }

  async onBonusCoins(usageId: string, userId: string, coins: number, code: string) {
    return this.create({
      userId,
      type: NotificationType.bonus_coins,
      title: 'Bonus coins added',
      message: `+${coins} bonus coins from coupon ${code}`,
      referenceId: usageId,
      priority: NotificationPriority.high,
      metadata: { coins, code },
    });
  }

  async onWithdrawalPaid(withdrawalId: string, hostId: string, amountInr: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.withdrawal_paid,
      title: 'Withdrawal paid',
      message: `₹${amountInr} has been transferred to your account`,
      referenceId: withdrawalId,
      priority: NotificationPriority.high,
      metadata: { amountInr },
    });
  }

  async onNewFollower(followId: string, hostId: string, followerName: string) {
    return this.create({
      userId: hostId,
      type: NotificationType.new_follower,
      title: 'New follower',
      message: `${followerName} started following you`,
      referenceId: followId,
      priority: NotificationPriority.normal,
      metadata: { followerName },
    });
  }

  async onNewReview(reviewId: string, hostId: string, authorName: string, rating: number) {
    return this.create({
      userId: hostId,
      type: NotificationType.new_review,
      title: 'New review',
      message: `${authorName} rated you ${rating}★`,
      referenceId: reviewId,
      priority: NotificationPriority.normal,
      metadata: { authorName, rating },
    });
  }

  async onRatingMilestone(hostId: string, averageRating: number, totalReviews: number) {
    return this.create({
      userId: hostId,
      type: NotificationType.rating_milestone,
      title: 'Rating milestone',
      message: `You reached ${averageRating.toFixed(1)}★ with ${totalReviews} reviews`,
      priority: NotificationPriority.normal,
      metadata: { averageRating, totalReviews },
    });
  }

  async onSystemNotice(
    userId: string,
    title: string,
    message: string,
    priority: NotificationPriority = NotificationPriority.normal,
  ) {
    return this.create({
      userId,
      type: NotificationType.system_notice,
      title,
      message,
      priority,
    });
  }

  async broadcastAnnouncement(adminId: string, dto: SendAnnouncementDto) {
    const priority = dto.priority ?? NotificationPriority.normal;
    const targetUserIds = await this.resolveAnnouncementTargets(dto);

    if (targetUserIds.length === 0) {
      return { sent: 0, targetUserIds: [] as string[] };
    }

    const metadata = {
      priority,
      target: dto.target,
      sentByAdminId: adminId,
    } satisfies Prisma.InputJsonValue;

    const results = await Promise.all(
      targetUserIds.map((userId) =>
        this.create({
          userId,
          type: NotificationType.admin_announcement,
          title: dto.title.trim(),
          message: dto.message.trim(),
          priority,
          metadata,
        }),
      ),
    );

    return {
      sent: results.length,
      targetUserIds,
    };
  }

  private async resolveAnnouncementTargets(dto: SendAnnouncementDto): Promise<string[]> {
    if (dto.target === 'single_user') {
      if (!dto.userId?.trim()) return [];
      const user = await this.prisma.user.findFirst({
        where: { id: dto.userId.trim(), deletedAt: null, status: 'active' },
        select: { id: true },
      });
      return user ? [user.id] : [];
    }

    if (dto.target === 'all_users') {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, status: 'active' },
        select: { id: true },
        take: 5000,
      });
      return users.map((u) => u.id);
    }

    if (dto.target === 'verified_hosts') {
      const hosts = await this.prisma.hostKyc.findMany({
        where: { verificationStatus: 'verified' },
        select: { userId: true },
        take: 5000,
      });
      return hosts.map((h) => h.userId);
    }

    if (dto.target === 'premium_users') {
      const wallets = await this.prisma.wallet.findMany({
        where: { lifetimeCreditedUnits: { gte: 500_000n } },
        select: { userId: true },
        take: 5000,
      });
      return wallets.map((w) => w.userId);
    }

    const role = dto.target === 'hosts_only' ? Role.host : Role.user;
    const roleRows = await this.prisma.userRole.findMany({
      where: { role, revokedAt: null, user: { deletedAt: null, status: 'active' } },
      select: { userId: true },
      take: 5000,
    });
    return [...new Set(roleRows.map((r) => r.userId))];
  }

  dispatchSafe(task: Promise<unknown>, context: string) {
    void task.catch((err) =>
      this.logger.warn(`Notification dispatch failed (${context}): ${err}`),
    );
  }
}
